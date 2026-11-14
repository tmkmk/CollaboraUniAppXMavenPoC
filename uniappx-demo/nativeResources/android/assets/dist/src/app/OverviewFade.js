const _OverviewFade = class _OverviewFade {
  // Handles a request for a zoom level outside the allowed range. The request
  // switches slide instead of zooming when the view already sits at the limit
  // being pushed: zooming out on a normal slide goes to the Overview slide,
  // zooming in on the Overview slide goes back to the slide viewed before it.
  // Returns true when the request switched slide, false when the caller should
  // clamp and zoom as usual.
  static handleZoomBeyondLimit(requestedZoom) {
    if (_OverviewFade.inProgress)
      return false;
    const map = app.map;
    if (!map || !map._docLayer)
      return false;
    const docLayer = map._docLayer;
    if (docLayer._docType !== "presentation")
      return false;
    if (!app.impress.hasOverviewPage || app.file.fileBasedView)
      return false;
    const currentZoom = map.getZoom();
    if (requestedZoom < map.getMinZoom()) {
      if (currentZoom !== map.getMinZoom() || docLayer._selectedPart === 0)
        return false;
      _OverviewFade.fadeToPart(0);
      return true;
    }
    if (requestedZoom > map.getMaxZoom()) {
      if (currentZoom !== map.getMaxZoom() || docLayer._selectedPart !== 0)
        return false;
      if (docLayer._parts < 2)
        return false;
      const nearestPart = OverviewNavigation.previewNearestViewportCenter();
      const targetPart = nearestPart >= 1 ? nearestPart : _OverviewFade.getReturnPart(docLayer);
      _OverviewFade.fadeToPart(targetPart);
      return true;
    }
    return false;
  }
  // The slide to show when leaving the Overview: the slide viewed before entering
  // it, or the first normal slide when no valid previous slide is known.
  static getReturnPart(docLayer) {
    const previousPart = docLayer._prevSelectedPart;
    if (typeof previousPart === "number" && previousPart > 0 && previousPart < docLayer._parts)
      return previousPart;
    return 1;
  }
  static fadeToPart(part) {
    const map = app.map;
    const container = document.getElementById("document-container");
    if (part === 0)
      OverviewNavigation.requestLanding(app.map._docLayer._selectedPart);
    if (!container || window.L.Browser.cypressTest) {
      map.setPart(part);
      if (app.map._docLayer._selectedPart !== part)
        OverviewNavigation.requestLanding(-1);
      return;
    }
    _OverviewFade.inProgress = true;
    container.classList.add(_OverviewFade.fadeClass);
    _OverviewFade.runOpacityTransition(container, true, () => {
      map.setPart(part);
      if (app.map._docLayer._selectedPart !== part)
        OverviewNavigation.requestLanding(-1);
      let fadedIn = false;
      const fadeIn = () => {
        if (fadedIn)
          return;
        fadedIn = true;
        _OverviewFade.runOpacityTransition(container, false, () => {
          container.classList.remove(_OverviewFade.fadeClass);
          _OverviewFade.inProgress = false;
        });
      };
      map.once("setpart", fadeIn);
      setTimeout(fadeIn, _OverviewFade.setPartFallbackMs);
    });
  }
  // Fades the container out (toHidden true) or back in, and runs whenDone when the
  // opacity transition finishes. A timeout stands in for transitionend when the
  // event gets lost, for example because the container is not rendered.
  static runOpacityTransition(container, toHidden, whenDone) {
    let finished = false;
    const finish = () => {
      if (finished)
        return;
      finished = true;
      container.removeEventListener("transitionend", onTransitionEnd);
      whenDone();
    };
    const onTransitionEnd = (e) => {
      if (e.target === container && e.propertyName === "opacity")
        finish();
    };
    container.addEventListener("transitionend", onTransitionEnd);
    setTimeout(finish, _OverviewFade.transitionFallbackMs);
    container.classList.toggle(_OverviewFade.fadeOutClass, toHidden);
  }
};
_OverviewFade.fadeClass = "overview-fade";
_OverviewFade.fadeOutClass = "overview-fade-out";
_OverviewFade.transitionFallbackMs = 600;
_OverviewFade.setPartFallbackMs = 2e3;
_OverviewFade.inProgress = false;
let OverviewFade = _OverviewFade;
