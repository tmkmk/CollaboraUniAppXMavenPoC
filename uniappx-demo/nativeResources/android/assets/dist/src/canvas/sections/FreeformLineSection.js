const _FreeformLineSection = class _FreeformLineSection extends CanvasSectionObject {
  constructor() {
    super(app.CSections.FreeformLine.name);
    this.processingOrder = app.CSections.FreeformLine.processingOrder;
    this.drawingOrder = app.CSections.FreeformLine.drawingOrder;
    this.zIndex = app.CSections.FreeformLine.zIndex;
    this.documentObject = true;
    this.chosen = false;
    this.stroke = null;
    this.lastAt = null;
    this.sent = [];
    this.size = app.sectionContainer.getDocumentAnchorSection().size;
  }
  /// The section, where it is there.
  static section() {
    var _a;
    const section = (_a = app.sectionContainer) == null ? void 0 : _a.getSectionWithName(app.CSections.FreeformLine.name);
    return section instanceof _FreeformLineSection ? section : null;
  }
  /// Whether the tool is chosen, so the next press on the page draws a line.
  static isChosen() {
    var _a;
    return ((_a = _FreeformLineSection.section()) == null ? void 0 : _a.chosen) === true;
  }
  /// Chooses the tool, or puts it away where it is chosen. Only a view that draws from objects
  /// and may edit the document has the tool.
  static choose() {
    if (!RenderGeometrySection.answersPointer() || !app.map.isEditMode())
      return;
    const existing = _FreeformLineSection.section();
    if (existing == null ? void 0 : existing.chosen) {
      existing.putAway();
      return;
    }
    _FreeformLineSection.listen();
    const section = existing ?? new _FreeformLineSection();
    if (!existing)
      app.sectionContainer.addSection(section);
    section.chosen = true;
    section.interactable = true;
    _FreeformLineSection.tell();
  }
  /// Puts the tool away, with the line being drawn. Answers whether the tool was chosen.
  static drop() {
    const section = _FreeformLineSection.section();
    if (!(section == null ? void 0 : section.chosen))
      return false;
    section.putAway();
    return true;
  }
  putAway() {
    if (this.stroke)
      this.containerObject.cancelPress();
    this.stopDrawing();
    this.chosen = false;
    this.interactable = false;
    this.context.canvas.style.cursor = "";
    _FreeformLineSection.tell();
    this.leaveWhenDone();
  }
  /// Tells the toolbars whether the tool is chosen, where that changed.
  static tell() {
    const chosen = _FreeformLineSection.isChosen();
    if (chosen === _FreeformLineSection.toldAs)
      return;
    _FreeformLineSection.toldAs = chosen;
    app.map.fire("commandstatechanged", {
      commandName: _FreeformLineSection.command,
      state: chosen ? "true" : "false"
    });
  }
  /// Leaves the page where the tool is put away and no line is drawn.
  leaveWhenDone() {
    if (this.chosen || this.stroke || this.sent.length) {
      this.containerObject.requestReDraw();
      return;
    }
    if (_FreeformLineSection.section() !== this)
      return;
    app.sectionContainer.removeSection(this.name);
    app.sectionContainer.requestReDraw();
  }
  /// Follows the answers of the engine, so a line sent goes once its object is drawn.
  static listen() {
    if (_FreeformLineSection.listening)
      return;
    _FreeformLineSection.listening = true;
    RenderManager.onVectorChanged((_answered, inputSequence) => {
      const section = _FreeformLineSection.section();
      if (!section || inputSequence === void 0)
        return;
      const answered = section.sent.filter((line) => line.ticket.appliedBy(inputSequence));
      if (answered.length)
        section.forget(answered);
    });
  }
  /// Stops drawing those lines sent, and waiting for their answers.
  forget(lines) {
    for (const line of lines)
      if (line.wait !== null)
        app.timerRegistry.clearTimeout(line.wait);
    this.sent = this.sent.filter((line) => lines.indexOf(line) < 0);
    this.leaveWhenDone();
  }
  /// The section covers the page wherever the document is shown.
  isHit(point) {
    const page = this.containerObject.getDocumentAnchorSection();
    return point[0] >= page.myTopLeft[0] && point[0] <= page.myTopLeft[0] + page.size[0] && point[1] >= page.myTopLeft[1] && point[1] <= page.myTopLeft[1] + page.size[1];
  }
  // The section is added while the document is on screen, so it places itself right away.
  onInitialize() {
    this.onNewDocumentTopLeft();
  }
  onNewDocumentTopLeft() {
    Util.ensureValue(app.activeDocument);
    const viewed = app.activeDocument.activeLayout.viewedRectangle;
    this.setPosition(viewed.pX1, viewed.pY1);
    if (this.stroke && this.lastAt)
      this.drawTo(this.lastAt);
  }
  /// The place on the page, in twips, of a point on the section.
  inTheDocument(point) {
    const inDocument = point.clone();
    inDocument.pX += this.position[0];
    inDocument.pY += this.position[1];
    return new cool.Point(inDocument.x, inDocument.y);
  }
  /// Takes the line on to that point of the section.
  drawTo(point) {
    if (!this.stroke)
      return;
    this.lastAt = point.clone();
    if (this.stroke.add(this.inTheDocument(point)))
      this.containerObject.requestReDraw();
  }
  stopDrawing() {
    this.stroke = null;
    this.lastAt = null;
    app.map.fire("scrollvelocity", { vx: 0, vy: 0 });
  }
  onMouseDown(point, _e) {
    if (!this.chosen)
      return;
    const pixel = app.dpiScale * app.pixelsToTwips;
    this.stroke = new cool.FreeformStroke(_FreeformLineSection.leastStep * pixel);
    this.drawTo(point);
  }
  onMouseMove(point, _dragDistance, _e) {
    if (!this.stroke) {
      if (this.chosen)
        this.context.canvas.style.cursor = "crosshair";
      return;
    }
    this.drawTo(point);
    const onCanvas = point.clone();
    onCanvas.pX += this.myTopLeft[0];
    onCanvas.pY += this.myTopLeft[1];
    app.map.fire("handleautoscroll", {
      pos: { x: onCanvas.cX, y: onCanvas.cY },
      map: app.map
    });
  }
  /*
      Letting go of the button ends the line. A press the container did not take as a drag is a
      click, which draws no line and leaves the tool chosen, so the click that follows it comes
      here too.
  */
  onMouseUp(point, _e) {
    if (!this.stroke)
      return;
    this.drawTo(point);
    const stroke = this.stroke;
    this.stopDrawing();
    if (this.containerObject.isDraggingSomething() && stroke.drawsALine())
      this.send(stroke);
    this.containerObject.requestReDraw();
  }
  onDragCancel() {
    this.stopDrawing();
    this.containerObject.requestReDraw();
  }
  /*
      Asks the engine to add the line as a polyline and puts the tool away. The line stays drawn
      until the answer that brings the object, which is told by the sequence number of the
      message. What waits to go out to the engine goes first, so the line is added after it.
  */
  send(stroke) {
    const pixel = app.dpiScale * app.pixelsToTwips;
    const places = cool.FreeformStroke.simplified(stroke.placesSoFar(), _FreeformLineSection.tolerance * pixel);
    ChangeOutbox.sendEverythingAhead();
    const ticket = new cool.InputTicket();
    const sequence = cool.InputSequence.next([ticket], false);
    app.socket.sendMessage(cool.FreeformStroke.message(places, false) + " sequence=" + sequence);
    const line = { places, ticket, wait: null };
    line.wait = app.timerRegistry.setTimeout("freeformlineanswer", () => {
      line.wait = null;
      this.forget([line]);
    }, _FreeformLineSection.longestWait);
    this.sent.push(line);
    this.putAway();
  }
  /// The lines sent that wait for the engine, and the line being drawn.
  linesToDraw() {
    const lines = this.sent.map((line) => line.places);
    if (this.stroke)
      lines.push(this.stroke.placesSoFar());
    return lines.filter((line) => line.length >= 2);
  }
  onDraw() {
    const lines = this.linesToDraw();
    if (!lines.length)
      return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    const origin = new cool.SimplePoint(0, 0);
    this.context.translate(origin.vX, origin.vY);
    this.context.scale(app.twipsToPixels, app.twipsToPixels);
    this.context.strokeStyle = HandleLook.outlineOfADrag;
    this.context.lineWidth = app.dpiScale * app.pixelsToTwips;
    this.context.lineJoin = "round";
    this.context.lineCap = "round";
    this.context.beginPath();
    for (const places of lines) {
      this.context.moveTo(places[0].x, places[0].y);
      for (let at = 1; at < places.length; ++at)
        this.context.lineTo(places[at].x, places[at].y);
    }
    this.context.stroke();
    this.context.restore();
  }
};
_FreeformLineSection.command = "freeformline";
_FreeformLineSection.leastStep = 2;
_FreeformLineSection.tolerance = 1;
_FreeformLineSection.longestWait = 5e3;
_FreeformLineSection.listening = false;
_FreeformLineSection.toldAs = false;
let FreeformLineSection = _FreeformLineSection;
