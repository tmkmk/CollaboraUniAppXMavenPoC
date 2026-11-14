const _Cursor = class _Cursor {
  // position and size should be in core pixels.
  constructor(rectangle, map, options) {
    this.opacity = 1;
    this.zIndex = 1e3;
    this.blink = false;
    this.header = false;
    this.headerTimeout = 3e3;
    this.visible = false;
    this.domAttached = false;
    this.visualsReady = false;
    this.lastPlace = null;
    this.onFocusBlur = (ev) => {
      this.addCursorClass(ev.type !== "blur");
    };
    this.onResize = () => {
      if (window.devicePixelRatio !== 1)
        this.cursor.style.width = this.width / window.devicePixelRatio + "px";
      else
        this.cursor.style.removeProperty("width");
    };
    this.opacity = options.opacity !== void 0 ? options.opacity : this.opacity;
    this.zIndex = options.zIndex !== void 0 ? options.zIndex : this.zIndex;
    this.blink = options.blink !== void 0 ? options.blink : this.blink;
    this.color = options.color !== void 0 ? options.color : this.color;
    this.header = options.header !== void 0 ? options.header : this.header;
    this.headerName = options.headerName !== void 0 ? options.headerName : this.headerName;
    this.headerTimeout = options.headerTimeout !== void 0 ? options.headerTimeout : this.headerTimeout;
    this.rectangle = rectangle;
    this.map = map;
    RenderManager.appendAfterVisualsReady(() => {
      this.visualsReady = true;
      this.update();
    });
    this.initLayout();
  }
  add() {
    if (!this.container) {
      this.initLayout();
    }
    this.setMouseCursor();
    this.map.getCursorOverlayContainer().appendChild(this.container);
    this.visible = true;
    this.domAttached = true;
    this.update();
    if (this.map._docLayer.isCalc())
      this.map.on("splitposchanged", this.update, this);
    window.addEventListener("blur", this.onFocusBlur);
    window.addEventListener("focus", this.onFocusBlur);
    window.addEventListener("resize", this.onResize);
  }
  setMouseCursor() {
    if (this.domAttached && this.container && this.container.querySelector(".blinking-cursor") !== null) {
      if (this.map._docLayer._docType === "presentation") {
        $(".leaflet-interactive").css("cursor", "text");
      } else {
        const canvas = document.getElementById("document-canvas");
        if (canvas.style.cursor !== "text")
          canvas.style.cursor = "text";
      }
    }
  }
  setMouseCursorForTextBox() {
    if (this.domAttached && this.container && this.container.querySelector(".blinking-cursor") !== null) {
      $(".leaflet-interactive").css("cursor", "text");
    }
    this.addCursorClass(app.file.textCursor.visible);
    this.setOpacity(app.file.textCursor.visible ? 1 : 0);
  }
  remove() {
    this.map.off("splitposchanged", this.update, this);
    if (this.map._docLayer._docType === "presentation") {
      $(".leaflet-interactive").css("cursor", "");
    } else {
      const canvas = document.getElementById("document-canvas");
      if (canvas)
        canvas.style.cursor = "";
    }
    if (this.container && this.domAttached) {
      this.map.getCursorOverlayContainer().removeChild(this.container);
    }
    this.visible = false;
    this.domAttached = false;
    this.lastPlace = null;
    window.removeEventListener("blur", this.onFocusBlur);
    window.removeEventListener("focus", this.onFocusBlur);
    window.removeEventListener("resize", this.onResize);
  }
  isDomAttached() {
    return this.domAttached;
  }
  addCursorClass(visible) {
    if (visible)
      window.L.DomUtil.removeClass(this.cursor, "blinking-cursor-hidden");
    else
      window.L.DomUtil.addClass(this.cursor, "blinking-cursor-hidden");
  }
  isVisible() {
    return this.visible;
  }
  // position and size should be in core pixels.
  setRectangle(rectangle) {
    this.rectangle = rectangle;
    this.update();
  }
  update() {
    if (!this.container || !this.map || !app.activeDocument || app.activeDocument.fileSize.x === 0)
      return;
    if (!this.visualsReady || !app.isRectangleVisibleInTheDisplayedArea(app.file.textCursor.rectangle.toArray())) {
      this.container.style.visibility = "hidden";
      this.visible = false;
      this.addCursorClass(this.visible);
      this.showCursorHeader();
      return;
    }
    this.container.style.visibility = "visible";
    this.visible = true;
    this.addCursorClass(this.visible);
    this.updatePositionAndSize();
    this.showCursorHeader();
    this.showPredictionState();
  }
  // While the predicted caret debug tool is on, this view's caret turns red
  // when a keystroke at it would be predicted. Other views' carets have a
  // color of their own and keep it.
  showPredictionState() {
    var _a;
    if (this.color)
      return;
    const predicting = ((_a = this.map._debug) == null ? void 0 : _a.predictedCaretOn) && RenderManager.canPredictAtCaret();
    window.L.DomUtil.setStyle(this.cursor, "background", predicting ? "red" : "");
  }
  setOpacity(opacity) {
    if (this.container)
      window.L.DomUtil.setOpacity(this.cursor, opacity);
    if (this.cursorHeader)
      window.L.DomUtil.setOpacity(this.cursorHeader, opacity);
  }
  // Shows cursor header if cursor is in visible area.
  showCursorHeader() {
    if (this.cursorHeader) {
      if (!this.visible || this.map._docLayer._isZooming) {
        this.hideCursorHeader();
        return;
      }
      window.L.DomUtil.setStyle(this.cursorHeader, "visibility", "visible");
      clearTimeout(this.blinkTimeout);
      this.blinkTimeout = setTimeout(window.L.bind(function() {
        this.hideCursorHeader();
      }, this), this.headerTimeout);
    }
  }
  hideCursorHeader() {
    if (this.cursorHeader)
      window.L.DomUtil.setStyle(this.cursorHeader, "visibility", "hidden");
  }
  initLayout() {
    this.container = window.L.DomUtil.create("div", "leaflet-cursor-container");
    if (this.header) {
      this.cursorHeader = window.L.DomUtil.create("div", "leaflet-cursor-header", this.container);
      this.cursorHeader.textContent = this.headerName;
      clearTimeout(this.blinkTimeout);
      this.blinkTimeout = setTimeout(window.L.bind(function() {
        window.L.DomUtil.setStyle(this._cursorHeader, "visibility", "hidden");
      }, this), this.headerTimeout);
    }
    this.cursor = window.L.DomUtil.create("div", "leaflet-cursor", this.container);
    if (this.blink) {
      window.L.DomUtil.addClass(this.cursor, "blinking-cursor");
    }
    if (this.color) {
      window.L.DomUtil.setStyle(this.cursorHeader, "background", this.color);
      window.L.DomUtil.setStyle(this.cursor, "background", this.color);
    }
    window.L.DomEvent.disableClickPropagation(this.cursor).disableScrollPropagation(this.container);
    let cursorCss = getComputedStyle(this.cursor, null);
    this.width = parseFloat(cursorCss.getPropertyValue("width"));
  }
  transformX(xpos) {
    if (!this.map._docLayer.isCalcRTL()) {
      return xpos;
    }
    return app.activeDocument.activeLayout.frameSize.cX - xpos;
  }
  updatePositionAndSize() {
    app.layoutingService.appendLayoutingTask(() => {
      let x;
      let y;
      if (app.map.getDocType() === "spreadsheet") {
        let diffX = -app.activeDocument.activeLayout.viewedRectangle.pX1;
        let diffY = -app.activeDocument.activeLayout.viewedRectangle.pY1;
        if (app.isXOrdinateInFrozenPane(this.rectangle.pX1))
          diffX = 0;
        if (app.isYOrdinateInFrozenPane(this.rectangle.pY1))
          diffY = 0;
        x = Math.round((this.rectangle.pX1 + diffX + app.sectionContainer.getDocumentAnchor()[0]) / app.dpiScale);
        y = Math.round((this.rectangle.pY1 + diffY + app.sectionContainer.getDocumentAnchor()[1]) / app.dpiScale);
      } else {
        x = Math.round(this.rectangle.v1X / app.dpiScale);
        y = Math.round(this.rectangle.v1Y / app.dpiScale);
      }
      this.slideAlongTheLine();
      this.container.style.top = y + "px";
      this.container.style.left = this.transformX(x) + "px";
      this.container.style.zIndex = this.zIndex + "";
      this.cursor.style.height = this.rectangle.cHeight + "px";
      if (this.blink) {
        window.L.DomUtil.addClass(this.cursor, "blinking-suspended");
        if (this.blinkSuspendTimeout) {
          clearTimeout(this.blinkSuspendTimeout);
        }
        this.blinkSuspendTimeout = setTimeout(() => {
          app.layoutingService.appendLayoutingTask(() => {
            window.L.DomUtil.removeClass(this.cursor, "blinking-suspended");
          });
        }, 500);
      }
    });
  }
  // In a vector view the caret slides a character or two along its line, so the eye follows
  // it. Any other move, to another line, far along the line or of the view, is immediate.
  slideAlongTheLine() {
    const view = app.activeDocument.activeLayout.viewedRectangle;
    const place = {
      x: this.rectangle.x1,
      y: this.rectangle.y1,
      viewX: view.pX1,
      viewY: view.pY1
    };
    const last = this.lastPlace;
    const sameView = last !== null && last.viewX === place.viewX && last.viewY === place.viewY;
    const sameLine = sameView && last.y === place.y;
    if (sameLine && last.x === place.x)
      return;
    const short = sameLine && Math.abs(place.x - last.x) <= 2 * this.rectangle.height;
    if (short && RenderManager.isVectorRendering() && _Cursor.slideTime > 0) {
      this.container.style.transitionDuration = _Cursor.slideTime + "ms";
      window.L.DomUtil.addClass(this.container, "leaflet-cursor-slides");
    } else {
      this.container.style.transitionDuration = "";
      window.L.DomUtil.removeClass(this.container, "leaflet-cursor-slides");
    }
    this.lastPlace = place;
  }
  static isCustomCursor(cursorName) {
    return _Cursor.customCursors.indexOf(cursorName) !== -1;
  }
  static getCustomCursor(cursorName) {
    var customCursor;
    if (_Cursor.isCustomCursor(cursorName)) {
      var cursorHotSpot = _Cursor.hotSpot.get(cursorName) || new cool.Point(0, 0);
      customCursor = "url(" + _Cursor.imagePath + "/" + cursorName + ".png) " + cursorHotSpot.x + " " + cursorHotSpot.y + ", default";
    }
    return customCursor;
  }
};
_Cursor.usualSlideTime = 60;
_Cursor.slideTime = _Cursor.usualSlideTime;
_Cursor.hotSpot = /* @__PURE__ */ new Map([["fill", new cool.Point(7, 16)]]);
_Cursor.customCursors = [
  "fill"
];
let Cursor = _Cursor;
