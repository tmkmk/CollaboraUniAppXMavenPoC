const _VectorResourceTracker = class _VectorResourceTracker {
  constructor(requestMessage) {
    this._cache = /* @__PURE__ */ new Map();
    this._requests = new cool.RequestTracker({
      timeout: _VectorResourceTracker.requestTimeout,
      expired: (requests) => this._requestAgain(requests)
    });
    this._unavailable = /* @__PURE__ */ new Set();
    this._idToParts = /* @__PURE__ */ new Map();
    this._requestMessage = requestMessage;
  }
  has(id) {
    return this._cache.has(id);
  }
  get(id) {
    return this._cache.get(id);
  }
  values() {
    return this._cache.values();
  }
  /// Remember that the part uses the ids.
  indexForPart(partId, ids) {
    for (const id of ids) {
      let parts = this._idToParts.get(id);
      if (!parts) {
        parts = /* @__PURE__ */ new Set();
        this._idToParts.set(id, parts);
      }
      parts.add(partId);
    }
  }
  /// Parts that use the id.
  partsFor(id) {
    return this._idToParts.get(id);
  }
  /// Forget that the part uses anything, and drop the values nothing uses
  /// any more.
  releasePart(partId) {
    for (const [id, parts] of Array.from(this._idToParts.entries())) {
      if (!parts.delete(partId) || parts.size > 0)
        continue;
      this._idToParts.delete(id);
      this._cache.delete(id);
    }
  }
  /// Make the ids all that the part uses. The part lets go of the ids it no longer uses, and
  /// with dropUnused a value that nothing uses any more goes. An id the part uses before and
  /// after keeps its value.
  replacePart(partId, ids, dropUnused) {
    for (const [id, parts] of Array.from(this._idToParts.entries())) {
      if (ids.has(id) || !parts.delete(partId) || parts.size > 0)
        continue;
      this._idToParts.delete(id);
      if (dropUnused)
        this._cache.delete(id);
    }
    this.indexForPart(partId, ids);
  }
  /// Forget that the part uses anything, keeping the values.
  forgetPart(partId) {
    for (const [id, parts] of Array.from(this._idToParts.entries())) {
      if (parts.delete(partId) && parts.size === 0)
        this._idToParts.delete(id);
    }
  }
  /// Forget which parts use what, keeping the values.
  forgetAllParts() {
    this._idToParts.clear();
  }
  /// Request every id that is neither loaded, nor asked for, nor
  /// unavailable.
  requestMissing(ids) {
    for (const id of ids) {
      if (this._cache.has(id))
        continue;
      if (this._unavailable.has(id))
        continue;
      this._requests.request(id, () => app.socket.sendMessage(this._requestMessage(id)));
    }
  }
  // The requests got no answer in time. Their ids that a part still uses are asked for again.
  _requestAgain(requests) {
    const ids = /* @__PURE__ */ new Set();
    for (const request of requests)
      for (const id of request.keys)
        if (this._idToParts.has(id))
          ids.add(id);
    this.requestMissing(ids);
  }
  /// Store a loaded value, which answers the request for the id.
  setLoaded(id, value) {
    this._cache.set(id, value);
    this._requests.answered(id);
  }
  /// Record an id no usable data could be obtained for, so it is not
  /// requested again.
  setUnavailable(id) {
    this._unavailable.add(id);
    this._requests.answered(id);
  }
  /// The request for the id is answered without a value, so the id can be asked for again.
  clearInFlight(id) {
    this._requests.answered(id);
  }
  /// Drop the loaded values, keeping which parts use which id. A dropped id is requested
  /// again as any missing one.
  dropValues() {
    this._cache.clear();
    this._requests.forgetAll();
  }
  clear() {
    this._cache.clear();
    this._requests.forgetAll();
    this._unavailable.clear();
    this._idToParts.clear();
  }
};
_VectorResourceTracker.requestTimeout = 1e4;
let VectorResourceTracker = _VectorResourceTracker;
