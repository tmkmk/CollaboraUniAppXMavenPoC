const _TurningInteraction = class _TurningInteraction extends SelectionInteraction {
  constructor(selection, middle, at) {
    super(selection);
    this.turned = 0;
    this.stood = 0;
    this.middle = middle;
    this.from = _TurningInteraction.angleAt(middle, at);
    this.radius = Math.hypot(at.x - middle.x, at.y - middle.y);
    this.stood = selection.angleOfTheSquare();
  }
  /// The angle from the middle to that point, as the canvas counts angles.
  static angleAt(middle, point) {
    return Math.atan2(point.y - middle.y, point.x - middle.x);
  }
  /*
      Turns the objects of a selection around a point by that many degrees, counted against the
      clock. Every object is handed the mapping it is to be drawn by, which is the one it would
      be drawn by here, so that what is shown and what is sent are the same thing.
  */
  static turnObjects(selection, middle, degrees) {
    if (!degrees)
      return null;
    const matrix = _TurningInteraction.turnAbout(middle, degrees);
    const ticket = SelectionSection.sendTransform(selection.selectedObjects(), matrix, "turn");
    return { change: matrix, ticket };
  }
  /// The change that turns the objects around that point by that many degrees, counted against
  /// the clock. The canvas counts an angle with the clock, so it is handed the other sign.
  static turnAbout(middle, degrees) {
    return cool.Matrix2D.IDENTITY.rotateAround(middle.x, middle.y, -degrees * Math.PI / 180);
  }
  /*
      Follows the mouse. While a modifier is held the angle the selection ends up standing at is
      snapped to the step it names, counted from the page and not from where the turn began, so
      a turned object goes straight back to standing upright. The angle the selection stands at
      is that of the across axis of its square: an object's own, nought for a frame around
      several, which then snaps the turn itself. While the mouse is on one of the marks it is
      that mark's: standing upright.
  */
  move(to, event) {
    this.turned = _TurningInteraction.angleAt(this.middle, to) - this.from;
    const step = EditSteps.turnSnap(event);
    if (step && this.selection.squareNow()) {
      const stands = this.selection.angleOfTheSquare();
      const stepInRadians = step * Math.PI / 180;
      const snapped = Math.round((stands + this.turned) / stepInRadians) * stepInRadians;
      this.turned = snapped - stands;
    }
    this.turned = SelectionInteraction.heldToTheMarks(this.turned, this.marks(), to);
    this.selection.redraw();
  }
  /// The angle the selection stands at now, as the engine counts it: against the clock, from
  /// nought up to a full turn.
  reading() {
    return _TurningInteraction.readingOf(this.stood + this.turned);
  }
  /// The angle and the middle the turn keys left the selection at, where they were the last to
  /// change it; nothing otherwise.
  static keysStillHold(selection) {
    const keys = _TurningInteraction.keys;
    return keys && keys.objects === selection.selectedObjects().join(",") ? { stands: keys.stands, middle: keys.middle } : null;
  }
  /// Takes in that the turn keys left the selection at that angle, as the engine counts it,
  /// turned around that middle.
  static keysLeftItAt(selection, stands, middle) {
    const objects = selection.selectedObjects();
    _TurningInteraction.keys = {
      objects: objects.join(","),
      drawing: new Set(RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(objects))),
      stands,
      middle
    };
  }
  /// Ends the turn keys gave, so the next key starts from the selection as it stands. Given an
  /// object, only where the keys turned that one.
  static forgetTheKeys(objectId) {
    const keys = _TurningInteraction.keys;
    if (objectId !== void 0 && keys && !keys.drawing.has(objectId))
      return;
    _TurningInteraction.keys = null;
  }
  /// An angle the canvas counts as it is written, as the engine counts it: against the clock,
  /// in whole degrees from nought up to a full turn.
  static readingOf(angle) {
    const full = Math.PI * 2;
    const text = SelectionInteraction.degreesOf((-angle % full + full) % full);
    return text === "360\xB0" ? "0\xB0" : text;
  }
  /// The mark of standing upright, where the handle of the selection without a turn stands.
  marks() {
    return [
      SelectionInteraction.markAt(this.middle, this.radius, this.from - this.stood, -this.stood, "0\xB0")
    ];
  }
  finish(to, event) {
    this.move(to, event);
    const sent = _TurningInteraction.turnObjects(this.selection, this.middle, -this.turned * 180 / Math.PI);
    this.sentWith = (sent == null ? void 0 : sent.ticket) ?? null;
  }
  transformation() {
    if (!this.turned)
      return null;
    return _TurningInteraction.turnAbout(this.middle, -this.turned * 180 / Math.PI);
  }
  handles(known) {
    const matrix = cool.Matrix2D.IDENTITY.rotateAround(this.middle.x, this.middle.y, this.turned);
    return ObjectHandles.facedAwayFromTheirPlaces(known.map((handle) => ({
      ...handle,
      point: matrix.apply(handle.point.x, handle.point.y).round()
    })));
  }
};
_TurningInteraction.keys = null;
let TurningInteraction = _TurningInteraction;
