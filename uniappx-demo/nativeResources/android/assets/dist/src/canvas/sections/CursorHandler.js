const _CursorHandler = class _CursorHandler extends HTMLObjectSection {
  constructor() {
    super(app.CSections.CursorHandler.name, _CursorHandler.objectWidth, _CursorHandler.objectHeight, new cool.SimplePoint(0, 0), "cursor-handler", false);
    this.sectionProperties.lastPosition = null;
  }
  onMouseMove(point, dragDistance, e) {
    if (this.containerObject.isDraggingSomething() && this.containerObject.targetSection === this.name) {
      this.stopPropagating();
      e.stopPropagation();
      if (!this.sectionProperties.lastPosition)
        this.sectionProperties.lastPosition = this.position.slice();
      else {
        this.setPosition(this.sectionProperties.lastPosition[0] + dragDistance[0], this.sectionProperties.lastPosition[1] + dragDistance[1]);
      }
    }
  }
  onMouseUp(point, e) {
    if (this.containerObject.isDraggingSomething() && this.containerObject.targetSection === this.name) {
      app.map._docLayer._postMouseEvent("buttondown", Math.round(this.position[0] * app.pixelsToTwips), Math.round(this.position[1] * app.pixelsToTwips), 1, 1, 0);
      app.map._docLayer._postMouseEvent("buttonup", Math.round(this.position[0] * app.pixelsToTwips), Math.round(this.position[1] * app.pixelsToTwips), 1, 1, 0);
      this.moveUnderCaret();
    }
    this.sectionProperties.lastPosition = null;
  }
  // Place the handle directly below the text cursor.
  moveUnderCaret() {
    Util.ensureValue(app.file.textCursor.rectangle);
    this.setPosition(app.file.textCursor.rectangle.pX1, app.file.textCursor.rectangle.pY2);
  }
  setOpacity(value) {
    this.getHTMLObject().style.opacity = value;
  }
};
_CursorHandler.objectWidth = 30;
_CursorHandler.objectHeight = 44;
let CursorHandler = _CursorHandler;
