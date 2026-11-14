const _LocalCaret = class _LocalCaret {
  static moved(caret) {
    _LocalCaret.caret = caret;
    _LocalCaret.sequence = 0;
    _LocalCaret.stopRestTimer();
    _LocalCaret.restTimer = app.timerRegistry.setTimeout("localcaretrest", () => {
      _LocalCaret.restTimer = null;
      _LocalCaret.tell();
    }, VectorSettings.caretRestDelay());
  }
  static stopRestTimer() {
    if (_LocalCaret.restTimer === null)
      return;
    app.timerRegistry.clearTimeout(_LocalCaret.restTimer);
    _LocalCaret.restTimer = null;
  }
  /// The caret moved here while the engine is behind it, with the sequence number of the
  /// message that told the engine. Infinity while the engine has not been told, so the caret
  /// is newer than any input sent.
  static ahead() {
    if (!_LocalCaret.caret)
      return null;
    return {
      caret: _LocalCaret.caret,
      sequence: _LocalCaret.sequence || Infinity
    };
  }
  /// Tells the engine where the caret is, once for each move, in a message with the next
  /// sequence number.
  static tell() {
    _LocalCaret.stopRestTimer();
    const caret = _LocalCaret.caret;
    if (!caret || _LocalCaret.sequence)
      return;
    ChangeOutbox.sendTheTextAhead();
    _LocalCaret.sequence = cool.InputSequence.next([], false);
    const anchor = caret.anchor ? " anchorparagraph=" + caret.anchor.paragraph + " anchorindex=" + caret.anchor.index : "";
    app.socket.sendMessage("textcursor object=" + caret.objectId + " paragraph=" + caret.logical.paragraph + " index=" + caret.logical.index + anchor + " sequence=" + _LocalCaret.sequence);
  }
  /// Tells the engine where the caret is when the message may read or move it, and returns
  /// the message to send after that.
  static tellBefore(message) {
    if (!_LocalCaret.caret || _LocalCaret.sequence)
      return message;
    if (ChangeOutbox.sending || _LocalCaret.isUnrelated(message))
      return message;
    const unstamped = cool.InputSequence.unstamp(message);
    _LocalCaret.tell();
    return unstamped ? cool.InputSequence.stamp(unstamped.message, unstamped.tickets) : message;
  }
  /// True for a message that neither reads nor moves the caret.
  static isUnrelated(message) {
    return _LocalCaret.unrelated.some((prefix) => message.startsWith(prefix)) || new MessageParser(message).isHover;
  }
  /// True when the caret update from the engine is older than the caret here, which then
  /// stays. The update that answers the textcursor message, or a later input, carries the
  /// engine's caret.
  static isAhead(update) {
    if (!_LocalCaret.caret)
      return false;
    if (!_LocalCaret.sequence)
      return true;
    const inputSequence = Number(update.inputSequence);
    if (update.inputSequence === void 0 || isNaN(inputSequence))
      return true;
    if (inputSequence < _LocalCaret.sequence)
      return true;
    _LocalCaret.caughtUp();
    return false;
  }
  // The engine's caret is current again. The held selection stays.
  static caughtUp() {
    _LocalCaret.stopRestTimer();
    _LocalCaret.caret = null;
    _LocalCaret.sequence = 0;
  }
  /// Drops the caret moved here, and the selection messages held while it was ahead.
  static forget() {
    _LocalCaret.caughtUp();
    _LocalCaret.heldSelection.clear();
  }
  /// Drops the caret moved here once the caret is hidden, and returns the held selection
  /// messages, oldest first, as no caret update follows. A caret the engine was not told of
  /// is told first: an edit that runs on keeps it, and one that ended ignores it.
  static release() {
    _LocalCaret.tell();
    _LocalCaret.caughtUp();
    return _LocalCaret.takeHeld();
  }
  /// Holds a selection message from the engine while the caret here is ahead, replacing the
  /// held one of its kind. The engine sends the selection before the caret update it goes
  /// with. False while the caret here is not ahead.
  static hold(message) {
    if (!_LocalCaret.caret)
      return false;
    const kind = message.substring(0, message.indexOf(":"));
    _LocalCaret.heldSelection.delete(kind);
    _LocalCaret.heldSelection.set(kind, message);
    return true;
  }
  /// Takes the held selection messages, oldest first, once the engine caught up. Empty while
  /// the caret here is ahead.
  static takeHeld() {
    if (_LocalCaret.caret)
      return [];
    const held = [..._LocalCaret.heldSelection.values()];
    _LocalCaret.heldSelection.clear();
    return held;
  }
};
_LocalCaret.unrelated = [
  "tile ",
  "tilecombine ",
  "canceltiles",
  "clientvisiblearea ",
  "clientzoom ",
  "commandvalues command=.uno:Vector",
  "useractive",
  "userinactive"
];
_LocalCaret.caret = null;
_LocalCaret.sequence = 0;
_LocalCaret.restTimer = null;
_LocalCaret.heldSelection = /* @__PURE__ */ new Map();
let LocalCaret = _LocalCaret;
