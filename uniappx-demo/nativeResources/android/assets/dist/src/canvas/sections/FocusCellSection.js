const _FocusCellSection = class _FocusCellSection extends CanvasSectionObject {
  constructor() {
    super(app.CSections.FocusCell.name);
    this.processingOrder = app.CSections.FocusCell.processingOrder;
    this.drawingOrder = app.CSections.FocusCell.drawingOrder;
    this.zIndex = app.CSections.FocusCell.zIndex;
    this.documentObject = true;
    this.interactable = false;
    this.position = [0, 0];
    this.sectionProperties.columnRectangle = null;
    this.sectionProperties.rowRectangle = null;
    this.sectionProperties.maxCol = 268435455;
    this.sectionProperties.maxRow = 20971124;
    this.isAlwaysVisible = true;
  }
  static addFocusCellSection() {
    if (_FocusCellSection.instance === null) {
      _FocusCellSection.instance = new _FocusCellSection();
      app.sectionContainer.addSection(_FocusCellSection.instance);
    }
    this.instance.setShowSection(true);
    this.instance.onCellAddressChanged();
  }
  static hideFocusCellSection() {
    if (_FocusCellSection.instance)
      _FocusCellSection.instance.setShowSection(false);
  }
  static showFocusCellSection() {
    if (_FocusCellSection.instance)
      _FocusCellSection.instance.setShowSection(true);
    else {
      this.addFocusCellSection();
    }
  }
  onDraw() {
    var _a, _b;
    Util.ensureValue(app.activeDocument);
    Util.ensureValue(app.calc.splitCoordinate);
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    const style = getComputedStyle(document.documentElement).getPropertyValue("--column-row-highlight");
    this.context.fillStyle = style;
    this.context.strokeStyle = style;
    this.context.globalAlpha = 0.3;
    let cursor = (_a = app.calc.cellCursorRectangle) == null ? void 0 : _a.clone();
    if (!cursor)
      return;
    cursor.pX1 = app.calc.splitCoordinate.pX !== 0 ? 0 : app.activeDocument.activeLayout.viewedRectangle.pX1;
    cursor.pX2 = app.activeDocument.activeLayout.viewedRectangle.pX2;
    this.drawViewRectangle(cursor, true);
    cursor = (_b = app.calc.cellCursorRectangle) == null ? void 0 : _b.clone();
    if (!cursor)
      return;
    cursor.pY1 = app.calc.splitCoordinate.pY !== 0 ? 0 : app.activeDocument.activeLayout.viewedRectangle.pY1;
    cursor.pY2 = app.activeDocument.activeLayout.viewedRectangle.pY2;
    this.drawViewRectangle(cursor, true);
    this.context.restore();
  }
};
_FocusCellSection.instance = null;
let FocusCellSection = _FocusCellSection;
