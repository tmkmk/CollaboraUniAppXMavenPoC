const _TableStatesOnTheWay = class _TableStatesOnTheWay {
  /*
      The test whether two states are the same, and whether the engine reports no state on its
      way from one asked state to the next, as it does for cells.
  */
  constructor(same, passesThroughNone) {
    this.same = same;
    this.passesThroughNone = passesThroughNone;
    this.asked = [];
  }
  /// Notes a state asked of the engine, behind the ones asked before it.
  note(state) {
    const last = this.asked[this.asked.length - 1];
    if (last && this.same(last.state, state) && !last.reportedAt)
      return;
    this.asked.push({
      state,
      askedAt: performance.now(),
      reportedAt: 0
    });
    if (this.asked.length > _TableStatesOnTheWay.most)
      this.asked.shift();
  }
  /// Notes a state behind the ones asked before it, where any of them waits for its report.
  noteWhileWaiting(state) {
    if (this.waits())
      this.note(state);
  }
  /// Whether a state waits for its report still, forgetting them all where none does.
  waits() {
    const now = performance.now();
    const newest = this.asked[this.asked.length - 1];
    if (!newest || now - newest.askedAt > _TableStatesOnTheWay.longest || newest.reportedAt && now - newest.reportedAt > _TableStatesOnTheWay.afterReport) {
      this.asked = [];
      return false;
    }
    return true;
  }
  /*
      Whether a report of the engine names an older state than the newest one asked, or is a
      passing one of no state while the newest one is on its way: such a report is left aside.
      The older ones stay until the newest is done with, as the engine may report one of them
      again on its way.
  */
  outdated(reported) {
    if (!this.waits())
      return false;
    const now = performance.now();
    const newest = this.asked[this.asked.length - 1];
    let at = this.asked.length - 1;
    while (at >= 0 && !(this.asked[at].state === null || reported === null ? this.asked[at].state === reported : this.same(this.asked[at].state, reported)))
      --at;
    if (at < 0) {
      if (this.passesThroughNone && reported === null && newest.state !== null)
        return true;
      this.asked = [];
      return false;
    }
    if (at < this.asked.length - 1)
      return true;
    if (!newest.reportedAt)
      newest.reportedAt = now;
    return false;
  }
};
_TableStatesOnTheWay.longest = 1e4;
_TableStatesOnTheWay.afterReport = 200;
_TableStatesOnTheWay.most = 16;
let TableStatesOnTheWay = _TableStatesOnTheWay;
const _ClassicTableContext = class _ClassicTableContext extends ClassicContext {
  constructor(table, group) {
    super(group);
    this.table = table;
  }
  /// The rows and columns of the selected table, as the server sends them. Absent while it has
  /// sent none.
  static data() {
    var _a, _b;
    return (_b = (_a = app.activeDocument) == null ? void 0 : _a.tableMiddleware) == null ? void 0 : _b.tableData();
  }
  /*
      How far the table stands from where the server last reported it, in twips: a move made
      here is laid on the table at once, before the server reports the table again, so the
      borders go along by that much. Nought once the report has come.
  */
  static shiftSinceReported(data) {
    var _a;
    const selected = GraphicSelection.selectedObjectIDs;
    const transform = selected.length === 1 ? (_a = RenderGeometrySection.objectOf(selected[0])) == null ? void 0 : _a.transform : void 0;
    const reported = data.rectangle;
    if (!transform || !reported)
      return new cool.Point(0, 0);
    return new cool.Point(transform[4] - reported.x, transform[5] - reported.y);
  }
  /// Where the borders of the table lie, from its rows and columns.
  static layout(data) {
    const across = data.columns;
    const down = data.rows;
    const shift = _ClassicTableContext.shiftSinceReported(data);
    const inner = (lines) => Array.isArray(lines.entries) ? lines.entries : [];
    const columns = [across.left].concat(inner(across).map((entry) => entry.position)).concat([across.right]).map((at) => across.tableOffset + at + shift.x);
    const rows = [down.left].concat(inner(down).map((entry) => entry.position)).concat([down.right]).map((at) => down.tableOffset + at + shift.y);
    return {
      left: columns[0],
      right: columns[columns.length - 1],
      top: rows[0],
      bottom: rows[rows.length - 1],
      columns,
      rows
    };
  }
  /*
      The columns, or the rows, the cells selected now cover whole, the first and the last of
      them: where the selection reaches across the whole table one way and covers whole columns
      or rows the other way. Nothing where no cell is selected or the selection is other. Cells
      of a table are selected as one rectangle.
  */
  static selectedLines(columns, table) {
    const area = app.map._docLayer._cellSelectionArea;
    if (!area)
      return null;
    const near = 20;
    const across = columns ? area.y1 <= table.top + near && area.y2 >= table.bottom - near : area.x1 <= table.left + near && area.x2 >= table.right - near;
    if (!across)
      return null;
    const lines = columns ? table.columns : table.rows;
    const low = columns ? area.x1 : area.y1;
    const high = columns ? area.x2 : area.y2;
    const covered = [];
    for (let at = 0; at + 1 < lines.length; ++at)
      if (lines[at] >= low - near && lines[at + 1] <= high + near)
        covered.push(at);
    return covered.length ? { from: covered[0], to: covered[covered.length - 1] } : null;
  }
  /*
      Selects the cells of that column, or of that row, alone; where that one is selected alone
      already, no cell is selected any more. With extending only that column or row changes:
      next to the selection it joins it, at its edge it leaves it, the last one leaves the
      selection empty, and one further away changes nothing, as cells are selected as one
      rectangle.
  */
  selectLine(columns, at, extending) {
    const data = _ClassicTableContext.data();
    if (!data)
      return;
    const table = _ClassicTableContext.layout(data);
    const standing = _ClassicTableContext.selectedLines(columns, table);
    let from = at;
    let to = at;
    if (standing && !extending) {
      if (standing.from === at && standing.to === at) {
        this.selectCells(table, null);
        return;
      }
    } else if (standing) {
      from = standing.from;
      to = standing.to;
      if (at === from - 1)
        from = at;
      else if (at === to + 1)
        to = at;
      else if (at === from && from < to)
        ++from;
      else if (at === to && from < to)
        --to;
      else if (at === from && at === to) {
        this.selectCells(table, null);
        return;
      } else
        return;
    }
    this.selectCells(table, columns ? [from, 0, to, table.rows.length - 2] : [0, from, table.columns.length - 2, to]);
  }
  /// The cell at that point of the page, in twips, as its column and row; nothing outside the
  /// table.
  static cellAt(table, x, y) {
    const within = (lines, at) => {
      for (let line = 0; line + 1 < lines.length; ++line)
        if (at >= lines[line] && at <= lines[line + 1])
          return line;
      return -1;
    };
    const column = within(table.columns, x);
    const row = within(table.rows, y);
    return column < 0 || row < 0 ? null : { column, row };
  }
  /// The cell the text cursor stands in, where a cell of the table is being edited.
  static editedCell(table) {
    const cursor = app.file.textCursor;
    if (!cursor.visible || !cursor.rectangle)
      return null;
    return _ClassicTableContext.cellAt(table, cursor.rectangle.x1 + cursor.rectangle.width * 0.5, cursor.rectangle.y1 + cursor.rectangle.height * 0.5);
  }
  /*
      Deletes that column, or that row, of the table; where it is one of several whole columns or
      rows selected, all of them, as the office deletes what is selected. They are selected
      first, so the engine deletes what the client says.
  */
  deleteLines(columns, at) {
    var _a, _b;
    const data = _ClassicTableContext.data();
    if (!data)
      return;
    const table = _ClassicTableContext.layout(data);
    const standing = _ClassicTableContext.selectedLines(columns, table);
    const lines = standing && at >= standing.from && at <= standing.to ? standing : { from: at, to: at };
    this.selectCells(table, columns ? [lines.from, 0, lines.to, table.rows.length - 2] : [0, lines.from, table.columns.length - 2, lines.to]);
    app.map.sendUnoCommand(columns ? ".uno:DeleteColumns" : ".uno:DeleteRows");
    (_b = (_a = app.activeDocument) == null ? void 0 : _a.tableMiddleware) == null ? void 0 : _b.deleteLinesLocally(columns, lines.from, lines.to);
    const docLayer = app.map._docLayer;
    docLayer._cellSelectionArea = null;
    docLayer.showTextSelection([]);
    _ClassicTableContext.cellsOnTheWay.note(null);
  }
  /*
      Extends the selection of cells to the cell at that point, in twips: from the cell being
      edited, or from the cell the selection started at. Answers whether it did, which it does
      not inside the edited cell, where Shift selects text.
  */
  extendCellsTo(x, y) {
    const data = _ClassicTableContext.data();
    if (!data)
      return false;
    const table = _ClassicTableContext.layout(data);
    const to = _ClassicTableContext.cellAt(table, x, y);
    const edited = _ClassicTableContext.editedCell(table);
    const from = edited ?? (app.map._docLayer._cellSelectionArea ? _ClassicTableContext.anchor : null);
    if (!from || !to)
      return false;
    if (edited && edited.column === to.column && edited.row === to.row)
      return false;
    this.selectCellRange(from, to);
    return true;
  }
  /// Selects the cells from one cell to another, whichever way round they lie; the first is
  /// where it is extended from with Shift.
  selectCellRange(from, to) {
    const data = _ClassicTableContext.data();
    if (!data)
      return;
    _ClassicTableContext.anchor = from;
    this.selectCells(_ClassicTableContext.layout(data), [
      Math.min(from.column, to.column),
      Math.min(from.row, to.row),
      Math.max(from.column, to.column),
      Math.max(from.row, to.row)
    ]);
  }
  /// Whether two lists of places in twips are the same, but for how the engine rounds them.
  static near(one, other) {
    const near = 20;
    return one.length === other.length && one.every((value, index) => Math.abs(value - other[index]) <= near);
  }
  /*
      Whether a report of the selected cells, as [x, y, width, height] in twips or null for
      none, is one of a range asked before the newest, which the engine reports on its way to
      the newest, and is to be left aside.
  */
  static outdatedCellReport(reported) {
    return _ClassicTableContext.cellsOnTheWay.outdated(reported);
  }
  /*
      Notes a press or a key sent to the engine while cell ranges are on their way: the engine
      reports no cells for it, or a range of its own, which counts as one made elsewhere.
  */
  static noteInputSent() {
    _ClassicTableContext.cellsOnTheWay.noteWhileWaiting(null);
  }
  /*
      Selects the cells from the first to the last, as [first column, first row, last column,
      last row], or none: it shows the selection at once, as the engine reports one, and tells
      the engine the range.
  */
  selectCells(table, cells) {
    const docLayer = app.map._docLayer;
    if (!cells) {
      docLayer._cellSelectionArea = null;
      docLayer.showTextSelection([]);
      _ClassicTableContext.cellsOnTheWay.note(null);
    } else {
      const [firstColumn2, firstRow2, lastColumn2, lastRow2] = cells;
      const x = table.columns[firstColumn2];
      const y = table.rows[firstRow2];
      const width = table.columns[lastColumn2 + 1] - x;
      const height = table.rows[lastRow2 + 1] - y;
      docLayer._cellSelectionArea = new cool.SimpleRectangle(x, y, width, height);
      docLayer.showTextSelection([[x, y, width, height]]);
      _ClassicTableContext.cellsOnTheWay.note([x, y, width, height]);
    }
    const [firstColumn, firstRow, lastColumn, lastRow] = cells ?? [
      -1,
      -1,
      -1,
      -1
    ];
    app.socket.sendMessage("selectcells id=" + this.table + " firstcolumn=" + firstColumn + " firstrow=" + firstRow + " lastcolumn=" + lastColumn + " lastrow=" + lastRow);
  }
};
_ClassicTableContext.anchor = null;
_ClassicTableContext.cellsOnTheWay = new TableStatesOnTheWay((one, other) => _ClassicTableContext.near(one ?? [], other ?? []), true);
let ClassicTableContext = _ClassicTableContext;
