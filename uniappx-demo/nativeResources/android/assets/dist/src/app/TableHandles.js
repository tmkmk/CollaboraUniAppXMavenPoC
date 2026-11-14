const _TableHandles = class _TableHandles extends HandleGroup {
  constructor() {
    super(...arguments);
    this.name = "table";
  }
  /// The rows and columns of the selected table, where the selection is one table.
  data() {
    var _a;
    const objects = this.selection.selectedObjects();
    if (objects.length !== 1 || ((_a = RenderGeometrySection.objectOf(objects[0])) == null ? void 0 : _a.objectKind) !== _TableHandles.tableKind)
      return void 0;
    return ClassicTableContext.data();
  }
  isShown() {
    return RenderManager.isVectorRendering() && !!this.data();
  }
  // a length in CSS pixels, in twips
  static twips(cssPixels) {
    return cssPixels * app.dpiScale * app.pixelsToTwips;
  }
  // how far out of the table the eight reach, in twips, with the air beyond them
  static clear() {
    return (HandleLook.distanceTheEightMoveOut() + HandleLook.widthOf("framing") * 0.5) * app.pixelsToTwips + _TableHandles.twips(_TableHandles.gap);
  }
  // how far out of the table the middle of a select square and of a border marker stand
  static selectOut() {
    return _TableHandles.clear() + _TableHandles.twips(_TableHandles.selectSize * 0.5);
  }
  // the size of a border marker, in CSS pixels
  static borderSize() {
    return HandleLook.markerLook("table-column-resize-marker").width || _TableHandles.borderSizeByDefault;
  }
  static borderOut() {
    return _TableHandles.clear() + _TableHandles.twips(_TableHandles.selectSize + _TableHandles.gap + _TableHandles.borderSize() * 0.5);
  }
  static insertOut() {
    return _TableHandles.clear() + _TableHandles.twips(_TableHandles.insertWidth * 0.5);
  }
  handles() {
    const data = this.data();
    if (!data || !RenderManager.isVectorRendering())
      return [];
    const handles = [];
    const add = (name, kind, x, y, reach) => handles.push({
      name: "table." + name,
      kind,
      pointer: "0",
      point: new cool.Point(x, y).round(),
      reach: reach ? new cool.Point(reach.x * app.twipsToPixels, reach.y * app.twipsToPixels) : void 0
    });
    const table = ClassicTableContext.layout(data);
    const select = _TableHandles.selectOut();
    const border = _TableHandles.borderOut();
    for (let at = 0; at + 1 < table.columns.length; ++at)
      add(
        "columnSelect." + at,
        _TableHandles.columnSelect,
        (table.columns[at] + table.columns[at + 1]) * 0.5,
        table.top - select,
        // the whole strip above the column, as in the tiled view
        new cool.Point((table.columns[at + 1] - table.columns[at]) * 0.5, _TableHandles.twips(_TableHandles.selectSize))
      );
    for (let at = 0; at + 1 < table.rows.length; ++at)
      add("rowSelect." + at, _TableHandles.rowSelect, table.left - select, (table.rows[at] + table.rows[at + 1]) * 0.5, new cool.Point(_TableHandles.twips(_TableHandles.selectSize), (table.rows[at + 1] - table.rows[at]) * 0.5));
    const marker = _TableHandles.twips(_TableHandles.borderSize() * 0.5);
    const markerReach = new cool.Point(marker, marker);
    table.columns.forEach((x, at) => {
      if (at > 0)
        add("columnBorder." + at, _TableHandles.columnBorder, x, table.top - border, markerReach);
    });
    table.rows.forEach((y, at) => {
      if (at > 0)
        add("rowBorder." + at, _TableHandles.rowBorder, table.left - border, y, markerReach);
    });
    const insert = _TableHandles.insertOut();
    add(
      "insertColumn",
      _TableHandles.insertColumn,
      table.right + insert,
      (table.top + table.bottom) * 0.5,
      // the whole bar
      new cool.Point(_TableHandles.twips(_TableHandles.insertWidth * 0.5), (table.bottom - table.top) * 0.5)
    );
    add("insertRow", _TableHandles.insertRow, (table.left + table.right) * 0.5, table.bottom + insert, new cool.Point((table.right - table.left) * 0.5, _TableHandles.twips(_TableHandles.insertWidth * 0.5)));
    const anchor = _TableHandles.twips(_TableHandles.anchorSize * 0.5);
    add("anchor", _TableHandles.anchor, table.left - border, table.top - border, new cool.Point(anchor, anchor));
    return handles;
  }
  /// The markers stand outside the table, inside the band of a group the table stands in.
  extendsTheBand() {
    return true;
  }
  /*
      A press inside the cells is the table's, a little inside its edge, as the edge moves the
      table: it selects cells by a drag, and a click goes on to the engine, which edits the
      cell. A press on a marker is taken before as one on a handle.
  */
  takesAPress(x, y) {
    const data = this.data();
    if (!data || !this.isShown())
      return false;
    const table = ClassicTableContext.layout(data);
    const edge = _TableHandles.twips(_TableHandles.gap);
    const from = new cool.SimplePoint(table.left + edge, table.top + edge);
    const to = new cool.SimplePoint(table.right - edge, table.bottom - edge);
    return x >= from.vX && x <= to.vX && y >= from.vY && y <= to.vY;
  }
  /// The border markers and the anchor are dragged, the select squares and the insert bars are
  /// clicked.
  dragsTheHandle(handle) {
    return handle.kind === _TableHandles.columnBorder || handle.kind === _TableHandles.rowBorder || handle.kind === _TableHandles.anchor;
  }
  /// A drag that starts in the cells selects cells, once it reaches another cell.
  interactionForThePlace(at) {
    const context = Interaction.context();
    return context instanceof ClassicTableContext ? new TableCellsDrag(this.selection, at, context) : null;
  }
  /// Shift and a click in the cells extend the selection of cells to the clicked one.
  answersTheClick(at, modifier) {
    if (modifier !== app.UNOModifier.SHIFT)
      return false;
    const context = Interaction.context();
    return context instanceof ClassicTableContext && context.extendCellsTo(at.x, at.y);
  }
  /*
      A click on a select square selects the cells of its column or row alone; a click on the
      one selected alone takes the selection away again. With Shift
      only that column or row changes: next to the selection it joins it, at its edge it
      leaves it, as cells are selected as one rectangle. A click on a bar adds a column or a
      row after the one the cursor stands in.
  */
  letGoWhereItWasPressed(handle, event) {
    this.act(handle, (event == null ? void 0 : event.shiftKey) === true);
  }
  /// Return and Space do what a click does; Delete on a select square deletes its column or
  /// row, with the others selected beside it.
  pressByKey(handle, event) {
    const columns = handle.kind === _TableHandles.columnSelect;
    if (event.key === "Delete" && (columns || handle.kind === _TableHandles.rowSelect)) {
      const context = Interaction.context();
      if (!(context instanceof ClassicTableContext))
        return false;
      context.deleteLines(columns, Number(handle.name.split(".")[2]));
      return true;
    }
    if (event.key !== "Enter" && event.key !== " ")
      return false;
    this.act(handle, event.shiftKey);
    return true;
  }
  act(handle, extending) {
    if (!this.data())
      return;
    const at = Number(handle.name.split(".")[2]);
    const isLine = handle.kind === _TableHandles.columnSelect || handle.kind === _TableHandles.rowSelect;
    if (isLine) {
      const context = Interaction.context();
      if (context instanceof ClassicTableContext)
        context.selectLine(handle.kind === _TableHandles.columnSelect, at, extending);
      return;
    }
    if (handle.kind === _TableHandles.insertColumn)
      app.socket.sendMessage("uno .uno:InsertColumnsAfter");
    else if (handle.kind === _TableHandles.insertRow)
      app.socket.sendMessage("uno .uno:InsertRowsAfter");
  }
  /*
      The arrow keys along a border marker move its border a step, as a drag does, kept between
      the borders beside it: left and right for a border between columns, up and down for one
      between rows. Answers where the marker lands.
  */
  moveBorderByKey(handle, towards, event) {
    const data = this.data();
    if (!data)
      return null;
    const columns = handle.kind === _TableHandles.columnBorder;
    const along = columns ? towards.x : towards.y;
    if (!along)
      return null;
    const table = ClassicTableContext.layout(data);
    const lines = columns ? table.columns : table.rows;
    const at = Number(handle.name.split(".")[2]);
    const limits = TableBorderDrag.limits(lines, at);
    const place = Math.min(limits.high, Math.max(limits.low, lines[at] + along * HandleTravel.stepFor(event)));
    TableBorderDrag.moveBorder(columns, at, at === lines.length - 1, Math.round(place - lines[at]));
    return columns ? new cool.Point(place, handle.point.y) : new cool.Point(handle.point.x, place);
  }
  /// The arrow keys on the anchor, a select square or a bar move the table, as they move a
  /// selection; on a border marker they move the border.
  moveByKey(handle, towards, event) {
    if (handle.kind === _TableHandles.columnBorder || handle.kind === _TableHandles.rowBorder)
      return this.moveBorderByKey(handle, towards, event);
    this.selection.moveByKey(towards, event);
    const step = HandleTravel.stepFor(event);
    return new cool.Point(handle.point.x + towards.x * step, handle.point.y + towards.y * step);
  }
  /// A drag of the anchor moves the table, as a drag of the table itself does; a drag of a
  /// border marker moves that border.
  interactionFor(handle, at) {
    if (handle.kind === _TableHandles.columnBorder || handle.kind === _TableHandles.rowBorder) {
      const data = this.data();
      return data ? new TableBorderDrag(this.selection, handle, ClassicTableContext.layout(data)) : null;
    }
    if (handle.kind !== _TableHandles.anchor || !ObjectHandles.canBeMoved(this.selection.selectedObjects()))
      return null;
    return new MovingInteraction(this.selection, at);
  }
  /*
      Draws the picture of the marker and lays no shape: the picture is the whole look of the
      marker, as in the tiled view. Under the mouse and under the keyboard it grows as the eight
      do, so the one the keyboard is on blinks as they do; it then shows the picture the tiled
      view shows under the mouse.
  */
  shape(context, handle, at, grown) {
    const t = _TableHandles;
    const draw = (className, size, underMouse = "lit") => HandleLook.drawMarker(context, className, at, size, grown, {
      underMouse
    });
    switch (handle.kind) {
      case t.columnSelect:
      case t.rowSelect:
        draw("table-select-marker", t.selectSize);
        break;
      case t.columnBorder:
        draw("table-column-resize-marker", t.borderSize(), "drag");
        break;
      case t.rowBorder:
        draw("table-row-resize-marker", t.borderSize(), "drag");
        break;
      case t.insertColumn:
      case t.insertRow:
        draw("table-add-col-row-marker", t.plusSize, "usual");
        break;
      case t.anchor:
        draw("table-move-marker", t.anchorSize);
        break;
    }
    return "transparent";
  }
  /*
      Under the markers: the dashed line along the select squares of the columns and of the
      rows, and the two bars that add a column and a row, as the tiled view draws them.
  */
  paint(section, _shown) {
    const data = this.data();
    if (!data || !this.isShown())
      return;
    const t = _TableHandles;
    const table = ClassicTableContext.layout(data);
    const select = t.selectOut();
    const corner = (x, y) => new cool.SimplePoint(x, y);
    const context = section.context;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    const dragged = TableBorderDrag.running;
    if (dragged) {
      const from = dragged.columns ? corner(dragged.place, table.top) : corner(table.left, dragged.place);
      const to = dragged.columns ? corner(dragged.place, table.bottom) : corner(table.right, dragged.place);
      context.strokeStyle = "#3388FF";
      context.lineWidth = 2 * app.dpiScale;
      context.beginPath();
      context.moveTo(from.vX, from.vY);
      context.lineTo(to.vX, to.vY);
      context.stroke();
    }
    context.strokeStyle = "lightgray";
    context.lineWidth = app.dpiScale;
    context.setLineDash([3 * app.dpiScale, 3 * app.dpiScale]);
    context.beginPath();
    const columnsFrom = corner(table.left, table.top - select);
    const columnsTo = corner(table.right, table.top - select);
    context.moveTo(columnsFrom.vX, columnsFrom.vY);
    context.lineTo(columnsTo.vX, columnsTo.vY);
    const rowsFrom = corner(table.left - select, table.top);
    const rowsTo = corner(table.left - select, table.bottom);
    context.moveTo(rowsFrom.vX, rowsFrom.vY);
    context.lineTo(rowsTo.vX, rowsTo.vY);
    context.stroke();
    context.setLineDash([]);
    const look = getComputedStyle(document.body);
    const colour = (name) => look.getPropertyValue(name).trim() || "lightgray";
    const hovered = section.hoveredHandle();
    const bar = t.twips(t.insertWidth);
    const out = t.clear();
    const radius = 4 * app.dpiScale;
    for (const [name, x, y, width, height] of [
      [
        "table.insertColumn",
        table.right + out,
        table.top,
        bar,
        table.bottom - table.top
      ],
      [
        "table.insertRow",
        table.left,
        table.bottom + out,
        table.right - table.left,
        bar
      ]
    ]) {
      context.fillStyle = colour(hovered === name ? "--color-insert-marker-background-dark" : "--color-insert-marker-background");
      const size = ShapeHandlesSection.handleSize();
      const grown = section.travel.showsAsActive(name) ? size / 3 : hovered === name ? size / 8 : 0;
      const from = corner(x, y);
      const to = corner(x + width, y + height);
      context.beginPath();
      context.roundRect(from.vX - grown, from.vY - grown, to.vX - from.vX + 2 * grown, to.vY - from.vY + 2 * grown, radius);
      context.fill();
    }
    context.restore();
  }
};
_TableHandles.tableKind = 35;
_TableHandles.columnSelect = "tableColumnSelect";
_TableHandles.rowSelect = "tableRowSelect";
_TableHandles.columnBorder = "tableColumnBorder";
_TableHandles.rowBorder = "tableRowBorder";
_TableHandles.insertColumn = "tableInsertColumn";
_TableHandles.insertRow = "tableInsertRow";
_TableHandles.anchor = "tableAnchor";
_TableHandles.selectSize = 12;
_TableHandles.borderSizeByDefault = 32;
_TableHandles.insertWidth = 16;
_TableHandles.plusSize = 16;
_TableHandles.anchorSize = 20;
_TableHandles.gap = 4;
let TableHandles = _TableHandles;
