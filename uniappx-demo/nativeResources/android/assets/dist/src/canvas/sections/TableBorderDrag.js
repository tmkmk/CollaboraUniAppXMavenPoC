const _TableBorderDrag = class _TableBorderDrag extends SelectionInteraction {
  constructor(selection, handle, table) {
    super(selection);
    this.handle = handle;
    this.columns = handle.kind === TableHandles.columnBorder;
    this.at = Number(handle.name.split(".")[2]);
    const lines = this.columns ? table.columns : table.rows;
    this.last = this.at === lines.length - 1;
    this.start = lines[this.at];
    const limits = _TableBorderDrag.limits(lines, this.at);
    this.low = limits.low;
    this.high = limits.high;
    _TableBorderDrag.running = { columns: this.columns, place: this.start };
  }
  move(to) {
    var _a;
    const led = this.led(to);
    const place = Math.min(this.high, Math.max(this.low, this.columns ? led.x : led.y));
    _TableBorderDrag.running = { columns: this.columns, place };
    (_a = app.sectionContainer) == null ? void 0 : _a.requestReDraw();
  }
  finish(to) {
    var _a;
    this.move(to);
    const offset = Math.round((((_a = _TableBorderDrag.running) == null ? void 0 : _a.place) ?? this.start) - this.start);
    _TableBorderDrag.running = null;
    _TableBorderDrag.moveBorder(this.columns, this.at, this.last, offset);
  }
  /*
      Moves a border of the selected table on the engine by that much, in twips: the border at
      that place in the list of borders between columns, or between rows, the outer ones
      included, where last says it is the outer one at the end.
  */
  static moveBorder(columns, at, last, offset) {
    var _a, _b;
    if (!offset)
      return;
    const type = (columns ? "column-" : "row-") + (last ? "right" : "middle");
    app.map.sendUnoCommand(".uno:TableChangeCurrentBorderPosition", {
      BorderType: { type: "string", value: type },
      Index: { type: "uint16", value: last ? 0 : at - 1 },
      Offset: { type: "int32", value: offset }
    });
    (_b = (_a = app.activeDocument) == null ? void 0 : _a.tableMiddleware) == null ? void 0 : _b.moveBorderLocally(columns, at, offset);
  }
  /// The places a border may go between the ones beside it, in twips.
  static limits(lines, at) {
    const nearest = _TableBorderDrag.nearest * app.dpiScale * app.pixelsToTwips;
    return {
      low: lines[at - 1] + nearest,
      high: at === lines.length - 1 ? Infinity : lines[at + 1] - nearest
    };
  }
  cancel() {
    var _a;
    _TableBorderDrag.running = null;
    (_a = app.sectionContainer) == null ? void 0 : _a.requestReDraw();
  }
  /// The marker being dragged stands where the border would go.
  handles(known) {
    const running = _TableBorderDrag.running;
    if (!running)
      return known;
    return known.map((handle) => handle.name !== this.handle.name ? handle : {
      ...handle,
      point: this.columns ? new cool.Point(running.place, handle.point.y) : new cool.Point(handle.point.x, running.place)
    });
  }
};
_TableBorderDrag.running = null;
_TableBorderDrag.nearest = 10;
let TableBorderDrag = _TableBorderDrag;
