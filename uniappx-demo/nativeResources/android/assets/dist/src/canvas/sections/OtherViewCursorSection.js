const _TextCursorSection = class _TextCursorSection extends HTMLObjectSection {
  constructor(viewId, color, rectangle, part, mode) {
    super(_TextCursorSection.sectionNamePrefix + viewId, rectangle.pWidth / app.dpiScale, rectangle.pHeight / app.dpiScale, new cool.SimplePoint(rectangle.x1, rectangle.y1));
    this.documentObject = true;
    this.interactable = true;
    this.zIndex = app.CSections.DefaultForDocumentObjects.zIndex;
    this.drawingOrder = app.CSections.DefaultForDocumentObjects.drawingOrder;
    this.processingOrder = app.CSections.DefaultForDocumentObjects.processingOrder;
    this.sectionProperties.color = color;
    this.sectionProperties.viewId = viewId;
    this.sectionProperties.part = part;
    this.sectionProperties.mode = mode;
    this.sectionProperties.showCursor = true;
    this.showSection = true;
    this.getHTMLObject().style.backgroundColor = this.sectionProperties.color;
  }
  onDraw(frameCount, elapsedTime) {
    if (app.sectionContainer.isInZoomAnimation())
      super.onDraw(frameCount, elapsedTime);
  }
  // The index the part of this cursor holds in the current part list, or -1 when no part
  // carries it. The part is kept as its identifier, because the index of a slide changes when
  // slides are inserted, deleted or moved.
  getPartIndex() {
    return app.map._docLayer.getIndexFromPart(this.sectionProperties.part);
  }
  checkMyVisibility() {
    Util.ensureValue(app.activeDocument);
    let result = this.sectionProperties.showCursor && this.size[1] > 0;
    if (result) {
      if (!app.map._docLayer.isWriter()) {
        if (this.getPartIndex() !== app.map._docLayer._selectedPart || !app.activeDocument.isModeActive(this.sectionProperties.mode))
          result = false;
      }
    }
    if (result && app.file.textCursor.visible) {
      Util.ensureValue(app.file.textCursor.rectangle);
      const pos = [
        app.file.textCursor.rectangle.pX1,
        app.file.textCursor.rectangle.pY1
      ];
      if (this.position[0] === pos[0] && this.position[1] === pos[1])
        result = false;
    }
    if (result && app.map.isViewReadOnly(this.sectionProperties.viewId))
      result = false;
    return result;
  }
  // Show or hide the cursor according to the current state. The place of the
  // HTML object is held as a copy of a view-relative coordinate, so it is
  // taken again here: the visible area can have moved since the last cursor
  // position arrived.
  applyVisibility() {
    this.setPosition(this.position[0], this.position[1]);
    this.setShowSection(this.checkMyVisibility());
    this.onNewDocumentTopLeft();
  }
  // Calculate the position of the cursor header above the actual cursor.
  getHeaderPosition() {
    return new cool.SimplePoint(this.position[0] * app.pixelsToTwips, (this.position[1] - 20) * app.pixelsToTwips);
  }
  onMouseEnter() {
    if (!this.sectionProperties.username) {
      return;
    }
    app.definitions.cursorHeaderSection.showCursorHeader(this.sectionProperties.viewId, this.sectionProperties.username, this.getHeaderPosition(), this.sectionProperties.color);
  }
  static addOrUpdateOtherViewCursor(viewId, username, rectangleData, part, mode) {
    let rectangle = new cool.SimpleRectangle(0, 0, 0, 0);
    const color = app.LOUtil.rgbToHex(app.LOUtil.getViewIdColor(viewId));
    if (rectangleData) {
      rectangle = new cool.SimpleRectangle(parseInt(rectangleData[0]), parseInt(rectangleData[1]), parseInt(rectangleData[2]), parseInt(rectangleData[3]));
    }
    rectangle.pWidth = 2 * app.dpiScale;
    const sectionName = _TextCursorSection.sectionNamePrefix + viewId;
    let section;
    if (app.sectionContainer.doesSectionExist(sectionName)) {
      section = app.sectionContainer.getSectionWithName(sectionName);
      section.sectionProperties.part = part;
      section.sectionProperties.mode = mode;
      section.size[0] = rectangle.pWidth;
      section.size[1] = rectangle.pHeight;
      section.getHTMLObject().style.width = section.size[0] / app.dpiScale + "px";
      section.getHTMLObject().style.height = section.size[1] / app.dpiScale + "px";
      section.setPosition(rectangle.pX1, rectangle.pY1);
    } else {
      section = new _TextCursorSection(viewId, color, rectangle, part, mode);
      app.sectionContainer.addSection(section);
      _TextCursorSection.sectionPointers.push(section);
    }
    section.applyVisibility();
    section.sectionProperties.username = username;
    if (section.showSection && section.isVisible)
      app.definitions.cursorHeaderSection.showCursorHeader(viewId, username, section.getHeaderPosition(), color);
    app.sectionContainer.requestReDraw();
  }
  static removeView(viewId) {
    const sectionName = _TextCursorSection.sectionNamePrefix + viewId;
    if (app.sectionContainer.doesSectionExist(sectionName)) {
      const section = app.sectionContainer.getSectionWithName(sectionName);
      _TextCursorSection.sectionPointers.splice(_TextCursorSection.sectionPointers.indexOf(section), 1);
      app.sectionContainer.removeSection(sectionName);
      app.sectionContainer.requestReDraw();
    }
  }
  static doesViewCursorSectionExist(viewId) {
    const name = _TextCursorSection.sectionNamePrefix + viewId;
    return app.sectionContainer.doesSectionExist(name);
  }
  static getViewCursorSection(viewId) {
    if (_TextCursorSection.doesViewCursorSectionExist(viewId)) {
      const name = _TextCursorSection.sectionNamePrefix + viewId;
      return app.sectionContainer.getSectionWithName(name);
    } else
      return null;
  }
  static updateVisibilities() {
    for (let i = 0; i < _TextCursorSection.sectionPointers.length; i++) {
      const section = _TextCursorSection.sectionPointers[i];
      section.applyVisibility();
      if (!section.showSection)
        CursorHeaderSection.deletePopUpNow(section.sectionProperties.viewId);
    }
    app.sectionContainer.requestReDraw();
  }
};
_TextCursorSection.sectionNamePrefix = "OtherViewCursor ";
_TextCursorSection.sectionPointers = [];
let TextCursorSection = _TextCursorSection;
