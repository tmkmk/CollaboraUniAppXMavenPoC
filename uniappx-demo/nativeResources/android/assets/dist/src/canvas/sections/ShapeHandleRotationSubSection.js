const _ShapeHandleRotationSubSection = class _ShapeHandleRotationSubSection extends ShapeHandleSubSection {
  /*
      The rotate icon for the current theme, light or dark. A new one has not loaded yet, so
      the canvas is asked to draw again when loading ends, whether it worked or failed.
  */
  static getIcon() {
    const url = app.LOUtil.getImageURL("shape-rotate-handle.svg");
    const kept = _ShapeHandleRotationSubSection.icon;
    if (kept !== null && _ShapeHandleRotationSubSection.iconURL === url)
      return kept;
    const icon = new Image();
    const redraw = function() {
      app.sectionContainer.requestReDraw();
    };
    icon.src = url;
    icon.onload = redraw;
    icon.onerror = redraw;
    _ShapeHandleRotationSubSection.icon = icon;
    _ShapeHandleRotationSubSection.iconURL = url;
    return icon;
  }
  constructor(parentHandlerSection, sectionName, size, documentPosition, ownInfo) {
    super(parentHandlerSection, sectionName, size, documentPosition, ownInfo);
    this.sectionProperties.lastDraggingDistance = null;
    this.sectionProperties.cursorStyle = "url(" + app.LOUtil.getURL("images/cursors/rotate.svg") + ") 12 12, pointer";
    app.events.on("TextCursorVisibility", this.onTextCursorVisibility.bind(this));
  }
  /*
      Whether core sent this handle. Core gives every handle it sends a number, and the handle
      this side adds for a single selection has none.
  */
  isPerObjectHandle() {
    return this.sectionProperties.ownInfo.index !== void 0;
  }
  // Document position in twips of the pointer, from a point measured inside this handle.
  getPointerPosition(point) {
    const isRTL = app.map._docLayer.isCalcRTL();
    const pointerPosition = point.clone();
    pointerPosition.pX = isRTL ? this.position[0] - point.pX : this.position[0] + point.pX;
    pointerPosition.pY = point.pY + this.position[1];
    return pointerPosition;
  }
  calculateAngle(center, target) {
    let angle = Math.atan2(target.y - center.y, target.x - center.x);
    while (angle < 0)
      angle += 2 * Math.PI;
    while (angle > Math.PI * 2)
      angle -= Math.PI * 2;
    angle = angle * 180 / Math.PI;
    angle *= 100;
    return angle;
  }
  onMouseEnter(point, e) {
    this.context.canvas.style.cursor = this.sectionProperties.cursorStyle;
  }
  /*
      A plain circle the size of the handle, drawn while the rotate icon is still loading and
      for as long as it cannot be loaded at all. Dragging works with or without the icon, so
      the handle always shows something the user can grab.
  */
  drawCircle(addition) {
    this.context.fillStyle = "white";
    this.context.strokeStyle = "black";
    this.context.beginPath();
    this.context.arc(this.size[0] * 0.5 + addition, this.size[1] * 0.5, this.size[0] * 0.5, 0, Math.PI * 2);
    this.context.closePath();
    this.context.fill();
    this.context.stroke();
  }
  onDraw(frameCount, elapsedTime) {
    const addition = this.documentObject === true && app.map._docLayer.isCalcRTL() ? -this.size[0] : 0;
    const icon = _ShapeHandleRotationSubSection.getIcon();
    if (icon.complete && icon.naturalWidth > 0)
      this.context.drawImage(icon, addition, 0, this.size[0], this.size[1]);
    else
      this.drawCircle(addition);
  }
  // This is called after dragging the rotation handler. It re-calculates initial angle with the handler's new position.
  getAngleDifference() {
    const dragDistanceInTwips = [this.sectionProperties.lastDraggingDistance[0] * app.pixelsToTwips, this.sectionProperties.lastDraggingDistance[1] * app.pixelsToTwips];
    const draggedToPoint = new cool.SimplePoint(dragDistanceInTwips[0], dragDistanceInTwips[1]);
    draggedToPoint.pX += this.position[0] + this.size[0] * 0.5;
    draggedToPoint.pY += this.position[1] + this.size[1] * 0.5;
    Util.ensureValue(GraphicSelection.rectangle);
    const selectionCenter = new cool.SimplePoint(GraphicSelection.rectangle.center[0], GraphicSelection.rectangle.center[1]);
    const initialPoint = this.sectionProperties.ownInfo.initialPosition.clone();
    initialPoint.pX += this.size[0] * 0.5;
    initialPoint.pY += this.size[1] * 0.5;
    const initialAngle = this.calculateAngle(selectionCenter, initialPoint);
    const newAngle = this.calculateAngle(selectionCenter, draggedToPoint);
    return initialAngle - newAngle;
  }
  onMouseUp(point, e) {
    if (this.containerObject.isDraggingSomething()) {
      if (this.isPerObjectHandle()) {
        const pointerPosition = this.getPointerPosition(point);
        const commandParameters = {
          ...ShapeHandlesSection.handleParameters(this.sectionProperties.ownInfo),
          NewPosX: { type: "long", value: Math.round(pointerPosition.x) },
          NewPosY: { type: "long", value: Math.round(pointerPosition.y) }
        };
        app.map.sendUnoCommand(".uno:MoveShapeHandle", commandParameters);
        this.sectionProperties.parentHandlerSection.clearShapeDragPreview();
      } else if (this.sectionProperties.lastDraggingDistance) {
        Util.ensureValue(GraphicSelection.rectangle);
        const center = GraphicSelection.rectangle.center;
        const commandParameters = {
          "TransformRotationDeltaAngle": {
            "type": "long",
            "value": this.getAngleDifference()
          },
          "TransformRotationX": {
            "type": "long",
            "value": center[0]
          },
          "TransformRotationY": {
            "type": "long",
            "value": center[1]
          }
        };
        app.map.sendUnoCommand(".uno:TransformDialog ", commandParameters);
      }
      this.sectionProperties.parentHandlerSection.hideSVG();
    }
  }
  onMouseMove(position, distance) {
    if (!this.containerObject.isDraggingSomething()) {
      if (this.context.canvas.style.cursor !== this.sectionProperties.cursorStyle)
        this.context.canvas.style.cursor = this.sectionProperties.cursorStyle;
      return;
    }
    this.sectionProperties.lastDraggingDistance = distance;
    const parentHandlerSection = this.sectionProperties.parentHandlerSection;
    if (this.isPerObjectHandle()) {
      parentHandlerSection.requestShapeDragPreview(this.sectionProperties.ownInfo, this.getPointerPosition(position));
      return;
    }
    if (parentHandlerSection.sectionProperties.svg) {
      parentHandlerSection.sectionProperties.svg.style.opacity = 0.5;
      const angleDifference = -this.getAngleDifference() / 100;
      parentHandlerSection.sectionProperties.svg.style.transformOrigin = parentHandlerSection.getPictureRotationOrigin();
      parentHandlerSection.sectionProperties.svg.style.transform = "rotate(" + angleDifference + "deg)";
      this.containerObject.requestReDraw();
      parentHandlerSection.showSVG();
    }
  }
};
_ShapeHandleRotationSubSection.icon = null;
_ShapeHandleRotationSubSection.iconURL = null;
let ShapeHandleRotationSubSection = _ShapeHandleRotationSubSection;
app.definitions.shapeHandleRotationSubSection = ShapeHandleRotationSubSection;
