const _TableMiddleware = class _TableMiddleware {
  constructor() {
    this.currentTableData = {};
    this.lastTableMarkerJson = "";
    this.currentTableMarkerJson = "";
    this.tableResizeColumnMarkers = [];
    this.tableResizeRowMarkers = [];
    this.tableSelectionColumnMarkers = [];
    this.tableSelectionRowMarkers = [];
    this.tableInsertMarkers = [];
    this.tableCornerResizeMarker = null;
    this.resizeMarkerMaxApproximation = 10 * app.dpiScale;
    this.tableAnchorSection = null;
    this.tableMarkersDragged = false;
    this.resizeMarkerWidth = 0;
    this.resizeMarkerHeight = 0;
    this.selectionMarkerWidth = 24;
    this.selectionMarkerHeight = 24;
    this.addButtonWidth = 16;
    this.addButtonHeight = 16;
    this.addButtonOffset = 10;
    this.layoutsOnTheWay = new TableStatesOnTheWay((one, other) => ClassicTableContext.near(one ?? [], other ?? []), false);
  }
  setupTableOverlay() {
    app.map.on("messagesdone", this.updateTableMarkers, this);
    app.map.on("zoomend", this.onZoomForTableMarkers, this);
    this.initializeStyles();
  }
  hasTableSelection() {
    if (!this.currentTableData)
      return false;
    return this.currentTableData.rows != null || this.currentTableData.columns != null;
  }
  onZoomForTableMarkers() {
    this.lastTableMarkerJson = "";
    this.updateTableMarkers();
  }
  onTableSelectedMsg(txtMessage) {
    if (!app.map.isEditMode()) {
      this.clearTableMarkers();
      return;
    }
    if (this.tableMarkersDragged === true) {
      return;
    }
    txtMessage = txtMessage.substring("tableselected:".length + 1);
    const message = JSON.parse(txtMessage);
    if (this.layoutsOnTheWay.outdated(_TableMiddleware.bordersOf(message)))
      return;
    this.currentTableMarkerJson = txtMessage;
    this.currentTableData = message;
    if (this.currentTableData.columns && this.currentTableData.rows)
      this.ensureDataIntegrity();
    app.map.fire("resettopbottompagespacing", {
      disableMarker: this.hasTableSelection()
    });
  }
  initializeStyles() {
    const bodyElement = document.getElementsByTagName("body")[0];
    const element = document.createElement("div");
    element.className = "table-column-resize-marker";
    bodyElement.appendChild(element);
    const style = window.getComputedStyle(element, null);
    this.resizeMarkerWidth = parseInt(style.getPropertyValue("width").replace("px", ""));
    this.resizeMarkerHeight = parseInt(style.getPropertyValue("height").replace("px", ""));
    element.remove();
  }
  clearTableMarkers() {
    var markerIndex;
    for (markerIndex = 0; markerIndex < this.tableResizeColumnMarkers.length; markerIndex++) {
      app.sectionContainer.removeSection(this.tableResizeColumnMarkers[markerIndex].name);
    }
    this.tableResizeColumnMarkers = [];
    for (markerIndex = 0; markerIndex < this.tableResizeRowMarkers.length; markerIndex++) {
      app.sectionContainer.removeSection(this.tableResizeRowMarkers[markerIndex].name);
    }
    this.tableResizeRowMarkers = [];
    for (markerIndex = 0; markerIndex < this.tableSelectionColumnMarkers.length; markerIndex++) {
      app.sectionContainer.removeSection(this.tableSelectionColumnMarkers[markerIndex].name);
    }
    this.tableSelectionColumnMarkers = [];
    for (markerIndex = 0; markerIndex < this.tableSelectionRowMarkers.length; markerIndex++) {
      app.sectionContainer.removeSection(this.tableSelectionRowMarkers[markerIndex].name);
    }
    this.tableSelectionRowMarkers = [];
    for (markerIndex = 0; markerIndex < this.tableInsertMarkers.length; markerIndex++) {
      app.sectionContainer.removeSection(this.tableInsertMarkers[markerIndex].name);
    }
    this.tableInsertMarkers = [];
    if (this.tableCornerResizeMarker) {
      app.sectionContainer.removeSection(this.tableCornerResizeMarker.name);
      this.tableCornerResizeMarker = null;
    }
    if (this.tableAnchorSection) {
      app.sectionContainer.removeSection(this.tableAnchorSection.name);
      this.tableAnchorSection = null;
    }
  }
  addResizeMarker(markerType, x, y) {
    const position = new cool.SimplePoint(x, y);
    const index = markerType === "column" ? this.tableResizeColumnMarkers.length : this.tableResizeRowMarkers.length;
    const showSection = !(app.map._docLayer._docType === "presentation" && markerType === "column" && index === 0);
    const marker = new TableResizeMarkerSection("marker-" + String(_TableMiddleware.markerid++), this.resizeMarkerWidth, this.resizeMarkerHeight, position, markerType === "column" ? "table-column-resize-marker" : "table-row-resize-marker", markerType === "column" ? "column" : "row", index, showSection);
    app.sectionContainer.addSection(marker);
    if (markerType === "column")
      this.tableResizeColumnMarkers.push(marker);
    else
      this.tableResizeRowMarkers.push(marker);
    return marker;
  }
  addResizeMarkers() {
    if (!this.currentTableData.columns)
      return;
    const yForColumnMarkers = this.currentTableData.rows.tableOffset - (this.resizeMarkerHeight + this.selectionMarkerHeight) * app.dpiScale * app.pixelsToTwips;
    this.addResizeMarker("column", this.currentTableData.columns.tableOffset + this.currentTableData.columns.left - this.resizeMarkerWidth * 0.5 * app.pixelsToTwips * app.dpiScale, yForColumnMarkers);
    for (let i = 0; i < this.currentTableData.columns.entries.length; i++) {
      this.addResizeMarker("column", this.currentTableData.columns.tableOffset + this.currentTableData.columns.entries[i].position - this.resizeMarkerWidth * 0.5 * app.pixelsToTwips * app.dpiScale, yForColumnMarkers);
    }
    this.addResizeMarker("column", this.currentTableData.columns.tableOffset + this.currentTableData.columns.right - this.resizeMarkerWidth * 0.5 * app.pixelsToTwips * app.dpiScale, yForColumnMarkers);
    const xForRowMarkers = this.currentTableData.columns.tableOffset + this.currentTableData.columns.left - (this.resizeMarkerWidth + this.selectionMarkerWidth) * app.dpiScale * app.pixelsToTwips;
    for (let i = 0; i < this.currentTableData.rows.entries.length; i++) {
      this.addResizeMarker("row", xForRowMarkers, this.currentTableData.rows.tableOffset + this.currentTableData.rows.entries[i].position - this.resizeMarkerHeight * 0.5 * app.dpiScale * app.pixelsToTwips);
    }
    this.addResizeMarker("row", xForRowMarkers, this.currentTableData.rows.tableOffset + this.currentTableData.rows.right - this.resizeMarkerHeight * 0.5 * app.dpiScale * app.pixelsToTwips);
  }
  addSelectionMarker(markerType, x, y, width, height) {
    const position = new cool.SimplePoint(x, y);
    const marker = new TableSelectMarkerSection("marker-" + String(_TableMiddleware.markerid++), width, height, position, "table-select-marker " + (markerType === "column" ? "table-select-marker--column" : "table-select-marker--row"), markerType);
    app.sectionContainer.addSection(marker);
    if (markerType === "column")
      this.tableSelectionColumnMarkers.push(marker);
    else
      this.tableSelectionRowMarkers.push(marker);
    return marker;
  }
  addSelectionMarkers() {
    const columnsLength = this.currentTableData.columns.entries.length;
    const rowsLength = this.currentTableData.rows.entries.length;
    const yForColumnSelectionMarkers = this.currentTableData.rows.tableOffset - this.selectionMarkerHeight * app.dpiScale * app.pixelsToTwips;
    let firstSelectionMarkerWidth;
    if (columnsLength > 0)
      firstSelectionMarkerWidth = (this.currentTableData.columns.entries[0].position - this.currentTableData.columns.left) * app.twipsToPixels / app.dpiScale;
    else
      firstSelectionMarkerWidth = (this.currentTableData.columns.right - this.currentTableData.columns.left) * app.twipsToPixels / app.dpiScale;
    this.addSelectionMarker("column", this.currentTableData.columns.tableOffset + this.currentTableData.columns.left, yForColumnSelectionMarkers, firstSelectionMarkerWidth, this.selectionMarkerHeight);
    for (let i = 1; i < columnsLength; i++) {
      this.addSelectionMarker("column", this.currentTableData.columns.tableOffset + this.currentTableData.columns.entries[i - 1].position, yForColumnSelectionMarkers, (this.currentTableData.columns.entries[i].position - this.currentTableData.columns.entries[i - 1].position) * app.twipsToPixels / app.dpiScale, this.selectionMarkerHeight);
    }
    if (columnsLength > 0) {
      const lastSelectionMarkerWidth = (this.currentTableData.columns.right - this.currentTableData.columns.entries[columnsLength - 1].position) * app.twipsToPixels / app.dpiScale;
      this.addSelectionMarker("column", this.currentTableData.columns.tableOffset + this.currentTableData.columns.entries[columnsLength - 1].position, yForColumnSelectionMarkers, lastSelectionMarkerWidth, this.selectionMarkerHeight);
    }
    const xForRowlectionMarkers = this.currentTableData.columns.tableOffset + this.currentTableData.columns.left - this.selectionMarkerWidth * app.dpiScale * app.pixelsToTwips;
    let firstSelectionMarkerHeight;
    if (rowsLength > 0)
      firstSelectionMarkerHeight = (this.currentTableData.rows.entries[0].position - this.currentTableData.rows.left) * app.twipsToPixels / app.dpiScale;
    else
      firstSelectionMarkerHeight = (this.currentTableData.rows.right - this.currentTableData.rows.left) * app.twipsToPixels / app.dpiScale;
    this.addSelectionMarker("row", xForRowlectionMarkers, this.currentTableData.rows.tableOffset + this.currentTableData.rows.left, this.selectionMarkerWidth, firstSelectionMarkerHeight);
    for (let i = 1; i < this.currentTableData.rows.entries.length; i++) {
      this.addSelectionMarker("row", xForRowlectionMarkers, this.currentTableData.rows.tableOffset + this.currentTableData.rows.entries[i - 1].position, this.selectionMarkerWidth, (this.currentTableData.rows.entries[i].position - this.currentTableData.rows.entries[i - 1].position) * app.twipsToPixels / app.dpiScale);
    }
    if (rowsLength > 0) {
      this.addSelectionMarker("row", xForRowlectionMarkers, this.currentTableData.rows.tableOffset + this.currentTableData.rows.entries[this.currentTableData.rows.entries.length - 1].position, this.selectionMarkerWidth, (this.currentTableData.rows.right - this.currentTableData.rows.entries[this.currentTableData.rows.entries.length - 1].position) * app.twipsToPixels / app.dpiScale);
    }
  }
  addMoveMarker() {
    let x = parseInt(this.currentTableData.rectangle.x);
    let y = parseInt(this.currentTableData.rectangle.y);
    const anchorSize = ShapeHandleAnchorSubSection.tableAnchorIconSize;
    x -= Math.round(anchorSize[0] * app.pixelsToTwips);
    y -= Math.round(anchorSize[1] * app.pixelsToTwips);
    this.tableAnchorSection = new ShapeHandleAnchorSubSection(null, "table-anchor", anchorSize, new cool.SimplePoint(x, y), null);
    app.sectionContainer.addSection(this.tableAnchorSection);
  }
  /// The rows and columns of the table that is selected, as the server sends them, with numbers
  /// in place of the strings it may send. Absent while no table is selected.
  tableData() {
    return this.hasTableSelection() && this.currentTableData.rectangle ? this.currentTableData : void 0;
  }
  /*
      The borders of the columns and then of the rows of a table, in twips and the offsets
      included, from the data the server sends, where numbers may still be strings; nothing
      for no table.
  */
  static bordersOf(data) {
    if (!data || !data.columns || !data.rows)
      return null;
    const borders = (lines) => [lines.left].concat(Array.isArray(lines.entries) ? lines.entries.map((entry) => entry.position) : []).concat([lines.right]).map((at) => Number(lines.tableOffset) + Number(at));
    const columns = borders(data.columns);
    return [columns.length * 1e6].concat(columns, borders(data.rows));
  }
  /// Notes the rows and columns as they now are here, to be reported by the server.
  noteTheLayout() {
    this.layoutsOnTheWay.note(_TableMiddleware.bordersOf(this.tableData()));
  }
  /*
      Lays a border moved by this view on the rows and columns at once, so the markers stand
      where it went before the server reports the table again, and what it reports then counts:
      the border at that place in the list of borders, the outer ones included, moved by that
      much in twips. An inner border between columns moves alone, as the column beside it gives
      the room; an inner border between rows takes the rows below along; the outer one at the
      end makes the table larger or smaller.
  */
  moveBorderLocally(columns, at, offset) {
    const data = this.tableData();
    if (!data || !offset)
      return;
    const lines = columns ? data.columns : data.rows;
    const inner = lines.entries.length;
    if (at === inner + 1)
      lines.right += offset;
    else if (columns)
      lines.entries[at - 1].position += offset;
    else {
      for (let entry = at - 1; entry < inner; ++entry)
        lines.entries[entry].position += offset;
      lines.right += offset;
    }
    this.noteTheLayout();
    GraphicSelection.refreshLocalHandles();
  }
  /*
      Takes the columns, or the rows, from the first to the last out of the rows and columns at
      once, as deleting them does, so the markers stand where the lines are left before the
      server reports the table again: the ones after them move up by what was taken out, and the
      table shrinks by it. Deleting all of them deletes the table, which the server reports.
  */
  deleteLinesLocally(columns, from, to) {
    const data = this.tableData();
    if (!data)
      return;
    const lines = columns ? data.columns : data.rows;
    const borders = [lines.left].concat(lines.entries.map((entry) => entry.position)).concat([lines.right]);
    if (from <= 0 && to >= borders.length - 2)
      return;
    const taken = borders[to + 1] - borders[from];
    const left = borders.slice(0, from + 1).concat(borders.slice(to + 2).map((at) => at - taken));
    lines.entries = left.slice(1, -1).map((at, index) => ({
      ...lines.entries[index],
      position: at
    }));
    lines.right = left[left.length - 1];
    this.noteTheLayout();
    GraphicSelection.refreshLocalHandles();
  }
  updateMoveMarkerVisibility() {
    if (!RenderManager.isVectorRendering() && this.currentTableData && this.currentTableMarkerJson === this.lastTableMarkerJson && this.currentTableData.rows && this.currentTableData.columns && app.map.getDocType() === "presentation" && this.currentTableData.rectangle && !this.tableAnchorSection)
      this.addMoveMarker();
  }
  getTableTopY() {
    if (!this.currentTableData)
      return 0;
    else
      return Math.round((this.currentTableData.rows.tableOffset + this.currentTableData.rows.left) * app.twipsToPixels);
  }
  getTableBottomY() {
    if (!this.currentTableData)
      return 0;
    else
      return Math.round((this.currentTableData.rows.tableOffset + this.currentTableData.rows.right) * app.twipsToPixels);
  }
  getTableLeftX() {
    if (!this.currentTableData)
      return 0;
    else
      return Math.round((this.currentTableData.columns.tableOffset + this.currentTableData.columns.left) * app.twipsToPixels);
  }
  getTableRightX() {
    if (!this.currentTableData)
      return 0;
    else
      return Math.round((this.currentTableData.columns.tableOffset + this.currentTableData.columns.right) * app.twipsToPixels);
  }
  addInsertMarkers() {
    const insertColumnX = this.getTableRightX() * app.pixelsToTwips + this.addButtonOffset * app.dpiScale * app.pixelsToTwips;
    const insertColumnY = this.currentTableData.rows.tableOffset + this.currentTableData.rows.left;
    const insertColumnWidth = this.addButtonWidth;
    const insertColumnHeight = (this.currentTableData.rows.right - this.currentTableData.rows.left) * app.twipsToPixels / app.dpiScale;
    const insertColumnMarkerSection = new TableInsertMarkerSection("column", new cool.SimplePoint(insertColumnX, insertColumnY));
    insertColumnMarkerSection.setMarkerSize(insertColumnWidth, insertColumnHeight);
    app.sectionContainer.addSection(insertColumnMarkerSection);
    this.tableInsertMarkers.push(insertColumnMarkerSection);
    const insertRowX = this.currentTableData.columns.tableOffset + this.currentTableData.columns.left;
    const insertRowY = this.getTableBottomY() * app.pixelsToTwips + this.addButtonOffset * app.dpiScale * app.pixelsToTwips;
    const insertRowWidth = (this.currentTableData.columns.right - this.currentTableData.columns.left) * app.twipsToPixels / app.dpiScale;
    const insertRowHeight = this.addButtonHeight;
    const insertRowMarkerSection = new TableInsertMarkerSection("row", new cool.SimplePoint(insertRowX, insertRowY));
    insertRowMarkerSection.setMarkerSize(insertRowWidth, insertRowHeight);
    app.sectionContainer.addSection(insertRowMarkerSection);
    this.tableInsertMarkers.push(insertRowMarkerSection);
  }
  /*
      The button between the two insert markers, in the lower right corner. A table that is a
      shape of its own, as in Impress, comes with its rectangle and can be resized as a whole.
  */
  addCornerResizeMarker() {
    if (!this.currentTableData.rectangle)
      return;
    const offset = this.addButtonOffset * app.dpiScale * app.pixelsToTwips;
    const x = this.getTableRightX() * app.pixelsToTwips + offset;
    const y = this.getTableBottomY() * app.pixelsToTwips + offset;
    this.tableCornerResizeMarker = new TableCornerResizeMarkerSection(new cool.SimplePoint(x, y), this.addButtonWidth, this.addButtonOffset);
    app.sectionContainer.addSection(this.tableCornerResizeMarker);
  }
  ensureDataIntegrity() {
    for (const lines of [
      this.currentTableData.columns,
      this.currentTableData.rows
    ])
      if (!Array.isArray(lines.entries))
        lines.entries = [];
    this.currentTableData.columns.tableOffset = parseInt(this.currentTableData.columns.tableOffset);
    this.currentTableData.rows.tableOffset = parseInt(this.currentTableData.rows.tableOffset);
    this.currentTableData.columns.left = parseInt(this.currentTableData.columns.left);
    this.currentTableData.rows.left = parseInt(this.currentTableData.rows.left);
    this.currentTableData.columns.right = parseInt(this.currentTableData.columns.right);
    this.currentTableData.rows.right = parseInt(this.currentTableData.rows.right);
    for (let i = 0; i < this.currentTableData.columns.entries.length; i++) {
      this.currentTableData.columns.entries[i].max = parseInt(this.currentTableData.columns.entries[i].max);
      this.currentTableData.columns.entries[i].min = parseInt(this.currentTableData.columns.entries[i].min);
      this.currentTableData.columns.entries[i].position = parseInt(this.currentTableData.columns.entries[i].position);
    }
    for (let i = 0; i < this.currentTableData.rows.entries.length; i++) {
      this.currentTableData.rows.entries[i].max = parseInt(this.currentTableData.rows.entries[i].max);
      this.currentTableData.rows.entries[i].min = parseInt(this.currentTableData.rows.entries[i].min);
      this.currentTableData.rows.entries[i].position = parseInt(this.currentTableData.rows.entries[i].position);
    }
    if (this.currentTableData.rectangle) {
      this.currentTableData.rectangle.width = parseInt(this.currentTableData.rectangle.width);
      this.currentTableData.rectangle.height = parseInt(this.currentTableData.rectangle.height);
      this.currentTableData.rectangle.x = parseInt(this.currentTableData.rectangle.x);
      this.currentTableData.rectangle.y = parseInt(this.currentTableData.rectangle.y);
    }
  }
  updateTableMarkers() {
    if (this.currentTableData === void 0)
      return;
    if (this.lastTableMarkerJson === this.currentTableMarkerJson) {
      this.updateMoveMarkerVisibility();
      return;
    }
    this.lastTableMarkerJson = this.currentTableMarkerJson;
    this.clearTableMarkers();
    if (this.currentTableData && this.currentTableData.columns) {
      this.ensureDataIntegrity();
      if (RenderManager.isVectorRendering()) {
        GraphicSelection.refreshLocalHandles();
        return;
      }
      this.updateMoveMarkerVisibility();
      this.addResizeMarkers();
      this.addSelectionMarkers();
      this.addInsertMarkers();
      this.addCornerResizeMarker();
    }
  }
};
_TableMiddleware.markerid = 0;
let TableMiddleware = _TableMiddleware;
