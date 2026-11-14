const _ShapeLockLabelSection = class _ShapeLockLabelSection extends HTMLObjectSection {
  constructor(viewId) {
    super(_ShapeLockLabelSection.namePrefix + viewId, null, null, new cool.SimplePoint(0, 0), "shape-lock-label");
    this.interactable = false;
    const username = _ShapeLockLabelSection.getName(viewId);
    const status = h("span", { class: "shape-lock-label-status" });
    const takeOverButton = h("button", { type: "button", class: "button shape-lock-button", onClick: () => this.onTakeOverClick() }, _("Take over"));
    const waitText = h("span", null);
    const waitBar = h("i", null);
    const wait = h(
      "span",
      { class: "shape-lock-label-wait" },
      waitText,
      waitBar
    );
    const div = this.getHTMLObject();
    div.style.backgroundColor = app.LOUtil.rgbToHex(app.LOUtil.getViewIdColor(viewId));
    div.replaceChildren(_ShapeLockLabelSection.createAvatar(viewId), h("span", { class: "visuallyhidden" }, username), status, h(
      "span",
      { class: "shape-lock-label-buttons" },
      takeOverButton,
      wait
    ));
    div.style.pointerEvents = "auto";
    div.addEventListener("mousedown", (event) => event.preventDefault());
    for (const type of ["mousedown", "mouseup", "click", "dblclick"])
      div.addEventListener(type, (event) => event.stopPropagation());
    this.sectionProperties.viewId = viewId;
    this.sectionProperties.status = status;
    this.sectionProperties.takeOverButton = takeOverButton;
    this.sectionProperties.wait = wait;
    this.sectionProperties.waitText = waitText;
    this.sectionProperties.waitBar = waitBar;
    this.sectionProperties.lockRectangle = null;
    this.sectionProperties.objectId = "";
    this.sectionProperties.part = "";
    this.sectionProperties.mode = 0;
    this.sectionProperties.lastInput = Date.now();
    this.sectionProperties.requestTime = null;
    this.sectionProperties.takeOverTime = null;
    this.sectionProperties.shown = null;
    this.sectionProperties.pendingTransform = null;
  }
  // The label sits above the shape. When the left or the top edge of the shape is out of view, the
  // label moves to the edge of the document area, so it stays on the part of the shape that shows.
  adjustHTMLObjectPosition() {
    super.adjustHTMLObjectPosition();
    if (!this.containerObject || !this.containerObject.getDocumentAnchorSection())
      return;
    const anchor = this.containerObject.getDocumentAnchor();
    const left = Math.round(anchor[0] / app.dpiScale) - this.htmlPosition[0];
    const top = Math.round(anchor[1] / app.dpiScale) - this.htmlPosition[1];
    const transform = "translate(" + Math.max(0, left) + "px, max(calc(-100% - 1px), " + top + "px))";
    _ShapeLockLabelSection.writeTransform(this, transform);
  }
  // Write the transform of the HTML object of the section in the same layout pass as its left and
  // top.
  static writeTransform(section, transform) {
    const properties = section.sectionProperties;
    if (properties.pendingTransform)
      app.layoutingService.cancelLayoutingTask(properties.pendingTransform);
    properties.pendingTransform = app.layoutingService.appendLayoutingTask(() => {
      properties.pendingTransform = null;
      const div = section.getHTMLObject();
      if (div.style.transform !== transform)
        div.style.transform = transform;
    });
  }
  // The index the part that holds the shape has in the current part list, or -1 when no part
  // carries it. The part is kept as its identifier, because the index of a slide changes when
  // slides are inserted, deleted or moved.
  getPartIndex() {
    return app.map._docLayer.getIndexFromPart(this.sectionProperties.part);
  }
  // The shape is on the part and in the mode shown here.
  checkMyVisibility() {
    return this.getPartIndex() === app.map._docLayer._selectedPart && app.activeDocument.isModeActive(this.sectionProperties.mode);
  }
  getPhase(now) {
    const idleTime = now - this.sectionProperties.lastInput;
    if (idleTime < _ShapeLockLabelSection.activeAfter)
      return "editing";
    if (idleTime < _ShapeLockLabelSection.inactiveAfter)
      return "active";
    return "inactive";
  }
  getName() {
    return _ShapeLockLabelSection.getName(this.sectionProperties.viewId);
  }
  // Show the phase of the other user, and the time this user still waits for an answer. The label
  // changes in a layouting task, once what it shows changes.
  render(now) {
    const phase = this.getPhase(now);
    const statusText = phase === "editing" ? _("is editing") : phase === "active" ? _("is active") : _("is inactive");
    const requestTime = this.sectionProperties.requestTime;
    const hideTakeOver = phase === "editing" || requestTime !== null || !app.map.isEditMode();
    let countdownText = null;
    if (requestTime !== null) {
      const waitTime = Math.max(0, _ShapeLockLabelSection.approvalTime - (now - requestTime));
      countdownText = _("Take over in %1 s").replace("%1", String(Math.ceil(waitTime / 1e3)));
    }
    const shown = this.sectionProperties.shown;
    if (shown && shown.statusText === statusText && shown.hideTakeOver === hideTakeOver && shown.countdownText === countdownText)
      return;
    this.sectionProperties.shown = { statusText, hideTakeOver, countdownText };
    const properties = this.sectionProperties;
    app.layoutingService.appendLayoutingTask(() => {
      properties.status.textContent = statusText;
      properties.takeOverButton.hidden = hideTakeOver;
      properties.wait.hidden = countdownText === null;
      if (countdownText !== null)
        properties.waitText.textContent = countdownText;
    });
  }
  onTick(now) {
    const requestTime = this.sectionProperties.requestTime;
    if (requestTime !== null && now - requestTime >= _ShapeLockLabelSection.approvalTime) {
      _ShapeLockLabelSection.closeMessage();
      this.takeOverNow(false);
    }
    this.render(now);
  }
  onTakeOverClick() {
    const phase = this.getPhase(Date.now());
    if (phase === "active")
      this.askForText();
    else if (phase === "inactive")
      this.takeOverNow(true);
  }
  // The other user gets a request with a countdown, and can reject it.
  askForText() {
    const now = Date.now();
    this.sectionProperties.requestTime = now;
    _ShapeLockLabelSection.fillProgress(this.sectionProperties.waitBar, _ShapeLockLabelSection.approvalTime);
    app.map.sendUnoCommand(".uno:RequestTextEdit", {
      ViewId: { type: "long", value: this.sectionProperties.viewId },
      ObjectId: { type: "string", value: this.sectionProperties.objectId }
    });
    _ShapeLockLabelSection.showMessage(_("%1 needs to approve. After %2 seconds you can edit automatically.").replace("%1", this.getName()).replace("%2", String(_ShapeLockLabelSection.approvalTime / 1e3)), _ShapeLockLabelSection.approvalTime);
    this.render(now);
  }
  // The other user writes the text into the shape and leaves it, then this user edits it. After a
  // take over without a request, this user can give the text back for a short time.
  takeOverNow(canGiveBack) {
    const viewId = this.sectionProperties.viewId;
    const objectId = this.sectionProperties.objectId;
    this.sectionProperties.requestTime = null;
    this.sectionProperties.takeOverTime = Date.now();
    app.map.sendUnoCommand(".uno:TakeOverTextEdit", {
      ViewId: { type: "long", value: viewId },
      ObjectId: { type: "string", value: objectId }
    });
    if (canGiveBack)
      ShapeLockCalloutSection.showGiveBack(viewId, objectId);
    app.map.focus();
  }
  // This user tried to edit the text of the shape. Each key typed into the shape is one more try.
  onRefused() {
    const now = Date.now();
    const takeOverTime = this.sectionProperties.takeOverTime;
    if (this.sectionProperties.requestTime !== null || takeOverTime !== null && now - takeOverTime < _ShapeLockLabelSection.approvalMargin || !app.map.isEditMode())
      return;
    const phase = this.getPhase(now);
    if (phase === "editing")
      _ShapeLockLabelSection.showMessage(_("You can't edit right now, %1 is actively editing.").replace("%1", this.getName()));
    else if (phase === "active")
      _ShapeLockLabelSection.showMessage(_("%1 is active. Use Take over in the label.").replace("%1", this.getName()));
    else
      this.takeOverNow(true);
  }
  onRejected() {
    if (this.sectionProperties.requestTime === null)
      return;
    this.sectionProperties.requestTime = null;
    _ShapeLockLabelSection.showMessage(_("%1 rejected your request.").replace("%1", this.getName()));
    this.render(Date.now());
  }
  // The other user typed or moved the text cursor.
  onInput(now) {
    this.sectionProperties.lastInput = now;
    if (this.sectionProperties.requestTime !== null) {
      this.sectionProperties.requestTime = null;
      _ShapeLockLabelSection.showMessage(_("%1 started typing again, so nothing changes.").replace("%1", this.getName()));
    }
    this.render(now);
  }
  // Follow the colored border around the shape. Before the border arrives, or when it is on another
  // part, the label follows the area of the text instead.
  updatePosition() {
    const border = OtherViewGraphicSelectionSection.getViewSection(this.sectionProperties.viewId);
    let x, y, width, height;
    if (border && border.size[0] > 0 && border.size[1] > 0 && border.sectionProperties.part === this.sectionProperties.part) {
      [x, y] = border.position;
      [width, height] = border.size;
    } else {
      const rectangle = this.sectionProperties.lockRectangle;
      [x, y, width, height] = [
        rectangle.pX1,
        rectangle.pY1,
        rectangle.pWidth,
        rectangle.pHeight
      ];
    }
    this.size = [width, height];
    this.setPosition(x, y);
    this.setShowSection(this.checkMyVisibility());
  }
  // The name of the user of the given view.
  static getName(viewId) {
    return app.map.getViewName(viewId) || "";
  }
  // The picture of the user of the given view, or the initials of the name when the user has no
  // picture. The ring around it has the color of the user.
  static createAvatar(viewId) {
    const username = _ShapeLockLabelSection.getName(viewId);
    const avatar = h("span", { class: "shape-lock-avatar", "aria-hidden": "true", title: username });
    avatar.style.borderColor = app.LOUtil.rgbToHex(app.LOUtil.getViewIdColor(viewId));
    const viewInfo = app.map._viewInfo[viewId];
    if (viewInfo && viewInfo.userextrainfo && viewInfo.userextrainfo.avatar) {
      const image = h("img", { alt: "" });
      app.LOUtil.setUserImage(image, app.map, viewId);
      avatar.appendChild(image);
    } else {
      const words = username.split(/\s+/).filter((word) => word.length > 0);
      const initials = words.filter((word, index) => index === 0 || index === words.length - 1).map((word) => Array.from(word)[0]).join("");
      avatar.textContent = initials.toUpperCase();
    }
    return avatar;
  }
  // The bar fills up from empty over the given time, in milliseconds. It grows by a transform, so
  // the page does no layout while it fills.
  static fillProgress(bar, duration) {
    bar.getAnimations().forEach((animation) => animation.cancel());
    bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration,
      easing: "linear",
      fill: "forwards"
    });
  }
  // The snackbar shows one message after another, so a message of this label that still shows goes
  // away first. When it is the same message, it stays as it is. A timeout of -1 keeps the message
  // until the user closes it with Dismiss.
  static showMessage(text, timeout = _ShapeLockLabelSection.messageTime) {
    const uiManager = app.map.uiManager;
    if (text === _ShapeLockLabelSection.messageText && uiManager.hasSnackbar(text))
      return;
    _ShapeLockLabelSection.closeMessage();
    _ShapeLockLabelSection.messageText = text;
    uiManager.showSnackbar(text, null, null, timeout, false, timeout < 0);
  }
  static closeMessage() {
    if (_ShapeLockLabelSection.messageText !== null)
      app.map.uiManager.closeSnackbarWithLabel(_ShapeLockLabelSection.messageText);
    _ShapeLockLabelSection.messageText = null;
  }
  static tick() {
    const now = Date.now();
    _ShapeLockLabelSection.sections.forEach((section) => section.onTick(now));
  }
  // Keep the shape of the given view locked, or unlock it when rectangle is null. The rectangle is
  // the area of the text in twips, part is the part identifier of the part that holds the shape,
  // and objectId is the unique id of the shape. existing is true when the shape was already locked
  // as this user joined, so how long the other user has not typed is not known.
  static setLock(viewId, rectangle, part, mode, objectId = "", existing = false) {
    let section = _ShapeLockLabelSection.sections.get(viewId);
    if (!rectangle) {
      if (section) {
        if (section.sectionProperties.requestTime !== null)
          _ShapeLockLabelSection.closeMessage();
        _ShapeLockLabelSection.sections.delete(viewId);
        app.sectionContainer.removeSection(section.name);
        app.sectionContainer.requestReDraw();
      }
      if (_ShapeLockLabelSection.sections.size === 0) {
        app.timerRegistry.clearInterval(_ShapeLockLabelSection.tickTimer);
        _ShapeLockLabelSection.tickTimer = null;
      }
      _ShapeLockLabelSection.onUnlock(viewId);
      return;
    }
    if (!section) {
      section = new _ShapeLockLabelSection(viewId);
      if (existing)
        section.sectionProperties.lastInput = Date.now() - _ShapeLockLabelSection.activeAfter;
      app.sectionContainer.addSection(section);
      _ShapeLockLabelSection.sections.set(viewId, section);
      if (!_ShapeLockLabelSection.tickTimer)
        _ShapeLockLabelSection.tickTimer = app.timerRegistry.setInterval("shapelocklabel", _ShapeLockLabelSection.tick, 250);
    }
    section.sectionProperties.lockRectangle = rectangle;
    section.sectionProperties.objectId = objectId;
    section.sectionProperties.part = part;
    section.sectionProperties.mode = mode;
    section.updatePosition();
    section.render(Date.now());
    app.sectionContainer.requestReDraw();
  }
  // A view that took the text over from this user left it. This user learns about the changes of
  // that view once that view can no longer give the text back. This user may have been away, so the
  // message stays until this user closes it.
  static onUnlock(viewId) {
    const takeOver = _ShapeLockLabelSection.takeOvers.get(viewId);
    if (!takeOver || takeOver.canGiveBack)
      return;
    _ShapeLockLabelSection.takeOvers.delete(viewId);
    if (takeOver.hasInput)
      _ShapeLockLabelSection.showMessage(_("%1 made changes.").replace("%1", _ShapeLockLabelSection.getName(viewId)), -1);
  }
  // The given view took the text that this user edited. Without a request before, that view can
  // give the text back for a short time, so this user learns about it after that time. A view that
  // typed into the text and left it by then is told about as one that made changes. This user may
  // have been away, so the message stays until this user closes it.
  static onTakenOver(viewId) {
    const wasAsked = ShapeLockCalloutSection.takeRequestOf(viewId);
    ShapeLockCalloutSection.close();
    const takeOver = {
      canGiveBack: !wasAsked,
      hasInput: false
    };
    _ShapeLockLabelSection.takeOvers.set(viewId, takeOver);
    const tellTakeOver = () => {
      if (_ShapeLockLabelSection.takeOvers.get(viewId) !== takeOver)
        return;
      takeOver.canGiveBack = false;
      const isEditing = _ShapeLockLabelSection.sections.has(viewId);
      if (isEditing || !takeOver.hasInput)
        _ShapeLockLabelSection.showMessage(_("%1 has taken over editing. Your changes were saved.").replace("%1", _ShapeLockLabelSection.getName(viewId)), -1);
      if (!isEditing)
        _ShapeLockLabelSection.onUnlock(viewId);
    };
    if (wasAsked)
      tellTakeOver();
    else
      app.timerRegistry.setTimeout("shapelocktakeover", tellTakeOver, _ShapeLockLabelSection.undoTime);
  }
  // A message from the engine about the text of a shape that this user and the given view both
  // want. The reasons are those of the .uno:TextEditLocked state change.
  static onTextEditLocked(viewId, reason) {
    const section = _ShapeLockLabelSection.sections.get(viewId);
    switch (reason) {
      case "refused":
        if (section)
          section.onRefused();
        break;
      case "rejected":
        if (section)
          section.onRejected();
        break;
      case "takenover":
        _ShapeLockLabelSection.onTakenOver(viewId);
        break;
      case "requested":
        ShapeLockCalloutSection.showRequest(viewId);
        break;
      case "returned":
        _ShapeLockLabelSection.takeOvers.delete(viewId);
        break;
    }
  }
  // The text cursor of the given view is at the given place, in twips. A cursor that moved means
  // that the user of that view typed or moved it.
  static onViewCursor(viewId, rectangle) {
    if (!rectangle || rectangle.length !== 4 || rectangle.some((value) => isNaN(value)))
      return;
    const place = rectangle.join(",");
    const lastPlace = _ShapeLockLabelSection.cursors.get(viewId);
    _ShapeLockLabelSection.cursors.set(viewId, place);
    if (lastPlace === void 0 || lastPlace === place)
      return;
    const takeOver = _ShapeLockLabelSection.takeOvers.get(viewId);
    if (takeOver)
      takeOver.hasInput = true;
    const section = _ShapeLockLabelSection.sections.get(viewId);
    if (section)
      section.onInput(Date.now());
  }
  // Move the label of the given view after its border moved.
  static update(viewId) {
    const section = _ShapeLockLabelSection.sections.get(viewId);
    if (section)
      section.updatePosition();
  }
  // Show only the labels on the part and in the mode shown now.
  static updateVisibilities() {
    _ShapeLockLabelSection.sections.forEach((section) => {
      section.setShowSection(section.checkMyVisibility());
    });
  }
  static removeView(viewId) {
    _ShapeLockLabelSection.takeOvers.delete(viewId);
    _ShapeLockLabelSection.cursors.delete(viewId);
    _ShapeLockLabelSection.setLock(viewId, null, "", 0);
    ShapeLockCalloutSection.closeIfFrom(viewId);
  }
};
_ShapeLockLabelSection.namePrefix = "ShapeLockLabel ";
_ShapeLockLabelSection.sections = /* @__PURE__ */ new Map();
_ShapeLockLabelSection.activeAfter = 1e4;
_ShapeLockLabelSection.inactiveAfter = 6e4;
_ShapeLockLabelSection.approvalTime = 2e4;
_ShapeLockLabelSection.approvalMargin = 5e3;
_ShapeLockLabelSection.undoTime = 5e3;
_ShapeLockLabelSection.messageTime = 6e3;
_ShapeLockLabelSection.cursors = /* @__PURE__ */ new Map();
_ShapeLockLabelSection.takeOvers = /* @__PURE__ */ new Map();
_ShapeLockLabelSection.messageText = null;
_ShapeLockLabelSection.tickTimer = null;
let ShapeLockLabelSection = _ShapeLockLabelSection;
app.definitions.shapeLockLabelSection = ShapeLockLabelSection;
