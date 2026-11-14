const _ViewLayoutVector = class _ViewLayoutVector extends ViewLayoutBase {
  constructor() {
    super(...arguments);
    this.type = "ViewLayoutVector";
    this.page = new cool.SimplePoint(0, 0);
    this.middle = null;
    this.pivotOnFrame = null;
    this.fitting = false;
    this.theUserChoseTheView = false;
    this.resizing = false;
  }
  /// Whether the client draws from the objects for this document, which is when this layout is
  /// the one to use.
  static isWanted() {
    var _a;
    const type = (_a = app.map._docLayer) == null ? void 0 : _a._docType;
    return RenderManager.isVectorRendering() && !app.file.fileBasedView && (type === "presentation" || type === "drawing");
  }
  /// The layout a presentation or a drawing is edited in: this one while the client draws from
  /// the objects, the tiled one otherwise.
  static forAPresentation() {
    return _ViewLayoutVector.isWanted() ? new _ViewLayoutVector() : new ViewLayoutImpress();
  }
  /*
      Swaps the presentation's layout for the one the rendering now asks for, after the
      rendering was switched. What was in view stays in view: the point at the middle of the
      frame is handed to the new layout, which shows it at its middle.
  */
  static switchTheRendering() {
    const document = app.activeDocument;
    const before = document == null ? void 0 : document.activeLayout;
    if (!document || !before || app.file.fileBasedView)
      return;
    if (before.type !== "ViewLayoutImpress" && before.type !== "ViewLayoutVector")
      return;
    const fresh = _ViewLayoutVector.forAPresentation();
    if (fresh.type === before.type) {
      fresh.dispose();
      return;
    }
    const middle = before.zoomAnchorPoint();
    fresh.documentAnchorPosition = before.documentAnchorPosition;
    fresh.viewSize = document.fileSize.clone();
    document.swapLayout(fresh);
    fresh.showAtTheMiddle(middle);
  }
  /*
      The page and the lawn round it, in twips of the document: where the lawn begins, which is
      before the page's origin, and how large it is. It is so many pages across and down, and
      grows to take in every object of the slide shown with a margin round it, so an object
      that lies further out, from a file or from another user, can still be reached.
  */
  lawn() {
    const lawn = this.lawnOfThePage();
    const objects = RenderGeometrySection.boxOfAllObjects();
    if (!objects)
      return lawn;
    const margin = Math.max(this.page.x, this.page.y) / 10;
    return lawn.union(objects.expand(margin, margin));
  }
  /// The lawn as the page gives it, so many pages across and down round it, before it grows
  /// to take in the objects.
  lawnOfThePage() {
    const across = _ViewLayoutVector.lawnWidthInPages;
    const down = _ViewLayoutVector.lawnHeightInPages;
    const left = -this.page.x * (across - 1) / 2;
    const top = -this.page.y * (down - 1) / 2;
    return new cool.Range2D(left, top, left + this.page.x * across, top + this.page.y * down);
  }
  /// The lawn as the page gives it, in twips, or nothing where the view is not drawn from the
  /// objects.
  static lawnOfThePageInView() {
    var _a;
    const layout = (_a = app.activeDocument) == null ? void 0 : _a.activeLayout;
    return (layout == null ? void 0 : layout.type) === "ViewLayoutVector" ? layout.lawnOfThePage() : void 0;
  }
  /// Works the lawn out again from the objects as they stand, and the view with it where it
  /// changed.
  static takeInTheObjects() {
    var _a;
    const layout = (_a = app.activeDocument) == null ? void 0 : _a.activeLayout;
    if ((layout == null ? void 0 : layout.type) !== "ViewLayoutVector")
      return;
    const vector = layout;
    const lawn = vector.lawn();
    if (lawn.width === vector._viewSize.x && lawn.height === vector._viewSize.y)
      return;
    vector._viewSize = new cool.SimplePoint(lawn.width, lawn.height);
    vector.updateViewData();
  }
  middleOfThePage() {
    return new cool.SimplePoint(this.page.x / 2, this.page.y / 2);
  }
  get viewSize() {
    return this._viewSize;
  }
  /// The size given is the page's. What can be scrolled is the lawn round it.
  set viewSize(size) {
    this.page = size.clone();
    const lawn = this.lawn();
    this._viewSize = new cool.SimplePoint(lawn.width, lawn.height);
  }
  getBaseViewSize() {
    return this._viewSize;
  }
  laysRoomBeforeTheDocument() {
    return true;
  }
  zoomAnchorPoint() {
    return (this.middle ?? this.middleOfThePage()).clone();
  }
  /// Shows that point of the document at the middle of the frame.
  showAtTheMiddle(point) {
    this.middle = point.clone();
    this.theUserChoseTheView = true;
    this.updateViewData();
  }
  /*
      Builds the view from the zoom and the point at the middle of the frame. Where the frame is
      smaller than the lawn on an axis, the view is kept inside the lawn; where it is larger, the
      lawn stands in the middle of the frame. The point at the middle is then where the view put
      it, so a view held at an edge stays there through the next zoom.
  */
  refreshVisibleAreaRectangle() {
    const anchor = this.getDocumentAnchorSection();
    if (!anchor)
      return;
    const scale = app.twipsToPixels;
    if (!scale || this.page.x <= 0 || this.page.y <= 0) {
      this.viewedRectangle = cool.SimpleRectangle.fromCorePixels([
        0,
        0,
        anchor.size[0],
        anchor.size[1]
      ]);
      return;
    }
    const lawn = this.lawn();
    const width = anchor.size[0] / scale;
    const height = anchor.size[1] / scale;
    const wanted = this.middle ?? this.middleOfThePage();
    const placed = (at, size, from, length) => {
      if (size >= length)
        return from - (size - length) / 2;
      return Math.min(Math.max(at - size / 2, from), from + length - size);
    };
    const left = placed(wanted.x, width, lawn.minX, lawn.width);
    const top = placed(wanted.y, height, lawn.minY, lawn.height);
    if (this.middle)
      this.middle = new cool.SimplePoint(left + width / 2, top + height / 2);
    this.scrollProperties.viewX = Math.max(0, Math.round((left - lawn.minX) * scale));
    this.scrollProperties.viewY = Math.max(0, Math.round((top - lawn.minY) * scale));
    this.refreshScrollProperties();
    if (this._viewSize.pX > 0)
      this.scrollProperties.startX = Math.round(this.scrollProperties.viewX / this._viewSize.pX * this.scrollProperties.horizontalScrollLength);
    if (this._viewSize.pY > 0)
      this.scrollProperties.startY = Math.round(this.scrollProperties.viewY / this._viewSize.pY * this.scrollProperties.verticalScrollLength);
    this.viewedRectangle = cool.SimpleRectangle.fromCorePixels([
      Math.round(left * scale),
      Math.round(top * scale),
      anchor.size[0],
      anchor.size[1]
    ]);
  }
  /// The part of the document in view, in core pixels of the document.
  getViewportCorePixelBounds() {
    const rect = this._viewedRectangle;
    return new cool.Bounds(new cool.Point(rect.pX1, rect.pY1), new cool.Point(rect.pX1 + rect.pWidth, rect.pY1 + rect.pHeight));
  }
  /// Moves the view by that many core pixels. A move that the lawn's edges allow is what
  /// happens, and the answer says whether the view moved at all.
  scroll(pX, pY, userIsScrolling = false) {
    if (userIsScrolling)
      this.unselectCommentOnScroll();
    const scale = app.twipsToPixels;
    if (!scale)
      return false;
    const before = this._viewedRectangle.clone();
    const from = this.zoomAnchorPoint();
    this.middle = new cool.SimplePoint(from.x + pX / scale, from.y + pY / scale);
    this.theUserChoseTheView = true;
    this.updateViewData();
    return before.pX1 !== this._viewedRectangle.pX1 || before.pY1 !== this._viewedRectangle.pY1;
  }
  /*
      Places the view for a zoom about that point: the point stays at the place on the frame
      the zoom was given with, or at the middle of the frame. A zoom with no point puts the view
      onto the middle of the page.
  */
  setViewRectangleFromPointAndScale(point, scale) {
    if (!scale)
      return;
    if (this.fitting) {
      this.middle = null;
    } else if (this.pivotOnFrame) {
      const anchor = this.getDocumentAnchorSection();
      const frameMiddleX = anchor ? anchor.size[0] / 2 : 0;
      const frameMiddleY = anchor ? anchor.size[1] / 2 : 0;
      this.middle = new cool.SimplePoint(point.x + (frameMiddleX - this.pivotOnFrame.x) / scale, point.y + (frameMiddleY - this.pivotOnFrame.y) / scale);
    } else {
      this.middle = point.clone();
    }
    this.refreshVisibleAreaRectangle();
  }
  applyZoom(targetZoom, anchorTwips, anchorOnCanvas) {
    if (!anchorTwips && this.resizing && this.theUserChoseTheView)
      return;
    this.theUserChoseTheView = anchorTwips !== void 0;
    this.fitting = !anchorTwips;
    this.pivotOnFrame = anchorTwips && anchorOnCanvas ? new cool.Point(anchorOnCanvas.pX - this._documentAnchorPosition[0], anchorOnCanvas.pY - this._documentAnchorPosition[1]) : null;
    super.applyZoom(targetZoom, anchorTwips, anchorOnCanvas);
    this.fitting = false;
    this.pivotOnFrame = null;
    this.updateViewData();
  }
  /*
      The frame changed size. A view the user chose keeps what stands at its top left there, as
      a window resized by its lower right corner does elsewhere; a view on the fitted page is
      fitted again and stays on the middle of the page.
  */
  onResize() {
    const topLeft = new cool.SimplePoint(this._viewedRectangle.x1, this._viewedRectangle.y1);
    const keepsTheTopLeft = this.theUserChoseTheView && this._viewedRectangle.width > 0;
    this.resizing = true;
    try {
      app.map._docLayer._syncTileContainerSize();
    } finally {
      this.resizing = false;
    }
    app.layoutingService.appendLayoutingTask(() => {
      const anchor = this.getDocumentAnchorSection();
      const scale = app.twipsToPixels;
      if (keepsTheTopLeft && anchor && scale)
        this.middle = new cool.SimplePoint(topLeft.x + anchor.size[0] / scale / 2, topLeft.y + anchor.size[1] / scale / 2);
      this.updateViewData();
    });
  }
};
_ViewLayoutVector.lawnWidthInPages = 3;
_ViewLayoutVector.lawnHeightInPages = 2;
let ViewLayoutVector = _ViewLayoutVector;
