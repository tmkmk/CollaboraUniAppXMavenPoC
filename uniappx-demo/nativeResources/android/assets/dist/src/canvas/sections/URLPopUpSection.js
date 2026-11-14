const _URLPopUpSection = class _URLPopUpSection extends HTMLObjectSection {
  constructor(url, documentPosition, linkPosition, linkIsClientSide = false) {
    super(_URLPopUpSection.sectionName, null, null, documentPosition, _URLPopUpSection.cssClass);
    this.containerId = "hyperlink-pop-up-preview";
    this.linkId = "hyperlink-pop-up";
    this.copyButtonId = "hyperlink-pop-up-copy";
    this.editButtonId = "hyperlink-pop-up-edit";
    this.removeButtonId = "hyperlink-pop-up-remove";
    const objectDiv = this.getHTMLObject();
    objectDiv.remove();
    document.getElementById("document-container").appendChild(objectDiv);
    this.sectionProperties.url = url;
    this.sectionProperties.linkIsClientSide = linkIsClientSide;
    this.createUIElements(url);
    this.setUpCallbacks(linkPosition);
    this.link.title = url;
    if (app.map["wopi"].EnableRemoteLinkPicker)
      app.map.fire("postMessage", { msgId: "Action_GetLinkPreview", args: { url } });
    this.sectionProperties.documentPosition = documentPosition.clone();
    this.getHTMLObject().style.pointerEvents = "";
    this.interactable = false;
  }
  adjustHTMLObjectPosition() {
    if (app.map._docLayer.isCalc()) {
      super.adjustHTMLObjectPosition();
      return;
    }
    const divBoundingRectangle = this.sectionProperties.objectDiv.getBoundingClientRect();
    const left = Math.round(this.sectionProperties.documentPosition.vX / app.dpiScale) + "px";
    const top = Math.round(this.sectionProperties.documentPosition.vY / app.dpiScale - divBoundingRectangle.height) + "px";
    if (this.sectionProperties.objectDiv.style.left !== left)
      this.sectionProperties.objectDiv.style.left = left;
    if (this.sectionProperties.objectDiv.style.top !== top)
      this.sectionProperties.objectDiv.style.top = top;
  }
  getPopUpWidth() {
    return this.getHTMLObject().getBoundingClientRect().width;
  }
  getPopUpHeight() {
    return this.getHTMLObject().getBoundingClientRect().height;
  }
  getPopUpBoundingRectangle() {
    return this.getHTMLObject().getBoundingClientRect();
  }
  createUIElements(url) {
    const parent = this.getHTMLObject();
    this.preview = window.L.DomUtil.createWithId("div", this.containerId, parent);
    const linkRow = window.L.DomUtil.create("div", "hyperlink-pop-up-link-row", parent);
    this.link = window.L.DomUtil.createWithId("a", this.linkId, linkRow);
    this.link.innerText = url;
    this.link.href = window.sanitizeUrl(url);
    const copyLinkText = _("Copy link location");
    const copyBtn = window.L.DomUtil.createWithId("button", this.copyButtonId, linkRow);
    copyBtn.setAttribute("type", "button");
    copyBtn.classList.add("hyperlink-popup-btn", "unobutton");
    copyBtn.setAttribute("title", copyLinkText);
    copyBtn.setAttribute("aria-label", copyLinkText);
    const imgCopyBtn = window.L.DomUtil.create("img", "hyperlink-pop-up-copyimg", copyBtn);
    app.LOUtil.setImage(imgCopyBtn, "lc_copyhyperlinklocation.svg", app.map);
    imgCopyBtn.setAttribute("width", 18);
    imgCopyBtn.setAttribute("height", 18);
    imgCopyBtn.setAttribute("alt", copyLinkText);
    imgCopyBtn.style.padding = "4px";
    const editLinkText = _("Edit link");
    const editBtn = window.L.DomUtil.createWithId("button", this.editButtonId, linkRow);
    editBtn.setAttribute("type", "button");
    editBtn.classList.add("hyperlink-popup-btn", "unobutton");
    editBtn.setAttribute("title", editLinkText);
    editBtn.setAttribute("aria-label", editLinkText);
    const imgEditBtn = window.L.DomUtil.create("img", "hyperlink-pop-up-editimg", editBtn);
    app.LOUtil.setImage(imgEditBtn, "lc_edithyperlink.svg", app.map);
    imgEditBtn.setAttribute("width", 18);
    imgEditBtn.setAttribute("height", 18);
    imgEditBtn.setAttribute("alt", editLinkText);
    imgEditBtn.style.padding = "4px";
    const removeLinkText = _("Remove link");
    const removeBtn = window.L.DomUtil.createWithId("button", this.removeButtonId, linkRow);
    removeBtn.setAttribute("type", "button");
    removeBtn.classList.add("hyperlink-popup-btn", "unobutton");
    removeBtn.setAttribute("title", removeLinkText);
    removeBtn.setAttribute("aria-label", removeLinkText);
    const imgRemoveBtn = window.L.DomUtil.create("img", "hyperlink-pop-up-removeimg", removeBtn);
    app.LOUtil.setImage(imgRemoveBtn, "lc_removehyperlink.svg", app.map);
    imgRemoveBtn.setAttribute("width", 18);
    imgRemoveBtn.setAttribute("height", 18);
    imgRemoveBtn.setAttribute("alt", removeLinkText);
    imgRemoveBtn.style.padding = "4px";
    if (app.map._permission === "readonly") {
      editBtn.style.display = "none";
      removeBtn.style.display = "none";
    }
  }
  openLink() {
    _URLPopUpSection.openLink(this.sectionProperties.url);
  }
  // '#' is a bookmark in the document, anything else opens after a confirmation
  static openLink(url) {
    if (!url.startsWith("#"))
      app.map.fire("warn", { url, map: app.map, cmd: "openlink" });
    else
      app.map.sendUnoCommand(".uno:JumpToMark?Bookmark:string=" + encodeURIComponent(url.substring(1)));
  }
  // in a spreadsheet the link commands take the tap position inside the cell
  static commandParameters(linkPosition) {
    if (!linkPosition)
      return void 0;
    return {
      PositionX: {
        type: "long",
        value: linkPosition.x
      },
      PositionY: {
        type: "long",
        value: linkPosition.y
      }
    };
  }
  // the native apps copy through the engine to reach the system clipboard
  static copyLinkLocation(url, params) {
    if (window.ThisIsTheiOSApp || window.ThisIsTheMacOSApp || window.ThisIsTheWindowsApp || window.ThisIsTheQtApp) {
      app.map._clip.filterExecCopyPaste(".uno:CopyHyperlinkLocation", params);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }
  // opened only through openLink(), which shows the confirmation first
  guardLink(anchor) {
    for (const type of ["click", "auxclick", "contextmenu", "dragstart"]) {
      anchor.addEventListener(type, (event) => {
        event.preventDefault();
        if (type === "click")
          this.openLink();
      });
    }
  }
  setUpCallbacks(linkPosition) {
    this.guardLink(this.link);
    this.getHTMLObject().addEventListener("keydown", (event) => {
      if (event.key !== "Escape")
        return;
      event.preventDefault();
      event.stopPropagation();
      app.map.focus();
    });
    const params = _URLPopUpSection.commandParameters(linkPosition);
    document.getElementById(this.copyButtonId).onclick = () => {
      _URLPopUpSection.copyLinkLocation(this.sectionProperties.url, params);
    };
    document.getElementById(this.editButtonId).onclick = () => {
      if (!this.sectionProperties.linkIsClientSide)
        app.map.sendUnoCommand(".uno:EditHyperlink", params);
    };
    document.getElementById(this.removeButtonId).onclick = () => {
      if (!this.sectionProperties.linkIsClientSide)
        app.map.sendUnoCommand(".uno:RemoveHyperlink", params);
      _URLPopUpSection.closeURLPopUp();
    };
  }
  static getCurrent() {
    return app.sectionContainer.getSectionWithName(_URLPopUpSection.sectionName);
  }
  updatePreview(values) {
    if (this.sectionProperties.url !== values.url)
      return;
    this.preview.innerText = "";
    if (values.image && values.image.indexOf("data:") === 0) {
      const image = window.L.DomUtil.create("img", "", this.preview);
      image.src = values.image;
      image.alt = values.title;
      image.onload = function() {
        _URLPopUpSection.resetPosition();
      };
    } else {
      window.L.DomUtil.addClass(this.preview, "no-preview");
    }
    if (values.title) {
      const urlAnchor = window.L.DomUtil.create("a", "", this.preview);
      urlAnchor.innerText = values.url;
      urlAnchor.title = values.url;
      urlAnchor.href = window.sanitizeUrl(values.url);
      this.guardLink(urlAnchor);
      this.link.innerText = values.title;
      _URLPopUpSection.resetPosition();
    }
  }
  static resetPosition(section) {
    if (!section)
      section = _URLPopUpSection.getCurrent();
    if (!section)
      return;
    let originalLeft = section.sectionProperties.documentPosition.pX - section.getPopUpWidth() * 0.5 * app.dpiScale;
    let originalTop = section.sectionProperties.documentPosition.pY - (section.getPopUpHeight() + _URLPopUpSection.popupVerticalMargin) * app.dpiScale;
    const checkLeft = originalLeft - app.activeDocument.activeLayout.viewedRectangle.pX1;
    const checkTop = originalTop - app.activeDocument.activeLayout.viewedRectangle.pY1;
    if (checkTop < 0) {
      originalTop = section.sectionProperties.documentPosition.pY + _URLPopUpSection.popupVerticalMargin * 2 * app.dpiScale;
    }
    if (checkLeft < 0)
      originalLeft = app.activeDocument.activeLayout.viewedRectangle.pX1;
    section.size = [section.getPopUpWidth() * app.dpiScale, section.getPopUpHeight() * app.dpiScale];
    section.setPosition(originalLeft, originalTop);
    section.adjustHTMLObjectPosition();
    section.containerObject.requestReDraw();
  }
  static showURLPopUP(url, documentPosition, linkPosition, linkIsClientSide) {
    if (window.mode.isSmallScreenDevice()) {
      HyperlinkWizard.show(url, linkPosition, linkIsClientSide);
      return;
    }
    if (_URLPopUpSection.isOpen())
      _URLPopUpSection.closeURLPopUp();
    const section = new _URLPopUpSection(url, documentPosition, linkPosition, linkIsClientSide);
    app.sectionContainer.addSection(section);
    this.resetPosition(section);
  }
  static closeURLPopUp() {
    const section = _URLPopUpSection.getCurrent();
    if (!section)
      return;
    const popup = section.getHTMLObject();
    const hadFocus = popup.contains(document.activeElement);
    app.sectionContainer.removeSection(_URLPopUpSection.sectionName);
    if (hadFocus)
      app.map.focus();
  }
  static isOpen() {
    return app.sectionContainer.doesSectionExist(_URLPopUpSection.sectionName);
  }
};
_URLPopUpSection.sectionName = "URL PopUp";
_URLPopUpSection.cssClass = "hyperlink-pop-up-container";
_URLPopUpSection.horizontalPadding = 5;
_URLPopUpSection.popupVerticalMargin = 12;
let URLPopUpSection = _URLPopUpSection;
