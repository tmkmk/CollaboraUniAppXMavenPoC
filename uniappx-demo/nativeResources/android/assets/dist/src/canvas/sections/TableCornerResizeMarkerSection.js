const _TableCornerResizeMarkerSection = class _TableCornerResizeMarkerSection extends HTMLObjectSection {
  constructor(documentPosition, size, offset) {
    super(_TableCornerResizeMarkerSection.sectionName, size, size, documentPosition, "table-corner-resize-marker", true);
    this.offset = offset;
    this.sectionProperties.dragStartPosition = null;
    this.sectionProperties.initialPosition = this.position.slice();
    this.sectionProperties.leftMost = 0;
    this.sectionProperties.topMost = 0;
  }
  offsetInCorePixels() {
    return this.offset * app.dpiScale;
  }
  /*
      The last column and the last row keep at least the width the resize markers keep between
      two borders, so the button stops that far right of the previous column border and that
      far below the previous row border.
  */
  calculateLimits() {
    Util.ensureValue(app.activeDocument);
    const tableMiddleware = app.activeDocument.tableMiddleware;
    const columns = tableMiddleware.currentTableData.columns;
    const rows = tableMiddleware.currentTableData.rows;
    const lastColumnBorder = columns.entries.length > 0 ? columns.entries[columns.entries.length - 1].position : columns.left;
    const lastRowBorder = rows.entries.length > 0 ? rows.entries[rows.entries.length - 1].position : rows.left;
    const margin = tableMiddleware.resizeMarkerMaxApproximation + this.offsetInCorePixels();
    this.sectionProperties.leftMost = (columns.tableOffset + lastColumnBorder) * app.twipsToPixels + margin;
    this.sectionProperties.topMost = (rows.tableOffset + lastRowBorder) * app.twipsToPixels + margin;
  }
  // The lower right corner of the table the button stands for, in twips.
  cornerPosition() {
    const offset = this.offsetInCorePixels();
    return [
      Math.round((this.position[0] - offset) * app.pixelsToTwips),
      Math.round((this.position[1] - offset) * app.pixelsToTwips)
    ];
  }
  onMouseEnter(point, e) {
    this.getHTMLObject().classList.add("hovered");
    this.context.canvas.style.cursor = "nwse-resize";
  }
  onMouseLeave(point, e) {
    this.sectionProperties.dragStartPosition = null;
    this.getHTMLObject().classList.remove("hovered");
  }
  onMouseDown(point, e) {
    this.sectionProperties.dragStartPosition = point;
    this.calculateLimits();
  }
  onMouseMove(point, dragDistance, e) {
    if (!this.containerObject.isDraggingSomething() || !this.sectionProperties.dragStartPosition)
      return;
    const x = Math.max(this.position[0] + point.pX - this.sectionProperties.dragStartPosition.pX, this.sectionProperties.leftMost);
    const y = Math.max(this.position[1] + point.pY - this.sectionProperties.dragStartPosition.pY, this.sectionProperties.topMost);
    this.setPosition(x, y);
    this.adjustHTMLObjectPosition();
    this.containerObject.requestReDraw();
  }
  onDragEnd() {
    Util.ensureValue(app.activeDocument);
    const tableMiddleware = app.activeDocument.tableMiddleware;
    const columns = tableMiddleware.currentTableData.columns;
    const rows = tableMiddleware.currentTableData.rows;
    const corner = this.cornerPosition();
    const width = corner[0] - (columns.tableOffset + columns.left);
    const height = corner[1] - (rows.tableOffset + rows.left);
    this.setPosition(this.sectionProperties.initialPosition[0], this.sectionProperties.initialPosition[1]);
    this.adjustHTMLObjectPosition();
    this.containerObject.requestReDraw();
    if (width <= 0 || height <= 0)
      return;
    app.map.sendUnoCommand(".uno:TransformDialog", {
      TransformWidth: { type: "long", value: width },
      TransformHeight: { type: "long", value: height }
    });
  }
  onMouseUp(point, e) {
    this.sectionProperties.dragStartPosition = null;
    if (this.containerObject.isDraggingSomething() && this.containerObject.targetSection === this.name)
      this.onDragEnd();
  }
  onDraw(frameCount, elapsedTime) {
    super.onDraw(frameCount, elapsedTime);
    if (!this.containerObject.isDraggingSomething() || this.containerObject.targetSection !== this.name)
      return;
    Util.ensureValue(app.activeDocument);
    const tableMiddleware = app.activeDocument.tableMiddleware;
    const left = tableMiddleware.getTableLeftX() - this.position[0];
    const top = tableMiddleware.getTableTopY() - this.position[1];
    const corner = -this.offsetInCorePixels();
    this.context.strokeStyle = "#3388FF";
    this.context.lineWidth = 2;
    this.context.beginPath();
    this.context.rect(left, top, corner - left, corner - top);
    this.context.stroke();
    this.context.closePath();
  }
};
_TableCornerResizeMarkerSection.sectionName = "TableCornerResizeMarker";
let TableCornerResizeMarkerSection = _TableCornerResizeMarkerSection;
