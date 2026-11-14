const _RenderManagerBase = class _RenderManagerBase {
  constructor() {
    this.visualsReady = false;
    this.afterVisualsReadyTasks = [];
  }
  // -- lifecycle / discovery --
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initialize() {
  }
  appendAfterVisualsReady(task) {
    if (this.visualsReady)
      app.layoutingService.appendLayoutingTask(() => {
        task();
      });
    else
      this.afterVisualsReadyTasks.push(task);
  }
  /// Takes over the tasks that another manager still holds for its first
  /// visuals. They run once this manager has content to show.
  adoptAfterVisualsReadyTasks(previous) {
    for (const task of previous.afterVisualsReadyTasks)
      this.appendAfterVisualsReady(task);
    previous.afterVisualsReadyTasks = [];
  }
  /// Content to show arrived from outside the tiles. Run the waiting tasks.
  markVisualsReady() {
    if (!this.visualsReady)
      this.setVisualsReady();
  }
  setVisualsReady() {
    this.visualsReady = true;
    while (this.afterVisualsReadyTasks.length > 0) {
      const task = this.afterVisualsReadyTasks.shift();
      task();
    }
  }
  // -- rendering / drawing --
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  updateOverlayMessages() {
  }
  // -- transactions (delta processing) --
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  beginTransaction() {
  }
  endTransaction(callback = null) {
    if (callback)
      callback();
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  sendProcessedResponse() {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onWorkerEndTransaction(_e) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onWorkerError(_e) {
  }
  // -- pre-fetching --
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  resetPreFetching(_resetBorder) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  clearPreFetch() {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initPreFetchAdjacentTiles() {
  }
  // -- memory / cache --
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  pruneTiles() {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reclaimGraphicsMemory() {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  discardAllCache() {
  }
  /// The tiles held.
  tileCount() {
    return 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  markThumbnailStale() {
  }
  onTileStateChanged(callback) {
    _RenderManagerBase.tileStateListeners.push(callback);
  }
  offTileStateChanged(callback) {
    const index = _RenderManagerBase.tileStateListeners.indexOf(callback);
    if (index >= 0)
      _RenderManagerBase.tileStateListeners.splice(index, 1);
  }
  /// Tell subscribers that some tile's state changed: created, destroyed,
  /// invalidated, requested, or given new content.
  notifyTileStateChanged() {
    for (const callback of _RenderManagerBase.tileStateListeners)
      callback();
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setDebugDeltas(_state) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  refreshTilesInBackground() {
  }
  // -- tile lookup --
  get(_coords) {
    return null;
  }
  getTiles() {
    return /* @__PURE__ */ new Map();
  }
  isValidTile(_coords) {
    return false;
  }
  // -- geometry --
  pxBoundsToTileRange(_bounds) {
    return new cool.Bounds(new cool.Point(0, 0), new cool.Point(-1, -1));
  }
  expandTileRange(range) {
    return range;
  }
  predictTilesToSlurp() {
    return 0;
  }
  // -- invalidation --
  overlapInvalidatedRectangleWithView(_part, _mode, _wireId, _invalidatedRectangle, _textMsg) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  invalidateTile(_key, _wireId) {
  }
  // -- update / fetch --
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  update(_center = null, _zoom = null) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  updateOnChangePart() {
  }
  updateFileBasedView(_checkOnly = false, _zoomFrameBounds = null, _forZoom = null) {
    return [];
  }
  checkRequestTiles(_currentCoordList, _sendTileCombine = true) {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  requestVisibleTiles(_currentCoordList) {
  }
  // -- message handling --
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTileMsg(_textMsg, _img) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onTileGoneMsg(_textMsg) {
  }
  // -- expiry / touch --
  getExpiryFactor(_tile) {
    return 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  touchImage(_tile) {
  }
  // -- vector rendering --
  /// Whether the view draws the objects of slides or drawing pages from vector primitives.
  isVectorRendering() {
    return false;
  }
  /// Whether the client holds the drawing objects and selects, hit tests
  /// and moves them itself.
  drawsFromObjects() {
    return this.isVectorRendering();
  }
  /// The message with object positions in the engine's placement.
  toEngine(message) {
    return message;
  }
  // Shows typed text before the engine answers. True when it shows.
  predictTextInsert(_text) {
    return false;
  }
  // Removes characters before and after the caret before the engine answers. True when it
  // shows.
  predictTextDelete(_before, _after) {
    return false;
  }
  // True when the local caret is ahead of the update's input.
  keepPredictedCaret(_update) {
    return false;
  }
  // Returns true when a keystroke at the caret would be predicted.
  canPredictAtCaret() {
    return false;
  }
  // Moves the caret one character without the server, and with extend selects text to it.
  // True when it moved.
  moveCaretByCharacter(_step, _extend) {
    return false;
  }
  // Moves the caret one word without the server, and with extend selects text to it. True
  // when it moved.
  moveCaretByWord(_step, _extend) {
    return false;
  }
  // Moves the caret one line up or down without the server, and with extend selects text to
  // it. True when it moved.
  moveCaretByLine(_step, _extend) {
    return false;
  }
  // Starts a drag that selects text without the server. True when the press is in the edited
  // text.
  startTextDrag(_x, _y, _hitId) {
    return false;
  }
  // Selects the text from where the drag started to the mouse.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  dragTextTo(_x, _y) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  endTextDrag() {
  }
  // Puts the caret where a click lands in the edited text, without the server. True when it
  // moved.
  placeCaretAt(_x, _y, _hitId) {
    return false;
  }
  // Selects the word under a double click in the edited text, without the server. True when
  // the word is selected.
  selectWordAt(_x, _y, _hitId) {
    return false;
  }
  // Selects the paragraph under a triple click in the edited text, without the server. True
  // when the paragraph is selected.
  selectParagraphAt(_x, _y, _hitId) {
    return false;
  }
  requestThumbnail(_id, _part, _mode, _maxWidth, _maxHeight) {
  }
  /// The vector content of a part, or undefined when none is held.
  requestPart(_part, _mode) {
    return void 0;
  }
  partIdAt(_part, _mode) {
    return void 0;
  }
  renderInto(_context, _data, _options) {
  }
  renderObjectsWith(_context, _data, _objectIds, _matrix) {
  }
  renderPrimitives(_context, _data, _primitives) {
  }
  /// Draw one paragraph of an object's text alone, in the colors and text look given. The
  /// context transform maps the part's twips to the target pixels.
  renderObjectParagraph(_context, _data, _objectId, _paragraph, _options) {
  }
  renderPlaceholderAids(_context, _data) {
  }
  /// The color the text run is drawn in, with no animation color in its place.
  textColorOf(_data, primitive) {
    return primitive.fontcolor;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setHiddenLayers(_layers) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  drawnElsewhere(_objectIds) {
  }
  drawnElsewhereVersion() {
    return 0;
  }
  isPartDrawable(_part, _mode) {
    return false;
  }
  requestPartById(_partId, _mode) {
    return void 0;
  }
  isPartDrawableById(_partId, _mode) {
    return false;
  }
  isLayerVisible(_layer) {
    return true;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onVectorChanged(_callback) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  offVectorChanged(_callback) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  changedHere() {
  }
  handleVectorPrimitivesResponse(_values) {
  }
  handleVectorRenderingGraphicsResponse(_values) {
  }
  handleVectorRenderingFontResponse(_values) {
  }
  handleVectorPrimitivesDelta(_values) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  partListChanged() {
  }
  /// Changes may have been missed while away, so ask again for what is held.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  revalidateCachedParts() {
  }
  /// Answers to requests sent before a reconnect never come.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  forgetRequestsInFlight() {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  clearCachedPart(_partId) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  clearAllParts() {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  refreshTheme() {
  }
  // -- redraw --
  redraw() {
    return this;
  }
};
_RenderManagerBase.tileStateListeners = [];
let RenderManagerBase = _RenderManagerBase;
