const _DropCaretSection = class _DropCaretSection extends HTMLObjectSection {
  constructor() {
    super(_DropCaretSection.sectionName, _DropCaretSection.caretWidth, 0, new cool.SimplePoint(0, 0), "text-drop-caret", false);
  }
  // Shows the caret at the given cursor rectangle, in twips.
  static showAt(rectangle) {
    let section;
    if (app.sectionContainer.doesSectionExist(_DropCaretSection.sectionName)) {
      section = app.sectionContainer.getSectionWithName(_DropCaretSection.sectionName);
    } else {
      section = new _DropCaretSection();
      app.sectionContainer.addSection(section);
    }
    section.size = [
      _DropCaretSection.caretWidth * app.dpiScale,
      rectangle.pHeight
    ];
    section.getHTMLObject().style.height = rectangle.pHeight / app.dpiScale + "px";
    section.setPosition(rectangle.pX1, rectangle.pY1);
    section.setShowSection(true);
    section.onNewDocumentTopLeft();
    app.sectionContainer.requestReDraw();
  }
  static hide() {
    if (!app.sectionContainer.doesSectionExist(_DropCaretSection.sectionName))
      return;
    const section = app.sectionContainer.getSectionWithName(_DropCaretSection.sectionName);
    if (!section.showSection)
      return;
    section.setShowSection(false);
    app.sectionContainer.requestReDraw();
  }
};
_DropCaretSection.sectionName = "drop caret";
_DropCaretSection.caretWidth = 2;
let DropCaretSection = _DropCaretSection;
