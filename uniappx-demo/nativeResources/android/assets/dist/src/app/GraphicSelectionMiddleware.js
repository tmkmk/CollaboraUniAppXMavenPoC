const _GraphicSelection = class _GraphicSelection {
  /*
      Ends being active in place here, ahead of the engine's report of it: the frame and the
      state go, so the press that left the object can select and carry another one at once.
      The engine ends it as soon as it is asked for another selection.
  */
  static leaveInPlace() {
    app.map._docLayer._oleCSelections.clear();
    this.darkOverlayRectangle = null;
    this.inPlaceActive = false;
    this.inPlaceArea = null;
    this.inPlaceMath = false;
    this.inPlaceCalc = false;
    this.inPlaceObject = void 0;
    this.leftInPlace = void 0;
    this.pressedOutside = void 0;
    this.showInPlaceNotebookbar();
  }
  /// The notebookbar is the one of a spreadsheet while a spreadsheet is active in place, and the
  /// one of the document otherwise.
  static showInPlaceNotebookbar() {
    var _a;
    (_a = app.map.uiManager) == null ? void 0 : _a.showInPlaceNotebookbar(this.inPlaceCalc ? "spreadsheet" : null);
  }
  /*
      Whether anything is selected. While the document is drawn from objects that is what the
      ids say, and the rectangle the engine sends is not needed for it; otherwise it is the
      rectangle, since that is all there is.
  */
  static hasActiveSelection() {
    if (RenderManager.drawsFromObjects())
      return this.selectedObjectIDs.length > 0;
    return this.rectangle !== null;
  }
  /// The one selected object, or nothing where none or several are selected.
  static theOneSelected() {
    return this.selectedObjectIDs.length === 1 ? RenderGeometrySection.objectOf(this.selectedObjectIDs[0]) : void 0;
  }
  /// The file name ending of the picture what is selected holds, or nothing where it holds
  /// none. Asked the same two ways.
  static graphicExtension() {
    var _a, _b;
    if (RenderManager.drawsFromObjects())
      return ((_a = this.theOneSelected()) == null ? void 0 : _a.graphicExtension) || void 0;
    return ((_b = this.extraInfo) == null ? void 0 : _b.graphicExtension) || void 0;
  }
  /// Whether the crop switch is the client's to take: it is while the client draws the
  /// selection itself.
  static takesTheCropSwitch() {
    return RenderManager.drawsFromObjects();
  }
  static toggleCropping() {
    var _a, _b, _c;
    this.cropping = !this.cropping;
    app.map.fire("commandstatechanged", {
      commandName: ".uno:Crop",
      state: this.cropping ? "true" : "false"
    });
    (_a = this.travel()) == null ? void 0 : _a.leave();
    (_b = this.selectionSection) == null ? void 0 : _b.refresh();
    (_c = app.sectionContainer) == null ? void 0 : _c.requestReDraw();
  }
  /// Whether the document is being signed, in which case what is selected may be moved and
  /// resized although the document is read-only. Asked the same two ways.
  static isBeingSigned() {
    var _a, _b;
    if (RenderManager.drawsFromObjects())
      return ((_a = this.theOneSelected()) == null ? void 0 : _a.signing) === true;
    return ((_b = this.extraInfo) == null ? void 0 : _b.isSignature) === true;
  }
  // The part of the preview the current graphic selection covers on the overview page,
  // or -1 when the selection is not a slide preview. A preview is recognised by its
  // rectangle: it matches one of the preview grid rectangles within a small tolerance.
  static coveredPreviewPart() {
    if (app.map._docLayer._docType !== "presentation" || !app.impress.hasOverviewPage || app.map._docLayer._selectedPart !== 0 || app.impress.previewEditMode.active || !app.impress.previewRects || !this.rectangle)
      return -1;
    const tolerance = 50;
    for (const preview of app.impress.previewRects) {
      const rect = preview.rectangle;
      if (Math.abs(rect.x1 - this.rectangle.x1) <= tolerance && Math.abs(rect.y1 - this.rectangle.y1) <= tolerance && Math.abs(rect.width - this.rectangle.width) <= tolerance && Math.abs(rect.height - this.rectangle.height) <= tolerance)
        return preview.part;
    }
    return -1;
  }
  static setSelectedPreviewPart(part) {
    if (app.impress.selectedPreviewPart === part)
      return;
    app.impress.selectedPreviewPart = part;
    app.sectionContainer.requestReDraw();
  }
  static onUpdatePermission() {
    this.rectangle = null;
    this.updateGraphicSelection();
  }
  /// Takes the engine's next report of the selection as it comes.
  static takeTheNextReportAsItIs() {
    this.nextReportAsItIs = true;
  }
  /*
      Whether the state of that command is given here, so the engine's is left aside. One the
      engine sends before or after the view draws from the objects reaches the widgets, and what
      was given here for it last is forgotten, so the next state given here is told whatever it
      is.
  */
  static givesTheState(commandName) {
    if (!Interaction.statesGivenHere.includes(commandName))
      return false;
    if (RenderManager.drawsFromObjects())
      return true;
    delete _GraphicSelection.statesGiven[commandName];
    return false;
  }
  /// Whether one object is selected and its path can be edited point by point, so it needs no
  /// conversion first.
  static isOnePath() {
    return PolyPolygonEditor.editedPath(this.selectedObjectIDs) !== void 0;
  }
  /// Records which of the two buttons the Shape tab was built with: Edit Points when onePath is
  /// true, and the convert button otherwise.
  static pathButtonsBuiltFor(onePath) {
    this.onePathToldAs = onePath;
  }
  /*
      The Edit Points button and the convert button share one place on the Shape tab. Shows
      Edit Points when the selection is one path, and the convert button otherwise. Also tells
      whether the path is closed, as the state of a command.
  */
  static tellThePathButtons() {
    var _a;
    const path = PolyPolygonEditor.editedPath(this.selectedObjectIDs);
    const onePath = path !== void 0;
    const notebookbar = (_a = app.map.uiManager) == null ? void 0 : _a.notebookbar;
    if (onePath !== this.onePathToldAs && notebookbar && cool.VectorRenderingConfig.isEnabled()) {
      this.onePathToldAs = onePath;
      const shown = onePath ? "shape-edit-points" : "shape-convert-editable";
      if (app.map.uiManager.isButtonVisible(shown))
        notebookbar.showItem(shown);
      notebookbar.hideItem(onePath ? "shape-convert-editable" : "shape-edit-points");
    }
    const closed = PolyPolygonEditor.isClosed(path);
    if (closed !== this.closedToldAs) {
      this.closedToldAs = closed;
      app.map.fire("commandstatechanged", {
        commandName: this.closedPathCommand,
        state: closed ? "true" : "false"
      });
    }
  }
  /*
      Tells the states this view gives itself, as the engine tells a state: to the client's
      widgets, and to the application around it where there is one. Only a state that changed
      is told.
  */
  static tellTheStates() {
    var _a;
    if (!RenderManager.drawsFromObjects())
      return;
    if (this.selectedObjectIDs.some((objectId) => !RenderGeometrySection.objectOf(objectId)))
      return;
    this.tellThePathButtons();
    const states = Interaction.context().commandStates();
    for (const commandName of Interaction.statesGivenHere) {
      const state = states[commandName] ? "enabled" : "disabled";
      if (_GraphicSelection.statesGiven[commandName] === state)
        continue;
      _GraphicSelection.statesGiven[commandName] = state;
      const json = { commandName, state };
      app.map.fire("commandstatechanged", json);
      const host = window;
      if (host.ThisIsTheMacOSApp || host.ThisIsTheQtApp || host.ThisIsTheWindowsApp)
        (_a = host.postMobileMessage) == null ? void 0 : _a.call(host, "COMMANDSTATECHANGED " + JSON.stringify(json));
    }
  }
  /*
      Runs a command whose meaning a view that draws from the objects gives itself: entering and
      leaving a group, which are the context's, as Enter, F3 and Ctrl+F3 are, and taking apart
      what is selected, which in a diagram is the diagram. Answers whether it was run here; one
      that is not goes to the engine.
  */
  static takesTheCommand(command) {
    if (!RenderManager.drawsFromObjects())
      return false;
    if (command === ".uno:EnterGroup")
      return Interaction.context().enterKey();
    if (command === ".uno:LeaveGroup")
      return Interaction.context().leaveKey();
    if (command === ".uno:FormatUngroup")
      return Interaction.context().ungroup();
    return false;
  }
  /*
      Marks the drawing objects with the given unique ids, and nothing else. The engine is told
      which objects they are rather than where the click was, so what the client hit and what the
      engine marks are one thing. An empty list asks for no selection at all.
  */
  static selectObjects(objectIds) {
    this.selectedObjectIDs = objectIds.slice();
    this.announceSelection();
    SelectionSection.selectedHere(objectIds);
    this.rememberWhereItStands(objectIds);
    if (!objectIds.length)
      this.stoodAt = null;
    if (RenderManager.drawsFromObjects())
      this.noteTheAsk(objectIds);
    app.socket.sendMessage("selectobjects ids=" + objectIds.join(","));
    this.tellTheStates();
  }
  /// Says which objects the selection has now, by their unique ids, once for each change
  static announceSelection() {
    if (this.sameObjects(this.announcedObjectIDs, this.selectedObjectIDs))
      return;
    this.announcedObjectIDs = this.selectedObjectIDs.slice();
    app.events.fire("graphicselectionchanged", {
      objectIds: this.selectedObjectIDs.slice()
    });
  }
  /// Whether the two lists name the same objects in the same order.
  static sameObjects(one, other) {
    return one.length === other.length && one.every((objectId, index) => objectId === other[index]);
  }
  /// Notes a selection asked of the engine, behind the ones asked before it. The same one asked
  /// again in a row is noted once, as the engine reports it once.
  static noteTheAsk(objectIds) {
    const last = this.askedFor[this.askedFor.length - 1];
    if (last && this.sameObjects(last, objectIds))
      return;
    this.askedFor.push(objectIds.slice());
    if (this.askedFor.length > this.mostAsked)
      this.askedFor.shift();
  }
  /*
      Whether a report of the engine names a selection the client asked for before the last one it
      asked for. The engine takes what it is sent in order, so such a report tells where it stood
      before it came to the newer ones, whose reports follow, and it is left aside. The asks before
      the one a report names are done with; a report that names none of them is a selection made
      elsewhere, by an undo, a command or another user, and leaves none waiting.
  */
  static outdatedReport(objectIds) {
    if (!RenderManager.drawsFromObjects())
      return false;
    const at = this.askedFor.findIndex((asked) => this.sameObjects(asked, objectIds));
    if (at < 0) {
      this.askedFor = [];
      return false;
    }
    this.askedFor.splice(0, at);
    return this.askedFor.length > 1;
  }
  /// Notes where a selection with something in it stands, in a view that draws from objects.
  static rememberWhereItStands(objectIds) {
    if (!objectIds.length || !RenderManager.drawsFromObjects())
      return;
    this.stoodAt = {
      selected: objectIds.slice(),
      groupsAbove: Interaction.groupsAbove(objectIds),
      place: Interaction.placeOf(objectIds)
    };
    if (this.followingDeletions)
      return;
    this.followingDeletions = true;
    RenderManager.onVectorChanged(() => {
      _GraphicSelection.followDeletions();
      _GraphicSelection.followTheTextEdit();
    });
  }
  /*
      Puts the selection right where objects it stood on were deleted, by this view or another:
      the context it stood in says what to take instead. Where nothing it stood on is gone, the
      selection stands as the engine reports it.
  */
  static followDeletions() {
    const stoodAt = this.stoodAt;
    if (!stoodAt || !RenderManager.drawsFromObjects())
      return;
    if (!RenderGeometrySection.currentPart())
      return;
    const gone = stoodAt.selected.some((objectId) => RenderGeometrySection.objectOf(objectId) === void 0);
    if (!gone) {
      if (!this.selectedObjectIDs.length)
        this.stoodAt = null;
      return;
    }
    const wanted = Interaction.contextAt(stoodAt.place).whatIsLeft(stoodAt.selected, stoodAt.groupsAbove);
    const same = wanted.length === this.selectedObjectIDs.length && wanted.every((objectId, index) => objectId === this.selectedObjectIDs[index]);
    if (same) {
      if (wanted.length)
        this.rememberWhereItStands(wanted);
      else
        this.stoodAt = null;
      return;
    }
    this.selectAndShow(wanted);
  }
  /// The engine was asked to enter the selected group; the context says what is selected then.
  static takeTheFirstOfTheGroup() {
    if (!RenderManager.drawsFromObjects())
      return;
    Interaction.context().groupEntered();
  }
  /*
      Takes up the selection the engine reports and says whether it is another one than the
      client holds. It is the same one whenever the client asked for it, since the answer names
      the objects it named itself.
  */
  static selectionChanged(objectIds) {
    var _a;
    const changed = objectIds.length !== this.selectedObjectIDs.length || objectIds.some((objectId, index) => objectId !== this.selectedObjectIDs[index]);
    if (changed)
      (_a = _GraphicSelection.travel()) == null ? void 0 : _a.leave();
    this.selectedObjectIDs = objectIds.slice();
    this.announceSelection();
    this.selectionCameFromElsewhere = changed;
    this.rememberWhereItStands(objectIds);
    this.tellTheStates();
    const asItIs = this.nextReportAsItIs;
    this.nextReportAsItIs = false;
    if (RenderManager.drawsFromObjects() && !asItIs) {
      const wanted = Interaction.context().enteredBy(objectIds);
      if (wanted.length !== objectIds.length || wanted.some((objectId, index) => objectId !== objectIds[index]))
        this.selectObjects(wanted);
    }
    return changed;
  }
  /// The objects the engine says are selected, in the order it marked them.
  static selectedObjectIDsOf(extraInfo) {
    const objectIds = extraInfo == null ? void 0 : extraInfo.uniqueIds;
    return Array.isArray(objectIds) ? objectIds : [];
  }
  /*
      The boxes of the other objects of the page, in pixels, for a drag to snap to. While the
      document is drawn from objects the client works them out from what it holds; otherwise they
      are the ones the engine sends along with the selection. What is being dragged is left out,
      since a drag does not snap to itself.
  */
  static snapRectangles() {
    var _a;
    if (RenderManager.drawsFromObjects()) {
      const scale = app.twipsToPixels;
      const rectangles2 = [];
      RenderGeometrySection.objectBoxes().forEach((box, objectId) => {
        if (this.selectedObjectIDs.includes(objectId))
          return;
        rectangles2.push(box.map((value) => value * scale));
      });
      return rectangles2;
    }
    const rectangles = (_a = this.extraInfo) == null ? void 0 : _a.ObjectRectangles;
    if (!Array.isArray(rectangles))
      return [];
    const ordNum = this.extraInfo.OrdNum;
    return rectangles.filter((rectangle) => rectangle[4] !== ordNum);
  }
  /*
      Works the handles out again from the objects as they stand now. The engine reports a
      selection as soon as it changes, while the objects it stands on arrive with the update
      that follows, so the handles of a shape that was just dragged are worked out once more when
      that update lands. Without it they would show where the shape was before.
  */
  static refreshLocalHandles() {
    var _a;
    (_a = this.selectionSection) == null ? void 0 : _a.refresh();
    this.updateGroupButtons();
    this.followThePlayer();
    this.tellTheStates();
  }
  /*
      Takes in that the engine answered something for that object which was not predicted here
      - or, given no object, that anything may have changed. Where it touches the selection, the
      selection's square is dropped, so that the handles are laid on what is really there. Where
      it is one of the selected objects, changed by something other than this view, such as an
      undo, the selection is brought on screen as it now stands.
  */
  static unpredictedAnswer(objectId) {
    const section = this.selectionSection;
    if (!section)
      return;
    section.theEngineAnswered(objectId);
    if (objectId === void 0 || RenderGeometrySection.theOnesAChangeTouches(section.selectedObjects()).includes(objectId))
      section.forgetTheSquare();
    if (objectId !== void 0 && !section.isDragged() && RenderGeometrySection.theOnesThatDraw(RenderGeometrySection.standingFor(section.selectedObjects())).includes(objectId))
      _GraphicSelection.showTheObjects(this.selectedObjectIDs);
  }
  /// The keyboard on the handles of what is selected, where the client holds them itself.
  static travel() {
    var _a;
    return (_a = _GraphicSelection.selectionSection) == null ? void 0 : _a.travel;
  }
  /// Keeps the key to be handled once the undos and redos on their way are in.
  static holdTheKeyBack(event) {
    if (!this.followingTheKeysHeldBack) {
      this.followingTheKeysHeldBack = true;
      document.addEventListener("keyup", (up) => {
        if (_GraphicSelection.keysHeldBack.length)
          _GraphicSelection.keysHeldBack.push(up.code || up.key);
      }, true);
    }
    this.keysHeldBack.push(event);
    if (this.keysHeldBack.length === 1)
      ChangeOutbox.whenTheUndosAreIn(() => _GraphicSelection.handleTheKeysHeldBack());
  }
  /*
      Handles the keys held back on the objects as the undos left them, each press and each
      release in the order they happened, so what each press made goes out as it does after any
      key, as one step of the undo.
  */
  static handleTheKeysHeldBack() {
    const keys = this.keysHeldBack;
    this.keysHeldBack = [];
    for (const key of keys)
      if (typeof key === "string")
        ChangeOutbox.keyIsUp(key);
      else
        this.handleKeyboard(key);
  }
  /// Whether the key changes the objects selected or a handle of them: an arrow, with or without
  /// modifiers, or 0, which takes a turn or a slant away.
  static changesTheObjects(event) {
    if (_GraphicSelection.theWayOf[event.key])
      return true;
    return event.code === "Digit0" || event.code === "Numpad0";
  }
  /*
      What the keyboard does to what is selected, while the client draws the selection itself.
      A handle takes the key first, where the keyboard is on one. An arrow key with the
      keyboard on no handle moves the objects, and that is done here and sent as the one change
      it is, never as a key: the engine would move them by a pixel of its own view, which is
      not the pixel seen here and depends on the zoom, and it asks only the objects that are
      marked, not the ones they hold, so it would move a group whose member is held fast.
  */
  static handleKeyboard(event) {
    var _a, _b, _c;
    if (event.key === "Escape" && FreeformLineSection.drop())
      return true;
    if (this.textIsBeingEdited())
      return false;
    if (!this.hasActiveSelection()) {
      if (!RenderManager.isVectorRendering())
        return false;
      const way = _GraphicSelection.theWayOf[event.key];
      if (way) {
        return Interaction.context().arrowKey(new cool.Point(way[0], way[1]), event);
      }
      return this.travelByKey(event);
    }
    if ((_a = this.selectionSection) == null ? void 0 : _a.isDragged())
      return event.key !== "Escape";
    if (event.key === "Escape" && SelectionSection.stopAddingAPoint())
      return true;
    if ((event.key === "Delete" || event.key === "Backspace") && !event.ctrlKey && !event.altKey && !event.metaKey && ((_b = this.selectionSection) == null ? void 0 : _b.deleteThePointByKey()))
      return true;
    if (ChangeOutbox.undoOnItsWay() && this.changesTheObjects(event)) {
      this.holdTheKeyBack(event);
      (_c = this.selectionSection) == null ? void 0 : _c.showTheHoldBack();
      return true;
    }
    return ChangeOutbox.byAKey(event, () => {
      var _a2, _b2;
      if ((_a2 = _GraphicSelection.travel()) == null ? void 0 : _a2.keyboard(event))
        return true;
      if (!RenderManager.drawsFromObjects())
        return false;
      if (event.key === "Escape")
        return Interaction.context().escape();
      if (this.travelByKey(event))
        return true;
      if ((_b2 = this.selectionSection) == null ? void 0 : _b2.resetByKey(event))
        return true;
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey)
        return Interaction.context().enterKey();
      const way = _GraphicSelection.theWayOf[event.key];
      if (!way)
        return false;
      return Interaction.context().arrowKey(new cool.Point(way[0], way[1]), event);
    });
  }
  /*
      The keys that go from object to object and in and out of groups: Tab and Shift+Tab,
      Ctrl+Home and Ctrl+End, F3 and Ctrl+F3. Answers whether the context used the key.
  */
  static travelByKey(event) {
    const context = Interaction.context();
    const ctrl = event.ctrlKey || event.metaKey;
    if (event.key === "Tab" && !ctrl && !event.altKey)
      return context.tabKey(!event.shiftKey);
    if ((event.key === "Home" || event.key === "End") && ctrl && !event.shiftKey)
      return context.toAnEnd(event.key === "Home");
    if (event.key === "F3" && !event.shiftKey && !event.altKey)
      return ctrl ? context.leaveKey() : context.enterKey();
    return false;
  }
  /*
      Whether this view is editing text: the text cursor shows, or, in a view that draws from the
      objects, the page holds a text edit entry of this view.
  */
  static textIsBeingEdited() {
    if (app.file.textCursor.visible)
      return true;
    return this.objectUnderTextEdit() !== void 0;
  }
  /// The object this view edits the text of, in a view that draws from the objects: the one its
  /// text edit entry belongs to. Nothing while it edits none.
  static objectUnderTextEdit() {
    var _a, _b;
    if (!RenderManager.drawsFromObjects())
      return void 0;
    const data = RenderGeometrySection.currentPart();
    const ownViewId = (_b = (_a = app.map) == null ? void 0 : _a._docLayer) == null ? void 0 : _b._viewId;
    if (!data || ownViewId === void 0)
      return void 0;
    for (const object of data.objects.values())
      if (object.kind === "texteditoverlay" && object.viewId === ownViewId)
        return object.parent;
    return void 0;
  }
  /*
      Takes the object this view edits the text of as the selection, where the edit moved on to
      another one: a press during a text edit goes to the engine, which in a diagram edits the
      object pressed without marking anything new, so no report says so. The engine works on that
      object already, and is not told again, which would end the edit.
  */
  static followTheTextEdit() {
    const edited = this.objectUnderTextEdit();
    if (!edited || this.selectedObjectIDs.includes(edited))
      return;
    if (!RenderGeometrySection.objectOf(edited))
      return;
    this.selectedObjectIDs = [edited];
    this.rememberWhereItStands([edited]);
    this.updateSelectionSection();
    this.tellTheStates();
  }
  /*
      The view switched between drawing from tiles and drawing from the objects. The selection
      ends, the engine's included, with all that shows it: the handles drawn from the engine's
      message, the section that draws it, the button of a diagram and the buttons beside the
      bands.
  */
  static drawingSwitched() {
    if (this.handlesSection) {
      this.handlesSection.removeSubSections();
      app.sectionContainer.removeSection(this.handlesSection.name);
      this.handlesSection = null;
    }
    if (this.diagramButton) {
      app.sectionContainer.removeSection(this.diagramButton.name);
      this.diagramButton = null;
    }
    this.rectangle = null;
    this.selectObjects([]);
    this.updateSelectionSection();
    this.updateGroupButtons();
  }
  /*
      Makes the section that draws what is selected, or takes it away again. A single object
      has a section of its own, which knows the object by its id; several of them are held
      together by one section that frames them all.
  */
  static updateSelectionSection() {
    this.makeSelectionSection();
    this.updateGroupButtons();
  }
  /*
      Makes the columns of buttons beside the bands of groups and diagrams match the selection:
      which there are, whether each may be pressed, and where it stands now. A column runs down
      from the top of its band and no further than the band's bottom, so the buttons that do not
      fit are left out from the bottom up. A view that draws from the tiles has none.
  */
  static updateGroupButtons() {
    const wanted = /* @__PURE__ */ new Map();
    const section = this.selectionSection;
    if (RenderManager.drawsFromObjects() && section) {
      for (const objectId of section.bandsWithButtons()) {
        const band = section.bandBox(objectId);
        if (!band)
          continue;
        const room = band.height + HandleLook.reachOfASurround() + GroupButtonSection.spaceBetween * app.dpiScale;
        const fit = Math.floor(room / GroupButtonSection.step());
        _GraphicSelection.buttonsBeside(objectId).slice(0, fit).forEach((role, slot) => wanted.set(GroupButtonSection.nameFor(objectId, role), {
          objectId,
          role,
          slot
        }));
      }
    }
    for (const [name, button] of this.groupButtons)
      if (!wanted.has(name)) {
        app.sectionContainer.removeSection(button.name);
        this.groupButtons.delete(name);
      }
    for (const [name, one] of wanted) {
      let button = this.groupButtons.get(name);
      if (!button) {
        button = new GroupButtonSection(one.objectId, one.role, one.slot);
        app.sectionContainer.addSection(button);
        this.groupButtons.set(name, button);
      }
      button.standAt(one.slot, _GraphicSelection.groupButtonIsOn(one.objectId, one.role));
    }
  }
  /// Moves the buttons beside the bands to where their bands are now.
  static followTheGroupButtons() {
    for (const button of this.groupButtons.values())
      button.follow();
  }
  /*
      The buttons beside the band of that group or diagram, from the top down. A diagram takes
      the one that opens it and Ungroup. A group takes Enter, Leave and Ungroup, and the one
      that opens a diagram above them where it holds a diagram at any depth, so that its column
      keeps one shape however the selection moves inside it.
  */
  static buttonsBeside(objectId) {
    var _a;
    if ((_a = RenderGeometrySection.objectOf(objectId)) == null ? void 0 : _a.isDiagram)
      return ["diagram", "ungroup"];
    const roles = ["enter", "leave", "ungroup"];
    return _GraphicSelection.holdsADiagram(objectId) ? ["diagram", ...roles] : roles;
  }
  /// Whether that group holds a diagram at any depth.
  static holdsADiagram(objectId, depth = 0) {
    return RenderGeometrySection.heldBy(objectId).some((held) => {
      var _a;
      return ((_a = RenderGeometrySection.objectOf(held)) == null ? void 0 : _a.isDiagram) === true || depth < 100 && _GraphicSelection.holdsADiagram(held, depth + 1);
    });
  }
  /*
      Whether a button beside the band of that group or diagram may be pressed. Where that one is
      selected itself, alone or among others, the buttons act on it: Ungroup, Enter for a group
      and the one that opens a diagram for a diagram. Where the selection sits inside it, they
      act on the selection as the menu does, with the menu's states, and the one that opens a
      diagram where the selection stands in a diagram.
  */
  static groupButtonIsOn(objectId, role) {
    var _a;
    const selected = this.selectedObjectIDs;
    if (selected.includes(objectId)) {
      const aDiagram = ((_a = RenderGeometrySection.objectOf(objectId)) == null ? void 0 : _a.isDiagram) === true;
      if (role === "ungroup")
        return true;
      return role === "diagram" ? aDiagram : role === "enter" && !aDiagram;
    }
    switch (role) {
      case "diagram":
        return Interaction.placeOf(selected).kind === "diagram";
      case "enter":
        return Interaction.context().commandStates()[".uno:EnterGroup"] === true;
      case "leave":
        return Interaction.context().commandStates()[".uno:LeaveGroup"] === true;
      case "ungroup":
        return Interaction.context().commandStates()[".uno:FormatUngroup"] === true;
    }
  }
  /*
      A press on a button beside the band of that group or diagram. Where that one is selected
      itself, the press acts on it alone: it is selected on its own and opened, entered or taken
      apart, and taking it apart leaves the others selected. Where the selection sits inside it,
      the press is the menu's command for the selection.
  */
  static pressTheGroupButton(objectId, role) {
    const itself = this.selectedObjectIDs.includes(objectId);
    switch (role) {
      case "diagram":
        if (itself) {
          this.selectObjects(Interaction.context().enteredBy([objectId]));
          this.updateSelectionSection();
        }
        app.map.sendUnoCommand(".uno:EditDiagram");
        return;
      case "enter":
        if (!itself) {
          app.map.sendUnoCommand(".uno:EnterGroup");
          return;
        }
        this.selectObjects([objectId]);
        Interaction.context().enterKey();
        return;
      case "leave":
        app.map.sendUnoCommand(".uno:LeaveGroup");
        return;
      case "ungroup":
        if (itself)
          this.takeApart(objectId);
        else
          app.map.sendUnoCommand(".uno:FormatUngroup");
        return;
    }
  }
  /*
      Takes that group or diagram apart on its own. The engine is named the object itself first,
      which for a diagram is no place for the client to stand in, so the client's selection
      stays as it is until the engine reports what taking it apart left selected.
  */
  static takeApart(objectId) {
    this.takeTheNextReportAsItIs();
    app.socket.sendMessage("selectobjects ids=" + String(objectId));
    app.socket.sendMessage("uno .uno:FormatUngroup");
  }
  static makeSelectionSection() {
    const objectIds = this.selectedObjectIDs;
    const several = objectIds.length > 1;
    const place = Interaction.placeOf(objectIds);
    const wanted = RenderManager.drawsFromObjects() && objectIds.length && (place.kind !== "inPlace" || objectIds.length === 1 && objectIds[0] !== place.object) ? several ? MultiSelectionSection.sectionName : ObjectSelectionSection.nameFor(objectIds[0]) : null;
    if (this.selectionSection && this.selectionSection.name !== wanted) {
      app.sectionContainer.removeSection(this.selectionSection.name);
      this.selectionSection = null;
      RenderManager.drawnElsewhere([]);
      this.dropThePlayer();
      SelectionSection.hideTheTiePoints();
      SelectionSection.hideThePathPoints();
    }
    if (wanted === null)
      return;
    if (!this.selectionSection) {
      this.selectionSection = several ? new MultiSelectionSection(objectIds) : new ObjectSelectionSection(objectIds[0]);
      app.sectionContainer.addSection(this.selectionSection);
      this.selectionSection.refresh();
      return;
    }
    if (several)
      this.selectionSection.setObjects(objectIds);
    else
      this.selectionSection.refresh();
    if (!this.selectionSection.tiePointsAreShown())
      SelectionSection.hideTheTiePoints();
    if (!this.selectionSection.pathPointsAreShown())
      SelectionSection.hideThePathPoints();
  }
  /*
          How far the view scrolls along one axis to show a stretch of the document that starts at
          start and is length long, where the view shows viewStart and is viewLength long. Returns
          the new start of the view.
  
          A stretch that fits in the view is scrolled to in whole steps of the free space, the view
          minus the stretch, so that there is room left between the stretch and the edge it came in
          over. A stretch longer than the view is scrolled to by half a view, and only once it lies
          outside the middle part of the view, which leaves the reader something to recognise. The
          view only scrolls, it never zooms.
      */
  static scrolledStart(viewStart, viewLength, start, length) {
    const free = Math.min(viewLength - length, length);
    if (viewLength < length) {
      const border = Math.round(viewLength * 30 / 200);
      if (viewStart + border > start + length)
        return viewStart - Math.round(viewLength / 2);
      if (viewStart + viewLength - border < start)
        return viewStart + Math.round(viewLength / 2);
      return viewStart;
    }
    if (free <= 0)
      return viewStart;
    let scrolled = viewStart;
    const beyondEnd = start + length - scrolled - viewLength;
    if (beyondEnd > 0)
      scrolled += (Math.floor(beyondEnd / free) + 1) * free;
    const beforeStart = scrolled - start;
    if (beforeStart > 0)
      scrolled -= (Math.floor(beforeStart / free) + 1) * free;
    return scrolled;
  }
  /*
      Selects those objects and brings them on screen, for a selection that does not come from
      pressing at a point: a key, a command, or what is left after a deletion. A press always
      lands on something in view, and the view stays put for it.
  */
  static selectAndShow(objectIds) {
    this.selectObjects(objectIds);
    this.updateSelectionSection();
    this.showTheObjects(objectIds);
  }
  /// Brings those objects on screen, with the room around them their handles are drawn in.
  /// Answers whether the client holds any of them to do so.
  static showTheObjects(objectIds) {
    let box;
    for (const objectId of objectIds) {
      const own = RenderGeometrySection.boxOf(objectId);
      if (own)
        box = box ? box.union(own) : own;
    }
    if (!box)
      return false;
    const room = 1.5 * ShapeHandlesSection.handleSize() * app.pixelsToTwips;
    const shown = box.expand(room, room);
    _GraphicSelection.scrollRectangleIntoView(new cool.SimpleRectangle(shown.minX, shown.minY, shown.width, shown.height));
    return true;
  }
  /*
      Brings a point on screen, with the room around it a handle is drawn in, so that whatever
      sits there is never up against an edge of the view.
  */
  static scrollPointIntoView(point) {
    const size = ShapeHandlesSection.handleSize() * app.pixelsToTwips;
    _GraphicSelection.scrollRectangleIntoView(new cool.SimpleRectangle(point.x - 1.5 * size, point.y - 1.5 * size, 3 * size, 3 * size));
  }
  /// Scrolls so that the whole rectangle is seen, the way a presentation scrolls to what it
  /// marks. A rectangle that is seen already leaves the view where it is.
  static scrollRectangleIntoView(rectangle) {
    var _a, _b;
    const viewed = (_b = (_a = app.activeDocument) == null ? void 0 : _a.activeLayout) == null ? void 0 : _b.viewedRectangle;
    if (!viewed || viewed.containsRectangle(rectangle.toArray()))
      return;
    const x = _GraphicSelection.scrolledStart(viewed.x1, viewed.width, rectangle.x1, rectangle.width);
    const y = _GraphicSelection.scrolledStart(viewed.y1, viewed.height, rectangle.y1, rectangle.height);
    if (x === viewed.x1 && y === viewed.y1)
      return;
    app.map._docLayer.scrollByPoint(new cool.SimplePoint(x - viewed.x1, y - viewed.y1));
  }
  /*
      What tells one selection from another: the objects it stands on, so a selection of two
      shapes differs from a selection of one of them. The engine names every marked object, and
      the first of them again on its own, which is what a payload from an older engine carries.
  */
  static selectionKeyOf(extraInfo) {
    const objectIds = _GraphicSelection.selectedObjectIDsOf(extraInfo);
    return objectIds.length ? String(objectIds) : String(extraInfo == null ? void 0 : extraInfo.id);
  }
  static resetSelectionRanges() {
    var _a;
    _GraphicSelection.setSelectedPreviewPart(-1);
    this.selectionChanged([]);
    _GraphicSelection.updateSelectionSection();
    (_a = _GraphicSelection.travel()) == null ? void 0 : _a.leave();
    this.rectangle = null;
    this.extraInfo = null;
    this.inPlaceActive = false;
    if (this.handlesSection) {
      this.handlesSection.removeSubSections();
      app.sectionContainer.removeSection(this.handlesSection.name);
      this.handlesSection = null;
    }
  }
  /*
      The player of a selected video or audio object, where the client draws the selection
      itself: laid on the box of the selection and kept while the same object is selected
      again, so a running video is not started over by a click on it.
  */
  static showThePlayer(description) {
    const section = this.selectionSection;
    if (!section)
      return;
    if (this.mediaPlayer && this.mediaPlayer.url !== description.url)
      this.dropThePlayer();
    if (!this.mediaPlayer) {
      this.mediaPlayer = new MediaPlayerSection(description, section.selectionCorner(), section.selectionSize());
      app.sectionContainer.addSection(this.mediaPlayer);
    }
    this.followThePlayer();
  }
  static followThePlayer() {
    const section = this.selectionSection;
    if (!this.mediaPlayer || !section)
      return;
    this.mediaPlayer.follow(section.selectionCorner(), section.selectionSize());
  }
  static dropThePlayer() {
    if (!this.mediaPlayer)
      return;
    app.sectionContainer.removeSection(this.mediaPlayer.name);
    this.mediaPlayer = null;
  }
  // shows the video inside current selection marker
  static onEmbeddedVideoContent(textMsg) {
    var videoDesc = JSON.parse(textMsg);
    if (RenderManager.drawsFromObjects()) {
      this.showThePlayer(videoDesc);
      return;
    }
    if (!this.handlesSection)
      return;
    if (this.hasActiveSelection()) {
      videoDesc.width = this.rectangle.cWidth;
      videoDesc.height = this.rectangle.cHeight;
    }
    var routeTokenIndex = videoDesc.url.indexOf("%26RouteToken=");
    if (routeTokenIndex != -1) {
      videoDesc.url = videoDesc.url.replace("%26RouteToken=", "&amp;RouteToken=");
    }
    var videoToInsert = '<?xml version="1.0" encoding="UTF-8"?>		<svg xmlns="http://www.w3.org/2000/svg" width="' + videoDesc.width + '" height="' + videoDesc.height + '">		<foreignObject overflow="visible" width="' + videoDesc.width + '" height="' + videoDesc.height + '">			<body xmlns="http://www.w3.org/1999/xhtml">				<video controls="controls" width="' + videoDesc.width + '" height="' + videoDesc.height + '">					<source src="' + videoDesc.url + '" type="' + videoDesc.mimeType + '"/>					<track src="' + videoDesc.srt + '" kind="subtitles""/>				</video>			</body>		</foreignObject>		</svg>';
    this.handlesSection.addEmbeddedVideo(videoToInsert);
  }
  static renderDarkOverlay(rectangle = this.rectangle) {
    this.darkOverlayRectangle = rectangle;
    const anchor = app.activeDocument.activeLayout.documentAnchorPosition;
    var topLeft = new cool.Point(rectangle.v1X - anchor[0], rectangle.v1Y - anchor[1]);
    var bottomRight = new cool.Point(rectangle.v4X - anchor[0], rectangle.v4Y - anchor[1]);
    var bounds = new cool.Bounds(topLeft, bottomRight);
    app.map._docLayer._oleCSelections.setPointSet(CPointSet.fromBounds(bounds));
  }
  static refreshDarkOverlay() {
    if (this.darkOverlayRectangle && this.hasDarkOverlay())
      this.renderDarkOverlay(this.darkOverlayRectangle);
  }
  static hasDarkOverlay() {
    return !app.map._docLayer._oleCSelections.empty();
  }
  // When a shape is selected, the rectangles of other shapes are also sent from the core side.
  // They are in twips units.
  static convertObjectRectangleTwipsToPixels() {
    if (this.extraInfo && this.extraInfo.ObjectRectangles) {
      for (let i = 0; i < this.extraInfo.ObjectRectangles.length; i++) {
        for (let j = 0; j < 4; j++)
          this.extraInfo.ObjectRectangles[i][j] *= app.twipsToPixels * app.impress.twipsCorrection;
      }
    }
  }
  static inPlaceExtraInfo(messageJSON) {
    const x1 = messageJSON[0];
    const y1 = messageJSON[1];
    const x2 = x1 + messageJSON[2];
    const y2 = y1 + messageJSON[3];
    const xs = [x1, (x1 + x2) / 2, x2];
    const ys = [y1, (y1 + y2) / 2, y2];
    const columns = [0, 1, 2, 0, 2, 0, 1, 2];
    const rows = [0, 0, 0, 1, 1, 2, 2, 2];
    const rectangle = {};
    for (let i = 0; i < 8; i++) {
      rectangle[String(i + 1)] = [
        {
          id: String(i),
          kind: String(i + 1),
          point: { x: xs[columns[i]], y: ys[rows[i]] }
        }
      ];
    }
    return {
      id: "inplace",
      handles: { kinds: { rectangle } },
      isDraggable: true,
      isResizable: !this.inPlaceMath && !this.inPlaceCalc,
      isRotatable: false,
      isMathObject: this.inPlaceMath
    };
  }
  static parseMessage(textMsg) {
    return JSON.parse("[" + textMsg.substr("graphicselection:".length) + "]");
  }
  static isMathSelection(msgData) {
    var _a;
    return msgData.length > 5 && ((_a = msgData[5]) == null ? void 0 : _a.isMathObject) === true;
  }
  static isCalcSelection(msgData) {
    var _a;
    return msgData.length > 5 && ((_a = msgData[5]) == null ? void 0 : _a.isCalcObject) === true;
  }
  // Core mirrors a left edge in a right-to-left sheet, and mirroring it again undoes that.
  static coreLeft(left, width) {
    return app.map._docLayer.isCalcRTL() ? -(left + width) : left;
  }
  static selectsInPlaceObject(textMsg) {
    var _a;
    try {
      const msgData = this.parseMessage(textMsg);
      if (msgData.length <= 5)
        return false;
      if (((_a = msgData[5]) == null ? void 0 : _a.isChartPage) === true)
        return true;
      const area = this.inPlaceArea;
      return msgData[0] === area[0] && msgData[1] === area[1] && msgData[2] === area[2] && msgData[3] === area[3];
    } catch (error) {
      return false;
    }
  }
  /*
      A formula being edited grows and shrinks with what is typed, and the engine sends it anew
      each time, with the frame it has then. Its window here follows that frame, so what is
      typed is never drawn in the pale surround.
  */
  static followTheFormula() {
    if (this.followingTheFormula)
      return;
    this.followingTheFormula = true;
    RenderManager.onVectorChanged(() => {
      var _a;
      if (!this.inPlaceMath || !this.inPlaceArea || this.inPlaceObject === void 0)
        return;
      const formula = RenderGeometrySection.objectOf(this.inPlaceObject);
      if (!formula || formula.x === void 0 || formula.y === void 0 || formula.width === void 0 || formula.height === void 0)
        return;
      const area = [formula.x, formula.y, formula.width, formula.height];
      if (area.every((value, at) => value === this.inPlaceArea[at]))
        return;
      this.inPlaceArea = area;
      this.showInPlaceFrame();
      (_a = app.sectionContainer) == null ? void 0 : _a.requestReDraw();
    });
  }
  static showInPlaceFrame() {
    const msgData = this.inPlaceArea.slice();
    msgData[4] = 0;
    msgData[5] = this.inPlaceExtraInfo(msgData);
    this.transformGraphicSelection(msgData);
    this.extractAndSetGraphicSelection(msgData);
    this.inPlaceTileOffset = this.tileTwipsOffset.slice();
    this.selectionAngle = 0;
    this.inPlaceActive = true;
    if (this.handlesSection)
      this.handlesSection.interactable = true;
    if (this.rectangle && this.hasDarkOverlay())
      this.renderDarkOverlay();
  }
  static toInPlaceEdges(rectangle, insideObject = false) {
    const docLayer = app.map._docLayer;
    const verticalOffset = docLayer.getFiledBasedViewVerticalOffset() || 0;
    let left = rectangle.x1;
    let top = rectangle.y1 - verticalOffset;
    let right = rectangle.x2;
    let bottom = rectangle.y2 - verticalOffset;
    if (docLayer._docType === "spreadsheet" && insideObject) {
      const offset = this.inPlaceTileOffset;
      left = Math.abs(left) - offset[0];
      top -= offset[1];
      right = Math.abs(right) - offset[0];
      bottom -= offset[1];
    } else if (docLayer._docType === "spreadsheet" && docLayer.sheetGeometry) {
      const topLeft = docLayer.sheetGeometry.getPrintTwipsPointFromTile(new cool.Point(Math.abs(left), top));
      const bottomRight = docLayer.sheetGeometry.getPrintTwipsPointFromTile(new cool.Point(Math.abs(right), bottom));
      left = topLeft.x;
      top = topLeft.y;
      right = bottomRight.x;
      bottom = bottomRight.y;
    }
    if (right < left)
      [left, right] = [right, left];
    if (bottom < top)
      [top, bottom] = [bottom, top];
    return [left, top, right, bottom];
  }
  static keepUnmovedInPlaceEdges(edges) {
    const area = this.inPlaceArea;
    const areaWidth = Math.abs(area[2]);
    const areaLeft = this.coreLeft(area[0], areaWidth);
    return this.keepUnmovedEdges(edges, [
      areaLeft,
      area[1],
      areaLeft + areaWidth,
      area[1] + area[3]
    ]);
  }
  static keepUnmovedEdges(edges, core, insideObject = false) {
    const frame = this.toInPlaceEdges(this.rectangle, insideObject);
    return edges.map((edge, index) => {
      const axis = index % 2;
      for (const frameIndex of [axis, axis + 2]) {
        if (Math.abs(edge - frame[frameIndex]) <= 2 * app.pixelsToTwips)
          return core[frameIndex];
      }
      return edge;
    });
  }
  static sendElementArea(rectangle) {
    let [left, top, right, bottom] = this.toInPlaceEdges(rectangle, true);
    if (this.selectionEdges && this.rectangle)
      [left, top, right, bottom] = this.keepUnmovedEdges([left, top, right, bottom], this.selectionEdges, true);
    const width = Math.round(right - left);
    const height = Math.round(bottom - top);
    if (width <= 0 || height <= 0)
      return;
    app.map.sendUnoCommand(".uno:TransformDialog", {
      TransformPosX: { type: "long", value: Math.round(left) },
      TransformPosY: { type: "long", value: Math.round(top) },
      TransformWidth: { type: "long", value: width },
      TransformHeight: { type: "long", value: height }
    });
  }
  static sendInPlaceArea(rectangle, keepSize = false) {
    let [left, top, right, bottom] = this.toInPlaceEdges(rectangle);
    if (!keepSize && !this.inPlaceMath && this.inPlaceArea && this.rectangle)
      [left, top, right, bottom] = this.keepUnmovedInPlaceEdges([
        left,
        top,
        right,
        bottom
      ]);
    let width = Math.round(right - left);
    let height = Math.round(bottom - top);
    if (keepSize && this.inPlaceArea) {
      width = Math.abs(this.inPlaceArea[2]);
      height = this.inPlaceArea[3];
    }
    if (this.inPlaceMath && this.inPlaceArea)
      left = this.inPlaceArea[0];
    if (width <= 0 || height <= 0)
      return;
    left = this.coreLeft(left, width);
    app.socket.sendMessage("inplaceobjectarea x=" + Math.round(left) + " y=" + Math.round(top) + " width=" + width + " height=" + height);
    this.updateGraphicSelection();
  }
  static extractAndSetGraphicSelection(messageJSON) {
    var hasExtraInfo = messageJSON.length > 5;
    var hasGridOffset = false;
    var extraInfo = null;
    if (hasExtraInfo) {
      extraInfo = messageJSON[5];
      if (extraInfo.gridOffsetX || extraInfo.gridOffsetY) {
        app.map._docLayer._shapeGridOffset = new cool.SimplePoint(extraInfo.gridOffsetX, extraInfo.gridOffsetY);
        hasGridOffset = true;
      }
    }
    const rawWidth = Math.abs(messageJSON[2]);
    const rectX = app.map._docLayer.isCalcRTL() && messageJSON[0] < 0 ? Math.abs(messageJSON[0]) - rawWidth : messageJSON[0];
    this.rectangle = new cool.SimpleRectangle(rectX, messageJSON[1], rawWidth, messageJSON[3]);
    this.selectionEdges = [
      rectX,
      messageJSON[1],
      rectX + rawWidth,
      messageJSON[1] + messageJSON[3]
    ];
    if (hasGridOffset) {
      this.tileTwipsOffset = [
        app.map._docLayer._shapeGridOffset.x,
        app.map._docLayer._shapeGridOffset.y
      ];
      this.rectangle.moveBy(this.tileTwipsOffset);
    } else if (app.map._docLayer._docType === "spreadsheet") {
      const tl = new cool.SimplePoint(Math.abs(this.rectangle.x1), this.rectangle.y1);
      if (this.inPlaceArea && (extraInfo == null ? void 0 : extraInfo.id) !== "inplace") {
        tl.x += this.inPlaceTileOffset[0];
        tl.y += this.inPlaceTileOffset[1];
      } else
        app.map._docLayer.sheetGeometry.convertToTileTwips(tl);
      this.tileTwipsOffset = [
        tl.x - Math.abs(this.rectangle.x1),
        tl.y - this.rectangle.y1
      ];
      this.rectangle.moveTo(tl.toArray());
    } else {
      this.tileTwipsOffset = [0, 0];
    }
    this.extraInfo = extraInfo;
    if (app.map._docLayer._docType === "presentation")
      this.convertObjectRectangleTwipsToPixels();
  }
  /// Push down the graphic selection on non-first pages of scrolling PDF view.
  static transformGraphicSelection(messageJSON) {
    var _a, _b;
    const docLayer = app.map._docLayer;
    const verticalOffset = docLayer.getFiledBasedViewVerticalOffset();
    if (!verticalOffset) {
      return;
    }
    messageJSON[1] += verticalOffset;
    const extraInfo = messageJSON[5];
    const rectangle = (_b = (_a = extraInfo == null ? void 0 : extraInfo.handles) == null ? void 0 : _a.kinds) == null ? void 0 : _b.rectangle;
    if (!rectangle) {
      return;
    }
    for (const key of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      for (const handle of rectangle[key]) {
        const y = parseInt(handle.point.y);
        handle.point.y = y + verticalOffset;
      }
    }
  }
  static updateGraphicSelection() {
    var _a, _b, _c, _d, _e, _f;
    if (this.hasActiveSelection()) {
      if (!JSDialog.IsAnyInputFocused() && !app.map.isSearching())
        app.map.focus(app.file.textCursor.visible);
      let editMode = app.map.isEditMode();
      if (!editMode) {
        editMode = _GraphicSelection.isBeingSigned();
      }
      if (!editMode && !((_b = (_a = this.extraInfo) == null ? void 0 : _a.mimeType) == null ? void 0 : _b.startsWith("video/")) && !((_d = (_c = this.extraInfo) == null ? void 0 : _c.mimeType) == null ? void 0 : _d.startsWith("audio/"))) {
        return;
      }
      if (RenderManager.drawsFromObjects()) {
        _GraphicSelection.updateSelectionSection();
        (_e = this.selectionSection) == null ? void 0 : _e.setShowSection(editMode);
        app.sectionContainer.requestReDraw();
        app.map._docLayer._updateCursorAndOverlay();
        return;
      }
      const previewPart = _GraphicSelection.coveredPreviewPart();
      _GraphicSelection.setSelectedPreviewPart(previewPart);
      if (previewPart !== -1) {
        if (this.handlesSection) {
          this.handlesSection.removeSubSections();
          app.sectionContainer.removeSection(this.handlesSection.name);
          this.handlesSection = null;
        }
        app.map._docLayer._updateCursorAndOverlay();
        return;
      }
      var extraInfo = this.extraInfo;
      let addHandlesSection = false;
      if (!this.handlesSection)
        addHandlesSection = true;
      else if (_GraphicSelection.selectionKeyOf(extraInfo) !== _GraphicSelection.selectionKeyOf(this.handlesSection.sectionProperties.info)) {
        this.handlesSection.removeSubSections();
        app.sectionContainer.removeSection(this.handlesSection.name);
        this.handlesSection = null;
        addHandlesSection = true;
      }
      if (addHandlesSection) {
        this.handlesSection = new app.definitions.shapeHandlesSection({});
        app.sectionContainer.addSection(this.handlesSection);
      }
      this.handlesSection.setPosition(this.rectangle.pX1, this.rectangle.pY1);
      extraInfo.hasTableSelection = app.activeDocument.tableMiddleware.hasTableSelection();
      this.handlesSection.refreshInfo(this.extraInfo);
      this.handlesSection.setShowSection(editMode);
      _GraphicSelection.updateSelectionSection();
      (_f = this.selectionSection) == null ? void 0 : _f.setShowSection(editMode);
      app.sectionContainer.requestReDraw();
    } else {
      _GraphicSelection.setSelectedPreviewPart(-1);
      if (this.handlesSection && app.sectionContainer.doesSectionExist(this.handlesSection.name)) {
        this.handlesSection.removeSubSections();
        app.sectionContainer.removeSection(this.handlesSection.name);
        this.handlesSection = null;
      }
    }
    app.map._docLayer._updateCursorAndOverlay();
  }
  static onShapeSelectionContent(textMsg) {
    textMsg = textMsg.substring("shapeselectioncontent:".length + 1);
    var extraInfo = this.extraInfo;
    if (extraInfo && extraInfo.id) {
      app.map._cacheSVG[extraInfo.id] = textMsg;
    }
    if (this.handlesSection) {
      if (this.handlesSection.sectionProperties.hasVideo)
        app.map._cacheSVG[extraInfo.id] = void 0;
      else
        this.handlesSection.setSVG(textMsg);
      if (!app.file.textCursor.visible)
        this.handlesSection.interactable = true;
    }
  }
  // Preview geometry sent by core while a shape handle is being dragged.
  static onShapeDragPreview(textMsg) {
    if (!this.handlesSection)
      return;
    textMsg = textMsg.substring("shapedragpreview:".length);
    try {
      this.handlesSection.onShapeDragPreview(JSON.parse(textMsg));
    } catch (error) {
      window.app.console.warn("cannot parse shapedragpreview message");
    }
  }
  static checkDiagramData() {
    if (RenderManager.drawsFromObjects()) {
      _GraphicSelection.updateGroupButtons();
      return;
    }
    if (_GraphicSelection.extraInfo && _GraphicSelection.extraInfo.isDiagram) {
      if (!_GraphicSelection.diagramButton) {
        const subSection = this.handlesSection ? app.sectionContainer.getSectionWithName(this.handlesSection.sectionProperties.subSectionPrefix + "diagram") : null;
        var halfWidth = 0;
        if (subSection && subSection.sectionProperties) {
          halfWidth = subSection.sectionProperties.ownInfo.halfWidth;
        }
        _GraphicSelection.diagramButton = new DiagramButtonSection(halfWidth * app.twipsToPixels);
        _GraphicSelection.diagramButton.forceNextReposition();
        app.sectionContainer.addSection(_GraphicSelection.diagramButton);
      }
      _GraphicSelection.diagramButton.updatePosition();
    } else if (_GraphicSelection.diagramButton) {
      app.sectionContainer.removeSection(_GraphicSelection.diagramButton.name);
      _GraphicSelection.diagramButton = null;
    }
  }
  static checkChartData() {
    var disabled = true;
    if (disabled)
      return;
    if (_GraphicSelection.extraInfo && _GraphicSelection.extraInfo.isChartPage && _GraphicSelection.extraInfo.isChartPage === true) {
      if (!_GraphicSelection.chartContextToolbarSelectStyle) {
        _GraphicSelection.chartContextToolbarSelectStyle = new ChartContextButtonSection(0);
        _GraphicSelection.chartContextToolbarSaveStyle = new ChartContextButtonSection(1);
        _GraphicSelection.chartContextToolbarSelectStyle.forceNextReposition();
        _GraphicSelection.chartContextToolbarSaveStyle.forceNextReposition();
        app.sectionContainer.addSection(_GraphicSelection.chartContextToolbarSelectStyle);
        app.sectionContainer.addSection(_GraphicSelection.chartContextToolbarSaveStyle);
      }
      _GraphicSelection.chartContextToolbarSelectStyle.updatePosition();
      _GraphicSelection.chartContextToolbarSaveStyle.updatePosition();
      if (_GraphicSelection.chartContextToolbarSelectStyle) {
        _GraphicSelection.chartContextToolbarSelectStyle.showChartContextToolbar();
        _GraphicSelection.chartContextToolbarSaveStyle.showChartContextToolbar();
      }
    } else if (_GraphicSelection.chartContextToolbarSelectStyle) {
      app.sectionContainer.removeSection(_GraphicSelection.chartContextToolbarSelectStyle.name);
      app.sectionContainer.removeSection(_GraphicSelection.chartContextToolbarSaveStyle.name);
      _GraphicSelection.chartContextToolbarSelectStyle = null;
      _GraphicSelection.chartContextToolbarSaveStyle = null;
    }
  }
  static onMessage(textMsg) {
    var _a, _b;
    URLPopUpSection.closeURLPopUp();
    const left = this.leftInPlace;
    if (!textMsg.match("INPLACE EXIT"))
      this.leftInPlace = void 0;
    if (textMsg.match("EMPTY")) {
      if (this.inPlaceArea && this.inPlaceActive && RenderManager.isVectorRendering()) {
        this.showInPlaceFrame();
        return;
      }
      if (left !== void 0 && this.pressedOutside !== void 0 && RenderManager.isVectorRendering()) {
        const met = this.pressedOutside;
        this.pressedOutside = void 0;
        this.selectObjects([met === null ? left : met]);
        this.updateSelectionSection();
        return;
      }
      if (this.outdatedReport([]))
        return;
      this.resetSelectionRanges();
      if (this.inPlaceArea)
        this.showInPlaceFrame();
    } else if (textMsg.match("INPLACE EXIT")) {
      app.map._docLayer._oleCSelections.clear();
      this.darkOverlayRectangle = null;
      this.inPlaceActive = false;
      this.inPlaceArea = null;
      this.inPlaceMath = false;
      this.inPlaceCalc = false;
      this.leftInPlace = this.inPlaceObject;
      this.inPlaceObject = void 0;
      this.showInPlaceNotebookbar();
      if (RenderManager.isVectorRendering())
        this.updateSelectionSection();
    } else if (textMsg.match("INPLACE")) {
      try {
        var msgData = this.parseMessage(textMsg);
        const isMathObject = this.isMathSelection(msgData);
        if (isMathObject && app.map._docLayer._docType !== "text" && !RenderManager.isVectorRendering()) {
          this.inPlaceArea = null;
          this.inPlaceActive = false;
          this.inPlaceObject = void 0;
          this.extractAndSetGraphicSelection(msgData.slice(0, 4));
        } else if (msgData.length > 1) {
          this.inPlaceMath = isMathObject;
          this.inPlaceCalc = this.isCalcSelection(msgData);
          this.showInPlaceNotebookbar();
          if (isMathObject)
            this.followTheFormula();
          this.inPlaceArea = msgData.slice(0, 4);
          if (this.inPlaceObject === void 0) {
            this.inPlaceObject = this.selectedObjectIDs[0];
            this.pressedOutside = void 0;
          }
          this.showInPlaceFrame();
        }
      } catch (error) {
        window.app.console.warn("cannot parse graphicselection command");
      }
      if (this.rectangle)
        this.renderDarkOverlay();
      if (!this.inPlaceArea)
        this.rectangle = null;
      if (RenderManager.isVectorRendering())
        this.updateSelectionSection();
    } else if (this.inPlaceArea && // In the vector view everything the engine reports while an object is active in
    // place is a selection inside it, of a part of a chart for one; leaving the object
    // comes as INPLACE EXIT first, and only then the new selection.
    (this.inPlaceActive && RenderManager.isVectorRendering() || this.selectsInPlaceObject(textMsg))) {
      if (this.inPlaceMath && RenderManager.isVectorRendering()) {
        const reported = this.parseMessage(textMsg);
        if (reported.length > 3)
          this.inPlaceArea = reported.slice(0, 4);
      }
      if (this.inPlaceActive && RenderManager.isVectorRendering()) {
        const parts = this.selectedObjectIDsOf(this.parseMessage(textMsg)[5]).filter((objectId) => RenderGeometrySection.objectOf(objectId) !== void 0 && objectId !== this.inPlaceObject);
        if (parts.length) {
          this.outdatedReport(parts);
          this.selectedObjectIDs = parts;
          this.updateSelectionSection();
          this.tellTheStates();
          return;
        }
      }
      this.showInPlaceFrame();
      if (!window.ThisIsTheiOSApp && !this.inPlaceMath && !this.inPlaceCalc)
        app.socket.sendMessage("rendershapeselection mimetype=image/svg+xml");
    } else {
      msgData = this.parseMessage(textMsg);
      if (this.outdatedReport(_GraphicSelection.selectedObjectIDsOf(msgData.length > 5 ? msgData[5] : null)))
        return;
      this.inPlaceActive = false;
      this.inPlaceObject = void 0;
      const isMathObject = this.isMathSelection(msgData);
      this.transformGraphicSelection(msgData);
      this.extractAndSetGraphicSelection(msgData);
      const changed = this.selectionChanged(_GraphicSelection.selectedObjectIDsOf(msgData.length > 5 ? msgData[5] : null));
      if (!app.map._docLayer._oleCSelections.empty()) {
        const framed = isMathObject ? this.rectangle : this.darkOverlayRectangle ?? this.rectangle;
        app.map._docLayer._oleCSelections.clear();
        this.renderDarkOverlay(framed);
      }
      this.selectionAngle = msgData.length > 4 ? msgData[4] : 0;
      if (this.extraInfo) {
        var dragInfo = this.extraInfo.dragInfo;
        if (dragInfo && dragInfo.dragMethod === "PieSegmentDragging") {
          dragInfo.initialOffset /= 100;
          var dragDir = dragInfo.dragDirection;
          dragInfo.dragDirection = app.map._docLayer._twipsToPixels(new cool.Point(dragDir[0], dragDir[1]));
          dragDir = dragInfo.dragDirection;
          dragInfo.range2 = dragDir.x * dragDir.x + dragDir.y * dragDir.y;
        }
      }
      var extraInfo = this.extraInfo;
      if (extraInfo) {
        if (extraInfo.isDraggable === void 0)
          extraInfo.isDraggable = true;
        if (extraInfo.isResizable === void 0)
          extraInfo.isResizable = true;
        if (extraInfo.isRotatable === void 0)
          extraInfo.isRotatable = true;
      }
      if (!RenderManager.drawsFromObjects() && !window.ThisIsTheiOSApp && this.extraInfo.isDraggable && !this.extraInfo.svg) {
        app.socket.sendMessage("rendershapeselection mimetype=image/svg+xml");
      }
      const drawsFromObjects = RenderManager.drawsFromObjects();
      const mayJump = !drawsFromObjects && app.map._docLayer._allowViewJump();
      const followsAnotherView = drawsFromObjects ? !app.isFollowingOff() && Number(app.getFollowedViewId()) !== Number(app.map._docLayer._viewId) : app.isFollowingEditor() || app.isFollowingUser();
      if (drawsFromObjects) {
        if (changed && !TextSelections.getEndRectangle() && !followsAnotherView && !_GraphicSelection.showTheObjects(this.selectedObjectIDs) && this.rectangle)
          _GraphicSelection.scrollRectangleIntoView(this.rectangle);
      } else if (!app.map._docLayer.isWriter() && this.rectangle && mayJump) {
        if ((!app.isPointVisibleInTheDisplayedArea([
          this.rectangle.x1,
          this.rectangle.y1
        ]) || !app.isPointVisibleInTheDisplayedArea([
          this.rectangle.x2,
          this.rectangle.y2
        ])) && !TextSelections.getEndRectangle() && !followsAnotherView && !app.map.calcInputBarHasFocus())
          app.map._docLayer.scrollToPos(new cool.SimplePoint(this.rectangle.x1, this.rectangle.y1));
      }
    }
    if (app.map._clip)
      app.map._clip.onComplexSelection("");
    if (app.map._docLayer._selectionContentRequest)
      clearTimeout(app.map._docLayer._selectionContentRequest);
    app.map._docLayer._onMessage("textselectioncontent:");
    this.updateGraphicSelection();
    if (msgData && msgData.length > 5) {
      var extraInfo = msgData[5];
      if (((_a = extraInfo.mimeType) == null ? void 0 : _a.startsWith("video/")) || ((_b = extraInfo.mimeType) == null ? void 0 : _b.startsWith("audio/"))) {
        this.onEmbeddedVideoContent(JSON.stringify(extraInfo));
      }
    }
    _GraphicSelection.checkChartData();
    _GraphicSelection.checkDiagramData();
  }
  /*
      Some keywords: mousecontrol, _postMouseEvent, core side.
      Explanation:
          * User can edit a shape's text.
          * We need to send the mouse events to core in that case (for text selection, double click etc).
          * When cursor is visible, we assume text editing started.
          * And we set the "interactable" property of the shape handler section to false.
          * When "interactable" is false, canvas section container events pass through the section.
          * In our case, ShapeHandlesSection begins to be ignored.
          * And MouseControl catches all the events.
          * Users can select text, click, double click, triple click, quadruple click etc.
  */
  static onTextCursorVisibility(event) {
    var _a;
    if (event.detail.visible)
      (_a = _GraphicSelection.travel()) == null ? void 0 : _a.leave();
    if (this.hasActiveSelection() && this.handlesSection) {
      this.handlesSection.interactable = !event.detail.visible || this.inPlaceActive;
    }
  }
};
_GraphicSelection.selectedObjectIDs = [];
_GraphicSelection.selectionCameFromElsewhere = false;
_GraphicSelection.rectangle = null;
_GraphicSelection.extraInfo = null;
_GraphicSelection.selectionAngle = 0;
_GraphicSelection.inPlaceActive = false;
_GraphicSelection.tileTwipsOffset = [0, 0];
_GraphicSelection.inPlaceArea = null;
_GraphicSelection.inPlaceMath = false;
_GraphicSelection.inPlaceCalc = false;
_GraphicSelection.inPlaceObject = void 0;
_GraphicSelection.leftInPlace = void 0;
_GraphicSelection.pressedAt = null;
_GraphicSelection.pressedOutside = void 0;
_GraphicSelection.inPlaceTileOffset = [0, 0];
_GraphicSelection.selectionEdges = null;
_GraphicSelection.handlesSection = null;
_GraphicSelection.chartContextToolbarSelectStyle = null;
_GraphicSelection.chartContextToolbarSaveStyle = null;
_GraphicSelection.diagramButton = null;
_GraphicSelection.darkOverlayRectangle = null;
_GraphicSelection.mediaPlayer = null;
_GraphicSelection.cropping = false;
_GraphicSelection.nextReportAsItIs = false;
_GraphicSelection.statesGiven = {};
_GraphicSelection.onePathToldAs = false;
_GraphicSelection.closedToldAs = false;
_GraphicSelection.closedPathCommand = "closepath";
_GraphicSelection.simplifyCurvesCommand = "simplifypathcurves";
_GraphicSelection.simplifyAllCommand = "simplifypathall";
_GraphicSelection.askedFor = [];
_GraphicSelection.mostAsked = 16;
_GraphicSelection.announcedObjectIDs = [];
_GraphicSelection.stoodAt = null;
_GraphicSelection.followingDeletions = false;
_GraphicSelection.selectionSection = null;
_GraphicSelection.theWayOf = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
};
_GraphicSelection.keysHeldBack = [];
_GraphicSelection.followingTheKeysHeldBack = false;
_GraphicSelection.groupButtons = /* @__PURE__ */ new Map();
_GraphicSelection.followingTheFormula = false;
let GraphicSelection = _GraphicSelection;
app.events.on("updatepermission", GraphicSelection.onUpdatePermission.bind(GraphicSelection));
app.events.on("TextCursorVisibility", GraphicSelection.onTextCursorVisibility.bind(GraphicSelection));
app.definitions.graphicSelection = GraphicSelection;
