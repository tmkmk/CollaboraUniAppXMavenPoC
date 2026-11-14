const _ChangeOutbox = class _ChangeOutbox {
  /*
      Runs what a key press does with the changes it makes held until the keys are let go. The
      key is remembered as down until its release is seen.
  */
  static byAKey(event, does) {
    _ChangeOutbox.listen();
    _ChangeOutbox.keysDown.add(event.code || event.key);
    _ChangeOutbox.madeByAKey = true;
    try {
      return does();
    } finally {
      _ChangeOutbox.madeByAKey = false;
      if (!_ChangeOutbox.held.size)
        _ChangeOutbox.keysDown.clear();
    }
  }
  /*
      Takes a message on its way to the engine, if it is one the outbox holds to the engine's
      pace, and answers whether it took it. It holds the changes of objects, the undos and
      redos and the typed text, in a view that draws from the objects only. A change of objects
      that it takes gets a ticket, which is added to the given tickets.
  */
  static take(message, tickets) {
    var _a;
    if (_ChangeOutbox.sending)
      return false;
    if (!RenderManager.isVectorRendering())
      return false;
    const entry = _ChangeOutbox.entryOf(message);
    if (!entry)
      return false;
    if (entry.kind === "transform" || entry.kind === "other") {
      const ticket = new cool.InputTicket();
      entry.tickets.push(ticket);
      tickets == null ? void 0 : tickets.push(ticket);
    }
    _ChangeOutbox.listen();
    if (entry.kind === "text" || entry.kind === "remove") {
      entry.tickets = ((_a = cool.InputSequence.unstamp(message)) == null ? void 0 : _a.tickets) ?? [];
      _ChangeOutbox.letGoOfWhatIsHeld();
      _ChangeOutbox.merge(entry);
      const last = _ChangeOutbox.waiting[_ChangeOutbox.waiting.length - 1];
      if ((last.kind === "text" || last.kind === "remove") && last.ready !== false && _ChangeOutbox.textWait > 0) {
        last.ready = false;
        setTimeout(() => {
          last.ready = true;
          _ChangeOutbox.sendTheNext();
        }, _ChangeOutbox.textWait);
      }
    } else if (entry.kind === "undo" || entry.kind === "redo") {
      if (!_ChangeOutbox.undoOnItsWay())
        _ChangeOutbox.undoAskedAt = performance.now();
      if (_ChangeOutbox.repeatingKey) {
        _ChangeOutbox.keysDown.add(_ChangeOutbox.repeatingKey);
        _ChangeOutbox.hold(entry);
        return true;
      }
      _ChangeOutbox.letGoOfWhatIsHeld();
      _ChangeOutbox.merge(entry);
    } else if (_ChangeOutbox.madeByAKey) {
      _ChangeOutbox.hold(entry);
      return true;
    } else {
      _ChangeOutbox.merge(entry);
    }
    _ChangeOutbox.sendTheNext();
    return true;
  }
  /*
      Sends the waiting text ahead of a message that the engine applies in order after it,
      however many changes are in flight, and returns the message to send after that. A message
      numbered just now gives its number to what goes ahead of it and is stamped again, so the
      numbers rise in the order the messages go out. A message that neither reads nor moves
      the caret goes out on its own.
  */
  static sendAhead(message) {
    if (_ChangeOutbox.sending || !_ChangeOutbox.textWaits())
      return message;
    if (LocalCaret.isUnrelated(message))
      return message;
    const unstamped = cool.InputSequence.unstamp(message);
    _ChangeOutbox.sendTheTextAhead();
    return unstamped ? cool.InputSequence.stamp(unstamped.message, unstamped.tickets) : message;
  }
  /// Sends everything waiting where typed text or a deletion is among it, however many
  /// changes are in flight, so that a message sent after this goes out after the text. With
  /// no text waiting, the changes keep to the engine's pace.
  static sendTheTextAhead() {
    if (_ChangeOutbox.textWaits())
      _ChangeOutbox.sendAllWaiting();
  }
  /// Sends every waiting or held change now, even when many changes are in flight. Call it
  /// before a message that the engine must apply after these changes.
  static sendEverythingAhead() {
    if (_ChangeOutbox.sending)
      return;
    _ChangeOutbox.letGoOfWhatIsHeld();
    _ChangeOutbox.sendAllWaiting();
  }
  /// Sends everything waiting, however many changes are in flight.
  static sendAllWaiting() {
    if (_ChangeOutbox.sending)
      return;
    while (_ChangeOutbox.waiting.length)
      _ChangeOutbox.send(_ChangeOutbox.waiting.shift());
  }
  /// Whether typed text or a deletion waits to go out.
  static textWaits() {
    return _ChangeOutbox.waiting.some((entry) => entry.kind === "text" || entry.kind === "remove");
  }
  /// Sets the most changes in flight at a time, or puts back the usual number for null. A
  /// higher number sends what waits for it at once.
  static setMostInFlight(count) {
    _ChangeOutbox.mostInFlight = count === null ? _ChangeOutbox.usualMostInFlight : Math.max(1, count);
    _ChangeOutbox.sendTheNext();
  }
  /// Sets how long typed text and deletions wait before they go out, in milliseconds, 0 for
  /// no wait. Text that waits already keeps its own wait.
  static setTextWait(milliseconds) {
    _ChangeOutbox.textWait = Math.max(0, milliseconds);
  }
  /// Sends a message that changes objects and returns the ticket it was taken with, or null
  /// where it was not taken as a change of objects, as when the socket let it go unsent.
  static sendAChange(message) {
    const tickets = [];
    app.socket.sendMessage(message, tickets);
    return tickets[0] ?? null;
  }
  /// Whether an undo or a redo waits to go out or has not been answered yet.
  static undoOnItsWay() {
    return _ChangeOutbox.waitsFor() !== null;
  }
  /// How long the undos and redos on their way have been waited for, in milliseconds; zero
  /// while none is on its way.
  static undoWaitedFor() {
    return _ChangeOutbox.undoOnItsWay() ? performance.now() - _ChangeOutbox.undoAskedAt : 0;
  }
  /// The undo or the redo that goes out first among those waiting or in flight, or null where
  /// there is none.
  static waitsFor() {
    if (_ChangeOutbox.undosUnanswered > 0 || _ChangeOutbox.undoSettling)
      return _ChangeOutbox.undoKind;
    for (const entry of _ChangeOutbox.waiting)
      if (entry.kind === "undo" || entry.kind === "redo")
        return entry.kind;
    for (const entry of _ChangeOutbox.held.values())
      if (entry.kind === "undo" || entry.kind === "redo")
        return entry.kind;
    return null;
  }
  /// The entry a message stands for, or nothing for a message the outbox leaves alone.
  static entryOf(message) {
    if (message === "uno .uno:Undo")
      return { kind: "undo", count: 1 };
    if (message === "uno .uno:Redo")
      return { kind: "redo", count: 1 };
    const parser = new MessageParser(message);
    const typed = _ChangeOutbox.typedEntryOf(parser);
    if (typed)
      return typed;
    const to = parser.value("to");
    const what = parser.value("as");
    if (parser.command === "setobjecttransform" && parser.length === 3 && to !== void 0 && what) {
      const mappings = /* @__PURE__ */ new Map();
      for (const one of to.split(";")) {
        if (!one)
          continue;
        mappings.set(one.split(",")[0], one);
      }
      return { kind: "transform", what, mappings, tickets: [] };
    }
    const stateBegins = _ChangeOutbox.namedStates[parser.command];
    if (stateBegins === void 0)
      return null;
    const at = message.indexOf(stateBegins);
    return {
      kind: "other",
      channel: at < 0 ? message : message.substring(0, at),
      message,
      tickets: []
    };
  }
  /*
      The entry of a numbered message with text typed into the document itself, or null for any
      other message. Text typed into a dialog gets no delta as an answer. The outbox writes
      these messages again from their parameters, so a message with a parameter more is left
      alone.
  */
  static typedEntryOf(parser) {
    if (parser.value("id") !== "0")
      return null;
    if (parser.sequence === void 0)
      return null;
    const text = parser.value("text");
    if (parser.command === "textinput" && parser.length === 4 && text !== void 0)
      return { kind: "text", text, tickets: [] };
    const before = parser.count("before");
    const after = parser.count("after");
    if (parser.command === "removetextcontext" && parser.length === 5 && before !== void 0 && after !== void 0)
      return { kind: "remove", before, after, tickets: [] };
    return null;
  }
  /// Keeps the entry until the keys are let go, in place of what was held for the same thing:
  /// the newest mapping of each object, the newest state of anything else, the undos or the
  /// redos added up.
  static hold(entry) {
    if (entry.kind === "undo" || entry.kind === "redo") {
      const before = _ChangeOutbox.held.get(entry.kind);
      if (before && before.kind === entry.kind)
        before.count += entry.count;
      else
        _ChangeOutbox.held.set(entry.kind, entry);
      return;
    }
    if (entry.kind === "transform") {
      const before = _ChangeOutbox.held.get("transform");
      if (before && before.kind === "transform") {
        for (const [objectId, mapping] of entry.mappings)
          before.mappings.set(objectId, mapping);
        before.what = entry.what;
        before.tickets.push(...entry.tickets);
      } else
        _ChangeOutbox.held.set("transform", entry);
      return;
    }
    if (entry.kind === "other") {
      const before = _ChangeOutbox.held.get(entry.channel);
      if (before && before.kind === "other")
        entry.tickets.unshift(...before.tickets);
      _ChangeOutbox.held.set(entry.channel, entry);
    }
  }
  /// Sends what keys have made, once they are let go or the window loses the keyboard.
  static letGoOfWhatIsHeld() {
    _ChangeOutbox.keysDown.clear();
    if (!_ChangeOutbox.held.size)
      return;
    for (const entry of _ChangeOutbox.held.values()) {
      _ChangeOutbox.merge(entry);
      const last = _ChangeOutbox.waiting[_ChangeOutbox.waiting.length - 1];
      if (last && (last.kind === "transform" || last.kind === "other"))
        last.sealed = true;
    }
    _ChangeOutbox.held.clear();
    _ChangeOutbox.sendTheNext();
  }
  /// Adds the entry to what is waiting, merged into the last waiting entry where they go
  /// together and that one is not sealed: changes of objects keep the newest state of each
  /// thing, and undos or redos add up. An entry of another kind waits behind.
  static merge(entry) {
    const last = _ChangeOutbox.waiting[_ChangeOutbox.waiting.length - 1];
    if (last && last.kind === "transform" && !last.sealed && entry.kind === "transform" && last.what === entry.what) {
      for (const [objectId, mapping] of entry.mappings)
        last.mappings.set(objectId, mapping);
      last.tickets.push(...entry.tickets);
      return;
    }
    if (last && last.kind === "other" && !last.sealed && entry.kind === "other" && last.channel === entry.channel) {
      last.message = entry.message;
      last.tickets.push(...entry.tickets);
      return;
    }
    if (last && (last.kind === "undo" || last.kind === "redo") && last.kind === entry.kind) {
      last.count += entry.count;
      return;
    }
    if (last && last.kind === "text" && entry.kind === "text") {
      last.text += entry.text;
      last.tickets.push(...entry.tickets);
      return;
    }
    if (last && last.kind === "remove" && entry.kind === "remove" && (last.after === 0 || entry.before === 0)) {
      last.before += entry.before;
      last.after += entry.after;
      last.tickets.push(...entry.tickets);
      return;
    }
    _ChangeOutbox.waiting.push(entry);
  }
  /// Sends the waiting entries in their order while fewer than mostInFlight are in flight.
  static sendTheNext() {
    while (_ChangeOutbox.inFlight.length < _ChangeOutbox.mostInFlight && _ChangeOutbox.waiting.length) {
      const next = _ChangeOutbox.waiting[0];
      if ((next.kind === "text" || next.kind === "remove") && next.ready === false)
        return;
      _ChangeOutbox.send(_ChangeOutbox.waiting.shift());
    }
  }
  /// Sends the entry, numbered now, which is in flight from now on.
  static send(entry) {
    const wait = setTimeout(() => _ChangeOutbox.answered(wait), _ChangeOutbox.longestWait);
    let message = _ChangeOutbox.messageOf(entry);
    let sequence;
    if (entry.kind === "undo" || entry.kind === "redo") {
      _ChangeOutbox.undosUnanswered++;
      _ChangeOutbox.undoSettling = false;
      _ChangeOutbox.undoKind = entry.kind;
      _ChangeOutbox.awaitTheUndos(_ChangeOutbox.longestUndoWait);
    }
    if ("tickets" in entry) {
      sequence = cool.InputSequence.next(entry.tickets, false);
      message += " sequence=" + sequence;
    }
    _ChangeOutbox.inFlight.push({ wait, sequence });
    _ChangeOutbox.sending = true;
    try {
      app.socket.sendMessage(message);
    } finally {
      _ChangeOutbox.sending = false;
    }
  }
  /// The message an entry goes out as, before its sequence token. An undo or a redo of more
  /// than one step names the number, which the engine's undo takes as an argument.
  static messageOf(entry) {
    if (entry.kind === "other")
      return entry.message;
    if (entry.kind === "text")
      return "textinput id=0 text=" + entry.text;
    if (entry.kind === "remove")
      return "removetextcontext id=0 before=" + entry.before + " after=" + entry.after;
    if (entry.kind === "transform")
      return "setobjecttransform to=" + Array.from(entry.mappings.values()).join(";") + " as=" + entry.what;
    const command = entry.kind === "undo" ? "Undo" : "Redo";
    if (entry.count === 1)
      return "uno .uno:" + command;
    return "uno .uno:" + command + " " + JSON.stringify({
      [command]: { type: "unsigned short", value: String(entry.count) }
    });
  }
  /// A change in flight was answered, the oldest one, or the one of that wait was waited for
  /// long enough: the next one may go.
  static answered(wait) {
    const at = wait === void 0 ? 0 : _ChangeOutbox.inFlight.findIndex((one) => one.wait === wait);
    if (at < 0 || at >= _ChangeOutbox.inFlight.length)
      return;
    clearTimeout(_ChangeOutbox.inFlight[at].wait);
    _ChangeOutbox.inFlight.splice(at, 1);
    _ChangeOutbox.sendTheNext();
  }
  /*
      The engine's delta answered everything in flight up to the newest message with a sequence
      number at most inputSequence. A delta below the number of the oldest change in flight
      answers none, as it reflects an input sent before that change or another view's edit. An
      undo or a redo has no number, so where one is the oldest in flight, it takes the delta. A
      delta without a number answers the oldest change.
  */
  static deltaArrived(inputSequence) {
    var _a;
    let answered = 1;
    if (inputSequence !== void 0) {
      answered = ((_a = _ChangeOutbox.inFlight[0]) == null ? void 0 : _a.sequence) === void 0 ? 1 : 0;
      _ChangeOutbox.inFlight.forEach((one, at) => {
        if (one.sequence !== void 0 && one.sequence <= inputSequence)
          answered = at + 1;
      });
    }
    for (const one of _ChangeOutbox.inFlight.splice(0, answered))
      clearTimeout(one.wait);
    _ChangeOutbox.sendTheNext();
  }
  /// Takes the undos and redos that went out as all in after that many milliseconds.
  static awaitTheUndos(milliseconds) {
    if (_ChangeOutbox.undoTimeout)
      clearTimeout(_ChangeOutbox.undoTimeout);
    _ChangeOutbox.undoTimeout = setTimeout(() => _ChangeOutbox.undosAreIn(), milliseconds);
  }
  /*
      The undos and redos that went out are all in, or were waited for long enough. What waits
      for them runs, unless more of them wait to go out still.
  */
  static undosAreIn() {
    if (_ChangeOutbox.undoTimeout)
      clearTimeout(_ChangeOutbox.undoTimeout);
    _ChangeOutbox.undoTimeout = null;
    _ChangeOutbox.undosUnanswered = 0;
    _ChangeOutbox.undoSettling = false;
    if (_ChangeOutbox.undoOnItsWay() || !_ChangeOutbox.afterTheUndos.length)
      return;
    const waiting = _ChangeOutbox.afterTheUndos;
    _ChangeOutbox.afterTheUndos = [];
    for (const callback of waiting)
      callback();
  }
  /// Runs the callback once no undo or redo is on its way any more; at once where none is.
  static whenTheUndosAreIn(callback) {
    if (!_ChangeOutbox.undoOnItsWay()) {
      callback();
      return;
    }
    _ChangeOutbox.afterTheUndos.push(callback);
  }
  /// The key with that code was let go: once no key is down, what keys made goes out.
  static keyIsUp(code) {
    if (code === _ChangeOutbox.repeatingKey)
      _ChangeOutbox.repeatingKey = "";
    _ChangeOutbox.keysDown.delete(code);
    if (!_ChangeOutbox.keysDown.size)
      _ChangeOutbox.letGoOfWhatIsHeld();
  }
  /// The engine reported the result of an undo or a redo that went out. After the last of them
  /// the delta it brings is waited for a short while more.
  static undoReported() {
    if (_ChangeOutbox.undosUnanswered <= 0)
      return;
    if (--_ChangeOutbox.undosUnanswered > 0)
      return;
    _ChangeOutbox.undoSettling = true;
    _ChangeOutbox.awaitTheUndos(_ChangeOutbox.deltaAfterUndo);
  }
  /*
      Listens for the engine's deltas, which answer what is in flight and, after the results of
      the undos and redos that went out, the last of them - a change laid on here is announced
      with an empty list and answers nothing - for the results of undos and redos, and for the
      keys being let go and the window losing the keyboard, which send what keys have made.
  */
  static listen() {
    if (_ChangeOutbox.listening)
      return;
    _ChangeOutbox.listening = true;
    document.addEventListener("keydown", (event) => {
      const undoKey = (event.ctrlKey || event.metaKey) && (event.code === "KeyZ" || event.code === "KeyY");
      _ChangeOutbox.repeatingKey = undoKey && event.repeat ? event.code : "";
    }, true);
    RenderManager.onVectorChanged((answered, inputSequence) => {
      if (answered !== void 0 && !answered.length)
        return;
      if (_ChangeOutbox.undoSettling)
        _ChangeOutbox.undosAreIn();
      if (_ChangeOutbox.inFlight.length)
        _ChangeOutbox.deltaArrived(inputSequence);
    });
    app.map.on("commandresult", (event) => {
      if (event.commandName === ".uno:Undo" || event.commandName === ".uno:Redo")
        _ChangeOutbox.undoReported();
    });
    document.addEventListener("keyup", (event) => _ChangeOutbox.keyIsUp(event.code || event.key), true);
    window.addEventListener("blur", () => _ChangeOutbox.letGoOfWhatIsHeld());
  }
};
_ChangeOutbox.longestWait = 400;
_ChangeOutbox.longestUndoWait = 1e4;
_ChangeOutbox.deltaAfterUndo = 250;
_ChangeOutbox.namedStates = {
  setobjecthandle: " x=",
  setobjectcontrolpoint: " x=",
  setobjectgluepoint: " x=",
  cropobject: " x1=",
  setobjectpoints: " changes="
};
_ChangeOutbox.waiting = [];
_ChangeOutbox.held = /* @__PURE__ */ new Map();
_ChangeOutbox.keysDown = /* @__PURE__ */ new Set();
_ChangeOutbox.usualMostInFlight = 4;
_ChangeOutbox.mostInFlight = _ChangeOutbox.usualMostInFlight;
_ChangeOutbox.textWait = 0;
_ChangeOutbox.inFlight = [];
_ChangeOutbox.undosUnanswered = 0;
_ChangeOutbox.undoSettling = false;
_ChangeOutbox.undoKind = "undo";
_ChangeOutbox.undoTimeout = null;
_ChangeOutbox.listening = false;
_ChangeOutbox.sending = false;
_ChangeOutbox.madeByAKey = false;
_ChangeOutbox.repeatingKey = "";
_ChangeOutbox.undoAskedAt = 0;
_ChangeOutbox.afterTheUndos = [];
let ChangeOutbox = _ChangeOutbox;
