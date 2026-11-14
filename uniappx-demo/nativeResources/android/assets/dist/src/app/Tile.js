const _Tile = class _Tile {
  constructor(coords) {
    this.distanceFromView = 0;
    this.image = null;
    this.rawDeltas = [];
    this.deltaCount = 0;
    this.updateCount = 0;
    this.loadCount = 0;
    this.gcErrors = 0;
    this.missingContent = 0;
    this.invalidateCount = 0;
    this.viewId = 0;
    this.wireId = 0;
    this.invalidFrom = 0;
    this.deltaId = 0;
    this.lastPendingId = 0;
    this.decompressedId = 0;
    this.lastRendered = performance.timeOrigin;
    this.lastRequestTime = void 0;
    this.coords = coords;
  }
  hasContent() {
    return !!this.image || this.hasKeyframe();
  }
  needsFetch() {
    return this.invalidFrom >= this.wireId || !this.hasContent();
  }
  needsRehydration() {
    if (this.rawDeltas.length === 0)
      return false;
    const lastId = this.rawDeltas[this.rawDeltas.length - 1].id;
    return this.lastPendingId !== lastId;
  }
  hasKeyframe() {
    return !!this.rawDeltas.length;
  }
  isReady() {
    return this.decompressedId === this.lastPendingId;
  }
  /// Demand a whole tile back to the keyframe from coolwsd.
  forceKeyframe(wireId = 0) {
    this.wireId = wireId;
    this.invalidFrom = wireId;
    this.allowFastRequest();
  }
  /// The server has no newer content for this tile, so the tile is up to date again.
  clearInvalidation() {
    this.invalidFrom = 0;
  }
  /// Avoid continually re-requesting tiles for eg. preloading
  requestingTooFast(now) {
    const tooFast = this.lastRequestTime && now.getTime() - this.lastRequestTime.getTime() < _Tile.requestWaitMs;
    return tooFast;
  }
  updateLastRequest(now) {
    this.lastRequestTime = now;
  }
  /// Allow faster requests
  allowFastRequest() {
    this.updateLastRequest(void 0);
  }
  isReadyToDraw() {
    return !!this.image;
  }
};
_Tile.requestWaitMs = 5e3;
let Tile = _Tile;
