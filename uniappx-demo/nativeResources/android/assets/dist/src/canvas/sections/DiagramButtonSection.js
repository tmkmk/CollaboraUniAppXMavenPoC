const _DiagramButtonSection = class _DiagramButtonSection extends GenericButtonSection {
  constructor(_halfWidthPixels) {
    super(_DiagramButtonSection.namePrefix, _DiagramButtonSection.sizeButtons, _DiagramButtonSection.sizeButtons, _DiagramButtonSection.className, _DiagramButtonSection.unoCommand);
    this.halfWidthPixels = 0;
    this.halfWidthPixels = _halfWidthPixels;
    this.sectionProperties.lastInputEvent = null;
    this.updatePosition();
  }
  calculatePositionPixel() {
    Util.ensureValue(GraphicSelection.rectangle);
    return [
      Math.round(GraphicSelection.rectangle.x2 * app.twipsToPixels + this.halfWidthPixels + _DiagramButtonSection.sizeSpaceBetweenButtons),
      Math.round(GraphicSelection.rectangle.y1 * app.twipsToPixels)
    ];
  }
};
_DiagramButtonSection.namePrefix = "DiagramContextButton_";
_DiagramButtonSection.className = "general-select-theme";
_DiagramButtonSection.unoCommand = "uno .uno:EditDiagram";
_DiagramButtonSection.sizeButtons = 32;
_DiagramButtonSection.sizeSpaceBetweenButtons = 5;
let DiagramButtonSection = _DiagramButtonSection;
