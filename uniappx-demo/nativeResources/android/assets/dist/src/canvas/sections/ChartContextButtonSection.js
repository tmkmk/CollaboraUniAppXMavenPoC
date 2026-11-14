const _ChartContextButtonSection = class _ChartContextButtonSection extends GenericButtonSection {
  constructor(buttonType) {
    super(_ChartContextButtonSection.namePrefix + buttonType, _ChartContextButtonSection.sizeButtons, _ChartContextButtonSection.sizeButtons, _ChartContextButtonSection.classNames[buttonType], _ChartContextButtonSection.unoCommands[buttonType]);
    this.sectionProperties.buttonType = buttonType;
    this.sectionProperties.lastInputEvent = null;
    this.updatePosition();
  }
  calculatePositionPixel() {
    Util.ensureValue(GraphicSelection.rectangle);
    return [
      Math.round(GraphicSelection.rectangle.x2 * app.twipsToPixels + _ChartContextButtonSection.sizeSpaceBetweenButtons),
      Math.round(GraphicSelection.rectangle.y1 * app.twipsToPixels + this.sectionProperties.buttonType * (_ChartContextButtonSection.sizeButtons + _ChartContextButtonSection.sizeSpaceBetweenButtons))
    ];
  }
  showChartContextToolbar() {
    this.setShowSection(true);
  }
};
_ChartContextButtonSection.namePrefix = "ChartContextButton_";
_ChartContextButtonSection.classNames = [
  "general-select-theme",
  "chart-save-to-new-theme"
];
_ChartContextButtonSection.unoCommands = [
  "uno .uno:SelectTheme",
  "uno .uno:ChartSaveToNewTheme"
];
_ChartContextButtonSection.sizeButtons = 32;
_ChartContextButtonSection.sizeSpaceBetweenButtons = 5;
let ChartContextButtonSection = _ChartContextButtonSection;
