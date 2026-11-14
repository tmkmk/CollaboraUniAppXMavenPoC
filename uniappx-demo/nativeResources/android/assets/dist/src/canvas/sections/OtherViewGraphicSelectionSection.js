const _OtherViewGraphicSelectionSection = class _OtherViewGraphicSelectionSection extends CanvasSectionObject {
  constructor(viewId, rectangle, part, mode) {
    super(_OtherViewGraphicSelectionSection.sectionNamePrefix + viewId);
    this.documentObject = true;
    this.interactable = false;
    this.zIndex = app.CSections.DefaultForDocumentObjects.zIndex;
    this.drawingOrder = app.CSections.DefaultForDocumentObjects.drawingOrder;
    this.processingOrder = app.CSections.DefaultForDocumentObjects.processingOrder;
    this.size = [rectangle.pWidth, rectangle.pHeight];
    this.position = [rectangle.pX1, rectangle.pY1];
    this.sectionProperties.color = app.LOUtil.rgbToHex(app.LOUtil.getViewIdColor(viewId));
    this.sectionProperties.viewId = viewId;
    this.sectionProperties.part = part;
    this.sectionProperties.mode = mode;
    this.sectionProperties.viewLockInfo = null;
  }
  onDraw(frameCount, elapsedTime) {
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.strokeStyle = this.sectionProperties.color;
    this.context.lineWidth = 2;
    this.drawViewRectangle(this.boundingRectangle);
    this.context.restore();
  }
  // The index the part of this selection holds in the current part list, or -1 when no part
  // carries it. The part is kept as its identifier, because the index of a slide changes when
  // slides are inserted, deleted or moved.
  getPartIndex() {
    return app.map._docLayer.getIndexFromPart(this.sectionProperties.part);
  }
  checkMyVisibility() {
    Util.ensureValue(app.activeDocument);
    let result = this.size[0] > 0 && this.size[1] > 0;
    if (result) {
      if (!app.map._docLayer.isWriter()) {
        if (this.getPartIndex() !== app.map._docLayer._selectedPart || !app.activeDocument.isModeActive(this.sectionProperties.mode))
          result = false;
      }
    }
    return result;
  }
  static addOrUpdateGraphicSelectionIndicator(viewId, rectangleData, part, mode) {
    let rectangle = new cool.SimpleRectangle(0, 0, 0, 0);
    if (rectangleData)
      rectangle = new cool.SimpleRectangle(parseInt(rectangleData[0]), parseInt(rectangleData[1]), parseInt(rectangleData[2]), parseInt(rectangleData[3]));
    if (app.map._docLayer.isCalc() && app.map._docLayer.sheetGeometry)
      app.map._docLayer.sheetGeometry.convertRectangleToTileTwipsWithoutGridSnap(rectangle);
    const sectionName = _OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
    let section;
    if (app.sectionContainer.doesSectionExist(sectionName)) {
      section = app.sectionContainer.getSectionWithName(sectionName);
      section.sectionProperties.part = part;
      section.sectionProperties.mode = mode;
      section.size[0] = rectangle.pWidth;
      section.size[1] = rectangle.pHeight;
      section.setPosition(rectangle.pX1, rectangle.pY1);
    } else {
      section = new _OtherViewGraphicSelectionSection(viewId, rectangle, part, mode);
      app.sectionContainer.addSection(section);
      _OtherViewGraphicSelectionSection.sectionPointers.push(section);
    }
    section.setShowSection(section.checkMyVisibility());
    ShapeLockLabelSection.update(viewId);
    app.sectionContainer.requestReDraw();
  }
  static removeView(viewId) {
    const sectionName = _OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
    if (app.sectionContainer.doesSectionExist(sectionName)) {
      const section = app.sectionContainer.getSectionWithName(sectionName);
      _OtherViewGraphicSelectionSection.sectionPointers.splice(_OtherViewGraphicSelectionSection.sectionPointers.indexOf(section), 1);
      app.sectionContainer.removeSection(sectionName);
      app.sectionContainer.requestReDraw();
    }
  }
  static setViewLockInfo(viewId, viewLockInfo) {
    const sectionName = _OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
    if (app.sectionContainer.doesSectionExist(sectionName)) {
      const section = app.sectionContainer.getSectionWithName(sectionName);
      section.sectionProperties.viewLockInfo = viewLockInfo;
    }
  }
  static hasViewLockInfo(viewId) {
    const sectionName = _OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
    if (app.sectionContainer.doesSectionExist(sectionName)) {
      const section = app.sectionContainer.getSectionWithName(sectionName);
      return section.sectionProperties.viewLockInfo !== null;
    } else
      return false;
  }
  static doesViewExist(viewId) {
    const name = _OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
    return app.sectionContainer.doesSectionExist(name);
  }
  static getViewSection(viewId) {
    if (_OtherViewGraphicSelectionSection.doesViewExist(viewId)) {
      const name = _OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
      return app.sectionContainer.getSectionWithName(name);
    }
    return null;
  }
  static updateVisibilities() {
    for (let i = 0; i < _OtherViewGraphicSelectionSection.sectionPointers.length; i++) {
      const section = _OtherViewGraphicSelectionSection.sectionPointers[i];
      section.setShowSection(section.checkMyVisibility());
    }
    ShapeLockLabelSection.updateVisibilities();
    app.sectionContainer.requestReDraw();
  }
};
_OtherViewGraphicSelectionSection.sectionNamePrefix = "OtherViewGraphicSelection ";
_OtherViewGraphicSelectionSection.sectionPointers = [];
let OtherViewGraphicSelectionSection = _OtherViewGraphicSelectionSection;
