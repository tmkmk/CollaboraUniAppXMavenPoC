const _ShapeLockCalloutSection = class _ShapeLockCalloutSection extends HTMLObjectSection {
  constructor(viewId, kind, objectId) {
    super(_ShapeLockCalloutSection.sectionName, null, null, new cool.SimplePoint(0, 0), "shape-lock-callout", false);
    this.interactable = false;
    this.isAlwaysVisible = true;
    const isRequest = kind === "request";
    const duration = isRequest ? ShapeLockLabelSection.approvalTime : ShapeLockLabelSection.undoTime;
    const countdown = h("span", { class: "shape-lock-callout-countdown", "aria-hidden": "true" });
    const bar = h("i", null);
    const div = this.getHTMLObject();
    div.setAttribute("role", "alert");
    if (isRequest)
      div.replaceChildren(ShapeLockLabelSection.createAvatar(viewId), h(
        "span",
        null,
        h("span", { class: "visuallyhidden" }, ShapeLockLabelSection.getName(viewId)),
        " ",
        _("wants to edit")
      ));
    else
      div.replaceChildren(h("span", null, _("You took over. Made a mistake?")));
    div.append(countdown, h("button", { type: "button", class: "button shape-lock-button", onClick: () => isRequest ? this.reject() : this.giveBack() }, isRequest ? _("Reject") : _("Cancel")), h("span", { class: "shape-lock-callout-progress", "aria-hidden": "true" }, bar));
    div.style.pointerEvents = "auto";
    div.addEventListener("mousedown", (event) => event.preventDefault());
    for (const type of ["mousedown", "mouseup", "click", "dblclick"])
      div.addEventListener(type, (event) => event.stopPropagation());
    this.sectionProperties.viewId = viewId;
    this.sectionProperties.objectId = objectId;
    this.sectionProperties.isRequest = isRequest;
    this.sectionProperties.countdown = countdown;
    this.sectionProperties.countdownText = null;
    this.sectionProperties.startTime = Date.now();
    this.sectionProperties.duration = duration;
    this.sectionProperties.sawCursor = isRequest && app.file.textCursor.visible;
    this.sectionProperties.tickTimer = app.timerRegistry.setInterval("shapelockcallout", () => this.onTick(), 250);
    this.sectionProperties.pendingTransform = null;
    ShapeLockLabelSection.fillProgress(bar, duration);
  }
  // The right edge of the callout lines up with the right edge of the shape, and the callout sits
  // just below the shape, so the text of the shape stays in view. When the callout would leave the
  // document area on the left, the right or the bottom, it moves to the edge of that area.
  adjustHTMLObjectPosition() {
    super.adjustHTMLObjectPosition();
    if (!this.containerObject || !this.containerObject.getDocumentAnchorSection())
      return;
    const anchor = this.containerObject.getDocumentAnchor();
    const anchorSize = this.containerObject.getDocumentAnchorSection().size;
    const left = Math.round(anchor[0] / app.dpiScale) - this.htmlPosition[0];
    const right = Math.round((anchor[0] + anchorSize[0]) / app.dpiScale) - this.htmlPosition[0];
    const bottom = Math.round((anchor[1] + anchorSize[1]) / app.dpiScale) - this.htmlPosition[1];
    const transform = "translate(max(" + left + "px, calc(" + Math.min(0, right) + "px - 100%)), min(4px, calc(" + bottom + "px - 100%)))";
    ShapeLockLabelSection.writeTransform(this, transform);
  }
  onTick() {
    const remaining = this.sectionProperties.duration - (Date.now() - this.sectionProperties.startTime);
    if (remaining <= 0) {
      _ShapeLockCalloutSection.close();
      return;
    }
    const text = _("%1 s").replace("%1", String(Math.ceil(remaining / 1e3)));
    if (this.sectionProperties.countdownText !== text) {
      this.sectionProperties.countdownText = text;
      const countdown = this.sectionProperties.countdown;
      app.layoutingService.appendLayoutingTask(() => {
        countdown.textContent = text;
      });
    }
    this.updatePosition();
  }
  // Take the place of the bottom right corner of the shape whose text this user edits, or of the
  // text cursor before the shape is known. The callout shows once it has a place.
  updatePosition() {
    const shape = GraphicSelection.rectangle;
    const cursor = app.file.textCursor;
    let x, y;
    if (shape && shape.pWidth > 0 && shape.pHeight > 0)
      [x, y] = [shape.pX2, shape.pY2];
    else if (cursor.visible && cursor.rectangle && cursor.rectangle.pHeight > 0)
      [x, y] = [cursor.rectangle.pX2, cursor.rectangle.pY2];
    else
      return;
    if (!this.showSection || Math.round(x) !== this.position[0] || Math.round(y) !== this.position[1]) {
      this.setPosition(x, y);
      this.setShowSection(true);
      this.adjustHTMLObjectPosition();
    }
  }
  // Each view that asked waits for its own answer, so each one gets a rejection.
  reject() {
    _ShapeLockCalloutSection.requests.forEach((time, viewId) => {
      if (_ShapeLockCalloutSection.isOpen(time))
        app.map.sendUnoCommand(".uno:RejectTextEditRequest", {
          ViewId: { type: "long", value: viewId }
        });
    });
    _ShapeLockCalloutSection.requests.clear();
    _ShapeLockCalloutSection.close();
  }
  giveBack() {
    app.map.sendUnoCommand(".uno:ReturnTextEdit", {
      ViewId: { type: "long", value: this.sectionProperties.viewId },
      ObjectId: { type: "string", value: this.sectionProperties.objectId }
    });
    _ShapeLockCalloutSection.close();
  }
  onRemove() {
    app.timerRegistry.clearInterval(this.sectionProperties.tickTimer);
    super.onRemove();
  }
  static show(viewId, kind, objectId = "") {
    _ShapeLockCalloutSection.close();
    const section = new _ShapeLockCalloutSection(viewId, kind, objectId);
    _ShapeLockCalloutSection.section = section;
    app.sectionContainer.addSection(section);
    section.onTick();
    app.sectionContainer.requestReDraw();
  }
  // The given view asks for the text that this user edits.
  static showRequest(viewId) {
    _ShapeLockCalloutSection.requests.set(viewId, Date.now());
    _ShapeLockCalloutSection.show(viewId, "request");
  }
  // A request ends a moment after its countdown, the time a take over that answers it takes to
  // arrive.
  static isOpen(time) {
    return Date.now() - time < ShapeLockLabelSection.approvalTime + ShapeLockLabelSection.approvalMargin;
  }
  // This user took the text of the given shape over from the given view, and can give it back for
  // a short time.
  static showGiveBack(viewId, objectId) {
    _ShapeLockCalloutSection.show(viewId, "giveback", objectId);
  }
  // The given view asked for the text that this user edits, and this user did not reject the
  // request or type since. The text is gone, so no request is open after this.
  static takeRequestOf(viewId) {
    const time = _ShapeLockCalloutSection.requests.get(viewId);
    _ShapeLockCalloutSection.requests.clear();
    return time !== void 0 && _ShapeLockCalloutSection.isOpen(time);
  }
  static close() {
    const section = _ShapeLockCalloutSection.section;
    if (!section)
      return;
    _ShapeLockCalloutSection.section = null;
    app.sectionContainer.removeSection(section.name);
    app.sectionContainer.requestReDraw();
  }
  static closeIfFrom(viewId) {
    _ShapeLockCalloutSection.requests.delete(viewId);
    const section = _ShapeLockCalloutSection.section;
    if (section && section.sectionProperties.viewId === viewId)
      _ShapeLockCalloutSection.close();
  }
  // This user typed or moved the text cursor, which ends every request for the text.
  static onOwnInput() {
    _ShapeLockCalloutSection.requests.clear();
    const section = _ShapeLockCalloutSection.section;
    if (section && section.sectionProperties.isRequest)
      _ShapeLockCalloutSection.close();
  }
  // The callout belongs to the text edit, so it goes away when the text edit ends.
  static onTextCursorVisibility(event) {
    const section = _ShapeLockCalloutSection.section;
    if (!section)
      return;
    if (event.detail.visible)
      section.sectionProperties.sawCursor = true;
    else if (section.sectionProperties.sawCursor)
      _ShapeLockCalloutSection.close();
  }
};
_ShapeLockCalloutSection.sectionName = "ShapeLockCallout";
_ShapeLockCalloutSection.section = null;
_ShapeLockCalloutSection.requests = /* @__PURE__ */ new Map();
let ShapeLockCalloutSection = _ShapeLockCalloutSection;
app.events.on("TextCursorVisibility", ShapeLockCalloutSection.onTextCursorVisibility.bind(ShapeLockCalloutSection));
