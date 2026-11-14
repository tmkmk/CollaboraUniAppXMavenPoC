const _RenderManager = class _RenderManager {
  /// The kind of manager the document type draws with. With the vector rendering option on,
  /// Impress, Draw and Calc documents draw from vector primitives, and any other from bitmap
  /// tiles.
  static kindFor(docType) {
    if (!cool.VectorRenderingConfig.isEnabled())
      return "tiles";
    if (docType === "presentation" || docType === "drawing")
      return "slides";
    if (docType === "spreadsheet")
      return "sheet";
    return "tiles";
  }
  static newManager(kind) {
    switch (kind) {
      case "slides":
        return new ImpressVectorManager();
      case "sheet":
        return new CalcVectorManager();
      default:
        return new BitmapTileManager();
    }
  }
  /// Pick the manager for the document type, replacing the instance when
  /// an earlier one is of the wrong kind.
  static makeInstance(docType) {
    const kind = _RenderManager.kindFor(docType);
    if (!_RenderManager._instance || _RenderManager._instance.kind() !== kind) {
      const previous = _RenderManager._instance;
      if (previous)
        previous.discardAllCache();
      _RenderManager._instance = _RenderManager.newManager(kind);
      if (previous)
        _RenderManager._instance.adoptAfterVisualsReadyTasks(previous);
      for (const listener of _RenderManager._vectorListeners)
        _RenderManager._instance.onVectorChanged(listener);
    }
    return _RenderManager._instance;
  }
  /// The manager of a spreadsheet drawn from vector primitives, or undefined while the
  /// document draws otherwise.
  static calcVectorManager() {
    const instance = _RenderManager._instance;
    return instance instanceof CalcVectorManager ? instance : void 0;
  }
  static ensureInstance() {
    if (!_RenderManager._instance)
      _RenderManager._instance = new BitmapTileManager();
    return _RenderManager._instance;
  }
  static get tileSize() {
    return window.tileSize;
  }
  static initialize(docType) {
    _RenderManager.makeInstance(docType).initialize();
  }
  /// Pick the manager again, for when the vector rendering option has changed while a document
  /// is open. A manager of the wrong kind is replaced and the new one initialized.
  static reinitialize(docType) {
    const previous = _RenderManager._instance;
    const instance = _RenderManager.makeInstance(docType);
    if (instance !== previous)
      instance.initialize();
  }
  static appendAfterVisualsReady(task) {
    _RenderManager.ensureInstance().appendAfterVisualsReady(task);
  }
  static markThumbnailStale() {
    _RenderManager.ensureInstance().markThumbnailStale();
  }
  static markVisualsReady() {
    _RenderManager.ensureInstance().markVisualsReady();
  }
  static updateOverlayMessages() {
    _RenderManager.ensureInstance().updateOverlayMessages();
  }
  static getExpiryFactor(tile) {
    return _RenderManager.ensureInstance().getExpiryFactor(tile);
  }
  static beginTransaction() {
    _RenderManager.ensureInstance().beginTransaction();
  }
  static endTransaction(callback = null) {
    _RenderManager.ensureInstance().endTransaction(callback);
  }
  static refreshTilesInBackground() {
    _RenderManager.ensureInstance().refreshTilesInBackground();
  }
  static setDebugDeltas(state) {
    _RenderManager.ensureInstance().setDebugDeltas(state);
  }
  static onTileStateChanged(callback) {
    _RenderManager.ensureInstance().onTileStateChanged(callback);
  }
  static offTileStateChanged(callback) {
    _RenderManager.ensureInstance().offTileStateChanged(callback);
  }
  static get(coords) {
    return _RenderManager.ensureInstance().get(coords);
  }
  static getTiles() {
    return _RenderManager.ensureInstance().getTiles();
  }
  static overlapInvalidatedRectangleWithView(part, mode, wireId, invalidatedRectangle, textMsg) {
    _RenderManager.ensureInstance().overlapInvalidatedRectangleWithView(part, mode, wireId, invalidatedRectangle, textMsg);
  }
  static resetPreFetching(resetBorder) {
    _RenderManager.ensureInstance().resetPreFetching(resetBorder);
  }
  static clearPreFetch() {
    _RenderManager.ensureInstance().clearPreFetch();
  }
  static initPreFetchAdjacentTiles() {
    _RenderManager.ensureInstance().initPreFetchAdjacentTiles();
  }
  static sendProcessedResponse() {
    _RenderManager.ensureInstance().sendProcessedResponse();
  }
  static onTileMsg(textMsg, img) {
    _RenderManager.ensureInstance().onTileMsg(textMsg, img);
  }
  static onTileGoneMsg(textMsg) {
    _RenderManager.ensureInstance().onTileGoneMsg(textMsg);
  }
  static predictTilesToSlurp() {
    return _RenderManager.ensureInstance().predictTilesToSlurp();
  }
  static pruneTiles() {
    _RenderManager.ensureInstance().pruneTiles();
  }
  static reclaimGraphicsMemory() {
    _RenderManager.ensureInstance().reclaimGraphicsMemory();
  }
  static discardAllCache() {
    _RenderManager.ensureInstance().discardAllCache();
  }
  static tileCount() {
    return _RenderManager.ensureInstance().tileCount();
  }
  static isValidTile(coords) {
    return _RenderManager.ensureInstance().isValidTile(coords);
  }
  static redraw() {
    return _RenderManager.ensureInstance().redraw();
  }
  static update(zoom = null) {
    _RenderManager.ensureInstance().update(zoom);
  }
  static onWorkerEndTransaction(e) {
    _RenderManager.ensureInstance().onWorkerEndTransaction(e);
  }
  static onWorkerError(e) {
    _RenderManager.ensureInstance().onWorkerError(e);
  }
  static updateOnChangePart() {
    _RenderManager.ensureInstance().updateOnChangePart();
  }
  static expandTileRange(range) {
    return _RenderManager.ensureInstance().expandTileRange(range);
  }
  static pxBoundsToTileRange(bounds) {
    return _RenderManager.ensureInstance().pxBoundsToTileRange(bounds);
  }
  static checkRequestTiles(currentCoordList, sendTileCombine = true) {
    return _RenderManager.ensureInstance().checkRequestTiles(currentCoordList, sendTileCombine);
  }
  static requestVisibleTiles(currentCoordList) {
    _RenderManager.ensureInstance().requestVisibleTiles(currentCoordList);
  }
  static updateFileBasedView(checkOnly = false, zoomFrameBounds = null, forZoom = null) {
    return _RenderManager.ensureInstance().updateFileBasedView(checkOnly, zoomFrameBounds, forZoom);
  }
  static invalidateTile(key, wireId) {
    _RenderManager.ensureInstance().invalidateTile(key, wireId);
  }
  static touchImage(tile) {
    _RenderManager.ensureInstance().touchImage(tile);
  }
  // vector rendering specific
  static isVectorRendering() {
    return _RenderManager.ensureInstance().isVectorRendering();
  }
  static drawsFromObjects() {
    return _RenderManager.ensureInstance().drawsFromObjects();
  }
  static kind() {
    return _RenderManager.ensureInstance().kind();
  }
  static toEngine(message) {
    return _RenderManager.ensureInstance().toEngine(message);
  }
  static predictTextInsert(text) {
    return _RenderManager.ensureInstance().predictTextInsert(text);
  }
  static predictTextDelete(before, after) {
    return _RenderManager.ensureInstance().predictTextDelete(before, after);
  }
  static keepPredictedCaret(update) {
    return _RenderManager.ensureInstance().keepPredictedCaret(update);
  }
  static canPredictAtCaret() {
    return _RenderManager.ensureInstance().canPredictAtCaret();
  }
  static moveCaretByCharacter(step, extend = false) {
    return _RenderManager.ensureInstance().moveCaretByCharacter(step, extend);
  }
  static moveCaretByWord(step, extend = false) {
    return _RenderManager.ensureInstance().moveCaretByWord(step, extend);
  }
  static moveCaretByLine(step, extend = false) {
    return _RenderManager.ensureInstance().moveCaretByLine(step, extend);
  }
  static startTextDrag(x, y, hitId) {
    return _RenderManager.ensureInstance().startTextDrag(x, y, hitId);
  }
  static dragTextTo(x, y) {
    _RenderManager.ensureInstance().dragTextTo(x, y);
  }
  static endTextDrag() {
    _RenderManager.ensureInstance().endTextDrag();
  }
  static placeCaretAt(x, y, hitId) {
    return _RenderManager.ensureInstance().placeCaretAt(x, y, hitId);
  }
  static selectWordAt(x, y, hitId) {
    return _RenderManager.ensureInstance().selectWordAt(x, y, hitId);
  }
  static selectParagraphAt(x, y, hitId) {
    return _RenderManager.ensureInstance().selectParagraphAt(x, y, hitId);
  }
  static requestThumbnail(id, part, mode, maxWidth, maxHeight) {
    _RenderManager.ensureInstance().requestThumbnail(id, part, mode, maxWidth, maxHeight);
  }
  static requestPart(part, mode) {
    return _RenderManager.ensureInstance().requestPart(part, mode);
  }
  static partIdAt(part, mode) {
    return _RenderManager.ensureInstance().partIdAt(part, mode);
  }
  static renderInto(context, data, options) {
    _RenderManager.ensureInstance().renderInto(context, data, options);
  }
  static renderObjectsWith(context, data, objectIds, matrix) {
    _RenderManager.ensureInstance().renderObjectsWith(context, data, objectIds, matrix);
  }
  static renderPrimitives(context, data, primitives) {
    _RenderManager.ensureInstance().renderPrimitives(context, data, primitives);
  }
  static renderObjectParagraph(context, data, objectId, paragraph, options) {
    _RenderManager.ensureInstance().renderObjectParagraph(context, data, objectId, paragraph, options);
  }
  static renderPlaceholderAids(context, data) {
    _RenderManager.ensureInstance().renderPlaceholderAids(context, data);
  }
  static textColorOf(data, primitive) {
    return _RenderManager.ensureInstance().textColorOf(data, primitive);
  }
  static drawnElsewhere(objectIds) {
    _RenderManager.ensureInstance().drawnElsewhere(objectIds);
  }
  static drawnElsewhereVersion() {
    return _RenderManager.ensureInstance().drawnElsewhereVersion();
  }
  static isPartDrawable(part, mode) {
    return _RenderManager.ensureInstance().isPartDrawable(part, mode);
  }
  static requestPartById(partId, mode) {
    return _RenderManager.ensureInstance().requestPartById(partId, mode);
  }
  static isPartDrawableById(partId, mode) {
    return _RenderManager.ensureInstance().isPartDrawableById(partId, mode);
  }
  static isLayerVisible(layer) {
    return _RenderManager.ensureInstance().isLayerVisible(layer);
  }
  static onVectorChanged(callback) {
    _RenderManager._vectorListeners.push(callback);
    _RenderManager.ensureInstance().onVectorChanged(callback);
  }
  static offVectorChanged(callback) {
    const index = _RenderManager._vectorListeners.indexOf(callback);
    if (index >= 0)
      _RenderManager._vectorListeners.splice(index, 1);
    _RenderManager.ensureInstance().offVectorChanged(callback);
  }
  /// Says that the objects the client holds changed here rather than at the engine.
  static changedHere() {
    _RenderManager.ensureInstance().changedHere();
  }
  static handleVectorPrimitivesResponse(values) {
    _RenderManager.ensureInstance().handleVectorPrimitivesResponse(values);
  }
  static handleVectorRenderingGraphicsResponse(values) {
    _RenderManager.ensureInstance().handleVectorRenderingGraphicsResponse(values);
  }
  static handleVectorRenderingFontResponse(values) {
    _RenderManager.ensureInstance().handleVectorRenderingFontResponse(values);
  }
  static handleVectorPrimitivesDelta(values) {
    _RenderManager.ensureInstance().handleVectorPrimitivesDelta(values);
  }
  static partListChanged() {
    _RenderManager.ensureInstance().partListChanged();
  }
  static revalidateCachedParts() {
    _RenderManager.ensureInstance().revalidateCachedParts();
  }
  static forgetRequestsInFlight() {
    _RenderManager.ensureInstance().forgetRequestsInFlight();
  }
  static clearCachedPart(partId) {
    _RenderManager.ensureInstance().clearCachedPart(partId);
  }
  static clearAllParts() {
    _RenderManager.ensureInstance().clearAllParts();
  }
  static refreshTheme() {
    _RenderManager.ensureInstance().refreshTheme();
  }
};
_RenderManager._vectorListeners = [];
let RenderManager = _RenderManager;
window.RenderManager = RenderManager;
