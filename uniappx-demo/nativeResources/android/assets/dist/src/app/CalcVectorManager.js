const _CalcVectorManager = class _CalcVectorManager extends VectorManagerBase {
  constructor() {
    super();
    this._typing = new cool.CalcTyping(new cool.TextMeasurer(this._textMeasure()));
    this._textStyles = /* @__PURE__ */ new Map();
    this._sheets = /* @__PURE__ */ new Map();
    this._epoch = void 0;
    this._sheetRequested = /* @__PURE__ */ new Set();
    this._staleFrom = /* @__PURE__ */ new Map();
    this._sheetsBehind = /* @__PURE__ */ new Set();
    this._requests = new cool.RequestTracker({
      timeout: _CalcVectorManager.requestTimeout,
      expired: () => {
        this._fireChanged([]);
        this._sendQueued();
      }
    });
    this._view = { rows: 1, columns: 1 };
    this._queue = null;
    this._reclaimListeners = [];
    this._resourceVersion = 0;
    this._objectViews = /* @__PURE__ */ new Map();
    this._changeCount = 0;
    this._viewCounts = /* @__PURE__ */ new Map();
    this._listensToGeometry = false;
    this._geometryCount = 0;
    this._placedBlocks = /* @__PURE__ */ new Map();
    app.calc.vectorManager = this;
  }
  kind() {
    return "sheet";
  }
  /// Call back to release graphics memory, such as when the document is hidden.
  onReclaimGraphicsMemory(callback) {
    this._reclaimListeners.push(callback);
  }
  offReclaimGraphicsMemory(callback) {
    const index = this._reclaimListeners.indexOf(callback);
    if (index >= 0)
      this._reclaimListeners.splice(index, 1);
  }
  /// Release graphics memory: what the sections keep for drawing, the decoded images and what
  /// the renderer keeps between draws. What is still needed is asked for and drawn again when
  /// shown.
  reclaimGraphicsMemory() {
    for (const listener of this._reclaimListeners)
      listener();
    super.reclaimGraphicsMemory();
  }
  _fireChanged(answered, inputSequence) {
    this._changeCount++;
    super._fireChanged(answered, inputSequence);
  }
  /// Draw again the objects the client changed, such as after a drag.
  changedHere() {
    this._fireChanged([]);
  }
  /// The renderer the content of the sheet is drawn with.
  get renderer() {
    return this._renderer;
  }
  /// A loaded image or font counts the resource version up, so the drawings made before it go.
  _resourcesLoaded(owners) {
    this._resourceVersion++;
    super._resourcesLoaded(owners);
  }
  /// Counts up each time a font or image that the content names has loaded.
  resourceVersion() {
    return this._resourceVersion;
  }
  isDrawnElsewhere(objectId) {
    return this._drawnElsewhere.has(objectId);
  }
  /// The text edits of the sheet, with the unanswered typing of this view.
  textEditsOf(sheet) {
    return this._typing.editsOf(sheet.part, sheet.textEdits);
  }
  /// True when a keystroke at the caret can show before the engine answers.
  canPredictAtCaret() {
    const context = this._typingContext();
    if (!context)
      return false;
    return this._typing.canTypeAt(context.edits, context.viewId, context.origin, context.caret);
  }
  /// Show typed text in the cell edit before the engine answers, replacing a selection in the
  /// paragraph of the caret. True when it shows.
  predictTextInsert(text) {
    return this._type((selected) => cool.typedChange(text, selected));
  }
  /// Delete before characters left of the caret and after characters right of it in the cell edit
  /// of this view. True when it shows.
  predictTextDelete(before, after) {
    if (before <= 0 && after <= 0)
      return false;
    return this._type((selected) => cool.deletedChange(before, after, selected));
  }
  /// After an input that ends the cell edit or moves its caret, drop the typing and predict
  /// nothing until the engine reports the caret again.
  noteInput(message) {
    if (!cool.calcInputMovesEdit(message))
      return;
    const wasTyping = this._typing.isTyping();
    this._typing.holdUntilCaret();
    if (wasTyping)
      this._fireChanged([]);
  }
  /// True when the caret update is older than the newest typing. A caret replayed for a geometry
  /// change predates the typing, so the typed caret is placed again with the current geometry.
  keepPredictedCaret(update) {
    const docLayer = app.map && app.map._docLayer;
    if ((docLayer == null ? void 0 : docLayer._isReplayingMessages) && this._typing.isTyping()) {
      const context = this._typingContext();
      const typed = context ? this._typing.caretAfterTyping(context.viewId, context.origin) : null;
      if (typed) {
        this._showTypedCaret(typed);
        return true;
      }
    }
    const wasTyping = this._typing.isTyping();
    const kept = this._typing.keepsCaret(update);
    if (wasTyping && !this._typing.isTyping())
      this._fireChanged([]);
    return kept;
  }
  _type(build) {
    const context = this._typingContext();
    if (!context)
      return false;
    const caret = context.caret;
    const typed = this._typing.type(
      context.part,
      context.edits,
      context.viewId,
      context.origin,
      caret,
      // The ticket takes the number of the input message sent next.
      cool.InputSequence.ticketForTheNextMessage(),
      build
    );
    if (!typed)
      return false;
    if (caret.selected || caret.anchor) {
      app.file.textCursor.anchor = null;
      if (caret.selected)
        app.map._docLayer.showTextSelection([]);
    }
    this._showTypedCaret(typed);
    this._fireChanged([]);
    return true;
  }
  _showTypedCaret(typed) {
    app.file.textCursor.logical = typed.logical;
    cool.showCaret(typed.geometry);
  }
  /// What typing in a cell edit needs, or null when no cell edit caret shows.
  _typingContext() {
    const docLayer = app.map && app.map._docLayer;
    const cursor = app.file.textCursor;
    if (!docLayer || !cursor || !cursor.visible || !cursor.rectangle)
      return null;
    if (app.map.calcInputBarHasFocus())
      return null;
    const part = docLayer._selectedPart;
    const viewId = docLayer._viewId;
    const geometry = docLayer.sheetGeometry;
    if (viewId === void 0 || !geometry || geometry.getPart() !== part)
      return null;
    const sheet = this.getSheet(part);
    if (!sheet)
      return null;
    return {
      part,
      edits: sheet.textEdits,
      viewId,
      origin: (column, row) => {
        const x = geometry.getColumnsGeometry().getElementDataAny(column, "tiletwips");
        const y = geometry.getRowsGeometry().getElementDataAny(row, "tiletwips");
        return x && y ? new cool.Point(x.startpos, y.startpos) : void 0;
      },
      caret: {
        rectangle: cursor.rectangle,
        logical: cursor.logical ?? null,
        anchor: cursor.anchor ?? null,
        selected: TextSelections.isActive()
      }
    };
  }
  /// Draw the given objects of a view of objects through the matrix.
  renderObjectsWith(context, data, objectIds, matrix) {
    this.renderer.setEditViewContentVisible(true);
    this.renderer.renderObjectsMoved(context, data.objects, objectIds, matrix);
  }
  renderPrimitives(context, _data, primitives) {
    this.renderer.setEditViewContentVisible(true);
    for (const primitive of primitives)
      this.renderer.renderPrimitive(context, primitive);
  }
  /// A message that changes drawing objects, with its positions converted from tile twips to
  /// print twips. Other messages come back unchanged.
  messageInPrintTwips(message) {
    if (!cool.calcMessageHasPositions(message))
      return message;
    const docLayer = app.map && app.map._docLayer;
    if (!docLayer)
      return message;
    const part = docLayer._selectedPart;
    const view = this._objectView(part);
    const geometry = docLayer.sheetGeometry;
    if (!view || !geometry)
      return message;
    const objects = view.data.objects;
    const outermostOf = (id) => {
      var _a;
      const seen = /* @__PURE__ */ new Set([id]);
      let top = id;
      for (; ; ) {
        const parent = (_a = objects.get(top)) == null ? void 0 : _a.parent;
        if (!parent || seen.has(parent) || !objects.has(parent))
          return top;
        seen.add(parent);
        top = parent;
      }
    };
    const groups = /* @__PURE__ */ new Set();
    for (const object of objects.values())
      if (object.parent)
        groups.add(object.parent);
    return cool.calcMessageInPrintTwips(message, {
      placingOf: (id) => view.placingOf(id),
      outermostOf,
      membersOf: (outermost) => Array.from(objects.keys()).filter((id) => !groups.has(id) && outermostOf(id) === outermost),
      placingAt: (id, point) => {
        const print = geometry.getPrintTwipsPointFromTile(point);
        const scale = view.placingOf(id) ?? cool.calcIdentityPlacing;
        return {
          scaleX: scale.scaleX,
          scaleY: scale.scaleY,
          moveX: point.x - scale.scaleX * print.x,
          moveY: point.y - scale.scaleY * print.y
        };
      }
    });
  }
  /// The drawing objects of a sheet in tile twips, placed by the shown geometry. Undefined until
  /// they arrive, or while the geometry is still that of the previous sheet.
  objectsOf(part) {
    const view = this._objectView(part);
    return view ? view.data : void 0;
  }
  /// The placing of the object from print twips of the sheet to tile twips, if held.
  objectPlacingOf(part, id) {
    const view = this._objectView(part);
    return view ? view.placingOf(id) : void 0;
  }
  _objectView(part) {
    const docLayer = app.map && app.map._docLayer;
    const geometry = docLayer ? docLayer.sheetGeometry : void 0;
    if (!geometry || geometry.getPart() !== part)
      return void 0;
    const sheet = this._sheetWithObjects(part);
    if (!sheet)
      return void 0;
    this._listenToGeometry();
    let view = this._objectViews.get(part);
    if (!view) {
      view = new cool.CalcObjectView(part);
      this._objectViews.set(part, view);
    }
    if (this._viewCounts.get(part) !== this._changeCount) {
      view.update(sheet, geometry);
      this._viewCounts.set(part, this._changeCount);
    }
    return view;
  }
  _listenToGeometry() {
    if (this._listensToGeometry)
      return;
    this._listensToGeometry = true;
    app.map.on("sheetgeometrychanged", () => {
      this._changeCount++;
      this._geometryCount++;
    });
  }
  /// The sheet whose drawing objects are shown, once it arrived whole.
  _sheetWithObjects(part) {
    const sheet = this.getSheet(part);
    return sheet && sheet.complete ? sheet : void 0;
  }
  /// The block placed at the view zoom, in tile twips from its first cell, without the stored
  /// text of the cells that views edit. Undefined while the geometry of its sheet is not known.
  placedBlock(sheet, block) {
    const docLayer = app.map && app.map._docLayer;
    const geometry = docLayer ? docLayer.sheetGeometry : void 0;
    if (!geometry || geometry.getPart() !== sheet.part || !app.tile.size)
      return void 0;
    this._listenToGeometry();
    const key = _CalcVectorManager._sheetKey(sheet.part) + "/" + cool.calcBlockKey(block.blockRow, block.blockColumn);
    const pixel = app.tile.size.x / RenderManager.tileSize;
    const editedCells = this._editedCellsIn(sheet, block);
    const edited = editedCells.map((cell) => String(cell.column) + ":" + String(cell.row)).join(",");
    const shifts = this.blockShifts(sheet, block);
    const shifted = shifts.map((shift) => String(shift.version)).join(",");
    const held = this._placedBlocks.get(key);
    const placedAsHeld = held && held.source === block && held.count === this._geometryCount && held.pixel === pixel && held.shifted === shifted;
    if (held && placedAsHeld && held.edited === edited)
      return held.placed;
    const whole = held && placedAsHeld ? held.whole : cool.calcPlacedBlock(block, geometry, pixel, shifts);
    if (!whole)
      return void 0;
    const placed = editedCells.length ? cool.calcBlockWithoutCellText(whole, editedCells) : whole;
    this._placedBlocks.set(key, {
      source: block,
      count: this._geometryCount,
      pixel,
      shifted,
      whole,
      edited,
      placed
    });
    return placed;
  }
  /// The shifts of the sheet that a held block predates and that moved all of its cells, so
  /// the block is placed as they moved until it is built again. A shift across a part of the
  /// block leaves it in place.
  blockShifts(sheet, block) {
    return sheet.shifts.filter((shift) => {
      if (shift.version <= block.current)
        return false;
      const [first, last] = shift.axis === "rows" ? [block.startColumn, block.endColumn] : [block.startRow, block.endRow];
      return shift.across[0] <= first && last <= shift.across[1];
    });
  }
  /// The cells of the block that views edit, whose edits are drawn over them.
  _editedCellsIn(sheet, block) {
    const cells = [];
    for (const edit of this.textEditsOf(sheet)) {
      if (edit.parent !== void 0 || edit.column === void 0 || edit.row === void 0)
        continue;
      if (edit.column >= block.startColumn && edit.column <= block.endColumn && edit.row >= block.startRow && edit.row <= block.endRow)
        cells.push({ column: edit.column, row: edit.row });
    }
    return cells;
  }
  // Forget the placed blocks of a sheet, or of one block of it.
  _forgetPlaced(sheetKey, blockKey) {
    if (blockKey !== void 0) {
      this._placedBlocks.delete(sheetKey + "/" + blockKey);
      return;
    }
    for (const key of Array.from(this._placedBlocks.keys()))
      if (key.startsWith(sheetKey + "/"))
        this._placedBlocks.delete(key);
  }
  static _sheetKey(part) {
    return String(part);
  }
  // The owner name of the fonts and images of an entry, released with it.
  static _resourceOwner(sheetKey, entryKey) {
    return "calc:" + sheetKey + ":" + entryKey;
  }
  getSheet(part) {
    return this._sheets.get(_CalcVectorManager._sheetKey(part));
  }
  _ensureSheet(part) {
    const key = _CalcVectorManager._sheetKey(part);
    let sheet = this._sheets.get(key);
    if (!sheet) {
      sheet = {
        part,
        version: 0,
        complete: false,
        blockRows: 64,
        blockColumns: 16,
        sheet: void 0,
        blocks: /* @__PURE__ */ new Map(),
        staleBlocks: /* @__PURE__ */ new Set(),
        shifts: [],
        objects: /* @__PURE__ */ new Map(),
        drawOrder: [],
        objectBlocks: [],
        textEdits: []
      };
      this._sheets.set(key, sheet);
    }
    return sheet;
  }
  /// Ask for the blocks that are not held or may be behind, most wanted first, replacing the
  /// earlier queue. A missing block gets a request of its own, so the first one shows as soon
  /// as the engine has built it, unless the view spans many blocks. direction is the sign of
  /// the last scroll in x and y, which the stale blocks around the view are refreshed towards
  /// first, and view the block rows and columns the view spans.
  requestBlocks(part, blocks, direction = [0, 0], view) {
    if (view)
      this._view = view;
    const sheet = this._ensureSheet(part);
    const sheetKey = _CalcVectorManager._sheetKey(part);
    const keys = [];
    for (const [blockRow, blockColumn] of blocks) {
      const key = cool.calcBlockKey(blockRow, blockColumn);
      if (keys.indexOf(key) < 0 && this._isWanted(sheet, sheetKey, key))
        keys.push(key);
    }
    const needsSheet = !this._sheetRequested.has(sheetKey) || this._sheetsBehind.has(sheetKey);
    let refresh = false;
    if (keys.length === 0 && !needsSheet) {
      keys.push(...this._staleAround(sheet, sheetKey, blocks, direction));
      refresh = keys.length > 0;
    }
    this._queue = { part, keys, refresh };
    if (keys.length === 0 && needsSheet)
      this._sendRequest(part, []);
    this._sendQueued();
  }
  /// The held stale blocks near the given blocks that are not asked for yet. As the tiles are
  /// fetched ahead, the side the view scrolls towards reaches twice as far and comes first, and
  /// nearer blocks come before farther ones.
  _staleAround(sheet, sheetKey, blocks, direction) {
    if (!blocks.length || !sheet.staleBlocks.size)
      return [];
    const [towardsX, towardsY] = direction;
    const reach = (sign, towards, distance) => sign === towards ? 2 * distance : distance;
    const rows = blocks.map(([blockRow]) => blockRow);
    const columns = blocks.map(([, blockColumn]) => blockColumn);
    const rowReach = Math.max(_CalcVectorManager.refreshBlockRows, 2 * this._view.rows);
    const columnReach = Math.max(_CalcVectorManager.refreshBlockColumns, this._view.columns);
    const top = Math.min(...rows) - reach(-1, towardsY, rowReach);
    const bottom = Math.max(...rows) + reach(1, towardsY, rowReach);
    const left = Math.min(...columns) - reach(-1, towardsX, columnReach);
    const right = Math.max(...columns) + reach(1, towardsX, columnReach);
    const middleRow = (Math.min(...rows) + Math.max(...rows)) / 2;
    const middleColumn = (Math.min(...columns) + Math.max(...columns)) / 2;
    const near = [];
    for (const key of sheet.staleBlocks) {
      const block = sheet.blocks.get(key);
      if (!block || !this._isWanted(sheet, sheetKey, key))
        continue;
      if (block.blockRow < top || block.blockRow > bottom || block.blockColumn < left || block.blockColumn > right)
        continue;
      near.push({
        key,
        ahead: towardsY !== 0 && Math.sign(block.blockRow - middleRow) === towardsY || towardsX !== 0 && Math.sign(block.blockColumn - middleColumn) === towardsX,
        distance: Math.hypot(block.blockRow - middleRow, block.blockColumn - middleColumn)
      });
    }
    near.sort((a, b) => Number(b.ahead) - Number(a.ahead) || a.distance - b.distance);
    return near.map((entry) => entry.key);
  }
  /// Whether a block is missing or stale and not already asked for.
  _isWanted(sheet, sheetKey, key) {
    if (this._requests.isOut(sheetKey + "/" + key))
      return false;
    return !sheet.blocks.has(key) || sheet.staleBlocks.has(key);
  }
  /// Ask for the queued blocks, one per request, up to the limit in flight. A request for another
  /// sheet gives its place to the sheet shown, and its answer is still taken when it comes.
  _sendQueued() {
    const queue = this._queue;
    if (!queue)
      return;
    const sheetKey = _CalcVectorManager._sheetKey(queue.part);
    const sheet = this._sheets.get(sheetKey);
    if (!sheet) {
      this._queue = null;
      return;
    }
    this._requests.dropLate();
    const shown = this._view.rows * this._view.columns;
    const missingPerRequest = Math.min(_CalcVectorManager.maxMissingBlocksPerRequest, Math.max(1, Math.floor(shown / 8)));
    const heldPerRequest = shown > 16 ? 2 * _CalcVectorManager.maxHeldBlocksPerRequest : _CalcVectorManager.maxHeldBlocksPerRequest;
    while (queue.keys.length > 0) {
      const key = queue.keys[0];
      if (!this._isWanted(sheet, sheetKey, key)) {
        queue.keys.shift();
        continue;
      }
      const limit = queue.refresh ? _CalcVectorManager.maxRequestsInFlight - 1 : _CalcVectorManager.maxRequestsInFlight;
      if (this._requests.requestCount >= limit && !this._forgetRequestOfOtherSheet(sheetKey))
        break;
      queue.keys.shift();
      const keys = [key];
      const held = sheet.blocks.has(key);
      const perRequest = held ? heldPerRequest : missingPerRequest;
      queue.keys = queue.keys.filter((other) => {
        if (sheet.blocks.has(other) !== held)
          return true;
        if (keys.length >= perRequest)
          return true;
        if (this._isWanted(sheet, sheetKey, other))
          keys.push(other);
        return false;
      });
      this._sendRequest(queue.part, keys);
    }
  }
  // Forget the oldest request for another sheet. True when there was one.
  _forgetRequestOfOtherSheet(sheetKey) {
    for (const request of this._requests.requests()) {
      if (request.data === sheetKey)
        continue;
      this._requests.takeRequest(request.id);
      return true;
    }
    return false;
  }
  /// Ask for blocks of a sheet, and for changes to its objects and settings.
  _sendRequest(part, keys) {
    const sheet = this._ensureSheet(part);
    const sheetKey = _CalcVectorManager._sheetKey(part);
    const names = [];
    for (const key of keys) {
      const held = sheet.blocks.get(key);
      names.push(held ? key + ":" + String(held.current) : key);
    }
    this._sheetRequested.add(sheetKey);
    this._sheetsBehind.delete(sheetKey);
    this._requests.requestKeys(keys.map((key) => sheetKey + "/" + key), sheetKey, (requestId) => app.socket.sendMessage(cool.vectorPrimitivesRequest({
      partId: String(part),
      mode: _CalcVectorManager.contentMode,
      requestId,
      blocks: names,
      epoch: this._epoch,
      // Only a complete sheet asks for changes since its version. A sheet
      // filled only by pushes asks for its drawing objects whole.
      since: sheet.complete ? sheet.version : void 0
    })));
  }
  // The blocks that a request asked for, without the key of the sheet.
  static _blocksOf(request) {
    const sheetKeyLength = (request.data ?? "").length;
    return request.keys.map((key) => key.substring(sheetKeyLength + 1));
  }
  /// Drop blocks out of view once a sheet holds too many. Once a block in view is held, also drop
  /// the sheets shown longest ago beyond maxSheets.
  evict(part, keep) {
    const sheetKey = _CalcVectorManager._sheetKey(part);
    const sheet = this._sheets.get(sheetKey);
    if (!sheet)
      return;
    let holdsVisible = false;
    for (const key of keep) {
      if (sheet.blocks.has(key)) {
        holdsVisible = true;
        break;
      }
    }
    if (holdsVisible) {
      this._sheets.delete(sheetKey);
      this._sheets.set(sheetKey, sheet);
      for (const [key, other] of Array.from(this._sheets.entries())) {
        if (key === sheetKey)
          continue;
        if (this._sheets.size > _CalcVectorManager.maxSheets)
          this._dropSheet(key, other);
      }
    }
    if (sheet.blocks.size <= _CalcVectorManager.maxBlocks)
      return;
    const dropped = [];
    for (const [key, block] of Array.from(sheet.blocks.entries())) {
      if (keep.has(key))
        continue;
      sheet.blocks.delete(key);
      this._forgetPlaced(sheetKey, key);
      sheet.staleBlocks.delete(key);
      this._resources.release(_CalcVectorManager._resourceOwner(sheetKey, key));
      for (const id of Array.from(block.objects))
        this._dropObject(sheet, sheetKey, id, dropped);
      if (sheet.blocks.size <= _CalcVectorManager.maxBlocks / 2)
        break;
    }
    if (dropped.length)
      this._fireChanged(dropped);
  }
  _dropSheet(sheetKey, sheet) {
    for (const key of sheet.blocks.keys())
      this._resources.release(_CalcVectorManager._resourceOwner(sheetKey, key));
    for (const id of sheet.objects.keys())
      this._resources.release(_CalcVectorManager._resourceOwner(sheetKey, "o" + id));
    this._resources.release(_CalcVectorManager._resourceOwner(sheetKey, "edits"));
    this._sheets.delete(sheetKey);
    this._forgetPlaced(sheetKey);
    this._sheetRequested.delete(sheetKey);
    this._staleFrom.delete(sheetKey);
    this._sheetsBehind.delete(sheetKey);
    this._requests.forgetWhere((request) => request.data === sheetKey);
    if (this._queue && _CalcVectorManager._sheetKey(this._queue.part) === sheetKey)
      this._queue = null;
  }
  /// Mark one sheet as possibly behind, to ask again with the versions held.
  markPartStale(part) {
    for (const [sheetKey, sheet] of this._sheets) {
      if (sheet.part !== part)
        continue;
      this._markSheetStale(sheetKey, sheet);
      this._sheetsBehind.add(sheetKey);
    }
    this._fireChanged([]);
  }
  // Mark the blocks held and the blocks asked for as stale. The answers to the requests
  // already sent leave the marks in place.
  _markSheetStale(sheetKey, sheet) {
    for (const key of sheet.blocks.keys())
      sheet.staleBlocks.add(key);
    for (const flightKey of this._requests.outKeys())
      if (flightKey.startsWith(sheetKey + "/"))
        sheet.staleBlocks.add(flightKey.substring(sheetKey.length + 1));
    this._staleFrom.set(sheetKey, this._requests.nextRequestId);
  }
  /// Forget all content and the fonts and images it named, and take the fonts off the
  /// document.
  discardAllCache() {
    this.clearAll();
    this._resources.discard();
  }
  /// Forget all content, keeping the fonts and images that are loaded.
  clearAll() {
    this._typing.forget();
    this._textStyles.clear();
    this._sheets.clear();
    this._placedBlocks.clear();
    this._objectViews.clear();
    this._viewCounts.clear();
    this._requests.forgetAll();
    this._queue = null;
    this._sheetRequested.clear();
    this._staleFrom.clear();
    this._sheetsBehind.clear();
    this._resources.forgetOwners();
    this._fireChanged();
  }
  /// Handle an answer to .uno:VectorPrimitives or a pushed delta.
  handleVectorPrimitives(values) {
    const part = parseInt(values.partId);
    if (isNaN(part))
      return;
    const sheetKey = _CalcVectorManager._sheetKey(part);
    const requestId = values.requestId;
    const request = requestId !== void 0 ? this._requests.takeRequest(requestId) : void 0;
    if (this._epoch !== values.epoch) {
      const hadEpoch = this._epoch !== void 0;
      this._epoch = values.epoch;
      if (hadEpoch)
        this.clearAll();
    }
    const pushed = requestId === void 0;
    if (!request && (!this._sheets.has(sheetKey) || !this._sheetRequested.has(sheetKey)))
      return;
    const sheet = this._ensureSheet(part);
    if (request)
      this._sheetRequested.add(sheetKey);
    if (values.type === "vectorprimitives")
      sheet.complete = true;
    const asked = values.blocks ?? (request ? _CalcVectorManager._blocksOf(request) : []);
    const clearsStale = requestId === void 0 || requestId >= (this._staleFrom.get(sheetKey) ?? 0);
    if (clearsStale)
      for (const key of asked)
        sheet.staleBlocks.delete(key);
    if (values.blockRows)
      sheet.blockRows = values.blockRows;
    if (values.blockColumns)
      sheet.blockColumns = values.blockColumns;
    if (values.sheet)
      sheet.sheet = values.sheet;
    if (values.version !== void 0)
      sheet.version = Math.max(sheet.version, values.version);
    for (const [id, style] of Object.entries(values.textStyles ?? {}))
      this._textStyles.set(Number(id), style);
    const answered = [];
    const current = values.version ?? 0;
    if (pushed)
      for (const shift of values.shifts ?? [])
        sheet.shifts.push({ ...shift, version: current });
    const behind = /* @__PURE__ */ new Set();
    for (const entry of values.objects ?? []) {
      if (entry.kind !== "cells")
        continue;
      const key = cool.calcBlockKey(entry.blockRow, entry.blockColumn);
      const held = sheet.blocks.get(key);
      if (pushed && !held)
        continue;
      if (held && held.current >= entry.version)
        continue;
      for (const part2 of [entry.borders, ...entry.rows ?? []]) {
        const layers = (part2 == null ? void 0 : part2.content.layers) ?? {};
        for (const layer of Object.values(layers))
          cool.calcApplyTextStyles(layer, this._textStyles);
      }
      const block = cool.calcUpdatedBlock(held, entry, current);
      if (!block) {
        sheet.staleBlocks.add(key);
        behind.add(key);
        continue;
      }
      sheet.blocks.set(key, block);
      if (clearsStale)
        sheet.staleBlocks.delete(key);
      this._resources.replace(_CalcVectorManager._resourceOwner(sheetKey, key), (walker) => {
        const layers = block.content.layers;
        for (const layer of Object.values(layers))
          if (layer)
            walker.walkPrimitives(layer);
      });
      if (entry.from === 0) {
        const named = new Set((entry.objects ?? []).map((object) => object.id));
        for (const id of Array.from(block.objects))
          if (!named.has(id))
            this._leaveBlock(block, id);
      }
      for (const object of entry.objects ?? []) {
        block.objects.add(object.id);
        const heldObject = sheet.objects.get(object.id);
        if (heldObject && heldObject.version >= object.version)
          continue;
        sheet.objects.set(object.id, object);
        answered.push(object.id);
        this._resources.replace(_CalcVectorManager._resourceOwner(sheetKey, "o" + object.id), (walker) => walker.walkPrimitives(object.content.primitives));
      }
      for (const id of entry.removed ?? [])
        this._leaveBlock(block, id);
    }
    const stale = new Set(values.stale ?? []);
    for (const [key, block] of sheet.blocks) {
      if (behind.has(key))
        continue;
      if (stale.has(key) || sheet.staleBlocks.has(key)) {
        sheet.staleBlocks.add(key);
        continue;
      }
      if (pushed) {
        if (block.current >= (values.from ?? 0))
          block.current = Math.max(block.current, current);
        else
          sheet.staleBlocks.add(key);
      } else if (asked.indexOf(key) >= 0)
        block.current = Math.max(block.current, current);
    }
    if (values.objectBlocks) {
      const before = new Map(sheet.objectBlocks.map((block) => [
        cool.calcBlockKey(block.blockRow, block.blockColumn),
        block
      ]));
      sheet.objectBlocks = values.objectBlocks;
      if (this._hasObjectWithoutBlock(sheet)) {
        const moved = [];
        for (const block of values.objectBlocks) {
          const key = cool.calcBlockKey(block.blockRow, block.blockColumn);
          const was = before.get(key);
          if (sheet.blocks.has(key) || was && was.startColumn === block.startColumn && was.startRow === block.startRow && was.endColumn === block.endColumn && was.endRow === block.endRow)
            continue;
          moved.push(key);
        }
        if (moved.length > 0) {
          const queued = this._queue && this._queue.part === part ? this._queue.keys.filter((key) => moved.indexOf(key) < 0) : [];
          this._queue = { part, keys: moved.concat(queued) };
          this._sendQueued();
        }
      }
    }
    if (values.drawOrder) {
      sheet.drawOrder = values.drawOrder;
      const named = new Set(values.drawOrder);
      for (const id of Array.from(sheet.objects.keys()))
        if (!named.has(id))
          this._dropObject(sheet, sheetKey, id, answered);
    }
    const textEdits = values.textEdits;
    if (textEdits) {
      sheet.textEdits = textEdits;
      this._answerTyping(part, textEdits, values.inputSequence);
      this._resources.replace(_CalcVectorManager._resourceOwner(sheetKey, "edits"), (walker) => {
        for (const edit of textEdits)
          walker.walkPrimitives(edit.primitives);
      });
    }
    if (sheet.blocks.size > 0)
      this.markVisualsReady();
    if (sheet.shifts.length) {
      let oldest = Infinity;
      for (const block of sheet.blocks.values())
        oldest = Math.min(oldest, block.current);
      sheet.shifts = sheet.shifts.filter((shift) => shift.version > oldest);
    }
    this._fireChanged(answered, values.inputSequence);
    if (request)
      this._sendQueued();
  }
  /// Take an object out of a block. The object stays held as it was: it moved to another block,
  /// and the draw order drops it once it is gone.
  _leaveBlock(block, id) {
    block.objects.delete(id);
  }
  /// Whether an object held is named by no held block, so it waits for the block it moved to.
  _hasObjectWithoutBlock(sheet) {
    const named = /* @__PURE__ */ new Set();
    for (const block of sheet.blocks.values())
      for (const id of block.objects)
        named.add(id);
    for (const id of sheet.objects.keys())
      if (!named.has(id))
        return true;
    return false;
  }
  /// Forget an object, and the block it was held from. An object that is gone is answered, so the
  /// views drawing it hear of it.
  _dropObject(sheet, sheetKey, id, answered) {
    for (const block of sheet.blocks.values())
      block.objects.delete(id);
    if (sheet.objects.delete(id))
      answered.push(id);
    this._resources.release(_CalcVectorManager._resourceOwner(sheetKey, "o" + id));
  }
  // Apply again the typing that the engine edits do not include yet, and place the caret where
  // the typing leaves it.
  _answerTyping(part, edits, inputSequence) {
    if (!this._typing.isTyping(part))
      return;
    const context = this._typingContext();
    if (!context || context.part !== part) {
      this._typing.forget();
      return;
    }
    const typed = this._typing.answered(part, edits, inputSequence, context.viewId, context.origin);
    if (typed)
      this._showTypedCaret(typed);
  }
  // The client selects and moves the drawing objects of the sheet itself.
  drawsFromObjects() {
    return true;
  }
  // The engine places the objects of a sheet in print twips. An input that ends the cell edit
  // or moves its caret drops the typing shown.
  toEngine(message) {
    this.noteInput(message);
    return this.messageInPrintTwips(message);
  }
  // The drawing objects of a sheet are the same in every mode.
  requestPart(part, _mode) {
    return this.objectsOf(part);
  }
  // Only objects on the front layer take the pointer and keys. Back layer objects need the
  // selection mode of the drawing toolbar, and the internal layer holds comment captions,
  // which the comments handle.
  isLayerVisible(layer) {
    return layer === cool.calcLayerId("front");
  }
  /// Changes may have been missed while away, so every sheet held is asked for again with the
  /// versions held, its drawing objects and settings too. It is still drawn meanwhile, and the
  /// answers on their way are kept.
  revalidateCachedParts() {
    for (const [sheetKey, sheet] of this._sheets) {
      this._markSheetStale(sheetKey, sheet);
      this._sheetsBehind.add(sheetKey);
    }
    this._fireChanged([]);
  }
  /// Answers to requests sent before a reconnect never come, so their blocks are asked for
  /// again when they are drawn.
  forgetRequestsInFlight() {
    super.forgetRequestsInFlight();
    this._queue = null;
    this._sheetRequested.clear();
  }
  /// A tile still on its way from before the view drew from vectors is acknowledged and dropped.
  onTileMsg(textMsg, _img) {
    const tileMessage = app.socket.parseServerCmd(textMsg);
    if (tileMessage.wireId !== void 0)
      app.socket.sendMessage("tileprocessed wids=" + tileMessage.wireId);
  }
};
_CalcVectorManager.maxBlocks = 512;
_CalcVectorManager.maxSheets = 4;
_CalcVectorManager.maxRequestsInFlight = 2;
_CalcVectorManager.maxHeldBlocksPerRequest = 4;
_CalcVectorManager.maxMissingBlocksPerRequest = 4;
_CalcVectorManager.refreshBlockRows = 3;
_CalcVectorManager.refreshBlockColumns = 1;
_CalcVectorManager.contentMode = -1;
let CalcVectorManager = _CalcVectorManager;
