const _TableInsertMarkerSection = class _TableInsertMarkerSection extends HTMLObjectSection {
  constructor(type, documentPosition) {
    super(_TableInsertMarkerSection.namePrefix + type, 0, 0, documentPosition, "table-add-col-row-marker", true);
    this.sectionProperties.markerType = type;
    this.sectionProperties.mouseEntered = false;
    const div = this.getHTMLObject();
    div.classList.add("table-add-col-row-marker");
  }
  onMouseEnter() {
    var _a;
    this.sectionProperties.mouseEntered = true;
    (_a = this.getHTMLObject()) == null ? void 0 : _a.classList.add("hovered");
    this.context.canvas.style.cursor = "pointer";
  }
  onMouseLeave() {
    var _a;
    this.sectionProperties.mouseEntered = false;
    (_a = this.getHTMLObject()) == null ? void 0 : _a.classList.remove("hovered");
  }
  onClick(point, e) {
    if (this.sectionProperties.markerType === "column") {
      app.socket.sendMessage("uno .uno:InsertColumnsAfter");
    } else {
      app.socket.sendMessage("uno .uno:InsertRowsAfter");
    }
  }
  getMarkerType() {
    return this.sectionProperties.markerType;
  }
  setMarkerSize(width, height) {
    this.size = [width * app.dpiScale, height * app.dpiScale];
    const container = this.getHTMLObject();
    if (container) {
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
    }
  }
};
_TableInsertMarkerSection.namePrefix = "TableInsertMarker_";
let TableInsertMarkerSection = _TableInsertMarkerSection;
