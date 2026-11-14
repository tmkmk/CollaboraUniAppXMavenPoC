const _ZoomControl = class _ZoomControl extends CanvasSectionObject {
  constructor() {
    super(app.CSections.ZoomControl.name);
    this.processingOrder = app.CSections.ZoomControl.processingOrder;
    this.drawingOrder = app.CSections.ZoomControl.drawingOrder;
    this.zIndex = app.CSections.ZoomControl.zIndex;
    this.windowSection = true;
    this.zoomDurationMs = 250;
    this.zoomTarget = null;
    this.zoomAnchor = null;
    this.zoomEndScale = 1;
    this.wheelAccumulatedDelta = 0;
    this.wheelLastEventTime = 0;
    this.wheelLastStepTime = 0;
    this.pinchStartDistance = null;
    this.pinchStartZoom = null;
    this.pinchAnchor = null;
    this.pinchAnchorOnCanvas = null;
    this.pinchTargetZoom = null;
  }
  get layout() {
    return app.activeDocument && app.activeDocument.activeLayout;
  }
  // True when a canvas (core-pixel) point falls inside the document-anchor
  // (tiles) section, i.e. the area zoom gestures act on.
  inDocumentArea(point) {
    const anchor = app.sectionContainer.getDocumentAnchorSection();
    if (!anchor)
      return false;
    const x = point.pX;
    const y = point.pY;
    return x >= anchor.myTopLeft[0] && x <= anchor.myTopLeft[0] + anchor.size[0] && y >= anchor.myTopLeft[1] && y <= anchor.myTopLeft[1] + anchor.size[1];
  }
  // Public entry point that replaces map.setZoom/zoomIn/zoomOut for the
  // document. Zooms to `targetZoom`, centring on `anchorTwips` (a
  // document-space point in twips; defaults to the current view anchor).
  zoomTo(targetZoom, anchorTwips, animate = true, anchorOnCanvas) {
    const layout = this.layout;
    if (!layout)
      return;
    if (OverviewFade.handleZoomBeyondLimit(targetZoom))
      return;
    const target = app.map._limitZoom(targetZoom);
    if (target === app.map.getZoom())
      return;
    if (app.map._docLayer._docType === "spreadsheet")
      OtherViewCellCursorSection.closePopups();
    if (animate && !anchorTwips && !window.L.Browser.cypressTest) {
      this.animateZoom(target);
      return;
    }
    layout.applyZoom(target, anchorTwips || layout.zoomAnchorPoint(), anchorTwips ? anchorOnCanvas : void 0);
  }
  // Animate a centre-pivoted zoom through the section container's own
  // animation loop (startAnimating -> onAnimate -> onDraw ->
  // onAnimationEnded), not the tile painter's requestAnimationFrame. The
  // layout switches the tiles section into zoom-frame drawing; each frame we
  // hand it the interpolated scale, and at the end it commits map-free. The
  // pivot is the current view centre from the viewed rectangle (not the map
  // centre, which can be stale after a scroll).
  animateZoom(target) {
    const layout = this.layout;
    const anchor = layout.zoomAnchorPoint();
    if (window.L.Browser.cypressTest || app.sectionContainer.getAnimatingSectionName()) {
      layout.applyZoom(target, anchor);
      return;
    }
    this.zoomTarget = target;
    this.zoomAnchor = anchor;
    this.zoomEndScale = app.activeDocument.getZoomScale(target, app.map.getZoom());
    layout.beginZoom(anchor);
    this.startAnimating({ duration: this.zoomDurationMs });
  }
  // One animation frame: interpolate the zoom-frame scale from 1 (start) to
  // zoomEndScale (target) and hand it to the layout, which the tiles section
  // paints as this frame is drawn.
  onAnimate(frameCount, elapsedTime) {
    const p = this.zoomDurationMs > 0 ? Math.min(1, elapsedTime / this.zoomDurationMs) : 1;
    this.layout.stepZoom(1 + (this.zoomEndScale - 1) * p);
  }
  // Commit the final zoom when the animation finishes.
  // The pending target is cleared before the commit, so the zoom is committed once even if
  onAnimationEnded(frameCount, elapsedTime) {
    const target = this.zoomTarget;
    const anchor = this.zoomAnchor;
    this.zoomTarget = null;
    this.zoomAnchor = null;
    if (target !== null && anchor)
      this.layout.endZoom(target, anchor);
  }
  // Ctrl+wheel zoom. ScrollSection routes the Ctrl+wheel here for Calc
  // (plain wheel stays scrolling). The zoom moves at most one level per step,
  // pivoting on the pointer; committed directly (no animation) so notches feel
  // snappy.
  onMouseWheel(point, delta, e) {
    if (!e.ctrlKey || !this.layout)
      return;
    if (!this.inDocumentArea(point))
      return;
    const now = performance.now();
    if (now - this.wheelLastEventTime > _ZoomControl.wheelIdleResetMs)
      this.wheelAccumulatedDelta = 0;
    this.wheelLastEventTime = now;
    const threshold = _ZoomControl.wheelPixelsPerLevel;
    if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL)
      this.wheelAccumulatedDelta += e.deltaY;
    else
      this.wheelAccumulatedDelta = Math.sign(e.deltaY) * threshold;
    if (Math.abs(this.wheelAccumulatedDelta) < threshold)
      return;
    this.wheelAccumulatedDelta = Math.sign(this.wheelAccumulatedDelta) * threshold;
    if (now - this.wheelLastStepTime < _ZoomControl.wheelMinStepIntervalMs)
      return;
    const step = this.wheelAccumulatedDelta < 0 ? 1 : -1;
    this.wheelAccumulatedDelta = 0;
    this.wheelLastStepTime = now;
    const anchor = this.layout.canvasToDocumentPoint(point);
    this.zoomTo(app.map.getZoom() + step, anchor, false, point);
  }
  onMultiTouchStart(e) {
    this.pinchStartDistance = null;
    this.pinchStartZoom = app.map.getZoom();
    this.pinchAnchor = null;
    this.pinchTargetZoom = null;
  }
  onMultiTouchMove(point, distance, e) {
    if (!this.layout)
      return;
    if (!this.inDocumentArea(point))
      return;
    if (this.pinchStartDistance === null) {
      this.pinchStartDistance = distance;
      this.pinchAnchor = this.layout.canvasToDocumentPoint(point);
      this.pinchAnchorOnCanvas = point.clone();
      return;
    }
    if (!distance || !this.pinchStartDistance)
      return;
    const ratio = distance / this.pinchStartDistance;
    this.pinchTargetZoom = app.activeDocument.getScaleZoom(ratio, this.pinchStartZoom);
  }
  onMultiTouchEnd(e) {
    if (this.pinchTargetZoom !== null && this.pinchAnchor) {
      const delta = this.pinchTargetZoom - this.pinchStartZoom;
      const finalZoom = delta > 0 ? Math.ceil(this.pinchTargetZoom) : Math.floor(this.pinchTargetZoom);
      this.zoomTo(finalZoom, this.pinchAnchor, false, this.pinchAnchorOnCanvas ?? void 0);
    }
    this.pinchStartDistance = null;
    this.pinchTargetZoom = null;
    this.pinchAnchor = null;
    this.pinchAnchorOnCanvas = null;
  }
};
_ZoomControl.wheelPixelsPerLevel = 50;
_ZoomControl.wheelMinStepIntervalMs = 100;
_ZoomControl.wheelIdleResetMs = 300;
let ZoomControl = _ZoomControl;
