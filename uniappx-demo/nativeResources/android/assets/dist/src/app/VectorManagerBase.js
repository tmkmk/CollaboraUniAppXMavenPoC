const _VectorManagerBase = class _VectorManagerBase extends RenderManagerBase {
  constructor() {
    super(...arguments);
    this._resources = new VectorResourceLoader((owners) => this._resourcesLoaded(owners), (checksum) => this._imageSettled(checksum));
    this._renderer = new cool.VectorPrimitiveRenderer(
      (checksum) => this._imageFor(checksum),
      (fontId) => this._resources.hasFont(fontId),
      // a picture the client made of a form control is drawn once it has loaded
      () => this._onPictureReady()
    );
    this._changeListeners = new cool.VectorChangeListeners();
    this._drawnElsewhere = new cool.DrawnElsewhere();
  }
  /*
      Register a callback fired whenever the content changes. It is handed the ids of the
      objects an answer from the engine replaced, an empty list where the change was made here
      and the engine answered nothing, and nothing at all where everything may have changed.
      inputSequence is the newest input of this view that an answer reflects.
  */
  onVectorChanged(callback) {
    this._changeListeners.add(callback);
  }
  /// Forget a callback registered with onVectorChanged.
  offVectorChanged(callback) {
    this._changeListeners.remove(callback);
  }
  _fireChanged(answered, inputSequence) {
    this._changeListeners.fire(answered, inputSequence);
  }
  /// Draw again what the client changed in place, such as the objects after a drag.
  changedHere() {
    this._fireChanged([]);
  }
  /// The objects to leave out of the drawing from now on, since they are drawn elsewhere. An
  /// empty list leaves nothing out.
  drawnElsewhere(objectIds) {
    this._drawnElsewhere.set(objectIds);
  }
  drawnElsewhereVersion() {
    return this._drawnElsewhere.version();
  }
  /// Cache a fetched image, or mark it unavailable when it is missing or fails to decode.
  handleVectorRenderingGraphicsResponse(values) {
    this._resources.handleImage(values);
  }
  /// Register a fetched font as a FontFace, which is drawn with once it loads.
  handleVectorRenderingFontResponse(values) {
    this._resources.handleFont(values);
  }
  /// Forget the requests that wait for an answer, whichever tracker holds them. An answer to
  /// a request sent before the connection dropped never comes, and every request went over
  /// that connection.
  forgetRequestsInFlight() {
    cool.RequestTracker.forgetEverywhere();
  }
  /// Release the decoded images and what the renderer keeps between draws. What is still
  /// needed is asked for again. The fonts stay registered, since they are few and small.
  reclaimGraphicsMemory() {
    this._resources.dropImages();
    this._renderer.releaseScratchCanvases();
    this._renderer.releaseColorChangedImages();
  }
  /// The width of a string as the renderer draws the run, so predicted widths match the
  /// screen.
  _textMeasure() {
    return cool.canvasTextMeasure((fontId) => this._resources.hasFont(fontId));
  }
  /// The image the renderer draws for the checksum, or undefined while it is not decoded.
  _imageFor(checksum) {
    return this._resources.image(checksum);
  }
  /// An image or a font that the content names has loaded, for the owners that name it, or
  /// undefined when no owner does. It changes nothing at the engine, so no object is answered.
  _resourcesLoaded(_owners) {
    this._fireChanged([]);
  }
  /// An image decoded or turned out to be unavailable.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  _imageSettled(_checksum) {
  }
  /// A picture the renderer made of a form control has loaded.
  _onPictureReady() {
    this._fireChanged([]);
  }
};
_VectorManagerBase.requestTimeout = 1e4;
let VectorManagerBase = _VectorManagerBase;
