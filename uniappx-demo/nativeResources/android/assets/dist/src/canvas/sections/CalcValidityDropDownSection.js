const _CalcValidityDropDown = class _CalcValidityDropDown extends HTMLObjectSection {
  // Size of the validity drop-down arrow in CSS pixels.
  constructor(documentPosition, visible = true) {
    super(app.CSections.CalcValidityDropDown.name, _CalcValidityDropDown.dropDownArrowSize, _CalcValidityDropDown.dropDownArrowSize, documentPosition, "spreadsheet-drop-down-marker", visible);
    this.zIndex = app.CSections.CalcValidityDropDown.zIndex;
    this.sectionProperties.mouseEntered = false;
  }
  onMouseEnter(point, e) {
    this.sectionProperties.mouseEntered = true;
  }
  onMouseLeave() {
    this.sectionProperties.mouseEntered = false;
  }
  onClick(point, e) {
    var _a;
    e.stopPropagation();
    e.preventDefault();
    this.stopPropagating();
    const _validatedCellAddress = app.map._docLayer._validatedCellAddress;
    if (_validatedCellAddress && app.calc.cellCursorVisible && _validatedCellAddress.equals(((_a = app.calc.cellAddress) == null ? void 0 : _a.toArray()) ?? [])) {
      app.map.sendUnoCommand(".uno:DataSelect");
    }
  }
};
_CalcValidityDropDown.dropDownArrowSize = 16;
let CalcValidityDropDown = _CalcValidityDropDown;
