const _Socket = class _Socket {
  constructor(map) {
    this.ProtocolVersionNumber = "0.1";
    this.ReconnectCount = 0;
    this.WasShownLimitDialog = false;
    this.WSDServer = {
      Id: "",
      Version: "",
      Hash: "",
      Protocol: "",
      Options: ""
    };
    this.IndirectSocketReconnectCount = 0;
    this._initialConnectRetries = 0;
    this._forceLegacyWsUrl = false;
    this._connectCount = 0;
    this.enableTraceEventLogging = false;
    this.TunnelledDialogImageCacheSize = 0;
    this._accessTokenExpireWarningCount = 0;
    this._externalLinksDisabled = false;
    this._externalLinksListening = false;
    this._externalLinksShown = false;
    this.workers = [];
    this.workerMessageHandlers = /* @__PURE__ */ new Map();
    this.workerErrorHandlers = [];
    window.app.console.debug("socket.initialize:");
    this._map = map;
    this._slurpQueue = [];
    this._msgQueue = [];
    this._delayedMessages = [];
    this._handlingDelayedMessages = false;
    this._inLayerTransaction = false;
    this._slurpDuringTransaction = false;
    this.threadLocalLoggingLevelToggle = false;
    this._accessTokenExpireTimeout = void 0;
    this._reconnecting = false;
    this._slurpTimer = void 0;
    this._renderEventTimer = void 0;
    this._renderEventTimerStart = void 0;
    this._slurpTimerDelay = void 0;
    this._slurpTimerLaunchTime = void 0;
    this.timer = void 0;
    this.socket = void 0;
    this.traceEvents = new TraceEvents(this);
    const hasWorkerSupport = !!window.Worker;
    const isMobileApp = window.ThisIsAMobileApp && !window.mode.isCODesktop();
    const workerUrl = hasWorkerSupport && !isMobileApp ? this.taskWorkerUrl() : "";
    if (workerUrl) {
      window.app.console.info("Creating TaskWorkers");
      for (let i = 0; i < 4; ++i) {
        try {
          this.workers.push(new Worker(workerUrl));
          this.workers[i].addEventListener("message", (e) => this.onWorkerMessage(e));
          this.workers[i].addEventListener("error", (e) => this.onWorkerError(e));
        } catch (e) {
          this.onWorkerError(e);
          break;
        }
      }
    }
  }
  // A worker must load from the frame's origin. On a remote page, only the app's
  // TaskWorker.js is used, as coolwsd's may be another version than the page.
  taskWorkerUrl() {
    const url = app.LOUtil.getURL("/src/app/TaskWorker.js");
    const isServedHere = url.startsWith(location.origin + "/");
    if (window.codaRemotePage && !isServedHere) {
      window.app.console.info("No TaskWorkers on this remote page");
      return "";
    }
    return url;
  }
  getTaskWorkers() {
    return this.workers.slice();
  }
  setTaskHandler(message, callback) {
    if (this.workerMessageHandlers.has(message))
      window.app.console.warn("Duplicate task handler for " + message, callback);
    this.workerMessageHandlers.set(message, callback);
  }
  addTaskErrorHandler(callback) {
    this.workerErrorHandlers.push(callback);
  }
  onWorkerMessage(e) {
    const callback = this.workerMessageHandlers.get(e.data.message);
    if (!callback) {
      window.app.console.warn("Unhandled worker message", e);
      return;
    }
    callback(e);
  }
  onWorkerError(e) {
    if (e)
      window.app.console.error("Worker-related error encountered", e);
    while (this.workers.length) {
      const worker = this.workers.shift();
      if (!worker)
        continue;
      try {
        worker.terminate();
      } catch (e2) {
        window.app.console.error("Error terminating worker thread", e2);
      }
    }
    this.workerMessageHandlers.clear();
    if (e)
      for (const callback of this.workerErrorHandlers)
        callback(e);
    this.workerErrorHandlers = [];
  }
  disableTaskWorkers() {
    this.onWorkerError(null);
  }
  // Wrap the active socket in a DelaySocket so all incoming and outgoing
  // messages are delayed by delayMs (preserving FIFO order). No-op if
  // already wrapped or no socket is connected.
  enableMessageDelay(delayMs) {
    if (!this.socket || this.socket instanceof DelaySocket)
      return;
    const wrapper = new DelaySocket(this.socket, delayMs);
    wrapper.onerror = this._onSocketError.bind(this);
    wrapper.onclose = this._onSocketClose.bind(this);
    wrapper.onopen = this._onSocketOpen.bind(this);
    wrapper.onmessage = this._slurpMessage.bind(this);
    this.socket = wrapper;
  }
  setMessageDelay(delayMs) {
    if (this.socket instanceof DelaySocket)
      this.socket.setDelay(delayMs);
  }
  // Unwrap a previously-installed DelaySocket, restoring the raw socket.
  // No-op if there is no wrapper.
  disableMessageDelay() {
    if (!this.socket || !(this.socket instanceof DelaySocket))
      return;
    const inner = this.socket.unwrap();
    inner.onerror = this._onSocketError.bind(this);
    inner.onclose = this._onSocketClose.bind(this);
    inner.onopen = this._onSocketOpen.bind(this);
    inner.onmessage = this._slurpMessage.bind(this);
    this.socket = inner;
  }
  /// Sends the message. Where the outbox takes it as a change of objects, the ticket of that
  /// change is added to the given tickets.
  sendMessage(msg, tickets) {
    if (!this.socket) {
      console.error("sendMessage() called with non-existent socket!");
      return;
    }
    if (this._map._debug.eventDelayWatchdog)
      this._map._debug.timeEventDelay();
    if (this._map._fatal) {
      return;
    }
    if (!app.idleHandler._active) {
      if (typeof msg !== "string")
        return;
      if (!msg.startsWith("useractive") && !msg.startsWith("userinactive")) {
        window.app.console.log('Ignore outgoing message due to inactivity: "' + msg + '"');
        return;
      }
    }
    if (this._map.uiManager && this._map.uiManager.isUIBlocked())
      return;
    if (typeof msg === "string")
      msg = LocalCaret.tellBefore(msg);
    if (typeof msg === "string") {
      msg = RenderManager.toEngine(msg);
      if (ChangeOutbox.take(msg, tickets))
        return;
      msg = ChangeOutbox.sendAhead(msg);
    }
    const socketState = this.socket.readyState;
    if (socketState === 2 || socketState === 3) {
      this._map.loadDocument();
    }
    if (socketState === 1) {
      this._doSend(msg);
    } else {
      this._msgQueue.push(msg);
    }
  }
  sendTraceEvent(name2, ph, timeRange, args, id, tid) {
    this.traceEvents.send(name2, ph, timeRange, args, id, tid);
  }
  get traceEventRecordingToggle() {
    return this.traceEvents.getRecordingToggle();
  }
  setTraceEventLogging(enabled) {
    this.traceEvents.setLogging(enabled);
  }
  createAsyncTraceEvent(name2, args) {
    return this.traceEvents.createAsync(name2, args);
  }
  _stringifyArgs(args) {
    return args == null ? "" : " args=" + JSON.stringify(args);
  }
  createCompleteTraceEvent(name2, args) {
    return this.traceEvents.createComplete(name2, args);
  }
  createCompleteTraceEventFromEvent(textMsg) {
    return this.traceEvents.createCompleteFromEvent(textMsg);
  }
  parseServerCmd(msg) {
    return new ServerCommand(msg, this._map);
  }
  getWebSocketBaseURI(map) {
    if (map.options.wopiSrc && !this._forceLegacyWsUrl) {
      let docParams = $.param(map.options.docParams);
      if (window.reconnectToken)
        docParams += (docParams ? "&" : "") + "ReconnectToken=" + window.reconnectToken;
      return window.makeWopiCoolWsUrl(window.makeWsUrl("/cool"), docParams);
    } else {
      return window.makeWsUrlWopiSrc("/cool/", map.options.doc + "?" + $.param(map.options.docParams));
    }
  }
  connect(socket) {
    const map = this._map;
    if (!socket && this.socket && this.socket.readyState === 0) {
      window.app.console.debug("connect: a connection is already opening");
      return;
    }
    map._docHasPasswordToModify = false;
    map._modifyPasswordProvided = false;
    map.options.docParams["permission"] = app.getPermission();
    if (this.socket) {
      this.close();
    }
    if (socket && (socket.readyState === 1 || socket.readyState === 0)) {
      this.socket = socket;
    } else if (window.ThisIsAMobileApp) {
    } else {
      try {
        this.socket = window.createWebSocket(this.getWebSocketBaseURI(map));
        window.socket = this.socket;
      } catch (e) {
        this._map.fire("error", {
          msg: _("Oops, there is a problem connecting to {productname}: ").replace("{productname}", typeof brandProductName !== "undefined" ? brandProductName : "Collabora Online Development Edition (unbranded)") + e,
          cmd: "socket",
          kind: "failed",
          id: 3
        });
        return;
      }
    }
    if (!this.socket) {
      console.error("connect: this.socket is still undefined!");
      return;
    }
    this.socket.onerror = this._onSocketError.bind(this);
    this.socket.onclose = this._onSocketClose.bind(this);
    this.socket.onopen = this._onSocketOpen.bind(this);
    this.socket.onmessage = this._slurpMessage.bind(this);
    this.socket.binaryType = "arraybuffer";
    this._connectCount++;
    this._faultInjection();
    const debug = this._map._debug;
    if (debug && debug.messageDelayOn)
      this.enableMessageDelay(debug.messageDelayMs);
    this.resetTokenExpiryTimer();
    this._emptyQueue();
  }
  resetTokenExpiryTimer() {
    clearTimeout(this._accessTokenExpireTimeout);
    this._accessTokenExpireWarningCount = 0;
    const ttl = parseInt(this._map.options.docParams.access_token_ttl);
    if (this._map.options.docParams.access_token && ttl) {
      const tokenExpiryWarning = 900 * 1e3;
      const delayMs = ttl - Date.now() - tokenExpiryWarning;
      if (delayMs > 0) {
        this._accessTokenExpireTimeout = setTimeout(this._sessionExpiredWarning.bind(this), delayMs);
      } else {
        this._sessionExpiredWarning();
        this._accessTokenExpireTimeout = setTimeout(this.resetTokenExpiryTimer.bind(this), 2 * 60 * 1e3);
      }
    }
  }
  close(code, reason) {
    if (!this.socket) {
      console.error("Tried close() on non-existent socket!");
      return;
    }
    this.socket.onerror = function() {
    };
    this.socket.onclose = function() {
    };
    this.socket.onmessage = window.ThisIsAMobileApp ? this._onShellEventWhileClosed.bind(this) : function() {
    };
    this.socket.close(code ?? _Socket.UserExitCode, reason);
    this._map["wopi"].resetAppLoaded();
    this._map.fire("docloaded", { status: false });
    clearTimeout(this._accessTokenExpireTimeout);
  }
  _onShellEventWhileClosed(evt) {
    if (typeof evt.data === "string" && evt.data.startsWith("mobile:")) {
      this._onMessage({ textMsg: evt.data });
    }
  }
  _doSend(msg) {
    if (!this.socket) {
      console.error("_doSend() called when socket is non-existent!");
      return;
    }
    if (typeof msg === "string")
      this._logSocket("OUTGOING", msg);
    this.socket.send(msg);
  }
  _onSocketOpen(evt) {
    window.app.console.debug("_onSocketOpen:");
    app.idleHandler._serverRecycling = false;
    app.idleHandler._documentIdle = false;
    const now0 = Date.now();
    const now1 = performance.now();
    const now2 = Date.now();
    this._doSend("coolclient " + this.ProtocolVersionNumber + " " + (now0 + now2) / 2 + " " + now1);
    let msg = "load url=" + encodeURIComponent(this._map.options.doc);
    if (this._map._docLayer) {
      this._reconnecting = true;
      msg += " part=" + this._map.getCurrentPartNumber();
    }
    if (this._map.options.timestamp) {
      msg += " timestamp=" + this._map.options.timestamp;
    }
    if (this._map._docPassword) {
      msg += " password=" + this._map._docPassword;
    }
    if (String.locale) {
      msg += " lang=" + String.locale;
    }
    if (window.deviceFormFactor) {
      msg += " deviceFormFactor=" + window.deviceFormFactor;
    }
    msg += " timezone=" + Intl.DateTimeFormat().resolvedOptions().timeZone;
    const spellOnline = window.prefs.spellOnlineForLoad();
    if (spellOnline) {
      msg += " spellOnline=" + spellOnline;
    }
    const formattingMarks = window.prefs.get("text.ShowFormattingMarks");
    if (formattingMarks) {
      msg += " formattingMarks=" + formattingMarks;
    }
    const darkTheme = window.prefs.seedDarkModeDefault();
    msg += " darkTheme=" + darkTheme;
    const darkBackground = window.prefs.getBoolean("darkBackgroundForTheme." + (darkTheme ? "dark" : "light"), darkTheme);
    msg += " darkBackground=" + darkBackground;
    this._map.uiManager.rememberThemeSentWithLoad(darkTheme, darkBackground);
    this._map.uiManager.initDarkBackgroundUI(darkBackground);
    const focusRingColor = window.getFocusRingColor();
    if (focusRingColor) {
      msg += " focusRingColor=" + focusRingColor;
    }
    window.seedCypressAccessibilityState();
    msg += " accessibilityState=" + window.getAccessibilityState();
    msg += " clientvisiblearea=" + window.makeClientVisibleArea();
    this._doSend(msg);
    for (let i = 0; i < this._msgQueue.length; i++) {
      this._doSend(this._msgQueue[i]);
    }
    this._msgQueue = [];
    app.idleHandler._activate();
  }
  _onSocketClose(event) {
    const reason = (event == null ? void 0 : event.reason) ?? "";
    window.app.console.debug("_onSocketClose: code=" + (event == null ? void 0 : event.code) + " wasClean=" + (event == null ? void 0 : event.wasClean) + " reason=" + reason);
    if (!this._map._docLoadedOnce && this.ReconnectCount === 0) {
      let errorType = "";
      let errorMsg;
      let errorDetail;
      if (reason && reason.startsWith("error:")) {
        var command = this.parseServerCmd(reason);
        errorDetail = command.errorDetail;
        if (command.errorCmd === "internal" && command.errorKind === "unauthorized") {
          errorType = "websocketunauthorized";
          errorMsg = this._buildUnauthorizedMessage(command);
        } else if (command.errorCmd === "storage" && command.errorKind === "loadfailed") {
          errorType = "websocketloadfailed";
          errorMsg = window.errorMessages.storage.loadfailed;
        } else {
          errorType = "websocketgenericfailure";
          errorMsg = window.errorMessages.websocketgenericfailure;
        }
      } else if (this._initialConnectRetries++ < 3) {
        window.app.console.debug("_onSocketClose: transient failure during initial load, attempt " + this._initialConnectRetries);
        this._map["wopi"].resetAppLoaded();
        setTimeout(() => {
          this._scheduleReconnect();
        }, 1);
        return;
      } else if (this._map.options.wopiSrc && !this._forceLegacyWsUrl) {
        this._forceLegacyWsUrl = true;
        this._initialConnectRetries = 0;
        this._map["wopi"].resetAppLoaded();
        setTimeout(() => {
          this._scheduleReconnect();
        }, 1);
        return;
      } else {
        errorType = "websocketproxyfailure";
        errorMsg = window.errorMessages.websocketproxyfailure;
      }
      this._map.fire("error", {
        msg: errorMsg,
        cmd: "socket",
        kind: "closed",
        id: 4,
        errorDetail
      });
      const postMessageObj = {
        errorType,
        success: false,
        errorMsg,
        result: ""
      };
      this._map.fire("postMessage", {
        msgId: "Action_Load_Resp",
        args: postMessageObj
      });
      return;
    }
    if (this.ReconnectCount > 0)
      return;
    const isActive = app.idleHandler._active;
    this._map.hideBusy();
    app.idleHandler._active = false;
    app.idleHandler._serverRecycling = false;
    if (this._map._docLayer) {
      if (app.activeDocument && !this._reconnecting)
        this._map._docLayer._savedScrollPos = app.activeDocument.activeLayout.viewedRectangle.clone();
      this._map._docLayer._restoringViewScroll = false;
      this._map._docLayer.removeAllViews();
      this._map._docLayer._resetClientVisArea();
      if (GraphicSelection.hasActiveSelection())
        GraphicSelection.rectangle = null;
      if (this._map._docLayer._docType === "presentation") {
        LocalCaret.forget();
        cool.InputSequence.forget();
        app.setCursorVisibility(false);
      }
      this._map._docLayer._resetCanonicalIdStatus();
      this._map._docLayer._resetViewId();
      this._map._docLayer._resetDocumentInfo();
    }
    this._delayedMessages = [];
    if (isActive && this._reconnecting) {
      this._map.fire("error", {
        msg: _("Well, this is embarrassing, we cannot connect to your document. Please try again."),
        cmd: "socket",
        kind: "closed",
        id: 4
      });
    }
    this._map["wopi"].resetAppLoaded();
    this._map.fire("docloaded", { status: false });
    setTimeout(
      () => {
        if (!this._reconnecting) {
          this._reconnecting = true;
          this._scheduleReconnect();
        }
      },
      1
      /* ms */
    );
    if (this._map.isEditMode()) {
      this._map.setPermission("view");
    }
    if (!this._map["wopi"].DisableInactiveMessages && app.sectionContainer && !app.sectionContainer.testing)
      this._map.uiManager.showSnackbar(window.mode.isCODesktop() ? _("The connection to the document has been lost.") : _("The server has been disconnected."));
  }
  // Simulate error conditions for testing via the
  // simulateError URL parameter.
  _faultInjection() {
    if (this._connectCount === 1 && this.socket && window.simulateError("socket:initialClose")) {
      const sock = this.socket;
      if (sock.readyState === 1) {
        setTimeout(function() {
          sock.close();
        }, 0);
      } else {
        const realOnOpen = sock.onopen;
        sock.onopen = function(evt) {
          realOnOpen(evt);
          setTimeout(function() {
            sock.close();
          }, 0);
        };
      }
    }
  }
  _scheduleReconnect() {
    app.idleHandler._active = false;
    if (!app.idleHandler._documentIdle)
      this._map.showBusy(_("Reconnecting..."), false);
    app.idleHandler._activate();
  }
  _onSocketError(evt) {
    window.app.console.warn("_onSocketError:", evt);
    this._map.hideBusy();
  }
  // The problem: if we process one websocket message at a time, the
  // browser -loves- to trigger a re-render as we hit the main-loop,
  // this takes ~200ms on a large screen, and worse we get
  // producer/consumer issues that can fill a multi-second long
  // buffer of web-socket messages in the client that we can't
  // process so - slurp and then emit at idle - its faster to delay!
  _slurpMessage(evt) {
    const e = evt;
    this._extractTextImg(e);
    const docLayer = this._map ? this._map._docLayer : void 0;
    if (docLayer && docLayer.filterSlurpedMessage(e))
      return;
    const predictedTiles = RenderManager.predictTilesToSlurp();
    const delayMS = Math.max(Math.min(predictedTiles, 50), 1);
    if (!this._slurpQueue)
      this._slurpQueue = [];
    this._slurpQueue.push(e);
    this._queueSlurpEventEmission(delayMS);
  }
  _emptyQueue() {
    if (window.queueMsg && window.queueMsg.length > 0) {
      for (let it = 0; it < window.queueMsg.length; it++) {
        const msg = window.queueMsg[it];
        const evt = { data: msg, textMsg: msg };
        this._slurpMessage(evt);
      }
      window.queueMsg = [];
    }
  }
  _sessionExpiredWarning() {
    clearTimeout(this._accessTokenExpireTimeout);
    const remainingMs = parseInt(this._map.options.docParams.access_token_ttl) - Date.now();
    const expirymsg = remainingMs <= 0 ? window.errorMessages.sessionexpired : window.errorMessages.sessionexpiry;
    const timerepr = Util.humanizeDuration(remainingMs, 1);
    this._map.fire("warn", { msg: expirymsg.replace("{time}", timerepr) });
    this._map.fire("postMessage", {
      msgId: "App_TokenExpiring",
      args: {
        Timeout: Math.max(remainingMs, 0)
      }
    });
    this._accessTokenExpireWarningCount++;
    if (this._accessTokenExpireWarningCount < 10) {
      this._accessTokenExpireTimeout = setTimeout(this._sessionExpiredWarning.bind(this), 120 * 1e3);
    }
  }
  setUnloading() {
    if (this.socket && this.socket.setUnloading)
      this.socket.setUnloading();
  }
  connected() {
    return this.socket !== void 0 && this.socket.readyState === 1;
  }
  _logSocket(type, msg) {
    const logMessage = this._map._debug.debugNeverStarted || this._map._debug.logIncomingMessages;
    if (!logMessage)
      return;
    if (window.ThisIsTheQtApp)
      window.postMobileDebug(type + " " + msg);
    const debugOn = this._map._debug.debugOn;
    if (this._map._debug.overlayOn) {
      this._map._debug.setOverlayMessage("postMessage", type + ": " + msg);
    }
    if (!debugOn && !window.L.Browser.cypressTest && msg.length > 256)
      msg = msg.substring(0, 256) + "<truncated " + (msg.length - 256) + "chars>";
    let status = "";
    if (!window.fullyLoadedAndReady)
      status += "[!fullyLoadedAndReady]";
    if (!window.bundlejsLoaded)
      status += "[!bundlejsLoaded]";
    app.Log.log(msg, type, status);
    if (!window.protocolDebug && !debugOn)
      return;
    const color = type === "OUTGOING" ? "color:red" : "color:#2e67cf";
    window.app.console.log(+/* @__PURE__ */ new Date() + " %c" + type + status + "%c: " + msg.concat(" ").replace(" ", "%c "), "background:#ddf;color:black", color, "color:");
  }
  _getParameterByName(url, name2) {
    const escape = (str) => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };
    const regex = new RegExp("[\\?&]" + escape(name2) + "=([^&#]*)");
    const results = regex.exec(url);
    return results === null ? "" : results[1].replace(/\+/g, " ");
  }
  _utf8ToString(data) {
    let strBytes = "";
    for (let it = 0; it < data.length; it++) {
      strBytes += String.fromCharCode(data[it]);
    }
    return strBytes;
  }
  // Returns true if, and only if, we are ready to start loading
  // the tiles and rendering the document.
  _isReady() {
    if (window.bundlejsLoaded == false || window.fullyLoadedAndReady == false) {
      return false;
    }
    if (typeof this._map == "undefined" || isNaN(this._map.options.tileWidthTwips) || isNaN(this._map.options.tileHeightTwips)) {
      return false;
    }
    if (isNaN(this._map.getZoom())) {
      return false;
    }
    return true;
  }
  _queueSlurpEventEmission(delayMS) {
    let now = Date.now();
    if (this._slurpTimer && this._slurpTimerDelay != delayMS) {
      clearTimeout(this._slurpTimer);
      this._slurpTimer = void 0;
      this._slurpTimerDelay = delayMS;
      now = Date.now();
      if (this._slurpTimerLaunchTime === void 0) {
        console.assert(false, "_slurpTimerLaunchTime is undefined when _slurpTimer exists!");
        return;
      }
      const sinceLaunchMS = now - this._slurpTimerLaunchTime;
      delayMS -= sinceLaunchMS;
      if (delayMS <= 0)
        delayMS = 1;
    }
    if (!this._slurpTimer) {
      if (!this._slurpTimerLaunchTime) {
        this._slurpTimerLaunchTime = now;
        this._slurpTimerDelay = delayMS;
      }
      this._slurpTimer = setTimeout(function() {
        this._slurpTimer = void 0;
        this._slurpTimerLaunchTime = void 0;
        this._slurpTimerDelay = void 0;
        if (this._inLayerTransaction) {
          this._slurpDuringTransaction = true;
          return;
        }
        this._emitSlurpedEvents();
      }.bind(this), delayMS);
    }
  }
  _emitSlurpedEvents() {
    if (this._map._debug.eventDelayWatchdog)
      this._map._debug.timeEventDelay();
    const queueLength = this._slurpQueue.length;
    const completeEventWholeFunction = this.createCompleteTraceEvent("emitSlurped-" + String(queueLength), { "_slurpQueue.length": String(queueLength) });
    if (this._map && this._map._docLayer) {
      RenderManager.beginTransaction();
      this._inLayerTransaction = true;
      if (this.traceEventRecordingToggle) {
        if (!this._renderEventTimer)
          this._renderEventTimer = setTimeout(function() {
            if (this._renderEventTimerStart === void 0) {
              console.assert(false, "_renderEventTimerStart is undefined when renderEvent is run!");
              return;
            }
            const now = performance.now();
            const delta = now - this._renderEventTimerStart;
            if (delta >= 2) {
              this.sendTraceEvent(name, "X", "ts=" + Math.round(this._renderEventTimerStart * 1e3) + " dur=" + Math.round((now - this._renderEventTimerStart) * 1e3));
              this._renderEventTimerStart = void 0;
            }
            this._renderEventTimer = void 0;
          }, 0);
      }
    }
    let complete = true;
    try {
      for (let i = 0; i < queueLength; ++i) {
        const evt = this._slurpQueue[i];
        if (evt.isComplete()) {
          let textMsg;
          if (typeof evt.data === "string") {
            textMsg = evt.data.replace(/\s+/g, ".");
          } else if (typeof evt.data === "object") {
            textMsg = evt.textMsg.replace(/\s+/g, ".");
          }
          const completeEventOneMessage = this.createCompleteTraceEventFromEvent(textMsg);
          try {
            this._onMessage(evt);
          } catch (e) {
            const msg = "Exception " + e + " emitting event " + evt.data + "\n" + e.stack;
            window.app.console.error(msg);
            if (window.enableDebug || window.L.Browser.cypressTest)
              this._map.uiManager.showInfoModal("cool_alert", "", msg, "", _("Close"), function() {
              }, false);
            if (window.L.Browser.cypressTest && window.parent !== window && e !== null) {
              console.log("Sending event error to Cypress...", e);
              window.parent.postMessage(e);
            }
          } finally {
            if (completeEventOneMessage)
              completeEventOneMessage.finish();
          }
        } else {
          this._slurpQueue = this._slurpQueue.slice(i, queueLength);
          complete = false;
          break;
        }
      }
    } finally {
      if (completeEventWholeFunction)
        completeEventWholeFunction.finish();
    }
    if (complete)
      this._slurpQueue = [];
    if (this._map) {
      const completeCallback = () => {
        this._map.fire("messagesdone");
        this._renderEventTimerStart = performance.now();
        this._inLayerTransaction = false;
        if (this._slurpDuringTransaction) {
          this._slurpDuringTransaction = false;
          this._queueSlurpEventEmission(1);
        }
      };
      if (this._inLayerTransaction && this._map._docLayer) {
        RenderManager.endTransaction(completeCallback);
      } else {
        completeCallback();
      }
    }
  }
  _exportAsCallback(command) {
    this._map.hideBusy();
    Util.ensureValue(command.filename);
    this._map.uiManager.showInfoModal("exported-success", _("Exported to storage"), _("Successfully exported: ") + decodeURIComponent(command.filename), "", _("OK"));
  }
  _onStatusMsg(textMsg, command) {
    if (!this._isReady()) {
      setTimeout(() => {
        this._onStatusMsg(textMsg, command);
      }, 10);
      return;
    }
    if (!this._map._docLayer) {
      Util.ensureValue(command.type);
      this._map.initTextInput(command.type);
      app.initExportFormats(command.type);
      if (window.prefs.useBrowserSetting) {
        if (!window.mode.isSmallScreenDevice() && this._map.uiManager.getCurrentMode() === "notebookbar")
          this._map.uiManager.removeClassicUI();
        else if (!this._map.menubar)
          this._map.uiManager.initializeMenubarAndTopToolbar();
      }
      let tileWidthTwips = this._map.options.tileWidthTwips;
      let tileHeightTwips = this._map.options.tileHeightTwips;
      if (this._map.options.zoom !== this._map.options.defaultZoom) {
        const scale = InternPointUtil.scale(this._map.options.defaultZoom - this._map.options.zoom);
        tileWidthTwips = Math.round(tileWidthTwips * scale);
        tileHeightTwips = Math.round(tileHeightTwips * scale);
      }
      let docLayer = null;
      const options = {
        tileWidthTwips: tileWidthTwips / app.dpiScale,
        tileHeightTwips: tileHeightTwips / app.dpiScale,
        docType: command.type,
        viewId: command.viewid,
        partHasComments: command.partHasComments,
        documentWidthTwips: command.width
      };
      if (command.type === "text")
        docLayer = new window.L.WriterTileLayer(options);
      else if (command.type === "spreadsheet")
        docLayer = new window.L.CalcTileLayer(options);
      else if (command.type === "presentation" || command.type === "drawing")
        docLayer = new window.L.ImpressTileLayer(options);
      Util.ensureValue(docLayer);
      this._map._docLayer = docLayer;
      this._map.addLayer(docLayer);
      this._map.fire("doclayerinit");
    } else if (this._reconnecting) {
      this._map._docLayer._resetClientVisArea();
      RenderManager.refreshTilesInBackground();
      RenderManager.forgetRequestsInFlight();
      RenderManager.revalidateCachedParts();
      this._map.fire("statusindicator", { statusType: "reconnected" });
      if (!command.reattached) {
        if (GraphicSelection.inPlaceArea)
          GraphicSelection.leaveInPlace();
        const darkTheme = window.prefs.getBoolean("darkTheme");
        this._map.uiManager.activateDarkModeInCore(darkTheme);
        this._map.uiManager.applyInvert();
        this._map.uiManager.setCanvasColorAfterModeChange();
        this._map.uiManager.closeAll();
        if (RenderGeometrySection.answersPointer())
          RenderGeometrySection.requestPointerFromServer(false);
      }
      this._map.setPermission(app.file.permission);
      this.endMigration();
      if (!command.reattached) {
        this._map.uiManager.initializeSidebar();
        this._map.uiManager.refreshTheme();
      }
    }
    this._map.fire("docloaded", { status: true });
    if (this._map._docLayer) {
      this._map._docLayer._onMessage(textMsg);
      if (!this._map._docLayer._getViewId())
        this._map.fire("updateviewslist");
      this._reconnecting = false;
      this._handleDelayedMessages(this._map._docLayer);
    }
    this._maybeOfferExternalLinks(command);
  }
  // Let the user agree to load this document's disabled external links.
  // Editors only; the choice lasts the session.
  _maybeOfferExternalLinks(command) {
    this._externalLinksDisabled = !!command.externallinksdisabled;
    if (!this._externalLinksDisabled)
      return;
    if (!this._externalLinksListening) {
      this._externalLinksListening = true;
      app.events.on("updatepermission", this._offerExternalLinks.bind(this));
    }
    this._offerExternalLinks();
  }
  _offerExternalLinks() {
    if (this._externalLinksShown || !this._externalLinksDisabled || this._map.isReadOnlyMode())
      return;
    this._externalLinksShown = true;
    this._map.uiManager.showSnackbar(
      _("This document has links to external content."),
      _("Allow"),
      () => {
        this.sendMessage("allowlinkupdate");
      },
      -1,
      false,
      true
      /* dismissable - dismiss keeps links blocked */
    );
  }
  _onJSDialog(textMsg, callback) {
    const msgData = JSON.parse(textMsg.substring("jsdialog:".length + 1));
    if (msgData.children && !app.util.isArray(msgData.children)) {
      window.app.console.warn("_onJSDialogMsg: The children's data should be created of array type");
      return;
    }
    JSDialog.MessageRouter.processMessage(msgData, callback);
  }
  _onHyperlinkClickedMsg(textMsg) {
    let link = null;
    let coords = null;
    const hyperlinkMsgStart = "hyperlinkclicked: ";
    const coordinatesMsgStart = " coordinates: ";
    if (textMsg.indexOf(coordinatesMsgStart) !== -1) {
      const coordpos = textMsg.indexOf(coordinatesMsgStart);
      link = textMsg.substring(hyperlinkMsgStart.length, coordpos);
      coords = textMsg.substring(coordpos + coordinatesMsgStart.length);
    } else
      link = textMsg.substring(hyperlinkMsgStart.length);
    this._map.fire("hyperlinkclicked", { url: link, coordinates: coords });
  }
  _delayMessage(textMsg) {
    const message = { msg: textMsg };
    this._delayedMessages.push(message);
  }
  _handleDelayedMessages(docLayer) {
    this._handlingDelayedMessages = true;
    while (this._delayedMessages.length) {
      const message = this._delayedMessages.shift();
      Util.ensureValue(message);
      try {
        docLayer._onMessage(message.msg);
      } catch (e) {
        window.app.console.error("Exception " + e + " emitting event " + message, e.stack);
      }
    }
    this._handlingDelayedMessages = false;
  }
  _onMessage(e) {
    let textMsg = e.textMsg;
    const imgBytes = e.imgBytes;
    if (window.L.Browser.cypressTest) {
      window.L.initial._stubMessage(textMsg);
    }
    this._logSocket("INCOMING", textMsg);
    const command = this.parseServerCmd(textMsg);
    if (textMsg.startsWith("coolserver ")) {
      if (this._onCoolServerMsg(textMsg)) {
        return;
      }
    } else if (textMsg.startsWith("lokitversion ")) {
      this._onLokitVersionMsg(textMsg);
    } else if (textMsg.startsWith("enabletraceeventlogging ")) {
      this.enableTraceEventLogging = true;
    } else if (textMsg.startsWith("osinfo ")) {
      this._onOsInfoMsg(textMsg);
    } else if (textMsg.startsWith("clipboardkey: ")) {
      this._onClipboardKeyMsg(textMsg);
    } else if (textMsg.startsWith("reconnecttoken: ")) {
      window.reconnectToken = textMsg.substring("reconnecttoken: ".length);
    } else if (textMsg.startsWith("executescriptresult: ")) {
      try {
        const result = JSON.parse(textMsg.substring("executescriptresult: ".length));
        this._map.fire("executescriptresult", result);
      } catch (e2) {
        app.console.error("Failed to parse executescriptresult: " + e2);
      }
      return;
    } else if (textMsg.startsWith("proxycall: ")) {
      try {
        const call = JSON.parse(textMsg.substring("proxycall: ".length));
        this._map.fire("proxycall", call);
      } catch (ex) {
        app.console.error("Failed to parse proxycall: " + ex);
      }
      return;
    } else if (textMsg.startsWith("consolemsg ")) {
      let newline = textMsg.indexOf("\n");
      if (newline === -1)
        newline = textMsg.length;
      this._map.fire("consolemsg", {
        level: textMsg.substring("consolemsg ".length, newline),
        message: textMsg.substring(newline + 1)
      });
      return;
    } else if (textMsg.startsWith("legacyunoapinotice:")) {
      this._map.fire("legacyunoapinotice");
      return;
    } else if (textMsg.startsWith("perm:")) {
      this._onPermMsg(textMsg);
      return;
    } else if (textMsg.startsWith("filemode:")) {
      this._onFileModeMsg(textMsg);
    } else if (textMsg.startsWith("haspasswordtomodify:")) {
      this._map._docHasPasswordToModify = true;
      this._map._modifyPasswordProvided = false;
      return;
    } else if (textMsg.startsWith("editwithpassword:")) {
      if (textMsg.substring("editwithpassword:".length).trim() === "success") {
        this._map._modifyPasswordProvided = true;
        this._map._proceedEditMode();
      }
      return;
    } else if (textMsg.startsWith("lockfailed:")) {
      this._map.onLockFailed(textMsg.substring("lockfailed:".length).trim());
      return;
    } else if (textMsg.startsWith("wopi: ")) {
      this._onWopiMsg(textMsg);
      return;
    } else if (textMsg.startsWith("loadstorage: ")) {
      this._onLoadStorageMsg(textMsg);
    } else if (textMsg.startsWith("lastmodtime: ")) {
      this._onLastModTimeMsg(textMsg);
      return;
    } else if (textMsg.startsWith("commandresult: ")) {
      this._onCommandResultMsg(textMsg);
      return;
    } else if (textMsg.startsWith("migrate:") && window.indirectSocket) {
      this._onMigrateMsg(textMsg);
      return;
    } else if (textMsg.startsWith("tokenexpired")) {
      this._map.fire("postMessage", {
        msgId: "App_TokenExpired",
        args: {}
      });
      return;
    } else if (textMsg.startsWith("close: ")) {
      this._onCloseMsg(textMsg);
      return;
    } else if (textMsg.startsWith("error:")) {
      if (this._onErrorMsg(textMsg, command))
        return;
    } else if (textMsg.startsWith("fontsmissing:")) {
      this._onFontsMissing(textMsg, command);
    } else if (textMsg.startsWith("info:") && command.errorCmd === "socket") {
      this._onInfoMsg(textMsg, command);
    } else if (textMsg.startsWith("pong ") && this._map._debug.pingOn) {
      this._map._debug.reportPong(command.rendercount ? command.rendercount : 0);
    } else if (textMsg.startsWith("serverloadtimings: ")) {
      this._onServerLoadTimingsMsg(textMsg.substring("serverloadtimings: ".length));
      return;
    } else if (textMsg.startsWith("saveas:") || textMsg.startsWith("renamefile:")) {
      this._renameOrSaveAsCallback(textMsg, command);
    } else if (textMsg.startsWith("exportas:")) {
      this._exportAsCallback(command);
    } else if (textMsg.startsWith("warn:")) {
      this._onWarnMsg(textMsg, command);
    } else if (window.ThisIsAMobileApp && textMsg.startsWith("mobile:")) {
      const mobileEvent = textMsg.substring("mobile: ".length);
      this._map.fire(mobileEvent);
    } else if (textMsg.startsWith("blockui:")) {
      this._onBlockUIMsg(textMsg);
      return;
    } else if (textMsg.startsWith("unblockui:")) {
      this._map.fire("unblockUI");
      return;
    } else if (textMsg.startsWith("featurelock: ")) {
      const lockInfo = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
      this._map._setLockProps(lockInfo);
      return;
    } else if (textMsg.startsWith("restrictedCommands: ")) {
      const restrictionInfo = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
      this._map._setRestrictions(restrictionInfo);
      return;
    } else if (textMsg.startsWith("blockedcommand: ")) {
      this._onBlockedCommandMsg(textMsg);
      return;
    } else if (textMsg.startsWith("updateroutetoken") && window.indirectSocket) {
      window.routeToken = textMsg.split(" ")[1];
      window.app.console.log("updated routeToken: " + window.routeToken);
    } else if (textMsg.startsWith("reload")) {
      window.location.reload();
    } else if (textMsg.startsWith("slidelayer:")) {
      this._onSlideLayerMsg(textMsg, e);
      return;
    } else if (textMsg.startsWith("zstdslidelayer:")) {
      this._onZstdSlideLayerMsg(textMsg, e);
      return;
    } else if (textMsg.startsWith("zstdvectorprimitives:") || textMsg.startsWith("zstdvectorprimitivesdelta:") || textMsg.startsWith("zstdvectorrenderingfont:")) {
      this._onZstdVectorPrimitivesMsg(e, textMsg.startsWith("zstdvectorprimitivesdelta:"));
      return;
    } else if (textMsg.startsWith("sliderenderingcomplete:")) {
      this._onSlideRenderingCompleteMsg(textMsg, e);
      return;
    } else if (textMsg.startsWith("slideimport:")) {
      this._onSlideImportMsg(textMsg);
      return;
    } else if (textMsg.startsWith("slidelinks:")) {
      this._map.fire("slidelinks", {
        message: JSON.parse(textMsg.substring("slidelinks:".length + 1))
      });
      return;
    } else if (textMsg.startsWith("slidelink:")) {
      this._map.fire("slidelink", {
        message: JSON.parse(textMsg.substring("slidelink:".length + 1))
      });
      return;
    } else if (textMsg.startsWith("remotedoccommandresult:")) {
      this._onRemoteDocCommandResult(textMsg, e);
      return;
    } else if (!_Socket.pixelFramePrefixes.some((prefix) => textMsg.startsWith(prefix))) {
      if (imgBytes !== void 0) {
        try {
          textMsg = String.fromCharCode.apply(null, imgBytes);
        } catch (error) {
          textMsg = this._utf8ToString(imgBytes);
        }
      }
      if (typeof e.data === "object") {
        textMsg = decodeURIComponent(window.escape(textMsg));
      }
    }
    if (textMsg.startsWith("status:")) {
      this._onStatusMsg(textMsg, JSON.parse(textMsg.replace("status:", "").replace("statusupdate:", "")));
      return;
    }
    if (textMsg.startsWith("progress:")) {
      this._onProgressMsg(textMsg);
      return;
    } else if (textMsg.startsWith("jsdialog:")) {
      this._onJSDialog(textMsg, e.callback);
    } else if (textMsg.startsWith("hyperlinkclicked:")) {
      this._onHyperlinkClickedMsg(textMsg);
    } else if (textMsg.startsWith("browsersetting:")) {
      window.prefs._initializeBrowserSetting(textMsg);
    } else if (textMsg.startsWith("remotelinks:")) {
      const links = JSON.parse(textMsg.substring("remotelinks:".length + 1));
      app.remoteLinks = links.documents || [];
      this._map.fire("remotelinks", {
        documents: app.remoteLinks
      });
    } else if (textMsg.startsWith("linktoken:")) {
      app.linkToken = textMsg.substring("linktoken:".length).trim();
      this._map.fire("linktoken", {
        token: app.linkToken
      });
    } else if (textMsg.startsWith("presetconfigid:")) {
      app.presetConfigId = textMsg.substring("presetconfigid:".length).trim();
    } else if (textMsg.startsWith("userpresetconfigid:")) {
      app.userPresetConfigId = textMsg.substring("userpresetconfigid:".length).trim();
    } else if (textMsg.startsWith("userpresetsapplied:")) {
      app.userPresetsApplied = textMsg.substring("userpresetsapplied:".length).trim() === "true";
      this._map.fire("documentsettingsscope");
    } else if (textMsg.startsWith("documentsettingslive:")) {
      app.documentSettingsLive = textMsg.substring("documentsettingslive:".length).trim() === "true";
      this._map.fire("documentsettingsscope");
    } else if (textMsg.startsWith("viewsetting:")) {
      const settingJSON = JSON.parse(textMsg.substring("viewsetting:".length + 1));
      app.serverConnectionService.onViewSetting(settingJSON);
      if (window.ThisIsAMobileApp && settingJSON.aiConfigured === void 0) {
        this.sendMessage("updateviewsettings " + JSON.stringify(settingJSON));
      }
    }
    if (textMsg.startsWith("downloadas:") || textMsg.startsWith("exportas:")) {
      const postMessageObj = {
        success: true,
        result: "exportas",
        errorMsg: ""
      };
      this._map.fire("postMessage", {
        msgId: "Action_Save_Resp",
        args: postMessageObj
      });
    }
    if (!this._map._docLayer || this._handlingDelayedMessages) {
      this._delayMessage(textMsg);
    } else {
      this._map._docLayer._onMessage(textMsg, e.image);
    }
  }
  // A reply from a remote document, wrapped as
  // "remotedoccommandresult: source=<enc>\n<inner frame>". Unwraps the
  // header, then fires a remotedoccommandresult map event carrying the
  // persistent link of the remote link and the inner frame as an ordinary
  // (textMsg, imgBytes, imgIndex) triple, so a consumer reads it the way it
  // reads any frame.
  _onRemoteDocCommandResult(textMsg, e) {
    const imgBytes = e.imgBytes;
    const headerEnd = textMsg.indexOf("\n");
    const header = headerEnd >= 0 ? textMsg.substring(0, headerEnd) : textMsg;
    let source = "";
    for (const token of header.split(" ")) {
      if (token.startsWith("source=")) {
        source = decodeURIComponent(token.substring("source=".length));
        break;
      }
    }
    let innerText;
    let innerImgIndex = 0;
    if (imgBytes !== void 0) {
      const start = e.imgIndex ?? 0;
      const newlineAt = imgBytes.indexOf(10, start);
      const spaceAt = imgBytes.indexOf(32, start);
      let tokenEnd = imgBytes.length;
      if (spaceAt >= 0)
        tokenEnd = spaceAt;
      if (newlineAt >= 0 && newlineAt < tokenEnd)
        tokenEnd = newlineAt;
      const innerFirstToken = this._utf8ToString(imgBytes.subarray(start, tokenEnd));
      if (_Socket.pixelFramePrefixes.includes(innerFirstToken)) {
        const innerHeaderEnd = newlineAt >= 0 ? newlineAt : imgBytes.length;
        innerText = this._utf8ToString(imgBytes.subarray(start, innerHeaderEnd));
        innerImgIndex = innerHeaderEnd < imgBytes.length ? innerHeaderEnd + 1 : imgBytes.length;
      } else {
        innerText = this._utf8ToString(imgBytes.subarray(start));
        innerImgIndex = imgBytes.length;
      }
    } else {
      innerText = headerEnd >= 0 ? textMsg.substring(headerEnd + 1) : "";
    }
    this._map.fire("remotedoccommandresult", {
      source,
      textMsg: innerText,
      imgBytes,
      imgIndex: innerImgIndex
    });
  }
  _extractTextImg(e) {
    if ((window.ThisIsTheiOSApp || window.ThisIsTheWindowsApp || window.ThisIsTheMacOSApp || window.ThisIsTheEmscriptenApp || window.ThisIsTheQtApp) && typeof e.data === "string") {
      const data = e.data;
      const isImageFrame = _Socket.appImageFramePrefixes.some((prefix) => data.startsWith(prefix));
      if (isImageFrame) {
        let index;
        index = e.data.indexOf("\n");
        if (index < 0)
          index = e.data.length;
        e.imgBytes = new Uint8Array(e.data.length);
        for (let i = 0; i < e.data.length; i++) {
          e.imgBytes[i] = e.data.charCodeAt(i);
        }
        e.imgIndex = index + 1;
        e.textMsg = e.data.substring(0, index);
      } else {
        e.textMsg = e.data;
      }
    } else if (typeof e.data === "string") {
      e.textMsg = e.data;
    } else if (typeof e.data === "object") {
      this._extractCopyObject(e);
    }
    e.isComplete = function() {
      if (this.image)
        return !!this.imageIsComplete;
      return true;
    };
    const isTile = e.textMsg.startsWith("tile:");
    const isDelta = e.textMsg.startsWith("delta:");
    if (!isTile && !isDelta && !e.textMsg.startsWith("slidelayer:") && !e.textMsg.startsWith("windowpaint:"))
      return;
    if (e.textMsg.indexOf(" nopng") !== -1)
      return;
    if (e.imgBytes && e.imgIndex !== void 0 && (isTile || isDelta) && e.imgBytes[e.imgIndex] != 80) {
      const imgEl = new Image();
      imgEl.rawData = e.imgBytes.subarray(e.imgIndex);
      imgEl.isKeyframe = isTile;
      e.image = imgEl;
      e.imageIsComplete = true;
      return;
    }
    const img = this._extractImage(e);
    if (isTile) {
      const imgEl = new Image();
      imgEl.src = img;
      e.image = imgEl;
      e.imageIsComplete = true;
      return;
    }
    const imageElement = new Image();
    e.image = imageElement;
    imageElement.onload = function() {
      e.imageIsComplete = true;
      this._queueSlurpEventEmission(1);
      if (imageElement.completeTraceEvent)
        imageElement.completeTraceEvent.finish();
    }.bind(this);
    imageElement.addEventListener("error", function(err) {
      window.app.console.log("Failed to load image " + img + " fun " + err);
      e.imageIsComplete = true;
      this._queueSlurpEventEmission(1);
      if (imageElement.completeTraceEvent)
        imageElement.completeTraceEvent.abort();
    }.bind(this));
    const traceEvt = this.createAsyncTraceEvent("loadTile");
    imageElement.completeTraceEvent = traceEvt ? traceEvt : void 0;
    imageElement.src = img;
  }
  // make profiling easier
  _extractCopyObject(e) {
    let index;
    e.imgBytes = new Uint8Array(e.data);
    index = e.imgBytes.indexOf(10);
    if (index < 0)
      index = e.imgBytes.length;
    e.textMsg = String.fromCharCode.apply(null, e.imgBytes.subarray(0, index));
    e.imgIndex = index + 1;
  }
  // convert to string of bytes without blowing the stack if data is large.
  _strFromUint8(prefix, data) {
    let i;
    const chunk = 4096;
    let strBytes = prefix;
    for (i = 0; i < data.length; i += chunk)
      strBytes += String.fromCharCode.apply(null, data.slice(i, i + chunk));
    strBytes += String.fromCharCode.apply(null, data.slice(i));
    return strBytes;
  }
  // A data URL for PNG bytes as tiles carry them: the leading 0x89 of the
  // PNG signature is put back when it was stripped (TileCache::appendBlob
  // removes it). A content security policy forbids blob URLs for images, so
  // the bytes travel inline as base64.
  pngDataUrl(data) {
    let prefix = "";
    if (data[0] != 137)
      prefix = String.fromCharCode(137);
    return "data:image/png;base64," + window.btoa(this._strFromUint8(prefix, data));
  }
  _extractImage(e) {
    if (!e.imgBytes) {
      console.assert(false, "Called _extractImage with and event that does not have imgBytes member!");
      return "";
    }
    if (e.imgIndex === void 0) {
      console.assert(false, "_extractImage: event does not have imgIndex!");
      return "";
    }
    const data = e.imgBytes.subarray(e.imgIndex);
    const img = this.pngDataUrl(data);
    if (window.L.Browser.cypressTest && window.prefs.getBoolean("image_validation_test")) {
      if (!window.imgDatas)
        window.imgDatas = [];
      window.imgDatas.push(img);
    }
    return img;
  }
  _buildUnauthorizedMessage(command) {
    let unauthorizedMsg = window.errorMessages.unauthorized;
    if (command.errorCode) {
      const authError = window.atob(command.errorCode);
      const verifyError = window.errorMessages.verificationerror.replace("{errormessage}", authError);
      unauthorizedMsg += " " + verifyError;
    }
    return unauthorizedMsg;
  }
  manualReconnect(timeout) {
    if (this._map._docLayer) {
      this._map._docLayer.removeAllViews();
    }
    app.idleHandler._active = false;
    this.close();
    clearTimeout(this.timer);
    setTimeout(function() {
      try {
        app.idleHandler._activate();
      } catch (error) {
        window.app.console.warn("Cannot activate map");
      }
    }, timeout);
  }
  _showDocumentConflictPopUp(errorDetail) {
    const buttonList = [];
    const callbackList = [];
    buttonList.push({ id: "cancel-conflict-popup", text: _("Cancel") });
    callbackList.push({ id: "cancel-conflict-popup", func_: null });
    buttonList.push({ id: "discard-button", text: _("Discard") });
    buttonList.push({ id: "overwrite-button", text: _("Overwrite") });
    callbackList.push({
      id: "discard-button",
      func_: function() {
        this.sendMessage("closedocument");
      }.bind(this)
    });
    callbackList.push({
      id: "overwrite-button",
      func_: function() {
        this.sendMessage("savetostorage force=1");
      }.bind(this)
    });
    if (!this._map["wopi"].UserCanNotWriteRelative) {
      buttonList.push({ id: "save-to-new-file", text: _("Save to new file") });
      callbackList.push({
        id: "save-to-new-file",
        func_: function() {
          let filename = this._map["wopi"].BaseFileName;
          if (filename) {
            filename = app.LOUtil.generateNewFileName(filename, "_new");
            this._map.saveAs(filename);
          }
        }.bind(this)
      });
    }
    const title = _("Document has been changed");
    const message = _("Document has been changed in storage. What would you like to do with your unsaved changes?");
    this._map.uiManager.showModalWithCustomButtons("document-conflict-popup", title, message, false, buttonList, callbackList, errorDetail);
  }
  _askForDocumentPassword(passwordType, msg) {
    const giveUp = () => {
      if (passwordType === "to-modify") {
        this._map._docPassword = "";
        this._map.loadDocument();
      } else if (window.ThisIsAMobileApp && !window.ThisIsTheEmscriptenApp) {
        window.postMobileMessage("BYE");
      } else {
        this._map.fire("postMessage", { msgId: "UI_Cancel_Password" });
        this._map.hideBusy();
      }
    };
    this._map.uiManager.showInputModal("password-popup", "", msg, "", _("OK"), (data) => {
      this._map._docPassword = data;
      if (window.ThisIsAMobileApp) {
        window.postMobileMessage("loadwithpassword password=" + data);
      }
      this._map.loadDocument();
    }, true, giveUp);
  }
  _renameOrSaveAsCallback(textMsg, command) {
    var _a;
    this._map.hideBusy();
    if (command !== void 0 && command.url !== void 0 && command.url !== "") {
      const url = command.url;
      const docUrl = url.split("?")[0];
      this._map.options.doc = docUrl;
      this._map.options.previousWopiSrc = this._map.options.wopiSrc;
      this._map.options.wopiSrc = docUrl;
      window.wopiSrc = this._map.options.wopiSrc;
      if (textMsg.startsWith("renamefile:")) {
        this._map.uiManager.documentNameInput.showLoadingAnimation();
        if (command.filename)
          this._map["wopi"].onRenameFile(decodeURIComponent(command.filename));
        this._map.fire("postMessage", {
          msgId: "File_Rename",
          args: {
            NewName: command.filename
          }
        });
      } else if (textMsg.startsWith("saveas:")) {
        const accessToken = this._getParameterByName(url, "access_token");
        let accessTokenTtl = this._getParameterByName(url, "access_token_ttl");
        const noAuthHeader = this._getParameterByName(url, "no_auth_header");
        if (accessToken !== void 0) {
          if (accessTokenTtl === "") {
            accessTokenTtl = "0";
          }
          this._map.options.docParams = {
            access_token: accessToken,
            access_token_ttl: accessTokenTtl
          };
          if (noAuthHeader == "1" || noAuthHeader == "true") {
            this._map.options.docParams.no_auth_header = noAuthHeader;
          }
        } else {
          this._map.options.docParams = {};
        }
        app.setPermission("edit");
        this.close();
        if (window.ThisIsTheQtApp || window.ThisIsTheWindowsApp) {
          window.postMobileMessage("loaddocument url=" + this._map.options.doc);
          (_a = this.socket) == null ? void 0 : _a.onopen(new Event("open"));
        }
        this._map.loadDocument();
        this._map.sendInitUNOCommands();
        Util.ensureValue(command.filename);
        this._map.fire("postMessage", {
          msgId: "Action_Save_Resp",
          args: {
            success: true,
            fileName: decodeURIComponent(command.filename)
          }
        });
      }
    }
  }
  /* _onMessage() subtasks */
  // 'coolserver ' message.
  // returns boolean whether or not to return immediately from _onMessage().
  _onCoolServerMsg(textMsg) {
    let oldVersion = "";
    let sameFile = true;
    if (this.WSDServer && this.WSDServer.Id) {
      oldVersion = this.WSDServer.Version;
      window.app.console.assert(this._map.options.wopiSrc === window.wopiSrc, "wopiSrc mismatch!: " + this._map.options.wopiSrc + " != " + window.wopiSrc);
      if (this._map.options.previousWopiSrc && this._map.options.wopiSrc) {
        if (this._map.options.previousWopiSrc !== this._map.options.wopiSrc)
          sameFile = false;
      }
    }
    this.WSDServer = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
    if (oldVersion && sameFile) {
      if (this.WSDServer.Version !== oldVersion) {
        let reloadMessage = _("Server is now reachable. We have to refresh the page now.");
        if (window.mode.isSmallScreenDevice())
          reloadMessage = _("Server is now reachable...");
        const reloadFunc = function() {
          window.location.reload();
        };
        if (!this._map["wopi"].DisableInactiveMessages)
          this._map.uiManager.showSnackbar(reloadMessage, _("RELOAD"), reloadFunc);
        else
          this._map.fire("postMessage", {
            msgId: "Reloading",
            args: { Reason: "Reconnected" }
          });
        setTimeout(reloadFunc, 5e3);
      }
    }
    if (window.indirectSocket) {
      if (window.expectedServerId && window.expectedServerId != this.WSDServer.Id) {
        if (this.IndirectSocketReconnectCount++ >= 3) {
          let msg = window.errorMessages.clusterconfiguration.replace("{productname}", typeof brandProductName !== "undefined" ? brandProductName : "Collabora Online Development Edition (unbranded)");
          msg = msg.replace("{0}", window.expectedServerId);
          msg = msg.replace("{1}", window.routeToken);
          msg = msg.replace("{2}", this.WSDServer.Id);
          this._map.uiManager.showInfoModal("wrong-server-modal", _("Cluster configuration warning"), msg, "", _("OK"), null, false);
          this.IndirectSocketReconnectCount = 0;
        } else {
          this._map.showBusy(_("Wrong server, reconnecting..."), false);
          this.sendMessage("routetokensanitycheck");
          this.manualReconnect(3e3);
          return true;
        }
      }
    }
    Object.assign(window.app.serverInfo, {
      coolwsdVersion: this.WSDServer.Version || "",
      coolwsdHash: this.WSDServer.Hash || "",
      serverId: this.WSDServer.Id || "",
      wsdOptions: this.WSDServer.Options || ""
    });
    if (this.WSDServer.Protocol !== this.ProtocolVersionNumber) {
      this._map.fire("error", {
        msg: window.mode.isCODesktop() ? _("Unsupported version.") : _("Unsupported server version.")
      });
    }
    return false;
  }
  // 'lokitversion ' message.
  _onLokitVersionMsg(textMsg) {
    const lokitVersionObj = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
    this.TunnelledDialogImageCacheSize = lokitVersionObj.tunnelled_dialog_image_cache_size;
  }
  // 'osinfo ' message.
  _onOsInfoMsg(textMsg) {
    const osInfo = textMsg.replace("osinfo ", "");
    window.app.serverInfo.osInfo = osInfo;
  }
  // 'clipboardkey:' message.
  _onClipboardKeyMsg(textMsg) {
    const key = textMsg.substring("clipboardkey: ".length);
    if (this._map._clip)
      this._map._clip.setKey(key);
  }
  // 'perm:' message.
  _onPermMsg(textMsg) {
    const perm = textMsg.substring("perm:".length).trim();
    if (!app.isReadOnly())
      app.setPermission(perm);
    this.applyFilePermission();
    app.file.disableSidebar = app.isReadOnly();
  }
  // Give a loaded view the file permission. A loading view gets it with its status reply.
  applyFilePermission() {
    if (this._map._docLayer && this._map._docLoaded)
      this._map.setPermission(app.file.permission);
  }
  // 'filemode:' message.
  _onFileModeMsg(textMsg) {
    const json = JSON.parse(textMsg.substring("filemode:".length).trim());
    if (!app.isReadOnly() && json.readOnly) {
      app.setPermission("readonly");
    }
    this.applyFilePermission();
    if (json.viewModeExtensions) {
      app.file.viewModeExtensions = json.viewModeExtensions;
    }
    app.setCommentEditingPermission(json.editComment);
    app.setRedlineManagementAllowed(json.manageRedlines);
    if (json.readOnlyFile && !window.coolParams.get("welcome") && window.coolParams.get("permission") !== "readonly") {
      this._map.once("docloaded", (e) => {
        if (!e.status)
          return;
        this._map.uiManager.showSnackbar(_("This file cannot be written, so the document opened read-only. Use Save As to keep your changes in a new file."), null, null, -1, false, true);
      });
    }
  }
  // 'wopi:' message.
  _onWopiMsg(textMsg) {
    const wopiInfo = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
    this._map.fire("wopiprops", wopiInfo);
  }
  // 'loadstorage: ' message.
  _onLoadStorageMsg(textMsg) {
    if (textMsg.substring(textMsg.indexOf(":") + 2) === "failed") {
      window.app.console.debug("Loading document from a storage failed");
      this._map.fire("postMessage", {
        msgId: "App_LoadingStatus",
        args: {
          Status: "Failed"
        }
      });
    }
  }
  // 'lastmodtime: ' message.
  _onLastModTimeMsg(textMsg) {
    const time = textMsg.substring(textMsg.indexOf(" ") + 1);
    this._map.updateModificationIndicator(time);
    this._map.fire("postMessage", {
      msgId: "Doc_LastModifiedTime",
      args: { LastModifiedTime: time }
    });
  }
  _onServerLoadTimingsMsg(payload) {
    const parsed = {};
    for (const tok of payload.split(/\s+/)) {
      if (!tok)
        continue;
      const eq = tok.indexOf("=");
      if (eq < 0)
        continue;
      const k = tok.substring(0, eq);
      const v = Number(tok.substring(eq + 1));
      if (!isFinite(v))
        continue;
      parsed[k] = v;
    }
    this._map._serverLoadTimings = parsed;
    if (this._map._debug && this._map._debug.dumpServerLoadTimings) {
      this._map._debug.dumpServerLoadTimings();
    }
  }
  // 'commandresult: ' message.
  _onCommandResultMsg(textMsg) {
    const commandresult = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
    if (commandresult["command"] === "savetostorage" || commandresult["command"] === "save") {
      const postMessageObj = {
        success: commandresult["success"],
        result: commandresult["result"],
        errorMsg: commandresult["errorMsg"]
      };
      this._map.fire("postMessage", {
        msgId: "Action_Save_Resp",
        args: postMessageObj
      });
    } else if (commandresult["command"] === "load") {
      const postMessageObj = {
        success: commandresult["success"],
        result: commandresult["result"],
        errorMsg: commandresult["errorMsg"]
      };
      this._map.fire("postMessage", {
        msgId: "Action_Load_Resp",
        args: postMessageObj
      });
    }
  }
  beginMigration() {
    this.endMigration();
    window.migrating = true;
    this._migrationTimer = setTimeout(() => {
      window.app.console.warn("Migration did not complete, asking the controller again");
      this.endMigration();
      this._map.setPermission(app.file.permission);
      this.manualReconnect(2e3);
    }, _Socket.MigrationTimeoutMs);
  }
  endMigration() {
    if (this._migrationTimer !== void 0) {
      clearTimeout(this._migrationTimer);
      this._migrationTimer = void 0;
    }
    window.migrating = false;
  }
  // 'migrate: ' message.
  _onMigrateMsg(textMsg) {
    let migrate;
    try {
      migrate = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
    } catch {
      window.app.console.error("Unparseable migrate message: " + textMsg);
      return;
    }
    const afterSave = migrate.afterSave;
    app.idleHandler._serverRecycling = false;
    if (!afterSave) {
      this.beginMigration();
      this._map.uiManager.closeAll();
      if (this._map.isEditMode()) {
        this._map.setPermission("view");
        this._map.uiManager.showSnackbar(_("Document is getting migrated"), null, null, 3e3);
      }
      if (migrate.saved) {
        window.routeToken = migrate.routeToken;
        window.expectedServerId = migrate.serverId;
        this.manualReconnect(2e3);
      }
      return;
    }
    if (migrate.saved) {
      window.routeToken = migrate.routeToken;
      window.expectedServerId = migrate.serverId;
      this.manualReconnect(2e3);
    } else {
      this._map.setPermission(app.file.permission);
      this.endMigration();
    }
  }
  // 'close: ' message.
  _onCloseMsg(textMsg) {
    textMsg = textMsg.substring("close: ".length);
    const postMsgData = {};
    let showMsgAndReload = false;
    if (textMsg === "ownertermination") {
      postMsgData["Reason"] = "OwnerTermination";
    } else if (textMsg === "idle" || textMsg === "oom") {
      app.idleHandler._documentIdle = true;
      this._map._docLayer._documentInfo = void 0;
      postMsgData["Reason"] = "DocumentIdle";
      if (textMsg === "oom")
        postMsgData["Reason"] = "OOM";
    } else if (textMsg === "shuttingdown") {
      postMsgData["Reason"] = "ShuttingDown";
      app.idleHandler._active = false;
      app.idleHandler._serverRecycling = true;
    } else if (textMsg === "docdisconnected") {
      postMsgData["Reason"] = "DocumentDisconnected";
    } else if (textMsg === "recycling") {
      app.idleHandler._active = false;
      app.idleHandler._serverRecycling = true;
      const min = 5e3;
      const max = 1e4;
      const timeoutMs = Math.floor(Math.random() * (max - min) + min);
      clearTimeout(this.timer);
      this.timer = setInterval(() => {
        if (this.connected() || this._map._fatal) {
          clearTimeout(this.timer);
          return;
        }
        try {
          this._map.loadDocument(this.socket);
        } catch (error) {
          window.app.console.warn("Cannot load document.");
        }
      }, timeoutMs);
    } else if (textMsg.startsWith("documentconflict")) {
      showMsgAndReload = true;
    } else if (textMsg.startsWith("versionrestore:")) {
      textMsg = textMsg.substring("versionrestore:".length).trim();
      if (textMsg === "prerestore_ack") {
        this._map.fire("postMessage", {
          msgId: "App_VersionRestore",
          args: { Status: "Pre_Restore_Ack" }
        });
        showMsgAndReload = true;
      }
    } else if (textMsg.startsWith("reloadafterrename")) {
      showMsgAndReload = true;
    }
    if (showMsgAndReload) {
      if (this._map._docLayer) {
        this._map._docLayer.removeAllViews();
      }
      this.close();
      app.idleHandler._active = false;
      clearTimeout(this.timer);
      this.timer = setInterval(() => {
        try {
          app.idleHandler._activate();
          this._map.uiManager.documentNameInput.hideLoadingAnimation();
        } catch (error) {
          window.app.console.warn("Cannot activate map");
        }
      }, 3e3);
    }
    this._map.uiManager.closeAll();
    if (textMsg === "idle" || textMsg === "oom") {
      app.idleHandler._dim();
      RenderManager.discardAllCache();
    }
    if (postMsgData["Reason"]) {
      this._map.fire("postMessage", {
        msgId: "Session_Closed",
        args: postMsgData
      });
    }
    if (textMsg === "ownertermination") {
      this._map.remove();
    }
  }
  // 'error: ' message.
  // returns true if the caller need to exit immediately.
  _onErrorMsg(textMsg, command) {
    var _a;
    const errorMessages = window.errorMessages;
    let msg = "";
    let passwordType = "";
    if (textMsg.startsWith("error:") && (command.errorCmd === "storage" || command.errorCmd === "saveas") || command.errorCmd === "downloadas" || command.errorCmd === "exportas") {
      if (command.errorCmd !== "storage") {
        this._map.fire("postMessage", {
          msgId: "Action_Save_Resp",
          args: {
            success: false,
            result: command.errorKind
          }
        });
      }
      this._map.hideBusy();
      if ((window.ThisIsTheQtApp || window.ThisIsTheWindowsApp) && command.errorKind === "savefailed" && command.errorCmd === "saveas") {
        this._map._showSaveFailedPrompt(command.errorDetail, command.filename ? decodeURIComponent(command.filename) : void 0);
        return true;
      }
      if ((window.ThisIsTheQtApp || window.ThisIsTheWindowsApp) && this._map._saveFailedPrompt && (command.errorCmd === "saveas" || command.errorCmd === "exportas"))
        return true;
      let storageError = void 0;
      let storageErrorDetail = command.errorDetail;
      if (command.errorKind === "savediskfull") {
        storageError = errorMessages.storage.savediskfull;
      } else if (command.errorKind === "savetoolarge") {
        storageError = errorMessages.storage.savetoolarge;
      } else if (command.errorKind === "savefailed") {
        storageError = errorMessages.storage.savefailed;
      } else if (command.errorKind === "renamefailed") {
        storageError = errorMessages.storage.renamefailed;
      } else if (command.errorKind === "saveunauthorized") {
        storageError = errorMessages.storage.saveunauthorized;
      } else if (command.errorKind === "saveprecondition") {
        storageError = storageErrorDetail || errorMessages.storage.saveprecondition;
        storageErrorDetail = void 0;
      } else if (command.errorKind === "saveasfailed") {
        storageError = errorMessages.storage.saveasfailed;
      } else if (command.errorKind === "loadfailed") {
        storageError = errorMessages.storage.loadfailed;
        this.close();
      } else if (command.errorKind === "documentconflict") {
        console.error("Document conflict: storage copy changed underneath unsaved edits.", "\nTechnical details: " + command.errorDetail);
        if (this._map.isReadOnlyMode())
          return true;
        else
          this._showDocumentConflictPopUp(command.errorDetail);
        return true;
      }
      if (storageError && storageError != "") {
        const tmpLink = document.createElement("a");
        tmpLink.href = this._map.options.doc;
        storageError = storageError.replace("%storageserver", tmpLink.host);
        this._map.fire("warn", {
          msg: storageError,
          errorDetail: storageErrorDetail
        });
        const postMessageObj = {
          success: false,
          cmd: command.errorCmd,
          result: command.errorKind,
          errorMsg: storageError
        };
        this._map.fire("postMessage", {
          msgId: "Action_Save_Resp",
          args: postMessageObj
        });
        return true;
      }
    } else if (textMsg.startsWith("error:") && command.errorCmd === "save") {
      (_a = this._map.saveState) == null ? void 0 : _a.showSaveFailedStatus();
      if (window.ThisIsTheQtApp || window.ThisIsTheWindowsApp) {
        if (command.errorKind === "savefailed")
          this._map._nativeSaveFailed(false);
        return true;
      }
    } else if (textMsg.startsWith("error:") && command.errorCmd === "renamefile") {
      this._map.hideBusy();
      this._map.fire("warn", {
        msg: command.errorKind === "invalid" ? _("Please enter a valid document name.") : errorMessages.storage.renamefailed
      });
      return true;
    } else if (textMsg.startsWith("error:") && command.errorCmd === "internal") {
      this._map.hideBusy();
      this._map._fatal = true;
      clearTimeout(this.timer);
      this.timer = void 0;
      if (command.errorKind === "diskfull") {
        this._map.fire("error", {
          msg: errorMessages.diskfull,
          errorDetail: command.errorDetail
        });
      } else if (command.errorKind === "accessrevoked") {
        this._map.fire("error", { msg: errorMessages.accessrevoked });
        this._map.fire("postMessage", {
          msgId: "Session_Closed",
          args: { Reason: "AccessRevoked" }
        });
      } else if (command.errorKind === "accessdowngraded") {
        this._map.fire("error", { msg: errorMessages.accessdowngraded });
        this._map.fire("postMessage", {
          msgId: "Session_Closed",
          args: { Reason: "AccessDowngraded" }
        });
      } else if (command.errorKind === "accessunverified") {
        window.location.reload();
      } else if (command.errorKind === "unauthorized") {
        const postMessageObj = {
          errorType: "websocketunauthorized",
          success: false,
          errorMsg: this._buildUnauthorizedMessage(command),
          result: ""
        };
        this._map.fire("postMessage", {
          msgId: "Action_Load_Resp",
          args: postMessageObj
        });
      }
      if (this._map._docLayer) {
        this._map._docLayer.removeAllViews();
        this._map._docLayer._resetClientVisArea();
      }
      this.close();
      return true;
    } else if (textMsg.startsWith("error:") && command.errorCmd === "load") {
      this._map.hideBusy();
      this.close();
      const errorKind = command.errorKind ? command.errorKind : "";
      let passwordNeeded = false;
      if (errorKind.startsWith("passwordrequired")) {
        passwordNeeded = true;
        msg = "";
        passwordType = errorKind.split(":")[1];
        if (passwordType === "to-view") {
          msg += _("Document requires password to view.");
        } else if (passwordType === "to-modify") {
          msg += _("Document requires password to modify.");
          msg += " ";
          msg += _("Hit Cancel to open in view-only mode.");
        }
      } else if (errorKind.startsWith("wrongpassword")) {
        passwordNeeded = true;
        msg = _("Wrong password provided. Please try again.");
      } else if (errorKind.startsWith("faileddocloading")) {
        this._map._fatal = true;
        this._map.fire("error", {
          msg: errorMessages.faileddocloading,
          errorDetail: command.errorDetail
        });
      } else if (errorKind.startsWith("docloadtimeout")) {
        this._map._fatal = true;
        this._map.fire("error", { msg: errorMessages.docloadtimeout });
      } else if (errorKind.startsWith("docunloading")) {
        app.idleHandler._active = false;
        app.idleHandler._serverRecycling = true;
        const waitsForConflict = errorKind === "docunloading:collabconflict";
        const waitDialogId = this._map.uiManager.generateModalId("collab-conflict-wait");
        clearTimeout(this.timer);
        if (waitsForConflict) {
          this.ReconnectCount = 1;
        } else if (this.ReconnectCount++ >= 10) {
          this._map.fire("error", { msg: errorMessages.docunloadinggiveup });
          return true;
        }
        this.timer = setInterval(() => {
          if (this.connected() || this._map._fatal) {
            clearTimeout(this.timer);
            if (document.getElementById(waitDialogId)) {
              this._map.uiManager.closeModal(waitDialogId);
            }
            return;
          }
          try {
            this._map.loadDocument();
          } catch (error) {
            window.app.console.warn("Cannot load document.");
          }
        }, waitsForConflict ? 3e3 : 500 * this.ReconnectCount * this.ReconnectCount);
        if (waitsForConflict) {
          if (!document.getElementById(waitDialogId)) {
            this._map.uiManager.showInfoModal("collab-conflict-wait", "", _("Your changes are saved. %USERS has unsaved changes in this document and is deciding which version to keep.").replace("%USERS", decodeURIComponent(command.username || "")), null, _("Close"), () => {
              clearTimeout(this.timer);
              this._map.uiManager.closeModal(waitDialogId);
              app.dispatcher.dispatch("closeapp");
              return true;
            });
          }
        } else if (this.ReconnectCount > 1) {
          this._map.showBusy(errorMessages.docunloadingretry, false);
        }
      } else {
        this._map._fatal = true;
        this._map.fire("error", {
          msg: errorMessages.faileddocloading,
          errorDetail: command.errorDetail
        });
      }
      if (passwordNeeded) {
        this._askForDocumentPassword(passwordType, msg);
        return true;
      }
    } else if (textMsg.startsWith("error:") && command.errorCmd === "dialogevent" && command.errorKind === "cantchangepass") {
      const msg2 = _("Only the document owner can change the password.");
      this._map.uiManager.showInfoModal("cool_alert", "", msg2, "", _("OK"));
      return true;
    } else if (textMsg.startsWith("error:") && command.errorCmd === "editwithpassword") {
      this._map.hideBusy();
      this._map._modifyPasswordProvided = false;
      if (command.errorKind === "wrongpassword") {
        this._map._askForPasswordToModify(true);
      } else {
        const msg2 = command.errorKind === "notallowed" ? _("You do not have permission to edit this document.") : _("The document could not be made editable.");
        this._map.uiManager.showInfoModal("cool_alert", "", msg2, "", _("OK"));
      }
      return true;
    } else if (textMsg.startsWith("error:") && command.errorCmd === "slideimport") {
      this._map.fire("slideimporterror", {
        kind: command.errorKind ? command.errorKind : ""
      });
      return true;
    } else if (textMsg.startsWith("error:") && command.errorCmd === "slidelink") {
      const named = textMsg.match(/\bsource=(\S+)/);
      const unit = textMsg.match(/\bunit=(\S+)/);
      const id = textMsg.match(/\bid=(\S+)/);
      this._map.fire("slidelinkerror", {
        kind: command.errorKind ? command.errorKind : "",
        source: named ? decodeURIComponent(named[1]) : "",
        unit: unit ? unit[1] : "",
        id: id ? decodeURIComponent(id[1]) : ""
      });
      return true;
    } else if (textMsg.startsWith("error:") && !this._map._docLayer) {
      textMsg = textMsg.substring(6);
      if (command.errorKind === "hardlimitreached") {
        textMsg = errorMessages.limitreachedprod;
        if (command.params) {
          textMsg = textMsg.replace("{0}", command.params[0]);
          textMsg = textMsg.replace("{1}", command.params[1]);
        }
      } else if (command.errorKind === "serviceunavailable") {
        textMsg = errorMessages.serviceunavailable;
      }
      this._map._fatal = true;
      app.idleHandler._active = false;
      this._map.fire("error", {
        msg: textMsg,
        errorDetail: command.errorDetail
      });
    }
    return false;
  }
  // 'fontsmissing: ' message.
  _onFontsMissing(textMsg, command) {
    const fontsMissingObj = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
    let msg = " ";
    for (let i = 0; i < fontsMissingObj.fontsmissing.length; ++i) {
      if (i > 0)
        msg += ", ";
      msg += fontsMissingObj.fontsmissing[i];
    }
    if (this._map.welcome && !this._map.welcome.isGuest() && this._map.welcome.shouldWelcome() && window.autoShowWelcome) {
      setTimeout(function() {
        this._map.uiManager.showInfoModal("fontsmissing", _("Missing Fonts"), msg, null, _("Close"));
      }.bind(this), 6e4);
    } else {
      this._map.uiManager.showInfoModal("fontsmissing", _("Missing Fonts"), msg, null, _("Close"));
    }
  }
  // 'info: ' message.
  _onInfoMsg(textMsg, command) {
    if (command.errorKind === "limitreached" && !this.WasShownLimitDialog) {
      this.WasShownLimitDialog = true;
      textMsg = window.errorMessages.limitreached;
      if (command.params === void 0) {
        console.error("_onInfoMsg(): command.params is undefined!");
      } else {
        textMsg = textMsg.replace("{docs}", command.params[0]);
        textMsg = textMsg.replace("{connections}", command.params[1]);
      }
      textMsg = textMsg.replace("{productname}", typeof brandProductName !== "undefined" ? brandProductName : "Collabora Online Development Edition (unbranded)");
      this._map.fire("infobar", {
        msg: textMsg,
        action: app.util.getProduct(),
        actionLabel: window.errorMessages.infoandsupport
      });
    }
  }
  // 'warn: ' message.
  _onWarnMsg(textMsg, command) {
    const len = "warn: ".length;
    textMsg = textMsg.substring(len);
    if (textMsg.startsWith("saveas:")) {
      const userName = command.username ? command.username : _("Someone");
      const message = _("{username} saved this document as {filename}. Do you want to join?").replace("{username}", userName).replace("{filename}", command.filename);
      this._map.uiManager.showConfirmModal("save-as-warning", "", message, _("OK"), function() {
        this._renameOrSaveAsCallback(textMsg, command);
      }.bind(this));
    }
  }
  // 'blockui: ' message.
  _onBlockUIMsg(textMsg) {
    textMsg = textMsg.substring("blockui:".length).trim();
    let msg = null;
    if (textMsg === "rename") {
      msg = _("The document is being renamed and will reload shortly");
    } else if (textMsg === "switchingtooffline") {
      msg = _("The document is switching to Offline mode and will reload shortly");
    }
    this._map.fire("blockUI", { message: msg });
  }
  // 'blockedcommand: ' message.
  _onBlockedCommandMsg(textMsg) {
    const blockedInfo = app.socket.parseServerCmd(textMsg.substring(16));
    if (blockedInfo.errorKind === "restricted")
      window.app.console.log('Restricted command "' + blockedInfo.errorCmd + '" was blocked');
    else if (blockedInfo.errorKind === "locked")
      this._map.openUnlockPopup(blockedInfo.errorCmd);
  }
  // 'slidelayer: ' message.
  _onSlideLayerMsg(textMsg, e) {
    const content = JSON.parse(textMsg.substring("slidelayer:".length + 1));
    this._map.fire("slidelayer", {
      message: content,
      image: e.image
    });
  }
  // 'zstdslidelayer: ' message.
  _onZstdSlideLayerMsg(textMsg, e) {
    const content = JSON.parse(textMsg.substring("zstdslidelayer:".length + 1));
    const event = e;
    if (event.imgBytes && event.imgIndex !== void 0)
      this._map.fire("slidelayer", {
        message: content,
        imgBytes: event.imgBytes.subarray(event.imgIndex)
      });
    else
      window.app.console.warn("zstdslidelayer with no image");
  }
  // 'slideimport: ' message: a JSON status reply for the slide import.
  _onSlideImportMsg(textMsg) {
    const content = JSON.parse(textMsg.substring("slideimport:".length + 1));
    this._map.fire("slideimport", { message: content });
  }
  // 'zstdvectorprimitives:' message: a zstd-compressed .uno:VectorPrimitives response.
  // Decompress the binary payload and route it through the normal
  // command-values handler.
  _onZstdVectorPrimitivesMsg(e, pushed) {
    var _a;
    const event = e;
    if (!event.imgBytes || event.imgIndex === void 0) {
      window.app.console.warn("zstdvectorprimitives with no payload");
      return;
    }
    const compressed = event.imgBytes.subarray(event.imgIndex);
    const json = new TextDecoder().decode(window.fzstd.decompress(compressed));
    const sequence = cool.InputSequence.readFrom(event.textMsg.split("\n")[0]);
    let type = "unknown";
    let detail = "";
    try {
      const parsed = JSON.parse(json);
      type = parsed.type || "unknown";
      if (parsed.type === "vectorrenderingfont") {
        detail = ", fontId=" + parsed.fontId + ", font=" + (parsed.data ? parsed.data.length : 0) + " base64 bytes";
      } else {
        detail = ", objects=" + (parsed.objects ? parsed.objects.length : 0);
        if (parsed.order)
          detail += ", order=" + parsed.order.length;
        if (parsed.version !== void 0)
          detail += ", version=" + parsed.version;
      }
    } catch (error) {
    }
    (_a = this._map._debug) == null ? void 0 : _a.vectorDataAdd(type === "vectorrenderingfont" ? "font" : type === "vectorrenderinggraphics" ? "graphics" : "content", compressed.length, json.length, pushed);
    window.app.console.log("zstd" + type + (pushed ? " PUSHED" : " pulled") + " payload: " + compressed.length + " bytes compressed, " + json.length + " bytes JSON" + detail);
    const docLayer = this._map._docLayer;
    if (docLayer && docLayer._onCommandValuesMsg)
      docLayer._onCommandValuesMsg("commandvalues:" + (sequence !== void 0 ? " inputSequence=" + sequence : "") + " " + json);
  }
  // 'sliderenderingcomplete: ' message.
  _onSlideRenderingCompleteMsg(textMsg, e) {
    const json = JSON.parse(textMsg.substring("sliderenderingcomplete:".length + 1));
    this._map.fire("sliderenderingcomplete", {
      message: json,
      success: json.status === "success"
    });
  }
  // 'progress: ' message.
  _onProgressMsg(textMsg) {
    const info = JSON.parse(textMsg.substring(textMsg.indexOf("{")));
    if (!info) {
      window.app.console.error("Missing info in progress: message");
      return;
    }
    info.statusType = info.id;
    info.background = info.type == "bg";
    if (info.id == "find" || info.id == "connect" || info.id == "ready") {
      this._map.showBusy(window.ThisIsAMobileApp ? _("Loading...") : _("Connecting..."), true);
      if (info.id == "ready") {
        this.ReconnectCount = 0;
        clearTimeout(this.timer);
      }
    } else if (info.id == "start" || info.id == "setvalue") {
      this._map.fire("statusindicator", info);
    } else if (info.id == "finish") {
      this._map.fire("statusindicator", info);
      this._map._fireInitComplete("statusindicatorfinish");
      if (window.location.search.indexOf("collaboraTrackChanges=true") !== -1 && !this._map._uniTrackChangesRequested) {
        this._map._uniTrackChangesRequested = true;
        this._map.sendUnoCommand(".uno:TrackChanges");
      }
      if (app.idleHandler._serverRecycling) {
        this._map.showBusy(_("Server is shutting down"), false);
      }
    } else {
      window.app.console.error("Unknown progress status " + info.id);
    }
  }
};
_Socket.UserExitCode = 4e3;
_Socket.pixelFramePrefixes = [
  "tile:",
  "delta:",
  "slidelayer:",
  "zstdslidelayer:",
  "windowpaint:"
];
_Socket.appImageFramePrefixes = [
  "tile:",
  "tilecombine:",
  "delta:",
  "rendersearchresult:",
  "slidelayer:",
  "zstdslidelayer:",
  "zstdvectorprimitives:",
  "zstdvectorprimitivesdelta:",
  "zstdvectorrenderingfont:",
  "windowpaint:"
];
_Socket.MigrationTimeoutMs = 24e4;
let Socket = _Socket;
app.definitions.Socket = Socket;
