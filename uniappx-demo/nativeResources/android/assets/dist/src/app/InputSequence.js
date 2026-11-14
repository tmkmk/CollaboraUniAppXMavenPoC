var cool;
(function(cool2) {
  class InputTicket {
    /// The number the message went out with, or undefined before it is stamped.
    sentAs() {
      return this.sequence;
    }
    /// Whether an answer naming that number as the newest applied input reflects this one.
    appliedBy(inputSequence) {
      return this.sequence !== void 0 && this.sequence <= inputSequence;
    }
    /// Sets the number, again when the message is stamped again.
    goesOutAs(sequence) {
      this.sequence = sequence;
    }
    /// Drops the number, as the message gave it back.
    takenBack() {
      this.sequence = void 0;
    }
  }
  cool2.InputTicket = InputTicket;
  const _InputSequence = class _InputSequence {
    /// A ticket for the next message stamped.
    static ticketForTheNextMessage() {
      const ticket = new InputTicket();
      _InputSequence.forTheNextMessage.push(ticket);
      return ticket;
    }
    /*
        Takes the next number and gives it to the named tickets, and to those waiting for the
        next message unless the message carries no change of its own.
    */
    static next(tickets = [], withTheWaiting = true) {
      app.file.inputSequence += 1;
      const sequence = app.file.inputSequence;
      _InputSequence.lastTickets = withTheWaiting ? [...tickets, ..._InputSequence.forTheNextMessage] : [...tickets];
      if (withTheWaiting)
        _InputSequence.forTheNextMessage = [];
      for (const ticket of _InputSequence.lastTickets)
        ticket.goesOutAs(sequence);
      return sequence;
    }
    /// Appends the next number to the message as its sequence token, ahead of the line break
    /// that a key message ends with.
    static stamp(message, tickets = []) {
      return new MessageParser(message).with("sequence", _InputSequence.next(tickets));
    }
    /*
        Takes the number back from the message stamped last, so that the next message stamped
        gets it, and returns the message without the token and the tickets that held the
        number. Null for any other message, which keeps its number.
    */
    static unstamp(message) {
      const parser = new MessageParser(message);
      const sequence = parser.sequence;
      if (sequence === void 0 || sequence !== app.file.inputSequence)
        return null;
      app.file.inputSequence -= 1;
      const tickets = _InputSequence.lastTickets;
      _InputSequence.lastTickets = [];
      for (const ticket of tickets)
        ticket.takenBack();
      return { message: parser.without("sequence"), tickets };
    }
    /// Drops the tickets waiting for the next message and those of the message stamped last.
    static forget() {
      _InputSequence.forTheNextMessage = [];
      _InputSequence.lastTickets = [];
    }
    /// The number in the "inputSequence=<number>" of a header line from the kit, if any.
    static readFrom(header) {
      const sequence = parseInt(header.split("inputSequence=")[1] ?? "");
      return isNaN(sequence) || sequence <= 0 ? void 0 : sequence;
    }
  };
  _InputSequence.forTheNextMessage = [];
  _InputSequence.lastTickets = [];
  let InputSequence = _InputSequence;
  cool2.InputSequence = InputSequence;
})(cool || (cool = {}));
