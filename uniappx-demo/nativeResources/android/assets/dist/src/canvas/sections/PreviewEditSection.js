const _PreviewEditSection = class _PreviewEditSection extends CanvasSectionObject {
  constructor() {
    super(app.CSections.PreviewEdit.name);
    this.processingOrder = app.CSections.PreviewEdit.processingOrder;
    this.drawingOrder = app.CSections.PreviewEdit.drawingOrder;
    this.zIndex = app.CSections.PreviewEdit.zIndex;
    this.documentObject = true;
    this.boundToSection = app.CSections.Tiles.name;
    this.size = app.sectionContainer.getDocumentAnchorSection().size;
    this.sectionProperties.dragStart = null;
    this.sectionProperties.dragDelta = null;
    this.sectionProperties.resizeHandle = null;
    this.sectionProperties.cursorSet = false;
    this.sectionProperties.snapGuides = [];
    this.sectionProperties.strokeColor = getComputedStyle(document.documentElement).getPropertyValue("--color-primary") || "#0b87e7";
    this.sectionProperties.hatchColor = getComputedStyle(document.documentElement).getPropertyValue("--color-primary-darker") || "#095280";
  }
  static ensure() {
    if (!app.sectionContainer.doesSectionExist(app.CSections.PreviewEdit.name))
      app.sectionContainer.addSection(new _PreviewEditSection());
  }
  static remove() {
    if (app.sectionContainer.doesSectionExist(app.CSections.PreviewEdit.name))
      app.sectionContainer.removeSection(app.CSections.PreviewEdit.name);
  }
  // Grip centers for a marquee rectangle given in viewport core pixels.
  gripCenters(x, y, width, height) {
    return [
      { name: "nw", x, y },
      { name: "n", x: x + width / 2, y },
      { name: "ne", x: x + width, y },
      { name: "e", x: x + width, y: y + height / 2 },
      { name: "se", x: x + width, y: y + height },
      { name: "s", x: x + width / 2, y: y + height },
      { name: "sw", x, y: y + height },
      { name: "w", x, y: y + height / 2 }
    ];
  }
  // The grip under a section-local point, or null. Uses the marquee of the current
  // selection, not of an in-progress drag: grips are grabbed from rest.
  gripAt(pointX, pointY) {
    const selection = app.impress.previewShapeSelection;
    if (!selection)
      return null;
    const grips = this.gripCenters(this.viewportX(selection.pX1), this.viewportY(selection.pY1), selection.pWidth, selection.pHeight);
    for (const grip of grips) {
      if (Math.abs(pointX - grip.x) <= _PreviewEditSection.gripHitHalf && Math.abs(pointY - grip.y) <= _PreviewEditSection.gripHitHalf)
        return grip.name;
    }
    return null;
  }
  // The section is created while the document is already on screen, so it places itself
  // right away. Sections placed only by the next scroll stay invisible until then.
  onInitialize() {
    this.onNewDocumentTopLeft();
  }
  onNewDocumentTopLeft() {
    this.setPosition(app.activeDocument.activeLayout.viewedRectangle.pX1, app.activeDocument.activeLayout.viewedRectangle.pY1);
  }
  // Section-local coordinates are viewport core pixels: the document position minus the
  // scrolled-away part. The state rectangles arrive in document space, so every drawn or
  // hit-tested value goes through this shift first.
  viewportX(documentX) {
    return documentX - app.activeDocument.activeLayout.viewedRectangle.pX1;
  }
  viewportY(documentY) {
    return documentY - app.activeDocument.activeLayout.viewedRectangle.pY1;
  }
  // Snap a moved rectangle to the entered preview's edges and center lines. Both axes
  // snap independently; the nearest candidate within the tolerance wins. The matched
  // positions are recorded in snapGuides, one entry per axis that matched.
  snapMoveRectangle(rectangle) {
    this.sectionProperties.snapGuides = [];
    const mode = app.impress.previewEditMode;
    if (!mode.active || !mode.rectangle)
      return rectangle;
    const preview = mode.rectangle;
    const tolerance = Math.round(_PreviewEditSection.snapTolerancePx * app.pixelsToTwips);
    const snapAxis = (edges) => {
      let best = null;
      for (const edge of edges) {
        const offset = edge.target - edge.value;
        if (Math.abs(offset) <= tolerance && (!best || Math.abs(offset) < Math.abs(best.offset)))
          best = { offset, line: edge.target };
      }
      return best;
    };
    const horizontal = snapAxis([
      { value: rectangle.x1, target: preview.x1 },
      { value: rectangle.x2, target: preview.x2 },
      {
        value: rectangle.x1 + rectangle.width / 2,
        target: preview.x1 + preview.width / 2
      }
    ]);
    const vertical = snapAxis([
      { value: rectangle.y1, target: preview.y1 },
      { value: rectangle.y2, target: preview.y2 },
      {
        value: rectangle.y1 + rectangle.height / 2,
        target: preview.y1 + preview.height / 2
      }
    ]);
    let x1 = rectangle.x1;
    let y1 = rectangle.y1;
    if (horizontal) {
      x1 += horizontal.offset;
      this.sectionProperties.snapGuides.push({
        vertical: true,
        position: horizontal.line
      });
    }
    if (vertical) {
      y1 += vertical.offset;
      this.sectionProperties.snapGuides.push({
        vertical: false,
        position: vertical.line
      });
    }
    return new cool.SimpleRectangle(x1, y1, rectangle.width, rectangle.height);
  }
  // The selection rectangle with the in-progress drag applied, in canvas twips. A move
  // shifts the whole rectangle; a resize moves the edges the grip owns, keeping a minimum
  // size so the rectangle never inverts.
  currentDragRectangle() {
    const selection = app.impress.previewShapeSelection;
    if (!selection)
      return null;
    const delta = this.sectionProperties.dragDelta;
    if (!delta)
      return selection.clone();
    const ratio = app.pixelsToTwips;
    const deltaX = Math.round(delta[0] * ratio);
    const deltaY = Math.round(delta[1] * ratio);
    const handle = this.sectionProperties.resizeHandle;
    if (!handle)
      return this.snapMoveRectangle(new cool.SimpleRectangle(selection.x1 + deltaX, selection.y1 + deltaY, selection.width, selection.height));
    const minSize = _PreviewEditSection.minShapeTwips;
    let x1 = selection.x1;
    let y1 = selection.y1;
    let x2 = selection.x2;
    let y2 = selection.y2;
    if (handle.includes("w"))
      x1 = Math.min(x1 + deltaX, x2 - minSize);
    if (handle.includes("e"))
      x2 = Math.max(x2 + deltaX, x1 + minSize);
    if (handle === "n" || handle === "nw" || handle === "ne")
      y1 = Math.min(y1 + deltaY, y2 - minSize);
    if (handle === "s" || handle === "sw" || handle === "se")
      y2 = Math.max(y2 + deltaY, y1 + minSize);
    return new cool.SimpleRectangle(x1, y1, x2 - x1, y2 - y1);
  }
  // The entered preview carries a diagonally hatched band just outside its frame, the
  // same visual language the office suite uses for entering a group or an embedded
  // object in place. A selected shape keeps the plain dashed marquee, so the two
  // states read differently at a glance.
  drawEnteredFrame(rectangle) {
    const context = this.context;
    const band = 6;
    const step = 5;
    const x = this.viewportX(rectangle.pX1);
    const y = this.viewportY(rectangle.pY1);
    const outerX = x - band;
    const outerY = y - band;
    const outerWidth = rectangle.pWidth + 2 * band;
    const outerHeight = rectangle.pHeight + 2 * band;
    context.save();
    context.beginPath();
    context.rect(outerX, outerY, outerWidth, outerHeight);
    context.rect(x, y, rectangle.pWidth, rectangle.pHeight);
    context.clip("evenodd");
    context.strokeStyle = this.sectionProperties.hatchColor;
    context.lineWidth = 1.5;
    context.beginPath();
    for (let offset = -outerHeight; offset < outerWidth; offset += step) {
      context.moveTo(outerX + offset, outerY);
      context.lineTo(outerX + offset + outerHeight, outerY + outerHeight);
    }
    context.stroke();
    context.restore();
    context.beginPath();
    context.strokeStyle = this.sectionProperties.hatchColor;
    context.lineWidth = 1;
    context.strokeRect(x, y, rectangle.pWidth, rectangle.pHeight);
    context.closePath();
  }
  onDraw() {
    const mode = app.impress.previewEditMode;
    if (!mode.active || !mode.rectangle)
      return;
    this.drawEnteredFrame(mode.rectangle);
    this.context.strokeStyle = this.sectionProperties.strokeColor;
    this.context.lineWidth = 2;
    const dragRectangle = this.currentDragRectangle();
    if (dragRectangle) {
      const x = this.viewportX(dragRectangle.pX1);
      const y = this.viewportY(dragRectangle.pY1);
      this.context.beginPath();
      this.context.setLineDash([4, 3]);
      this.context.strokeRect(x, y, dragRectangle.pWidth, dragRectangle.pHeight);
      this.context.setLineDash([]);
      this.context.closePath();
      const moving = this.sectionProperties.dragDelta && !this.sectionProperties.resizeHandle;
      if (!moving) {
        this.context.fillStyle = this.sectionProperties.strokeColor;
        const half = _PreviewEditSection.gripHalf;
        for (const grip of this.gripCenters(x, y, dragRectangle.pWidth, dragRectangle.pHeight))
          this.context.fillRect(grip.x - half, grip.y - half, 2 * half, 2 * half);
      }
    }
    if (this.sectionProperties.dragDelta && this.sectionProperties.snapGuides.length && mode.rectangle) {
      const preview = mode.rectangle;
      this.context.beginPath();
      this.context.setLineDash([6, 4]);
      this.context.strokeStyle = this.sectionProperties.hatchColor;
      this.context.lineWidth = 1;
      for (const guide of this.sectionProperties.snapGuides) {
        const guidePixels = Math.round(guide.position * app.twipsToPixels);
        if (guide.vertical) {
          this.context.moveTo(this.viewportX(guidePixels), this.viewportY(preview.pY1));
          this.context.lineTo(this.viewportX(guidePixels), this.viewportY(preview.pY2));
        } else {
          this.context.moveTo(this.viewportX(preview.pX1), this.viewportY(guidePixels));
          this.context.lineTo(this.viewportX(preview.pX2), this.viewportY(guidePixels));
        }
      }
      this.context.stroke();
      this.context.setLineDash([]);
      this.context.closePath();
    }
  }
  onMouseDown(point, e) {
    if (e.type === "touchstart")
      return;
    const selection = app.impress.previewShapeSelection;
    if (!selection)
      return;
    const grip = this.gripAt(point.pX, point.pY);
    if (grip) {
      this.sectionProperties.resizeHandle = grip;
      this.sectionProperties.dragStart = [point.pX, point.pY];
      this.stopPropagating();
      e.stopPropagation();
      return;
    }
    if (point.pX >= this.viewportX(selection.pX1) && point.pX <= this.viewportX(selection.pX2) && point.pY >= this.viewportY(selection.pY1) && point.pY <= this.viewportY(selection.pY2)) {
      this.sectionProperties.dragStart = [point.pX, point.pY];
      this.stopPropagating();
      e.stopPropagation();
    }
  }
  onMouseMove(point, dragDistance, e) {
    if (e.type === "touchmove")
      return;
    if (!this.sectionProperties.dragStart) {
      this.updateHoverCursor(point);
      return;
    }
    if (!this.containerObject.isDraggingSomething() || this.containerObject.targetSection !== this.name)
      return;
    this.sectionProperties.dragDelta = [
      point.pX - this.sectionProperties.dragStart[0],
      point.pY - this.sectionProperties.dragStart[1]
    ];
    this.stopPropagating();
    e.stopPropagation();
    this.containerObject.requestReDraw();
  }
  // Resize cursors over the grips, a move cursor over the marquee body. Claiming the
  // cursor stops the current mousemove from propagating past this section.
  updateHoverCursor(point) {
    if (this.containerObject.isDraggingSomething())
      return;
    const selection = app.impress.previewShapeSelection;
    const grip = selection ? this.gripAt(point.pX, point.pY) : null;
    let cursor = "";
    if (grip)
      cursor = _PreviewEditSection.gripCursors[grip];
    else if (selection && point.pX >= this.viewportX(selection.pX1) && point.pX <= this.viewportX(selection.pX2) && point.pY >= this.viewportY(selection.pY1) && point.pY <= this.viewportY(selection.pY2))
      cursor = "move";
    if (cursor) {
      this.context.canvas.style.cursor = cursor;
      this.sectionProperties.cursorSet = true;
      this.stopPropagating();
    } else if (this.sectionProperties.cursorSet) {
      this.context.canvas.style.cursor = "";
      this.sectionProperties.cursorSet = false;
    }
  }
  onMouseUp(point, e) {
    if (e.type === "touchend")
      return;
    if (!this.sectionProperties.dragStart)
      return;
    const dropped = this.currentDragRectangle();
    const wasResize = !!this.sectionProperties.resizeHandle;
    const hadDelta = this.sectionProperties.dragDelta && (this.sectionProperties.dragDelta[0] !== 0 || this.sectionProperties.dragDelta[1] !== 0);
    this.sectionProperties.dragStart = null;
    this.sectionProperties.dragDelta = null;
    this.sectionProperties.resizeHandle = null;
    this.sectionProperties.snapGuides = [];
    if (!this.containerObject.isDraggingSomething() || this.containerObject.targetSection !== this.name)
      return;
    if (!dropped || !hadDelta)
      return;
    if (wasResize) {
      const slideRectangle = PreviewEditTransform.canvasRectangleToSlide(dropped);
      app.map.sendUnoCommand(".uno:MovePreviewShape", {
        X: { type: "long", value: String(slideRectangle.x1) },
        Y: { type: "long", value: String(slideRectangle.y1) },
        Width: { type: "long", value: String(slideRectangle.width) },
        Height: { type: "long", value: String(slideRectangle.height) }
      });
    } else {
      const centerX = dropped.x1 + dropped.width / 2;
      const centerY = dropped.y1 + dropped.height / 2;
      if (PreviewEditTransform.isInsideEnteredPreview(centerX, centerY)) {
        const slideRectangle = PreviewEditTransform.canvasRectangleToSlide(dropped);
        app.map.sendUnoCommand(".uno:MovePreviewShape", {
          X: { type: "long", value: String(slideRectangle.x1) },
          Y: { type: "long", value: String(slideRectangle.y1) },
          Width: { type: "long", value: String(slideRectangle.width) },
          Height: { type: "long", value: String(slideRectangle.height) }
        });
      } else {
        app.map.sendUnoCommand(".uno:MovePreviewShapeOut", {
          X: { type: "long", value: String(dropped.x1) },
          Y: { type: "long", value: String(dropped.y1) },
          Width: { type: "long", value: String(dropped.width) },
          Height: { type: "long", value: String(dropped.height) }
        });
      }
    }
    this.stopPropagating();
    e.stopPropagation();
  }
};
_PreviewEditSection.gripHalf = 4;
_PreviewEditSection.gripHitHalf = 7;
_PreviewEditSection.minShapeTwips = 100;
_PreviewEditSection.gripCursors = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize"
};
_PreviewEditSection.snapTolerancePx = 8;
let PreviewEditSection = _PreviewEditSection;
