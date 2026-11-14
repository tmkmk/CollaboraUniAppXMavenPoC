const _TextSelections = class _TextSelections {
  // Is there a text selection or not.
  static initiate() {
    this.start = new TextSelectionHandle("selection_start_handle", 30, 44, new cool.SimplePoint(0, 0), "text-selection-handle-start", false);
    this.end = new TextSelectionHandle("selection_end_handle", 30, 44, new cool.SimplePoint(0, 0), "text-selection-handle-end", false);
    app.sectionContainer.addSection(this.start);
    app.sectionContainer.addSection(this.end);
  }
  static deactivate() {
    if (!this.active)
      return;
    this.active = false;
    app.map.fire("textselectionchange", { active: this.active });
    this.start.setShowSection(false);
    this.end.setShowSection(false);
    app.sectionContainer.requestReDraw();
  }
  static activate() {
    if (this.active)
      return;
    this.active = true;
    app.map.fire("textselectionchange", { active: this.active });
    this.refreshHandles();
  }
  // Cell handles on a formula reference stand in for the text handles.
  static handlesWanted() {
    return this.active && this.startRectangle !== null && this.endRectangle !== null && app.map._docLayer.getReferencesOnSheet().length === 0;
  }
  static refreshHandles() {
    if (!this.start)
      return;
    const shown = this.handlesWanted();
    this.start.setShowSection(shown);
    this.end.setShowSection(shown);
    if (shown)
      this.updateMarkers();
    else
      app.sectionContainer.requestReDraw();
  }
  static isActive() {
    return this.active;
  }
  static showHandles() {
    if (this.start.isSectionShown())
      this.start.setOpacity(1);
    if (this.end.isSectionShown())
      this.end.setOpacity(1);
  }
  static hideHandles() {
    if (this.start.isSectionShown())
      this.start.setOpacity(0);
    if (this.end.isSectionShown())
      this.end.setOpacity(0);
  }
  static getStartRectangle() {
    return this.startRectangle ? this.startRectangle.clone() : null;
  }
  static getEndRectangle() {
    return this.endRectangle ? this.endRectangle.clone() : null;
  }
  static setStartRectangle(rectangle) {
    this.startRectangle = rectangle;
    this.updateMarkers();
  }
  static setEndRectangle(rectangle) {
    this.endRectangle = rectangle;
    this.updateMarkers();
  }
  static updateMarkers() {
    if (!this.isActive())
      return;
    if (this.startRectangle === null || this.endRectangle === null)
      return;
    var startPos = { x: this.startRectangle.pX1, y: this.startRectangle.pY2 };
    var endPos = { x: this.endRectangle.pX1, y: this.endRectangle.pY2 };
    if (app.map._docLayer.isCalcRTL()) {
      Util.ensureValue(app.activeDocument);
      startPos.x = app.activeDocument.activeLayout.viewedRectangle.pX2 - (startPos.x - app.activeDocument.activeLayout.viewedRectangle.pX1);
      endPos.x = app.activeDocument.activeLayout.viewedRectangle.pX2 - (endPos.x - app.activeDocument.activeLayout.viewedRectangle.pX1);
    }
    const oldStart = this.start.getPosition();
    const oldEnd = this.end.getPosition();
    startPos.x -= 30 * app.dpiScale;
    this.start.setPosition(startPos.x, startPos.y);
    const newStart = this.start.getPosition();
    this.end.setPosition(endPos.x, endPos.y);
    const newEnd = this.end.getPosition();
    if (app.map._docLayer.isCalcRTL() && (newStart.y < newEnd.y || newStart.y <= newEnd.y && newStart.x < newEnd.x)) {
      this.start.setPosition(newEnd.pX, newEnd.pY);
      this.end.setPosition(newStart.pX, newStart.pY);
    } else if (!app.map._docLayer.isCalcRTL() && (oldEnd.distanceTo(newStart.toArray()) < 20 || oldStart.distanceTo(newEnd.toArray()) < 20)) {
      this.switchStartEndHandles();
    }
    app.sectionContainer.requestReDraw();
  }
  static switchStartEndHandles() {
    const temp = this.start;
    this.start = this.end;
    this.end = temp;
  }
  static dispose() {
    app.sectionContainer.removeSection(this.start.name);
    app.sectionContainer.removeSection(this.end.name);
  }
};
_TextSelections.startRectangle = null;
_TextSelections.endRectangle = null;
_TextSelections.active = false;
let TextSelections = _TextSelections;
window.TextSelections = TextSelections;
