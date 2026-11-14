const _ShearingInteraction = class _ShearingInteraction extends SelectionInteraction {
  constructor(selection, middle, at, turnedBy) {
    super(selection);
    this.slantTo = 0;
    this.down = null;
    this.startSlant = 0;
    this.middle = middle;
    this.from = _ShearingInteraction.angleAt(middle, at);
    this.radius = Math.hypot(at.x - middle.x, at.y - middle.y);
    const objects = selection.selectedObjects();
    const drawing = RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(objects));
    const single = objects.length === 1 && drawing.length === 1 && drawing[0] === objects[0];
    const mapping = single ? RenderGeometrySection.transformOf(objects[0]) : selection.mappingTheyShare() ?? selection.squareNow();
    let turn = turnedBy;
    if (mapping) {
      const own = Math.atan2(mapping.b, mapping.a);
      turn = Math.cos(own - turnedBy) >= 0 ? own : own + Math.PI;
    }
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    this.frame = new cool.Matrix2D(cos, sin, -sin, cos, middle.x, middle.y);
    this.upright = Math.atan2(-cos, sin);
    if (mapping) {
      this.down = new cool.Point(mapping.c * cos + mapping.d * sin, -mapping.c * sin + mapping.d * cos);
      this.startSlant = Math.atan2(-this.down.x, this.down.y);
    }
    this.slantTo = this.startSlant;
  }
  /// The slant keys gave the selection where they were the last to change it.
  static keysStillHold(selection) {
    const keys = _ShearingInteraction.keys;
    if (!keys || keys.objects !== selection.selectedObjects().join(","))
      return null;
    return keys.shearing;
  }
  /// Ends the slant keys gave, so the next key starts from the objects as they stand. Given an
  /// object, only where the keys changed that one.
  static forgetTheKeys(objectId) {
    const keys = _ShearingInteraction.keys;
    if (objectId !== void 0 && keys && !keys.mappings.has(objectId))
      return;
    _ShearingInteraction.keys = null;
  }
  /*
      Slants the selection around that middle, in the frame turned by that angle, to the slant
      worked out from the one there is, both in degrees as the canvas counts angles. Where keys
      gave the slant there is, it goes on from their start. Sends the change and gives it back
      with the ticket of its message, or nothing where the slant stays.
  */
  static shearObjects(selection, middle, turnedBy, slantFrom) {
    let shearing = _ShearingInteraction.keysStillHold(selection);
    if (!shearing || !_ShearingInteraction.keys) {
      const objects2 = selection.selectedObjects();
      const first = objects2.length ? RenderGeometrySection.transformOf(objects2[0]) : null;
      if (!first)
        return null;
      shearing = new _ShearingInteraction(selection, middle, middle, turnedBy);
      const mappings = /* @__PURE__ */ new Map();
      for (const objectId of RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(objects2))) {
        const mapping = RenderGeometrySection.transformOf(objectId);
        if (mapping)
          mappings.set(objectId, mapping);
      }
      _ShearingInteraction.keys = {
        shearing,
        mappings,
        objects: objects2.join(","),
        laid: cool.Matrix2D.IDENTITY
      };
    }
    const keys = _ShearingInteraction.keys;
    const stands = shearing.slantTo * 180 / Math.PI;
    shearing.slantTo = SelectionInteraction.normalAngle(slantFrom(stands) * Math.PI / 180);
    const wanted = shearing.transformation() ?? cool.Matrix2D.IDENTITY;
    const back = keys.laid.invert();
    if (!back)
      return null;
    const change = back.then(wanted);
    if (change.equals(cool.Matrix2D.IDENTITY, 1e-9))
      return null;
    const objects = selection.selectedObjects();
    const ticket = SelectionSection.sendTransform(objects, wanted, "shear", keys.mappings);
    keys.laid = wanted;
    return { change, ticket };
  }
  /*
      The slant the selection has, in the frame turned by that angle, as the canvas counts
      angles: the one keys gave it where they were the last to change it, or the one read from
      the first object. Near ninety degrees the object's axis says little about the slant, since
      the shear stays at eighty-nine there.
  */
  static slantOf(selection, turnedBy) {
    const keys = _ShearingInteraction.keysStillHold(selection);
    if (keys)
      return keys.slantTo;
    const nowhere = new cool.SimplePoint(0, 0);
    return new _ShearingInteraction(selection, nowhere, nowhere, turnedBy).startSlant;
  }
  /// A slant as it is written, in whole degrees from minus half a turn to half a turn.
  static readingOf(slant) {
    return SelectionInteraction.degreesOf(SelectionInteraction.normalAngle(slant));
  }
  /// An angle in degrees brought into the turn from minus half a turn to half a turn.
  static degreesInTheTurn(degrees) {
    return ((degrees + 180) % 360 + 360) % 360 - 180;
  }
  /// The angle from the middle to that point, as the canvas counts angles.
  static angleAt(middle, point) {
    return Math.atan2(point.y - middle.y, point.x - middle.x);
  }
  /*
      The slant in its own coordinates for the mouse having gone that far round, as the office's
      SdrDragShear works it out: the upright axis is scaled by the cosine of the angle, which
      turns it over between ninety and two hundred and seventy degrees, and then sheared by the
      angle, taken back by half a turn while upside down and held to eighty-nine degrees.
      Together the upright axis turns by the angle and keeps its length, except within a degree
      of ninety either way, where the held shear makes it shorter.
  */
  static slant(turned) {
    const degrees = _ShearingInteraction.degreesInTheTurn(turned * 180 / Math.PI);
    const negative = degrees < 0;
    const size = Math.abs(degrees);
    const upsideDown = size > 90;
    const cos = Math.cos(size * Math.PI / 180);
    const scale = upsideDown ? cos : Math.max(cos, 0.01);
    let shear = upsideDown ? size - 180 : size;
    shear = Math.max(-89, Math.min(89, shear));
    if (negative)
      shear = -shear;
    return new cool.Matrix2D(1, 0, -scale * Math.tan(shear * Math.PI / 180), scale, 0, 0);
  }
  /*
      Follows the mouse. While a modifier is held the slant snaps to the step it names, counted
      from nought; while the mouse is on a mark it is that mark's.
  */
  move(to, event) {
    let slant = SelectionInteraction.normalAngle(this.startSlant + _ShearingInteraction.angleAt(this.middle, to) - this.from);
    const step = EditSteps.turnSnap(event);
    if (step) {
      const stepInRadians = step * Math.PI / 180;
      slant = Math.round(slant / stepInRadians) * stepInRadians;
    }
    this.slantTo = SelectionInteraction.heldToTheMarks(slant, this.marks(), to);
    this.selection.redraw();
  }
  /// The slant the selection gets.
  reading() {
    return _ShearingInteraction.readingOf(this.slantTo);
  }
  /// The mark of no slant, straight above the middle at a right angle to the upper side.
  marks() {
    return [
      SelectionInteraction.markAt(this.middle, this.radius, this.upright, 0, "0\xB0")
    ];
  }
  finish(to, event) {
    this.move(to, event);
    const matrix = this.transformation();
    if (matrix)
      this.sentWith = SelectionSection.sendTransform(this.selection.selectedObjects(), matrix, "shear");
  }
  /*
      The change on the page: out of the page into the slant's coordinates, the change there,
      and back. In the slant's coordinates the upper side stays, and the axis down from it goes
      from where it stands to where the slant puts it, keeping its length. Nothing where the
      slant is the one there was.
  */
  transformation() {
    const down = this.down;
    if (!down || !down.y)
      return null;
    if (Math.abs(SelectionInteraction.normalAngle(this.slantTo - this.startSlant)) < 1e-6)
      return null;
    const back = this.frame.invert();
    if (!back)
      return null;
    const length = Math.hypot(down.x, down.y);
    const slant = _ShearingInteraction.slant(this.slantTo);
    const wantedAcross = slant.c * length;
    const wantedDown = slant.d * length;
    const change = new cool.Matrix2D(1, 0, (wantedAcross - down.x) / down.y, wantedDown / down.y, 0, 0);
    return back.then(change).then(this.frame);
  }
  handles(known) {
    const matrix = this.transformation();
    if (!matrix)
      return known;
    return ObjectHandles.facedAwayFromTheirPlaces(known.map((handle) => ({
      ...handle,
      point: matrix.apply(handle.point.x, handle.point.y).round()
    })));
  }
};
_ShearingInteraction.keys = null;
let ShearingInteraction = _ShearingInteraction;
