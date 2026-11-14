var cool;
(function(cool2) {
  const editMovingKeys = {
    DOWN: 1024,
    UP: 1025,
    LEFT: 1026,
    RIGHT: 1027,
    HOME: 1028,
    END: 1029,
    PAGEUP: 1030,
    PAGEDOWN: 1031,
    RETURN: 1280,
    ESCAPE: 1281,
    TAB: 1282
  };
  function calcInputMovesEdit(message) {
    const tokens = message.split(" ");
    if (tokens[0] === "mouse")
      return tokens[1] === "type=buttondown";
    if (tokens[0] !== "key" && tokens[0] !== "windowkey")
      return false;
    if (!tokens.includes("type=input"))
      return false;
    const keyToken = tokens.find((token) => token.startsWith("key="));
    if (!keyToken)
      return false;
    const code = Number(keyToken.substring(4)) & 4095;
    return Object.values(editMovingKeys).includes(code);
  }
  cool2.calcInputMovesEdit = calcInputMovesEdit;
  const _CalcTyping = class _CalcTyping {
    constructor(measurer) {
      this.measurer = measurer;
      this.part = void 0;
      this.typed = null;
      this.pending = new cool2.UnansweredEdits();
      this.held = false;
    }
    /// Drops the typing and pauses it until the next caret update of the engine.
    holdUntilCaret() {
      this.forget();
      this.held = true;
    }
    /// True while typing waits for the caret update of the engine.
    isHeld() {
      return this.held;
    }
    /// The text edits to draw for the sheet: the ones given, or the copy with the typing.
    editsOf(part, edits) {
      return this.typed && this.part === part ? this.typed : edits;
    }
    /// True while typed changes wait for the engine, in the given sheet or in any sheet.
    isTyping(part) {
      return this.pending.has() && (part === void 0 || this.part === part);
    }
    /// True when a keystroke at the caret would show here. Nothing changes.
    canTypeAt(edits, viewId, origin, caret) {
      if (this.held || !_CalcTyping.covers(caret, false))
        return false;
      const placed = this.treeOf(edits, viewId, origin);
      return placed !== null && _CalcTyping.lookUp(placed.tree, caret) !== null;
    }
    /// Applies a change at the caret and keeps it until the engine answers. build gets the
    /// selected code points around the caret, or null. Returns the new caret, or null.
    type(part, edits, viewId, origin, caret, ticket, build) {
      if (this.held)
        return null;
      if (!caret.logical || !_CalcTyping.covers(caret, true))
        return null;
      if (this.part !== part)
        this.forget();
      const typed = this.typed ?? _CalcTyping.copyOf(edits);
      const placed = this.treeOf(typed, viewId, origin);
      if (!placed)
        return null;
      const position = _CalcTyping.lookUp(placed.tree, caret);
      if (!position)
        return null;
      const selected = caret.anchor ? cool2.selectedAround(position, caret.anchor) : null;
      const applied = cool2.applyPredictedChange(placed.tree, position, caret.logical, build(selected));
      if (!applied)
        return null;
      const caretAfter = {
        paragraph: caret.logical.paragraph,
        index: Math.max(0, caret.logical.index + applied.indexShift),
        atEnd: applied.position.atEnd
      };
      this.part = part;
      this.typed = typed;
      this.pending.record({
        ticket,
        column: placed.edit.column ?? 0,
        row: placed.edit.row ?? 0,
        caretBefore: { ...caret.logical, atEnd: position.atEnd },
        caretAfter,
        ...applied.change
      });
      return this.caretIn(placed.tree, caretAfter);
    }
    /// Drops the changes the engine edits include and applies the rest again. An undefined
    /// inputSequence includes every input. Returns the new caret, or null when none is left.
    answered(part, edits, inputSequence, viewId, origin) {
      if (this.part !== part || !this.pending.has())
        return null;
      const left = this.pending.answered(inputSequence);
      if (!left.length) {
        this.forget();
        return null;
      }
      const typed = _CalcTyping.copyOf(edits);
      const placed = this.treeOf(typed, viewId, origin);
      if (!placed || !cool2.UnansweredEdits.applyAgain(left, (change) => this.applyAgain(placed, change))) {
        this.forget();
        return null;
      }
      this.typed = typed;
      return this.caretIn(placed.tree, left[left.length - 1].caretAfter);
    }
    /// The caret after the newest change. It follows its cell when the sheet geometry changes.
    caretAfterTyping(viewId, origin) {
      const newest = this.pending.newest();
      if (!this.typed || !newest)
        return null;
      const placed = this.treeOf(this.typed, viewId, origin);
      if (!placed)
        return null;
      return this.caretIn(placed.tree, newest.caretAfter);
    }
    /// True when the update is older than the newest change. A current update that moves the
    /// caret away from the typing, as after an autocorrection, drops the typing.
    keepsCaret(update) {
      this.held = false;
      const verdict = this.pending.verdictOn(update, () => false);
      if (verdict === cool2.CaretUpdateVerdict.Elsewhere)
        this.forget();
      return verdict === cool2.CaretUpdateVerdict.Older;
    }
    /// Drop the typing, so the edits of the engine are drawn.
    forget() {
      this.part = void 0;
      this.typed = null;
      this.pending.forget();
    }
    /// The cell edit in tile twips. The tree shares its primitives, so changes reach the edit.
    treeOf(edits, viewId, origin) {
      const edit = edits.find((one) => one.viewId === viewId && one.parent === void 0 && one.column !== void 0 && one.row !== void 0);
      if (!edit || edit.column === void 0 || edit.row === void 0)
        return null;
      const corner = origin(edit.column, edit.row);
      if (!corner)
        return null;
      const move = {
        type: cool2.TransformPrimitive.type,
        matrix: [1, 0, 0, 1, corner.x, corner.y],
        children: edit.primitives
      };
      const id = _CalcTyping.entryId;
      const data = {
        partId: "",
        mode: 0,
        slideWidth: 0,
        slideHeight: 0,
        objects: /* @__PURE__ */ new Map([[id, { id, primitives: [move] }]]),
        order: [id]
      };
      return { tree: new cool2.PredictionTree(data, this.measurer), edit };
    }
    /// Apply a change kept from before. It applies in the same cell only.
    applyAgain(placed, change) {
      if (placed.edit.column !== change.column || placed.edit.row !== change.row)
        return false;
      const position = placed.tree.caretIn(_CalcTyping.entryId, change.caretBefore);
      if (!position)
        return false;
      return cool2.applyPredictedChange(placed.tree, position, change.caretBefore, change) !== null;
    }
    caretIn(tree, logical) {
      var _a;
      const geometry = (_a = tree.caretIn(_CalcTyping.entryId, logical)) == null ? void 0 : _a.geometry();
      return geometry ? {
        geometry,
        logical: { paragraph: logical.paragraph, index: logical.index }
      } : null;
    }
    /// True when typing at the caret shows here. A selection must be in one paragraph.
    static covers(caret, replacing) {
      const selected = caret.selected || caret.anchor !== null;
      if (!selected)
        return true;
      return replacing && caret.anchor !== null && caret.logical !== null && caret.anchor.paragraph === caret.logical.paragraph;
    }
    static lookUp(tree, caret) {
      return tree.caretAt(caret.rectangle.x1, caret.rectangle.y1, caret.rectangle.y2, caret.logical ?? void 0);
    }
    /// A copy of the text edits that a change can go into.
    static copyOf(edits) {
      return JSON.parse(JSON.stringify(edits));
    }
  };
  _CalcTyping.entryId = 1;
  let CalcTyping = _CalcTyping;
  cool2.CalcTyping = CalcTyping;
})(cool || (cool = {}));
