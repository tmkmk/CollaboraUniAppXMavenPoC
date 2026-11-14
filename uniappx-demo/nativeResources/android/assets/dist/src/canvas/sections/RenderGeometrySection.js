class PendingChange {
  constructor(change, leftAt, leftIn, ticket) {
    this.change = change;
    this.leftAt = leftAt;
    this.leftIn = leftIn;
    this.ticket = ticket;
  }
  /// The change as it left the object it was just laid over, or null where the object has no
  /// mapping to hold an answer against. The ticket is the one of the outbox message that
  /// carries the change, or null where the outbox numbered none.
  static leftOn(change, object, ticket) {
    const leftAt = cool.Matrix2D.fromArray(object.transform);
    return leftAt ? new PendingChange(change, leftAt, PendingChange.boxOf(object), ticket) : null;
  }
  /// Whether an answer naming that number as the newest applied input answers this change. A
  /// change without a ticket takes the first such answer.
  appliedBy(inputSequence) {
    return !this.ticket || this.ticket.appliedBy(inputSequence);
  }
  /// Takes in where the change leaves the object after it was laid over it again.
  laidAgainOn(object) {
    this.leftAt = cool.Matrix2D.fromArray(object.transform) ?? this.leftAt;
    this.leftIn = PendingChange.boxOf(object);
  }
  /// Whether the engine answered with the mapping this change left the object at. The engine
  /// rounds what it answers to a small part of a twip.
  answeredBy(answer) {
    return answer.equals(this.leftAt, 1.5);
  }
  /*
      Whether the object stands in the box this change left it in. A mapping and its turned-over
      twin draw the same box, and an object that cannot hold a mirror answers with the twin, so
      the box is what such an answer is held against. The box the engine sends is the painted
      one and carries the line width, which a change laid on here does not scale, so a little is
      allowed for.
  */
  answeredInTheBox(object) {
    if (object.x === void 0 || object.y === void 0)
      return false;
    const box = this.leftIn;
    const give = 20 + 0.01 * Math.max(box.width, box.height);
    const near = (value, other) => Math.abs(value - other) < give;
    return near(object.x, box.minX) && near(object.y, box.minY) && near(object.width ?? 0, box.width) && near(object.height ?? 0, box.height);
  }
  /// The box the object takes up now.
  static boxOf(object) {
    const x = object.x ?? 0;
    const y = object.y ?? 0;
    return new cool.Range2D(x, y, x + (object.width ?? 0), y + (object.height ?? 0));
  }
}
const _RenderGeometrySection = class _RenderGeometrySection extends CanvasSectionObject {
  /// That distance in twips at the zoom shown, so it is the same on screen at any zoom and on a
  /// screen of any density.
  static hitTolerance() {
    var _a;
    const pixels = ((_a = window.prefs) == null ? void 0 : _a.getNumber("vectorHitTolerance", _RenderGeometrySection.hitTolerancePixels)) ?? _RenderGeometrySection.hitTolerancePixels;
    return pixels * app.dpiScale * app.pixelsToTwips;
  }
  constructor() {
    super(app.CSections.RenderGeometry.name);
    this.zIndex = app.CSections.RenderGeometry.zIndex;
    this.drawingOrder = app.CSections.RenderGeometry.drawingOrder;
    this.processingOrder = app.CSections.RenderGeometry.processingOrder;
    this.boundToSection = "tiles";
    this.interactable = false;
    if (!_RenderGeometrySection._listening) {
      _RenderGeometrySection._listening = true;
      RenderManager.onVectorChanged((answered, inputSequence) => {
        _RenderGeometrySection._lastHit = void 0;
        _RenderGeometrySection.takeUpTheAnswers(answered, inputSequence);
        ViewLayoutVector.takeInTheObjects();
        GraphicSelection.refreshLocalHandles();
        if (app.sectionContainer)
          app.sectionContainer.requestReDraw();
      });
    }
    if (!_RenderGeometrySection._followsMouse) {
      _RenderGeometrySection._followsMouse = true;
      const canvas = document.getElementById("document-canvas");
      canvas == null ? void 0 : canvas.addEventListener("mousemove", () => _RenderGeometrySection.redrawWhenHitMoved());
      canvas == null ? void 0 : canvas.addEventListener("mouseleave", () => {
        _RenderGeometrySection._drawnHitKey = "";
        if (app.sectionContainer)
          app.sectionContainer.requestReDraw();
      });
    }
  }
  /// Asks for a redraw when the object under the pointer, or what of it is hit, is not the
  /// one the outline was last drawn for.
  static redrawWhenHitMoved() {
    var _a;
    const section = (_a = app.sectionContainer) == null ? void 0 : _a.getSectionWithName(app.CSections.RenderGeometry.name);
    if (!section)
      return;
    const mouse = section.containerObject.getMousePosition();
    const hit = mouse ? section.hitObject(mouse) : void 0;
    const key = hit ? String(hit.id) + ":" + hit.hit.kind : "";
    if (key === _RenderGeometrySection._drawnHitKey)
      return;
    app.sectionContainer.requestReDraw();
  }
  /*
      An object keeps its color for as long as it lives, so a rectangle that moves or resizes is
      easy to follow. Stepping the hue by the golden angle puts neighboring ids far apart.
  */
  static colorOfObject(id) {
    return "hsl(" + (id * 137.508 % 360).toFixed(1) + ", 100%, 45%)";
  }
  /*
      The four corners of the unit rectangle put through the transformation, in twips. They are
      transformed here rather than by the canvas so the line stays one pixel wide whatever the
      object's scale is.
  */
  static unitRectangleCorners(matrix) {
    if (!matrix)
      return [];
    return [
      matrix.apply(0, 0),
      matrix.apply(1, 0),
      matrix.apply(1, 1),
      matrix.apply(0, 1)
    ];
  }
  /// The part the view shows, from the vector rendering cache, or nothing while it is on its
  /// way or the view shows no part.
  static currentPart() {
    var _a;
    const docLayer = (_a = app.map) == null ? void 0 : _a._docLayer;
    if (!docLayer || app.file.fileBasedView || !app.activeDocument)
      return void 0;
    return RenderManager.requestPart(docLayer._selectedPart, app.activeDocument.activeModes[0]);
  }
  /*
      Where the page sits in this section's own coordinates: the document anchor less the part of
      the document that is scrolled out of sight. Both the drawing and the hit test go through it.
  */
  documentOffset() {
    if (!app.activeDocument || !this.containerObject)
      return void 0;
    const anchor = this.containerObject.getDocumentAnchor();
    return [
      anchor[0] - app.activeDocument.activeLayout.viewedRectangle.pX1,
      anchor[1] - app.activeDocument.activeLayout.viewedRectangle.pY1
    ];
  }
  /** The object under the given point and what of it was hit, or nothing when no object is hit.
   *
   * The point arrives in this section's own coordinates. An object is asked in two steps:
   * whether the point lies in the object's own unit rectangle, which is cheap and covers rotation
   * and shear, and then which of the object's primitives the point hits, asked one by one. The
   * objects are asked from the front, so the answer is the object a click would reach first.
   *
   * The page itself and the text of a running edit are left out: they are how the document looks
   * behind and over the objects, and they cannot be hit. So are the objects on a
   * layer the view hides.
   */
  hitObject(point) {
    const offset = this.documentOffset();
    if (!offset)
      return void 0;
    return this.hitObjectInDocument((point[0] - offset[0]) * app.pixelsToTwips, (point[1] - offset[1]) * app.pixelsToTwips);
  }
  /// The same answer for a point in document coordinates, in twips. The point asked about
  /// last is answered from memory while the content is the one it was asked about.
  hitObjectInDocument(x, y) {
    const data = _RenderGeometrySection.currentPart();
    if (!data)
      return void 0;
    const edited = _RenderGeometrySection.editedPart();
    const last = _RenderGeometrySection._lastHit;
    if (last && last.x === x && last.y === y && last.data === data && last.version === data.version && last.edited === edited)
      return last.hit;
    const hits = this.walkObjectsAt(data, x, y, edited !== void 0);
    const hit = edited === void 0 ? hits[0] : hits.find((one) => _RenderGeometrySection.liesWithin(data, one.id, edited)) ?? hits[0];
    _RenderGeometrySection._lastHit = {
      x,
      y,
      data,
      version: data.version,
      edited,
      hit
    };
    return hit;
  }
  /// What one stands inside: the entered group or diagram, or the object active in place.
  /// Nothing on the page.
  static editedPart() {
    const place = Interaction.placeOf(GraphicSelection.selectedObjectIDs);
    if (place.kind === "group" || place.kind === "diagram")
      return place.group;
    if (place.kind === "table")
      return place.group;
    if (place.kind === "inPlace")
      return place.object;
    return void 0;
  }
  /// Whether the object is that one or lies inside it, at any depth.
  static liesWithin(data, objectId, holderId) {
    var _a;
    for (let at = objectId, guard = 0; at !== void 0 && guard < 100; at = (_a = data.objects.get(at)) == null ? void 0 : _a.parent, ++guard)
      if (at === holderId)
        return true;
    return false;
  }
  /// The objects of the page under a document position, in twips, from the front to the back:
  /// every one the point meets, not only the topmost. Empty where it meets none.
  static objectIdsAt(x, y) {
    const data = _RenderGeometrySection.currentPart();
    const section = _RenderGeometrySection.ofPage();
    if (!data || !section)
      return [];
    return section.walkObjectsAt(data, x, y, true).map((hit) => hit.id);
  }
  /// Whether the box an object paints into lies within the upright box of its own square, give
  /// or take the tolerance.
  static paintsInsideItsSquare(square, painted, tolerance) {
    if (!square)
      return true;
    const bounds = cool.Range2D.fromPoints([
      square.apply(0, 0),
      square.apply(1, 0),
      square.apply(1, 1),
      square.apply(0, 1)
    ]);
    return painted.minX >= bounds.minX - tolerance && painted.minY >= bounds.minY - tolerance && painted.maxX <= bounds.maxX + tolerance && painted.maxY <= bounds.maxY + tolerance;
  }
  // the selection frame, dashed in the colour of the outline under the pointer
  strokeTheFrame(xDiff, yDiff) {
    const frame = _RenderGeometrySection.frame;
    if (!frame)
      return;
    const scale = app.twipsToPixels;
    this.context.save();
    this.context.strokeStyle = _RenderGeometrySection.hoverColor();
    this.context.lineWidth = 1;
    this.context.setLineDash(_RenderGeometrySection.hoverDashes);
    this.context.strokeRect(xDiff + Math.round(frame.minX * scale) + 0.5, yDiff + Math.round(frame.minY * scale) + 0.5, Math.round(frame.width * scale), Math.round(frame.height * scale));
    this.context.restore();
  }
  /// The ones of those objects that can be selected: out of design mode a form control works as
  /// a control and is no object to select.
  static theSelectable(objectIds) {
    if (app.map.isFormControlDesignMode())
      return objectIds;
    return objectIds.filter((id) => {
      var _a;
      return ((_a = _RenderGeometrySection.objectOf(id)) == null ? void 0 : _a.objectKind) !== _RenderGeometrySection.formControlKind;
    });
  }
  /// The form controls are hit only in design mode, so a switch of the mode drops the last hit
  /// test answer and draws the document again. Out of design mode the controls are no objects
  /// to edit, so they leave the selection.
  static formControlModeChanged() {
    _RenderGeometrySection._lastHit = void 0;
    _RenderGeometrySection._drawnHitKey = "";
    if (!app.map.isFormControlDesignMode()) {
      const selected = GraphicSelection.selectedObjectIDs;
      const kept = _RenderGeometrySection.theSelectable(selected);
      if (kept.length !== selected.length)
        GraphicSelection.selectObjects(kept);
    }
    if (app.sectionContainer)
      app.sectionContainer.requestReDraw();
  }
  /// The objects the point meets, from the front to the back: the topmost alone, or with
  /// everyOne set every one of them.
  walkObjectsAt(data, x, y, everyOne) {
    const hits = [];
    const tolerance = _RenderGeometrySection.hitTolerance();
    const position = {
      x,
      y,
      toleranceX: tolerance,
      toleranceY: tolerance
    };
    for (let index = data.order.length - 1; index >= 0; --index) {
      const id = data.order[index];
      const object = data.objects.get(id);
      if (!object || object.kind !== void 0 || !object.transform)
        continue;
      if (object.masterContent)
        continue;
      if (object.layer !== void 0 && !RenderManager.isLayerVisible(object.layer))
        continue;
      const range = new cool.Range2D(object.x ?? 0, object.y ?? 0, (object.x ?? 0) + (object.width ?? 0), (object.y ?? 0) + (object.height ?? 0));
      if (x < range.minX - tolerance || x > range.maxX + tolerance || y < range.minY - tolerance || y > range.maxY + tolerance)
        continue;
      const square = cool.Matrix2D.fromArray(object.transform);
      if (_RenderGeometrySection.paintsInsideItsSquare(square, range, tolerance) && !cool.VectorHitTest.isInUnitSquare(square, position))
        continue;
      const hit = cool.VectorHitTest.hit(object.primitives ?? [], position, range) ?? (_RenderGeometrySection.spansADiagram(data, id) ? {
        kind: "fill",
        hidden: true,
        editView: false,
        edge: false,
        link: false
      } : void 0);
      if (!hit)
        continue;
      if (object.objectKind === _RenderGeometrySection.formControlKind && !app.map.isFormControlDesignMode())
        break;
      hits.push({ id, hit });
      if (!everyOne)
        break;
    }
    return hits;
  }
  /// Whether that object is the first a diagram holds, the shape spanning the whole diagram.
  static spansADiagram(data, objectId) {
    var _a, _b;
    const parent = (_a = data.objects.get(objectId)) == null ? void 0 : _a.parent;
    if (!parent || !((_b = data.objects.get(parent)) == null ? void 0 : _b.isDiagram))
      return false;
    return data.order.find((id) => {
      var _a2;
      return ((_a2 = data.objects.get(id)) == null ? void 0 : _a2.parent) === parent;
    }) === objectId;
  }
  /*
      The mapping that puts a place on the object onto the page, in twips: 0 and 0 is the upper
      left corner of the object and 1 and 1 the lower right one. Its inverse takes a place on the
      page back onto the object. Nothing for an object the client does not hold, or one that
      says no mapping of its own.
  */
  static transformOf(objectId) {
    var _a;
    return cool.Matrix2D.fromArray((_a = _RenderGeometrySection.objectOf(objectId)) == null ? void 0 : _a.transform);
  }
  /// The box the object takes up on the page, in twips. Nothing for an object the client does
  /// not hold.
  /// The box round every drawing object of the part shown, in twips, or nothing where there is
  /// none.
  static boxOfAllObjects() {
    const data = _RenderGeometrySection.currentPart();
    if (!data)
      return void 0;
    let box;
    data.objects.forEach((object) => {
      if (object.kind !== void 0 || object.x === void 0)
        return;
      if (object.y === void 0)
        return;
      const own = new cool.Range2D(object.x, object.y, object.x + (object.width ?? 0), object.y + (object.height ?? 0));
      box = box ? box.union(own) : own;
    });
    return box;
  }
  static boxOf(objectId) {
    const object = _RenderGeometrySection.objectOf(objectId);
    if (!object)
      return void 0;
    const objects = [object];
    if (object.textEdit) {
      const data = _RenderGeometrySection.currentPart();
      data == null ? void 0 : data.objects.forEach((entry) => {
        if (entry.kind === "texteditoverlay" && entry.parent === objectId)
          objects.push(entry);
      });
    }
    let box;
    for (const each of objects) {
      const own = _RenderGeometrySection.boxOfTheObject(each);
      if (own)
        box = box ? box.union(own) : own;
    }
    return box;
  }
  /// The box that object takes up on the page, in twips. Nothing where it says no place.
  /*
      The box an object drawn by that mapping takes up after a change that turns or shears it,
      from the box it took up before. The box round the box turned along would be larger than
      the object, and larger again with every further step of a key held down, so the box is
      laid round the mapping as the change leaves it, with the room it had round the mapping
      before kept on each side, such as half the width of its outline.
  */
  static boxTurnedWith(box, mapping, change) {
    const cornersOf = (through) => cool.Range2D.fromPoints([
      through.apply(0, 0),
      through.apply(1, 0),
      through.apply(1, 1),
      through.apply(0, 1)
    ]);
    const before = cornersOf(mapping);
    const after = cornersOf(mapping.then(change));
    return new cool.Range2D(after.minX - Math.max(0, before.minX - box.minX), after.minY - Math.max(0, before.minY - box.minY), after.maxX + Math.max(0, box.maxX - before.maxX), after.maxY + Math.max(0, box.maxY - before.maxY));
  }
  static boxOfTheObject(object) {
    if (object.x === void 0 || object.y === void 0)
      return void 0;
    return new cool.Range2D(object.x, object.y, object.x + (object.width ?? 0), object.y + (object.height ?? 0));
  }
  /*
          Lays a change over the object the client holds: what it draws, the mapping that places it,
          the box it takes up and the points it was given to tie a connector to all come out as the
          change leaves them.
  
          The client works a drag out itself and sends what it did, so the object it holds is
          changed here rather than waiting for the engine to answer with its own version of it.
          That version replaces this one whenever it arrives, so a change the engine made
          differently puts itself right then. The ticket is the one of the message that carried
          the change, or null where none was numbered.
      */
  static changeObject(objectId, matrix, ticket) {
    const object = _RenderGeometrySection.objectOf(objectId);
    if (!object)
      return;
    _RenderGeometrySection.layOverTheObject(object, matrix);
    const pending = PendingChange.leftOn(matrix, object, ticket);
    if (pending) {
      const laid = _RenderGeometrySection.pending.get(objectId) ?? [];
      laid.push(pending);
      _RenderGeometrySection.pending.set(objectId, laid);
    }
    RenderManager.changedHere();
  }
  /// Whether a change laid over that object here still waits for the engine's answer.
  static awaitsAnAnswer(objectId) {
    return _RenderGeometrySection.pending.has(objectId);
  }
  /*
          Takes up an answer from the engine for the objects it replaced: the ones named, or every
          object with a change pending where none are named.
  
          Where the answer names the newest input sequence number the engine applied, the pending
          changes up to that number are answered and the others are laid on again over it. The answer
          was foreseen where the newest answered change left the object where the answer has it. An
          answer older than every pending change answers none and stands as it is under them.
  
          Where it names none, the answer is held against the mappings the pending changes left the
          object at, oldest first: the engine answers the changes in the order they were sent, so
          where the object came back to a place it stood at before, the answer is the one for its
          first visit there. Where it matches one, the changes up to that one are answered and the
          ones after it are laid on again over the answer. Where it matches none the engine went its
          own way, and its answer stands as it is with nothing laid on.
      */
  static takeUpTheAnswers(answered, inputSequence) {
    const objectIds = answered ?? [..._RenderGeometrySection.pending.keys()];
    if (!answered) {
      GraphicSelection.unpredictedAnswer();
      ShearingInteraction.forgetTheKeys();
      TurningInteraction.forgetTheKeys();
    }
    for (const objectId of objectIds) {
      const laid = _RenderGeometrySection.pending.get(objectId);
      if (!laid) {
        GraphicSelection.unpredictedAnswer(objectId);
        ShearingInteraction.forgetTheKeys(objectId);
        TurningInteraction.forgetTheKeys(objectId);
        continue;
      }
      const object = _RenderGeometrySection.objectOf(objectId);
      const answer = cool.Matrix2D.fromArray(object == null ? void 0 : object.transform);
      if (!object || !answer) {
        _RenderGeometrySection.pending.delete(objectId);
        continue;
      }
      const { rest, foreseen } = inputSequence === void 0 ? _RenderGeometrySection.heldAgainstThePlace(laid, object, answer) : _RenderGeometrySection.heldAgainstTheNumber(laid, inputSequence, object, answer);
      if (!foreseen)
        GraphicSelection.unpredictedAnswer(objectId);
      for (const one of rest) {
        _RenderGeometrySection.layOverTheObject(object, one.change);
        one.laidAgainOn(object);
      }
      if (rest.length)
        _RenderGeometrySection.pending.set(objectId, rest);
      else
        _RenderGeometrySection.pending.delete(objectId);
    }
  }
  /*
      The pending changes the engine has not applied by that number, and whether the answer was
      foreseen: the newest applied change left the object where the answer has it, or none was
      applied and the answer is older than every change.
  */
  static heldAgainstTheNumber(laid, inputSequence, object, answer) {
    const rest = [];
    let newest;
    for (const one of laid)
      if (one.appliedBy(inputSequence))
        newest = one;
      else
        rest.push(one);
    const foreseen = !newest || newest.answeredBy(answer) || newest.answeredInTheBox(object);
    return { rest, foreseen };
  }
  /// The pending changes after the one whose mapping or box matches the answer, and whether
  /// one matches. None where nothing matches.
  static heldAgainstThePlace(laid, object, answer) {
    let matched = -1;
    for (let at = 0; at < laid.length && matched < 0; ++at)
      if (laid[at].answeredBy(answer))
        matched = at;
    for (let at = 0; at < laid.length && matched < 0; ++at)
      if (laid[at].answeredInTheBox(object))
        matched = at;
    return {
      rest: matched < 0 ? [] : laid.slice(matched + 1),
      foreseen: matched >= 0
    };
  }
  /*
          Gives each run of text under a change only the part of it that moves and turns. The
          engine lays text out anew in the changed frame at its own font size, upright and never
          turned over, so the glyphs keep their size and read the right way round. Until it
          answers, a run keeps its glyphs as they are and goes where the change takes its middle,
          turned with the change where the change keeps the sense of turning and not turned where
          it turns the object over.
  
          Each run is drawn through the wrap around everything, the transforms it hangs under
          inside that wrap, and its own matrix. The run's own matrix is set so that the three
          together draw it where it is wanted, with the wrap as it is after the change.
      */
  static keepTheTextAsLaidOut(primitives, change, wrapBefore, wrapAfter, inside) {
    var _a, _b;
    const angle = change.a * change.d - change.b * change.c > 0 ? Math.atan2(change.b - change.c, change.a + change.d) : 0;
    for (const primitive of primitives) {
      if (primitive.type === cool.TextSimplePortionPrimitive.type || primitive.type === cool.TextDecoratedPortionPrimitive.type) {
        const run = primitive;
        const own = cool.Matrix2D.fromArray(run.matrix);
        if (!own)
          continue;
        const drawnBy = own.then(inside).then(wrapBefore);
        const fontSize = run.fontSize ?? 12;
        const length = ((_a = run.advances) == null ? void 0 : _a.length) ? run.advances.reduce((sum, one) => sum + one, 0) : (run.textLength ?? ((_b = run.text) == null ? void 0 : _b.length) ?? 0) * fontSize * 0.5;
        const middle = drawnBy.apply(length / 2 / fontSize, -0.35);
        const to = change.apply(middle.x, middle.y);
        const movedAndTurned = cool.Matrix2D.IDENTITY.rotateAround(middle.x, middle.y, angle).translate(to.x - middle.x, to.y - middle.y);
        const under = inside.then(wrapAfter).invert();
        if (under)
          run.matrix = drawnBy.then(movedAndTurned).then(under).toArray();
        continue;
      }
      if (!primitive.children)
        continue;
      const transform = cool.Matrix2D.fromArray(primitive.matrix);
      _RenderGeometrySection.keepTheTextAsLaidOut(primitive.children, change, wrapBefore, wrapAfter, primitive.type === cool.TransformPrimitive.type && transform ? transform.then(inside) : inside);
    }
  }
  /// Lays the change over that object, which is what changing one comes down to.
  static layOverTheObject(object, matrix) {
    const wasDrawnBy = cool.Matrix2D.fromArray(object.transform);
    const drawn = object.primitives ?? [];
    const only = drawn.length === 1 && drawn[0].type === cool.TransformPrimitive.type ? drawn[0] : void 0;
    const under = cool.Matrix2D.fromArray(only == null ? void 0 : only.matrix);
    const wrapBefore = under ?? cool.Matrix2D.IDENTITY;
    _RenderGeometrySection.keepTheTextAsLaidOut(only && under ? only.children ?? [] : drawn, matrix, wrapBefore, wrapBefore.then(matrix), cool.Matrix2D.IDENTITY);
    if (only && under)
      only.matrix = under.then(matrix).toArray();
    else if (drawn.length)
      object.primitives = [
        {
          type: cool.TransformPrimitive.type,
          matrix: matrix.toArray(),
          children: drawn
        }
      ];
    const mapping = cool.Matrix2D.fromArray(object.transform);
    if (mapping)
      object.transform = mapping.then(matrix).toArray();
    cool.CaptionTail.layAnew(object);
    const box = _RenderGeometrySection.boxOfTheObject(object);
    if (box) {
      const reached = mapping && (Math.abs(matrix.b) > 1e-9 || Math.abs(matrix.c) > 1e-9) ? _RenderGeometrySection.boxTurnedWith(box, mapping, matrix) : cool.Range2D.fromPoints([
        matrix.apply(box.minX, box.minY),
        matrix.apply(box.maxX, box.minY),
        matrix.apply(box.maxX, box.maxY),
        matrix.apply(box.minX, box.maxY)
      ]);
      object.x = reached.minX;
      object.y = reached.minY;
      object.width = reached.width;
      object.height = reached.height;
    }
    const stood = /* @__PURE__ */ new Map();
    for (const one of object.handles ?? []) {
      stood.set(one, new cool.Point(one.x, one.y));
      if (object.caption && one.kind === 9)
        continue;
      const at = matrix.apply(one.x, one.y);
      one.x = at.x;
      one.y = at.y;
    }
    const drawnBy = cool.Matrix2D.fromArray(object.transform);
    if (wasDrawnBy && drawnBy) {
      for (const one of object.handles ?? []) {
        const place = ObjectHandles.keptAlongItsRail(one.rails, stood.get(one) ?? new cool.Point(one.x, one.y), wasDrawnBy, drawnBy);
        if (!place)
          continue;
        one.x = place.x;
        one.y = place.y;
      }
    }
    for (const polygon of object.path ?? []) {
      for (const point of polygon.points ?? []) {
        const at = matrix.apply(point.x, point.y);
        point.x = at.x;
        point.y = at.y;
        if (point.behindX !== void 0 && point.behindY !== void 0) {
          const behind = matrix.apply(point.behindX, point.behindY);
          point.behindX = behind.x;
          point.behindY = behind.y;
        }
        if (point.aheadX !== void 0 && point.aheadY !== void 0) {
          const ahead = matrix.apply(point.aheadX, point.aheadY);
          point.aheadX = ahead.x;
          point.aheadY = ahead.y;
        }
      }
    }
  }
  /*
      Whether the object of that id is drawn under the given document point, in twips. It asks
      the object's own primitives, so a thin line answers for the line and not for the box
      around it, and it answers for that one object whatever is drawn over it.
  */
  static objectHitAt(objectId, x, y) {
    const object = _RenderGeometrySection.objectOf(objectId);
    if (!object)
      return false;
    const tolerance = _RenderGeometrySection.hitTolerance();
    return cool.VectorHitTest.hit(object.primitives ?? [], { x, y, toleranceX: tolerance, toleranceY: tolerance }, new cool.Range2D(object.x ?? 0, object.y ?? 0, (object.x ?? 0) + (object.width ?? 0), (object.y ?? 0) + (object.height ?? 0))) !== void 0;
  }
  /// Whether an object of the page is under the given point.
  isHit(point) {
    return this.hitObject(point) !== void 0;
  }
  onDraw() {
    if (this.containerObject.isInZoomAnimation())
      return;
    const data = _RenderGeometrySection.currentPart();
    if (!data)
      return;
    Util.ensureValue(app.activeDocument);
    const viewedRectangle = app.activeDocument.activeLayout.viewedRectangle;
    const xDiff = -viewedRectangle.pX1;
    const yDiff = -viewedRectangle.pY1;
    if (_RenderGeometrySection.frame)
      this.strokeTheFrame(xDiff, yDiff);
    else if (!FreeformLineSection.isChosen())
      this.outlineHitUnderMouse(data, xDiff, yDiff);
    if (!app.map._debug.renderGeometryOn)
      return;
    if (_RenderGeometrySection.routingCheckedAt !== data.version) {
      _RenderGeometrySection.routingCheckedAt = data.version;
      ConnectorRouter.checkAgainstTheEngine(data);
    }
    this.context.save();
    this.context.lineWidth = 1;
    this.context.globalAlpha = 0.2;
    this.strokeFramesOf(data, xDiff, yDiff, false);
    const master = data.masterPartId !== void 0 ? RenderManager.requestPartById(data.masterPartId, cool.VectorMode.MasterPages) : void 0;
    if (master) {
      this.context.setLineDash([4, 3]);
      this.strokeFramesOf(master, xDiff, yDiff, true);
      this.context.setLineDash([]);
    }
    this.nameHitUnderMouse(data, xDiff, yDiff);
    this.context.restore();
  }
  /*
      Strokes, for every object of that part, the box it paints into and the rectangle of its
      own mapping, each in the object's own color. The page entry is left out where asked.
  */
  strokeFramesOf(data, xDiff, yDiff, leaveOutThePage) {
    const scale = app.twipsToPixels;
    for (const id of data.order) {
      const object = data.objects.get(id);
      if (!object)
        continue;
      if (leaveOutThePage && object.kind === "page")
        continue;
      this.context.strokeStyle = _RenderGeometrySection.colorOfObject(id);
      if (object.x !== void 0 && object.y !== void 0 && object.width !== void 0 && object.height !== void 0) {
        this.context.strokeRect(xDiff + Math.round(object.x * scale) + 0.5, yDiff + Math.round(object.y * scale) + 0.5, Math.round(object.width * scale), Math.round(object.height * scale));
      }
      if (object.transform)
        this.strokeUnitRectangle(cool.Matrix2D.fromArray(object.transform), xDiff, yDiff);
    }
  }
  /*
      The color the elements one interacts with are drawn in, which the palette keeps as the
      color of a border under the pointer. It is the light gray the document engine draws
      boundaries and hit geometry in.
  */
  static hoverColor() {
    const token = getComputedStyle(document.documentElement).getPropertyValue("--color-border-darker").trim();
    return token || "#c0bfbc";
  }
  /*
      Draws around what the pointer found: the outline of the geometry the object draws, fills and
      lines without the letters of its text, and of every object a group holds. Where the object
      draws no geometry, the geometry the hit test answered with, and else the object's unit
      rectangle through its transformation.
  */
  outlineHitUnderMouse(data, xDiff, yDiff) {
    var _a;
    const mouse = this.containerObject.getMousePosition();
    const hit = mouse ? this.hitObject(mouse) : void 0;
    _RenderGeometrySection._drawnHitKey = hit ? String(hit.id) + ":" + hit.hit.kind : "";
    if (!hit)
      return;
    const taken = _RenderGeometrySection.whatAPressTakes(hit.id);
    if (GraphicSelection.selectedObjectIDs.includes(taken))
      return;
    const object = data.objects.get(taken);
    if (!(object == null ? void 0 : object.transform))
      return;
    let drawn;
    for (const objectId of _RenderGeometrySection.theOnesThatDraw([taken])) {
      const own = cool.VectorHitTest.outlineOf((_a = _RenderGeometrySection.objectOf(objectId)) == null ? void 0 : _a.primitives);
      if (!own)
        continue;
      drawn = drawn ?? new Path2D();
      drawn.addPath(own);
    }
    const shape = drawn ?? hit.hit.path ?? cool.VectorHitTest.pathOfUnitSquare(cool.Matrix2D.fromArray(object.transform));
    if (!shape)
      return;
    const outline = new Path2D();
    outline.addPath(shape, {
      a: app.twipsToPixels,
      b: 0,
      c: 0,
      d: app.twipsToPixels,
      e: xDiff,
      f: yDiff
    });
    this.context.save();
    this.context.strokeStyle = _RenderGeometrySection.hoverColor();
    this.context.lineWidth = 1;
    this.context.setLineDash(_RenderGeometrySection.hoverDashes);
    this.context.stroke(outline);
    this.context.restore();
  }
  /*
      Writes what the hit test answers for the object under the pointer above that object's
      rectangle: which geometry of it was found, and whether that geometry is one that is carried
      to be hit rather than seen, one that only an editing view shows, or the boundary of a fill.
      So moving the pointer over a document says whether the client finds an object exactly where
      the object is painted.
  */
  nameHitUnderMouse(data, xDiff, yDiff) {
    const mouse = this.containerObject.getMousePosition();
    const hit = mouse ? this.hitObject(mouse) : void 0;
    if (!hit)
      return;
    const object = data.objects.get(hit.id);
    if (!object || object.x === void 0 || object.y === void 0)
      return;
    const flags = [];
    if (hit.hit.hidden)
      flags.push("hidden");
    if (hit.hit.editView)
      flags.push("editview");
    if (hit.hit.edge)
      flags.push("edge");
    this.context.globalAlpha = 1;
    this.context.fillStyle = _RenderGeometrySection.colorOfObject(hit.id);
    this.context.font = "11px sans-serif";
    this.context.fillText(hit.hit.kind + " id=" + String(hit.id) + (flags.length ? " (" + flags.join(", ") + ")" : ""), xDiff + Math.round(object.x * app.twipsToPixels) + 2, yDiff + Math.round(object.y * app.twipsToPixels) - 3);
  }
  strokeUnitRectangle(transform, xDiff, yDiff) {
    const scale = app.twipsToPixels;
    const corners = _RenderGeometrySection.unitRectangleCorners(transform);
    this.context.beginPath();
    corners.forEach((corner, index) => {
      const pX = xDiff + Math.round(corner.x * scale) + 0.5;
      const pY = yDiff + Math.round(corner.y * scale) + 0.5;
      if (index === 0)
        this.context.moveTo(pX, pY);
      else
        this.context.lineTo(pX, pY);
    });
    this.context.closePath();
    this.context.stroke();
  }
  /*
      The pointer the objects ask for at a document position, in the names the engine sends for
      them: 'pointer', the hand, where the text of a hyperlink lies under the point, 'text' where
      other text of an object does, 'move' where the object itself does, and 'default' where there
      is no object. It is the same answer the hit test gives, so what the pointer says and what
      the hit test found are one thing.
  */
  static pointerAt(x, y) {
    const section = _RenderGeometrySection.ofPage();
    if (!section)
      return "default";
    return _RenderGeometrySection.pointerOf(section.hitObjectInDocument(x, y));
  }
  /// The same answer for a point in the coordinates of the section container.
  static pointerAtCanvasPoint(point) {
    const section = _RenderGeometrySection.ofPage();
    if (!section)
      return "default";
    return _RenderGeometrySection.pointerOf(section.hitObject(point));
  }
  static pointerOf(hit) {
    var _a;
    if (!hit)
      return "default";
    if (hit.hit.kind === "text")
      return hit.hit.link ? "pointer" : "text";
    const data = _RenderGeometrySection.currentPart();
    const parent = (_a = data == null ? void 0 : data.objects.get(hit.id)) == null ? void 0 : _a.parent;
    const inADiagram = parent !== void 0 && Interaction.groupsAbove([hit.id]).some((group) => {
      var _a2;
      return ((_a2 = data == null ? void 0 : data.objects.get(group)) == null ? void 0 : _a2.isDiagram) === true;
    });
    if (data && inADiagram && !_RenderGeometrySection.spansADiagram(data, hit.id))
      return "default";
    return "move";
  }
  /// The section holding the objects of the page, while the document is drawn from them.
  static ofPage() {
    var _a;
    return (_a = app.sectionContainer) == null ? void 0 : _a.getSectionWithName(app.CSections.RenderGeometry.name);
  }
  /*
      The box every object of the page paints into, in twips, by the id of the object. An object
      on a layer the view hides is left out, as is the page itself, a running text edit and the
      page's copy of a master placeholder, none of which are objects to reckon with.
  */
  static objectBoxes() {
    const boxes = /* @__PURE__ */ new Map();
    const data = _RenderGeometrySection.currentPart();
    if (!data)
      return boxes;
    for (const id of data.order) {
      const object = data.objects.get(id);
      if (!object || object.kind !== void 0 || object.masterContent)
        continue;
      if (object.layer !== void 0 && !RenderManager.isLayerVisible(object.layer))
        continue;
      if (object.width === void 0 || object.height === void 0)
        continue;
      boxes.set(id, [
        object.x ?? 0,
        object.y ?? 0,
        object.width,
        object.height
      ]);
    }
    return boxes;
  }
  /*
      The group the object sits in, 0 for an object directly on the page, or nothing when the
      page holds no such object. Two objects belong in one selection when this answers the same
      for both of them.
  */
  static parentOf(objectId) {
    const object = _RenderGeometrySection.objectOf(objectId);
    return object ? object.parent ?? 0 : void 0;
  }
  /*
          The outermost object the given one belongs to: the group at the top of the chain of groups
          above it, or the object itself where it is in none. A press on something inside a group
          takes hold of the group, as it does in the office, and only stepping into the group
          reaches what is inside it.
  
          Standing inside a group stops the climb there, so a press then takes hold of what that
          group holds and not of the group itself. A press on something outside the group one stands
          in climbs the whole way, which is how pressing beside a group steps back out of it.
      */
  static outermostOf(objectId, standingIn) {
    const part = _RenderGeometrySection.chartPartOf(objectId, standingIn);
    if (part !== void 0)
      return part;
    let outermost = objectId;
    for (let guard = 0; guard < 100; ++guard) {
      if (outermost === standingIn)
        break;
      const parent = _RenderGeometrySection.parentOf(outermost);
      if (!parent || parent === standingIn)
        break;
      outermost = parent;
    }
    return outermost;
  }
  /// What a press on that object takes hold of where one stands now: inside a chart the part
  /// the chart's rules name, otherwise the object itself (a group is entered, not marked).
  static whatAPressTakes(objectId) {
    const place = Interaction.placeOf(GraphicSelection.selectedObjectIDs);
    if (place.kind !== "inPlace")
      return objectId;
    return _RenderGeometrySection.chartPartOf(objectId, place.object) ?? objectId;
  }
  /*
      The part of a chart a press on that object takes hold of, standing inside the chart: the
      nearest part up the chain that the chart selects on its own, and where that part is
      reached by a second click only, the part holding it unless that one or another part it
      holds is selected already. So the first click on a bar selects its series and the next the
      bar, and from there a click on another bar takes that bar, as in the chart.
      Nothing where one does not stand inside a chart or the object is in no part of it.
  */
  static chartPartOf(objectId, standingIn) {
    var _a, _b, _c, _d;
    if (standingIn === void 0)
      return void 0;
    const place = Interaction.placeOf(GraphicSelection.selectedObjectIDs);
    if (place.kind !== "inPlace" || place.object !== standingIn)
      return void 0;
    const partAbove = (from) => {
      var _a2;
      for (let at = from, guard = 0; at !== void 0 && guard < 100; ++guard) {
        if (at === standingIn)
          return void 0;
        if ((_a2 = _RenderGeometrySection.objectOf(at)) == null ? void 0 : _a2.chartPart)
          return at;
        at = _RenderGeometrySection.parentOf(at);
      }
      return void 0;
    };
    let part = partAbove(objectId);
    if (part === void 0)
      return void 0;
    if ((_b = (_a = _RenderGeometrySection.objectOf(part)) == null ? void 0 : _a.chartPart) == null ? void 0 : _b.pressTakesHolder)
      part = partAbove(_RenderGeometrySection.parentOf(part)) ?? part;
    if (!((_d = (_c = _RenderGeometrySection.objectOf(part)) == null ? void 0 : _c.chartPart) == null ? void 0 : _d.multiClick))
      return part;
    const holder = partAbove(_RenderGeometrySection.parentOf(part));
    if (holder === void 0)
      return part;
    const selected = GraphicSelection.selectedObjectIDs;
    const takesThePart = selected.includes(holder) || selected.some((objectId2) => {
      var _a2, _b2;
      return objectId2 !== holder && ((_b2 = (_a2 = _RenderGeometrySection.objectOf(objectId2)) == null ? void 0 : _a2.chartPart) == null ? void 0 : _b2.multiClick) && partAbove(_RenderGeometrySection.parentOf(objectId2)) === holder;
    });
    return takesThePart ? part : holder;
  }
  /*
      The objects a change to these ones really changes. A group holds no drawing of its own and
      no mapping of its own - it is an organisation of the objects under it, a multi-selection
      someone gave a name to - so a change to a group is a change to each of the objects it
      holds. Anything that is not a group answers with itself.
  */
  static theOnesThatDraw(objectIds) {
    return _RenderGeometrySection.descendingInto(objectIds, false);
  }
  /*
      The objects that have a say in what may be done to these ones: a group is asked along with
      everything it holds, so a group holding one object whose place is held fast refuses to be
      moved. A diagram answers on its own. The office holds the place and the size of a
      diagram's members fast as bookkeeping of its own, so that the layout it builds stays the
      one thing that places them, which is not the user saying the diagram may not be moved.
  */
  static theOnesThatHaveASay(objectIds) {
    const standing = _RenderGeometrySection.standingFor(objectIds);
    return standing.concat(_RenderGeometrySection.descendingInto(standing, true));
  }
  /*
      The objects a change of these ones is a change of: each as it is, but the first object of
      a diagram, which spans the whole of it, stands for the diagram - moving, scaling or
      turning it is moving, scaling or turning the diagram, with what the diagram allows.
  */
  static standingFor(objectIds) {
    const data = _RenderGeometrySection.currentPart();
    if (!data)
      return objectIds;
    return objectIds.map((objectId) => {
      var _a;
      return _RenderGeometrySection.spansADiagram(data, objectId) ? ((_a = data.objects.get(objectId)) == null ? void 0 : _a.parent) ?? objectId : objectId;
    });
  }
  /// The descent itself. It walks to the objects that draw, and stops at a diagram when asked.
  static descendingInto(objectIds, stoppingAtADiagram) {
    const data = _RenderGeometrySection.currentPart();
    if (!data)
      return objectIds;
    const holds = /* @__PURE__ */ new Map();
    for (const id of data.order) {
      const object = data.objects.get(id);
      const parent = object == null ? void 0 : object.parent;
      if (!parent || (object == null ? void 0 : object.kind) === "texteditoverlay")
        continue;
      const held = holds.get(parent);
      if (held)
        held.push(id);
      else
        holds.set(parent, [id]);
    }
    const drawn = [];
    const takeIn = (objectId, depth) => {
      var _a;
      const stops = stoppingAtADiagram && ((_a = data.objects.get(objectId)) == null ? void 0 : _a.isDiagram) === true;
      const held = depth < 100 && !stops ? holds.get(objectId) : void 0;
      if (!held) {
        drawn.push(objectId);
        return;
      }
      for (const one of held)
        takeIn(one, depth + 1);
    };
    for (const objectId of objectIds)
      takeIn(objectId, 0);
    return drawn;
  }
  /*
      Everything a change to these objects touches: the objects themselves and all that lies
      under them, the groups in between included. A group carries a mapping and a box of its
      own even though it draws nothing, and a change laid on here has to reach them too, or a
      second change worked out on the group's square before the engine has answered the first
      would be worked out on a stale one.
  */
  static theOnesAChangeTouches(objectIds) {
    objectIds = _RenderGeometrySection.standingFor(objectIds);
    const touched = [];
    const takeIn = (objectId, depth) => {
      touched.push(objectId);
      if (depth >= 100)
        return;
      for (const held of _RenderGeometrySection.heldBy(objectId))
        takeIn(held, depth + 1);
    };
    for (const objectId of objectIds)
      takeIn(objectId, 0);
    return touched;
  }
  /// The objects that object holds, in the order the page draws them. Empty for anything that
  /// is not a group.
  static heldBy(objectId) {
    const data = _RenderGeometrySection.currentPart();
    if (!data)
      return [];
    return data.order.filter((id) => {
      const object = data.objects.get(id);
      return (object == null ? void 0 : object.parent) === objectId && object.kind !== "texteditoverlay";
    });
  }
  /// Whether the object holds other objects, which is what makes it a group.
  /*
      The objects the page holds itself, outside any group, in the order it draws them: no page
      entry, no text edit, no copy of a master placeholder, nothing on a layer the view hides.
  */
  static heldByThePage() {
    const data = _RenderGeometrySection.currentPart();
    if (!data)
      return [];
    return data.order.filter((id) => {
      const object = data.objects.get(id);
      if (!object || object.parent || object.kind !== void 0)
        return false;
      if (object.masterContent)
        return false;
      return object.layer === void 0 || RenderManager.isLayerVisible(object.layer);
    });
  }
  static holdsObjects(objectId) {
    var _a;
    if (((_a = _RenderGeometrySection.objectOf(objectId)) == null ? void 0 : _a.objectKind) === 23 && GraphicSelection.inPlaceObject !== objectId)
      return false;
    return _RenderGeometrySection.heldBy(objectId).length > 0;
  }
  /// The object of the page with the given id, or nothing when the page holds no such object.
  static objectOf(objectId) {
    var _a;
    return (_a = _RenderGeometrySection.currentPart()) == null ? void 0 : _a.objects.get(objectId);
  }
  /*
      The object of the page under a document position, in twips, by its unique id, or nothing
      where the point meets no object. The point is asked as it comes, so an answer stands for
      that position and no other.
  */
  static objectIdAt(x, y) {
    var _a, _b;
    return (_b = (_a = _RenderGeometrySection.ofPage()) == null ? void 0 : _a.hitObjectInDocument(x, y)) == null ? void 0 : _b.id;
  }
  /*
      Whether the objects answer for the mouse pointer here, instead of the engine being asked
      what lies under the mouse. They do when the client holds the drawing objects and one page
      is on screen, so the section knows which page the mouse is over. The file based view
      stacks every page, and the engine answers there.
  */
  static answersPointer() {
    var _a;
    return RenderManager.drawsFromObjects() && !app.file.fileBasedView && ((_a = app.sectionContainer) == null ? void 0 : _a.doesSectionExist(app.CSections.RenderGeometry.name)) === true;
  }
  /*
      Tells the engine whether it should report the mouse pointer at all. While the objects here
      answer for it, the engine works one out on every hover and would send it for nothing.
  */
  static requestPointerFromServer(wanted) {
    app.socket.sendMessage("reportmousepointer wanted=" + (wanted ? "true" : "false"));
  }
  /// Asks for a redraw, so the rectangles come or go with the debug tool.
  static update() {
    if (app.sectionContainer)
      app.sectionContainer.requestReDraw();
  }
};
_RenderGeometrySection._listening = false;
_RenderGeometrySection._followsMouse = false;
_RenderGeometrySection.hitTolerancePixels = 8;
_RenderGeometrySection.hoverDashes = [3, 3];
_RenderGeometrySection._drawnHitKey = "";
_RenderGeometrySection.routingCheckedAt = void 0;
_RenderGeometrySection.formControlKind = 32;
_RenderGeometrySection.pending = /* @__PURE__ */ new Map();
let RenderGeometrySection = _RenderGeometrySection;
