const _OtherViewCellCursorSection = class _OtherViewCellCursorSection extends CanvasSectionObject {
  // 5 names + 1 summary row
  constructor(viewId, rectangle, part) {
    super(_OtherViewCellCursorSection.sectionNamePrefix + viewId);
    this.documentObject = true;
    this.interactable = false;
    this.zIndex = app.CSections.ColumnHeader.zIndex;
    this.drawingOrder = app.CSections.OtherViewCellCursor.drawingOrder;
    this.processingOrder = app.CSections.OtherViewCellCursor.processingOrder;
    this.size = [rectangle.pWidth, rectangle.pHeight];
    this.position = [rectangle.pX1, rectangle.pY1];
    this.sectionProperties.color = app.LOUtil.rgbToHex(app.LOUtil.getViewIdColor(viewId));
    this.sectionProperties.viewId = viewId;
    this.sectionProperties.part = part;
    this.sectionProperties.popUpContainer = null;
    this.sectionProperties.popUpShown = false;
    this.sectionProperties.username = null;
    this.sectionProperties.popUpTimer = null;
    this.sectionProperties.cellAddress = null;
  }
  onDraw(frameCount, elapsedTime) {
    this.adjustPopUpPosition();
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.strokeStyle = this.sectionProperties.color;
    this.context.lineWidth = 2;
    this.drawViewRectangle(this.boundingRectangle);
    this.context.restore();
  }
  checkMyVisibility() {
    if (app.map._docLayer._selectedPart !== this.sectionProperties.part)
      return false;
    else
      return true;
  }
  adjustPopUpPosition() {
    if (!this.sectionProperties.popUpShown)
      return;
    const width = this.sectionProperties.popUpContainer.getBoundingClientRect().width;
    const height = this.sectionProperties.popUpContainer.getBoundingClientRect().height;
    const anchor = app.sectionContainer.getDocumentAnchor();
    const viewSize = app.sectionContainer.getViewSize();
    const minLeft = anchor[0] / app.dpiScale;
    const minTop = anchor[1] / app.dpiScale;
    const maxLeft = viewSize[0] / app.dpiScale - width;
    const maxTop = viewSize[1] / app.dpiScale - height;
    const arrowGap = 15;
    const above = this.myTopLeft[1] / app.dpiScale - (height + arrowGap);
    const below = (this.myTopLeft[1] + this.size[1]) / app.dpiScale + arrowGap;
    const flipped = above < minTop && below <= maxTop;
    if (flipped !== this.sectionProperties.popUpContainer.classList.contains("below-cell")) {
      this.sectionProperties.popUpContainer.classList.toggle("below-cell", flipped);
      this.updateArrowColor();
    }
    const addition = app.map._docLayer.isCalcRTL() ? -this.size[0] : 0;
    const centered = (this.myTopLeft[0] + addition + this.size[0] * 0.5) / app.dpiScale - width * 0.5;
    const pos = [
      Math.max(minLeft, Math.min(centered, maxLeft)),
      Math.max(minTop, Math.min(flipped ? below : above, maxTop))
    ];
    this.sectionProperties.popUpContainer.style.left = pos[0] + "px";
    this.sectionProperties.popUpContainer.style.top = pos[1] + "px";
    if (!this.showSection)
      this.hideUsernamePopUp();
  }
  onNewDocumentTopLeft() {
    this.adjustPopUpPosition();
  }
  prepareUsernamePopUp() {
    if (this.sectionProperties.popUpContainer === null) {
      const popUpContainer = document.createElement("div");
      popUpContainer.className = "username-pop-up";
      const nameContainer = document.createElement("div");
      popUpContainer.appendChild(nameContainer);
      const arrowDiv = document.createElement("div");
      arrowDiv.className = "arrow-div";
      popUpContainer.appendChild(arrowDiv);
      document.getElementById("document-container").appendChild(popUpContainer);
      this.sectionProperties.popUpContainer = popUpContainer;
      this.sectionProperties.nameContainer = nameContainer;
      this.sectionProperties.arrowDiv = arrowDiv;
      this.hideUsernamePopUp();
    }
  }
  // Every view sitting on this cell, in the order the sections were created, which
  // is also the order they are drawn in.
  getCoLocatedSections() {
    const address = this.sectionProperties.cellAddress;
    if (!address)
      return [this];
    const group = [];
    for (let i = 0; i < _OtherViewCellCursorSection.sectionPointers.length; i++) {
      const section = _OtherViewCellCursorSection.sectionPointers[i];
      if (section.showSection && section.isVisible && section.sectionProperties.part === this.sectionProperties.part && section.sectionProperties.cellAddress === address)
        group.push(section);
    }
    return group;
  }
  fillUsernamePopUp(group) {
    const rows = document.createDocumentFragment();
    const maxRows = _OtherViewCellCursorSection.maxPopUpRows;
    const truncated = group.length > maxRows;
    const shown = truncated ? group.slice(group.length - (maxRows - 1)) : group;
    for (let i = 0; i < shown.length; i++) {
      const row = document.createElement("div");
      row.className = "name-row";
      row.textContent = shown[i].sectionProperties.username;
      row.style.backgroundColor = shown[i].sectionProperties.color;
      rows.appendChild(row);
    }
    if (truncated) {
      const row = document.createElement("div");
      row.className = "name-row more-row";
      row.textContent = _("%n more").replace("%n", (group.length - shown.length).toString());
      rows.appendChild(row);
    }
    this.sectionProperties.nameContainer.replaceChildren(rows);
    this.updateArrowColor();
  }
  updateArrowColor() {
    const rows = this.sectionProperties.nameContainer.children;
    if (rows.length === 0)
      return;
    const flipped = this.sectionProperties.popUpContainer.classList.contains("below-cell");
    const row = flipped ? rows[0] : rows[rows.length - 1];
    this.sectionProperties.arrowDiv.style.backgroundColor = getComputedStyle(row).backgroundColor;
  }
  clearPopUpTimer() {
    if (this.sectionProperties.popUpTimer) {
      clearTimeout(this.sectionProperties.popUpTimer);
      this.sectionProperties.popUpTimer = null;
    }
  }
  showUsernamePopUp() {
    if (!this.sectionProperties.popUpContainer || !this.isVisible)
      return;
    const group = this.getCoLocatedSections();
    const owner = group[group.length - 1];
    if (!owner)
      return;
    if (owner !== this) {
      owner.showUsernamePopUp();
      return;
    }
    _OtherViewCellCursorSection.hidePopUpsForCell(this.sectionProperties.part, this.sectionProperties.cellAddress);
    const named = [];
    for (let i = 0; i < group.length; i++) {
      const headerName = CursorHeaderSection.namePrefix + group[i].sectionProperties.viewId;
      if (!app.sectionContainer.doesSectionExist(headerName))
        named.push(group[i]);
    }
    if (named.length === 0) {
      this.hideUsernamePopUp();
      return;
    }
    this.fillUsernamePopUp(named);
    this.sectionProperties.popUpShown = true;
    this.sectionProperties.popUpContainer.style.display = "";
    this.adjustPopUpPosition();
    this.clearPopUpTimer();
    this.sectionProperties.popUpTimer = setTimeout(() => {
      this.hideUsernamePopUp();
    }, 3e3);
  }
  onRemove() {
    _OtherViewCellCursorSection.hidePopUpsForCell(this.sectionProperties.part, this.sectionProperties.cellAddress);
    this.clearPopUpTimer();
    if (this.sectionProperties.popUpContainer) {
      this.sectionProperties.popUpContainer.remove();
      this.sectionProperties.popUpContainer = null;
    }
  }
  hideUsernamePopUp() {
    if (this.sectionProperties.popUpContainer) {
      this.sectionProperties.popUpShown = false;
      if (this.sectionProperties.popUpContainer.style.display !== "none")
        this.sectionProperties.popUpContainer.style.display = "none";
    }
    this.clearPopUpTimer();
  }
  onDocumentObjectVisibilityChange() {
    if (this.sectionProperties.popUpShown && !this.isVisible)
      this.hideUsernamePopUp();
  }
  // Gives back whether the cursor arrived in another cell, as opposed to the same cell
  // being re-sent with new coordinates.
  static addOrUpdateOtherViewCellCursor(viewId, username, rectangleData, part, cellAddress) {
    let rectangle = new cool.SimpleRectangle(0, 0, 0, 0);
    if (rectangleData)
      rectangle = new cool.SimpleRectangle(parseInt(rectangleData[0]), parseInt(rectangleData[1]), parseInt(rectangleData[2]), parseInt(rectangleData[3]));
    const sectionName = _OtherViewCellCursorSection.sectionNamePrefix + viewId;
    let section;
    let newSection = false;
    let moved = true;
    if (app.sectionContainer.doesSectionExist(sectionName)) {
      section = app.sectionContainer.getSectionWithName(sectionName);
      moved = section.sectionProperties.part !== part || !cellAddress || section.sectionProperties.cellAddress !== cellAddress;
      if (moved)
        _OtherViewCellCursorSection.hidePopUpsForCell(section.sectionProperties.part, section.sectionProperties.cellAddress);
      section.sectionProperties.part = part;
      section.size[0] = rectangle.pWidth;
      section.size[1] = rectangle.pHeight;
      section.setPosition(rectangle.pX1, rectangle.pY1);
    } else {
      section = new _OtherViewCellCursorSection(viewId, rectangle, part);
      app.sectionContainer.addSection(section);
      _OtherViewCellCursorSection.sectionPointers.push(section);
      newSection = true;
    }
    section.sectionProperties.username = username;
    section.sectionProperties.cellAddress = cellAddress;
    section.prepareUsernamePopUp();
    section.setShowSection(section.checkMyVisibility());
    if (section.showSection && !newSection && moved)
      section.showUsernamePopUp();
    if (!section.showSection)
      section.hideUsernamePopUp();
    app.sectionContainer.requestReDraw();
    return moved;
  }
  static resetHover() {
    _OtherViewCellCursorSection.setHoveredView(null);
  }
  // The bubble is supplementary, so it goes as soon as the pointer moves on, leaving
  // one on screen at a time instead of a trail of them. The hide timer stays as a
  // backstop.
  static setHoveredView(section) {
    const viewId = section ? section.sectionProperties.viewId : null;
    const previous = _OtherViewCellCursorSection.hoveredViewId;
    const entered = viewId !== previous;
    if (entered && previous !== null) {
      const previousSection = _OtherViewCellCursorSection.getViewCursorSection(previous);
      if (previousSection && previousSection.sectionProperties.cellAddress === _OtherViewCellCursorSection.hoveredCellAddress)
        previousSection.hideUsernamePopUp();
    }
    _OtherViewCellCursorSection.hoveredViewId = viewId;
    _OtherViewCellCursorSection.hoveredCellAddress = section ? section.sectionProperties.cellAddress : null;
    if (entered && section)
      section.showUsernamePopUp();
  }
  static hidePopUpsForCell(part, cellAddress) {
    if (!cellAddress)
      return;
    for (let i = 0; i < _OtherViewCellCursorSection.sectionPointers.length; i++) {
      const section = _OtherViewCellCursorSection.sectionPointers[i];
      if (section.sectionProperties.part === part && section.sectionProperties.cellAddress === cellAddress)
        section.hideUsernamePopUp();
    }
  }
  static removeView(viewId) {
    if (_OtherViewCellCursorSection.hoveredViewId === viewId)
      _OtherViewCellCursorSection.resetHover();
    const sectionName = _OtherViewCellCursorSection.sectionNamePrefix + viewId;
    if (app.sectionContainer.doesSectionExist(sectionName)) {
      const section = app.sectionContainer.getSectionWithName(sectionName);
      _OtherViewCellCursorSection.sectionPointers.splice(_OtherViewCellCursorSection.sectionPointers.indexOf(section), 1);
      app.sectionContainer.removeSection(sectionName);
      app.sectionContainer.requestReDraw();
    }
  }
  static updateVisibilities() {
    for (let i = 0; i < _OtherViewCellCursorSection.sectionPointers.length; i++) {
      const section = _OtherViewCellCursorSection.sectionPointers[i];
      const newState = section.checkMyVisibility();
      if (newState !== section.showSection) {
        section.setShowSection(newState);
        if (newState === false)
          section.hideUsernamePopUp();
      }
    }
    app.sectionContainer.requestReDraw();
  }
  static closePopups() {
    for (let i = 0; i < _OtherViewCellCursorSection.sectionPointers.length; i++)
      _OtherViewCellCursorSection.sectionPointers[i].hideUsernamePopUp();
  }
  static getViewCursorSection(viewId) {
    const name = _OtherViewCellCursorSection.sectionNamePrefix + viewId;
    return app.sectionContainer.getSectionWithName(name);
  }
  static doesViewCursorExist(viewId) {
    const name = _OtherViewCellCursorSection.sectionNamePrefix + viewId;
    return app.sectionContainer.doesSectionExist(name);
  }
  static showPopUpForView(viewId) {
    const section = _OtherViewCellCursorSection.getViewCursorSection(viewId);
    if (section)
      section.showUsernamePopUp();
  }
  static checkHover(canvasPosition) {
    let hovered = null;
    for (let i = 0; i < _OtherViewCellCursorSection.sectionPointers.length; i++) {
      const section = _OtherViewCellCursorSection.sectionPointers[i];
      if (!section.showSection || !section.isVisible)
        continue;
      if (section.isHit(canvasPosition))
        hovered = section;
    }
    _OtherViewCellCursorSection.setHoveredView(hovered);
  }
};
_OtherViewCellCursorSection.sectionNamePrefix = "OtherViewCellCursorSection ";
_OtherViewCellCursorSection.sectionPointers = [];
_OtherViewCellCursorSection.hoveredViewId = null;
_OtherViewCellCursorSection.hoveredCellAddress = null;
_OtherViewCellCursorSection.maxPopUpRows = 6;
let OtherViewCellCursorSection = _OtherViewCellCursorSection;
app.definitions.otherViewCellCursorSection = OtherViewCellCursorSection;
