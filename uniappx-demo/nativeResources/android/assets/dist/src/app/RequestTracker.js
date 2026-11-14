var cool;
(function(cool2) {
  const _RequestTracker = class _RequestTracker {
    /// Forget the requests of every tracker. Nothing is sent.
    static forgetEverywhere() {
      for (const tracker of Array.from(_RequestTracker._withRequestsOut))
        tracker.forgetAll();
    }
    constructor(options = {}) {
      this._requests = /* @__PURE__ */ new Map();
      this._requestOfKey = /* @__PURE__ */ new Map();
      this._waiting = [];
      this._nextRequestId = 1;
      this._limitedOut = 0;
      this._timer = void 0;
      this._limit = options.limit ?? Infinity;
      this._timeout = options.timeout;
      this._expired = options.expired;
    }
    isOut(key) {
      return this._requestOfKey.has(key);
    }
    get requestCount() {
      return this._requests.size;
    }
    /// The id of the next request. The requests that are out have smaller ids.
    get nextRequestId() {
      return this._nextRequestId;
    }
    /// The requests that are out, oldest first.
    requests() {
      return this._requests.values();
    }
    outKeys() {
      return this._requestOfKey.keys();
    }
    /// Ask for the key, unless it is out. A limited request over the limit waits. Any
    /// other request goes out now, also for a key that waited.
    request(key, send, options = {}) {
      if (this._requestOfKey.has(key))
        return;
      if (!options.limited) {
        this._dropWaiting(key);
        this._sendKey(key, send, options);
        return;
      }
      if (this._waiting.some((one) => one.key === key))
        return;
      if (this._limitedOut < this._limit)
        this._sendKey(key, send, options);
      else
        this._waiting.push({ key, send, options });
    }
    /// Send one request for all the keys. Gives its id to send, and returns it.
    requestKeys(keys, data, send) {
      const request = this._add(keys.slice(), data, false);
      send(request.id);
      return request.id;
    }
    /// The answer for the key came. Its request closes with its last key.
    answered(key) {
      const id = this._requestOfKey.get(key);
      const request = id === void 0 ? void 0 : this._requests.get(id);
      if (!request)
        return;
      this._requestOfKey.delete(key);
      request.keys = request.keys.filter((other) => other !== key);
      if (request.keys.length === 0)
        this._remove(request);
      this._sendWaiting();
    }
    /// Close the request with the id and return it, undefined when it is not out.
    takeRequest(id) {
      const request = this._requests.get(id);
      if (!request)
        return void 0;
      this._remove(request);
      this._sendWaiting();
      return request;
    }
    /// Forget the key, out or waiting.
    forget(key) {
      this._dropWaiting(key);
      this.answered(key);
    }
    /// Forget the requests out that the check accepts.
    forgetWhere(accepts) {
      for (const request of Array.from(this._requests.values()))
        if (accepts(request))
          this._remove(request);
      this._sendWaiting();
    }
    /// Forget every request, out or waiting. Nothing is sent.
    forgetAll() {
      this._requests.clear();
      this._requestOfKey.clear();
      this._waiting = [];
      this._limitedOut = 0;
      this._stopTimer();
      _RequestTracker._withRequestsOut.delete(this);
    }
    /// Give up the requests out for longer than the timeout. True when there was one.
    dropLate() {
      const late = this._takeLate();
      this._sendWaiting();
      return late.length > 0;
    }
    /// Give up the requests out for longer than the timeout, and pass them to expired.
    expire() {
      var _a;
      const late = this._takeLate();
      this._sendWaiting();
      if (late.length > 0)
        (_a = this._expired) == null ? void 0 : _a.call(this, late);
      this._startTimer();
    }
    _takeLate() {
      const timeout = this._timeout;
      if (timeout === void 0)
        return [];
      const now = performance.now();
      const late = Array.from(this._requests.values()).filter((request) => now - request.sent >= timeout);
      for (const request of late)
        this._remove(request);
      return late;
    }
    _startTimer() {
      const timeout = this._timeout;
      if (timeout === void 0 || this._timer !== void 0)
        return;
      if (this._requests.size === 0)
        return;
      let oldest = Infinity;
      for (const request of this._requests.values())
        oldest = Math.min(oldest, request.sent);
      const wait = Math.max(0, oldest + timeout - performance.now());
      this._timer = setTimeout(() => {
        this._timer = void 0;
        this.expire();
      }, wait + 1);
    }
    _stopTimer() {
      if (this._timer === void 0)
        return;
      clearTimeout(this._timer);
      this._timer = void 0;
    }
    _add(keys, data, limited) {
      const request = {
        id: this._nextRequestId++,
        keys,
        data,
        sent: performance.now(),
        limited
      };
      this._requests.set(request.id, request);
      for (const key of keys)
        this._requestOfKey.set(key, request.id);
      if (limited)
        this._limitedOut++;
      _RequestTracker._withRequestsOut.add(this);
      this._startTimer();
      return request;
    }
    // A key asked for again while it was out belongs to the later request.
    _remove(request) {
      this._requests.delete(request.id);
      for (const key of request.keys)
        if (this._requestOfKey.get(key) === request.id)
          this._requestOfKey.delete(key);
      if (request.limited)
        this._limitedOut--;
      if (this._requests.size > 0)
        return;
      this._stopTimer();
      _RequestTracker._withRequestsOut.delete(this);
    }
    _dropWaiting(key) {
      if (this._waiting.length === 0)
        return;
      this._waiting = this._waiting.filter((one) => one.key !== key);
    }
    _sendKey(key, send, options) {
      if (options.needed && !options.needed())
        return;
      this._add([key], options.data, options.limited === true);
      send();
    }
    _sendWaiting() {
      while (this._limitedOut < this._limit && this._waiting.length > 0) {
        const next = this._waiting.shift();
        if (next)
          this._sendKey(next.key, next.send, next.options);
      }
    }
  };
  _RequestTracker._withRequestsOut = /* @__PURE__ */ new Set();
  let RequestTracker = _RequestTracker;
  cool2.RequestTracker = RequestTracker;
})(cool || (cool = {}));
