DOMPurify.addHook("afterSanitizeAttributes", function(node) {
  if (node.tagName === "A" && !node.classList.contains("context-menu-link")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener");
  }
});
var cool;
(function(cool2) {
  let CommentLayoutStatus;
  (function(CommentLayoutStatus2) {
    CommentLayoutStatus2[CommentLayoutStatus2["INVISIBLE"] = 0] = "INVISIBLE";
    CommentLayoutStatus2[CommentLayoutStatus2["VISIBLE"] = 1] = "VISIBLE";
    CommentLayoutStatus2[CommentLayoutStatus2["INSERTED"] = 2] = "INSERTED";
    CommentLayoutStatus2[CommentLayoutStatus2["DELETED"] = 3] = "DELETED";
    CommentLayoutStatus2[CommentLayoutStatus2["NONE"] = 4] = "NONE";
    CommentLayoutStatus2[CommentLayoutStatus2["HIDDEN"] = 5] = "HIDDEN";
  })(CommentLayoutStatus = cool2.CommentLayoutStatus || (cool2.CommentLayoutStatus = {}));
  const _Comment = class _Comment extends CanvasSectionObject {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static makeName(data) {
      return data.id === "new" ? "new comment" : "comment " + data.id;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(name, data, options, commentListSectionPointer) {
      super(name);
      this.processingOrder = app.CSections.Comment.processingOrder;
      this.drawingOrder = app.CSections.Comment.drawingOrder;
      this.zIndex = app.CSections.Comment.zIndex;
      this.valid = true;
      this.pendingInit = true;
      this.cachedCommentHeight = null;
      this.cachedIsEdit = false;
      this.hidden = null;
      this.containerPosX = 0;
      this.containerPosY = 0;
      this.renderedPosY = 0;
      this.positionedHeight = null;
      this.canvasContainerBounds = new DOMRect();
      this.searchSelectionPending = false;
      this.myTopLeft = [0, 0];
      this.documentObject = true;
      this.map = window.L.Map.THIS;
      if (!options)
        options = {};
      this.sectionProperties.commentListSection = commentListSectionPointer;
      this.sectionProperties.docLayer = this.map._docLayer;
      this.sectionProperties.selectedAreaPoint = null;
      this.sectionProperties.cellCursorPoint = null;
      this.sectionProperties.draggingStarted = false;
      this.sectionProperties.dragStartPosition = null;
      this.sectionProperties.minWidth = options.minWidth ? options.minWidth : 160;
      this.sectionProperties.maxHeight = options.maxHeight ? options.maxHeight : 50;
      this.sectionProperties.imgSize = options.imgSize ? options.imgSize : [32, 32];
      this.sectionProperties.margin = options.margin ? options.margin : [40, 40];
      this.sectionProperties.noMenu = options.noMenu ? options.noMenu : false;
      if (data.parent === void 0)
        data.parent = "0";
      this.setData(data);
      this.sectionProperties.possibleParentCommentId = null;
      this.sectionProperties.wrapper = null;
      this.sectionProperties.container = null;
      this.sectionProperties.author = null;
      this.sectionProperties.resolvedTextElement = null;
      this.sectionProperties.removedTextElement = null;
      this.sectionProperties.authorAvatarImg = null;
      this.sectionProperties.authorAvatartdImg = null;
      this.sectionProperties.contentAuthor = null;
      this.sectionProperties.contentDate = null;
      this.sectionProperties.acceptButton = null;
      this.sectionProperties.rejectButton = null;
      this.sectionProperties.menu = null;
      this.sectionProperties.menuBarCell = null;
      this.sectionProperties.captionNode = null;
      this.sectionProperties.captionText = null;
      this.sectionProperties.contentNode = null;
      this.sectionProperties.nodeModify = null;
      this.sectionProperties.nodeModifyText = null;
      this.sectionProperties.saveButton = null;
      this.sectionProperties.cancelButton = null;
      this.sectionProperties.replyButton = null;
      this.sectionProperties.cancelReplyButton = null;
      this.sectionProperties.statusNode = null;
      this.sectionProperties.statusTimer = null;
      this.sectionProperties.contentText = null;
      this.sectionProperties.lastContentRaw = "";
      this.sectionProperties.nodeReply = null;
      this.sectionProperties.nodeReplyText = null;
      this.sectionProperties.contextMenu = false;
      this.sectionProperties.highlightedTextColor = "#777777";
      this.sectionProperties.usedTextColor = this.sectionProperties.data.color;
      this.sectionProperties.showSelectedCoordinate = true;
      if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
        this.sectionProperties.part = this.sectionProperties.data.part;
        this.sectionProperties.partIndex = app.impress.getIndexFromPart(this.sectionProperties.part);
      }
      this.sectionProperties.isHighlighted = false;
      this.sectionProperties.commentContainerRemoved = false;
      this.sectionProperties.children = [];
      this.sectionProperties.childLinesNode = null;
      this.sectionProperties.childLines = [];
      this.sectionProperties.childCommentOffset = 24;
      this.sectionProperties.commentMarkerSubSection = null;
      this.sectionProperties.commentAnchorAreaSubSection = null;
      this.sectionProperties.calcCommentAreaWidth = 40;
      app.map.on("sheetgeometrychanged", this.setPositionAndSize.bind(this));
    }
    // Comments import can be costly if the document has a lot of them. If they are all imported/initialized
    // when online gets comments message from core, the initial doc render is delayed. To avoid that we do
    // lazy import of each comment when it needs to be shown (based on its coordinates).
    doPendingInitializationInView(force = false) {
      if (!this.pendingInit)
        return;
      if (!force) {
        if (!this.convertRectanglesToViewCoordinates())
          return;
        if (app.map._docLayer._docType === "spreadsheet" && parseInt(this.sectionProperties.data.tab) !== app.map._docLayer._selectedPart)
          return;
      }
      var button = window.L.DomUtil.create("div", "annotation-btns-container", this.sectionProperties.nodeModify);
      window.L.DomEvent.on(this.sectionProperties.nodeModifyText, "focus", this.onFocus, this);
      window.L.DomEvent.on(this.sectionProperties.nodeReplyText, "focus", this.onFocusReply, this);
      window.L.DomEvent.on(this.sectionProperties.nodeModifyText, "input", this.textAreaInput, this);
      window.L.DomEvent.on(this.sectionProperties.nodeReplyText, "input", this.textAreaInput, this);
      window.L.DomEvent.on(this.sectionProperties.nodeModifyText, "keydown", this.textAreaKeyDown, this);
      window.L.DomEvent.on(this.sectionProperties.nodeReplyText, "keydown", this.textAreaKeyDown, this);
      window.L.DomEvent.on(this.sectionProperties.nodeModifyText, "paste", app.LOUtil.onPastePlainText);
      window.L.DomEvent.on(this.sectionProperties.nodeReplyText, "paste", app.LOUtil.onPastePlainText);
      this.sectionProperties.cancelButton = this.createButton(button, "annotation-cancel-" + this.sectionProperties.data.id, "annotation-button button", _("Cancel"), this.handleCancelCommentButton);
      this.sectionProperties.saveButton = this.createButton(button, "annotation-save-" + this.sectionProperties.data.id, "annotation-button button button-primary", _("Save"), this.handleSaveCommentButton);
      button = window.L.DomUtil.create("div", "", this.sectionProperties.nodeReply);
      this.sectionProperties.cancelReplyButton = this.createButton(button, "annotation-cancel-reply-" + this.sectionProperties.data.id, "annotation-button button", _("Cancel"), this.handleCancelCommentButton);
      this.sectionProperties.replyButton = this.createButton(button, "annotation-reply-" + this.sectionProperties.data.id, "annotation-button button button-primary", _("Reply"), this.handleReplyCommentButton);
      this.sectionProperties.statusNode = window.L.DomUtil.create("div", "visuallyhidden", this.sectionProperties.container);
      this.sectionProperties.statusNode.setAttribute("role", "status");
      window.L.DomEvent.disableScrollPropagation(this.sectionProperties.container);
      if (app.map._docLayer._docType !== "text" || this.sectionProperties.commentListSection.isCollapsed === true)
        this.sectionProperties.container.style.visibility = "hidden";
      this.sectionProperties.nodeModify.style.display = "none";
      this.sectionProperties.nodeReply.style.display = "none";
      var events = ["click", "dblclick", "mousedown", "mouseup", "mouseover", "mouseout", "keydown", "keypress", "keyup", "touchstart", "touchmove", "touchend"];
      window.L.DomEvent.on(this.sectionProperties.container, "click", this.onMouseClick, this);
      window.L.DomEvent.on(this.sectionProperties.container, "keydown", this.onCommentKeyDown, this);
      for (const name of _Comment.activityEvents) {
        window.L.DomEvent.on(this.sectionProperties.container, name, this.notifyActive, this);
      }
      for (var it = 0; it < events.length; it++) {
        window.L.DomEvent.on(this.sectionProperties.container, events[it], window.L.DomEvent.stopPropagation, this);
      }
      window.L.DomEvent.on(this.sectionProperties.container, "touchstart", function(e) {
        if (e && e.touches.length > 1) {
          window.L.DomEvent.preventDefault(e);
        }
      }, this);
      this.update();
      this.pendingInit = false;
    }
    onInitialize() {
      this.createContainerAndWrapper();
      this.createAuthorTable();
      if (this.sectionProperties.data.trackchange && !this.map.isReadOnlyMode() && !app.map["wopi"].HideChangeTrackingControls) {
        this.createTrackChangeButtons();
      }
      if (this.sectionProperties.noMenu !== true) {
        this.createMenu();
      }
      if (this.sectionProperties.data.trackchange) {
        this.sectionProperties.captionNode = window.L.DomUtil.create("div", "cool-annotation-caption", this.sectionProperties.wrapper);
        this.sectionProperties.captionText = window.L.DomUtil.create("div", "", this.sectionProperties.captionNode);
        this.sectionProperties.captionText.id = "annotation-caption-text-" + this.sectionProperties.data.id;
      }
      this.sectionProperties.contentNode = window.L.DomUtil.create("div", "cool-annotation-content cool-dont-break", this.sectionProperties.wrapper);
      this.sectionProperties.contentNode.id = "annotation-content-area-" + this.sectionProperties.data.id;
      this.sectionProperties.contentNode.setAttribute("tabindex", "0");
      const commentFooter = window.L.DomUtil.create("div", "cool-annotation-footer", this.sectionProperties.wrapper);
      this.sectionProperties.contentDate = window.L.DomUtil.create("div", "cool-annotation-date", commentFooter);
      const resolvedEl = window.L.DomUtil.create("div", "cool-annotation-content-resolved", commentFooter);
      this.sectionProperties.resolvedTextElement = resolvedEl;
      this.updateResolvedField(this.sectionProperties.data.resolved);
      this.sectionProperties.nodeModify = window.L.DomUtil.create("div", "cool-annotation-edit modify-annotation", this.sectionProperties.wrapper);
      this.sectionProperties.nodeModifyText = window.L.DomUtil.create("div", "cool-annotation-textarea", this.sectionProperties.nodeModify);
      this.createReplyHint(this.sectionProperties.nodeModify);
      this.sectionProperties.nodeModifyText.setAttribute("contenteditable", "true");
      this.sectionProperties.nodeModifyText.setAttribute("role", "textbox");
      this.sectionProperties.nodeModifyText.setAttribute("aria-label", _Comment.editCommentLabel);
      this.sectionProperties.nodeModifyText.id = "annotation-modify-textarea-" + this.sectionProperties.data.id;
      this.sectionProperties.contentText = window.L.DomUtil.create("div", "", this.sectionProperties.contentNode);
      this.sectionProperties.nodeReply = window.L.DomUtil.create("div", "cool-annotation-edit reply-annotation", this.sectionProperties.wrapper);
      this.sectionProperties.nodeReplyText = window.L.DomUtil.create("div", "cool-annotation-textarea", this.sectionProperties.nodeReply);
      this.createReplyHint(this.sectionProperties.nodeReply);
      this.sectionProperties.nodeReplyText.setAttribute("contenteditable", "true");
      this.sectionProperties.nodeReplyText.setAttribute("role", "textbox");
      this.sectionProperties.nodeReplyText.setAttribute("aria-label", _Comment.replyCommentLabel);
      this.sectionProperties.nodeReplyText.id = "annotation-reply-textarea-" + this.sectionProperties.data.id;
      this.createChildLinesNode();
      this.sectionProperties.container.style.visibility = "hidden";
      if (this.sectionProperties.commentMarkerSubSection === null && app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing")
        this.createMarkerSubSection();
      this.doPendingInitializationInView();
      if (!window.mode.isSmallScreenDevice())
        document.getElementById("document-container").appendChild(this.sectionProperties.container);
      this.updateEditability();
      this.sectionProperties.onUpdatePermissionBound = this.updateEditability.bind(this);
      app.events.on("updatepermission", this.sectionProperties.onUpdatePermissionBound);
    }
    // Syncs visible edit affordances with the current comment-editing
    // permission. The editable=true branch only re-shows the menubar
    // cell: nodeModify/nodeReply remain hidden until the user explicitly
    // triggers edit()/reply(), so we deliberately do NOT auto-reopen a
    // previously open edit/reply pane when permission is restored.
    makeEditable(editable) {
      var _a, _b, _c, _d;
      const props = this.sectionProperties;
      if ((_a = props.menuBarCell) == null ? void 0 : _a.style)
        props.menuBarCell.style.display = editable ? "" : "none";
      if (editable)
        return;
      if ((_b = props.nodeModify) == null ? void 0 : _b.style)
        props.nodeModify.style.display = "none";
      if ((_c = props.nodeReply) == null ? void 0 : _c.style)
        props.nodeReply.style.display = "none";
      if ((_d = props.contentNode) == null ? void 0 : _d.style)
        props.contentNode.style.display = "";
      props.container.classList.remove("modify-annotation-container");
      props.container.classList.remove("reply-annotation-container");
      this.cachedIsEdit = false;
    }
    // Invoked at init and on every updatepermission event, so toggling
    // between Viewing and Editing mode immediately hides or restores the
    // per-comment controls.
    updateEditability() {
      this.makeEditable(app.isCommentEditingAllowed());
    }
    createContainerAndWrapper() {
      var isRTL = document.documentElement.dir === "rtl";
      this.sectionProperties.container = window.L.DomUtil.create("div", "cool-annotation" + (isRTL ? " rtl" : ""));
      this.sectionProperties.container.id = "comment-container-" + this.sectionProperties.data.id;
      this.sectionProperties.container.setAttribute("role", "article");
      this.sectionProperties.container.setAttribute("aria-roledescription", _("comment"));
      window.L.DomEvent.on(this.sectionProperties.container, "focusout", this.onLostFocus, this);
      var mobileClass = window.mode.isSmallScreenDevice() ? " wizard-comment-box" : "";
      if (this.sectionProperties.data.trackchange) {
        this.sectionProperties.wrapper = window.L.DomUtil.create("div", "cool-annotation-redline-content-wrapper" + mobileClass, this.sectionProperties.container);
      } else {
        this.sectionProperties.wrapper = window.L.DomUtil.create("div", "cool-annotation-content-wrapper" + mobileClass, this.sectionProperties.container);
      }
      this.sectionProperties.wrapper.style.marginLeft = this.sectionProperties.childCommentOffset * this.getChildLevel() + "px";
      if (document.documentElement.dir === "rtl")
        this.sectionProperties.wrapper.dir = "rtl";
      if (cool2.CommentSection.autoSavedComment)
        this.sectionProperties.container.style.visibility = "hidden";
    }
    createAuthorTable() {
      this.sectionProperties.author = window.L.DomUtil.create("table", "cool-annotation-table", this.sectionProperties.wrapper);
      this.sectionProperties.author.setAttribute("role", "presentation");
      var tbody = window.L.DomUtil.create("tbody", "", this.sectionProperties.author);
      var tr = window.L.DomUtil.create("tr", "cool-annotation-author-header", tbody);
      this.sectionProperties.authorRow = tr;
      tr.id = "author table row " + this.sectionProperties.data.id;
      var tdImg = window.L.DomUtil.create("td", "cool-annotation-img", tr);
      var tdAuthor = window.L.DomUtil.create("td", "cool-annotation-author", tr);
      var imgAuthor = window.L.DomUtil.create("img", "avatar-img", tdImg);
      imgAuthor.setAttribute("alt", this.sectionProperties.data.author);
      var viewId = this.map.getViewId(this.sectionProperties.data.author);
      if (this.map["wopi"] && this.map["wopi"].CommentAvatarUrl)
        imgAuthor.setAttribute("src", this.map["wopi"].CommentAvatarUrl);
      else
        app.LOUtil.setUserImage(imgAuthor, this.map, viewId);
      imgAuthor.setAttribute("width", this.sectionProperties.imgSize[0]);
      imgAuthor.setAttribute("height", this.sectionProperties.imgSize[1]);
      if (app.map._docLayer._docType !== "spreadsheet") {
        this.sectionProperties.collapsedInfoNode = window.L.DomUtil.create("div", "cool-annotation-info-collapsed", tdImg);
        this.sectionProperties.collapsedInfoNode.style.display = "none";
      }
      this.sectionProperties.authorAvatarImg = imgAuthor;
      this.sectionProperties.authorAvatartdImg = tdImg;
      this.sectionProperties.contentAuthor = window.L.DomUtil.create("div", "cool-annotation-content-author", tdAuthor);
      this.sectionProperties.contentAuthor.id = "annotation-content-author-" + this.sectionProperties.data.id;
    }
    createMenu() {
      var tdMenu = window.L.DomUtil.create("td", "cool-annotation-menubar", this.sectionProperties.authorRow);
      this.sectionProperties.menuBarCell = tdMenu;
      const id = this.sectionProperties.data.id;
      const describedBy = "annotation-content-author-" + id + (this.sectionProperties.data.trackchange ? " annotation-caption-text-" + id : "") + " annotation-content-area-" + id;
      if (this.isAuthor()) {
        const edit = window.L.DomUtil.create("div", "cool-annotation-menu-edit", tdMenu);
        edit.id = "comment-annotation-menu-edit-" + this.sectionProperties.data.id;
        if (!app.map.uiManager.isCommandVisible(".uno:EditAnnotation"))
          edit.classList.add("hidden-by-command");
        edit.tabIndex = 0;
        edit.onclick = this.onEditComment.bind(this);
        edit.onkeypress = this.editOnKeyPress.bind(this);
        edit.dataset.title = _Comment.editCommentLabel;
        edit.setAttribute("aria-label", _Comment.editCommentLabel);
        edit.setAttribute("role", "button");
        edit.setAttribute("aria-describedby", describedBy);
      }
      this.sectionProperties.menu = window.L.DomUtil.create("div", this.sectionProperties.data.trackchange ? "cool-annotation-menu-redline" : "cool-annotation-menu", tdMenu);
      this.sectionProperties.menu.id = "comment-annotation-menu-" + this.sectionProperties.data.id;
      this.sectionProperties.menu.tabIndex = 0;
      this.sectionProperties.menu.onclick = this.menuOnMouseClick.bind(this);
      this.sectionProperties.menu.onkeypress = this.menuOnKeyPress.bind(this);
      this.sectionProperties.menu.dataset.title = _Comment.openMenuLabel;
      this.sectionProperties.menu.setAttribute("aria-label", _Comment.openMenuLabel);
      this.sectionProperties.menu.setAttribute("role", "button");
      this.sectionProperties.menu.setAttribute("aria-describedby", describedBy);
    }
    // Returns the final (post-clamp) top in canvas-relative CSS px, so a thread's
    // replies can follow a parent that was clamped to stay in view.
    setContainerPos(forceUpdate, canvasContainerBounds, left, top) {
      var _a;
      if (window.mode.isSmallScreenDevice()) {
        return this.renderedPosY;
      }
      if (left === void 0 && top === void 0 && this.sectionProperties.container.style.left === "" && !this.isEdit()) {
        return this.renderedPosY;
      }
      if (canvasContainerBounds === void 0) {
        canvasContainerBounds = this.canvasContainerBounds;
      }
      if (left === void 0) {
        left = this.containerPosX;
      }
      if (top === void 0) {
        top = this.containerPosY;
      }
      if ((_a = this.sectionProperties.container.parentElement) == null ? void 0 : _a.classList.contains("cool-annotation-page-scroller")) {
        this.containerPosX = left;
        this.containerPosY = top;
        this.canvasContainerBounds = canvasContainerBounds;
        this.renderedPosY = top;
        return this.renderedPosY;
      }
      const clamped = this.isSelected() || this.isEdit();
      const height = clamped ? this.getCommentHeight() : null;
      if (this.containerPosX === left && this.containerPosY === top && this.canvasContainerBounds.left === canvasContainerBounds.left && this.canvasContainerBounds.right === canvasContainerBounds.right && this.canvasContainerBounds.top === canvasContainerBounds.top && this.canvasContainerBounds.bottom === canvasContainerBounds.bottom && this.positionedHeight === height && !forceUpdate) {
        return this.renderedPosY;
      }
      this.positionedHeight = height;
      this.containerPosX = left;
      this.containerPosY = top;
      this.canvasContainerBounds = canvasContainerBounds;
      left += canvasContainerBounds.left;
      top += canvasContainerBounds.top;
      if (this.isSelected() || this.isEdit()) {
        const margin = this.sectionProperties.commentListSection.sectionProperties.marginY / app.dpiScale;
        const clampY = !this.sectionProperties.commentListSection.usePerPageLayout() || this.sectionProperties.commentListSection.isShownBig(this);
        if (left < canvasContainerBounds.left) {
          left = canvasContainerBounds.left;
        }
        if (clampY && top < canvasContainerBounds.top + margin) {
          top = canvasContainerBounds.top + margin;
        }
        const width = this.getCommentWidth() / app.dpiScale;
        if (left + width > canvasContainerBounds.right && !this.sectionProperties.commentListSection.keepsSelectedCommentBesideThePage()) {
          left = canvasContainerBounds.right - width;
        }
        if (clampY && top + height > canvasContainerBounds.bottom - margin) {
          top = canvasContainerBounds.bottom - height - margin;
        }
        if (clampY && top < canvasContainerBounds.top + margin) {
          top = canvasContainerBounds.top + margin;
        }
      }
      let maxHeight = "";
      if (this.sectionProperties.commentListSection.isShownBig(this)) {
        this.sectionProperties.container.style.zIndex = "";
        const marginY = this.sectionProperties.commentListSection.sectionProperties.marginY / app.dpiScale;
        maxHeight = Math.round(canvasContainerBounds.bottom - top - marginY) + "px";
      } else if (this.isEdit()) {
        this.sectionProperties.container.style.zIndex = 14;
      } else if (this.isSelected()) {
        this.sectionProperties.container.style.zIndex = 13;
      } else {
        this.sectionProperties.container.style.zIndex = "";
      }
      this.sectionProperties.container.style.maxHeight = maxHeight;
      this.sectionProperties.container.style.left = Math.round(left) + "px";
      this.sectionProperties.container.style.top = Math.round(top) + "px";
      this.renderedPosY = top - canvasContainerBounds.top;
      return this.renderedPosY;
    }
    createReplyHint(commentType) {
      this.sectionProperties.replyHint = window.L.DomUtil.create("p", "", commentType);
      var small = document.createElement("small");
      small.classList.add("cool-font");
      small.innerText = _("Press Ctrl + Enter to post");
      this.sectionProperties.replyHint.appendChild(small);
    }
    createChildLinesNode() {
      this.sectionProperties.childLinesNode = window.L.DomUtil.create("div", "cool-annotation-child-lines", this.sectionProperties.container);
      this.sectionProperties.childLinesNode.id = "annotation-child-lines-" + this.sectionProperties.data.id;
      this.sectionProperties.childLinesNode.style.width = this.sectionProperties.childCommentOffset * (this.getChildLevel() + 1) + "px";
    }
    updateReplyLabel() {
      const container = this.sectionProperties.container;
      const parentComment = this.isRootComment() ? null : this.sectionProperties.commentListSection.getComment(this.getParentCommentId());
      if (!parentComment) {
        container.removeAttribute("aria-label");
        return;
      }
      const label = _("Reply to {0}").replace("{0}", () => parentComment.sectionProperties.data.author);
      if (container.getAttribute("aria-label") !== label)
        container.setAttribute("aria-label", label);
    }
    getContainerPosX() {
      return this.containerPosX;
    }
    getContainerPosY() {
      return this.containerPosY;
    }
    updateChildLines() {
      this.updateReplyLabel();
      if (!this.isContainerVisible())
        return;
      this.sectionProperties.wrapper.style.marginLeft = this.sectionProperties.childCommentOffset * this.getChildLevel() + "px";
      this.sectionProperties.childLinesNode.style.width = this.sectionProperties.childCommentOffset * (this.getChildLevel() + 1) + "px";
      const childPositions = [];
      for (let i2 = 0; i2 < this.sectionProperties.children.length; i2++) {
        if (this.sectionProperties.children[i2].isContainerVisible())
          childPositions.push({
            id: this.sectionProperties.children[i2].sectionProperties.data.id,
            posY: this.sectionProperties.children[i2].renderedPosY
          });
      }
      childPositions.sort((a, b) => {
        return a.posY - b.posY;
      });
      let lastPosY = this.renderedPosY + this.getCommentHeight(false);
      let i = 0;
      for (; i < childPositions.length; i++) {
        if (this.sectionProperties.childLines[i] === void 0) {
          this.sectionProperties.childLines[i] = window.L.DomUtil.create("div", "cool-annotation-child-line", this.sectionProperties.childLinesNode);
          this.sectionProperties.childLines[i].id = "annotation-child-line-" + this.sectionProperties.data.id + "-" + i;
          this.sectionProperties.childLines[i].style.width = this.sectionProperties.childCommentOffset - 4 + "px";
        }
        this.sectionProperties.childLines[i].style.marginLeft = this.sectionProperties.childCommentOffset * this.getChildLevel() + 4 + "px";
        this.sectionProperties.childLines[i].style.height = childPositions[i].posY + 24 - lastPosY + "px";
        lastPosY = childPositions[i].posY + 24;
      }
      while (i < this.sectionProperties.childLines.length) {
        this.sectionProperties.childLinesNode.removeChild(this.sectionProperties.childLines[i]);
        this.sectionProperties.childLines.splice(i, 1);
      }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    setData(data) {
      this.sectionProperties.data = data;
      const rectangles = this.sectionProperties.data.rectangles;
      if (rectangles) {
        for (let i = 0; i < rectangles.length; i++) {
          rectangles[i] = new cool2.SimpleRectangle(rectangles[i][0], rectangles[i][1], rectangles[i][2], rectangles[i][3]);
        }
      }
    }
    createTrackChangeButtons() {
      var tdAccept = window.L.DomUtil.create("td", "cool-annotation-menubar", this.sectionProperties.authorRow);
      var acceptButton = this.sectionProperties.acceptButton = window.L.DomUtil.create("button", "cool-redline-accept-button", tdAccept);
      var tdReject = window.L.DomUtil.create("td", "cool-annotation-menubar", this.sectionProperties.authorRow);
      var rejectButton = this.sectionProperties.rejectButton = window.L.DomUtil.create("button", "cool-redline-reject-button", tdReject);
      acceptButton.dataset.title = _("Accept change");
      acceptButton.setAttribute("aria-label", _("Accept change"));
      window.L.DomEvent.on(acceptButton, "click", function() {
        this.map.fire("RedlineAccept", { id: this.sectionProperties.data.id });
      }, this);
      rejectButton.dataset.title = _("Reject change");
      rejectButton.setAttribute("aria-label", _("Reject change"));
      window.L.DomEvent.on(rejectButton, "click", function() {
        this.map.fire("RedlineReject", { id: this.sectionProperties.data.id });
      }, this);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    createButton(container, id, cssClass, value, handler) {
      var button = window.L.DomUtil.create("input", cssClass, container);
      button.id = id;
      button.type = "button";
      button.value = value;
      window.L.DomEvent.on(button, "mousedown", window.L.DomEvent.preventDefault);
      window.L.DomEvent.on(button, "click", handler, this);
      return button;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    parentOf(comment) {
      return this.sectionProperties.data.id === comment.sectionProperties.data.parent;
    }
    updateResolvedField(state) {
      this.sectionProperties.resolvedTextElement.innerText = state === "true" ? _("Resolved") : "";
    }
    updateRemovedField() {
      var isDeleted = this.sectionProperties.data.layoutStatus === CommentLayoutStatus.DELETED;
      if (isDeleted && !this.sectionProperties.removedTextElement) {
        var commentFooter = this.sectionProperties.contentDate.parentNode;
        this.sectionProperties.removedTextElement = window.L.DomUtil.create("div", "cool-annotation-content-removed", commentFooter);
      }
      if (this.sectionProperties.removedTextElement) {
        this.sectionProperties.removedTextElement.innerText = isDeleted ? _("Removed") : "";
      }
      if (isDeleted) {
        this.sectionProperties.resolvedTextElement.innerText = "";
      } else {
        this.updateResolvedField(this.sectionProperties.data.resolved);
      }
    }
    isNewPara() {
      const selection = window.getSelection();
      if (!selection.rangeCount)
        return;
      const range = selection.getRangeAt(0);
      const cursorPosition = range.startOffset;
      const node = range.startContainer;
      const beforeCursor = node.textContent.slice(0, cursorPosition);
      return /^\s*$/.test(beforeCursor.slice(0, -1));
    }
    textAreaInput(ev) {
      var _a;
      if (ev && app.map._docLayer._docType === "text") {
        (_a = this.map) == null ? void 0 : _a.mention.handleMentionInput(ev, this.isNewPara());
      }
    }
    handleKeyDownForPopup(ev, id) {
      var popup = this.map._textInput._handleKeyDownForPopup(ev, id);
      if (popup && id === "mentionPopup" && ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }
    isCtrlEnter(ev) {
      return !!ev && ev.ctrlKey && ev.key === "Enter";
    }
    handleCommentCtrlEnter(ev) {
      var _a;
      (_a = this.map.mention) == null ? void 0 : _a.closeMentionPopup(false);
      const targetId = ev.target.id;
      if (this.sectionProperties.nodeReplyText.id === targetId) {
        this.handleReplyCommentButton(ev);
      } else {
        this.handleSaveCommentButton(ev);
      }
    }
    // Working inside a comment card keeps the document awake, in the same way that working
    // in the document itself does.
    notifyActive() {
      app.idleHandler.notifyActive();
    }
    textAreaKeyDown(ev) {
      if (window.KeyboardShortcuts.processEvent(app.UI.language.fromURL, ev)) {
        return;
      }
      this.handleKeyDownForPopup(ev, "mentionPopup");
    }
    onFocus() {
      this.resetControl(this.sectionProperties.saveButton, _("Save"), "annotation-button-autosaved");
    }
    onFocusReply() {
      this.resetControl(this.sectionProperties.replyButton, _("Reply"), "annotation-button-autosaved");
    }
    updateContent() {
      let contentModified = true;
      let contentRaw = "";
      if (this.sectionProperties.data.html)
        contentRaw = app.LOUtil.sanitize(this.sectionProperties.data.html);
      else
        contentRaw = this.sectionProperties.data.text ? this.sectionProperties.data.text : "";
      if (this.sectionProperties.lastContentRaw === contentRaw)
        contentModified = false;
      if (!contentModified)
        return;
      this.sectionProperties.lastContentRaw = contentRaw;
      if (this.sectionProperties.data.html)
        this.sectionProperties.contentText.innerHTML = app.LOUtil.sanitize(this.sectionProperties.data.html);
      else
        this.sectionProperties.contentText.innerText = this.sectionProperties.data.text ? this.sectionProperties.data.text : "";
      var linkedText = Autolinker.link(this.sectionProperties.contentText.outerHTML);
      this.sectionProperties.contentText.innerHTML = app.LOUtil.sanitize(linkedText);
      this.sectionProperties.contentText.origText = this.sectionProperties.data.text ? this.sectionProperties.data.text : "";
      this.sectionProperties.contentText.origHTML = this.sectionProperties.data.html ? this.sectionProperties.data.html : "";
      this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.data.text ? this.sectionProperties.data.text : "";
      if (this.sectionProperties.data.html) {
        this.sectionProperties.nodeModifyText.innerHTML = app.LOUtil.sanitize(this.sectionProperties.data.html);
      }
    }
    updateMetadata() {
      this.sectionProperties.contentAuthor.innerText = this.sectionProperties.data.author;
      this.updateReplyLabel();
      this.updateResolvedField(this.sectionProperties.data.resolved);
      this.updateRemovedField();
      if (this.map["wopi"] && this.map["wopi"].CommentAvatarUrl) {
        this.sectionProperties.authorAvatarImg.setAttribute("src", this.map["wopi"].CommentAvatarUrl);
      } else if (this.sectionProperties.data.avatar) {
        this.sectionProperties.authorAvatarImg.setAttribute("src", this.sectionProperties.data.avatar);
      } else {
        $(this.sectionProperties.authorAvatarImg).css("padding", "1.8px");
      }
      var user = this.map.getViewId(this.sectionProperties.data.author);
      if (user >= 0) {
        var color = app.LOUtil.rgbToHex(this.map.getViewColor(user));
        this.sectionProperties.authorAvatartdImg.style.borderColor = color;
      }
      const d = this.sectionProperties.data.dateTimeUtc ? new Date(this.sectionProperties.data.dateTimeUtc) : new Date(this.sectionProperties.data.dateTime.replace(/,.*/, ""));
      var dateOptions = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" };
      this.sectionProperties.contentDate.innerText = isNaN(d.getTime()) ? this.sectionProperties.data.dateTime : d.toLocaleDateString(String.locale, dateOptions);
      if (this.sectionProperties.data.trackchange) {
        this.sectionProperties.captionText.innerText = this.sectionProperties.data.description;
      }
    }
    updateLayout() {
      var style = this.sectionProperties.wrapper.style;
      style.width = "";
      style.whiteSpace = "nowrap";
      style.whiteSpace = "";
    }
    setPositionAndSize() {
      var rectangles = this.sectionProperties.data.rectanglesOriginal;
      if (rectangles && app.map._docLayer._docType === "text") {
        var xMin = Infinity, yMin = Infinity, xMax = 0, yMax = 0;
        for (var i = 0; i < rectangles.length; i++) {
          if (rectangles[i][0] < xMin)
            xMin = rectangles[i][0];
          if (rectangles[i][1] < yMin)
            yMin = rectangles[i][1];
          if (rectangles[i][0] + rectangles[i][2] > xMax)
            xMax = rectangles[i][0] + rectangles[i][2];
          if (rectangles[i][1] + rectangles[i][3] > yMax)
            yMax = rectangles[i][1] + rectangles[i][3];
        }
        xMin = Math.round(xMin * app.twipsToPixels);
        yMin = Math.round(yMin * app.twipsToPixels);
        xMax = Math.round(xMax * app.twipsToPixels);
        yMax = Math.round(yMax * app.twipsToPixels);
        this.setPosition(xMin, yMin);
        this.size = [xMax - xMin, yMax - yMin];
        if (this.size[0] < 5)
          this.size[0] = 5;
      } else if (this.sectionProperties.data.cellRange && app.map._docLayer._docType === "spreadsheet") {
        this.size = this.calcOptimumSizeForCalc();
        var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
        let startX = cellPos[0];
        if (this.isCalcRTL()) {
          const sizeX = cellPos[2];
          startX += sizeX;
        }
        this.setShowSection(parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart);
        var position = [Math.round((cellPos[0] + cellPos[2]) * app.twipsToPixels - this.size[0]), Math.round(cellPos[1] * app.twipsToPixels)];
        this.setPosition(position[0], position[1]);
      } else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
        this.size = [Math.round(this.sectionProperties.imgSize[0] * app.dpiScale), Math.round(this.sectionProperties.imgSize[1] * app.dpiScale)];
        this.setPosition(Math.round(this.sectionProperties.data.rectangle[0] * app.twipsToPixels), Math.round(this.sectionProperties.data.rectangle[1] * app.twipsToPixels));
      }
    }
    removeHighlight() {
      if (app.map._docLayer._docType === "text") {
        this.sectionProperties.usedTextColor = this.sectionProperties.data.color;
      } else if (app.map._docLayer._docType === "spreadsheet") {
        this.backgroundColor = null;
        this.backgroundOpacity = 1;
      }
      this.containerObject.requestReDraw();
      this.sectionProperties.isHighlighted = false;
    }
    // Paints this comment in the highlight colours.
    highlight() {
      if (app.map._docLayer._docType === "text") {
        this.sectionProperties.usedTextColor = this.sectionProperties.highlightedTextColor;
      } else if (app.map._docLayer._docType === "spreadsheet") {
        this.backgroundColor = "#777777";
        this.backgroundOpacity = 0.25;
      }
      this.containerObject.requestReDraw();
      this.sectionProperties.isHighlighted = true;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static doesRectIntersectView(pos, size, viewContext) {
      var paneBoundsList = viewContext.paneBoundsList;
      var endPos = [pos[0] + size[0], pos[1] + size[1]];
      for (var i = 0; i < paneBoundsList.length; ++i) {
        var paneBounds = paneBoundsList[i];
        var rectInvisible = endPos[0] < paneBounds.min.x || endPos[1] < paneBounds.min.y || pos[0] > paneBounds.max.x || pos[1] > paneBounds.max.y;
        if (!rectInvisible)
          return true;
      }
      return false;
    }
    // This is for svg elements that will be bound to document-container.
    // This also returns whether any rectangle has an intersection with the visible area/panes.
    // This function calculates the core pixel coordinates then converts them into view coordinates.
    convertRectanglesToViewCoordinates() {
      var rectangles = this.sectionProperties.data.rectangles;
      var viewContext = this.map.getTileSectionMgr()._paintContext();
      var intersectsVisibleArea = false;
      if (rectangles) {
        for (let i = 0; i < rectangles.length; i++) {
          if (app.activeDocument.activeLayout.viewedRectangle.intersectsRectangle(rectangles[i].toArray())) {
            intersectsVisibleArea = true;
            break;
          }
        }
      } else if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
        intersectsVisibleArea = _Comment.doesRectIntersectView(this.getPosition(), this.getSize(), viewContext);
      }
      return intersectsVisibleArea;
    }
    getPosition() {
      if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
        var anchorPos = this.sectionProperties.data.anchorPos;
        return [
          Math.round(anchorPos[0] * app.twipsToPixels),
          Math.round(anchorPos[1] * app.twipsToPixels)
        ];
      } else {
        return this.position;
      }
    }
    getSize() {
      if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
        var anchorPos = this.sectionProperties.data.anchorPos;
        return [
          Math.round(anchorPos[2] * app.twipsToPixels),
          Math.round(anchorPos[3] * app.twipsToPixels)
        ];
      } else {
        return this.size;
      }
    }
    updatePosition() {
      this.setPositionAndSize();
      if (app.map._docLayer._docType === "spreadsheet")
        this.positionCalcComment();
      else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
        if (this.sectionProperties.commentMarkerSubSection !== null) {
          this.sectionProperties.commentMarkerSubSection.sectionProperties.data = this.sectionProperties.data;
          this.sectionProperties.commentMarkerSubSection.setPosition(this.sectionProperties.data.anchorPos[0] * app.twipsToPixels, this.sectionProperties.data.anchorPos[1] * app.twipsToPixels);
        }
        if (this.sectionProperties.commentAnchorAreaSubSection !== null) {
          const data = this.sectionProperties.data;
          this.sectionProperties.commentAnchorAreaSubSection.sectionProperties.data = data;
          this.sectionProperties.commentAnchorAreaSubSection.setPosition(data.anchorPos[0] * app.twipsToPixels, data.anchorPos[1] * app.twipsToPixels);
          this.sectionProperties.commentAnchorAreaSubSection.resize(data.rectangle[2] * app.twipsToPixels / app.dpiScale, data.rectangle[3] * app.twipsToPixels / app.dpiScale);
        }
      }
    }
    createMarkerSubSection() {
      if (this.sectionProperties.data.rectangle === null)
        return;
      const showMarker = app.impress.partList[app.map._docLayer._selectedPart].part === this.sectionProperties.data.part || app.file.fileBasedView;
      if (this.sectionProperties.data.hasArea) {
        const widthCssPx = this.sectionProperties.data.rectangle[2] * app.twipsToPixels / app.dpiScale;
        const heightCssPx = this.sectionProperties.data.rectangle[3] * app.twipsToPixels / app.dpiScale;
        this.sectionProperties.commentAnchorAreaSubSection = new CommentAnchorAreaSubSection(this.name + this.sectionProperties.data.id + "-area" + String(Math.random()), widthCssPx, heightCssPx, new cool2.SimplePoint(this.sectionProperties.data.anchorPos[0], this.sectionProperties.data.anchorPos[1]), showMarker, this, this.sectionProperties.data);
        app.sectionContainer.addSection(this.sectionProperties.commentAnchorAreaSubSection);
      }
      this.sectionProperties.commentMarkerSubSection = new CommentMarkerSubSection(
        this.name + this.sectionProperties.data.id + String(Math.random()),
        // Section name - only as a placeholder.
        28,
        28,
        // Width and height.
        new cool2.SimplePoint(this.sectionProperties.data.anchorPos[0], this.sectionProperties.data.anchorPos[1]),
        // Document position.
        "annotation-marker",
        // Extra class.
        showMarker,
        // Show section.
        this,
        // Parent section.
        this.sectionProperties.data
      );
      app.sectionContainer.addSection(this.sectionProperties.commentMarkerSubSection);
    }
    isContainerVisible() {
      return this.sectionProperties.container.style && this.sectionProperties.container.style.display !== "none" && (this.sectionProperties.container.style.visibility === "visible" || this.sectionProperties.container.style.visibility === "");
    }
    update() {
      this.updateContent();
      this.updateMetadata();
      this.updateLayout();
      this.updatePosition();
    }
    showMarker() {
      if (this.sectionProperties.commentMarkerSubSection != null) {
        this.sectionProperties.commentMarkerSubSection.showSection = true;
        this.sectionProperties.commentMarkerSubSection.onSectionShowStatusChange();
      }
      if (this.sectionProperties.commentAnchorAreaSubSection != null) {
        this.sectionProperties.commentAnchorAreaSubSection.showSection = true;
        this.sectionProperties.commentAnchorAreaSubSection.onSectionShowStatusChange();
      }
    }
    hideMarker() {
      if (this.sectionProperties.commentMarkerSubSection != null) {
        this.sectionProperties.commentMarkerSubSection.showSection = false;
        this.sectionProperties.commentMarkerSubSection.onSectionShowStatusChange();
      }
      if (this.sectionProperties.commentAnchorAreaSubSection != null) {
        this.sectionProperties.commentAnchorAreaSubSection.showSection = false;
        this.sectionProperties.commentAnchorAreaSubSection.onSectionShowStatusChange();
      }
    }
    showWriter() {
      if (!this.isCollapsed || this.isSelected()) {
        this.sectionProperties.container.style.visibility = "";
        this.sectionProperties.container.style.display = "";
      }
      if (this.sectionProperties.data.resolved !== "true" || this.sectionProperties.commentListSection.sectionProperties.showResolved) {
        window.L.DomUtil.addClass(this.sectionProperties.container, "cool-annotation-collapsed-show");
        this.sectionProperties.showSelectedCoordinate = true;
      }
      this.sectionProperties.contentNode.style.display = "";
      this.sectionProperties.nodeModify.style.display = "none";
      this.sectionProperties.nodeReply.style.display = "none";
      this.sectionProperties.collapsedInfoNode.style.visibility = "";
      this.cachedIsEdit = false;
      this.setContainerPos(true);
    }
    showCalc() {
      this.sectionProperties.container.style.display = "";
      this.sectionProperties.contentNode.style.display = "";
      this.sectionProperties.nodeModify.style.display = "none";
      this.sectionProperties.nodeReply.style.display = "none";
      this.cachedIsEdit = false;
      this.positionCalcComment();
      if (!window.mode.isSmallScreenDevice()) {
        this.sectionProperties.commentListSection.select(this);
      }
      this.sectionProperties.container.style.visibility = "";
    }
    getCommentWidth() {
      return parseFloat(getComputedStyle(this.sectionProperties.container).width) * app.dpiScale;
    }
    positionCalcComment() {
      if (!window.mode.isSmallScreenDevice()) {
        const cellSize = this.calcOptimumSizeForCalc()[0];
        const startX = this.isCalcRTL() ? this.myTopLeft[0] - cellSize - this.getCommentWidth() + 3 : this.myTopLeft[0] + cellSize - 3;
        var pos = [Math.round(startX / app.dpiScale), Math.round(this.myTopLeft[1] / app.dpiScale)];
        this.sectionProperties.container.style.transform = "translate3d(" + pos[0] + "px, " + pos[1] + "px, 0px)";
      }
    }
    // True when the comment was put on display, false when it belongs to another
    // slide or page and was left alone.
    showImpressDraw() {
      if (!this.isInsideActivePart())
        return false;
      this.sectionProperties.container.style.display = "";
      this.sectionProperties.nodeModify.style.display = "none";
      this.sectionProperties.nodeReply.style.display = "none";
      this.sectionProperties.contentNode.style.display = "";
      this.cachedIsEdit = false;
      this.setContainerPos(true);
      if (this.isSelected() || !this.isCollapsed) {
        this.sectionProperties.container.style.visibility = "";
      } else {
        this.sectionProperties.container.style.visibility = "hidden";
      }
      window.L.DomUtil.addClass(this.sectionProperties.container, "cool-annotation-collapsed-show");
      return true;
    }
    setLayoutClass() {
      this.sectionProperties.container.classList.remove("tracked-deleted-comment-show");
      this.sectionProperties.container.classList.remove("tracked-deleted-comment-hide");
      var showTrackedChanges = this.map["stateChangeHandler"].getItemValue(".uno:ShowTrackedChanges") === "true";
      var layoutClass = showTrackedChanges ? "tracked-deleted-comment-show" : "tracked-deleted-comment-hide";
      if (this.sectionProperties.data.layoutStatus === CommentLayoutStatus.DELETED) {
        this.sectionProperties.container.classList.add(layoutClass);
      }
      this.updateRemovedField();
    }
    show() {
      this.doPendingInitializationInView(
        true
        /* force */
      );
      if (this.hidden === false && !this.isEdit())
        return;
      if (this.isInsideActivePart() || app.file.fileBasedView)
        this.showMarker();
      if (window.mode.isSmallScreenDevice() && this.sectionProperties.container.parentElement === document.getElementById("document-container"))
        this.sectionProperties.container.style.visibility = "hidden";
      if (cool2.CommentSection.commentWasAutoAdded)
        return;
      if (app.map._docLayer._docType === "text") {
        this.showWriter();
        this.hidden = false;
      } else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
        this.hidden = !this.showImpressDraw();
      } else if (app.map._docLayer._docType === "spreadsheet")
        this.showCalc();
      this.setLayoutClass();
    }
    hideWriter() {
      this.sectionProperties.container.style.visibility = "hidden";
      this.sectionProperties.nodeModify.style.display = "none";
      this.sectionProperties.nodeReply.style.display = "none";
      this.sectionProperties.showSelectedCoordinate = false;
      window.L.DomUtil.removeClass(this.sectionProperties.container, "cool-annotation-collapsed-show");
      this.cachedIsEdit = false;
      this.setContainerPos(true);
      this.hidden = true;
    }
    hideCalc() {
      if (!window.mode.isSmallScreenDevice())
        this.sectionProperties.container.style.visibility = "hidden";
      this.sectionProperties.nodeModify.style.display = "none";
      this.sectionProperties.nodeReply.style.display = "none";
      this.cachedIsEdit = false;
      if (this.sectionProperties.commentListSection.sectionProperties.selectedComment === this)
        this.sectionProperties.commentListSection.sectionProperties.selectedComment = null;
    }
    hideImpressDraw() {
      if (!this.isInsideActivePart() || this.sectionProperties.commentListSection.sectionProperties.show === false) {
        this.sectionProperties.container.style.display = "none";
        this.hideMarker();
      } else {
        this.sectionProperties.container.style.display = "";
        if (this.isCollapsed)
          this.sectionProperties.container.style.visibility = "hidden";
        this.sectionProperties.nodeModify.style.display = "none";
        this.sectionProperties.nodeReply.style.display = "none";
        this.cachedIsEdit = false;
        this.setContainerPos(true);
      }
      window.L.DomUtil.removeClass(this.sectionProperties.container, "cool-annotation-collapsed-show");
      this.hidden = true;
    }
    isAuthor() {
      return this.map.getViewName(app.map._docLayer._viewId) === this.sectionProperties.data.author;
    }
    canRemove() {
      return this.isAuthor() || !this.map.isReadOnlyMode();
    }
    canModerate() {
      return this.isAuthor() || app.isCommentEditingAllowed();
    }
    // check if this is "our" autosaved comment
    // core is not aware it's autosaved one so use this simplified detection based on content
    isAutoSaved() {
      var autoSavedComment = cool2.CommentSection.autoSavedComment;
      if (!autoSavedComment)
        return false;
      return this.isAuthor();
    }
    hide() {
      if (this.hidden === true || this.isEdit()) {
        return;
      }
      if (this.sectionProperties.data.id === "new") {
        this.sectionProperties.commentListSection.removeItem(this.sectionProperties.data.id);
        return;
      }
      if (app.map._docLayer._docType === "text")
        this.hideWriter();
      else if (app.map._docLayer._docType === "spreadsheet")
        this.hideCalc();
      else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing")
        this.hideImpressDraw();
    }
    isInsideActivePart() {
      return this.sectionProperties.partIndex === app.map._docLayer._selectedPart;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    menuOnMouseClick(e) {
      this.openContextMenu();
      window.L.DomEvent.stopPropagation(e);
    }
    onEditComment(e) {
      this.sectionProperties.commentListSection.modify(this);
      window.L.DomEvent.stopPropagation(e);
    }
    editOnKeyPress(e) {
      if (e.code === "Space" || e.code === "Enter") {
        this.onEditComment(e);
        window.L.DomEvent.stopPropagation(e);
      }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    menuOnKeyPress(e) {
      if (e.code === "Space" || e.code === "Enter")
        this.openContextMenu();
      window.L.DomEvent.stopPropagation(e);
    }
    openContextMenu() {
      const listSection = this.sectionProperties.commentListSection;
      const data = this.sectionProperties.data;
      const docLayer = app.map._docLayer;
      const entries = [];
      let pos = 0;
      const isShown = (uno) => app.map.uiManager.isCommandVisible(uno);
      if (data.trackchange) {
        entries.push({ text: _("Comment"), type: "action", id: "modify", pos: String(pos++) });
      } else {
        const isAuthor = this.isAuthor();
        const canRemove = this.canRemove();
        const canModerate = this.canModerate();
        const removeUno = docLayer._docType === "text" ? ".uno:DeleteComment" : docLayer._docType === "spreadsheet" ? ".uno:DeleteNote" : ".uno:DeleteAnnotation";
        if (isAuthor && isShown(".uno:EditAnnotation"))
          entries.push({ text: _("Modify"), type: "action", id: "modify", pos: String(pos++) });
        if (docLayer._docType === "text" && isShown(".uno:ReplyComment"))
          entries.push({ text: _("Reply"), type: "action", id: "reply", pos: String(pos++) });
        if (canRemove && isShown(removeUno))
          entries.push({ text: _("Remove"), type: "action", id: "remove", pos: String(pos++) });
        if (docLayer._docType === "text" && this.isRootComment() && canRemove && isShown(".uno:DeleteCommentThread"))
          entries.push({ text: _("Remove Thread"), type: "action", id: "removeThread", pos: String(pos++) });
        const isNonWriterComponent = ["spreadsheet", "drawing", "presentation"].includes(docLayer._docType);
        if (canModerate && (docLayer._docType === "text" || isNonWriterComponent && data.threaded) && isShown(".uno:ResolveComment"))
          entries.push({
            text: data.resolved === "false" ? _("Resolve") : _("Unresolve"),
            type: "action",
            id: "resolve",
            pos: String(pos++)
          });
        if (docLayer._docType === "text" && this.isRootComment() && canModerate && isShown(".uno:ResolveCommentThread"))
          entries.push({
            text: listSection.isThreadResolved(this) ? _("Unresolve Thread") : _("Resolve Thread"),
            type: "action",
            id: "resolveThread",
            pos: String(pos++)
          });
        if (docLayer._docType === "text" && !this.isRootComment() && isAuthor && isShown(".uno:PromoteComment"))
          entries.push({ text: _("Promote to top comment"), type: "action", id: "promote", pos: String(pos++) });
        if (docLayer._docType === "text" && !window.mode.isSmallScreenDevice()) {
          const isShownBig = listSection.isShownBig(this);
          entries.push({
            text: isShownBig ? _("Show on the side") : _("Open in full view"),
            type: "action",
            id: "showBigger",
            pos: String(pos++)
          });
        }
        if ((docLayer._docType === "text" || docLayer._docType === "spreadsheet") && !window.mode.isSmallScreenDevice())
          entries.push({ text: _("Show in navigator"), type: "action", id: "showInNavigator", pos: String(pos++) });
      }
      if (entries.length === 0)
        return;
      const menuEl = this.sectionProperties.menu;
      menuEl._onDropDown = function(open) {
        this.sectionProperties.contextMenu = open;
      }.bind(this);
      if (window.mode.isSmallScreenDevice()) {
        const menu = [];
        entries.forEach((entry) => {
          menu.push({
            name: entry.text,
            command: entry.text,
            callback: () => {
              this.handleMenuAction(entry.id);
              if (entry.id !== "reply" && entry.id !== "modify")
                app.map.fire("mobilewizardback");
            }
          });
        });
        const menuData = window.L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(menu, true, "");
        app.map.fire("mobilewizard", { data: menuData });
        return;
      }
      const dropdownId = "comment-menu-" + data.id;
      const callback = function(_objectType, eventType, _object, _data, entry) {
        if (eventType !== "selected")
          return false;
        const focusHandled = (entry == null ? void 0 : entry.id) === "reply" || (entry == null ? void 0 : entry.id) === "modify";
        JSDialog.CloseDropdown(dropdownId, focusHandled);
        this.handleMenuAction(entry == null ? void 0 : entry.id);
        return true;
      }.bind(this);
      JSDialog.OpenDropdown(dropdownId, menuEl, entries, callback, "", false, false, true);
    }
    handleMenuAction(id) {
      const listSection = this.sectionProperties.commentListSection;
      switch (id) {
        case "modify":
          listSection.modify(this);
          break;
        case "reply":
          listSection.reply(this);
          break;
        case "remove":
          listSection.remove(this.sectionProperties.data.id);
          break;
        case "removeThread":
          listSection.removeThread(this.sectionProperties.data.id);
          break;
        case "resolve":
          listSection.resolve(this);
          break;
        case "resolveThread":
          listSection.resolveThread(this);
          break;
        case "promote":
          listSection.promote(this);
          break;
        case "showBigger":
          listSection.toggleShowBigger(this);
          break;
        case "showInNavigator":
          listSection.showInNavigator(this);
          break;
      }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onMouseClick(e) {
      if ((window.mode.isSmallScreenDevice() || window.mode.isTablet()) && this.map.getDocType() == "spreadsheet" && !this.map.uiManager.mobileWizard.isOpen()) {
        this.hide();
      }
      window.L.DomEvent.stopPropagation(e);
      this.sectionProperties.commentListSection.click(this);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onCommentKeyDown(e) {
      if (!window.mode.isDesktop()) {
        return;
      }
      if (e.key !== "Escape")
        this.clearStatus();
      if (this.isCtrlEnter(e)) {
        e.preventDefault();
        e.stopPropagation();
        this.handleCommentCtrlEnter(e);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        app.map.focus();
        return;
      }
      if (e.key === "Tab" && this.isEdit()) {
        this.cycleEditFocus(e);
        return;
      }
      if (e.key === "F6" && !this.sectionProperties.nodeModifyText.contains(e.target) && !this.sectionProperties.nodeReplyText.contains(e.target)) {
        window.KeyboardShortcuts.processEvent(app.UI.language.fromURL, e);
        return;
      }
      if (!this.isEdit() && this.moveFocusByKey(e))
        return;
      if (e.key === "Escape") {
        const editingComment = this.isEdit() ? this : _Comment.isAnyEdit();
        if (editingComment) {
          e.preventDefault();
          e.stopPropagation();
          if (!editingComment.hasUnsavedText()) {
            editingComment.handleCancelCommentButton(e);
            return;
          }
          this.sectionProperties.commentListSection.addCommentAttention(editingComment);
          editingComment.announceUnsavedText();
        }
        return;
      }
      if (e.keyCode === 33 || e.keyCode === 34) {
        this.handleCommentPageNav(e);
        return;
      }
    }
    getTabStops() {
      const candidates = this.sectionProperties.container.querySelectorAll('button, a[href], [tabindex="0"]');
      return Array.from(candidates).filter((element) => element.getClientRects().length > 0 && !element.closest(".cool-annotation-edit"));
    }
    focusTabStop(stop) {
      const stops = this.getTabStops();
      let element = stop === "first" ? stops[0] : stops[stops.length - 1];
      if (stop === "body" && stops.includes(this.sectionProperties.contentNode))
        element = this.sectionProperties.contentNode;
      if (!element)
        return;
      element.focus({ preventScroll: true });
      this.scrollDocumentToShow(element.getBoundingClientRect());
    }
    moveFocusByKey(e) {
      if (e.ctrlKey || e.altKey || e.metaKey)
        return false;
      const isTab = e.key === "Tab";
      const isArrow = (e.key === "ArrowDown" || e.key === "ArrowUp") && !e.shiftKey;
      if (!isTab && !isArrow)
        return false;
      const commentList = this.sectionProperties.commentListSection;
      if (!commentList.getNavigableComments().includes(this))
        return false;
      const stops = this.getTabStops();
      const current = stops.indexOf(e.target);
      if (current === -1)
        return false;
      const forward = isTab ? !e.shiftKey : e.key === "ArrowDown";
      const content = this.sectionProperties.contentNode;
      if (isArrow && e.target === content) {
        const canScroll = forward ? content.scrollTop + content.clientHeight < content.scrollHeight - 1 : content.scrollTop > 0;
        if (canScroll)
          return false;
      }
      e.preventDefault();
      e.stopPropagation();
      const nextStop = isTab ? stops[current + (forward ? 1 : -1)] : null;
      if (nextStop) {
        nextStop.focus({ preventScroll: true });
        this.scrollDocumentToShow(nextStop.getBoundingClientRect());
        return true;
      }
      const next = commentList.getAdjacentComment(this, forward ? 1 : -1);
      if (next)
        commentList.focusComment(next, isArrow ? "body" : forward ? "first" : "last");
      else if (isTab)
        app.map.focus();
      return true;
    }
    scrollDocumentToShowRight() {
      const rect = this.sectionProperties.wrapper.getBoundingClientRect();
      const documentRect = document.getElementById("document-container").getBoundingClientRect();
      const margin = this.sectionProperties.commentListSection.sectionProperties.columnEndMargin;
      const offset = rect.right + margin - documentRect.right;
      if (offset > 0)
        app.activeDocument.activeLayout.scroll(Math.ceil(offset * app.dpiScale), 0);
    }
    scrollDocumentToShow(rect) {
      const documentRect = document.getElementById("document-container").getBoundingClientRect();
      const margin = this.sectionProperties.commentListSection.sectionProperties.marginY / app.dpiScale;
      let offset = 0;
      if (rect.top < documentRect.top + margin)
        offset = rect.top - documentRect.top - margin;
      else if (rect.bottom > documentRect.bottom - margin)
        offset = Math.min(rect.bottom - documentRect.bottom + margin, rect.top - documentRect.top - margin);
      if (offset !== 0)
        app.activeDocument.activeLayout.scroll(0, Math.round(offset * app.dpiScale));
    }
    // Tab/Shift+Tab within the modify or reply pane cycles between the text
    // area and its own buttons, rather than leaving the popup - the "..."
    // menu button in the comment's author row stays out of this order since
    // it belongs to the view pane, not the pane currently being edited.
    cycleEditFocus(e) {
      const props = this.sectionProperties;
      const inReply = props.nodeReply.style.display !== "none";
      const order = inReply ? [props.nodeReplyText, props.cancelReplyButton, props.replyButton] : [props.nodeModifyText, props.cancelButton, props.saveButton];
      const current = order.indexOf(document.activeElement);
      if (current === -1)
        return;
      e.preventDefault();
      e.stopPropagation();
      const next = (current + (e.shiftKey ? -1 : 1) + order.length) % order.length;
      order[next].focus();
    }
    /**
     * Workaround for Chrome desktop bug where PageUp/PageDown in a textarea
     * scrolls the page instead of moving the caret.
     * https://issues.chromium.org/issues/41417806
     */
    handleCommentPageNav(e) {
      window.L.DomEvent.preventDefault(e);
      const target = e.target;
      const pos = e.keyCode === 33 ? 0 : target.textLength;
      const currentPos = target.selectionStart;
      if (e.shiftKey) {
        const [start, end] = currentPos <= pos ? [currentPos, pos] : [pos, currentPos];
        target.setSelectionRange(start, end, currentPos > pos ? "backward" : "forward");
      } else {
        target.setSelectionRange(pos, pos);
      }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    handleReplyCommentButton(e) {
      cool2.CommentSection.autoSavedComment = null;
      cool2.CommentSection.commentWasAutoAdded = false;
      this.textAreaInput(null);
      this.onReplyClick(e);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onReplyClick(e) {
      window.L.DomEvent.stopPropagation(e);
      if (window.mode.isSmallScreenDevice()) {
        this.sectionProperties.data.reply = this.sectionProperties.data.text;
        this.sectionProperties.commentListSection.saveReply(this);
      } else {
        this.removeLastBRTag(this.sectionProperties.nodeReplyText);
        this.sectionProperties.data.reply = this.sectionProperties.nodeReplyText.innerText;
        this.sectionProperties.data.html = this.sectionProperties.nodeReplyText.innerHTML;
        this.sectionProperties.nodeReplyText.innerText = "";
        this.show();
        this.sectionProperties.commentListSection.saveReply(this);
      }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    handleCancelCommentButton(e) {
      if (cool2.CommentSection.commentWasAutoAdded) {
        app.sectionContainer.getSectionWithName(app.CSections.CommentList.name).remove(this.sectionProperties.data.id);
      }
      if (cool2.CommentSection.autoSavedComment) {
        this.sectionProperties.contentText.origText = this.sectionProperties.contentText.uneditedText;
        this.sectionProperties.contentText.uneditedText = null;
        this.sectionProperties.contentText.origHTML = this.sectionProperties.contentText.uneditedHTML;
        this.sectionProperties.contentText.uneditedHTML = null;
      }
      if (this.sectionProperties.contentText.origHTML) {
        this.sectionProperties.nodeModifyText.innerHTML = app.LOUtil.sanitize(this.sectionProperties.contentText.origHTML);
      } else {
        this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.contentText.origText;
      }
      this.sectionProperties.nodeReplyText.innerText = "";
      if (cool2.CommentSection.autoSavedComment)
        this.handleSaveCommentButton(e);
      this.onCancelClick(e);
      if (app.map._docLayer._docType === "spreadsheet")
        this.hideCalc();
      cool2.CommentSection.commentWasAutoAdded = false;
      cool2.CommentSection.autoSavedComment = null;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onCancelClick(e) {
      if (e)
        window.L.DomEvent.stopPropagation(e);
      if (this.sectionProperties.contentText.origHTML) {
        this.sectionProperties.nodeModifyText.innerHTML = app.LOUtil.sanitize(this.sectionProperties.contentText.origHTML);
      } else {
        this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.contentText.origText;
      }
      this.sectionProperties.nodeReplyText.innerText = "";
      if (app.map._docLayer._docType !== "spreadsheet")
        this.show();
      this.sectionProperties.commentListSection.cancel(this);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    handleSaveCommentButton(e) {
      cool2.CommentSection.autoSavedComment = null;
      cool2.CommentSection.commentWasAutoAdded = false;
      this.sectionProperties.contentText.uneditedText = null;
      this.sectionProperties.contentText.uneditedHTML = null;
      this.textAreaInput(null);
      this.onSaveComment(e);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onSaveComment(e) {
      this.sectionProperties.commentContainerRemoved = true;
      window.L.DomEvent.stopPropagation(e);
      this.removeLastBRTag(this.sectionProperties.nodeModifyText);
      this.sectionProperties.data.text = this.sectionProperties.nodeModifyText.innerText;
      this.sectionProperties.data.html = this.sectionProperties.nodeModifyText.innerHTML;
      this.updateContent();
      this.updateMetadata();
      if (!cool2.CommentSection.autoSavedComment)
        this.show();
      this.sectionProperties.commentListSection.save(this);
    }
    // for some reason firefox adds <br> at of the end of text in contenteditable div
    // there have been similar reports: https://bugzilla.mozilla.org/show_bug.cgi?id=1615852
    removeLastBRTag(element) {
      if (!window.L.Browser.gecko)
        return;
      const brElements = element.querySelectorAll("br");
      if (brElements.length > 0)
        brElements[brElements.length - 1].remove();
    }
    hasUnsavedText() {
      if (cool2.CommentSection.autoSavedComment || cool2.CommentSection.commentWasAutoAdded)
        return true;
      const props = this.sectionProperties;
      if (props.nodeReply.style.display !== "none")
        return props.nodeReplyText.innerText.trim() !== "";
      return this.isModifiedTextChanged();
    }
    isModifiedTextChanged() {
      const props = this.sectionProperties;
      const origHTML = props.contentText.origHTML || "";
      if (origHTML) {
        const node = props.nodeModifyText.cloneNode(true);
        this.removeLastBRTag(node);
        return origHTML !== node.innerHTML;
      }
      const text = (s) => s.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
      return text(props.contentText.origText || "") !== text(props.nodeModifyText.innerText);
    }
    announceUnsavedText() {
      const props = this.sectionProperties;
      const cancel = props.nodeReply.style.display !== "none" ? props.cancelReplyButton : props.cancelButton;
      const status = props.statusNode;
      this.clearStatus();
      props.statusTimer = setTimeout(() => {
        status.textContent = _("Press Ctrl + Enter to post, or %1 to discard").replace("%1", cancel.value);
      }, 100);
    }
    clearStatus() {
      clearTimeout(this.sectionProperties.statusTimer);
      this.sectionProperties.statusNode.textContent = "";
    }
    isNodeEmpty() {
      this.removeLastBRTag(this.sectionProperties.nodeModifyText);
      if (this.sectionProperties.nodeModifyText.innerText == "" && this.sectionProperties.nodeModifyText.innerHTML == "")
        return true;
      return false;
    }
    updateControl(button, label, className) {
      if (button) {
        button.value = label;
        button.classList.add(className);
      }
    }
    updateSaveControls() {
      this.updateControl(this.sectionProperties.saveButton, _("Saved"), "annotation-button-autosaved");
      this.updateControl(this.sectionProperties.cancelButton, _("Delete"), "annotation-button-delete");
    }
    updateReplyControls() {
      this.updateControl(this.sectionProperties.replyButton, _("Saved"), "annotation-button-autosaved");
      this.updateControl(this.sectionProperties.cancelReplyButton, _("Delete"), "annotation-button-delete");
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onLostFocus(e) {
      var _a;
      if (!this.isEdit() || this.sectionProperties.container.contains(e.relatedTarget))
        return;
      if (this.sectionProperties.commentListSection.movingCards)
        return;
      if (this.sectionProperties.nodeReply.contains(e.target)) {
        this.onLostFocusReply(e);
        return;
      }
      if (app.map._docLayer._docType === "text" && ((_a = this.map.mention) == null ? void 0 : _a.isTypingMention())) {
        return;
      }
      if (!this.sectionProperties.commentContainerRemoved) {
        $(this.sectionProperties.container).removeClass("annotation-active reply-annotation-container modify-annotation-container");
        const isChanged = this.isModifiedTextChanged();
        this.removeLastBRTag(this.sectionProperties.nodeModifyText);
        if (isChanged) {
          if (!document.hasFocus())
            app.definitions.CommentSection.needFocus = this;
          if (!this.sectionProperties.contentText.uneditedHTML)
            this.sectionProperties.contentText.uneditedHTML = this.sectionProperties.contentText.origHTML;
          if (!this.sectionProperties.contentText.uneditedText)
            this.sectionProperties.contentText.uneditedText = this.sectionProperties.contentText.origText;
          cool2.CommentSection.autoSavedComment = this;
          this.onSaveComment(e);
        } else if (this.containerObject.testing) {
          var insertButton = document.getElementById("menu-insertcomment");
          if (insertButton) {
            if (window.getComputedStyle(insertButton).display === "none") {
              this.onCancelClick(e);
            }
          }
        } else if (app.map._docLayer._docType === "text" && this.isNodeEmpty())
          this.onCancelClick(e);
      }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onLostFocusReply(e) {
      var _a;
      if (app.map._docLayer._docType === "text" && ((_a = this.map.mention) == null ? void 0 : _a.isTypingMention())) {
        return;
      }
      if (this.sectionProperties.nodeReplyText.innerText !== "") {
        if (!document.hasFocus())
          app.definitions.CommentSection.needFocus = this;
        if (!this.sectionProperties.contentText.uneditedHTML)
          this.sectionProperties.contentText.uneditedHTML = this.sectionProperties.contentText.origHTML;
        if (!this.sectionProperties.contentText.uneditedText)
          this.sectionProperties.contentText.uneditedText = this.sectionProperties.contentText.origText;
        cool2.CommentSection.autoSavedComment = this;
        this.onReplyClick(e);
      } else {
        this.sectionProperties.nodeReply.style.display = "none";
        if (!this.sectionProperties.nodeModify || this.sectionProperties.nodeModify.style.display === "none") {
          this.cachedIsEdit = false;
          if (app.map._docLayer._docType !== "spreadsheet") {
            this.setContainerPos(true);
          }
        }
      }
    }
    resetControl(button, label, className) {
      if (button) {
        button.value = label;
        button.classList.remove(className);
      }
    }
    resetSaveControls() {
      this.resetControl(this.sectionProperties.saveButton, _("Save"), "annotation-button-autosaved");
      this.resetControl(this.sectionProperties.cancelButton, _("Cancel"), "annotation-button-delete");
    }
    resetReplyControls() {
      this.resetControl(this.sectionProperties.replyButton, _("Reply"), "annotation-button-autosaved");
      this.resetControl(this.sectionProperties.cancelReplyButton, _("Cancel"), "annotation-button-delete");
    }
    focus() {
      this.sectionProperties.container.classList.add("annotation-active");
      this.sectionProperties.nodeModifyText.focus({ focusVisible: true });
      this.sectionProperties.nodeReplyText.focus({ focusVisible: true });
      if (this.isModifying() && this.sectionProperties.nodeModifyText.childNodes.length > 0) {
        var range = document.createRange();
        var sel = document.getSelection();
        range.setStartAfter(this.sectionProperties.nodeModifyText.lastChild);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      this.resetSaveControls();
      this.resetReplyControls();
    }
    focusLost() {
      this.updateSaveControls();
      this.updateReplyControls();
    }
    reply() {
      this.sectionProperties.container.classList.add("reply-annotation-container");
      this.sectionProperties.container.style.visibility = "";
      this.sectionProperties.contentNode.style.display = "";
      this.sectionProperties.nodeModify.style.display = "none";
      this.sectionProperties.nodeReply.style.display = "";
      this.cachedIsEdit = true;
      if (app.map._docLayer._docType !== "spreadsheet") {
        this.setContainerPos(true);
      }
      return this;
    }
    edit() {
      this.doPendingInitializationInView(
        true
        /* force */
      );
      this.sectionProperties.container.classList.add("modify-annotation-container");
      this.sectionProperties.nodeModify.style.display = "";
      this.sectionProperties.nodeReply.style.display = "none";
      this.sectionProperties.container.style.visibility = "";
      this.sectionProperties.contentNode.style.display = "none";
      this.cachedIsEdit = true;
      if (app.map._docLayer._docType !== "spreadsheet") {
        this.setContainerPos(true);
      }
      return this;
    }
    isEdit() {
      return this.cachedIsEdit;
    }
    isModifying() {
      return !this.pendingInit && this.sectionProperties.nodeModify && this.sectionProperties.nodeModify.style.display !== "none";
    }
    static isAnyEdit() {
      var section = app.sectionContainer && app.sectionContainer instanceof CanvasSectionContainer ? app.sectionContainer.getSectionWithName(app.CSections.CommentList.name) : null;
      if (!section) {
        return null;
      }
      var commentList = section.sectionProperties.commentList;
      for (var i in commentList) {
        var modifyNode = commentList[i].sectionProperties.nodeModify;
        var replyNode = commentList[i].sectionProperties.nodeReply;
        if (!commentList[i].pendingInit && (modifyNode && modifyNode.style.display !== "none" || replyNode && replyNode.style.display !== "none"))
          return commentList[i];
      }
      return null;
    }
    static isAnyFocus() {
      const comment_ = _Comment.isAnyEdit();
      if (comment_ && (document.activeElement === comment_.sectionProperties.nodeModifyText || document.activeElement === comment_.sectionProperties.nodeReplyText))
        return true;
      return false;
    }
    isDisplayed() {
      return this.sectionProperties.container.style && this.sectionProperties.container.style.visibility === "";
    }
    onResize() {
      this.updatePosition();
    }
    isSelected() {
      return this.sectionProperties.commentListSection.sectionProperties.selectedComment === this;
    }
    /*
        point is the core pixel coordinate of the cursor.
        Not adjusted according to the view.
        For adjusting, we need to take document top left and documentAnchor top left into account.
        No need to do that for now.
    */
    checkIfCursorIsOnThisCommentWriter(newPosition) {
      if (this.sectionProperties.commentListSection.sectionProperties.show == false)
        return;
      if (this.sectionProperties.commentListSection.cursorMovedByRemove)
        return;
      const rectangles = this.sectionProperties.data.rectangles;
      for (var i = 0; i < rectangles.length; i++) {
        if (rectangles[i].containsPoint([newPosition.x1, newPosition.y1])) {
          if (!this.isSelected())
            this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
          this.stopPropagating();
          return;
        }
      }
      if (this.isSelected()) {
        if (this.isCollapsed)
          this.setCollapsed();
        this.sectionProperties.commentListSection.unselect();
      }
    }
    /// This event is Writer-only. Fired by CanvasSectionContainer.
    onCursorPositionChanged(newPosition) {
      if (this.sectionProperties.data.rectangles) {
        this.checkIfCursorIsOnThisCommentWriter(newPosition);
      }
    }
    /// This event is Calc-only. Fired by CanvasSectionContainer.
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onCellAddressChanged() {
      if (this.sectionProperties.data.rectangles) {
        if (this.sectionProperties.data.rectangles[0].containsPoint(app.calc.cellCursorRectangle.center))
          this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = this;
        else if (this.isSelected()) {
          if (!this.sectionProperties.commentListSection.sectionProperties.doNotHideCommentTimer) {
            this.hide();
            this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = null;
          }
        } else if (this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment == this)
          this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = null;
      }
    }
    sendClickToCore(point, count) {
      app.map._docLayer._postMouseEvent("buttondown", point.x, point.y, count, 1, 0);
      app.map._docLayer._postMouseEvent("buttonup", point.x, point.y, count, 1, 0);
      app.map.focus();
    }
    onClick(point, e) {
      const docType = app.map._docLayer._docType;
      if (["presentation", "drawing"].includes(docType)) {
        this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
        e.stopPropagation();
        this.stopPropagating();
      } else if (docType === "text") {
        app.activeDocument.mouseControl.onClick(this.toMouseControlLocal(point), e);
      } else if (docType === "spreadsheet") {
        point.pX += this.position[0];
        point.pY += this.position[1];
        this.sendClickToCore(point, 1);
      }
    }
    onDoubleClick(point, e) {
      if ("spreadsheet" === app.map._docLayer._docType) {
        point.pX += this.position[0];
        point.pY += this.position[1];
        this.sendClickToCore(point, 2);
      }
    }
    onDraw() {
      if (this.sectionProperties.showSelectedCoordinate) {
        if (app.map._docLayer._docType === "text") {
          const rectangles = this.sectionProperties.data.rectangles;
          if (rectangles) {
            this.context.translate(-this.myTopLeft[0], -this.myTopLeft[1]);
            this.context.fillStyle = this.sectionProperties.usedTextColor;
            this.context.globalAlpha = 0.25;
            for (let i = 0; i < rectangles.length; i++) {
              const height = Math.max(rectangles[i].v4Y - rectangles[i].v1Y, 3);
              const width = Math.max(rectangles[i].v4X - rectangles[i].v1X, 3);
              this.context.fillRect(rectangles[i].v1X, rectangles[i].v1Y, width, height);
            }
            this.context.globalAlpha = 1;
            this.context.translate(this.myTopLeft[0], this.myTopLeft[1]);
          }
        } else if (app.map._docLayer._docType === "spreadsheet" && parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart && // Don't draw with stale section myTopLeft after a tab-switch.
        // Wait for a 'commandstatechanged'.
        this.sectionProperties.commentListSection.sectionProperties.calcCommandStateChanged === true) {
          var cellSize = this.calcOptimumSizeForCalc();
          if (cellSize[0] !== 0 && cellSize[1] !== 0) {
            var margin = 1;
            var baseSize = 2;
            var zoom = this.map.getZoom();
            var dim = baseSize + zoom;
            const isRTL = this.isCalcRTL();
            const sign = isRTL ? -1 : 1;
            const ax = isRTL ? -cellSize[0] + margin : cellSize[0] - margin;
            const px = (o) => ax - sign * o;
            this.context.fillStyle = getComputedStyle(document.body).getPropertyValue("--color-calc-comment");
            var region = new Path2D();
            if (this.sectionProperties.data.threaded) {
              var bodyW = dim * 0.72;
              var bodyH = dim * 0.52;
              var tailH = dim * 0.26;
              var tailW = dim * 0.36;
              region.moveTo(px(0), 0);
              region.lineTo(px(bodyW), 0);
              region.lineTo(px(bodyW), bodyH + tailH);
              region.lineTo(px(bodyW - tailW), bodyH);
              region.lineTo(px(0), bodyH);
            } else {
              region.moveTo(px(0), 0);
              region.lineTo(px(dim), 0);
              region.lineTo(px(0), dim);
            }
            region.closePath();
            this.context.fill(region);
          }
        }
      }
    }
    // Comment-local + this.myTopLeft is the canvas-pixel coordinate; MouseControl
    // is bound to the tiles section and expects its argument in that section's
    // local frame, which is offset from canvas by the document anchor (e.g. the
    // ruler height in Writer). Without removing the anchor, forwarded events
    // drift by that amount.
    toMouseControlLocal(point) {
      const docAnchor = app.sectionContainer.getDocumentAnchor();
      const result = point.clone();
      result.pX += this.myTopLeft[0] - docAnchor[0];
      result.pY += this.myTopLeft[1] - docAnchor[1];
      return result;
    }
    // In Writer, a comment-highlighted region overlays the document. By default
    // this section would swallow mouse events, so neither a text selection drag
    // nor a plain hover started on top of a commented passage ever reaches core.
    // That means e.g. the tracked-change tooltip is never requested when the
    // change is also covered by a comment. Forward the drag lifecycle
    // (down/move/up) and hover moves to MouseControl while leaving click handling
    // to the existing onClick path.
    forwardWriterMouseEventToCore(handler, point, dragDistance, e) {
      const mousePoint = this.toMouseControlLocal(point);
      const mouseControl = app.activeDocument.mouseControl;
      if (handler === "onMouseMove")
        mouseControl.onMouseMove(mousePoint, dragDistance, e);
      else if (handler === "onMouseDown")
        mouseControl.onMouseDown(mousePoint, e);
      else
        mouseControl.onMouseUp(mousePoint, e);
    }
    onMouseDown(point, e) {
      if (app.map._docLayer._docType === "text")
        this.forwardWriterMouseEventToCore("onMouseDown", point, [0, 0], e);
    }
    onMouseMove(point, dragDistance, e) {
      if (app.map._docLayer._docType === "text")
        this.forwardWriterMouseEventToCore("onMouseMove", point, dragDistance, e);
    }
    onMouseUp(point, e) {
      if (this.containerObject.isDraggingSomething() && app.map._docLayer._docType === "text") {
        this.forwardWriterMouseEventToCore("onMouseUp", point, [0, 0], e);
        return;
      }
      if (!this.containerObject.isDraggingSomething() && window.mode.isSmallScreenDevice() || window.mode.isTablet()) {
        if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing")
          app.map._docLayer._openCommentWizard(this);
        this.onMouseEnter();
        this.onClick(point, e);
      }
    }
    calcContinueWithMouseEvent() {
      if (app.map._docLayer._docType === "spreadsheet") {
        var conditions = !this.isEdit();
        if (conditions) {
          var sc = this.sectionProperties.commentListSection.sectionProperties.selectedComment;
          if (sc)
            conditions = sc.sectionProperties.data.id !== "new";
        }
        return conditions;
      } else {
        return false;
      }
    }
    calcCellSize() {
      var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
      return [Math.round(cellPos[2] * app.twipsToPixels), Math.round(cellPos[3] * app.twipsToPixels)];
    }
    calcOptimumSizeForCalc() {
      const size = this.calcCellSize();
      if (size[0] > this.sectionProperties.calcCommentAreaWidth)
        size[0] = this.sectionProperties.calcCommentAreaWidth;
      return size;
    }
    onMouseEnter() {
      if (this.calcContinueWithMouseEvent()) {
        if (parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart) {
          var sc = this.sectionProperties.commentListSection.sectionProperties.selectedComment;
          if (sc) {
            if (!sc.isEdit())
              sc.hide();
            else
              return;
          }
          var containerWidth = this.sectionProperties.container.getBoundingClientRect().width;
          var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
          this.size = [Math.round(cellPos[2] * app.twipsToPixels + containerWidth), Math.round(cellPos[3] * app.twipsToPixels)];
          this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
          this.show();
        }
      }
    }
    onMouseLeave(point) {
      if (this.calcContinueWithMouseEvent()) {
        if (parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart) {
          this.size = this.calcOptimumSizeForCalc();
          if (point) {
            this.hide();
          }
        }
      }
    }
    onNewDocumentTopLeft() {
      this.doPendingInitializationInView();
      this.updatePosition();
    }
    onCommentDataUpdate() {
      this.doPendingInitializationInView();
      this.updatePosition();
    }
    onRemove() {
      this.sectionProperties.commentContainerRemoved = true;
      if (this.sectionProperties.onUpdatePermissionBound) {
        app.events.off("updatepermission", this.sectionProperties.onUpdatePermissionBound);
        this.sectionProperties.onUpdatePermissionBound = null;
      }
      if (this.sectionProperties.commentListSection.sectionProperties.selectedComment === this)
        this.sectionProperties.commentListSection.sectionProperties.selectedComment = null;
      this.sectionProperties.commentListSection.forgetCommentSearchHit(this);
      this.sectionProperties.commentListSection.hideArrow();
      var container = this.sectionProperties.container;
      if (this.sectionProperties.commentMarkerSubSection !== null)
        app.sectionContainer.removeSection(this.sectionProperties.commentMarkerSubSection.name);
      if (this.sectionProperties.commentAnchorAreaSubSection !== null)
        app.sectionContainer.removeSection(this.sectionProperties.commentAnchorAreaSubSection.name);
      if (container && container.parentElement) {
        var c = 0;
        while (c < 10) {
          try {
            container.parentElement.removeChild(container);
            break;
          } catch (e) {
            c++;
          }
        }
      }
    }
    isRootComment() {
      return this.sectionProperties.data.parent === "0";
    }
    setAsRootComment() {
      this.sectionProperties.data.parent = "0";
      if (app.map._docLayer._docType === "text")
        this.sectionProperties.data.parentId = "0";
    }
    getChildrenLength() {
      return this.sectionProperties.children.length;
    }
    getChildByIndex(index) {
      if (this.sectionProperties.children.length > index)
        return this.sectionProperties.children[index];
      else
        return null;
    }
    removeChildByIndex(index) {
      if (this.sectionProperties.children.length > index)
        this.sectionProperties.children.splice(index, 1);
    }
    getParentCommentId() {
      if (this.sectionProperties.data.parent && this.sectionProperties.data.parent !== "0")
        return this.sectionProperties.data.parent;
      else
        return null;
    }
    getIndexOfChild(comment) {
      return this.sectionProperties.children.indexOf(comment);
    }
    getChildLevel() {
      if (this.isRootComment())
        return 0;
      const parentComment = this.sectionProperties.commentListSection.getComment(this.getParentCommentId());
      if (parentComment)
        return parentComment.getChildLevel() + 1;
      return 1;
    }
    getCommentHeight(invalidateCache = true) {
      if (invalidateCache)
        this.cachedCommentHeight = null;
      if (this.cachedCommentHeight === null)
        this.cachedCommentHeight = this.sectionProperties.container.getBoundingClientRect().height;
      return this.cachedCommentHeight;
    }
    setCollapsed() {
      this.isCollapsed = true;
      if ((app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") && !app.file.fileBasedView && !this.isInsideActivePart() && !this.isEdit()) {
        this.hide();
        return;
      }
      if (this.sectionProperties.commentListSection.sectionProperties.show != false && !this.isEdit()) {
        this.show();
        this.sectionProperties.commentListSection.removeCommentAttention(this);
      }
      if (this.isRootComment() || app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
        this.sectionProperties.container.style.display = "";
        this.sectionProperties.container.style.visibility = "hidden";
      }
      this.updateThreadInfoIndicator();
      if (this.sectionProperties.data.resolved === "false" || this.sectionProperties.commentListSection.sectionProperties.showResolved || app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing")
        window.L.DomUtil.addClass(this.sectionProperties.container, "cool-annotation-collapsed-show");
    }
    updateThreadInfoIndicator(replycount = -1) {
      if (app.map._docLayer._docType === "spreadsheet")
        return;
      var innerText;
      if (this.isEdit())
        innerText = "!";
      else if (replycount === "!" || typeof replycount === "number" && replycount > 0)
        innerText = replycount;
      else
        innerText = "";
      if (this.sectionProperties.collapsedInfoNode.innerText != innerText)
        this.sectionProperties.collapsedInfoNode.innerText = innerText;
      const containerVisible = this.isContainerVisible();
      if (innerText === "" || containerVisible)
        this.sectionProperties.collapsedInfoNode.style.display = "none";
      else if (!containerVisible && innerText !== "")
        this.sectionProperties.collapsedInfoNode.style.display = "";
    }
    setExpanded() {
      if (!this.isCollapsed)
        return;
      this.isCollapsed = false;
      if (this.sectionProperties.commentListSection.sectionProperties.show !== false && (app.map.getDocType() !== "text" || this.sectionProperties.data.resolved === "false" || this.sectionProperties.commentListSection.sectionProperties.showResolved)) {
        this.sectionProperties.container.style.display = "";
        if (app.map.getDocType() !== "presentation" && app.map.getDocType() !== "drawing" || this.isInsideActivePart()) {
          this.sectionProperties.container.style.visibility = "";
        }
      }
      if (app.map._docLayer._docType === "text")
        this.sectionProperties.collapsedInfoNode.style.display = "none";
      window.L.DomUtil.removeClass(this.sectionProperties.container, "cool-annotation-collapsed-show");
    }
    // Returns the text node and the offset in it for an offset into all the text of an element.
    static getTextPosition(element, offset) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
      let remaining = offset;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const length = node.length;
        if (remaining <= length)
          return { node, offset: remaining };
        remaining -= length;
      }
      return null;
    }
    // Selects text of this comment. searchText is the selected text, and searchOccurrence is the
    // number of times it starts earlier in the paragraph. When they are given, they place the
    // selection, because the paragraph here writes each link out and shortens the links that
    // Autolinker finds, while the indexes count the text as the document engine has it.
    selectText(startParagraph, startIndex, endParagraph, endIndex, searchText, searchOccurrence) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      const paragraphElements = Array.from(this.sectionProperties.contentText.firstChild.children);
      if (paragraphElements.length === 0) {
        return;
      }
      if (startParagraph > paragraphElements.length - 1 || endParagraph > paragraphElements.length - 1) {
        return;
      }
      const startElement = paragraphElements[startParagraph];
      const endElement = paragraphElements[endParagraph];
      if (searchText && startParagraph === endParagraph) {
        const paragraphText = startElement.textContent;
        let found = paragraphText.indexOf(searchText);
        for (let i = 0; found >= 0 && i < searchOccurrence; i++)
          found = paragraphText.indexOf(searchText, found + 1);
        if (found >= 0) {
          startIndex = found;
          endIndex = found + searchText.length;
        }
      }
      const start = _Comment.getTextPosition(startElement, startIndex);
      const end = _Comment.getTextPosition(endElement, endIndex);
      if (!start || !end)
        return;
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      selection.addRange(range);
      this.sectionProperties.contentText.focus();
      this.searchSelectionPending = true;
      this.revealSearchSelection();
    }
    // Scrolls the text of this comment to the text that selectText selected, and scrolls the
    // document when that text is outside the document area, as a reply below the view can be. The
    // text of a long comment scrolls inside its card, and the card moves with the document. While
    // the comment is hidden, the selection waits for the layout that shows it.
    revealSearchSelection() {
      if (!this.searchSelectionPending)
        return;
      const selection = window.getSelection();
      const contentNode = this.sectionProperties.contentNode;
      if (!selection.rangeCount || !contentNode.contains(selection.anchorNode)) {
        this.searchSelectionPending = false;
        return;
      }
      const contentRect = contentNode.getBoundingClientRect();
      if (contentRect.height === 0)
        return;
      const selectionRect = selection.getRangeAt(0).getBoundingClientRect();
      if (selectionRect.top < contentRect.top || selectionRect.bottom > contentRect.bottom)
        contentNode.scrollTop += selectionRect.top - contentRect.top - (contentRect.height - selectionRect.height) / 2;
      this.searchSelectionPending = false;
      this.scrollDocumentToShow(selection.getRangeAt(0).getBoundingClientRect());
    }
    // Drops the text that selectText selected, when it is still selected.
    clearSearchSelection() {
      this.searchSelectionPending = false;
      const selection = window.getSelection();
      if (selection && selection.rangeCount && this.sectionProperties.contentText.contains(selection.anchorNode))
        selection.removeAllRanges();
    }
    autoCompleteMention(username, profileLink, replacement) {
      var _a, _b, _c, _d;
      const selection = window.getSelection();
      if (!selection)
        return;
      const editorElement = this.getActiveEditorElement();
      let range = null;
      if (selection.rangeCount) {
        const candidateRange = selection.getRangeAt(0);
        if (!editorElement || editorElement.contains(candidateRange.startContainer))
          range = candidateRange;
      }
      const container = range ? range.startContainer : null;
      let textNode = null;
      let cursorPosition = range ? range.endOffset : 0;
      if (container && container.nodeType === Node.TEXT_NODE) {
        textNode = container;
      } else if (!range) {
        if (!editorElement)
          return;
        const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null);
        textNode = walker.nextNode();
        if (!textNode) {
          textNode = document.createTextNode("");
          editorElement.appendChild(textNode);
        }
        cursorPosition = ((_a = textNode.textContent) == null ? void 0 : _a.length) ?? 0;
      }
      const containerText = (textNode == null ? void 0 : textNode.textContent) || (container == null ? void 0 : container.textContent) || (editorElement == null ? void 0 : editorElement.textContent) || "";
      const mentionStart = containerText.lastIndexOf(replacement, cursorPosition);
      if (mentionStart !== -1) {
        const mentionEnd = mentionStart + replacement.length;
        const beforeMention = containerText.substring(0, mentionStart);
        const afterMention = containerText.substring(mentionEnd);
        const hyperlink = document.createElement("a");
        hyperlink.href = profileLink;
        hyperlink.textContent = `@${username}`;
        if (!textNode || !textNode.parentNode) {
          return;
        }
        textNode.textContent = beforeMention;
        (_b = textNode.parentNode) == null ? void 0 : _b.insertBefore(hyperlink, textNode.nextSibling);
        const afterTextNode = document.createTextNode(afterMention);
        const extraSpaceNode = document.createTextNode("\xA0");
        (_c = hyperlink.parentNode) == null ? void 0 : _c.insertBefore(extraSpaceNode, hyperlink.nextSibling);
        (_d = hyperlink.parentNode) == null ? void 0 : _d.insertBefore(afterTextNode, extraSpaceNode.nextSibling);
        const newRange = document.createRange();
        newRange.setStartAfter(extraSpaceNode);
        newRange.setEndAfter(extraSpaceNode);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
    getActiveEditorElement() {
      if (window.mode.isSmallScreenDevice()) {
        const commentSection = app.sectionContainer.getSectionWithName(app.CSections.CommentList.name);
        const isMobileCommentActive = commentSection == null ? void 0 : commentSection.isMobileCommentActive();
        if (!isMobileCommentActive)
          return null;
        const mobileCommentModalId = commentSection == null ? void 0 : commentSection.getMobileCommentModalId();
        return document.getElementById(mobileCommentModalId);
      }
      if (this.sectionProperties.nodeModify && this.sectionProperties.nodeModify.style.display !== "none")
        return this.sectionProperties.nodeModifyText;
      if (this.sectionProperties.nodeReply && this.sectionProperties.nodeReply.style.display !== "none")
        return this.sectionProperties.nodeReplyText;
      return this.sectionProperties.nodeModifyText || this.sectionProperties.nodeReplyText || null;
    }
    onContextMenu(point, e) {
      Util.ensureValue(app.activeDocument);
      Util.ensureValue(app.activeDocument.mouseControl);
      const viewed = app.activeDocument.activeLayout.viewedRectangle;
      const anchor = this.containerObject.getDocumentAnchor();
      point.pX = this.myTopLeft[0] + point.pX + viewed.pX1 - anchor[0];
      point.pY = this.myTopLeft[1] + point.pY + viewed.pY1 - anchor[1];
      app.activeDocument.mouseControl.setMousePosition(point);
      app.activeDocument.mouseControl.onContextMenu(point, e);
    }
  };
  _Comment.editCommentLabel = _("Edit comment");
  _Comment.replyCommentLabel = _("Reply comment");
  _Comment.openMenuLabel = _("Open menu");
  _Comment.activityEvents = ["input", "keydown", "mousedown", "touchstart"];
  let Comment = _Comment;
  cool2.Comment = Comment;
})(cool || (cool = {}));
app.definitions.Comment = cool.Comment;
