class ShownPoints {
  constructor(showCommand, addCommand) {
    this.shownFor = null;
    this.beingAdded = false;
    this.shownToldAs = false;
    this.addingToldAs = false;
    this.showCommand = showCommand;
    this.addCommand = addCommand;
  }
  /// Whether the points are shown for the selection of that key.
  areShownFor(key) {
    return this.shownFor === key;
  }
  /// Whether the next press on the object of that selection adds a point.
  areAddedFor(key) {
    return this.beingAdded && this.areShownFor(key);
  }
  /// Shows the points for the selection of that key, or hides them for null.
  showFor(key) {
    this.shownFor = key;
    if (key === null)
      this.beingAdded = false;
  }
  /// Makes the next press on the object add a point.
  startAdding() {
    this.beingAdded = true;
  }
  /// Makes the next press on the object add no point. Returns whether a point was being added.
  stopAdding() {
    if (!this.beingAdded)
      return false;
    this.beingAdded = false;
    return true;
  }
  /// Tells the toolbars whether the points are shown and whether a point is being added. Each
  /// state is told only when it changed.
  tell(shown, adding) {
    if (shown !== this.shownToldAs) {
      this.shownToldAs = shown;
      app.map.fire("commandstatechanged", {
        commandName: this.showCommand,
        state: shown ? "true" : "false"
      });
    }
    if (adding !== this.addingToldAs) {
      this.addingToldAs = adding;
      app.map.fire("commandstatechanged", {
        commandName: this.addCommand,
        state: adding ? "true" : "false"
      });
    }
  }
}
const _HandleGroup = class _HandleGroup {
  constructor(selection) {
    this.selection = selection;
  }
  /*
      Opens a menu with these entries, the given number of core pixels below the handle. When
      an entry is chosen, the menu and its submenus close, and chosen gets the id of the entry.
  */
  openAMenuBelow(handle, below, menuId, entries, chosen) {
    var _a;
    const container = document.getElementById("canvas-container");
    if (!container)
      return;
    if (!((_a = _HandleGroup.menuAnchor) == null ? void 0 : _a.isConnected)) {
      _HandleGroup.menuAnchor = document.createElement("div");
      _HandleGroup.menuAnchor.style.position = "absolute";
      _HandleGroup.menuAnchor.style.zIndex = "1500";
      container.append(_HandleGroup.menuAnchor);
    }
    const drawnAt = HandleLook.drawnAt(handle);
    const anchor = _HandleGroup.menuAnchor;
    anchor.style.left = drawnAt.vX / app.dpiScale + "px";
    anchor.style.top = (drawnAt.vY + below) / app.dpiScale + "px";
    JSDialog.OpenDropdown(menuId, anchor, entries, (_objectType, eventType, _object, _data, entry) => {
      if (eventType !== "selected")
        return false;
      JSDialog.CloseAllDropdowns();
      chosen((entry == null ? void 0 : entry.id) ?? "");
      return true;
    }, "", false, false, true);
  }
  /// The handles it has, worked out from the objects of the selection.
  handles() {
    return [];
  }
  /// What it draws thin of the objects while no drag runs, in twips: an object as handles
  /// moved by keys, or let go of, would leave it before the engine has answered. Nothing for
  /// most groups.
  outline() {
    return null;
  }
  /*
      Where its handles stand while a drag runs, from all of them as the drag leaves them.
      Nothing where they simply travel with the drag, which is what most of them do.
  */
  place(_shown) {
    return null;
  }
  /// Anything it draws besides the handles themselves, drawn under them.
  paint(_section, _shown) {
  }
  /// Whether a press that is on none of the handles lands on this group.
  takesAPress(_x, _y) {
    return false;
  }
  /*
      Whether its handles are shown now: drawn, reached by a press and walked by the keyboard.
      A hidden group still has its handles worked out, so the frame of the selection and its
      middle are measured from them as always.
  */
  isShown() {
    return true;
  }
  /// Whether one of its handles blinks while the keyboard is on it. Most of them do.
  blinksWhileActive() {
    return true;
  }
  /// How far from its middle a press takes hold of one of its handles, from how far it does for
  /// a handle of the usual size, in core pixels. Most groups take that distance.
  reachOf(usual) {
    return usual;
  }
  /// What a press on one of its handles does when it is let go where it started, besides
  /// putting the keyboard on that handle. Nothing for most groups.
  letGoWhereItWasPressed(_handle, _event) {
  }
  /// Whether that handle of it is dragged, or only clicked, as a button is. Dragged for most
  /// groups.
  dragsTheHandle(_handle) {
    return true;
  }
  /// Whether it answers a click that took no handle itself, at that place and with those
  /// modifiers, before the selection does what such a click does. No for most groups.
  answersTheClick(_at, _modifier) {
    return false;
  }
  /// Whether its handles belong inside the band of a group the selection stands in, so the band
  /// grows round them. No for most groups, whose handles stand at what is selected.
  extendsTheBand() {
    return false;
  }
  /// What Return or Space does on one of its handles while the keyboard is on it. Answers
  /// whether it did something; nothing for most groups.
  pressByKey(_handle, _event) {
    return false;
  }
  /// The drag a press on one of its handles begins, or nothing where it begins none.
  interactionFor(_handle, _at) {
    return null;
  }
  /// The drag a press that reached no handle begins, for a group that answers for a place.
  interactionForThePlace(_at) {
    return null;
  }
  /// Whether that handle keeps its place on the page while the objects are moved or scaled,
  /// rather than going along with them. None does for most groups.
  keepsItsPlace(_handle) {
    return false;
  }
  /*
      Whether a press this group took is handed to the engine as a click of its own when it
      turns out not to be a drag. The engine hit tests it and selects what it finds, which is
      how a click through the box of a selection reaches an object behind it.
  */
  passesTheClickOn() {
    return true;
  }
  /*
      What an arrow key does to one of its handles, which is what a drag of it would do. Answers
      where the handle lands, so the view can follow it, and nothing where it goes nowhere.
  */
  moveByKey(_handle, _towards, _event) {
    return null;
  }
  /*
      Hands the engine what a drag of one of its handles did, once the drag has ended. What that
      is differs from group to group: a handle the engine knows is named to it, a point of a
      path is named as a point of that path, a point to tie a connector to is moved where it
      was let go. With ortho set, it was moved while Shift was held.
  */
  handOver(_handle, _to, _ortho = false) {
  }
  /// Where one of its handles may go, from where the mouse has taken it. Most of them go where
  /// the mouse goes.
  holdInside(_handle, at) {
    return at;
  }
  /*
      Hands the engine a handle that was moved, naming the object and the handle. The object
      reads the move its own way - a corner radius, the angle a piece of a circle begins at,
      the offset of a measurement - and nothing about a selection is needed for it.
  */
  sendTheHandle(handle, to, ortho = false) {
    const objectId = this.selection.selectedObjects()[0];
    if (objectId === void 0)
      return;
    const named = handle.name.split(".");
    app.socket.sendMessage("setobjecthandle id=" + String(objectId) + " kind=" + String(Number(handle.kind)) + " polygon=" + String(Number(named[1] ?? 0)) + " point=" + String(Number(named[2] ?? 0)) + " at=" + String(handle.at ?? -1) + " x=" + String(Math.round(to.x)) + " y=" + String(Math.round(to.y)) + // The engine moves the handle as the office does while Shift is held.
    (ortho ? " ortho=1" : ""));
  }
  /*
      Moves the handle a key step and hands the engine where it landed, the way the end of a
      drag of it would, held where a drag of it is held. Answers where it landed. A handle goes
      on from where keys have taken it so far, so that a key held down goes on step by step
      before the engine has answered.
  */
  stepAndHandOver(handle, towards, event) {
    const to = this.holdInside(handle, _HandleGroup.steppedBy(HeldSteps.from(this.selection, handle), towards, event));
    this.handOver(handle, to);
    return to;
  }
  /// Where a key takes the handle it is on, in twips.
  static steppedBy(handle, towards, event) {
    const step = HandleTravel.stepFor(event);
    return new cool.Point(handle.point.x + towards.x * step, handle.point.y + towards.y * step).round();
  }
};
_HandleGroup.menuAnchor = null;
let HandleGroup = _HandleGroup;
class FramingHandles extends HandleGroup {
  constructor() {
    super(...arguments);
    this.name = "framing";
  }
  /// The eight handles are hidden while the points to tie a connector to, the points of the
  /// path or the crop marks are shown.
  isShown() {
    return !this.selection.tiePointsAreShown() && !this.selection.pathPointsAreShown() && !CropHandles.areShownFor(this.selection);
  }
  handles() {
    return ObjectHandles.framingOf(this.selection.selectedObjects(), this.selection.squareNow()) ?? [];
  }
  /*
      A key on one of the eight scales the selection as a drag of that handle would, and hands
      the engine what a drag hands it: the mapping every object is to be drawn by. The drag
      works that mapping out, so the key borrows the drag rather than saying it again.
  */
  moveByKey(handle, towards, event) {
    const shape = this.selection.shapeNow();
    if (!shape)
      return null;
    const to = HandleGroup.steppedBy(handle, towards, event);
    const scaling = new ScalingInteraction(this.selection, handle, shape).exactlyAsTold();
    scaling.finish(new cool.SimplePoint(to.x, to.y), event);
    const change = scaling.transformation();
    this.selection.layTheChangeOn(change, scaling.ticketOfTheChange());
    if (!change)
      return to;
    return change.apply(handle.point.x, handle.point.y).round();
  }
  shape(context, handle, at, grown) {
    return HandleLook.lay(context, "framing", at, grown, handle.turnedBy);
  }
  interactionFor(handle, _at) {
    if (!ObjectHandles.canBeResized(this.selection.selectedObjects()))
      return null;
    const shape = this.selection.shapeNow();
    return shape ? new ScalingInteraction(this.selection, handle, shape) : null;
  }
}
const _CropHandles = class _CropHandles extends HandleGroup {
  constructor() {
    super(...arguments);
    this.name = "crop";
  }
  /// The picture the selection is, or nothing where it is not one picture.
  static thePictureOf(selection) {
    const objects = selection.selectedObjects();
    if (objects.length !== 1)
      return void 0;
    const object = RenderGeometrySection.objectOf(objects[0]);
    return (object == null ? void 0 : object.graphicWidth) !== void 0 ? object : void 0;
  }
  /// Whether the marks are shown at all: the crop switch is on and one picture is selected.
  static areShownFor(selection) {
    return GraphicSelection.cropping && _CropHandles.thePictureOf(selection) !== void 0 && ObjectHandles.canBeResized(selection.selectedObjects());
  }
  shown() {
    return _CropHandles.areShownFor(this.selection);
  }
  handles() {
    if (!this.shown())
      return [];
    const square = this.selection.squareNow();
    const eight = ObjectHandles.framingOf(this.selection.selectedObjects(), square) ?? [];
    if (!square)
      return [];
    const [across, down] = _CropHandles.axesOf(square);
    const marks = eight.map((one) => {
      const inward = _CropHandles.inwardOf(one.kind);
      return {
        name: "crop" + one.kind,
        kind: "crop" + one.kind,
        pointer: one.pointer,
        point: one.point.clone(),
        turnedBy: one.turnedBy,
        awayFromItsPlace: across.multiplyBy(inward.x).add(down.multiplyBy(inward.y)),
        awayBy: HandleLook.widthOf("crop") * 0.5
      };
    });
    marks.push({
      name: _CropHandles.middleKind,
      kind: _CropHandles.middleKind,
      pointer: "move",
      point: square.apply(0.5, 0.5),
      turnedBy: Math.atan2(across.y, across.x)
    });
    return marks;
  }
  /*
      Tells the engine to crop the picture to the window that square maps the unit square to,
      by two opposite corners of the window on the page, in twips. The window is named whole,
      whatever part of it moved.
  */
  static cropTo(objectId, window) {
    const upperLeft = window.apply(0, 0);
    const lowerRight = window.apply(1, 1);
    app.socket.sendMessage("cropobject id=" + String(objectId) + " x1=" + String(Math.round(upperLeft.x)) + " y1=" + String(Math.round(upperLeft.y)) + " x2=" + String(Math.round(lowerRight.x)) + " y2=" + String(Math.round(lowerRight.y)));
  }
  /// The two axes of that square, each a step of length one.
  static axesOf(square) {
    const unit = (axis) => axis.divideBy(axis.length() || 1);
    return [
      unit(new cool.Point(square.a, square.b)),
      unit(new cool.Point(square.c, square.d))
    ];
  }
  /// Which way is into the picture from the place of that one of the eight, along each axis;
  /// nought along an axis the place lies in the middle of.
  static inwardOf(kind) {
    const place = ObjectHandles.placeOfKind(kind) ?? new cool.Point(0.5, 0.5);
    return new cool.Point(place.x < 0.5 ? 1 : place.x > 0.5 ? -1 : 0, place.y < 0.5 ? 1 : place.y > 0.5 ? -1 : 0);
  }
  interactionFor(handle, _at) {
    if (handle.kind === _CropHandles.middleKind)
      return new CropPanInteraction(this.selection, handle);
    const shape = this.selection.shapeNow();
    return shape ? new CropInteraction(this.selection, handle, shape) : null;
  }
  /*
      A key crops as a drag of the mark to the stepped place would. The engine is told at once,
      and what the step did is kept here as a drag's end keeps it, so the next step of a key
      held down goes on from where this one left the handle.
  */
  moveByKey(handle, towards, event) {
    const to = HandleGroup.steppedBy(handle, towards, event);
    const place = new cool.SimplePoint(to.x, to.y);
    let crop;
    if (handle.kind === _CropHandles.middleKind) {
      const pan = new CropPanInteraction(this.selection, handle);
      pan.finish(place);
      crop = pan;
    } else {
      const shape = this.selection.shapeNow();
      if (!shape)
        return null;
      const mark = new CropInteraction(this.selection, handle, shape);
      mark.exactlyAsTold().finish(place, event);
      crop = mark;
    }
    this.selection.keepWhatItDid(crop);
    return to;
  }
  /*
      Where the whole graphic stands on the picture's square, as the corner it begins at and
      the corner it ends at: the visible window is the graphic less the crop, so the whole
      graphic runs from minus the crop before the window to one plus the crop after it. The
      crop belongs to the graphic before it is turned over, so on a picture that is drawn
      turned over the two sides of that axis change places. Nothing where the picture shows
      no graphic or is cropped to nothing.
  */
  static graphicExtentOf(picture) {
    if (!picture.graphicWidth || !picture.graphicHeight)
      return void 0;
    const mirror = picture.graphicMirror ?? 0;
    const left = (mirror & 1 ? picture.cropRight : picture.cropLeft) ?? 0;
    const right = (mirror & 1 ? picture.cropLeft : picture.cropRight) ?? 0;
    const top = (mirror & 2 ? picture.cropBottom : picture.cropTop) ?? 0;
    const bottom = (mirror & 2 ? picture.cropTop : picture.cropBottom) ?? 0;
    const visibleWidth = picture.graphicWidth - left - right;
    const visibleHeight = picture.graphicHeight - top - bottom;
    if (visibleWidth <= 0 || visibleHeight <= 0)
      return void 0;
    return new cool.Range2D(-left / visibleWidth, -top / visibleHeight, 1 + right / visibleWidth, 1 + bottom / visibleHeight);
  }
  /// The four corners of the unit square through that mapping, as an SVG path, in twips.
  static quadOf(mapping) {
    return [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ].map(([x, y], at) => {
      const corner = mapping.apply(x, y);
      return (at === 0 ? "M" : "L") + corner.x + " " + corner.y;
    }).join(" ") + " Z";
  }
  /*
      Draws the whole graphic faintly round the cropped picture, as the office does while one
      crops: what the crop took away is shown at a fifth, with a line round the whole, so one
      sees what a crop could bring back. The visible window is left out of the drawing, since
      the picture itself is there. The graphic is drawn from the image the picture's own
      primitives are drawn from, by its checksum, so nothing is fetched for it.
  */
  paint(section, _shown) {
    if (!this.shown())
      return;
    const picture = _CropHandles.thePictureOf(this.selection);
    const square = section.squareNow();
    const data = RenderGeometrySection.currentPart();
    if (!picture || !square || !data)
      return;
    if (picture.graphicChecksum === void 0)
      return;
    const extent = _CropHandles.graphicExtentOf(picture);
    if (!extent)
      return;
    const running = section.runningChange();
    if (!extent.minX && !extent.minY && extent.maxX === 1 && extent.maxY === 1 && !(running == null ? void 0 : running.cropOnly))
      return;
    let whole = cool.Matrix2D.fromRange(extent).then(square);
    let window = square;
    if (running) {
      window = window.then(running.matrix);
      if (!running.cropOnly)
        whole = whole.then(running.matrix);
    }
    const preview = {
      type: cool.UnifiedTransparencePrimitive.type,
      transparence: 0.8,
      children: [
        {
          type: cool.MaskPrimitive.type,
          clip: _CropHandles.quadOf(whole) + " " + _CropHandles.quadOf(window),
          children: [
            {
              type: cool.GraphicPrimitive.type,
              checksum: picture.graphicChecksum,
              matrix: whole.toArray(),
              mirror: picture.graphicMirror
            },
            {
              type: cool.PolygonHairlinePrimitive.type,
              path: _CropHandles.quadOf(whole),
              color: HandleLook.outlineOfADrag
            }
          ]
        }
      ]
    };
    const context = section.context;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    const origin = new cool.SimplePoint(0, 0);
    context.translate(origin.vX, origin.vY);
    context.scale(app.twipsToPixels, app.twipsToPixels);
    RenderManager.renderPrimitives(context, data, [preview]);
    if ((running == null ? void 0 : running.cropOnly) && picture.id !== void 0) {
      const everything = _CropHandles.quadBeyondEverything();
      const identity = cool.Matrix2D.IDENTITY;
      context.save();
      context.clip(new Path2D(_CropHandles.quadOf(window)));
      RenderManager.renderObjectsWith(context, data, [picture.id], identity);
      context.restore();
      RenderManager.renderPrimitives(context, data, [
        {
          type: cool.MaskPrimitive.type,
          clip: _CropHandles.quadOf(window),
          children: [
            {
              // Outside the old window: the second mask takes everything but it.
              type: cool.MaskPrimitive.type,
              clip: everything + " " + _CropHandles.quadOf(square),
              children: [
                {
                  type: cool.GraphicPrimitive.type,
                  checksum: picture.graphicChecksum,
                  matrix: whole.toArray(),
                  mirror: picture.graphicMirror
                }
              ]
            }
          ]
        }
      ]);
      context.save();
      context.clip(new Path2D(_CropHandles.quadOf(square)));
      context.clip(new Path2D(everything + " " + _CropHandles.quadOf(window)), "evenodd");
      context.globalAlpha = 0.5;
      RenderManager.renderObjectsWith(context, data, [picture.id], identity);
      context.restore();
    }
    context.restore();
  }
  /// A quad far larger than any page, for a mask that is to take everything but its other path.
  static quadBeyondEverything() {
    const far = 1e7;
    return "M" + -far + " " + -far + " L" + far + " " + -far + " L" + far + " " + far + " L" + -far + " " + far + " Z";
  }
  /*
      Lays the mark of that handle into the path: at a corner an L whose arms run along the two
      edges meeting there, into the picture; along a side a bar lying on the edge, inside it. The
      mark is laid in the picture's own axes, taken from the selection's square, so it turns and
      shears with the picture.
  */
  shape(context, handle, at, grown) {
    const color = HandleLook.blended(HandleLook.colorOfTheKind.framing, -HandleLook.cropMarkShade);
    const place = ObjectHandles.placeOfKind(handle.kind.substring(4));
    const square = this.selection.squareNow();
    if (!square)
      return color;
    const [across, down] = _CropHandles.axesOf(square);
    if (handle.kind === _CropHandles.middleKind) {
      HandleLook.drawMarker(context, "table-row-resize-marker", at, TableHandles.borderSize(), grown, { axes: [across, down], underMouse: "drag", always: true });
      return "transparent";
    }
    if (!place)
      return color;
    const inward = _CropHandles.inwardOf(handle.kind.substring(4));
    const inwardAcross = inward.x;
    const inwardDown = inward.y;
    const long = HandleLook.widthOf("crop") + 2 * grown;
    const thick = long * 0.5;
    const back = HandleLook.widthOf("crop") * 0.5;
    context.save();
    if (inwardAcross && inwardDown) {
      context.setTransform(across.x * inwardAcross, across.y * inwardAcross, down.x * inwardDown, down.y * inwardDown, at.vX, at.vY);
      context.moveTo(-back, -back);
      context.lineTo(long - back, -back);
      context.lineTo(long - back, thick - back);
      context.lineTo(thick - back, thick - back);
      context.lineTo(thick - back, long - back);
      context.lineTo(-back, long - back);
    } else {
      const along = inwardDown ? across : down;
      const into = inwardDown ? down.multiplyBy(inwardDown) : across.multiplyBy(inwardAcross);
      context.setTransform(along.x, along.y, into.x, into.y, at.vX, at.vY);
      context.moveTo(-long * 0.5, -back);
      context.lineTo(long * 0.5, -back);
      context.lineTo(long * 0.5, thick - back);
      context.lineTo(-long * 0.5, thick - back);
    }
    context.restore();
    return color;
  }
};
_CropHandles.middleKind = "cropMove";
let CropHandles = _CropHandles;
const _TurningHandle = class _TurningHandle extends HandleGroup {
  constructor() {
    super(...arguments);
    this.name = "turning";
  }
  /// The handle is hidden while the points to tie a connector to, the points of the path or the
  /// crop marks are shown.
  isShown() {
    return !this.selection.tiePointsAreShown() && !this.selection.pathPointsAreShown() && !CropHandles.areShownFor(this.selection);
  }
  handles() {
    var _a;
    const objectIds = this.selection.selectedObjects();
    const square = this.selection.squareNow();
    if (objectIds.length === 1 && ObjectHandles.hasHandlesOfItsOwnOnly(objectIds[0])) {
      const spot = ObjectHandles.spotWithoutLength(objectIds[0]);
      if (spot)
        return this.placedOut(spot, new cool.Point(0, -1), _TurningHandle.distance, true);
      if (!square)
        return [];
      return ((_a = RenderGeometrySection.objectOf(objectIds[0])) == null ? void 0 : _a.measurement) ? this.placedBeyondTheLine(objectIds[0], square) : this.placedBesideTheLine(objectIds[0], square);
    }
    return this.placedAbove(ObjectHandles.framingOf(objectIds, square) ?? []);
  }
  /*
      The point a turn goes about: the middle of the selection as the eight frame it, and where
      no eight are shown, as for an object shaped by its own handles alone, the middle of the
      selection's square.
  */
  middle() {
    var _a;
    const framed = this.selection.middle();
    if (framed)
      return framed;
    const middle = (_a = this.selection.squareNow()) == null ? void 0 : _a.apply(0.5, 0.5);
    return middle ? new cool.SimplePoint(middle.x, middle.y) : void 0;
  }
  /*
      The handle of an object that is shaped by its own handles alone, a measurement: out from
      the middle of its dimension line, at a right angle to it and away from the measured line,
      far enough to stay clear of the text on that line. It is worked out from the mapping
      itself, since the square of such an object may be too thin for the eight to tell its sides
      apart.
  */
  placedBeyondTheLine(objectId, square) {
    var _a;
    const measurement = (_a = RenderGeometrySection.objectOf(objectId)) == null ? void 0 : _a.measurement;
    const distance = (measurement == null ? void 0 : measurement.lineDistance) ?? 0;
    const across = (measurement == null ? void 0 : measurement.below) ? distance : -distance;
    const middle = square.apply(0.5, across);
    const below = square.apply(0.5, across + 1).subtract(middle);
    const length = below.length();
    if (!length)
      return [];
    const outwards = across > 0 ? 1 : -1;
    const out = new cool.Point(outwards * below.x / length, outwards * below.y / length);
    return this.placedOut(middle, out, _TurningHandle.distanceFromMeasureLine);
  }
  /*
      the handle of a line: out from its middle at a right angle, on the left of the way from
      its first point to its second, so it is above a line drawn from left to right
  */
  placedBesideTheLine(objectId, square) {
    var _a;
    const way = (_a = ObjectHandles.wayOfTheLine(objectId, square)) == null ? void 0 : _a.way;
    if (!way)
      return [];
    const length = way.length();
    if (!length)
      return [];
    const out = new cool.Point(way.y / length, -way.x / length);
    return this.placedOut(square.apply(0.5, 0.5), out, _TurningHandle.distance);
  }
  /// the handle that far out from the middle, in core pixels, the way out points, turned to
  /// stand along it
  placedOut(middle, out, distance, dead = false) {
    const away = distance * app.dpiScale;
    const step = cool.SimplePoint.fromCorePixels([away, away]);
    const point = new cool.Point(middle.x + out.x * step.x, middle.y + out.y * step.y);
    return this.handlesAt(point, Math.atan2(out.x, -out.y), dead);
  }
  /*
      It is laid out again from the handles as a drag leaves them, so that it keeps its distance
      from the upper side however the selection is scaled or turned. Where no eight are shown,
      it stays where the drag takes it.
  */
  place(shown) {
    if (!shown.some((one) => one.kind === "2"))
      return null;
    return this.placedAbove(shown);
  }
  /*
      The handle above the upper side of what those handles frame, or none where they do not
      frame anything. It stands out from the middle of that side at a right angle to it, so a
      slanted selection does not slant the way out to it. Where the objects say they cannot be
      turned it is there but dead, so the selection looks the same whatever may be done to it.
  */
  placedAbove(shown) {
    const middle = SelectionSection.middleOf(shown);
    const above = shown.find((one) => one.kind === "2");
    if (!middle || !above)
      return [];
    const away = _TurningHandle.distance * app.dpiScale;
    const out = new cool.Point(above.point.x - middle.x, above.point.y - middle.y);
    const length = out.length();
    if (!length)
      return [];
    const step = cool.SimplePoint.fromCorePixels([away, away]);
    const turnedBy = _TurningHandle.turnOf(shown, out);
    const up = new cool.Point(Math.sin(turnedBy), -Math.cos(turnedBy));
    const point = new cool.Point(above.point.x + up.x * step.x, above.point.y + up.y * step.y);
    return this.handlesAt(point, turnedBy);
  }
  /// The handle at that point, turned by that angle, and the handle of the other mode beside it
  /// while that one is shown. Where the objects say they cannot be turned, or it would do
  /// nothing, there is none, as there is nothing to do with it.
  handlesAt(point, turnedBy, deadAnyway = false) {
    const dead = deadAnyway || !ObjectHandles.canBeTurned(this.selection.selectedObjects());
    if (dead)
      return [];
    const handles = [
      {
        name: SelectionSection.turningKind,
        kind: SelectionSection.turningKind,
        pointer: "0",
        point: point.round(),
        turnedBy
      }
    ];
    if (this.selection.showsTheOtherMode())
      handles.push({
        name: SelectionSection.otherModeKind,
        kind: SelectionSection.otherModeKind,
        pointer: "0",
        point: _TurningHandle.placeOfTheOtherMode(point, turnedBy, this.selection.handleMode() === "shear" ? -1 : 1),
        turnedBy
      });
    return handles;
  }
  /// Where the handle of the other mode stands beside the handle above the selection at that
  /// point, in twips, turned by that angle: on its right for a side of 1, on its left for -1.
  static placeOfTheOtherMode(point, turnedBy, side) {
    const apart = 2.25 * ShapeHandlesSection.handleSize();
    const across = cool.SimplePoint.fromCorePixels([apart, apart]);
    return new cool.Point(point.x + side * Math.cos(turnedBy) * across.x, point.y + side * Math.sin(turnedBy) * across.y).round();
  }
  /*
      The angle the handle is drawn turned by: that of the selection's upper side, from its left
      corner to its right one, which a slant does not change, so a slanted selection turns the
      symbol only by its own turn. On a mirrored selection that side runs the other way, and
      the symbol is turned over again, so its top faces away from the selection as the handle
      does. Where the corners are not known it is the way up to the handle that says it.
  */
  static turnOf(shown, out) {
    const left = shown.find((one) => one.kind === "1");
    const right = shown.find((one) => one.kind === "3");
    if (!left || !right)
      return Math.atan2(out.y, out.x) + Math.PI / 2;
    const across = right.point.subtract(left.point);
    const turn = Math.atan2(across.y, across.x);
    const top = new cool.Point(Math.sin(turn), -Math.cos(turn));
    return top.dot(out) < 0 ? turn + Math.PI : turn;
  }
  /// The handle shows the mode it is in, and the one beside it the other mode: the circle for
  /// turning, the slanted rectangle for shearing.
  shape(context, handle, at, grown) {
    const shearing = this.selection.handleMode() === "shear";
    const other = handle.kind === SelectionSection.otherModeKind;
    return shearing !== other ? HandleLook.layShearing(context, at, grown, handle.turnedBy) : HandleLook.lay(context, "turning", at, grown);
  }
  /// A drag turns the selection in the turning mode and shears it in the shearing mode, around
  /// its middle either way.
  interactionFor(handle, at) {
    const middle = this.middle();
    if (!middle)
      return null;
    return this.selection.handleMode() === "shear" ? new ShearingInteraction(this.selection, middle, at, handle.turnedBy ?? 0) : new TurningInteraction(this.selection, middle, at);
  }
  /*
      How far a key turns the selection, in degrees against the clock for a way of 1 and with it
      for -1: on to the next step of the angle the selection stands at, counted from the page, so
      a few presses bring a turned object back to standing upright. The step is the one a turn
      by the mouse snaps to for the modifier held (EditSteps.turnSnap), and with no modifier the
      smallest one (EditSteps.keyTurnStep).
  */
  keyTurn(event, way) {
    const step = EditSteps.turnSnap(event) ?? EditSteps.keyTurnStep();
    const stands = this.standsNow();
    return EditSteps.nextStep(stands, step, way) - stands;
  }
  /// The angle the selection stands at, in degrees against the clock as the engine counts it.
  standsNow() {
    return -this.selection.turnOfTheSelection() * 180 / Math.PI;
  }
  /*
      Turns the selection by a key by that many degrees against the clock, around the middle
      the turn keys turned it around before where they did, and keeps the angle and the middle
      for the next key.
  */
  turnByKey(degrees) {
    const byKeys = TurningInteraction.keysStillHold(this.selection);
    const middle = (byKeys == null ? void 0 : byKeys.middle) ?? this.middle();
    if (!middle)
      return null;
    const stands = this.standsNow();
    const turned = TurningInteraction.turnObjects(this.selection, middle, degrees);
    TurningInteraction.keysLeftItAt(this.selection, stands + degrees, middle);
    return turned;
  }
  /*
      The keys that point left and up turn or slant against the clock, the others with it. A
      slant goes on to the next step of the slant there is, counted from nought, of the size a
      turn takes for the same modifier.
  */
  moveByKey(handle, towards, event) {
    const middle = this.middle();
    if (!middle)
      return null;
    const against = towards.x < 0 || towards.y < 0;
    const changed = this.selection.handleMode() === "shear" ? ShearingInteraction.shearObjects(this.selection, middle, handle.turnedBy ?? 0, (stands) => EditSteps.nextStep(stands, EditSteps.turnSnap(event) ?? EditSteps.keyTurnStep(), against ? -1 : 1)) : this.turnByKey(this.keyTurn(event, against ? 1 : -1));
    this.selection.layTheChangeOn((changed == null ? void 0 : changed.change) ?? null, (changed == null ? void 0 : changed.ticket) ?? null);
    return null;
  }
  /*
      Brings the selection back to nought in the mode the handle is in: standing upright in the
      turning mode, the shorter way round, and without a slant in the shearing mode.
  */
  backToNought(handle) {
    const middle = this.middle();
    if (!middle)
      return;
    let changed;
    if (this.selection.handleMode() === "shear") {
      changed = ShearingInteraction.shearObjects(this.selection, middle, handle.turnedBy ?? 0, () => 0);
    } else {
      if (handle.deactivated)
        return;
      const stands = this.standsNow() % 360;
      const back = stands > 180 ? 360 - stands : stands < -180 ? -360 - stands : -stands;
      changed = this.turnByKey(back);
    }
    this.selection.layTheChangeOn((changed == null ? void 0 : changed.change) ?? null, (changed == null ? void 0 : changed.ticket) ?? null);
  }
};
_TurningHandle.distance = 30;
_TurningHandle.distanceFromMeasureLine = 45;
let TurningHandle = _TurningHandle;
class HandlesMovedOneByOne extends HandleGroup {
  interactionFor(handle, _at) {
    return new ShapingInteraction(this.selection, handle);
  }
  moveByKey(handle, towards, event) {
    return this.stepAndHandOver(handle, towards, event);
  }
}
const _HeldSteps = class _HeldSteps {
  static keyOf(objectId, name) {
    return String(objectId) + ":" + name;
  }
  /// where the handle of that name of the one object selected was taken, if it was
  static of(selection, name) {
    return _HeldSteps.stepped.get(_HeldSteps.keyOf(selection.selectedObjects()[0], name));
  }
  /// notes where the handle was taken, until the engine answers for its object
  static hold(selection, handle, to, ortho = false) {
    if (!_HeldSteps.followingTheAnswers) {
      _HeldSteps.followingTheAnswers = true;
      RenderManager.onVectorChanged((answered) => {
        if (answered === void 0) {
          _HeldSteps.stepped.clear();
          return;
        }
        for (const objectId of answered)
          for (const key of Array.from(_HeldSteps.stepped.keys()))
            if (key.startsWith(String(objectId) + ":"))
              _HeldSteps.stepped.delete(key);
      });
    }
    _HeldSteps.stepped.set(_HeldSteps.keyOf(selection.selectedObjects()[0], handle.name), { at: to, ortho });
    selection.refresh();
    selection.redraw();
  }
  /// the handle standing where it was taken, or where it stands where it was not
  static from(selection, handle) {
    const stepped = _HeldSteps.of(selection, handle.name);
    return stepped ? { ...handle, point: stepped.at } : handle;
  }
  /// the handles with each one that was taken standing where it was taken
  static laidOn(selection, handles) {
    return handles.map((one) => _HeldSteps.from(selection, one));
  }
};
_HeldSteps.stepped = /* @__PURE__ */ new Map();
_HeldSteps.followingTheAnswers = false;
let HeldSteps = _HeldSteps;
const _ShapingHandles = class _ShapingHandles extends HandlesMovedOneByOne {
  constructor() {
    super(...arguments);
    this.name = "shaping";
  }
  /*
      A point a custom shape is shaped by is moved by naming the shape and the point: the shape
      reads it as the value it shapes itself from, and nothing about a selection or a handle of
      a view is needed for that. The others - the corner radius of a rectangle, the points along
      a connector's way - are still named as handles, since what they mean lives in rules of
      their own that nothing here says yet.
  */
  handOver(handle, to, ortho = false) {
    if (handle.kind !== _ShapingHandles.shapingPointKind) {
      this.sendTheHandle(handle, to, ortho);
      HeldSteps.hold(this.selection, handle, to, ortho);
      return;
    }
    const at = Number(handle.name.split(".")[2]);
    if (!(at >= 0))
      return;
    HeldSteps.hold(this.selection, handle, to, ortho);
    app.socket.sendMessage("setobjectcontrolpoint id=" + String(this.selection.selectedObjects()[0]) + " at=" + String(at) + " x=" + String(Math.round(to.x)) + " y=" + String(Math.round(to.y)) + // The tail of a callout carries the shape along, which a drag says by having no
    // modifier held down. Nothing here holds one yet.
    " withtheshape=1");
  }
  /// the end of the tail of a caption stays where it is, the tail is laid out anew to it
  keepsItsPlace(handle) {
    var _a;
    const objectIds = this.selection.selectedObjects();
    return handle.kind === "9" && objectIds.length === 1 && ((_a = RenderGeometrySection.objectOf(objectIds[0])) == null ? void 0 : _a.caption) !== void 0;
  }
  handles() {
    const known = ObjectHandles.shapingOf(this.selection.selectedObjects());
    for (const handle of known) {
      const stepped = HeldSteps.of(this.selection, handle.name);
      if (stepped) {
        const measured = MeasurementGhost.handlesDuring(this.selection, handle, stepped.at, known, stepped.ortho);
        if (measured)
          return measured;
      }
    }
    return HeldSteps.laidOn(this.selection, known);
  }
  /// The measurement, the line or the connector as the handles keys took, or a drag let go of,
  /// will leave it.
  outline() {
    for (const handle of ObjectHandles.shapingOf(this.selection.selectedObjects())) {
      const stepped = HeldSteps.of(this.selection, handle.name);
      if (stepped)
        return MeasurementGhost.outline(this.selection, handle, stepped.at, stepped.ortho) ?? LineGhost.outline(this.selection, handle, stepped.at) ?? CaptionGhost.outline(this.selection, handle, stepped.at) ?? // a connector as a drag of that handle shows it
        this.selection.runWhileAnEndIsDragged(handle, stepped.at) ?? this.selection.runWhileALineIsDragged(handle, stepped.at);
    }
    return null;
  }
  /*
      A point a custom shape is shaped by runs on rails the shape gives it: across the shape,
      down it, both, or around a point of it, and between the places the shape names. The
      places are given on the square of the object, so the place the mouse asks for is taken
      onto that square, held there, and taken back onto the page. A shape that is turned,
      sheared, mirrored or stretched more one way than the other is held right that way, and
      the places stay right while the object is dragged, since they move with it.
  */
  holdInside(handle, at) {
    const line = this.selection.howTheLineHandleMoves(handle);
    if (line)
      return line.movesAcross ? new cool.Point(at.x, handle.point.y) : new cool.Point(handle.point.x, at.y);
    const rails = handle.rails;
    if (!rails)
      return at;
    const transform = RenderGeometrySection.transformOf(this.selection.selectedObjects()[0]);
    if (!transform)
      return at;
    const onTheSquare = transform.invert();
    if (!onTheSquare)
      return at;
    const asked = onTheSquare.apply(at.x, at.y);
    const was = onTheSquare.apply(handle.point.x, handle.point.y);
    const held = rails.movesAround ? _ShapingHandles.heldAround(rails, asked, was) : _ShapingHandles.heldOnTheAxes(rails, asked, was);
    return transform.apply(held.x, held.y).round();
  }
  /*
      Where on the square of the object a handle that moves on the axes may go. An axis it does
      not move on keeps the place it had. On an axis it does move on, each place the shape names
      blocks the side it lies on, which is the side away from where the handle stands: the shape
      says which end of its own value a place comes from, and that end can be either side of the
      shape.
  */
  static heldOnTheAxes(rails, asked, was) {
    var _a, _b, _c, _d;
    return new cool.Point(rails.movesAcross ? _ShapingHandles.between(asked.x, was.x, [
      (_a = rails.leastAcross) == null ? void 0 : _a.x,
      (_b = rails.mostAcross) == null ? void 0 : _b.x
    ]) : was.x, rails.movesDown ? _ShapingHandles.between(asked.y, was.y, [
      (_c = rails.leastDown) == null ? void 0 : _c.y,
      (_d = rails.mostDown) == null ? void 0 : _d.y
    ]) : was.y);
  }
  /*
      Where on the square of the object a handle that turns about a point may go: anywhere
      around that point, no nearer and no further than the shape allows. A shape that names no
      point of its own turns about its middle.
  */
  static heldAround(rails, asked, was) {
    const around = rails.around ? new cool.Point(rails.around.x, rails.around.y) : new cool.Point(0.5, 0.5);
    const awayFrom = (place) => place ? new cool.Point(place.x, place.y).distanceTo(around) : void 0;
    const away = asked.distanceTo(around);
    const kept = _ShapingHandles.between(away, was.distanceTo(around), [
      awayFrom(rails.nearest),
      awayFrom(rails.furthest)
    ]);
    if (!away || kept === away)
      return asked;
    return around.add(asked.subtract(around).divideBy(away).multiplyBy(kept));
  }
  /*
      A value held between the places the shape names. Where it names both, the value stays
      between them. Where it names one, that one blocks the side it lies on, which is told from
      the place the handle stands at now: the handle stands inside its own rails, so the side
      the place lies on is the side that is closed.
  */
  static between(value, stands, places) {
    const given = places.filter((place) => place !== void 0);
    if (given.length === 2)
      return Math.min(Math.max(value, Math.min(...given)), Math.max(...given));
    let held = value;
    for (const place of given)
      held = place <= stands ? Math.max(held, place) : Math.min(held, place);
    return held;
  }
  shape(context, handle, at, grown) {
    return HandleLook.lay(context, "shaping", at, grown + (handle.larger ? HandleLook.largerBy("shaping") : 0));
  }
};
_ShapingHandles.shapingPointKind = "22";
let ShapingHandles = _ShapingHandles;
const _TiePointHandles = class _TiePointHandles extends HandleGroup {
  constructor() {
    super(...arguments);
    this.name = "tiePoints";
  }
  isShown() {
    return this.selection.tiePointsAreShown() || this.selection.aimedAtObject() !== null;
  }
  /// The point the keyboard is on is shown larger and holds still.
  blinksWhileActive() {
    return false;
  }
  /// A point is small and sits on the edge of the object, so a press takes it from twice as far.
  reachOf(usual) {
    return 2 * usual;
  }
  /// A click on a point opens the menu of that point beside it.
  letGoWhereItWasPressed(handle) {
    if (handle.kind !== "GluePoint")
      return;
    this.openTheMenuOf(handle);
  }
  /*
      Opens the menu of a point, below the point: the way a connector comes into the object
      there, whether the point keeps its share of the size of the object, the side it is
      measured from across the object and down it, and taking the point away. The ways the point
      names are checked, both of them for a point that names two sides facing each other, and
      none for a point that names no way. A point the shape makes from its own geometry keeps
      all of these and stays, so for such a point the entries are shown disabled. The sides a
      point is measured from count only for a point that keeps its distance, so they are
      disabled for a point that keeps its share.
  */
  openTheMenuOf(handle) {
    const at = Number(handle.name.split(".")[1]);
    const point = this.held(handle);
    if (!point || !(at >= 0))
      return;
    const ways = _TiePointHandles.waysOf(point.wayOut);
    const canBeChanged = () => point.fromTheShape !== true;
    const keepsItsDistance = point.keepsItsDistance === true;
    const side = (id, text, img) => ({
      id,
      type: "action",
      text,
      img,
      checked: ways.includes(id),
      isEnabled: canBeChanged
    });
    const from = (axis, name, text, img) => ({
      id: axis + "-" + name,
      type: "action",
      text,
      img,
      checked: (axis === "across" ? point.fromAcross : point.fromDown) === (name === "middle" ? void 0 : name)
    });
    const sidesCanBeChanged = () => canBeChanged() && keepsItsDistance;
    const entries = [
      {
        id: "gluepoint",
        type: "header",
        text: _("Gluepoint")
      },
      side("left", _("Left"), "glueescapedirectionleft"),
      side("right", _("Right"), "glueescapedirectionright"),
      side("top", _("Up"), "glueescapedirectiontop"),
      side("bottom", _("Down"), "glueescapedirectionbottom"),
      { id: "separator", type: "separator" },
      {
        id: "relative",
        type: "action",
        text: _("Relative"),
        img: "gluepercent",
        checked: !keepsItsDistance,
        isEnabled: canBeChanged
      },
      {
        id: "across",
        type: "menu",
        text: _("Horizontal Alignment"),
        img: "gluehorzaligncenter",
        isEnabled: sidesCanBeChanged,
        items: [
          from("across", "left", _("Left"), "gluehorzalignleft"),
          from("across", "middle", _("Center"), "gluehorzaligncenter"),
          from("across", "right", _("Right"), "gluehorzalignright")
        ]
      },
      {
        id: "down",
        type: "menu",
        text: _("Vertical Alignment"),
        img: "gluevertaligncenter",
        isEnabled: sidesCanBeChanged,
        items: [
          from("down", "top", _("Top"), "gluevertaligntop"),
          from("down", "middle", _("Center"), "gluevertaligncenter"),
          from("down", "bottom", _("Bottom"), "gluevertalignbottom")
        ]
      },
      { id: "separator", type: "separator" },
      {
        id: "delete",
        type: "action",
        text: _("Delete"),
        img: "delete",
        isEnabled: canBeChanged
      }
    ];
    this.openAMenuBelow(handle, 0.5 * ShapeHandlesSection.gluePointSize(), _TiePointHandles.menuId, entries, (chosen) => {
      const [axis, name] = chosen.split("-");
      if (chosen === "delete")
        this.deleteThePoint(handle);
      else if (chosen === "relative")
        this.sendAboutThePoint("setobjectgluepointdistance", at, "keeps=" + String(!keepsItsDistance));
      else if ((axis === "across" || axis === "down") && name)
        this.sendAboutThePoint("setobjectgluepointfrom", at, chosen.replace("-", "="));
      else if (_TiePointHandles.sides.some((one) => one.name === chosen))
        this.sendAboutThePoint("setobjectgluepointwayout", at, "way=" + _TiePointHandles.switchedWay(ways, chosen));
    });
  }
  /// Sends a change of the point at that place in the list of the selected object, with the
  /// parameters that say what the change is, or none for a change that needs none.
  sendAboutThePoint(command, at, change) {
    app.socket.sendMessage(command + " id=" + String(this.selection.selectedObjects()[0]) + " at=" + String(at) + (change ? " " + change : ""));
  }
  /*
      Takes away the point that handle stands for. Answers whether the handle stands for a
      point. A point the shape makes from its own geometry stays. The points after the one
      taken away move up one place, so the keyboard leaves the points.
  */
  deleteThePoint(handle) {
    const at = Number(handle.name.split(".")[1]);
    const point = this.held(handle);
    if (!point || !(at >= 0))
      return false;
    if (point.fromTheShape === true)
      return true;
    this.selection.travel.leave();
    this.sendAboutThePoint("deleteobjectgluepoint", at, "");
    return true;
  }
  /// The sides a way out names: one side, the two that face each other, or none.
  static waysOf(wayOut) {
    return wayOut === "horizontal" ? ["left", "right"] : wayOut === "vertical" ? ["top", "bottom"] : wayOut ? [wayOut] : [];
  }
  /*
      The way out once that side is switched on or off among those ways, by the name the engine
      takes. A point holds one side, or two that face each other, or none. A side switched on
      joins the side facing it into a pair, and replaces any other side the point held.
  */
  static switchedWay(ways, side) {
    if (ways.includes(side)) {
      const left = ways.filter((one) => one !== side);
      return left.length ? left[0] : "smart";
    }
    const across = side === "left" || side === "right";
    const facing = across ? side === "left" ? "right" : "left" : side === "top" ? "bottom" : "top";
    if (ways.includes(facing))
      return across ? "horizontal" : "vertical";
    return side;
  }
  /*
      Gives the selected object a new point where the press landed, when it landed on the
      object. Answers whether it did. The place goes to the engine on the object, as a share of
      its width and of its height.
  */
  addAt(at) {
    var _a;
    const objects = this.selection.selectedObjects();
    if (objects.length !== 1)
      return false;
    const transform = RenderGeometrySection.transformOf(objects[0]);
    const onTheObject = (_a = transform == null ? void 0 : transform.invert()) == null ? void 0 : _a.apply(at.x, at.y);
    if (!onTheObject)
      return false;
    const inside = (value) => value >= 0 && value <= 1;
    if (!inside(onTheObject.x) || !inside(onTheObject.y))
      return false;
    app.socket.sendMessage("insertobjectgluepoint id=" + String(objects[0]) + " x=" + onTheObject.x.toFixed(4) + " y=" + onTheObject.y.toFixed(4));
    return true;
  }
  /// the connectors tied to a point keys took, or a drag let go of, as they will run
  outline() {
    const objects = this.selection.selectedObjects();
    if (objects.length !== 1)
      return null;
    const runs = GluePointHandles.ownPointsOf(objects[0]).flatMap((handle) => {
      const stepped = HeldSteps.of(this.selection, handle.name);
      return stepped ? this.selection.runsWhileAGluePointIsDragged(handle, stepped.at) ?? [] : [];
    });
    return runs.length ? runs : null;
  }
  /// The points the selected object was given, which travel with it as it is dragged.
  handles() {
    const objects = this.selection.selectedObjects();
    return objects.length === 1 ? HeldSteps.laidOn(this.selection, GluePointHandles.ownPointsOf(objects[0])) : [];
  }
  /*
      The object's own points as the drag leaves them, and beside them every place an end of a
      connector could land on the object under the mouse. Those belong to that object, so they
      are worked out where it stands rather than carried along by the drag.
  */
  place(shown) {
    const own = this.ownAsTheDragLeavesThem(shown);
    const aimedAt = this.selection.aimedAtObject();
    if (aimedAt === null)
      return own;
    const led = this.selection.leadingPointOfTheDrag();
    const would = led ? this.selection.whereTheEndWouldTie(new cool.Point(led.x, led.y)) : null;
    const lit = (handle) => {
      var _a;
      return ((_a = would == null ? void 0 : would.point) == null ? void 0 : _a.equals(handle.point)) ? { ...handle, lit: true } : handle;
    };
    return [
      ...own,
      ...GluePointHandles.ownPointsOf(aimedAt).map(lit),
      ...GluePointHandles.defaultPointsOf(aimedAt).map(lit)
    ];
  }
  /*
          The object's own points while a drag of the object runs.
  
          Such a point is not held on the object's own square but on the box around it, and that is
          what has to be worked out again: the drawing layer reads it from the middle of that box,
          or from one of its sides where the point names one. A point held as a share of the size
          keeps its share of the box, and one that keeps a distance of its own keeps that distance
          in twips. Either way the point ends up inside the box.
  
          Carrying the point through the change instead would hold it to the shape, and for a
          turned object the two part company, because turning the box is not the same as turning
          the shape inside it.
      */
  ownAsTheDragLeavesThem(shown) {
    var _a;
    const own = shown.filter((handle) => handle.group === this.name);
    const matrix = this.selection.dragMatrix();
    const objects = this.selection.selectedObjects();
    if (!matrix || objects.length !== 1)
      return own;
    const transform = RenderGeometrySection.transformOf(objects[0]);
    const held = ((_a = RenderGeometrySection.objectOf(objects[0])) == null ? void 0 : _a.gluePoints) ?? [];
    if (!transform || !held.length)
      return own;
    const grewAcross = matrix.lengthOfXAxis();
    const grewDown = matrix.lengthOfYAxis();
    if (Math.abs(grewAcross - 1) < 1e-4 && Math.abs(grewDown - 1) < 1e-4)
      return own;
    const was = _TiePointHandles.theBoxAround(transform);
    const becomes = _TiePointHandles.theBoxAround(transform.then(matrix));
    const standing = GluePointHandles.ownPointsOf(objects[0]);
    return own.map((handle, at) => {
      const point = held[at];
      if (!point || !standing[at] || point.fromTheShape)
        return handle;
      return {
        ...handle,
        point: _TiePointHandles.laidOnTheBox(point, standing[at].point, was, becomes)
      };
    });
  }
  /// The box around what the mapping draws, which is the box the drawing layer holds a point
  /// to tie a connector to against.
  static theBoxAround(transform) {
    return cool.Range2D.fromPoints([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ].map(([x, y]) => transform.apply(x, y)));
  }
  /*
      Where a point stands once the box around the object has become the other one: the side it
      is measured from moves with the box, and what it keeps from that side is either its share
      of the size or its own distance. A point that would end up outside the box is brought
      back to the edge, as the drawing layer brings it back.
  */
  static laidOnTheBox(point, standing, was, becomes) {
    const acrossFrom = (box) => point.fromAcross === "left" ? box.minX : point.fromAcross === "right" ? box.maxX : box.centerX;
    const downFrom = (box) => point.fromDown === "top" ? box.minY : point.fromDown === "bottom" ? box.maxY : box.centerY;
    const grewAcross = point.keepsItsDistance || !was.width ? 1 : becomes.width / was.width;
    const grewDown = point.keepsItsDistance || !was.height ? 1 : becomes.height / was.height;
    const x = acrossFrom(becomes) + (standing.x - acrossFrom(was)) * grewAcross;
    const y = downFrom(becomes) + (standing.y - downFrom(was)) * grewDown;
    return becomes.clamp(new cool.Point(x, y)).round();
  }
  /*
      A point to tie a connector to stays on the object it belongs to: the drawing layer reads
      such a point off the box around the object and holds it inside that box, so a drag that
      would take it outside leaves it on the edge.
  */
  holdInside(_handle, at) {
    var _a;
    const transform = RenderGeometrySection.transformOf(this.selection.selectedObjects()[0]);
    if (!transform)
      return at;
    const onTheObject = (_a = transform.invert()) == null ? void 0 : _a.apply(at.x, at.y);
    if (!onTheObject)
      return at;
    const held = (value) => Math.min(Math.max(value, 0), 1);
    return transform.apply(held(onTheObject.x), held(onTheObject.y)).round();
  }
  /*
      A point the object was given is moved where it is put, by the number it has in the object's
      own list. A point the shape makes from its own geometry is laid out again with the shape,
      so it stays where the shape puts it. The four an object falls back on are not its own and
      are shown only, so they have no name and nothing takes hold of one.
  */
  interactionFor(handle, _at) {
    return this.canBeMoved(handle) ? new ShapingInteraction(this.selection, handle) : null;
  }
  /// A point the shape makes is only clicked, for its menu.
  dragsTheHandle(handle) {
    return this.canBeMoved(handle);
  }
  /// Whether that handle stands for a point the object holds and may be moved by a drag or a key.
  canBeMoved(handle) {
    var _a;
    return handle.name !== "" && ((_a = this.held(handle)) == null ? void 0 : _a.fromTheShape) !== true;
  }
  handOver(handle, to) {
    var _a;
    const at = Number(handle.name.split(".")[1]);
    if (!(at >= 0))
      return;
    const objectId = this.selection.selectedObjects()[0];
    const transform = RenderGeometrySection.transformOf(objectId);
    if (!transform)
      return;
    const onTheObject = (_a = transform.invert()) == null ? void 0 : _a.apply(to.x, to.y);
    if (!onTheObject)
      return;
    HeldSteps.hold(this.selection, handle, to);
    app.socket.sendMessage("setobjectgluepoint id=" + String(objectId) + " at=" + String(at) + " x=" + onTheObject.x.toFixed(4) + " y=" + onTheObject.y.toFixed(4));
  }
  moveByKey(handle, towards, event) {
    if (!this.canBeMoved(handle))
      return null;
    return this.stepAndHandOver(handle, towards, event);
  }
  /// What the object holds about the point that handle stands for, or nothing for one of the
  /// four an object falls back on, which it holds nothing about.
  held(handle) {
    var _a, _b;
    if (handle.kind !== "GluePoint")
      return void 0;
    const at = Number(handle.name.split(".")[1]);
    const objects = this.selection.selectedObjects();
    if (!(at >= 0) || objects.length !== 1)
      return void 0;
    return (_b = (_a = RenderGeometrySection.objectOf(objects[0])) == null ? void 0 : _a.gluePoints) == null ? void 0 : _b[at];
  }
  /*
      The side a way out points to while a drag turns the object. A way out is one of the four
      sides of the page, never a way of the object's own, and turning an object moves it to the
      side it comes nearest to: the model adds the turn to it and takes the side that is within
      a quarter turn of the result. So the drag shows what the turn will leave behind, and a
      turn of less than an eighth leaves it where it is.
  */
  turnedBy(name) {
    const matrix = this.selection.dragMatrix();
    const side = _TiePointHandles.sides.findIndex((one) => one.name === name);
    if (!matrix || side < 0)
      return name;
    const quarters = Math.round((_TiePointHandles.sides[side].turn + matrix.rotation()) / (Math.PI * 0.5)) & 3;
    return _TiePointHandles.sides[quarters].name;
  }
  /*
      A point to tie a connector to is a circle, and every way a connector may leave the object
      there puts a nose on that circle: the quarter of it facing that way is replaced by two
      lines out to a tip. A point with no way named is a plain circle, and a connector leaving
      it may go whichever way it likes.
  */
  shape(context, handle, at, grown) {
    const held = this.held(handle);
    const radius = HandleLook.widthOf("tiePoint") * 0.5 + grown;
    const ways = _TiePointHandles.waysOf(held == null ? void 0 : held.wayOut).map((name) => this.turnedBy(name));
    const half = Math.PI / 4;
    const tip = radius * Math.SQRT2;
    const onTheCircle = (turn) => [
      at.vX + radius * Math.cos(turn),
      at.vY + radius * Math.sin(turn)
    ];
    let from = _TiePointHandles.sides[0].turn - half;
    const [startX, startY] = onTheCircle(from);
    context.moveTo(startX, startY);
    for (const side of _TiePointHandles.sides) {
      if (!ways.includes(side.name)) {
        context.arc(at.vX, at.vY, radius, from, side.turn + half);
      } else {
        context.arc(at.vX, at.vY, radius, from, side.turn - half);
        context.lineTo(at.vX + tip * Math.cos(side.turn), at.vY + tip * Math.sin(side.turn));
        const [backX, backY] = onTheCircle(side.turn + half);
        context.lineTo(backX, backY);
      }
      from = side.turn + half;
    }
    context.arc(at.vX, at.vY, radius, from, _TiePointHandles.sides[0].turn - half + Math.PI * 2);
    if (handle.kind !== "GluePoint")
      return HandleLook.tiePointFallenBackOn;
    return (held == null ? void 0 : held.keepsItsDistance) ? HandleLook.tiePointKeepingItsDistance : HandleLook.colorOfTheKind.tiePoint;
  }
  /*
      The side a point is measured from, where it is not the middle: a short line lying along
      the circle, just outside it, on that side. A point measured from the middle shows none,
      which is what a point is given unless someone says otherwise.
  */
  paint(section, shown) {
    const marked = shown.filter((handle) => handle.group === this.name);
    if (!marked.length)
      return;
    const radius = ShapeHandlesSection.gluePointSize() * 0.5;
    const away = radius + 2 * app.dpiScale;
    section.context.save();
    section.context.setTransform(1, 0, 0, 1, 0, 0);
    section.context.strokeStyle = "black";
    section.context.lineWidth = app.dpiScale;
    section.context.beginPath();
    for (const handle of marked) {
      const held = this.held(handle);
      if (!held)
        continue;
      const at = new cool.SimplePoint(handle.point.x, handle.point.y);
      for (const side of _TiePointHandles.sides) {
        if (held.fromAcross !== side.name && held.fromDown !== side.name)
          continue;
        const middleX = at.vX + away * Math.cos(side.turn);
        const middleY = at.vY + away * Math.sin(side.turn);
        const alongX = -Math.sin(side.turn) * radius * 0.5;
        const alongY = Math.cos(side.turn) * radius * 0.5;
        section.context.moveTo(middleX - alongX, middleY - alongY);
        section.context.lineTo(middleX + alongX, middleY + alongY);
      }
    }
    section.context.stroke();
    section.context.restore();
  }
};
_TiePointHandles.menuId = "tie-point-menu";
_TiePointHandles.sides = [
  { name: "right", turn: 0 },
  { name: "bottom", turn: Math.PI * 0.5 },
  { name: "left", turn: Math.PI },
  { name: "top", turn: Math.PI * 1.5 }
];
let TiePointHandles = _TiePointHandles;
const _PathHandles = class _PathHandles extends HandlesMovedOneByOne {
  constructor() {
    super(...arguments);
    this.name = "path";
  }
  /// The points are shown while they are edited.
  isShown() {
    return this.selection.pathPointsAreShown();
  }
  /*
      While a point is being added, a press counts when it is inside the box of the object or on
      its line. The box of a straight path has no height or no width, and a thick line reaches
      outside its box, so the box alone is not enough.
  */
  takesAPress(x, y) {
    if (!this.selection.isAddingAPathPoint())
      return false;
    if (this.selection.within(x, y))
      return true;
    const at = this.selection.inDocumentFromCanvas(x, y);
    return RenderGeometrySection.objectHitAt(this.selection.selectedObjects()[0], at.x, at.y);
  }
  /// A closed path can always be opened. An open path can be closed when one of its polygons
  /// has at least three points.
  canBeClosedOrOpened() {
    var _a;
    const path = ((_a = this.selection.pathEditor()) == null ? void 0 : _a.path()) ?? [];
    return PolyPolygonEditor.isClosed(path) || path.some((polygon) => _PathHandles.pointsOnceClosed(polygon) >= 3);
  }
  /// The number of points the polygon has once it is closed. Points at the end that equal the
  /// first point are not counted, because a closed polygon does not repeat its first point.
  static pointsOnceClosed(polygon) {
    const points = polygon.points ?? [];
    let count = points.length;
    while (count > 1 && points[count - 1].x === points[0].x && points[count - 1].y === points[0].y)
      --count;
    return count;
  }
  /// The parameters that name a point of the path to the engine.
  static parametersOf(place) {
    return "polygon=" + String(place.polygon) + " point=" + String(place.point);
  }
  /// The point the keyboard is on is drawn larger and does not blink.
  blinksWhileActive() {
    return false;
  }
  /// Points and weights are drawn smaller than the eight handles, so a press reaches them from
  /// twice the usual distance.
  reachOf(usual) {
    return 2 * usual;
  }
  /// A click on a point opens the menu of the point below it. A click on a weight does not.
  letGoWhereItWasPressed(handle) {
    if (handle.kind === "9")
      this.openTheMenuOf(handle);
  }
  /// The point that a handle stands for. It is null for a weight, and for a point that the path
  /// no longer has.
  placeOf(handle) {
    var _a;
    return ((_a = this.selection.pathEditor()) == null ? void 0 : _a.pointOf(handle.name)) ?? null;
  }
  /*
      Opens the menu of a point below the point. The entries delete the point, make the edge
      after it a curve or a line, set how the curve runs through the point, and split the path
      there. An entry is disabled when it does not apply to this point:
      - The last point of an open polygon has no edge after it.
      - The edge is a curve when a weight bends it at either end.
      - Smooth and symmetric need a point with both weights. The current choice is checked and
        disabled. A point that reports no choice is a corner.
      - A path of one polygon can be split at any point of a closed polygon, and at any point
        of an open polygon except its two ends.
  */
  openTheMenuOf(handle) {
    const place = this.placeOf(handle);
    if (!place)
      return;
    const points = place.of.points;
    const point = points[place.point];
    const next = points[(place.point + 1) % points.length];
    const closed = place.of.closed === true;
    const hasAnEdgeOut = place.point + 1 < points.length || closed;
    const curved = hasAnEdgeOut && (point.aheadX !== void 0 || next.behindX !== void 0);
    const weightIn = point.behindX !== void 0;
    const weightOut = point.aheadX !== void 0;
    const continuity = point.continuity ?? 0;
    const canBeSplit = place.path.length === 1 && points.length >= 3 && (closed || place.point > 0 && place.point + 1 < points.length);
    const way = (id, text, img, value, enabled) => ({
      id,
      type: "action",
      text,
      img,
      checked: continuity === value,
      isEnabled: () => enabled && continuity !== value
    });
    const entries = [
      { id: "point", type: "header", text: _("Point") },
      { id: "delete", type: "action", text: _("Delete"), img: "bezierdelete" },
      { id: "separator", type: "separator" },
      {
        id: curved ? "line" : "curve",
        type: "action",
        text: curved ? _("To Line") : _("To Curve"),
        img: "bezierconvert",
        isEnabled: () => hasAnEdgeOut
      },
      { id: "separator", type: "separator" },
      way("corner", _("Corner Point"), "bezieredge", 0, weightIn || weightOut),
      way("smooth", _("Smooth Transition"), "beziersmooth", 1, weightIn && weightOut),
      way("symmetric", _("Symmetric Transition"), "beziersymmetric", 2, weightIn && weightOut),
      { id: "separator", type: "separator" },
      {
        id: "split",
        type: "action",
        text: _("Split Path"),
        img: "beziercutline",
        isEnabled: () => canBeSplit
      }
    ];
    this.openAMenuBelow(handle, 0.5 * PolyPolygonEditor.pointSize(), _PathHandles.menuId, entries, (chosen) => {
      const at = _PathHandles.parametersOf(place);
      if (chosen === "delete")
        this.deleteThePoint(handle);
      else if (chosen === "curve" || chosen === "line")
        this.sendAboutThePath("setobjectsegmentcurved", at + " curved=" + String(chosen === "curve"));
      else if (chosen === "corner")
        this.sendAboutThePath("setobjectpointcontinuity", at + " continuity=0");
      else if (chosen === "smooth")
        this.sendAboutThePath("setobjectpointcontinuity", at + " continuity=1");
      else if (chosen === "symmetric")
        this.sendAboutThePath("setobjectpointcontinuity", at + " continuity=2");
      else if (chosen === "split") {
        this.sendAboutThePath("splitobjectpath", at);
      }
    });
  }
  /*
      Sends a change of the path of the selected object, with its parameters if it has any.
      The change names points by their index in the path the client has. So it is not sent
      while an undo or a redo is on its way, and point moves that still wait are sent first.
      The change can add or remove points and weights, so the keyboard leaves the points.
  */
  sendAboutThePath(command, change) {
    if (ChangeOutbox.undoOnItsWay()) {
      this.selection.showTheHoldBack();
      return;
    }
    this.selection.travel.leave();
    ChangeOutbox.sendEverythingAhead();
    app.socket.sendMessage(command + " id=" + String(this.selection.selectedObjects()[0]) + (change ? " " + change : ""));
  }
  /*
      Deletes the point that the handle stands for. On a weight it does nothing. It returns
      true for every handle of the path, so the key is used up and the object is not deleted.
  */
  deleteThePoint(handle) {
    const place = this.placeOf(handle);
    if (!place)
      return true;
    this.sendAboutThePath("deleteobjectpoint", _PathHandles.parametersOf(place));
    return true;
  }
  /// Adds a point to the path of the selected object, on the edge nearest to the press. The
  /// press is in twips on the page.
  addAt(at) {
    this.sendAboutThePath("insertobjectpoint", "x=" + String(Math.round(at.x)) + " y=" + String(Math.round(at.y)));
  }
  /// Closes the path of the selected object, or opens it again where it is closed.
  switchClosed() {
    var _a;
    const path = (_a = this.selection.pathEditor()) == null ? void 0 : _a.path();
    if (!path)
      return;
    this.sendAboutThePath("setobjectpathclosed", "closed=" + String(!PolyPolygonEditor.isClosed(path)));
  }
  /// Turns every curved edge of the path that runs straight into a line. With pointsOnALine,
  /// it also deletes the points that lie on a straight line between their neighbours.
  simplify(pointsOnALine) {
    this.sendAboutThePath("simplifyobjectpath", "points=" + String(pointsOnALine));
  }
  handOver(handle, to) {
    var _a;
    const change = (_a = this.selection.pathEditor()) == null ? void 0 : _a.changeFor(handle.name, to);
    if (!change)
      return;
    SelectionSection.sendPathChanges(this.selection.selectedObjects()[0], [
      change
    ]);
    HeldSteps.hold(this.selection, handle, to);
  }
  /// The point that was taken stands where it was taken, with its weights.
  handles() {
    const editor = this.selection.pathEditor();
    const known = (editor == null ? void 0 : editor.handles()) ?? [];
    for (const handle of known) {
      const stepped = HeldSteps.of(this.selection, handle.name);
      if (stepped)
        return (editor == null ? void 0 : editor.handlesDuring(handle.name, stepped.at, known)) ?? known;
    }
    return known;
  }
  /// The pieces of the path at the point keys took, or a drag let go of, as they will be.
  outline() {
    const editor = this.selection.pathEditor();
    for (const handle of (editor == null ? void 0 : editor.handles()) ?? []) {
      const stepped = HeldSteps.of(this.selection, handle.name);
      if (stepped)
        return (editor == null ? void 0 : editor.outlineFor(handle.name, stepped.at)) ?? null;
    }
    return null;
  }
  paint(section, shown) {
    var _a;
    (_a = this.selection.pathEditor()) == null ? void 0 : _a.paint(section, shown);
  }
  shape(context, handle, at, grown) {
    return HandleLook.lay(context, handle.kind === "9" ? "pathPoint" : "weight", at, grown);
  }
};
_PathHandles.menuId = "path-point-menu";
let PathHandles = _PathHandles;
class TheObjectItself extends HandleGroup {
  constructor() {
    super(...arguments);
    this.name = "object";
  }
  takesAPress(x, y) {
    return this.selection.within(x, y);
  }
  shape() {
    return "";
  }
  /// The object does not move while the points of its path are shown, so a press that misses a
  /// point does not change the shape.
  interactionForThePlace(at) {
    if (this.selection.pathPointsAreShown())
      return null;
    if (!ObjectHandles.canBeMoved(this.selection.selectedObjects()))
      return null;
    return new MovingInteraction(this.selection, at);
  }
}
class TheConnectorItself extends TheObjectItself {
  /*
      A press reaches this group only where the connector's own line is drawn, so the connector
      itself is what was pressed and it stays selected. Handing the press on would let the
      engine hit test it and find whatever else is drawn there.
  */
  passesTheClickOn() {
    return false;
  }
  takesAPress(x, y) {
    const connector = this.selection.theConnector();
    if (connector === void 0)
      return false;
    const at = this.selection.inDocumentFromCanvas(x, y);
    return RenderGeometrySection.objectHitAt(connector, at.x, at.y);
  }
  interactionForThePlace(at) {
    const connector = this.selection.theConnector();
    if (connector !== void 0 && ObjectHandles.isATiedConnector(connector))
      return null;
    return super.interactionForThePlace(at);
  }
}
