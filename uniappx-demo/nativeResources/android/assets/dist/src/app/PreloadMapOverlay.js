const _PreloadMapOverlay = class _PreloadMapOverlay {
  constructor() {
    this.redrawHandle = 0;
    this.boundOnChanged = this.onTileStateChanged.bind(this);
    this.canvas = document.createElement("canvas");
    this.canvas.id = "preload-map";
    document.getElementById("canvas-container").appendChild(this.canvas);
    this.context = this.canvas.getContext("2d");
    RenderManager.onTileStateChanged(this.boundOnChanged);
    app.events.on("viewmoved", this.boundOnChanged);
    app.map.on("zoomend resize updateparts setpart", this.boundOnChanged);
    this.onTileStateChanged();
  }
  destroy() {
    RenderManager.offTileStateChanged(this.boundOnChanged);
    app.events.off("viewmoved", this.boundOnChanged);
    app.map.off("zoomend resize updateparts setpart", this.boundOnChanged);
    if (this.redrawHandle)
      cancelAnimationFrame(this.redrawHandle);
    this.redrawHandle = 0;
    this.canvas.remove();
    this.canvas = null;
    this.context = null;
  }
  /// Coalesce every change landing before the next frame into one draw.
  onTileStateChanged() {
    if (this.redrawHandle)
      return;
    this.redrawHandle = requestAnimationFrame(() => {
      this.redrawHandle = 0;
      this.draw();
    });
  }
  /// How big a tile square is, which tile range each part shows, and where
  /// each part's block sits down the map.
  computeLayout() {
    const docLayer = app.map._docLayer;
    const ctx = docLayer._painter._paintContext();
    const tileRanges = ctx.paneBoundsList.map(RenderManager.pxBoundsToTileRange, RenderManager);
    const viewRange = tileRanges.length == 4 ? tileRanges[3] : tileRanges[0];
    const tileRange = new cool.Bounds(viewRange.min, viewRange.max);
    const viewWidth = Math.floor((app.sectionContainer.getWidth() + RenderManager.tileSize - 1) / RenderManager.tileSize);
    const viewHeight = Math.floor((app.sectionContainer.getHeight() + RenderManager.tileSize - 1) / RenderManager.tileSize);
    let sizePix = 3;
    let numParts = 1;
    let enlargeX = 0.1;
    let enlargeY = 2;
    let mainYMultiply = 10;
    if (docLayer.isCalc()) {
      enlargeX = 2;
      enlargeY = 2;
      sizePix = 6;
      numParts = 3;
      mainYMultiply = 2;
    } else if (docLayer.isImpress()) {
      enlargeX = 0.5;
      enlargeY = 0.5;
      mainYMultiply = 0;
      sizePix = 6;
      numParts = 7;
    }
    sizePix = Math.round(sizePix * app.dpiScale) / app.dpiScale;
    tileRange.min.x = tileRange.min.x - Math.floor(viewWidth * enlargeX);
    tileRange.max.x = tileRange.max.x + Math.floor(viewWidth * enlargeX);
    tileRange.min.y = tileRange.min.y - Math.floor(viewHeight * enlargeY);
    tileRange.max.y = tileRange.max.y + Math.floor(viewHeight * enlargeY);
    const preParts = (numParts - 1) / 2;
    const parts = [];
    let voffset = 0;
    for (let i = 0; i < numParts; ++i) {
      const range = new cool.Bounds(tileRange.min, tileRange.max);
      if (i === preParts) {
        range.min.y -= viewHeight * mainYMultiply;
        range.max.y += viewHeight * mainYMultiply;
      }
      parts.push({
        part: docLayer.getPartFromIndex(docLayer._selectedPart + i - preParts),
        range,
        voffset
      });
      voffset += sizePix * (range.max.y - range.min.y + 4);
    }
    return {
      sizePix,
      viewRange,
      viewWidth,
      viewHeight,
      parts,
      width: (tileRange.max.x - tileRange.min.x + 1) * sizePix,
      height: voffset
    };
  }
  /// Place the element where the document starts, and size the backing store
  /// for the device pixel ratio. Drawing then works in CSS pixels.
  place(layout) {
    const scale = app.dpiScale;
    const anchor = app.activeDocument.activeLayout.documentAnchorPosition;
    const style = this.canvas.style;
    style.left = anchor[0] / scale + _PreloadMapOverlay.originX + "px";
    style.top = anchor[1] / scale + _PreloadMapOverlay.originY + "px";
    style.width = layout.width + "px";
    style.height = layout.height + "px";
    const width = Math.round(layout.width * scale);
    const height = Math.round(layout.height * scale);
    if (this.canvas.width !== width)
      this.canvas.width = width;
    if (this.canvas.height !== height)
      this.canvas.height = height;
    this.context.setTransform(scale, 0, 0, scale, 0, 0);
    this.context.clearRect(0, 0, layout.width, layout.height);
  }
  draw() {
    if (!app.map || !app.map._docLayer)
      return;
    Util.ensureValue(app.activeDocument);
    const docLayer = app.map._docLayer;
    const zoom = Math.round(app.map.getZoom());
    const layout = this.computeLayout();
    const canvas = this.context;
    this.place(layout);
    const sizePix = layout.sizePix;
    for (const partLayout of layout.parts) {
      const range = partLayout.range;
      for (let j = range.min.y; j <= range.max.y; ++j) {
        for (let i = range.min.x; i <= range.max.x; ++i) {
          if (i >= 0 && j >= 0 && partLayout.part) {
            const coords = new TileCoordData(i * RenderManager.tileSize, j * RenderManager.tileSize, zoom, partLayout.part, app.activeDocument.activeModes[0]);
            const tile = RenderManager.get(coords);
            if (!tile)
              canvas.fillStyle = "rgba(128, 128, 128, 0.5)";
            else if (!tile.hasContent())
              canvas.fillStyle = "rgba(255, 0, 0, 0.8)";
            else if (tile.needsFetch())
              canvas.fillStyle = "rgba(255, 255, 0, 0.8)";
            else if (!tile.image)
              canvas.fillStyle = "rgba(0, 96, 0, 0.8)";
            else if (tile.distanceFromView <= 0)
              canvas.fillStyle = "rgba(0, 255, 0, 0.5)";
            else {
              const expFactor = RenderManager.getExpiryFactor(tile);
              if (expFactor >= 0)
                canvas.fillStyle = "rgba(0, " + Math.round(192 * (1 - expFactor)) + ", " + Math.round(96 * expFactor) + ", 0.8)";
            }
          } else
            canvas.fillStyle = "rgba(0, 0, 0, 0.3)";
          canvas.fillRect((i - range.min.x) * sizePix, (j - range.min.y) * sizePix + partLayout.voffset, sizePix, sizePix);
        }
      }
      if (partLayout.part === docLayer.getSelectedPart()) {
        canvas.strokeStyle = "rgba(0, 0, 0, 0.5)";
        canvas.lineWidth = 1;
        canvas.strokeRect((layout.viewRange.min.x - range.min.x) * sizePix, (layout.viewRange.min.y - range.min.y) * sizePix + partLayout.voffset, layout.viewWidth * sizePix, layout.viewHeight * sizePix);
      }
    }
  }
};
_PreloadMapOverlay.originX = 50;
_PreloadMapOverlay.originY = 200;
let PreloadMapOverlay = _PreloadMapOverlay;
app.definitions.preloadMapOverlay = PreloadMapOverlay;
