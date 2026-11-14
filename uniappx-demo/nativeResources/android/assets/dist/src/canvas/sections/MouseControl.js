const _MouseControl = class _MouseControl extends CanvasSectionObject {
  constructor(name) {
    super(name);
    this.zIndex = app.CSections.MouseControl.zIndex;
    this.drawingOrder = app.CSections.MouseControl.drawingOrder;
    this.processingOrder = app.CSections.MouseControl.processingOrder;
    this.boundToSection = app.CSections.Tiles.name;
    this.mouseMoveTimer = null;
    this.clickTimer = null;
    this.currentPosition = new cool.SimplePoint(0, 0);
    this.clickCount = 0;
    this.pendingClickInfo = null;
    this.positionOnMouseDown = null;
    this.modifierOnMouseDown = 0;
    this.localPositionOnMouseDown = null;
    this.mouseDownSent = false;
    this.selectingText = false;
    this.cellsFrom = null;
    this.cellsTo = null;
    this.pressedInSelection = false;
    this.timeOfPress = 0;
    this.timeOfFirstDragMove = 0;
    this.carrying = null;
    this.frameFrom = null;
    this.lastDragLocalPoint = null;
    this.lastDragModifier = 0;
    this.inSwipeAction = false;
    this.swipeVelocity = [0, 0];
    this.swipeTimeStamp = 0;
    this.amplitude = [0, 0];
    this.touchstart = 0;
    this.lastTouchDragPoint = null;
  }
  static readModifier(e) {
    let modifier = 0;
    const shift = e.shiftKey ? app.UNOModifier.SHIFT : 0;
    const ctrl = e.ctrlKey ? app.UNOModifier.CTRL : 0;
    const alt = e.altKey ? app.UNOModifier.ALT : 0;
    const cmd = e.metaKey ? app.UNOModifier.CTRLMAC : 0;
    modifier = shift | ctrl | alt | cmd;
    return modifier;
  }
  /*
          We need to map view coordinates to document coordinates.
          When user clicks at a position on the screen, we have its document coordinate according to
          traditional document view: It starts from top-left and ends at bottom-right. Now the new ViewLayouts
          can paint multiple parts at the same time and they can paint objects in different locations than the objects' original positions.
          This means that the point user clicks/taps may not overlap with the document through simple math.
          During this transition phase (to view layouts), we need both point.pX and point.vX properties. Later, we may use only vX, vY etc.
  
          This function should be used only for real user interactions. If you want to simulate a click at a certain position, call _postMouseEvent directly.
      */
  postCoreMouseEvent(eventType, point, clickCount, buttons, modifier) {
    const viewToDocumentPos = _MouseControl.toDocumentPoint(point);
    if (Number.isNaN(viewToDocumentPos.x) || Number.isNaN(viewToDocumentPos.y))
      return;
    else {
      app.map._docLayer._postMouseEvent(eventType, viewToDocumentPos.x, viewToDocumentPos.y, clickCount, buttons, modifier);
    }
  }
  // The place on the page under a point of the mouse position, which the active view layout
  // may lay out in several pages side by side. Either coordinate is NaN when no page is there.
  static toDocumentPoint(point) {
    const canvasPoint = point.clone();
    Util.ensureValue(app.activeDocument);
    canvasPoint.pX += -app.activeDocument.activeLayout.viewedRectangle.pX1 + app.sectionContainer.getDocumentAnchor()[0];
    canvasPoint.pY += -app.activeDocument.activeLayout.viewedRectangle.pY1 + app.sectionContainer.getDocumentAnchor()[1];
    return app.activeDocument.activeLayout.canvasToDocumentPoint(canvasPoint);
  }
  /*
      Hands a press that landed on a section over to the document, so that the menu is about
      what lies under it on the page. A section is told where the press landed inside it, while
      the document wants to know where that is on the page.
  */
  static contextMenuFrom(section, point, e) {
    const activeDocument = app.activeDocument;
    if (!activeDocument || !activeDocument.mouseControl)
      return;
    const viewed = activeDocument.activeLayout.viewedRectangle;
    const anchor = section.containerObject.getDocumentAnchor();
    point.pX = section.myTopLeft[0] + point.pX + viewed.pX1 - anchor[0];
    point.pY = section.myTopLeft[1] + point.pY + viewed.pY1 - anchor[1];
    activeDocument.mouseControl.setMousePosition(point);
    activeDocument.mouseControl.onContextMenu(point, e);
  }
  onContextMenu(point, e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const buttons = app.LOButtons.right;
    const modifier = _MouseControl.readModifier(e);
    this.flushPendingClick();
    if (modifier === 0) {
      this.postCoreMouseEvent("buttondown", this.currentPosition, 1, buttons, modifier);
    }
  }
  // Transforms a point in document coordinates (twips) into a css-pixel
  // position, either relative to the browser page or within the canvas.
  _documentToCssPosition(pagePosition, browserPage) {
    Util.ensureValue(app.activeDocument);
    let docTLx = app.activeDocument.activeLayout.viewedRectangle.pX1;
    let docTLy = app.activeDocument.activeLayout.viewedRectangle.pY1;
    if (app.map.getDocType() === "spreadsheet") {
      if (app.isXOrdinateInFrozenPane(pagePosition.pX)) {
        docTLx = 0;
      }
      if (app.isYOrdinateInFrozenPane(pagePosition.pY)) {
        docTLy = 0;
      }
    }
    pagePosition.pX -= docTLx - this.containerObject.getDocumentAnchor()[0];
    pagePosition.pY -= docTLy - this.containerObject.getDocumentAnchor()[1];
    if (browserPage) {
      const boundingClientRectangle = this.context.canvas.getBoundingClientRect();
      return {
        x: pagePosition.cX + boundingClientRectangle.x,
        y: pagePosition.cY + boundingClientRectangle.y
      };
    }
    return {
      x: pagePosition.cX,
      y: pagePosition.cY
    };
  }
  // Gets the mouse position either on browser page or within the
  // canvas in css pixels.
  _getMousePosition(browserPage) {
    return this._documentToCssPosition(this.currentPosition.clone(), browserPage);
  }
  // Gets the mouse position on browser page in CSS pixels.
  getMousePagePosition() {
    return this._getMousePosition(true);
  }
  // Gets the mouse position on canvas in CSS pixels.
  getMouseCanvasPosition() {
    return this._getMousePosition(false);
  }
  // Gets the text caret (Writer, Impress) or active cell (Calc) position on
  // the canvas in css pixels, or null when there is no visible cursor.
  getCursorCanvasPosition() {
    let rectangle = null;
    if (app.calc.cellCursorVisible)
      rectangle = app.calc.cellCursorRectangle;
    else if (app.file.textCursor.visible)
      rectangle = app.file.textCursor.rectangle;
    if (!rectangle)
      return null;
    const point = new cool.SimplePoint(rectangle.x1, rectangle.y2);
    return this._documentToCssPosition(point, false);
  }
  // This is useful when a section handles the event but wants to set the document mouse position.
  setMousePosition(point) {
    this.currentPosition = point.clone();
  }
  refreshPosition(point) {
    Util.ensureValue(app.activeDocument);
    let topLeftX = app.activeDocument.activeLayout.viewedRectangle.pX1;
    let topLeftY = app.activeDocument.activeLayout.viewedRectangle.pY1;
    if (app.map.getDocType() === "spreadsheet") {
      if (app.isXOrdinateInFrozenPane(point.pX))
        topLeftX = 0;
      if (app.isYOrdinateInFrozenPane(point.pY))
        topLeftY = 0;
    }
    this.currentPosition.pX = point.pX + topLeftX;
    this.currentPosition.pY = point.pY + topLeftY;
  }
  setCursorType() {
    const overTheCells = () => app.map._docLayer._docType === "spreadsheet" && RenderGeometrySection.objectIdAt(this.currentPosition.x, this.currentPosition.y) === void 0;
    if (RenderGeometrySection.answersPointer() && !overTheCells()) {
      this.context.canvas.classList.remove("spreadsheet-cursor");
      const pointer = RenderGeometrySection.pointerAt(this.currentPosition.x, this.currentPosition.y);
      const cursor = Cursor.getCustomCursor(pointer) || pointer;
      if (this.context.canvas.style.cursor !== cursor)
        this.context.canvas.style.cursor = cursor;
      return;
    }
    const corePointer = app.map._docLayer._coreMousePointer;
    if (app.map._docLayer._docType === "spreadsheet") {
      if (corePointer === "pointer") {
        const change = this.context.canvas.style.cursor !== "pointer" || this.context.canvas.classList.contains("spreadsheet-cursor");
        if (change) {
          this.context.canvas.classList.remove("spreadsheet-cursor");
          this.context.canvas.style.cursor = "pointer";
        }
        return;
      }
      const textCursor = app.file.textCursor.visible && app.calc.cellCursorRectangle && app.calc.cellCursorRectangle.pContainsPoint(this.currentPosition.pToArray());
      if (textCursor) {
        const change = this.context.canvas.style.cursor !== "text" || this.context.canvas.classList.contains("spreadsheet-cursor");
        if (change) {
          this.context.canvas.classList.remove("spreadsheet-cursor");
          this.context.canvas.style.cursor = "text";
        }
      } else {
        const change = this.context.canvas.style.cursor !== "" || !this.context.canvas.classList.contains("spreadsheet-cursor");
        if (change) {
          this.context.canvas.style.cursor = "";
          this.context.canvas.classList.add("spreadsheet-cursor");
        }
      }
      return;
    }
    if (corePointer && corePointer !== "default")
      return;
    if (app.file.textCursor.visible) {
      this.context.canvas.style.cursor = "text";
    } else if (app.map._docLayer._docType === "presentation") {
      this.context.canvas.style.cursor = "";
    }
  }
  cancelSwipe() {
    this.inSwipeAction = false;
    if (this.containerObject.getAnimatingSectionName() === this.name)
      this.containerObject.stopAnimating();
  }
  // Scrolls by a core pixel distance, as a scroll the user makes with a finger. Returns
  // true when the view position changed.
  scrollViewBy(pX, pY) {
    Util.ensureValue(app.activeDocument);
    const userIsScrolling = true;
    return app.activeDocument.activeLayout.scroll(pX, pY, userIsScrolling);
  }
  onDraw(frameCount, elapsedTime) {
    if (this.inSwipeAction) {
      const elapsed = Date.now() - this.swipeTimeStamp;
      const delta = [
        this.amplitude[0] * Math.exp(-elapsed / 650),
        this.amplitude[1] * Math.exp(-elapsed / 650)
      ];
      if (Math.abs(delta[0]) > 0.2 || Math.abs(delta[1]) > 0.2) {
        if (!this.scrollViewBy(delta[0], delta[1]))
          this.cancelSwipe();
      } else
        this.cancelSwipe();
    }
  }
  // Comment from original author:
  /*
      Code and maths for the ergonomic scrolling is inspired by formulas at
      https://ariya.io/2013/11/javascript-kinetic-scrolling-part-2
      Some constants are changed based on the testing/experimenting/trial-error
  */
  swipe(e) {
    const pointVelocity = [e.velocityX, e.velocityY];
    if (this.inSwipeAction) {
      this.swipeVelocity[0] += pointVelocity[0];
      this.swipeVelocity[1] += pointVelocity[1];
    } else {
      this.swipeVelocity = pointVelocity;
      this.inSwipeAction = true;
    }
    this.amplitude = [this.swipeVelocity[0] * 0.1, this.swipeVelocity[1] * 0.1];
    this.swipeTimeStamp = Date.now();
    const animatingSection = this.containerObject.getAnimatingSectionName();
    if (!animatingSection)
      this.startAnimating({ defer: true });
    app.idleHandler.notifyActive();
  }
  onMouseMove(point, dragDistance, e) {
    var _a;
    this.refreshPosition(point);
    this.setCursorType();
    if (!this.containerObject.isDraggingSomething())
      OtherViewCellCursorSection.checkHover([
        point.pX + this.myTopLeft[0],
        point.pY + this.myTopLeft[1]
      ]);
    if (this.clickTimer)
      return;
    clearTimeout(this.mouseMoveTimer);
    const count = 1;
    const modifier = _MouseControl.readModifier(e);
    if (!this.containerObject.isDraggingSomething()) {
      this.mouseMoveTimer = setTimeout(() => {
        this.postCoreMouseEvent("move", this.currentPosition, count, 0, modifier);
      }, 100);
    } else if (e.type === "touchmove" && this.lastTouchDragPoint) {
      this.scrollViewBy(this.lastTouchDragPoint.pX - point.pX, this.lastTouchDragPoint.pY - point.pY);
      this.lastTouchDragPoint = point.clone();
    } else {
      this.lastDragLocalPoint = point.clone();
      this.lastDragModifier = modifier;
      if (this.carryTheObject(modifier))
        return;
      if (this.drawTheFrame()) {
        point.pX += this.position[0];
        point.pY += this.position[1];
        app.map.fire("handleautoscroll", {
          pos: { x: point.cX, y: point.cY },
          map: app.map
        });
        app.idleHandler.notifyActive();
        return;
      }
      if (this.pressedInSelection) {
        if (!this.mouseDownSent && !this.isClearSelectionDrag(dragDistance))
          return;
      } else if (this.selectCellsByDrag()) {
        point.pX += this.position[0];
        point.pY += this.position[1];
        app.map.fire("handleautoscroll", {
          pos: { x: point.cX, y: point.cY },
          map: app.map
        });
        app.idleHandler.notifyActive();
        return;
      } else if (this.selectingText || this.startSelectingText()) {
        point.pX += this.position[0];
        point.pY += this.position[1];
        app.map.fire("handleautoscroll", {
          pos: { x: point.cX, y: point.cY },
          map: app.map
        });
        RenderManager.dragTextTo(this.currentPosition.x, this.currentPosition.y);
        app.idleHandler.notifyActive();
        return;
      }
      if (!this.mouseDownSent && this.positionOnMouseDown) {
        if (this.pressedInSelection)
          (_a = app.map.contextToolbar) == null ? void 0 : _a.hideForDrag();
        this.postCoreMouseEvent("buttondown", this.positionOnMouseDown, count, app.LOButtons.left, this.modifierOnMouseDown);
        this.mouseDownSent = true;
      }
      point.pX += this.position[0];
      point.pY += this.position[1];
      app.map.fire("handleautoscroll", {
        pos: { x: point.cX, y: point.cY },
        map: app.map
      });
      this.postCoreMouseEvent("move", this.currentPosition, count, app.LOButtons.left, modifier);
      this.showShapeDragPreview(dragDistance);
    }
    app.idleHandler.notifyActive();
  }
  // Shows unselected shapes drag preview
  showShapeDragPreview(dragDistance) {
    var _a, _b, _c;
    if (app.file.textCursor.visible || TextSelections.isActive())
      return;
    const handles = GraphicSelection.handlesSection;
    if (!((_a = handles == null ? void 0 : handles.sectionProperties) == null ? void 0 : _a.svg))
      return;
    if ((_b = handles == null ? void 0 : handles.sectionProperties) == null ? void 0 : _b.hasVideo)
      return;
    if (!((_c = GraphicSelection.extraInfo) == null ? void 0 : _c.isDraggable))
      return;
    handles.sectionProperties.lastDragDistance = [
      dragDistance[0],
      dragDistance[1]
    ];
    this.containerObject.requestReDraw();
    handles.sectionProperties.svg.style.left = String((handles.myTopLeft[0] + dragDistance[0]) / app.dpiScale) + "px";
    handles.sectionProperties.svg.style.top = String((handles.myTopLeft[1] + dragDistance[1]) / app.dpiScale) + "px";
    handles.sectionProperties.svg.style.opacity = "0.5";
    handles.showSVG();
  }
  /*
      Carries the object the press landed on, where the client draws the document from objects
      and the press has turned into a drag. The object is marked first, which puts the section
      that draws a selection there, and that section is then told where the drag goes. Answers
      whether the drag is being carried here, so that nothing of it is sent to the engine.
  */
  carryTheObject(modifier) {
    var _a;
    if (this.mouseDownSent)
      return false;
    if (!this.positionOnMouseDown)
      return false;
    if (!RenderGeometrySection.answersPointer())
      return false;
    if (app.file.textCursor.visible)
      return false;
    if (!this.carrying) {
      const hit = RenderGeometrySection.objectIdAt(this.positionOnMouseDown.x, this.positionOnMouseDown.y);
      if (hit === void 0)
        return false;
      GraphicSelection.pressedAt = new cool.Point(this.positionOnMouseDown.x, this.positionOnMouseDown.y);
      const objectId = Interaction.context().takesHoldFor(hit, modifier);
      if (objectId === void 0)
        return false;
      if (ChangeOutbox.undoOnItsWay()) {
        (_a = GraphicSelection.selectionSection) == null ? void 0 : _a.showTheHoldBack();
        return true;
      }
      GraphicSelection.selectObjects([objectId]);
      GraphicSelection.updateSelectionSection();
      this.carrying = GraphicSelection.selectionSection;
      if (!this.carrying)
        return false;
      this.carrying.beginCarrying(this.positionOnMouseDown);
    }
    this.carrying.carryTo(this.currentPosition);
    return true;
  }
  /*
      Draws the selection frame from where the press landed to the mouse, where the client draws
      the document from objects, the press met no object and had no modifier but Shift, and the
      place one stands at draws frames. Answers whether the frame is drawn here, so that nothing
      of the drag goes to the engine.
  */
  drawTheFrame() {
    if (!this.frameFrom) {
      const press = this.positionOnMouseDown;
      if (this.mouseDownSent || !press || this.pressedInSelection)
        return false;
      if (!RenderGeometrySection.answersPointer())
        return false;
      if (RenderManager.kind() !== "slides")
        return false;
      if (app.file.textCursor.visible)
        return false;
      const modifier = this.modifierOnMouseDown;
      if (modifier !== 0 && modifier !== app.UNOModifier.SHIFT)
        return false;
      if (RenderGeometrySection.objectIdAt(press.x, press.y) !== void 0)
        return false;
      const nowhere = new cool.Range2D(0, 0, 0, 0);
      if (Interaction.context().frameSelects(nowhere, false) === void 0)
        return false;
      this.frameFrom = press.clone();
    }
    RenderGeometrySection.frame = cool.Range2D.fromPoints([
      this.frameFrom,
      this.currentPosition
    ]);
    this.containerObject.requestReDraw();
    return true;
  }
  /// Selects what the frame holds, where finish is set, and takes the frame away either way.
  stopTheFrame(finish) {
    if (!this.frameFrom)
      return;
    const frame = RenderGeometrySection.frame;
    const extending = this.modifierOnMouseDown === app.UNOModifier.SHIFT;
    this.frameFrom = null;
    RenderGeometrySection.frame = void 0;
    app.map.fire("scrollvelocity", { vx: 0, vy: 0 });
    this.containerObject.requestReDraw();
    const selection = finish && frame ? Interaction.context().frameSelects(frame, extending) : void 0;
    if (!selection)
      return;
    GraphicSelection.selectObjects(selection);
    GraphicSelection.updateSelectionSection();
  }
  /// Lets a carried object go where it now stands, or lets it be, and forgets it either way.
  stopCarrying(finish) {
    if (!this.carrying)
      return;
    if (finish)
      this.carrying.finishCarrying(this.currentPosition);
    else
      this.carrying.cancelCarrying();
    this.carrying = null;
  }
  // Whether a drag from inside the selection is clear enough to move the selection.
  isClearSelectionDrag(dragDistance) {
    if (!this.timeOfFirstDragMove)
      this.timeOfFirstDragMove = Date.now();
    const distance = Math.hypot(dragDistance[0], dragDistance[1]) / app.dpiScale;
    return distance > _MouseControl.selectionDragDistance || this.timeOfFirstDragMove - this.timeOfPress >= _MouseControl.selectionDragHoldTime;
  }
  /// Whether the document was told to drag as well, which it then has to be told to stop.
  startedDocumentDrag() {
    return this.mouseDownSent;
  }
  /*
      The drag is off: the copy of the shape that followed the mouse goes back, and nothing more
      of this press is sent to the document - the button coming up would otherwise finish a drag
      that is no longer wanted.
  */
  onDragCancel() {
    DropCaretSection.hide();
    this.stopCarrying(false);
    this.stopTheFrame(false);
    this.cellsFrom = null;
    this.cellsTo = null;
    this.hideShapeDragPreview();
    this.stopSelectingText();
    this.mouseDownSent = false;
    this.positionOnMouseDown = null;
    this.lastDragLocalPoint = null;
    this.pressedInSelection = false;
  }
  hideShapeDragPreview() {
    var _a;
    const handles = GraphicSelection.handlesSection;
    if (!((_a = handles == null ? void 0 : handles.sectionProperties) == null ? void 0 : _a.svg))
      return;
    handles.sectionProperties.lastDragDistance = [0, 0];
    handles.sectionProperties.svg.style.opacity = "1";
    handles.hideSVG();
  }
  // Called whenever the document scrolls or pans. During a button-down drag
  // the mouse can stay still while the view moves, so the mouse now points at
  // a different document position. Recompute that position from the unchanged
  // screen point and re-send the drag move so the selection follows the view.
  onNewDocumentTopLeft() {
    if (this.selectingText && this.lastDragLocalPoint) {
      this.refreshPosition(this.lastDragLocalPoint);
      RenderManager.dragTextTo(this.currentPosition.x, this.currentPosition.y);
      return;
    }
    if (this.frameFrom && this.lastDragLocalPoint) {
      this.refreshPosition(this.lastDragLocalPoint);
      this.drawTheFrame();
      return;
    }
    if (!this.mouseDownSent || !this.lastDragLocalPoint)
      return;
    this.refreshPosition(this.lastDragLocalPoint);
    this.postCoreMouseEvent("move", this.currentPosition, 1, app.LOButtons.left, this.lastDragModifier);
  }
  onMouseDown(point, e) {
    var _a;
    this.stopTheFrame(false);
    this.refreshPosition(point);
    this.positionOnMouseDown = this.currentPosition.clone();
    this.modifierOnMouseDown = _MouseControl.readModifier(e);
    this.timeOfPress = Date.now();
    this.timeOfFirstDragMove = 0;
    this.pressedInSelection = e.type !== "touchstart" && !(this.modifierOnMouseDown & app.UNOModifier.SHIFT) && !!((_a = app.activeDocument) == null ? void 0 : _a.activeView.selectionContains(_MouseControl.toDocumentPoint(this.positionOnMouseDown)));
    if (e.type === "touchstart") {
      this.localPositionOnMouseDown = point.clone();
      this.lastTouchDragPoint = point.clone();
      this.touchstart = Date.now();
    }
  }
  onMouseUp(point, e) {
    this.refreshPosition(point);
    this.stopCarrying(true);
    this.stopTheFrame(true);
    this.stopSelectingText();
    this.cellsFrom = null;
    this.cellsTo = null;
    this.hideShapeDragPreview();
    DropCaretSection.hide();
    if (this.mouseDownSent) {
      this.postCoreMouseEvent("buttonup", this.currentPosition, 1, app.LOButtons.left, _MouseControl.readModifier(e));
      app.map.fire("scrollvelocity", { vx: 0, vy: 0 });
    } else if (this.pressedInSelection && this.positionOnMouseDown && this.containerObject.isDraggingSomething()) {
      this.sendClick({
        sendingPosition: this.positionOnMouseDown,
        buttons: app.LOButtons.left,
        modifier: this.modifierOnMouseDown
      }, 1);
    } else if (e.type === "touchend" && this.localPositionOnMouseDown) {
      const diff = new cool.SimplePoint(this.localPositionOnMouseDown.x - point.x, this.localPositionOnMouseDown.y - point.y);
      const timeDiff = Date.now() - this.touchstart;
      if (timeDiff < 200 && (Math.abs(diff.cX) > 5 || Math.abs(diff.cY) > 5))
        this.swipe({ velocityX: diff.pX, velocityY: diff.pY });
      else if (this.inSwipeAction)
        this.cancelSwipe();
      this.localPositionOnMouseDown = null;
    }
    this.positionOnMouseDown = null;
    this.lastTouchDragPoint = null;
    this.mouseDownSent = false;
    this.lastDragLocalPoint = null;
    this.pressedInSelection = false;
    if (this.containerObject.isDraggingSomething())
      app.map.refocus();
  }
  onMouseEnter(point, e) {
    if (app.map._docLayer._docType === "spreadsheet") {
      this.context.canvas.classList.add("spreadsheet-cursor");
    }
    this.context.canvas.style.cursor = "";
  }
  onMouseLeave(point, e) {
    if (app.map._docLayer._docType === "spreadsheet") {
      this.context.canvas.classList.remove("spreadsheet-cursor");
      OtherViewCellCursorSection.resetHover();
    }
  }
  getMobileKeyboardVisibility() {
    if (!app.map._docLayer)
      return false;
    else if (app.map._docLayer._docType === "text")
      return true;
    else if (app.map._docLayer._docType === "spreadsheet") {
      const acceptInput = app.calc.cellCursorVisible && app.calc.cellCursorRectangle && app.calc.cellCursorRectangle.containsPoint(this.currentPosition.toArray());
      return acceptInput;
    } else
      return false;
  }
  sendClick(clickInfo, count) {
    this.postCoreMouseEvent("buttondown", clickInfo.sendingPosition, count, clickInfo.buttons, clickInfo.modifier);
    this.postCoreMouseEvent("buttonup", clickInfo.sendingPosition, count, clickInfo.buttons, clickInfo.modifier);
  }
  /*
          Answers a click from the geometry the client holds, where the context takes it. The hit
          test is asked at the position of this click, so what is marked is what the click met and
          not what the mouse passed over earlier.
  
          False where the click is not one for selecting here: another button, a document not drawn
          from objects, a click while a text edit runs, which the engine ends on its own, or one the
          context leaves to the engine. Those take the click path to the engine.
      */
  selectObjectAt(point, buttons, modifier) {
    if (buttons !== app.LOButtons.left)
      return false;
    if (!RenderGeometrySection.answersPointer())
      return false;
    if (app.file.textCursor.visible)
      return false;
    GraphicSelection.pressedAt = new cool.Point(point.x, point.y);
    const alt = app.UNOModifier.ALT;
    const taken = modifier === alt || modifier === (alt | app.UNOModifier.SHIFT) ? Interaction.context().altPress(RenderGeometrySection.objectIdsAt(point.x, point.y), modifier !== alt) : Interaction.context().press(RenderGeometrySection.objectIdAt(point.x, point.y), modifier);
    if (taken)
      GraphicSelection.updateSelectionSection();
    return taken;
  }
  /// True while text is edited and the client answers presses in it from the objects it
  /// holds.
  static editsTextHere() {
    return app.file.textCursor.visible && RenderGeometrySection.answersPointer();
  }
  /// Starts a drag that selects text here when a plain left press landed in the edited text.
  /// Any other press goes to the engine.
  startSelectingText() {
    const press = this.positionOnMouseDown;
    if (!press || this.mouseDownSent || this.modifierOnMouseDown !== 0)
      return false;
    if (!_MouseControl.editsTextHere())
      return false;
    this.selectingText = RenderManager.startTextDrag(press.x, press.y, RenderGeometrySection.objectIdAt(press.x, press.y));
    return this.selectingText;
  }
  /*
      Selects cells of a table by a drag, in the table context: a drag that selects text in the
      edited cell turns into one that selects cells once it reaches another cell, from the cell
      it started in to the one under the mouse, as in the office. Answers whether the drag
      selects cells.
  */
  selectCellsByDrag() {
    const press = this.positionOnMouseDown;
    if (!press)
      return false;
    const context = Interaction.context();
    if (!(context instanceof ClassicTableContext))
      return false;
    const data = ClassicTableContext.data();
    if (!data)
      return false;
    const table = ClassicTableContext.layout(data);
    const now = ClassicTableContext.cellAt(table, this.currentPosition.x, this.currentPosition.y);
    if (!this.cellsFrom) {
      if (!this.selectingText || !now)
        return false;
      const from = ClassicTableContext.cellAt(table, press.x, press.y);
      if (!from || from.column === now.column && from.row === now.row)
        return false;
      this.stopSelectingText();
      this.cellsFrom = from;
    }
    if (now && (!this.cellsTo || now.column !== this.cellsTo.column || now.row !== this.cellsTo.row)) {
      this.cellsTo = now;
      context.selectCellRange(this.cellsFrom, now);
    }
    return true;
  }
  /*
      Selects cells of a table by Shift and a click on a cell, in the table context: from the
      cell being edited, or from the cell a selection of cells started at, to the clicked one.
      Answers whether the click was taken so.
  */
  selectCellsByShiftClick(point, buttons, modifier) {
    if (buttons !== app.LOButtons.left || modifier !== app.UNOModifier.SHIFT)
      return false;
    const context = Interaction.context();
    if (!(context instanceof ClassicTableContext))
      return false;
    const data = ClassicTableContext.data();
    if (!data)
      return false;
    const table = ClassicTableContext.layout(data);
    const to = ClassicTableContext.cellAt(table, point.x, point.y);
    const from = _MouseControl.editsTextHere() ? ClassicTableContext.editedCell(table) : app.map._docLayer._cellSelectionArea ? ClassicTableContext.anchor : null;
    if (!from || !to)
      return false;
    if (_MouseControl.editsTextHere() && from.column === to.column && from.row === to.row)
      return false;
    context.selectCellRange(from, to);
    return true;
  }
  stopSelectingText() {
    if (!this.selectingText)
      return;
    this.selectingText = false;
    app.map.fire("scrollvelocity", { vx: 0, vy: 0 });
    RenderManager.endTextDrag();
  }
  /// Puts the caret where a plain left click lands in the edited text, without the server.
  /// False when the click is for the engine: another button, a modifier, no text edit, or a
  /// point off the text.
  placeCaretAt(point, buttons, modifier) {
    if (buttons !== app.LOButtons.left || modifier !== 0)
      return false;
    if (!_MouseControl.editsTextHere())
      return false;
    return RenderManager.placeCaretAt(point.x, point.y, RenderGeometrySection.objectIdAt(point.x, point.y));
  }
  /// Selects the word under a double click, or the paragraph under a triple click, without
  /// the server. False when the click is for the engine, as for a single click, or is a
  /// fourth click or more.
  selectTextAt(clickInfo, count) {
    if (clickInfo.buttons !== app.LOButtons.left || clickInfo.modifier !== 0)
      return false;
    if (!_MouseControl.editsTextHere())
      return false;
    const point = clickInfo.sendingPosition;
    const hitId = RenderGeometrySection.objectIdAt(point.x, point.y);
    if (count === 2)
      return RenderManager.selectWordAt(point.x, point.y, hitId);
    if (count === 3)
      return RenderManager.selectParagraphAt(point.x, point.y, hitId);
    return false;
  }
  /*
      Whether the context takes a double press itself, on the same terms as a single press is
      taken from the geometry the client holds.
  */
  doublePressTaken(clickInfo) {
    if (clickInfo.buttons !== app.LOButtons.left || clickInfo.modifier !== 0)
      return false;
    if (!RenderGeometrySection.answersPointer())
      return false;
    if (app.file.textCursor.visible)
      return false;
    const at = clickInfo.sendingPosition;
    return Interaction.context().doublePress(RenderGeometrySection.objectIdAt(at.x, at.y));
  }
  // A tap outside the open wizard only puts it away, so the cursor stays and a format picked
  // with nothing selected still applies to the next typed text. A snackbar passes it on.
  wizardTakesTheTap() {
    if (window.mode.isDesktop())
      return false;
    const wizard = app.map.uiManager.mobileWizard;
    if (!wizard || !wizard.isOpen())
      return false;
    const element = document.getElementById("mobile-wizard");
    return !(element && element.classList.contains("snackbar"));
  }
  onClick(point, e) {
    var _a;
    if (this.wizardTakesTheTap()) {
      app.map.fire("closemobilewizard");
      return;
    }
    app.map.fire("closepopups");
    app.map.fire("editorgotfocus");
    this.refreshPosition(point);
    this.clickCount++;
    if (!window.mode.isDesktop())
      app.map.fire("closemobilewizard");
    let buttons = app.LOButtons.left;
    let modifier = _MouseControl.readModifier(e);
    const sendingPosition = this.currentPosition.clone();
    if (window.L.Browser.mac) {
      if (modifier == app.UNOModifier.CTRL && buttons == app.LOButtons.left) {
        modifier = 0;
        buttons = app.LOButtons.right;
      }
    }
    const clickInfo = {
      sendingPosition,
      buttons,
      modifier
    };
    const alt = app.UNOModifier.ALT;
    if ((modifier === alt || modifier === (alt | app.UNOModifier.SHIFT)) && this.selectObjectAt(sendingPosition, buttons, modifier)) {
      if (this.clickTimer)
        app.timerRegistry.clearTimeout(this.clickTimer);
      this.clickTimer = null;
      this.pendingClickInfo = null;
      this.clickCount = 0;
      return;
    }
    const pending = (_a = this.pendingClickInfo) == null ? void 0 : _a.sendingPosition;
    const reach = 4 * app.dpiScale;
    if (this.clickTimer && pending && RenderGeometrySection.answersPointer() && (Math.abs(pending.pX - sendingPosition.pX) > reach || Math.abs(pending.pY - sendingPosition.pY) > reach)) {
      this.clickCount--;
      this.flushPendingClick();
      this.clickCount = 1;
    }
    if (this.clickTimer)
      app.timerRegistry.clearTimeout(this.clickTimer);
    else {
      if (!this.selectCellsByShiftClick(sendingPosition, buttons, modifier) && !this.selectObjectAt(sendingPosition, buttons, modifier) && !this.placeCaretAt(sendingPosition, buttons, modifier))
        this.sendClick(clickInfo, 1);
      app.map.focus(window.mode.isDesktop() ? void 0 : this.getMobileKeyboardVisibility());
    }
    this.pendingClickInfo = clickInfo;
    this.clickTimer = app.timerRegistry.setTimeout("clicktimer", () => {
      this.flushPendingClick();
    }, 250);
  }
  // Over a hyperlink, the middle button opens it, the same as Ctrl+Click:
  // send a single left-button click carrying the platform's link modifier
  // so core reports the hyperlink. On macOS the link modifier is the
  // command key; elsewhere it is the control key.
  //
  // Elsewhere, the middle button pastes the primary selection, the
  // browser's own default action for the press. Send a plain left click
  // with no modifier first, so the cell or text cursor moves to the
  // pointer before that paste happens, the same as a left click would
  // move it, instead of the paste landing wherever the cursor was left
  // before.
  onMiddleClick(point, e, openHyperlink) {
    this.refreshPosition(point);
    const modifier = openHyperlink ? window.L.Browser.mac ? app.UNOModifier.CTRLMAC : app.UNOModifier.CTRL : 0;
    this.sendClick({
      sendingPosition: this.currentPosition.clone(),
      buttons: app.LOButtons.left,
      modifier
    }, 1);
    app.map.focus(window.mode.isDesktop() ? void 0 : this.getMobileKeyboardVisibility());
  }
  // Send the deferred multi-click immediately and cancel the pending timer.
  flushPendingClick() {
    if (this.clickTimer) {
      app.timerRegistry.clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    const clickInfo = this.pendingClickInfo;
    if (clickInfo) {
      if (this.clickCount === 3 && app.map._docLayer.isCalc()) {
        this.sendClick(clickInfo, 2);
        this.sendClick(clickInfo, 3);
      } else if (this.clickCount > 1) {
        const taken = this.clickCount === 2 && this.doublePressTaken(clickInfo) || this.selectTextAt(clickInfo, this.clickCount);
        if (!taken)
          this.sendClick(clickInfo, this.clickCount);
      }
    }
    this.pendingClickInfo = null;
    this.clickCount = 0;
  }
  // Pinch zoom is handled by ZoomControl (a window section that receives the
  // same multi-touch events). Here we only interrupt an ongoing swipe.
  onMultiTouchStart(e) {
    if (this.inSwipeAction)
      this.containerObject.stopAnimating();
  }
  // Click at the given point, so that the insert position is as close to it as possible. The point
  // is local to this section, in core pixels.
  moveCursorToPoint(point, modifier) {
    this.refreshPosition(point);
    this.postCoreMouseEvent("buttondown", this.currentPosition, 1, app.LOButtons.left, modifier);
    this.postCoreMouseEvent("buttonup", this.currentPosition, 1, app.LOButtons.left, modifier);
  }
  onDrop(position, e) {
    this.moveCursorToPoint(position, _MouseControl.readModifier(e));
    if (app.map._clip && e.dataTransfer) {
      const htmlText = e.dataTransfer.getData("text/html");
      app.map._clip.dataTransferToDocument(
        e.dataTransfer,
        /* preferInternal = */
        false,
        htmlText
      );
    }
  }
};
_MouseControl.selectionDragDistance = 10;
_MouseControl.selectionDragHoldTime = 300;
let MouseControl = _MouseControl;
