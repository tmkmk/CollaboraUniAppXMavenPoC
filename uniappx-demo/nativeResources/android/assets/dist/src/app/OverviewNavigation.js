const _OverviewNavigation = class _OverviewNavigation {
  // Zooms and scrolls so the preview of the given part is centered in the visible area
  // and its larger side takes fillRatio of the tighter viewport axis, clamped to the
  // allowed zoom range. Returns false without touching the view when the preview
  // rectangles are missing or the part has no preview.
  static centerPreviewOnViewport(part, fillRatio) {
    const previews = app.impress.previewRects;
    if (!previews)
      return false;
    const preview = previews.find((entry) => entry.part === part);
    if (!preview)
      return false;
    const anchor = app.sectionContainer.getDocumentAnchorSection();
    if (!anchor)
      return false;
    const rect = preview.rectangle;
    if (rect.pWidth <= 0 || rect.pHeight <= 0)
      return false;
    if (anchor.size[0] <= 0 || anchor.size[1] <= 0)
      return false;
    const scale = fillRatio * Math.min(anchor.size[0] / rect.pWidth, anchor.size[1] / rect.pHeight);
    Util.ensureValue(app.activeDocument);
    let zoom = Math.floor(app.activeDocument.getScaleZoom(scale));
    zoom = Math.max(app.map.getMinZoom(), Math.min(app.map.getMaxZoom(), zoom));
    app.zoomControl.zoomTo(zoom, void 0, false);
    const viewed = app.activeDocument.activeLayout.viewedRectangle;
    const center = rect.center;
    const scrollPoint = new cool.SimplePoint(center[0] - viewed.width / 2, center[1] - viewed.height / 2);
    app.activeDocument.activeLayout.scrollTo(scrollPoint.pX, scrollPoint.pY);
    return true;
  }
  // True when the overview page is on screen: the document is a presentation with an
  // overview page, laid out in the canvas-page layout rather than fileBasedView, and
  // the overview slide (part 0) is the selected part.
  static isOverviewActive() {
    if (!app.map || !app.map._docLayer)
      return false;
    if (app.map._docLayer._docType !== "presentation")
      return false;
    if (!app.impress.hasOverviewPage || app.file.fileBasedView)
      return false;
    return app.map._docLayer._selectedPart === 0;
  }
  // The part whose preview center sits nearest the viewport center, considering only
  // previews that intersect the visible area. Returns -1 when the view is not on the
  // overview page or no preview is in sight.
  static previewNearestViewportCenter() {
    if (!_OverviewNavigation.isOverviewActive())
      return -1;
    const previews = app.impress.previewRects;
    if (!previews)
      return -1;
    Util.ensureValue(app.activeDocument);
    const viewed = app.activeDocument.activeLayout.viewedRectangle;
    const viewedCenter = viewed.center;
    let nearestPart = -1;
    let nearestDistance = Infinity;
    for (const preview of previews) {
      if (!viewed.intersectsRectangle(preview.rectangle.toArray()))
        continue;
      const center = preview.rectangle.center;
      const distance = Math.hypot(center[0] - viewedCenter[0], center[1] - viewedCenter[1]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPart = preview.part;
      }
    }
    return nearestPart;
  }
  // Fits the preview nearest the viewport center. Returns false when no preview is in
  // sight.
  static fitNearestPreview(fillRatio) {
    const part = _OverviewNavigation.previewNearestViewportCenter();
    if (part < 1)
      return false;
    return _OverviewNavigation.centerPreviewOnViewport(part, fillRatio);
  }
  // Remembers the part to center once the next switch to the overview page has
  // positioned the view. Parts below 1 clear the request.
  static requestLanding(part) {
    _OverviewNavigation.pendingLandingPart = part >= 1 ? part : -1;
  }
  // Performs and clears the pending landing request. Returns true when a preview was
  // centered, false when no request was pending or the preview was not available.
  static consumeLandingRequest() {
    const part = _OverviewNavigation.pendingLandingPart;
    _OverviewNavigation.pendingLandingPart = -1;
    if (part < 1)
      return false;
    return _OverviewNavigation.centerPreviewOnViewport(part, _OverviewNavigation.landingFillRatio);
  }
};
_OverviewNavigation.fitFillRatio = 0.9;
_OverviewNavigation.landingFillRatio = 0.85;
_OverviewNavigation.pendingLandingPart = -1;
let OverviewNavigation = _OverviewNavigation;
