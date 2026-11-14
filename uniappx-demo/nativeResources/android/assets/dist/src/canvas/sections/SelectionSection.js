const _SelectionSection = class _SelectionSection extends CanvasSectionObject {
  constructor() {
    super(...arguments);
    this.processingOrder = app.CSections.DefaultForDocumentObjects.processingOrder;
    this.drawingOrder = app.CSections.DefaultForDocumentObjects.drawingOrder + 1;
    this.zIndex = app.CSections.DefaultForDocumentObjects.zIndex;
    this.documentObject = true;
    this.isAlwaysVisible = true;
    this.travel = new HandleTravel(() => this.handles(), (handle, towards, event) => this.moveHandleBy(handle, towards, event), (handle, event) => this.pressTheHandle(handle, event), (name) => this.blinksWhileActive(name));
    this.known = [];
    this.keyLeftTheHandle = null;
    this.aimingAt = null;
    this.connectorsAwaitingAnswer = /* @__PURE__ */ new Set();
    this.cropAwaitingAnswer = null;
    this.groupsHeld = null;
    this.editor = null;
    this.hovered = null;
    this.otherModeShown = false;
    this.otherModeWait = null;
    this.interaction = null;
    this.snap = new SelectionSnap();
    this.pendingClick = null;
    this.pressedAHandle = false;
    this.pressedHandle = null;
    this.pressedGroup = null;
    this.pressedTheText = false;
    this.heldBackAt = null;
    this.square = null;
    this.frameFollowsTheObjects = false;
    this.lastMoved = null;
    this.keysChanged = (e) => {
      if (!this.interaction || !this.lastMoved)
        return;
      if (!["Shift", "Alt", "Control"].includes(e.key))
        return;
      const letGo = e.type === "keyup" ? e.key : null;
      this.interaction.move(this.lastMoved.at, {
        shiftKey: letGo !== "Shift" && e.shiftKey,
        altKey: letGo !== "Alt" && e.altKey,
        ctrlKey: letGo !== "Control" && e.ctrlKey
      });
    };
  }
  /// Whether the keyboard is on a point to tie a connector to, or on a point of the path.
  keyboardIsOnAPoint() {
    const handle = this.travel.activeHandle();
    const group = handle ? this.groupOf(handle) : void 0;
    return group instanceof TiePointHandles || group instanceof PathHandles;
  }
  /*
      Takes away the point to tie a connector to, or the point of the path, that the keyboard is
      on. Answers whether the keyboard was on such a point. A point to tie a connector to that
      the shape makes from its own geometry stays.
  */
  deleteThePointByKey() {
    const handle = this.travel.activeHandle();
    const group = handle ? this.groupOf(handle) : void 0;
    return handle !== void 0 && (group instanceof TiePointHandles || group instanceof PathHandles) && group.deleteThePoint(handle);
  }
  /// Whether the handle of that name blinks while the keyboard is on it, as its group says.
  blinksWhileActive(name) {
    const handle = this.handles().find((one) => one.name === name);
    const group = handle ? this.groupOf(handle) : void 0;
    return group ? group.blinksWhileActive() : true;
  }
  /*
      Space, Return or 0 on a handle the keyboard is on. On the handle above the selection, 0
      brings the angle of its mode back to nought, the turn or the slant, and once that is
      nought the other one. Space and Return switch between turning and shearing, where both are
      offered, as a click on it does. Other handles take no such key.
  */
  pressTheHandle(handle, event) {
    var _a;
    if ((_a = this.groupOf(handle)) == null ? void 0 : _a.pressByKey(handle, event))
      return true;
    if (handle.kind !== _SelectionSection.turningKind)
      return false;
    if (event.key === "0") {
      const shearing = this.handleMode() === "shear";
      const ownIsNought = shearing ? !this.anglesOf("slant").any : !this.anglesOf("turn").any && !this.aLineStandsAslant();
      if (ownIsNought) {
        const other = shearing ? "turn" : "slant";
        if ((other === "turn" ? this.anglesOf("turn").any || this.aLineStandsAslant() : this.anglesOf("slant").any) && this.takeTheAnglesAway(other))
          this.redraw();
        return true;
      }
      const group = this.groupOf(handle);
      if (group instanceof TurningHandle)
        group.backToNought(handle);
      return true;
    }
    if (!this.shearingIsOffered())
      return false;
    this.switchTheHandleMode();
    return true;
  }
  /// The name of the handle under the mouse, or nothing.
  hoveredHandle() {
    return this.hovered;
  }
  /// The key of the selected objects, the same for the same objects in any order.
  keyOfTheSelection() {
    return _SelectionSection.keyOf(this.selectedObjects());
  }
  static keyOf(objectIds) {
    return objectIds.slice().sort((a, b) => a - b).join(",");
  }
  /// Those objects are selected here: where they are not the ones that were sheared, the
  /// handle turns again, as it does for every new selection.
  static selectedHere(objectIds) {
    if (_SelectionSection.shearing !== _SelectionSection.keyOf(objectIds))
      _SelectionSection.shearing = null;
  }
  /// Whether the points to tie a connector to are shown for this selection.
  tiePointsAreShown() {
    return _SelectionSection.tiePoints.areShownFor(this.keyOfTheSelection());
  }
  /// Whether the points of the path are shown for editing in this selection.
  pathPointsAreShown() {
    return _SelectionSection.pathPoints.areShownFor(this.keyOfTheSelection());
  }
  /// Shows the points to tie a connector to, or hides them again. They are shown for one
  /// selected object only, since only one object at a time has its points drawn.
  switchTheTiePoints() {
    this.switchThePoints(_SelectionSection.tiePoints, _SelectionSection.pathPoints, this.selectedObjects().length === 1);
  }
  /// Shows the points of the path for editing, or hides them again. They are shown only when one
  /// object is selected and its path can be edited.
  switchThePathPoints() {
    this.switchThePoints(_SelectionSection.pathPoints, _SelectionSection.tiePoints, this.editor !== null);
  }
  /*
      Shows these points, or hides them again. They are shown only when allowed. Showing them
      hides the other kind of points, because both lie on the same object and a press could not
      tell which one it meant.
  */
  switchThePoints(points, other, canBeShown) {
    const key = this.keyOfTheSelection();
    const shown = points.areShownFor(key);
    if (!shown && !canBeShown)
      return;
    points.showFor(shown ? null : key);
    if (!shown)
      other.showFor(null);
    this.travel.leave();
    this.refresh();
    this.containerObject.requestReDraw();
    _SelectionSection.tellThePoints();
  }
  /// Hides the points to tie a connector to, as a new selection does.
  static hideTheTiePoints() {
    _SelectionSection.tiePoints.showFor(null);
    _SelectionSection.tellThePoints();
  }
  /// Hides the points of the path, as a new selection does.
  static hideThePathPoints() {
    _SelectionSection.pathPoints.showFor(null);
    _SelectionSection.tellThePoints();
  }
  /// Whether a press on the object gives it a new point to tie a connector to.
  isAddingATiePoint() {
    return _SelectionSection.tiePoints.areAddedFor(this.keyOfTheSelection());
  }
  /// Whether the next press on the object adds a point to its path.
  isAddingAPathPoint() {
    return _SelectionSection.pathPoints.areAddedFor(this.keyOfTheSelection());
  }
  /*
      Starts adding a point to tie a connector to: the next press on the object, off its
      handles, gives it a new point there. The pointer over the object becomes a cross. Adding
      ends with that point, with Escape, or when the points are hidden.
  */
  startAddingATiePoint() {
    this.startAddingAPoint(_SelectionSection.tiePoints);
  }
  /*
      Starts adding a point to the path. The next press on the object, away from its handles,
      adds a point on the nearest edge. The pointer over the object becomes a cross. Adding ends
      after that point, on Escape, or when the points are hidden.
  */
  startAddingAPathPoint() {
    this.startAddingAPoint(_SelectionSection.pathPoints);
  }
  startAddingAPoint(points) {
    if (!points.areShownFor(this.keyOfTheSelection()))
      return;
    points.startAdding();
    this.travel.leave();
    this.containerObject.requestReDraw();
    _SelectionSection.tellThePoints();
  }
  /// Stops adding a point of either kind and sets the pointer for where the mouse is. Returns
  /// whether a point was being added.
  static stopAddingAPoint() {
    var _a;
    const stoppedATiePoint = _SelectionSection.tiePoints.stopAdding();
    const stoppedAPathPoint = _SelectionSection.pathPoints.stopAdding();
    if (!stoppedATiePoint && !stoppedAPathPoint)
      return false;
    (_a = GraphicSelection.selectionSection) == null ? void 0 : _a.pointAtTheMouse();
    _SelectionSection.tellThePoints();
    return true;
  }
  /// Tells the toolbars, for each kind of points, whether they are shown and whether one is
  /// being added. Each state is told only when it changed.
  static tellThePoints() {
    const section = GraphicSelection.selectionSection;
    _SelectionSection.tiePoints.tell((section == null ? void 0 : section.tiePointsAreShown()) ?? false, (section == null ? void 0 : section.isAddingATiePoint()) ?? false);
    _SelectionSection.pathPoints.tell((section == null ? void 0 : section.pathPointsAreShown()) ?? false, (section == null ? void 0 : section.isAddingAPathPoint()) ?? false);
  }
  /// The group of the points to tie a connector to.
  tiePointGroup() {
    return this.groups().find((group) => group instanceof TiePointHandles);
  }
  /// The group of the points of the path.
  pathGroup() {
    return this.groups().find((group) => group instanceof PathHandles);
  }
  /// The mode the handle above the selection is in. It shears only where every selected object
  /// may be sheared; otherwise turning is the only mode.
  handleMode() {
    return _SelectionSection.shearing === this.keyOfTheSelection() && this.shearingIsOffered() ? "shear" : "turn";
  }
  /// Whether shearing is offered for this selection: where every object in it may be sheared.
  shearingIsOffered() {
    return ObjectHandles.canBeSheared(this.selectedObjects());
  }
  /// Switches the handle above the selection to the other mode, where shearing is offered.
  switchTheHandleMode() {
    if (!this.shearingIsOffered())
      return;
    _SelectionSection.shearing = this.handleMode() === "shear" ? null : this.keyOfTheSelection();
    this.containerObject.requestReDraw();
  }
  showsTheOtherMode() {
    return this.otherModeShown;
  }
  /*
      The bar behind the handle above the selection and the handle of the other mode while that
      one is shown, in canvas pixels: the two points its line runs between and how far the bar
      reaches out from that line. Its ends are half circles around those points, as wide as the
      bar. The points are the middles of the two handles, and beyond the one that shows the
      slanted symbol of shearing the line goes on a little, since that symbol is wider than the
      circle and needs more room to the end. Nothing while the handle of the other mode is not
      shown.
  */
  barToTheOtherMode() {
    if (!this.otherModeShown)
      return null;
    const shown = this.handles();
    const from = shown.find((handle) => handle.kind === _SelectionSection.turningKind);
    const to = shown.find((handle) => handle.kind === _SelectionSection.otherModeKind);
    if (!from || !to)
      return null;
    const start = HandleLook.drawnAt(from);
    const end = HandleLook.drawnAt(to);
    const a = new cool.Point(start.vX, start.vY);
    const b = new cool.Point(end.vX, end.vY);
    const length = b.subtract(a).length();
    if (!length)
      return null;
    const size = ShapeHandlesSection.handleSize();
    const along = b.subtract(a).multiplyBy(0.5 * size / length);
    const shearingFirst = this.handleMode() === "shear";
    return {
      from: shearingFirst ? a.subtract(along) : a,
      to: shearingFirst ? b : b.add(along),
      reach: 1.25 * size
    };
  }
  /*
      The middle of the bar to the handle of the other mode, the angle it lies at and its half
      length, in canvas pixels; the half height is how far it reaches out.
  */
  static layOfTheBar(bar) {
    const way = bar.to.subtract(bar.from);
    return {
      middle: bar.from.add(way.multiplyBy(0.5)),
      turn: Math.atan2(way.y, way.x),
      halfLength: way.length() / 2 + bar.reach
    };
  }
  /// Whether that point on the canvas lies on the bar to the handle of the other mode: no
  /// further from the line between the two middles than the bar reaches out.
  onTheBarToTheOtherMode(mouse) {
    const bar = this.barToTheOtherMode();
    if (!bar)
      return false;
    const way = bar.to.subtract(bar.from);
    const length = way.length();
    if (!length)
      return false;
    const along = Math.max(0, Math.min(length, mouse.subtract(bar.from).dot(way) / length));
    const nearest = bar.from.add(way.multiplyBy(along / length));
    return mouse.distanceTo(nearest) <= bar.reach;
  }
  /*
      Draws the bar to the handle of the other mode, behind the handles, where it is shown: a
      rectangle along the upper side with half circles for ends, filled and edged as a handle
      under the mouse is, as both handles on it are drawn.
  */
  drawTheBarToTheOtherMode() {
    const bar = this.barToTheOtherMode();
    if (!bar)
      return;
    const lay = _SelectionSection.layOfTheBar(bar);
    const width = lay.halfLength;
    const height = bar.reach;
    const corner = height;
    this.context.save();
    this.context.translate(lay.middle.x, lay.middle.y);
    this.context.rotate(lay.turn);
    this.context.beginPath();
    this.context.moveTo(-width + corner, -height);
    this.context.arcTo(width, -height, width, height, corner);
    this.context.arcTo(width, height, -width, height, corner);
    this.context.arcTo(-width, height, -width, -height, corner);
    this.context.arcTo(-width, -height, width, -height, corner);
    this.context.closePath();
    this.context.fillStyle = HandleLook.colorOfTheKind.turning;
    this.context.strokeStyle = _SelectionSection.underTheMouse(HandleLook.colorOfTheKind.turning);
    this.context.lineWidth = 2 * app.dpiScale;
    this.context.fill();
    this.context.stroke();
    this.context.restore();
  }
  /// How long the mouse rests on the handle above the selection before the handle of the other
  /// mode comes up, in milliseconds (vectorOtherModeDelay).
  static otherModeDelay() {
    var _a;
    const delay = ((_a = window.prefs) == null ? void 0 : _a.getNumber("vectorOtherModeDelay", 2e3)) ?? 2e3;
    return delay >= 0 ? delay : 2e3;
  }
  /// Puts the handle of the other mode away, and calls off a wait for it.
  dropTheOtherMode() {
    if (this.otherModeWait !== null) {
      app.timerRegistry.clearTimeout(this.otherModeWait);
      this.otherModeWait = null;
    }
    if (this.otherModeShown) {
      this.otherModeShown = false;
      this.containerObject.requestReDraw();
    }
  }
  /*
      Follows the mouse for the switch to the other mode. Once the mouse has rested on the handle
      above the selection for a while, the handle of the other mode comes up beside it, with a
      bar behind both, and stays while the mouse is on the bar, given as the point on the
      canvas. A press on the handle, which begins a drag, comes before that, so a drag starts
      without the bar. Reaching that handle switches the mode, and it goes again with the bar,
      so the mouse stands beside the handle and nothing switches again until it comes back onto
      it. Answers whether the mode was switched.
  */
  followTheOtherMode(over, mouse) {
    if ((over == null ? void 0 : over.kind) === _SelectionSection.otherModeKind) {
      this.dropTheOtherMode();
      this.switchTheHandleMode();
      return true;
    }
    const onTheHandle = (over == null ? void 0 : over.kind) === _SelectionSection.turningKind && !over.deactivated && !this.interaction && this.shearingIsOffered();
    if (this.otherModeShown) {
      const onTheBar = !over && !!mouse && !this.interaction && this.onTheBarToTheOtherMode(mouse);
      if (!onTheHandle && !onTheBar)
        this.dropTheOtherMode();
      return false;
    }
    if (!onTheHandle) {
      this.dropTheOtherMode();
      return false;
    }
    if (this.otherModeWait === null)
      this.otherModeWait = app.timerRegistry.setTimeout("otherMode", () => {
        this.otherModeWait = null;
        if (this.interaction)
          return;
        this.otherModeShown = true;
        this.containerObject.requestReDraw();
      }, _SelectionSection.otherModeDelay());
    return false;
  }
  /*
      The color that marks the handle the mouse is over: the handle's own color with its
      light turned up, or turned down where it is light already, so that the mark stands out
      from it whatever color that is. Nothing else about the handle changes.
  */
  static underTheMouse(color) {
    const of = (at) => parseInt(color.substr(at, 2), 16) / 255;
    const red = of(1);
    const green = of(3);
    const blue = of(5);
    const light = Math.max(red, green, blue);
    const shade = light > 0.6 ? 0.55 : 1.8;
    const back = (one) => Math.round(Math.min(1, one * shade) * 255).toString(16).padStart(2, "0");
    return "#" + back(red) + back(green) + back(blue);
  }
  /*
      The groups of handles of this selection, in order. The last one is the object itself,
      which holds no handle and takes a press that reached none.
  */
  groups() {
    if (!this.groupsHeld)
      this.groupsHeld = [
        new FramingHandles(this),
        new CropHandles(this),
        new TurningHandle(this),
        new ShapingHandles(this),
        new TiePointHandles(this),
        new PathHandles(this),
        new TableHandles(this),
        this.theConnector() === void 0 ? new TheObjectItself(this) : new TheConnectorItself(this)
      ];
    return this.groupsHeld;
  }
  /// The group a handle belongs to, or nothing for a handle of no group.
  /// Whether that handle keeps its place on the page while the objects are moved or scaled,
  /// as the group it belongs to says.
  keepsItsPlace(handle) {
    var _a;
    return ((_a = this.groupOf(handle)) == null ? void 0 : _a.keepsItsPlace(handle)) ?? false;
  }
  groupOf(handle) {
    return this.groups().find((group) => group.name === handle.group);
  }
  /// Works the handles out again from the objects as they stand, and covers them.
  refresh() {
    this.groupsHeld = null;
    const objects = this.selectedObjects();
    this.editor = PolyPolygonEditor.editedPath(objects) ? new PolyPolygonEditor(objects[0]) : null;
    if (!this.editor && this.pathPointsAreShown() && objects.every((objectId) => RenderGeometrySection.objectOf(objectId)))
      _SelectionSection.hideThePathPoints();
    const worked = this.handlesOfTheGroups();
    if (!worked.length && this.known.length)
      return;
    this.known = worked;
    this.followTheHandleByPlace();
    this.keyLeftTheHandle = null;
    this.coverTheHandles();
  }
  /*
      The middle of what is selected, from the two handles that frame it across the diagonal.
      Nothing where the client did not work the framing handles out.
  */
  middle() {
    return _SelectionSection.middleOf(this.handlesOf(this.groups()));
  }
  /// The middle of the selection as those handles frame it.
  static middleOf(shown) {
    const upperLeft = shown.find((one) => one.kind === "1");
    const lowerRight = shown.find((one) => one.kind === "8");
    if (!upperLeft || !lowerRight)
      return void 0;
    return new cool.SimplePoint((upperLeft.point.x + lowerRight.point.x) * 0.5, (upperLeft.point.y + lowerRight.point.y) * 0.5);
  }
  /// The handles as they are drawn now: where a drag would leave them while one runs, where
  /// the objects put them otherwise.
  handles() {
    return this.handlesOf(this.groups().filter((group) => group.isShown()));
  }
  /// The handles of those groups as the running interaction leaves them, shown or not.
  handlesOf(groups) {
    var _a;
    const shown = ((_a = this.interaction) == null ? void 0 : _a.handles(this.known)) ?? this.known;
    return groups.flatMap((group) => {
      const placed = group.place(shown);
      if (placed)
        return placed.map((handle) => ({
          ...handle,
          group: group.name
        }));
      return shown.filter((handle) => handle.group === group.name);
    });
  }
  /// The handles as the objects have them, which is what an interaction works from.
  knownHandles() {
    return this.known;
  }
  /// The path of what is selected, for an interaction that works on one of its points.
  pathEditor() {
    return this.editor;
  }
  /// Asks for the page to be drawn again, after something moved under an interaction.
  redraw() {
    this.tellWhoStandsIn();
    GraphicSelection.followTheGroupButtons();
    GraphicSelection.followThePlayer();
    this.containerObject.requestReDraw();
  }
  /// Takes in every handle with the box it is drawn as, so that a press on one arrives here.
  coverTheHandles() {
    const shown = this.handles();
    const handlesOrObjects = shown.length ? cool.Range2D.fromPoints(shown.map((handle) => HandleLook.drawnAt(handle))) : this.boxOfTheObjects();
    if (!handlesOrObjects) {
      this.size = [0, 0];
      return;
    }
    const box = ShapeHandlesSection.handleSize() * app.pixelsToTwips;
    const covered = handlesOrObjects.expand(box, box);
    const area = new cool.SimpleRectangle(covered.minX, covered.minY, covered.width, covered.height);
    this.size = [area.pWidth, area.pHeight];
    this.setPosition(area.pX1, area.pY1);
  }
  /*
          The handle whose box holds that point, which is where the mouse is on the canvas. The
          handles are searched from the last one to the first, so that the one lying on top of the
          others is the one taken hold of - two of them can sit at the same place, the corner
          radius of a rectangle right next to the upper left corner among them.
  
          Only a handle that has a name can be taken hold of. A nameless one is shown and no more,
          as the points a connector could tie itself to are, and one of those sits exactly where the
          end of a tied connector sits. A deactivated one, shown grey, is found only where asked
          for: it takes a press, which then does nothing, as in the office.
      */
  handleAt(x, y, deactivatedToo = false) {
    var _a, _b, _c;
    const usual = 0.5 * ShapeHandlesSection.handleSize();
    const shown = this.handles();
    for (let at = shown.length - 1; at >= 0; --at) {
      if (!shown[at].name || shown[at].deactivated && !deactivatedToo)
        continue;
      const reach = ((_a = this.groupOf(shown[at])) == null ? void 0 : _a.reachOf(usual)) ?? usual;
      const half = shown[at].larger ? reach + HandleLook.largerBy("shaping") : reach;
      const across = ((_b = shown[at].reach) == null ? void 0 : _b.x) ?? half;
      const down = ((_c = shown[at].reach) == null ? void 0 : _c.y) ?? half;
      const point = HandleLook.drawnAt(shown[at]);
      if (Math.abs(point.vX - x) <= across && Math.abs(point.vY - y) <= down)
        return shown[at];
    }
    return void 0;
  }
  /*
      The four corners of the selection, in the order they go round it, in view pixels. Empty
      where the client did not work the framing handles out.
  */
  cornersInView() {
    const framing = this.framingCorners();
    return framing.length === 4 ? framing : this.boxInView();
  }
  /// The four corners the eight stand on, in the order they go round, in view pixels. Empty for
  /// a selection that is framed by no handles.
  framingCorners() {
    const framing = this.handlesOf(this.groups());
    return ["1", "3", "8", "6"].map((kind) => framing.find((handle) => handle.kind === kind)).filter((handle) => handle !== void 0).map((handle) => {
      const point = new cool.SimplePoint(handle.point.x, handle.point.y);
      return new cool.Point(point.vX, point.vY);
    });
  }
  /// The box the selected objects take up, in twips. Nothing where the client holds no box for
  /// one of them.
  boxOfTheObjects() {
    let box = null;
    for (const objectId of this.selectedObjects()) {
      const one = RenderGeometrySection.boxOf(objectId);
      if (!one)
        return null;
      box = box ? box.union(one) : one;
    }
    return box;
  }
  /*
      The four corners of the box the selected objects take up, for a selection that is framed
      by no handles: a connector is offered its own points alone, and the box is then what says
      where the selection is and what a press on it lands on.
  */
  boxInView() {
    const box = this.boxOfTheObjects();
    if (!box)
      return [];
    const upperLeft = new cool.SimplePoint(box.minX, box.minY);
    const lowerRight = new cool.SimplePoint(box.maxX, box.maxY);
    return [
      new cool.Point(upperLeft.vX, upperLeft.vY),
      new cool.Point(lowerRight.vX, upperLeft.vY),
      new cool.Point(lowerRight.vX, lowerRight.vY),
      new cool.Point(upperLeft.vX, lowerRight.vY)
    ];
  }
  /*
      Whether that point lies within the selection. The four corners go round it in order, so
      a point inside is on the same side of every one of the four edges. It holds for a
      selection that is turned as well as for one that is upright.
  */
  within(x, y) {
    const corners = this.cornersInView();
    if (corners.length !== 4)
      return false;
    const pressed = new cool.Point(x, y);
    let left = false;
    let right = false;
    for (let at = 0; at < 4; ++at) {
      const one = corners[at];
      const next = corners[(at + 1) % 4];
      const side = next.subtract(one).cross(pressed.subtract(one));
      if (side > 0)
        right = true;
      if (side < 0)
        left = true;
    }
    return !(left && right);
  }
  /*
          A press lands here where it is on a handle, and where it is on the selection itself,
          which is what carrying it begins with. Everywhere else it goes to whoever draws the page.
  
          What counts as on the selection is the box it takes up, except for a connector: a
          connector is a line across a box that is mostly empty, and a press in that emptiness
          belongs to whatever is drawn there, so only the line itself counts.
      */
  isHit(point) {
    if (this.handleAt(point[0], point[1], true) !== void 0)
      return true;
    if (this.onTheBarToTheOtherMode(new cool.Point(point[0], point[1])))
      return true;
    return this.groups().some((group) => group.takesAPress(point[0], point[1]));
  }
  /// The point on the page, in twips, that a place on the canvas stands for.
  inDocumentFromCanvas(x, y) {
    return cool.SimplePoint.fromCorePixels([
      x - this.myTopLeft[0] + this.position[0],
      y - this.myTopLeft[1] + this.position[1]
    ]);
  }
  /*
      While an end of a connector is dragged, the object under the mouse is the one the end
      would tie itself to, and it offers the places where it could land. They come and go as
      the mouse enters an object and leaves it again.
  */
  aimAtWhatIsUnder(at) {
    var _a;
    const connector = this.theConnector();
    const held = (_a = this.interaction) == null ? void 0 : _a.handleHeld();
    const onAnEnd = connector !== void 0 && held !== null && held !== void 0 && ["9.0.0", "9.0.1"].includes(held.name);
    const under = onAnEnd ? RenderGeometrySection.objectIdAt(at.x, at.y) ?? null : null;
    const aimed = under === connector ? null : under;
    if (aimed === this.aimingAt)
      return;
    this.aimingAt = aimed;
    this.coverTheHandles();
    this.redraw();
  }
  /*
      Where an end of the connector being dragged to that place would tie itself, worked out
      the way the engine works it out when the end is let go: on the object aimed at, one of
      its own points within a handle's reach comes first, then the middle of one of its sides,
      then the middle of its box, which makes the engine pick the best side itself. An end over
      the object but near none of those stays free, so a shape behind the drag does not take
      an end that was only passing over it. Nothing while no object is aimed at.
  */
  whereTheEndWouldTie(at) {
    var _a, _b;
    const aimed = this.aimingAt;
    if (aimed === null)
      return null;
    const object = RenderGeometrySection.objectOf(aimed);
    if (!object)
      return null;
    const reach = ShapeHandlesSection.handleSize() * app.pixelsToTwips;
    const within = (point) => Math.abs(point.x - at.x) <= reach && Math.abs(point.y - at.y) <= reach;
    const nearest = (handles) => {
      let best;
      let bestDistance = Number.POSITIVE_INFINITY;
      handles.forEach((handle, index) => {
        if (!within(handle.point))
          return;
        const distance = Math.abs(handle.point.x - at.x) + Math.abs(handle.point.y - at.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { handle, index };
        }
      });
      return best;
    };
    const own = nearest(GluePointHandles.ownPointsOf(aimed));
    if (own) {
      const id = (_b = (_a = object.gluePoints) == null ? void 0 : _a[own.index]) == null ? void 0 : _b.id;
      return {
        objectId: aimed,
        tie: { point: id ?? 0 },
        point: own.handle.point
      };
    }
    const side = nearest(GluePointHandles.defaultPointsOf(aimed));
    if (side)
      return {
        objectId: aimed,
        tie: { autoVertex: true, point: side.index },
        point: side.handle.point
      };
    if (object.x !== void 0 && object.y !== void 0) {
      const middle = new cool.Point(object.x + (object.width ?? 0) / 2, object.y + (object.height ?? 0) / 2);
      if (within(middle))
        return { objectId: aimed, tie: { bestVertex: true } };
    }
    return null;
  }
  /*
      Which way a handle that moves a line of the selected connector goes, worked out from the
      connector's run as it stands now. Nothing for an end of the connector, for anything that
      is not a connector, and for a run that was set from outside.
  */
  howTheLineHandleMoves(handle) {
    const connector = this.theConnector();
    if (connector === void 0 || handle.kind !== "9" || _SelectionSection.connectorEnds.includes(handle.name))
      return void 0;
    const data = RenderGeometrySection.currentPart();
    const object = data == null ? void 0 : data.objects.get(connector);
    const number = Number(handle.name.split(".")[2]);
    if (!data || !object || !(number >= 2))
      return void 0;
    return ConnectorRouter.lineHandle(data, object, number);
  }
  /*
      the runs of the connectors tied to the object's own glue point of that handle, while the
      point stands at that place on the page. nothing for any other handle
  */
  runsWhileAGluePointIsDragged(handle, at) {
    var _a, _b, _c, _d;
    if (handle.kind !== "GluePoint")
      return null;
    const objectId = this.selectedObjects()[0];
    const index = Number(handle.name.split(".")[1]);
    const data = RenderGeometrySection.currentPart();
    const object = data == null ? void 0 : data.objects.get(objectId);
    const id = (_b = (_a = object == null ? void 0 : object.gluePoints) == null ? void 0 : _a[index]) == null ? void 0 : _b.id;
    const place = (_d = (_c = RenderGeometrySection.transformOf(objectId)) == null ? void 0 : _c.invert()) == null ? void 0 : _d.apply(at.x, at.y);
    if (!data || id === void 0 || !place)
      return null;
    const runs = [];
    for (const connectorId of ConnectorRouter.tiedTo(data, [objectId])) {
      const connector = data.objects.get(connectorId);
      const routing = connector == null ? void 0 : connector.routing;
      const onThePoint = (connector == null ? void 0 : connector.tiedToAtStart) === objectId && (routing == null ? void 0 : routing.tieAtStart.point) === id || (connector == null ? void 0 : connector.tiedToAtEnd) === objectId && (routing == null ? void 0 : routing.tieAtEnd.point) === id;
      if (!connector || !onThePoint)
        continue;
      const run = ConnectorRouter.routeWithAGluePoint(data, connector, objectId, index, place);
      if (run)
        runs.push({ closed: false, points: run });
    }
    return runs.length ? runs : null;
  }
  /*
      The run a drag of a line handle of a connector shows of itself. Where the client routes
      the connector, the run is laid out anew with that line moved across itself by what the
      drag moved, which is what the engine does with such a drag. Otherwise it is the current
      run with the line the handle sits on moved, the line being the one whose middle the
      handle stood on. Nothing for anything else.
  */
  runWhileALineIsDragged(handle, at) {
    const connector = this.theConnector();
    if (connector === void 0)
      return null;
    if (handle.kind !== "9" || _SelectionSection.connectorEnds.includes(handle.name))
      return null;
    const data = RenderGeometrySection.currentPart();
    const routedFrom = data == null ? void 0 : data.objects.get(connector);
    const number = Number(handle.name.split(".")[2]);
    const startedAt = ObjectHandles.shapingOf([connector]).find((one) => one.name === handle.name);
    if (data && routedFrom && startedAt && number >= 2) {
      const routed = ConnectorRouter.routeWithALineMoved(data, routedFrom, number, new cool.Point(at.x - startedAt.point.x, at.y - startedAt.point.y));
      if (routed)
        return [{ closed: false, points: routed }];
    }
    const object = RenderGeometrySection.objectOf(connector);
    const run = object ? ConnectorRouter.trackOf(object) : void 0;
    if (!run || run.length < 2)
      return null;
    const stood = startedAt;
    if (!stood)
      return null;
    let line = -1;
    let nearest = Number.POSITIVE_INFINITY;
    for (let n = 0; n + 1 < run.length; ++n) {
      const middle = new cool.Point((run[n].x + run[n + 1].x) / 2, (run[n].y + run[n + 1].y) / 2);
      const away = middle.distanceTo(stood.point);
      if (away < nearest) {
        nearest = away;
        line = n;
      }
    }
    if (line < 0)
      return null;
    const horizontal = Math.abs(run[line + 1].y - run[line].y) <= Math.abs(run[line + 1].x - run[line].x);
    const moved = run.map((point) => ({ ...point }));
    const by = at.subtract(stood.point);
    for (const n of [line, line + 1]) {
      if (horizontal)
        moved[n].y += by.y;
      else
        moved[n].x += by.x;
    }
    return [{ closed: false, points: moved }];
  }
  /*
      The run a drag of one end of a connector shows of itself: the connector laid out anew
      between the end that stays and the one the drag holds, tied where it would tie or free
      where it would lie, as a thin line. Where the connector has no routing numbers the line
      runs straight from the one end to the other. Nothing for anything else.
  */
  runWhileAnEndIsDragged(handle, at) {
    const connector = this.theConnector();
    if (connector === void 0)
      return null;
    const dragged = _SelectionSection.connectorEnds.indexOf(handle.name);
    if (dragged < 0)
      return null;
    const data = RenderGeometrySection.currentPart();
    const object = data == null ? void 0 : data.objects.get(connector);
    if (data && (object == null ? void 0 : object.routing)) {
      const would = this.whereTheEndWouldTie(at);
      const run = ConnectorRouter.routeWithAnEnd(data, object, dragged === 0, would ? would.tie : { x: at.x, y: at.y }, would == null ? void 0 : would.objectId);
      if (run)
        return [{ closed: false, points: run }];
    }
    const stays = this.known.find((one) => one.name === _SelectionSection.connectorEnds[1 - dragged]);
    if (!stays)
      return null;
    return [
      {
        closed: false,
        points: [
          { x: stays.point.x, y: stays.point.y },
          { x: at.x, y: at.y }
        ]
      }
    ];
  }
  /// The object an end of a connector is being dragged onto, or nothing while none is aimed at.
  aimedAtObject() {
    return this.aimingAt;
  }
  /// Where the running drag has taken what it holds, or nothing while nothing is dragged.
  leadingPointOfTheDrag() {
    var _a;
    return ((_a = this.interaction) == null ? void 0 : _a.leadingPoint()) ?? null;
  }
  /// The connector this selection stands on, where it stands on one and it is a connector.
  theConnector() {
    const objects = this.selectedObjects();
    if (objects.length !== 1)
      return void 0;
    return ObjectHandles.isAConnector(objects[0]) ? objects[0] : void 0;
  }
  /*
      Draws the dashed line around what is selected, through the four corners the framing
      handles sit on. They follow whatever is being done to the selection, so the line turns
      with a turn and grows with a scale.
  */
  drawTheFrame() {
    const objects = this.selectedObjects();
    const corners = objects.length === 1 && ObjectHandles.isAChartPartHeldInPlace(objects[0]) ? this.boxInView() : this.framingCorners();
    if (corners.length !== 4)
      return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.strokeStyle = app.map.uiManager.isBackgroundDark() ? "white" : "black";
    this.context.setLineDash([3, 3]);
    this.context.beginPath();
    corners.forEach((corner, at) => {
      if (at === 0)
        this.context.moveTo(corner.x, corner.y);
      else
        this.context.lineTo(corner.x, corner.y);
    });
    this.context.closePath();
    this.context.stroke();
    this.context.setLineDash([]);
    this.context.restore();
  }
  /*
      Draws the marks the chart shows on a part of it that is held in place, a small square on
      each data point of a series or on each label of its data labels, as the chart does.
  */
  drawTheChartMarks() {
    var _a, _b;
    const objects = this.selectedObjects();
    if (objects.length !== 1)
      return;
    const marks = ((_b = (_a = RenderGeometrySection.objectOf(objects[0])) == null ? void 0 : _a.chartPart) == null ? void 0 : _b.marks) ?? [];
    if (!marks.length)
      return;
    const size = HandleLook.widthOf("pathPoint");
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.fillStyle = HandleLook.colorOfTheKind.pathPoint;
    this.context.strokeStyle = HandleLook.outlineColour;
    this.context.lineWidth = 1;
    for (const mark of marks) {
      const at = new cool.SimplePoint(mark.x, mark.y);
      this.context.fillRect(at.vX - size / 2, at.vY - size / 2, size, size);
      this.context.strokeRect(at.vX - size / 2, at.vY - size / 2, size, size);
    }
    this.context.restore();
  }
  /*
      The object under the chart's mark at that point of the document, of the part of an object
      active in place that is selected alone. A mark stands on the middle of each object the
      part holds where the part has one mark for each of them, so the object is the one whose
      middle lies nearest to the mark. Nothing off the marks, and nothing for marks that stand
      on the points of a line.
  */
  partMarkedAt(at) {
    var _a, _b;
    const objects = this.selectedObjects();
    if (objects.length !== 1)
      return void 0;
    if (Interaction.placeOf(GraphicSelection.selectedObjectIDs).kind !== "inPlace")
      return void 0;
    const marks = ((_b = (_a = RenderGeometrySection.objectOf(objects[0])) == null ? void 0 : _a.chartPart) == null ? void 0 : _b.marks) ?? [];
    const held = RenderGeometrySection.heldBy(objects[0]);
    if (!marks.length || marks.length !== held.length)
      return void 0;
    const half = HandleLook.widthOf("pathPoint") / 2;
    const mark = marks.find((one) => {
      const drawn = new cool.SimplePoint(one.x, one.y);
      return Math.abs(drawn.vX - at.vX) <= half && Math.abs(drawn.vY - at.vY) <= half;
    });
    if (!mark)
      return void 0;
    let nearest;
    let nearestDistance = Infinity;
    for (const objectId of held) {
      const box = RenderGeometrySection.boxOf(objectId);
      if (!box)
        continue;
      const distance = Math.hypot(box.centerX - mark.x, box.centerY - mark.y);
      if (distance < nearestDistance) {
        nearest = objectId;
        nearestDistance = distance;
      }
    }
    return nearest;
  }
  /*
          The objects the bands go round, from the outermost one inwards: every group the selection
          sits inside, and every selected object that holds others. Each of them takes a band, so how
          deep in a hierarchy of groups the selection sits is there to be seen, and which of several
          selected objects are groups is seen at one look. A diagram is one of them, which is why a
          band stays round a diagram when one of the shapes it holds is selected on its own.
  
          A selection of several objects takes none round itself: it is put together for the moment
          and taken apart again, while a group stays.
      */
  surroundObjects() {
    if (!Interaction.context().showsGroupBands())
      return [];
    const objects = this.selectedObjects();
    if (!objects.length)
      return [];
    const holding = [];
    let walking = RenderGeometrySection.parentOf(objects[0]);
    for (let guard = 0; guard < 100 && walking; ++guard) {
      holding.unshift(walking);
      walking = RenderGeometrySection.parentOf(walking);
    }
    const diagram = holding.findIndex((objectId) => {
      var _a;
      return (_a = RenderGeometrySection.objectOf(objectId)) == null ? void 0 : _a.isDiagram;
    });
    if (diagram >= 0)
      return holding.slice(0, diagram + 1);
    for (const objectId of objects)
      if (RenderGeometrySection.holdsObjects(objectId))
        holding.push(objectId);
    return holding;
  }
  /// What kind of band that object takes.
  surroundKind(objectId) {
    var _a;
    return ((_a = RenderGeometrySection.objectOf(objectId)) == null ? void 0 : _a.isDiagram) ? "diagram" : "group";
  }
  /*
      The four places the band round that group or diagram goes through, in twips, in the order
      they go round it: the corners of the upright box round its frame. For the one that is
      selected that frame is the selection's, the dashed one the handles stand on; for a group
      holding what is selected it is the group's own mapping. So the band is upright and holds
      the frame, however that is turned.
  */
  surroundPlaces(objectId) {
    const objects = this.selectedObjects();
    const frame = objects.length === 1 && objects[0] === objectId ? this.squareNow() : RenderGeometrySection.transformOf(objectId);
    let box = frame ? cool.Range2D.fromPoints([
      frame.apply(0, 0),
      frame.apply(1, 0),
      frame.apply(1, 1),
      frame.apply(0, 1)
    ]) : this.boxAround(RenderGeometrySection.theOnesThatDraw([objectId]));
    if (!box)
      return [];
    const beyond = objects[0] !== objectId ? this.reachOfHandlesInTheBand() : void 0;
    if (beyond)
      box = box.union(beyond);
    return [
      new cool.SimplePoint(box.minX, box.minY),
      new cool.SimplePoint(box.maxX, box.minY),
      new cool.SimplePoint(box.maxX, box.maxY),
      new cool.SimplePoint(box.minX, box.maxY)
    ];
  }
  /*
      The groups and diagrams whose bands take a column of buttons beside them. Where the
      selection sits inside a group or a diagram it is the outermost of those, the one the page
      holds, whatever the depth. Otherwise it is every selected group and diagram, which then
      stand side by side on the page.
  */
  bandsWithButtons() {
    const objects = this.selectedObjects();
    if (!objects.length)
      return [];
    if (!Interaction.contextAt(Interaction.placeOf(objects)).showsGroupBands())
      return [];
    let outermost;
    for (let walking = RenderGeometrySection.parentOf(objects[0]), guard = 0; walking && guard < 100; walking = RenderGeometrySection.parentOf(walking), ++guard)
      outermost = walking;
    if (outermost !== void 0)
      return [outermost];
    return objects.filter((objectId) => RenderGeometrySection.holdsObjects(objectId));
  }
  /*
      The box the band round that group or diagram goes round, in core pixels, or nothing where
      it has none. Whatever stands beside that band is placed against this box, so that it sits
      beside what is drawn and not beside something else.
  */
  /// The box the handles that belong inside a band reach over, in twips, or nothing where
  /// there are none.
  reachOfHandlesInTheBand() {
    var _a, _b, _c;
    const usual = 0.5 * ShapeHandlesSection.handleSize() * app.pixelsToTwips;
    let box;
    for (const handle of this.handles()) {
      if (!((_a = this.groupOf(handle)) == null ? void 0 : _a.extendsTheBand()))
        continue;
      const at = HandleLook.drawnAt(handle);
      const across = (((_b = handle.reach) == null ? void 0 : _b.x) ?? 0) * app.pixelsToTwips || usual;
      const down = (((_c = handle.reach) == null ? void 0 : _c.y) ?? 0) * app.pixelsToTwips || usual;
      const own = new cool.Range2D(at.x - across, at.y - down, at.x + across, at.y + down);
      box = box ? box.union(own) : own;
    }
    return box;
  }
  bandBox(objectId) {
    const places = this.surroundPlaces(objectId);
    if (places.length !== 4)
      return void 0;
    return cool.Range2D.fromPoints(places.map((place) => new cool.Point(place.pX, place.pY)));
  }
  /*
      The four places pushed outwards by that much, in view pixels. Each one moves to the place
      that lies that far from both of the edges meeting there, so the band round them keeps an
      even width along a selection that is turned or sheared.
  */
  static grownOutwards(corners, by) {
    const middle = corners.reduce((sum, corner) => sum.add(corner), new cool.Point(0, 0)).divideBy(corners.length);
    const normals = corners.map((corner, at) => {
      const next = corners[(at + 1) % corners.length];
      const along = next.subtract(corner);
      const length = along.length() || 1;
      const normal = new cool.Point(along.y / length, -along.x / length);
      const outwards = corner.add(next).multiplyBy(0.5).subtract(middle);
      return normal.dot(outwards) < 0 ? normal.multiplyBy(-1) : normal;
    });
    return corners.map((corner, at) => {
      const before = normals[(at + corners.length - 1) % corners.length];
      const here = normals[at];
      const together = before.dot(here);
      const share = by / Math.max(1 + together, 0.2);
      return corner.add(before.add(here).multiplyBy(share));
    });
  }
  /*
      Lays a rounded path through those places into the path being built: along each edge, and
      round each corner with an arc of that radius. The radius is held down to half of the
      shortest edge, so a small band still comes out as a closed path rather than as an arc that
      has nowhere to fit.
  */
  static layRounded(context, corners, radius) {
    const middleOf = (one, other) => one.add(other).multiplyBy(0.5);
    const shortest = Math.min(...corners.map((corner, at) => corners[(at + 1) % corners.length].distanceTo(corner)));
    const rounding = Math.max(0, Math.min(radius, shortest * 0.5));
    const from = middleOf(corners[corners.length - 1], corners[0]);
    context.moveTo(from.x, from.y);
    for (let at = 0; at < corners.length; ++at) {
      const corner = corners[at];
      const to = middleOf(corner, corners[(at + 1) % corners.length]);
      context.arcTo(corner.x, corner.y, to.x, to.y, rounding);
      context.lineTo(to.x, to.y);
    }
    context.closePath();
  }
  /*
          Draws the band round one group or diagram: two rounded paths, the inner one through the
          places the band goes round and the outer one that much further out, with the space between
          them filled.
  
          Everything it is drawn with comes from the one color of its kind: the fill runs from the
          darker of that color through it to the lighter, and both bounds are drawn in the darker.
      */
  drawOneSurround(objectId) {
    const kind = this.surroundKind(objectId);
    if (kind === "group" && !HandleLook.bandRoundAGroup)
      return;
    const places = this.surroundPlaces(objectId);
    if (places.length !== 4)
      return;
    const around = places.map((place) => new cool.Point(place.vX, place.vY));
    const thickness = HandleLook.widthOfASurround();
    const inner = _SelectionSection.grownOutwards(around, HandleLook.distanceBeforeASurround());
    const outer = _SelectionSection.grownOutwards(around, HandleLook.reachOfASurround());
    const color = HandleLook.colorOfTheSurround[kind];
    const lighter = HandleLook.blended(color, HandleLook.surroundBlend);
    const darker = HandleLook.blended(color, -HandleLook.surroundBlend);
    const gradient = this.context.createLinearGradient(outer[0].x, outer[0].y, outer[2].x, outer[2].y);
    gradient.addColorStop(0, darker);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, lighter);
    this.context.beginPath();
    _SelectionSection.layRounded(this.context, outer, thickness);
    _SelectionSection.layRounded(this.context, inner, thickness * 0.5);
    this.context.fillStyle = gradient;
    this.context.fill("evenodd");
    this.context.strokeStyle = darker;
    this.context.lineWidth = app.dpiScale;
    this.context.beginPath();
    _SelectionSection.layRounded(this.context, outer, thickness);
    this.context.stroke();
    this.context.beginPath();
    _SelectionSection.layRounded(this.context, inner, thickness * 0.5);
    this.context.stroke();
  }
  /*
      Draws a band for every group the selection sits in, the outermost first. While a drag
      runs there is none, as there are no buttons beside it then: the band stands where the
      objects stand once the drag is over.
  */
  drawTheSurrounds() {
    if (this.isDragged())
      return;
    const holding = this.surroundObjects();
    if (!holding.length)
      return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    for (const objectId of holding)
      this.drawOneSurround(objectId);
    this.context.restore();
  }
  /*
      Draws the path the running interaction would leave behind, as a thin line. It is what a
      drag of a point shows of itself: moving a point is not a transformation of the object, so
      the object cannot be drawn through one, but the line it would follow can.
  */
  drawTheOutline() {
    const polygons = this.interaction ? this.interaction.outline() : this.groups().flatMap((group) => group.outline() ?? []);
    if (!(polygons == null ? void 0 : polygons.length))
      return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    const origin = new cool.SimplePoint(0, 0);
    this.context.translate(origin.vX, origin.vY);
    this.context.scale(app.twipsToPixels, app.twipsToPixels);
    this.context.strokeStyle = HandleLook.outlineOfADrag;
    this.context.lineWidth = app.pixelsToTwips;
    this.context.beginPath();
    for (const polygon of polygons) {
      const points = polygon.points ?? [];
      if (!points.length)
        continue;
      this.context.moveTo(points[0].x, points[0].y);
      for (let at = 1; at <= points.length; ++at) {
        const from = points[at - 1];
        const to = points[at % points.length];
        if (at === points.length && !polygon.closed)
          break;
        if (from.aheadX !== void 0 || to.behindX !== void 0)
          this.context.bezierCurveTo(from.aheadX ?? from.x, from.aheadY ?? from.y, to.behindX ?? to.x, to.behindY ?? to.y, to.x, to.y);
        else
          this.context.lineTo(to.x, to.y);
      }
      if (polygon.closed)
        this.context.closePath();
    }
    this.context.stroke();
    this.context.restore();
  }
  onDraw() {
    this.drawTheInteraction();
    this.drawTheConnectorsAwaitingAnswer();
    this.drawTheOutline();
    const shown = this.handles();
    for (const group of this.groups())
      group.paint(this, shown);
    this.snap.draw(this);
    this.drawTheSurrounds();
    this.drawTheFrame();
    this.drawTheChartMarks();
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.drawTheBarToTheOtherMode();
    const size = ShapeHandlesSection.handleSize();
    for (const handle of this.handles()) {
      const group = this.groupOf(handle);
      if (!group)
        continue;
      const point = HandleLook.drawnAt(handle);
      const hovered = !handle.deactivated && handle.name !== "" && handle.name === this.hovered || handle.lit === true || handle.kind === _SelectionSection.otherModeKind;
      const grown = !handle.deactivated && this.travel.showsAsActive(handle.name) ? size / 3 : hovered ? size / 8 : 0;
      this.context.beginPath();
      this.context.strokeStyle = handle.deactivated ? HandleLook.deactivatedOutlineColour : HandleLook.outlineColour;
      const color = group.shape(this.context, handle, point, grown);
      this.context.fillStyle = handle.deactivated ? HandleLook.deactivatedColour : color;
      this.context.closePath();
      this.context.fill();
      this.context.stroke();
      if (hovered) {
        this.context.strokeStyle = _SelectionSection.underTheMouse(String(this.context.fillStyle));
        this.context.lineWidth = 2 * app.dpiScale;
        this.context.stroke();
        this.context.lineWidth = 1;
      }
    }
    this.context.restore();
    this.drawTheMarks();
    this.drawTheReading();
    this.drawTheHoldBack();
  }
  /*
      Shows that a key or a drag was held back for an undo or a redo that has been on its way for
      a while: a notice below the selection, fully seen for a moment and then fading away. Each
      further key or drag held back shows it fully again, and it goes at once when the answer is
      in.
  */
  showTheHoldBack() {
    if (ChangeOutbox.undoWaitedFor() < VectorSettings.holdBackToldAfter())
      return;
    const shown = this.heldBackAt !== null;
    this.heldBackAt = performance.now();
    if (!shown)
      this.followTheHoldBack();
  }
  /// Draws the view again on every frame while the notice is shown, and once more after.
  followTheHoldBack() {
    var _a;
    if (this.heldBackAt !== null && (!ChangeOutbox.undoOnItsWay() || performance.now() - this.heldBackAt > VectorSettings.holdBackSeen() + VectorSettings.holdBackFading()))
      this.heldBackAt = null;
    (_a = app.sectionContainer) == null ? void 0 : _a.requestReDraw();
    if (this.heldBackAt !== null)
      requestAnimationFrame(() => this.followTheHoldBack());
  }
  /// Writes the notice of a key or a drag held back below the selection, in a light box with
  /// the color of the handles, as see-through as its fading has made it.
  drawTheHoldBack() {
    if (this.heldBackAt === null || !ChangeOutbox.undoOnItsWay())
      return;
    const past = performance.now() - this.heldBackAt;
    const seen = 1 - Math.max(0, past - VectorSettings.holdBackSeen()) / VectorSettings.holdBackFading();
    const corners = this.cornersInView();
    if (seen <= 0 || !corners.length)
      return;
    const box = cool.Range2D.fromPoints(corners);
    const text = ChangeOutbox.waitsFor() === "redo" ? _("Waiting for redo...") : _("Waiting for undo...");
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.globalAlpha = seen;
    this.context.font = Math.round(12 * app.dpiScale) + "px sans-serif";
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    const padding = 6 * app.dpiScale;
    const width = this.context.measureText(text).width + 2 * padding;
    const height = 12 * app.dpiScale + 2 * padding;
    const x = (box.minX + box.maxX) / 2;
    const y = box.maxY + 2 * ShapeHandlesSection.handleSize() + height / 2;
    this.context.beginPath();
    this.context.roundRect(x - width / 2, y - height / 2, width, height, height / 2);
    this.context.fillStyle = "#FFFFFF";
    this.context.strokeStyle = HandleLook.outlineColour;
    this.context.lineWidth = app.dpiScale;
    this.context.fill();
    this.context.stroke();
    this.context.fillStyle = HandleLook.outlineColour;
    this.context.fillText(text, x, y);
    this.context.restore();
  }
  /*
      Draws the marks of a turn or a shear on the circle the handle runs on: a small triangle
      pointing to the middle, with what it stands for written inside it. They lie over
      everything else, since the handle is taken to them.
  */
  drawTheMarks() {
    var _a, _b;
    const marks = ((_a = this.interaction) == null ? void 0 : _a.marks()) ?? [];
    if (!marks.length)
      return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.lineWidth = 1;
    const font = Math.round(11 * app.dpiScale) + "px sans-serif";
    this.context.font = font;
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    const mouse = (_b = this.lastMoved) == null ? void 0 : _b.at;
    for (const mark of marks) {
      const hit = !!mouse && SelectionInteraction.isOnTheMark(mark, mouse);
      const middle = mark.corners.reduce((sum, corner) => sum.add(corner)).divideBy(mark.corners.length);
      const corners = mark.corners.map((corner) => {
        const grown = hit ? middle.add(corner.subtract(middle).multiplyBy(1.25)) : corner;
        return new cool.SimplePoint(grown.x, grown.y);
      });
      this.context.beginPath();
      corners.forEach((corner, at) => at ? this.context.lineTo(corner.vX, corner.vY) : this.context.moveTo(corner.vX, corner.vY));
      this.context.closePath();
      this.context.fillStyle = HandleLook.colorOfTheKind.turning;
      this.context.strokeStyle = HandleLook.outlineColour;
      this.context.fill();
      this.context.stroke();
      if (hit) {
        this.context.strokeStyle = _SelectionSection.underTheMouse(String(this.context.fillStyle));
        this.context.lineWidth = 2 * app.dpiScale;
        this.context.stroke();
        this.context.lineWidth = 1;
      }
      const written = new cool.SimplePoint(middle.x, middle.y);
      this.context.font = "bold " + font;
      this.context.fillStyle = HandleLook.outlineColour;
      this.context.fillText(mark.label, written.vX, written.vY);
      this.context.font = font;
    }
    this.context.restore();
  }
  /*
      Writes an angle beside where it is changed, below and to the right, where the pointer
      leaves it free: what the running interaction reads beside the mouse, and while nothing
      runs, the turn or the slant beside the handle above the selection, wherever that one is
      shown. It has a light edge, so it reads on any page. Each of the two can be switched off in
      the client's preferences: vectorAngleAtMouse and vectorAngleAtHandle.
  */
  drawTheReading() {
    var _a, _b, _c;
    let reading = null;
    let x = 0;
    let y = 0;
    if (this.interaction) {
      const mouse = (_a = this.lastMoved) == null ? void 0 : _a.at;
      if (!mouse || !((_b = window.prefs) == null ? void 0 : _b.getBoolean("vectorAngleAtMouse", true)))
        return;
      reading = this.interaction.reading();
      const at = new cool.SimplePoint(mouse.x, mouse.y);
      x = at.vX + 16 * app.dpiScale;
      y = at.vY + 24 * app.dpiScale;
    } else {
      const handle = this.handles().find((one) => one.kind === _SelectionSection.turningKind);
      if ((handle == null ? void 0 : handle.kind) !== _SelectionSection.turningKind || handle.deactivated || !((_c = window.prefs) == null ? void 0 : _c.getBoolean("vectorAngleAtHandle", true)))
        return;
      reading = this.readingOfTheHandleAbove(handle);
      const at = HandleLook.drawnAt(handle);
      const size = ShapeHandlesSection.handleSize();
      x = at.vX + size;
      y = at.vY + size;
    }
    if (!reading)
      return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.font = Math.round(11 * app.dpiScale) + "px sans-serif";
    this.context.textAlign = "left";
    this.context.textBaseline = "middle";
    this.context.strokeStyle = "#FFFFFF";
    this.context.lineWidth = 3;
    this.context.strokeText(reading, x, y);
    this.context.fillStyle = HandleLook.outlineColour;
    this.context.fillText(reading, x, y);
    this.context.restore();
  }
  /// The angle of the selection in the mode of the handle above it: the turn as the engine
  /// counts it, or the slant.
  readingOfTheHandleAbove(handle) {
    return this.handleMode() === "shear" ? ShearingInteraction.readingOf(ShearingInteraction.slantOf(this, handle.turnedBy ?? 0)) : TurningInteraction.readingOf(this.turnOfTheSelection());
  }
  /// Whether the selection is one object that draws itself, not several and not a group.
  isOneObject() {
    const objects = this.selectedObjects();
    const drawing = RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(objects));
    return objects.length === 1 && drawing.length === 1 && drawing[0] === objects[0];
  }
  /// The turn of a mapping: the angle of its across axis, as the canvas counts angles.
  static turnOfTheMapping(mapping) {
    return Math.atan2(mapping.b, mapping.a);
  }
  /*
      The slant of a mapping: the angle its axis down from the upper side stands at against the
      right angle to that side, in the slant's own coordinates. On a mapping turned over that
      axis points up, and the slant is measured against its own way.
  */
  static slantOfTheMapping(mapping) {
    const turn = _SelectionSection.turnOfTheMapping(mapping);
    const across = mapping.c * Math.cos(turn) + mapping.d * Math.sin(turn);
    const down = -mapping.c * Math.sin(turn) + mapping.d * Math.cos(turn);
    return down >= 0 ? Math.atan2(-across, down) : Math.atan2(across, -down);
  }
  /*
      The turns or the slants of the objects that draw for this selection, members of groups
      included: whether any of them has one, and the one all of them share, or nothing where
      they differ, in radians. The engine keeps angles in hundredths of a degree, so a little is
      allowed for.
  */
  anglesOf(kind) {
    const angles = RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(this.selectedObjects())).map((objectId) => RenderGeometrySection.transformOf(objectId)).filter((mapping) => !!mapping).map((mapping) => kind === "turn" ? _SelectionSection.turnOfTheMapping(mapping) : _SelectionSection.slantOfTheMapping(mapping));
    if (!angles.length)
      return { any: false, shared: null };
    const apart = (one, other) => Math.abs(Math.sin((one - other) / 2));
    const any = angles.some((angle) => apart(angle, 0) > 5e-4);
    const shared = angles.every((angle) => apart(angle, angles[0]) < 1e-3);
    return { any, shared: shared ? angles[0] : null };
  }
  /*
      The mapping that stands for several objects or a group where they all have the same turn
      and the same slant: the first one's. Nothing where they differ.
  */
  mappingTheyShare() {
    if (this.anglesOf("turn").shared === null)
      return null;
    if (this.anglesOf("slant").shared === null)
      return null;
    const first = RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(this.selectedObjects()))[0];
    return first === void 0 ? null : RenderGeometrySection.transformOf(first) ?? null;
  }
  /*
      Takes the angles away by the 0 key, the 0 of the row of digits or of the number pad, while
      the keyboard is not on the handle above the selection: every slant where some object is
      slanted first, since a slant is the one more often made by mistake, and with the next 0
      every turn. A 0 that finds neither is left alone and goes on as any other key. Answers
      whether the key was used.
  */
  resetByKey(event) {
    if (event.code !== "Digit0" && event.code !== "Numpad0")
      return false;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
      return false;
    const turned = () => (this.anglesOf("turn").any || this.aLineStandsAslant()) && this.takeTheAnglesAway("turn");
    const slanted = () => this.anglesOf("slant").any && this.takeTheAnglesAway("slant");
    return slanted() || turned();
  }
  /*
      Takes the turn or the slant away from every object that draws for the selection, members
      of groups included, each by its own angle around its own middle. The engine is sent every
      object's new mapping as one change, and each object's own change is laid on it here at
      once, so a further key reads the objects as they will be. The frame is made anew from the
      objects: a single object's from its mapping, that of several objects or a group as their
      upright box until the engine has answered. Answers whether any object was changed.
  */
  takeTheAnglesAway(kind) {
    const reached = /* @__PURE__ */ new Map();
    const changes = /* @__PURE__ */ new Map();
    for (const objectId of Interaction.context().theOnesAChangeNames(this.selectedObjects())) {
      const mapping = RenderGeometrySection.transformOf(objectId);
      if (!mapping)
        continue;
      const object = RenderGeometrySection.objectOf(objectId);
      if (kind === "turn" ? object == null ? void 0 : object.cannotBeTurned : object == null ? void 0 : object.cannotBeSheared)
        continue;
      const middle = mapping.apply(0.5, 0.5);
      const change = kind === "slant" ? _SelectionSection.slantTakenAway(mapping, middle) : cool.Matrix2D.IDENTITY.rotateAround(middle.x, middle.y, -(_SelectionSection.slopeOfALine(objectId, mapping) ?? _SelectionSection.turnOfTheMapping(mapping)));
      changes.set(objectId, change);
      reached.set(objectId, mapping.then(change));
    }
    if (!reached.size)
      return false;
    ShearingInteraction.forgetTheKeys();
    TurningInteraction.forgetTheKeys();
    const ticket = _SelectionSection.sendMappings(reached, kind === "turn" ? "turn" : "shear");
    for (const [objectId, change] of changes)
      if (!ObjectHandles.isATiedConnector(objectId))
        RenderGeometrySection.changeObject(objectId, change, ticket);
    if (this.isOneObject())
      this.square = null;
    else {
      this.frameFollowsTheObjects = true;
      this.square = null;
    }
    this.known = this.handlesOfTheGroups();
    this.redraw();
    return true;
  }
  /*
      The change that takes the slant of that mapping away around that point: in the frame along
      its upper side, the upper side stays and the axis down from it is stood at a right angle
      to it, keeping its length.
  */
  static slantTakenAway(mapping, around) {
    const turn = _SelectionSection.turnOfTheMapping(mapping);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const frame = new cool.Matrix2D(cos, sin, -sin, cos, around.x, around.y);
    const back = frame.invert();
    const across = mapping.c * cos + mapping.d * sin;
    const down = -mapping.c * sin + mapping.d * cos;
    if (!back || !down)
      return cool.Matrix2D.IDENTITY;
    const length = Math.hypot(across, down);
    const upright = new cool.Matrix2D(1, 0, -across / down, Math.sign(down) * length / down, 0, 0);
    return back.then(upright).then(frame);
  }
  /*
      The angle the selection stands at, as the canvas counts angles: the one the turn keys left
      it at, where they did; for several objects or a group the turn they all share, where they
      do; otherwise the one its square stands at, which for a single object also knows whether
      it was turned over.
  */
  turnOfTheSelection() {
    const byKeys = TurningInteraction.keysStillHold(this);
    if (byKeys)
      return -byKeys.stands * Math.PI / 180;
    const shared = this.isOneObject() ? null : this.anglesOf("turn").shared;
    return shared ?? this.angleOfTheSquare();
  }
  /// the angle the square stands at, as the canvas counts angles. a line has no turn of its
  /// own, its square is the box round it, so for a line it is the way from its start to its end
  angleOfTheSquare() {
    var _a;
    const square = this.squareNow();
    if (!square)
      return 0;
    const objectIds = this.selectedObjects();
    const way = objectIds.length === 1 ? (_a = ObjectHandles.wayOfTheLine(objectIds[0], square)) == null ? void 0 : _a.way : void 0;
    return way && way.length() ? Math.atan2(way.y, way.x) : square.rotation();
  }
  /// how far a line stands off the level, the shorter way to it, as the canvas counts angles.
  /// nothing for any other object
  static slopeOfALine(objectId, mapping) {
    var _a;
    const way = (_a = ObjectHandles.wayOfTheLine(objectId, mapping)) == null ? void 0 : _a.way;
    if (!way || !way.length())
      return null;
    const angle = Math.atan2(way.y, way.x);
    return angle > Math.PI / 2 ? angle - Math.PI : angle <= -Math.PI / 2 ? angle + Math.PI : angle;
  }
  /// whether some line of the selection stands off the level
  aLineStandsAslant() {
    return RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(this.selectedObjects())).some((objectId) => {
      const mapping = RenderGeometrySection.transformOf(objectId);
      const slope = mapping ? _SelectionSection.slopeOfALine(objectId, mapping) : null;
      return slope !== null && Math.abs(slope) > 5e-4;
    });
  }
  /*
      The change the running interaction stands for, and whether it moves only the window of a
      picture. Nothing while nothing runs.
  */
  runningChange() {
    var _a;
    const matrix = (_a = this.interaction) == null ? void 0 : _a.transformation();
    if (!matrix || !this.interaction) {
      if (this.cropAwaitingAnswer)
        return { matrix: this.cropAwaitingAnswer.matrix, cropOnly: true };
      return null;
    }
    return { matrix, cropOnly: this.interaction.isACrop() };
  }
  /// Takes in that the engine answered for that object, or for anything given no object, so a
  /// crop that waited for it is over.
  theEngineAnswered(objectId) {
    let changed = false;
    if (this.cropAwaitingAnswer && (objectId === void 0 || objectId === this.cropAwaitingAnswer.objectId)) {
      this.cropAwaitingAnswer = null;
      changed = true;
    }
    if (objectId === void 0 && this.connectorsAwaitingAnswer.size) {
      this.connectorsAwaitingAnswer.clear();
      changed = true;
    } else if (objectId !== void 0 && this.connectorsAwaitingAnswer.delete(objectId))
      changed = true;
    if (changed)
      this.tellWhoStandsIn();
  }
  /*
      Tells the drawing of the page which objects this section draws in its place: the picture
      while a crop preview shows it as the crop leaves it, and none otherwise. The page is drawn
      before this section, so it is told whenever the preview comes or goes rather than asked
      while drawing.
  */
  tellWhoStandsIn() {
    var _a;
    const standsIn = ((_a = this.runningChange()) == null ? void 0 : _a.cropOnly) === true && GraphicSelection.cropping;
    const objectId = this.selectedObjects()[0];
    const drawnHere = [...this.connectorsAwaitingAnswer];
    if (standsIn && objectId !== void 0)
      drawnHere.push(objectId);
    RenderManager.drawnElsewhere(drawnHere);
  }
  /// The objects a change here moves: the selected ones, the groups above them and what they
  /// draw, so a connector tied to any of them follows.
  theOnesAChangeMoves() {
    const selected = this.selectedObjects();
    return /* @__PURE__ */ new Set([
      ...selected,
      ...RenderGeometrySection.theOnesThatDraw(selected),
      ...RenderGeometrySection.theOnesAChangeTouches(selected)
    ]);
  }
  /*
      Draws the run of every connector tied to what a change moves, routed here from where the
      objects stand with the mapping laid over them, as a hairline in the drag's color: the
      drag of an object shows its connectors going along, and a change already laid on shows
      them where they will be until the engine answers for them.
  */
  /// The connectors a change here lays out anew: the tied ones among what it moves, and the
  /// ones tied to anything it moves.
  theConnectorsAChangeRoutes(data, moved) {
    const routed = new Set(ConnectorRouter.tiedTo(data, [...moved]));
    for (const objectId of moved)
      if (ObjectHandles.isATiedConnector(objectId))
        routed.add(objectId);
    return [...routed];
  }
  drawTheTiedConnectors(data, matrix, only) {
    const moved = this.theOnesAChangeMoves();
    for (const connectorId of this.theConnectorsAChangeRoutes(data, moved)) {
      if (only && !only.has(connectorId))
        continue;
      const connector = data.objects.get(connectorId);
      if (!connector)
        continue;
      const run = ConnectorRouter.routeWithMoved(data, connector, moved, matrix);
      if (run)
        ConnectorRouter.strokeRun(this.context, run, HandleLook.outlineOfADrag);
    }
  }
  /// Draws the connectors whose change was laid on here and not answered yet, where the laid
  /// objects now put them.
  drawTheConnectorsAwaitingAnswer() {
    if (!this.connectorsAwaitingAnswer.size)
      return;
    const data = RenderGeometrySection.currentPart();
    if (!data)
      return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    const origin = new cool.SimplePoint(0, 0);
    this.context.translate(origin.vX, origin.vY);
    this.context.scale(app.twipsToPixels, app.twipsToPixels);
    this.drawTheTiedConnectors(data, null, this.connectorsAwaitingAnswer);
    this.context.restore();
  }
  /*
      Draws what a running interaction would leave behind: the objects of the selection, as
      they draw themselves, with the transformation it stands for over them. Half see-through,
      so that what lies under them stays readable.
  */
  drawTheInteraction() {
    var _a;
    const matrix = (_a = this.interaction) == null ? void 0 : _a.ghostTransformation();
    if (!matrix)
      return;
    const data = RenderGeometrySection.currentPart();
    if (!data)
      return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    const origin = new cool.SimplePoint(0, 0);
    this.context.translate(origin.vX, origin.vY);
    this.context.scale(app.twipsToPixels, app.twipsToPixels);
    this.context.globalAlpha = 0.5;
    RenderManager.renderObjectsWith(this.context, data, RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(this.selectedObjects())).filter((objectId) => !ObjectHandles.isATiedConnector(objectId)), matrix);
    this.context.globalAlpha = 1;
    this.drawTheTiedConnectors(data, matrix);
    this.context.restore();
  }
  /*
      The pointer over a handle: the direction that handle scales in, the hand that takes hold
      of one that shapes the object, the hand that turns the selection, and the sign that says
      no over an object that cannot be resized.
  */
  /// The hand that takes hold of the object itself, or of a handle that shapes it.
  static grabPointer() {
    return "url(" + app.LOUtil.getURL("images/cursors/grab.svg") + ") 12 12, grab";
  }
  pointerOver(handle) {
    var _a;
    if (handle.kind === _SelectionSection.turningKind)
      return "pointer";
    if (handle.kind === CropHandles.middleKind)
      return "move";
    if (handle.group === "crop")
      return "url(" + app.LOUtil.getURL("images/cursors/crop.svg") + ") 8 8, auto";
    if (handle.group !== "framing")
      return ((_a = this.groupOf(handle)) == null ? void 0 : _a.dragsTheHandle(handle)) === false ? "pointer" : _SelectionSection.grabPointer();
    if (!ObjectHandles.canBeResized(this.selectedObjects()))
      return "not-allowed";
    const byKind = {
      "1": "nwse-resize",
      "2": "ns-resize",
      "3": "nesw-resize",
      "4": "ew-resize",
      "5": "ew-resize",
      "6": "nesw-resize",
      "7": "ns-resize",
      "8": "nwse-resize"
    };
    return byKind[handle.kind] ?? "default";
  }
  /*
      The five places the handles that frame a single object stand at, worked out from the
      mapping that object is drawn by. They are the same places the handles hold, only whole:
      a handle lies on a whole twip, and the fraction rounding takes off tilts the two axes the
      object is scaled along, which leaves a shear behind that the object never had. Nothing
      for a selection of several, which is framed by a box and not by a mapping.
  */
  framingPlacesOfTheObject() {
    const objects = this.selectedObjects();
    if (objects.length !== 1)
      return void 0;
    const transform = RenderGeometrySection.transformOf(objects[0]);
    if (!transform)
      return void 0;
    const at = (x, y) => {
      const place = transform.apply(x, y);
      return new cool.SimplePoint(place.x, place.y);
    };
    return {
      middle: at(0.5, 0.5),
      above: at(0.5, 0),
      below: at(0.5, 1),
      left: at(0, 0.5),
      right: at(1, 0.5)
    };
  }
  /*
      The shape of the selection as the maths of a drag wants it: the middle it turns around,
      how wide and how high it is in core pixels, and the angle it stands at, counted in
      radians against the clock. All four come from the handles that frame it, so nothing else
      has to be asked for them.
  */
  shapeNow() {
    const handleOfKind = (kind) => {
      const handle = this.known.find((one) => one.kind === kind);
      return handle ? new cool.SimplePoint(handle.point.x, handle.point.y) : void 0;
    };
    const whole = this.framingPlacesOfTheObject();
    const middle = (whole == null ? void 0 : whole.middle) ?? _SelectionSection.middleOf(this.known);
    const above = (whole == null ? void 0 : whole.above) ?? handleOfKind("2");
    const below = (whole == null ? void 0 : whole.below) ?? handleOfKind("7");
    const left = (whole == null ? void 0 : whole.left) ?? handleOfKind("4");
    const right = (whole == null ? void 0 : whole.right) ?? handleOfKind("5");
    if (!middle || !above || !below || !left || !right)
      return void 0;
    const turned = Math.atan2(middle.y - above.y, above.x - middle.x) - Math.PI * 0.5;
    const straight = Math.abs(turned) < 5e-4;
    return {
      center: middle.clone(),
      width: left.pDistanceTo(right.pToArray()),
      height: above.pDistanceTo(below.pToArray()),
      angleRadian: straight ? 0 : turned
    };
  }
  /// Where the mouse is in the document, in core pixels, from a point this section was given.
  inTheDocument(point) {
    const inDocument = point.clone();
    inDocument.pX += this.position[0];
    inDocument.pY += this.position[1];
    return inDocument;
  }
  /// Looks for something on the page that the handle could line up with, and marks it.
  lookForASnap(handle, event) {
    const half = 0.5 * ShapeHandlesSection.handleSize();
    const at = new cool.SimplePoint(handle.point.x, handle.point.y);
    this.snap.look([0, 0], [at.pX - half, at.pY - half], [0, 0], (event == null ? void 0 : event.altKey) === true);
    this.redraw();
  }
  /// Where the last look landed, in core pixels, null on an axis that found nothing.
  snappedTo() {
    return this.snap.at();
  }
  /*
      Looks for something on the page that the whole selection could line up with, from where
      the move has taken it, and marks it. The distance is in core pixels.
  */
  lookForASnapOfTheWhole(across, down, event) {
    this.snap.look(this.selectionSize(), this.selectionCorner(), [across, down], (event == null ? void 0 : event.altKey) === true);
  }
  /// Where the upper left corner of the selection lands, in core pixels: where the move puts
  /// it, or where it lined up with something on the page.
  snappedCorner(x, y) {
    return this.snap.corner(x, y);
  }
  /// The box those objects all fit in, in twips, or nothing where none of them carries one.
  boxAround(objectIds) {
    let box;
    for (const objectId of objectIds) {
      const one = RenderGeometrySection.boxOf(objectId);
      if (one)
        box = box ? box.union(one) : one;
    }
    return box;
  }
  /*
      The box the selection takes up, in core pixels. While the document is drawn from objects
      it is worked out from the boxes they carry, which is the same box the handles are worked
      out from; otherwise it is the one the engine sends with the selection.
  */
  boxOfTheSelection() {
    const box = this.boxAround(RenderGeometrySection.theOnesThatDraw(this.selectedObjects()));
    if (!box)
      return void 0;
    const scale = app.twipsToPixels;
    return new cool.Range2D(box.minX * scale, box.minY * scale, box.maxX * scale, box.maxY * scale);
  }
  /*
      Whether a change leaves every object it touches somewhere on this side of reason: no
      place and no side longer than a hundred metres. A change worked out on a state that has
      gone stale can ask for far more than that, and a mapping like that is worth neither
      drawing nor sending - the engine cannot even work out what to invalidate for it.
  */
  static withinReason(objectIds, matrix) {
    const most = 100 * 1440 * 39.37;
    return RenderGeometrySection.theOnesThatDraw(objectIds).every((objectId) => {
      const mapping = RenderGeometrySection.transformOf(objectId);
      if (!mapping)
        return true;
      return mapping.then(matrix).toArray().every((value) => Number.isFinite(value) && Math.abs(value) < most);
    });
  }
  /// The upper left corner of the selection, in core pixels: the box round what is drawn of
  /// the selected objects, or where this section stands while no object is known.
  selectionCorner() {
    const box = this.boxOfTheSelection();
    return box ? [box.minX, box.minY] : this.position;
  }
  /// How wide and how high the selection is, in core pixels: the box round what is drawn of
  /// the selected objects, or the size of this section while no object is known.
  selectionSize() {
    const box = this.boxOfTheSelection();
    return box ? [box.width, box.height] : this.size;
  }
  /*
      How far a key turns the selection, in degrees: one of them, fifteen with Shift, which is
      the step the office holds a turn to, and a tenth with Alt for the finest of it.
  */
  static turningStep(event) {
    if (event.shiftKey)
      return 15;
    if (event.altKey)
      return 0.1;
    return 1;
  }
  /*
      Hands the engine what a drag or a key did to the points of a path: the object it belongs
      to and one item for every point or weight that moved. The points that did not move are
      not named at all, so a path of many thousand points still travels as the few numbers that
      changed, and the ones left alone come back exactly as they went out.
  */
  static sendPathChanges(objectId, changes) {
    if (!changes.length)
      return;
    app.socket.sendMessage("setobjectpoints id=" + String(objectId) + " changes=" + changes.join(";"));
  }
  /*
      Moves the objects one step the way an arrow key says, worked out here and sent to the
      engine as the one change it is, the way a drag is. The step is the key's: a millimetre,
      ten with Shift, a pixel as seen with Alt. Objects that may not be moved stay where they
      are.
  */
  moveByKey(towards, event) {
    if (!ObjectHandles.canBeMoved(this.selectedObjects()))
      return;
    const step = HandleTravel.stepFor(event);
    const by = Interaction.context().heldToItsWay(this.selectedObjects(), this.heldInsideTheLawn(new cool.Point(towards.x * step, towards.y * step)));
    if (!by.x && !by.y)
      return;
    const matrix = cool.Matrix2D.IDENTITY.translate(by.x, by.y);
    const ticket = _SelectionSection.sendTransform(this.selectedObjects(), matrix, "move");
    this.layTheChangeOn(matrix, ticket);
    GraphicSelection.showTheObjects(this.selectedObjects());
  }
  /*
      How far the selection may be moved of that much, in twips, so that its box does not go
      past the lawn the page gives, and no object goes where it cannot be reached. The lawn the
      view shows grows round objects lying further out, so it is not what is held to, or a
      move would push it on and on. A move back towards the page is never held: a selection that
      lies outside already may come in, and is not pulled in by the hold.
  */
  heldInsideTheLawn(by) {
    const lawn = ViewLayoutVector.lawnOfThePageInView();
    const box = this.boxAround(RenderGeometrySection.theOnesThatDraw(this.selectedObjects()));
    if (!lawn || !box)
      return by;
    const held = (move, least, most, larger) => larger ? move : Math.min(Math.max(move, Math.min(least, 0)), Math.max(most, 0));
    return new cool.Point(held(by.x, lawn.minX - box.minX, lawn.maxX - box.maxX, box.width > lawn.width), held(by.y, lawn.minY - box.minY, lawn.maxY - box.maxY, box.height > lawn.height));
  }
  /// Lays a change a key made over the objects, as the end of a drag does with its own. The
  /// ticket is the one of the message that carries the change.
  layTheChangeOn(matrix, ticket) {
    this.leaveTheChangeOnTheObjects(matrix, ticket);
  }
  squareNow() {
    if (this.frameFollowsTheObjects) {
      if (this.isWaitingForTheEngine()) {
        const box2 = this.uprightBoxOfTheObjects();
        return box2 ? cool.Matrix2D.fromRange(box2) : void 0;
      }
      this.frameFollowsTheObjects = false;
      this.square = null;
    }
    if (this.square)
      return this.square;
    const objects = this.selectedObjects();
    if (!objects.length)
      return void 0;
    if (objects.length === 1) {
      this.square = RenderGeometrySection.transformOf(objects[0]);
      return this.square ?? void 0;
    }
    const box = this.uprightBoxOfTheObjects();
    this.square = box ? cool.Matrix2D.fromRange(box) : null;
    return this.square ?? void 0;
  }
  /// The upright box round the objects that draw for the selection, in twips, or nothing where
  /// it has no size.
  uprightBoxOfTheObjects() {
    const box = this.boxAround(RenderGeometrySection.theOnesThatDraw(this.selectedObjects()));
    return box && box.width && box.height ? box : void 0;
  }
  forgetTheSquare() {
    this.square = null;
    this.frameFollowsTheObjects = false;
  }
  /// Whether a change laid on here still waits for the engine's answer for anything it touched:
  /// the objects that draw and the groups above them.
  isWaitingForTheEngine() {
    return RenderGeometrySection.theOnesAChangeTouches(this.selectedObjects()).some((objectId) => RenderGeometrySection.awaitsAnAnswer(objectId));
  }
  /*
      Whether that change leaves the frame upright rather than taking it along: where it turns
      or shears several objects or a group, rather than only moving, scaling or mirroring them
      along the page's own axes.
  */
  keepsAnUprightFrame(matrix) {
    if (!matrix || this.isOneObject())
      return false;
    return Math.abs(matrix.b) > 1e-9 || Math.abs(matrix.c) > 1e-9;
  }
  /*
      Lays what a drag did over the objects the client holds, so that everything reads them as
      the drag left them. The engine's own version of an object replaces this one when it
      arrives, so a change it made differently puts itself right then.
  */
  leaveTheChangeOnTheObjects(matrix, ticket) {
    var _a;
    if (!matrix)
      return;
    if (!_SelectionSection.withinReason(this.selectedObjects(), matrix))
      return;
    const keepsUpright = this.keepsAnUprightFrame(matrix);
    const square = this.squareNow();
    if (keepsUpright) {
      this.frameFollowsTheObjects = true;
      this.square = null;
    } else if (square)
      this.square = square.then(matrix);
    const data = RenderGeometrySection.currentPart();
    for (const objectId of RenderGeometrySection.theOnesAChangeTouches(this.selectedObjects()))
      if (!ObjectHandles.isATiedConnector(objectId))
        RenderGeometrySection.changeObject(objectId, matrix, ticket);
    if (data) {
      const moved = this.theOnesAChangeMoves();
      for (const connectorId of this.theConnectorsAChangeRoutes(data, moved))
        this.connectorsAwaitingAnswer.add(connectorId);
      this.tellWhoStandsIn();
    }
    if (keepsUpright)
      this.known = this.handlesOfTheGroups();
    (_a = app.sectionContainer) == null ? void 0 : _a.requestReDraw();
  }
  /// What a running drag does to the objects, or nothing while nothing is being dragged.
  dragMatrix() {
    var _a;
    return ((_a = this.interaction) == null ? void 0 : _a.transformation()) ?? null;
  }
  /// Where a drag of that handle may take it, which its own group says. The end of a connector
  /// snaps onto the point it would tie itself to, so that it is let go exactly there.
  holdTheDrag(handle, at) {
    var _a;
    if (_SelectionSection.connectorEnds.includes(handle.name)) {
      const would = this.whereTheEndWouldTie(at);
      if (would == null ? void 0 : would.point)
        return would.point.clone();
    }
    return ((_a = this.groupOf(handle)) == null ? void 0 : _a.holdInside(handle, at)) ?? at;
  }
  /// Hands the engine what a drag of that handle did, which its own group knows how to say.
  handOverTheDrag(handle, to, ortho = false) {
    var _a;
    (_a = this.groupOf(handle)) == null ? void 0 : _a.handOver(handle, to, ortho);
  }
  /*
          Hands the engine what a drag did to the objects as a whole: for every object the mapping
          it is to be drawn by, which is the mapping it was drawn by here while the drag ran. The
          last word says what the drag was, which is what names the step it can be undone with.
  
          The mapping travels whole rather than as the change alone, because the client is the one
          that holds what the object is drawn by: the engine would have to read that again and the
          two could then disagree.
  
          Where mappings are given for objects, the change is laid over those instead of over what
          the objects are drawn by now.
      */
  static sendTransform(objectIds, matrix, what, from) {
    if (!_SelectionSection.withinReason(objectIds, matrix))
      return null;
    if (!from)
      ShearingInteraction.forgetTheKeys();
    TurningInteraction.forgetTheKeys();
    const reached = /* @__PURE__ */ new Map();
    for (const objectId of Interaction.context().theOnesAChangeNames(objectIds)) {
      const mapping = (from == null ? void 0 : from.get(objectId)) ?? RenderGeometrySection.transformOf(objectId);
      if (mapping)
        reached.set(objectId, mapping.then(matrix));
    }
    return _SelectionSection.sendMappings(reached, what);
  }
  /*
          Hands the engine the mapping each of those objects is to be drawn by, as one change named
          by the last word.
  
          A mapping that turns the object over travels whole, turn over and all. The object lays that
          out itself, and it does it in its own frame: it builds its rectangle unturned at the origin,
          mirrors it there, and only then shears, turns and moves it. Asking for the turn over apart
          from the mapping would mean naming a line for it, and a line that does not lie along one of
          the page's own two is not one the drawing layer can follow.
      */
  static sendMappings(reached, what) {
    const mappings = [];
    for (const [objectId, mapping] of reached)
      mappings.push(String(objectId) + "," + mapping.toArray().map((value) => value.toFixed(4)).join(","));
    if (!mappings.length)
      return null;
    return ChangeOutbox.sendAChange("setobjecttransform to=" + mappings.join(";") + " as=" + what + (_SelectionSection.withCopy ? "+copy" : ""));
  }
  /*
      Moves a handle as a key asks, which is the business of the group the handle belongs to:
      one of the eight scales the selection, the one above it turns it, a point of a path moves
      that point. Answers where the handle lands, and nothing where it goes nowhere of its own.
  */
  moveHandleBy(handle, towards, event) {
    var _a;
    this.keyLeftTheHandle = null;
    const to = ((_a = this.groupOf(handle)) == null ? void 0 : _a.moveByKey(handle, towards, event)) ?? null;
    this.keyLeftTheHandle = to && handle.group === "framing" ? { at: to, named: handle.name } : null;
    return to ? new cool.SimplePoint(to.x, to.y) : null;
  }
  /*
          Keeps the keyboard on the handle that stands where the key left it, rather than on the
          one that keeps its name. They are the same handle until a change turns the object over,
          and then the object's square is laid down the other way and the two part company: going
          on in the same direction would otherwise push back the side that was just crossed.
  
          It works the same whether the handles were worked out from the change laid on here or
          from the one the engine answered with, which are not the same thing and need not be: the
          place is what the keyboard follows, and both of them put a handle there.
      */
  followTheHandleByPlace() {
    var _a;
    const left = this.keyLeftTheHandle;
    if (!left)
      return;
    const active = this.travel.whichIsActive();
    if (active !== left.named) {
      this.keyLeftTheHandle = null;
      return;
    }
    const couldBe = ObjectHandles.facing(((_a = this.known.find((one) => one.name === active)) == null ? void 0 : _a.kind) ?? "");
    let nearest = null;
    let howFar = Number.POSITIVE_INFINITY;
    for (const one of this.known) {
      if (one.group !== "framing" || !couldBe.includes(one.kind))
        continue;
      const away = one.point.distanceTo(left.at);
      if (away < howFar) {
        howFar = away;
        nearest = one;
      }
    }
    if (!nearest || nearest.name === active)
      return;
    this.travel.goTo(nearest.name);
    this.keyLeftTheHandle = { at: left.at, named: nearest.name };
  }
  /*
      Carrying the selection through a press that landed before this section was there: on an
      object nobody had selected, which the press selects. The section that took that press
      drives it, since the mouse belongs to that one until it is let go.
  */
  beginCarrying(at) {
    this.interaction = new MovingInteraction(this, at);
  }
  /// Carries it on to that point of the document, as a drag of this section's own does, the
  /// view scrolling along at its edge.
  carryTo(to) {
    this.dragTo(to, new cool.Point(to.vX / app.dpiScale, to.vY / app.dpiScale));
  }
  finishCarrying(to) {
    var _a;
    (_a = this.interaction) == null ? void 0 : _a.finish(to);
    this.endTheInteraction(true);
  }
  cancelCarrying() {
    var _a;
    (_a = this.interaction) == null ? void 0 : _a.cancel();
    this.endTheInteraction(false);
  }
  onMouseDown(point, e) {
    var _a, _b, _c, _d, _e, _f;
    const at = this.inTheDocument(point);
    const onCanvas = [
      this.myTopLeft[0] + point.pX,
      this.myTopLeft[1] + point.pY
    ];
    const handle = this.handleAt(onCanvas[0], onCanvas[1]);
    this.pressedAHandle = handle !== void 0;
    this.pressedHandle = handle ?? null;
    const addsAPathPoint = !handle && ((_a = this.pathGroup()) == null ? void 0 : _a.takesAPress(onCanvas[0], onCanvas[1]));
    if (addsAPathPoint)
      (_b = this.pathGroup()) == null ? void 0 : _b.addAt(at);
    if (addsAPathPoint || !handle && this.isAddingATiePoint() && ((_c = this.tiePointGroup()) == null ? void 0 : _c.addAt(at))) {
      _SelectionSection.stopAddingAPoint();
      this.pressedAHandle = true;
      this.pressedGroup = null;
      this.interaction = null;
      this.stopPropagating();
      e.stopPropagation();
      return;
    }
    if (!handle && this.handleAt(onCanvas[0], onCanvas[1], true)) {
      this.pressedAHandle = true;
      this.pressedGroup = null;
      this.interaction = null;
      this.stopPropagating();
      e.stopPropagation();
      return;
    }
    this.pressedTheText = this.onTheEditedText(onCanvas);
    if (this.pressedTheText) {
      this.pressedGroup = null;
      this.interaction = null;
      this.handToTheMouseControl(point, (control, at2) => control.onMouseDown(at2, e));
      return;
    }
    if (handle) {
      this.pressedGroup = this.groupOf(handle) ?? null;
      this.interaction = ((_d = this.pressedGroup) == null ? void 0 : _d.interactionFor(handle, at)) ?? null;
      (_e = this.interaction) == null ? void 0 : _e.tookHoldAt(at, handle);
    } else {
      this.pressedGroup = this.groups().find((group) => group.takesAPress(onCanvas[0], onCanvas[1])) ?? null;
      this.interaction = ((_f = this.pressedGroup) == null ? void 0 : _f.interactionForThePlace(at)) ?? null;
    }
    if (this.interaction && ChangeOutbox.undoOnItsWay()) {
      this.interaction = null;
      this.showTheHoldBack();
    }
    if (this.interaction) {
      this.lastMoved = null;
      this.dropTheOtherMode();
      document.addEventListener("keydown", this.keysChanged, true);
      document.addEventListener("keyup", this.keysChanged, true);
    }
    this.stopPropagating();
    e.stopPropagation();
  }
  /// Sets the pointer and the marked handle for the mouse standing at that point while no drag
  /// runs.
  pointAt(point) {
    const onCanvas = [
      this.myTopLeft[0] + point.pX,
      this.myTopLeft[1] + point.pY
    ];
    let over = this.handleAt(onCanvas[0], onCanvas[1]);
    if (!this.interaction && this.followTheOtherMode(over, new cool.Point(onCanvas[0], onCanvas[1])))
      over = void 0;
    const onTheObject = this.groups().some((group) => group.takesAPress(onCanvas[0], onCanvas[1]));
    const inTheDocument = this.inTheDocument(point);
    const overText = app.file.textCursor.visible || RenderGeometrySection.pointerAt(inTheDocument.x, inTheDocument.y) === "text";
    this.context.canvas.style.cursor = over ? this.pointerOver(over) : this.handleAt(onCanvas[0], onCanvas[1], true) ? "not-allowed" : onTheObject && (this.isAddingATiePoint() || this.isAddingAPathPoint()) ? "crosshair" : this.partMarkedAt(inTheDocument) !== void 0 ? "pointer" : !onTheObject ? "default" : overText ? "text" : ObjectHandles.canBeMoved(this.selectedObjects()) ? _SelectionSection.grabPointer() : "default";
    const hovered = (over == null ? void 0 : over.name) ?? (this.otherModeShown ? _SelectionSection.turningKind : null);
    if (hovered !== this.hovered) {
      this.hovered = hovered;
      this.containerObject.requestReDraw();
    }
  }
  /// Sets the pointer and the marked handle for where the mouse was last seen.
  pointAtTheMouse() {
    const mouse = this.containerObject.getMousePosition();
    if (!mouse)
      return;
    this.pointAt(cool.SimplePoint.fromCorePixels([
      mouse[0] - this.myTopLeft[0],
      mouse[1] - this.myTopLeft[1]
    ]));
  }
  onMouseMove(point, dragDistance, e) {
    if (this.pressedTheText && this.containerObject.isDraggingSomething()) {
      this.handToTheMouseControl(point, (control, at) => control.onMouseMove(at, dragDistance, e));
      return;
    }
    if (!this.containerObject.isDraggingSomething() || !this.interaction) {
      this.pointAt(point);
      return;
    }
    this.stopPropagating();
    e.stopPropagation();
    const onCanvas = point.clone();
    onCanvas.pX += this.myTopLeft[0];
    onCanvas.pY += this.myTopLeft[1];
    this.dragTo(this.inTheDocument(point), new cool.Point(onCanvas.cX, onCanvas.cY), e);
  }
  /*
      Takes the running drag to that point of the document, where the mouse stands at that
      point of the canvas, in CSS pixels, with the keys of that event held.
  */
  dragTo(at, onCanvas, e) {
    if (!this.interaction)
      return;
    this.lastMoved = { at, event: e };
    this.interaction.move(at, e);
    this.aimAtWhatIsUnder(at);
    if (this.interaction.scrollsWithTheMouse()) {
      app.map.fire("handleautoscroll", { pos: onCanvas, map: app.map });
      return;
    }
    const leading = this.interaction.leadingPoint();
    if (leading)
      GraphicSelection.scrollPointIntoView(leading);
  }
  onMouseUp(point, e) {
    var _a, _b, _c, _d;
    if (this.pressedTheText) {
      this.handToTheMouseControl(point, (control, at) => control.onMouseUp(at, e));
      return;
    }
    if (!this.containerObject.isDraggingSomething() || !this.interaction) {
      if (((_a = this.pressedHandle) == null ? void 0 : _a.kind) === _SelectionSection.turningKind && this.shearingIsOffered()) {
        this.switchTheHandleMode();
        this.interaction = null;
        this.followTheOtherMode(this.pressedHandle);
      } else if ((_b = this.pressedHandle) == null ? void 0 : _b.name) {
        const onCanvas = [
          this.myTopLeft[0] + point.pX,
          this.myTopLeft[1] + point.pY
        ];
        if (((_c = this.handleAt(onCanvas[0], onCanvas[1])) == null ? void 0 : _c.name) === this.pressedHandle.name) {
          this.travel.goTo(this.pressedHandle.name);
          (_d = this.groupOf(this.pressedHandle)) == null ? void 0 : _d.letGoWhereItWasPressed(this.pressedHandle, e);
        }
      } else if (this.pressedGroup && this.keyboardIsOnAPoint()) {
        this.travel.leave();
      }
      this.interaction = null;
      GraphicSelection.followTheGroupButtons();
      return;
    }
    this.stopPropagating();
    e.stopPropagation();
    _SelectionSection.withCopy = e.ctrlKey && (this.interaction instanceof MovingInteraction || this.interaction instanceof ScalingInteraction && !this.interaction.isACrop());
    try {
      this.interaction.finish(this.inTheDocument(point), e);
    } finally {
      this.endTheInteraction(!_SelectionSection.withCopy);
      _SelectionSection.withCopy = false;
    }
  }
  /*
      A press that was not a drag. It is handed to the engine as a press of its own, a moment
      later, so that a press that turns out to be the first half of a double one can still be
      called off: the engine would otherwise have selected something else before the text edit
      of the double press could begin.
  */
  onClick(point, e) {
    var _a, _b;
    if (this.pressedTheText) {
      this.handToTheMouseControl(point, (control, at2) => control.onClick(at2, e));
      return;
    }
    this.stopPropagating();
    e.stopPropagation();
    if (this.pressedAHandle)
      return;
    if ((_a = this.pressedGroup) == null ? void 0 : _a.answersTheClick(this.inTheDocument(point), MouseControl.readModifier(e)))
      return;
    if (this.pressedGroup && !this.pressedGroup.passesTheClickOn())
      return;
    (_b = GraphicSelection.mediaPlayer) == null ? void 0 : _b.wake();
    const at = this.inTheDocument(point);
    const modifier = MouseControl.readModifier(e);
    this.forgetThePendingClick();
    if ((modifier === app.UNOModifier.SHIFT || modifier === app.UNOModifier.CTRL) && RenderGeometrySection.answersPointer() && Interaction.context().press(RenderGeometrySection.objectIdAt(at.x, at.y), modifier))
      return;
    const alt = app.UNOModifier.ALT;
    if ((modifier === alt || modifier === (alt | app.UNOModifier.SHIFT)) && RenderGeometrySection.answersPointer() && Interaction.context().altPress(RenderGeometrySection.objectIdsAt(at.x, at.y), modifier !== alt))
      return;
    if (modifier === 0 && RenderGeometrySection.answersPointer()) {
      const marked = this.partMarkedAt(at);
      if (marked !== void 0 && Interaction.context().press(marked, modifier)) {
        GraphicSelection.updateSelectionSection();
        return;
      }
      const hit = RenderGeometrySection.objectIdAt(at.x, at.y);
      const selected = this.selectedObjects();
      const own = selected.concat(RenderGeometrySection.theOnesThatDraw(selected));
      const inPlace = Interaction.placeOf(GraphicSelection.selectedObjectIDs).kind === "inPlace";
      const another = hit !== void 0 && (inPlace ? !selected.includes(RenderGeometrySection.whatAPressTakes(hit)) : !own.includes(hit));
      if (hit !== void 0 && another && Interaction.context().press(hit, modifier)) {
        GraphicSelection.updateSelectionSection();
        return;
      }
      if (hit !== void 0 && inPlace)
        return;
    }
    this.pendingClick = app.timerRegistry.setTimeout("selectionClick", () => {
      app.map._docLayer._postMouseEvent("buttondown", at.x, at.y, 1, 1, modifier);
      app.map._docLayer._postMouseEvent("buttonup", at.x, at.y, 1, 1, modifier);
      this.pendingClick = null;
    }, 250);
  }
  /*
      A press of two. The context takes it where it means something it does itself, entering a
      group; otherwise it goes to the engine, which starts the text edit of the object underneath.
  */
  onDoubleClick(point, e) {
    if (this.pressedTheText)
      return;
    const at = this.inTheDocument(point);
    this.forgetThePendingClick();
    if (e.altKey) {
      this.stopPropagating();
      e.stopPropagation();
      return;
    }
    if (this.hovered !== null) {
      this.stopPropagating();
      e.stopPropagation();
      return;
    }
    if (Interaction.context().doublePress(RenderGeometrySection.objectIdAt(at.x, at.y))) {
      this.stopPropagating();
      e.stopPropagation();
      return;
    }
    for (const count of [1, 2]) {
      app.map._docLayer._postMouseEvent("buttondown", at.x, at.y, count, 1, 0);
      app.map._docLayer._postMouseEvent("buttonup", at.x, at.y, count, 1, 0);
    }
    this.stopPropagating();
    e.stopPropagation();
  }
  /*
      A press of the right button, which asks for the menu of what is selected. The section
      covers the objects while the client draws the selection, so the press would otherwise
      stop here and no menu would open.
  */
  onContextMenu(point, e) {
    MouseControl.contextMenuFrom(this, point, e);
  }
  /// Passes an event to the mouse control, in its coordinates. The container delivers events
  /// only to bound sections, and the selection is not bound.
  handToTheMouseControl(point, deliver) {
    const control = app.sectionContainer.getSectionWithName(app.CSections.MouseControl.name);
    if (!control)
      return;
    const at = point ? cool.SimplePoint.fromCorePixels([
      point.pX + this.myTopLeft[0] - control.myTopLeft[0],
      point.pY + this.myTopLeft[1] - control.myTopLeft[1]
    ]) : new cool.SimplePoint(0, 0);
    deliver(control, at);
  }
  /// True during a text edit when the canvas point is inside the selected object, which is
  /// the edited one, and off its handles.
  onTheEditedText(onCanvas) {
    if (!app.file.textCursor.visible)
      return false;
    if (this.handleAt(onCanvas[0], onCanvas[1]))
      return false;
    return this.groups().some((group) => group.takesAPress(onCanvas[0], onCanvas[1]));
  }
  /// Drops a press that is waiting to be handed over, because a second one took its place.
  forgetThePendingClick() {
    if (this.pendingClick === null)
      return;
    app.timerRegistry.clearTimeout(this.pendingClick);
    this.pendingClick = null;
  }
  /// The mouse has left what is selected, so no handle is under it any more.
  onMouseLeave() {
    this.followTheOtherMode(void 0);
    if (this.hovered === null)
      return;
    this.hovered = null;
    this.containerObject.requestReDraw();
  }
  onDragCancel() {
    var _a;
    if (this.pressedTheText) {
      this.handToTheMouseControl(null, (control) => control.onDragCancel());
      return;
    }
    (_a = this.interaction) == null ? void 0 : _a.cancel();
    this.endTheInteraction(false);
  }
  /// Whether an interaction of the mouse is running on the selection.
  isDragged() {
    return this.interaction !== null;
  }
  /// The handles the groups work out from the objects as they stand. Every handle is marked
  /// with the group it came from, so that whatever is done to it afterwards is done by the group
  /// that knows it.
  handlesOfTheGroups() {
    return this.groups().flatMap((group) => group.handles().map((handle) => ({ ...handle, group: group.name })));
  }
  /*
      Keeps what an interaction that was carried out did, until the engine answers with its own
      version: the handles stay where it left them, and the objects are drawn as it showed them.
      For a crop that is the window alone - the picture stays, and the engine answers with both -
      so the crop's preview stands in for the picture as it will be. The window is named against
      the picture as the engine last gave it, so a crop that follows before the answer names its
      whole window again rather than a step on from this one.
  */
  keepWhatItDid(interaction) {
    const ghost = interaction.ghostTransformation();
    if (!this.keepsAnUprightFrame(ghost))
      this.known = interaction.handles(interaction.isACrop() ? this.handlesOfTheGroups() : this.known);
    this.leaveTheChangeOnTheObjects(ghost, interaction.ticketOfTheChange());
    const window2 = interaction.transformation();
    const objectId = this.selectedObjects()[0];
    if (interaction.isACrop() && window2 && objectId !== void 0) {
      this.cropAwaitingAnswer = { objectId, matrix: window2 };
      this.tellWhoStandsIn();
      this.containerObject.requestReDraw();
    }
  }
  /*
          Lets the interaction go and takes the lines that marked a snap away with it.
  
          Where the drag was carried out, the handles stay where it left them. The engine answers a
          moment later and the objects move then; falling back to where they still are would show
          the handles jumping back and forward again. A drag that was called off leaves them where
          the objects have them, which is where they belong.
      */
  endTheInteraction(carriedOut) {
    if (carriedOut && this.interaction)
      this.keepWhatItDid(this.interaction);
    if (carriedOut)
      ShearingInteraction.forgetTheKeys();
    this.interaction = null;
    this.tellWhoStandsIn();
    GraphicSelection.followTheGroupButtons();
    this.lastMoved = null;
    document.removeEventListener("keydown", this.keysChanged, true);
    document.removeEventListener("keyup", this.keysChanged, true);
    this.snap.forget();
    this.aimingAt = null;
    app.map.fire("scrollvelocity", { vx: 0, vy: 0 });
    this.containerObject.requestReDraw();
  }
};
_SelectionSection.shearing = null;
_SelectionSection.tiePoints = new ShownPoints("showgluepoints", "insertgluepoint");
_SelectionSection.pathPoints = new ShownPoints("editpathpoints", "insertpathpoint");
_SelectionSection.tiePointsCommand = _SelectionSection.tiePoints.showCommand;
_SelectionSection.addTiePointCommand = _SelectionSection.tiePoints.addCommand;
_SelectionSection.pathPointsCommand = _SelectionSection.pathPoints.showCommand;
_SelectionSection.addPathPointCommand = _SelectionSection.pathPoints.addCommand;
_SelectionSection.otherModeKind = "othermode";
_SelectionSection.turningKind = "rotate";
_SelectionSection.turningDistance = 30;
_SelectionSection.connectorEnds = ["9.0.0", "9.0.1"];
_SelectionSection.withCopy = false;
let SelectionSection = _SelectionSection;
