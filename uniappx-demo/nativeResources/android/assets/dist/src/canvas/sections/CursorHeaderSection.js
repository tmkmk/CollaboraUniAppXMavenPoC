const _CursorHeaderSection = class _CursorHeaderSection extends HTMLObjectSection {
  constructor(viewId, username, documentPosition, color) {
    super(_CursorHeaderSection.namePrefix + viewId, null, null, documentPosition, "cursor-header-section");
    this.sectionProperties.deletionTimeout = null;
    this.sectionProperties.viewId = viewId;
    this.sectionProperties.color = color;
    this.sectionProperties.username = username;
    const div = this.getHTMLObject();
    div.textContent = username;
    div.style.color = "white";
    div.style.backgroundColor = color;
  }
  deleteThis(force = false) {
    if (this.sectionProperties.deletionTimeout)
      clearTimeout(this.sectionProperties.deletionTimeout);
    this.sectionProperties.deletionTimeout = setTimeout(() => {
      app.sectionContainer.removeSection(this.name);
    }, force ? 10 : _CursorHeaderSection.duration);
  }
  // This section is for text cursor username popups in Calc. When we want to remove the popup before it times out, we use this function.
  static deletePopUpNow(viewId) {
    const name = _CursorHeaderSection.namePrefix + viewId;
    if (app.sectionContainer.doesSectionExist(name)) {
      const section = app.sectionContainer.getSectionWithName(name);
      section.deleteThis(true);
    }
  }
  static showCursorHeader(viewId, username, documentPosition, color) {
    const sectionName = _CursorHeaderSection.namePrefix + viewId;
    let section;
    if (viewId && !username) {
      section = app.sectionContainer.getSectionWithName(sectionName);
      if (section)
        section.deleteThis();
    } else {
      section = app.sectionContainer.getSectionWithName(sectionName);
      if (!section) {
        section = new _CursorHeaderSection(viewId, username, documentPosition, color);
        app.sectionContainer.addSection(section);
      }
      section.setPosition(documentPosition.pX, documentPosition.pY);
      section.deleteThis();
    }
    if (app.map._docLayer._docType === "spreadsheet") {
      const cellCursorSection = OtherViewCellCursorSection.getViewCursorSection(viewId);
      if (cellCursorSection)
        cellCursorSection.hideUsernamePopUp();
    }
  }
};
_CursorHeaderSection.namePrefix = "CursorHeader ";
_CursorHeaderSection.duration = 3e3;
let CursorHeaderSection = _CursorHeaderSection;
app.definitions.cursorHeaderSection = CursorHeaderSection;
