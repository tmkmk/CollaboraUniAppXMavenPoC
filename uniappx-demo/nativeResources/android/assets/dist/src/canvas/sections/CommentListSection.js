window.L.Map.include({
  // Shared entry guard for the new-comment actions. Looks up the comment
  // list section and reports whether a fresh insertion may begin.
  _beginCommentInsertion: function(threaded) {
    const commentSection = app.sectionContainer.getSectionWithName(app.CSections.CommentList.name);
    if (this.stateChangeHandler.getItemValue("InsertAnnotation") === "disabled")
      return { blocked: true, commentSection };
    const editingComment = cool.Comment.isAnyEdit();
    if (commentSection && editingComment) {
      if (app.map._docLayer._docType === "spreadsheet" && threaded !== void 0 && editingComment.sectionProperties.data.id === "new") {
        editingComment.sectionProperties.data.threaded = threaded ? "true" : void 0;
        editingComment.focus();
      } else {
        commentSection.navigateAndFocusComment(editingComment);
      }
      return { blocked: true, commentSection };
    }
    if (app.map && app.map.formulabar && (app.map.formulabar.hasFocus() || app.map.formulabar.isInEditMode())) {
      app.dispatcher.dispatch("acceptformula");
    }
    return { blocked: false, commentSection };
  },
  // Data for a brand-new local comment authored by the current view; the
  // 'new' id marks it as one we added. threaded tags it as a threaded one.
  _newCommentData: function(threaded) {
    let avatar = void 0;
    const author = this.getViewName(this._docLayer._viewId);
    if (author in this._viewInfoByUserName)
      avatar = this._viewInfoByUserName[author].userextrainfo.avatar;
    const data = {
      text: "",
      textrange: "",
      author,
      dateTime: (/* @__PURE__ */ new Date()).toISOString(),
      id: "new",
      avatar
    };
    if (threaded)
      data.threaded = "true";
    return data;
  },
  insertComment: function() {
    const { blocked, commentSection } = this._beginCommentInsertion(false);
    if (blocked)
      return;
    if (app.map._docLayer._docType !== "spreadsheet")
      app.map.showComments(true);
    const commentData = this._newCommentData();
    if (app.file.fileBasedView && commentSection) {
      commentSection.startCommentPlacement((pick) => {
        commentData.yAddition = pick.partTopTwips;
        this.setPart(pick.partIndex, false);
        commentData.position = [pick.docTL.x, pick.docTL.y];
        if (pick.docBR)
          commentData.size = [
            pick.docBR.x - pick.docTL.x,
            pick.docBR.y - pick.docTL.y
          ];
        this._docLayer.newAnnotation(commentData);
      });
      return;
    }
    this._docLayer.newAnnotation(commentData);
  },
  insertThreadedComment: function() {
    const { blocked } = this._beginCommentInsertion(true);
    if (blocked)
      return;
    this._docLayer.newAnnotation(this._newCommentData(true));
  },
  // Host-driven insertion: the host has the comment text ready and asks the
  // browser to pick the anchor interactively (PDF only). Args carries the
  // final UNO payload plus an InteractiveAnchor sentinel; we strip the
  // sentinel, run the click-to-place picker, then dispatch the command with
  // PositionX/Y (and Width/Height when the user dragged a rectangle) merged
  // in. Outside fileBasedView there is no picker, so we just strip and
  // dispatch as-is.
  insertCommentInteractive: function(command, args) {
    const { blocked, commentSection } = this._beginCommentInsertion();
    if (blocked)
      return;
    const cleanArgs = {};
    for (const key in args) {
      if (key !== "InteractiveAnchor")
        cleanArgs[key] = args[key];
    }
    if (!app.file.fileBasedView || !commentSection) {
      this.sendUnoCommand(command, cleanArgs, true);
      return;
    }
    commentSection.startCommentPlacement((pick) => {
      const partTop = pick.partTopTwips;
      const finalArgs = {
        ...cleanArgs,
        PositionX: { type: "int32", value: pick.docTL.x },
        PositionY: { type: "int32", value: pick.docTL.y - partTop }
      };
      if (pick.docBR) {
        finalArgs.Width = { type: "int32", value: pick.docBR.x - pick.docTL.x };
        finalArgs.Height = { type: "int32", value: pick.docBR.y - pick.docTL.y };
      }
      this.setPart(pick.partIndex, false);
      this.sendUnoCommand(command, finalArgs, true);
      this.setPart(0, false);
    });
  },
  showResolvedComments: function(on = false) {
    if (on) {
      const shown = this.stateChangeHandler.getItemValue("showannotations");
      if (shown !== "true" && shown !== true)
        this.showComments(true);
    }
    const unoCommand = ".uno:ShowResolvedAnnotations";
    this.sendUnoCommand(unoCommand);
    app.sectionContainer.getSectionWithName(app.CSections.CommentList.name).setViewResolved(on);
    this.uiManager.setDocTypePref("ShowResolved", on);
  },
  showComments: function(on = false) {
    if (!on) {
      const resolved = this.stateChangeHandler.getItemValue(".uno:ShowResolvedAnnotations");
      if (resolved === "true" || resolved === true)
        this.showResolvedComments(false);
    }
    app.sectionContainer.getSectionWithName(app.CSections.CommentList.name).setView(on);
    this.uiManager.setDocTypePref("ShowAnnotations", on);
    this.fire("commandstatechanged", { commandName: "showannotations", state: on ? "true" : "false" });
    this.fire("showannotationschanged", { state: on ? "true" : "false" });
  }
});
var cool;
(function(cool2) {
  const _CommentSection = class _CommentSection extends CanvasSectionObject {
    // active while every comment is shown or hidden at once, disable scroll
    get cursorMovedByRemove() {
      return this.endCursorMovedByRemove !== null;
    }
    constructor() {
      super(app.CSections.CommentList.name);
      this.backgroundColor = app.sectionContainer.getClearColor();
      this.expand = ["bottom"];
      this.processingOrder = app.CSections.CommentList.processingOrder;
      this.drawingOrder = app.CSections.CommentList.drawingOrder;
      this.zIndex = app.CSections.CommentList.zIndex;
      this.interactable = false;
      this.disableLayoutAnimation = false;
      this.mobileCommentId = "new-annotation-dialog";
      this._commentPositionDirty = false;
      this.pendingSelectedCommentReveal = false;
      this.selectionShownInBox = null;
      this.editShownInView = null;
      this.addedCommentToShow = null;
      this.movingCards = false;
      this.endCursorMovedByRemove = null;
      this.pageScrollers = /* @__PURE__ */ new Map();
      this.pageScrollTops = /* @__PURE__ */ new WeakMap();
      this.pageScrollerCards = /* @__PURE__ */ new WeakMap();
      this.cardBesideRemoved = null;
      this.cardPressedToSelect = null;
      this.pageScrollersInUse = /* @__PURE__ */ new Set();
      this.commentWithSearchHit = null;
      this.placementOnPicked = null;
      this.placementStart = null;
      this.placementOverlay = null;
      this.onClickOutsideComment = (e) => {
        const target = e.target;
        if (!target || target.id !== "document-canvas")
          return;
        const selected = this.sectionProperties.selectedComment;
        if (!selected)
          return;
        if (this.threadInEditMode(this.getRootIndexOf(selected.sectionProperties.data.id)))
          return;
        if (app.map._docLayer._docType === "text") {
          selected.onCursorPositionChanged(app.file.textCursor.rectangle.clone());
          return;
        }
        this.unselect();
      };
      this.map = window.L.Map.THIS;
      this.anchor = ["top", "right"];
      this.sectionProperties.docLayer = this.map._docLayer;
      this.sectionProperties.calcLastTab = -1;
      this.sectionProperties.calcMasterList = [];
      this.sectionProperties.calcCommandStateChanged = true;
      this.sectionProperties.doNotHideCommentTimer = null;
      this.sectionProperties.commentList = new Array(0);
      this.sectionProperties.selectedComment = null;
      this.sectionProperties.expandedComment = null;
      this.sectionProperties.arrow = null;
      this.sectionProperties.show = null;
      this.sectionProperties.showResolved = false;
      this.sectionProperties.marginY = 20 * app.dpiScale;
      this.sectionProperties.offset = 5 * app.dpiScale;
      this.sectionProperties.width = Math.round(1 * app.dpiScale);
      this.sectionProperties.scrollAnnotation = null;
      this.sectionProperties.commentWidth = _CommentSection.getCommentWidth();
      this.sectionProperties.commentWidthBigger = _CommentSection.getBiggerCommentWidth();
      this.sectionProperties.columnEndMargin = 8;
      this.sectionProperties.deflectionOfSelectedComment = 160;
      this.sectionProperties.showSelectedBigger = false;
      this.sectionProperties.calcCurrentComment = null;
      this.sectionProperties.reLayout = true;
      this.sectionProperties.commentsAreListed = (app.map._docLayer._docType === "text" || app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") && !window.mode.isSmallScreenDevice();
      this.idIndexMap = /* @__PURE__ */ new Map();
      this.mobileCommentModalId = this.map.uiManager.generateModalId(this.mobileCommentId);
      this.annotationMinSize = Number(getComputedStyle(document.documentElement).getPropertyValue("--annotation-min-size"));
      this.annotationMaxSize = Number(getComputedStyle(document.documentElement).getPropertyValue("--annotation-max-size"));
      this.onPlacementMouseDown = this.onPlacementMouseDown.bind(this);
      this.onPlacementMouseMove = this.onPlacementMouseMove.bind(this);
      this.onPlacementMouseUp = this.onPlacementMouseUp.bind(this);
      this.onPlacementKeyDown = this.onPlacementKeyDown.bind(this);
    }
    onInitialize() {
      this.checkCollapseState();
      this.map.on("RedlineAccept", this.onRedlineAccept, this);
      this.map.on("RedlineReject", this.onRedlineReject, this);
      this.map.on("updateparts", this.importPartSpecificComments, this);
      this.map.on("updateparts", this.showHideComments, this);
      this.map.on("AnnotationScrollUp", this.onAnnotationScrollUp, this);
      this.map.on("AnnotationScrollDown", this.onAnnotationScrollDown, this);
      this.map.on("commandstatechanged", function(event) {
        this.sectionProperties.calcCommandStateChanged = true;
        if (event.commandName === ".uno:ShowResolvedAnnotations")
          this.setViewResolved(event.state === "true");
        else if (event.commandName === "showannotations")
          this.setView(event.state === "true");
        else if (event.commandName === ".uno:ShowTrackedChanges" && event.state === "true")
          app.socket.sendMessage("commandvalues command=.uno:ViewAnnotations");
      }, this);
      this.map.on("zoomend", function() {
        this.checkCollapseState();
        this.layout(true);
      }, this);
      this.backgroundColor = this.containerObject.getClearColor();
      if (window.mode.isSmallScreenDevice()) {
        this.setShowSection(false);
        this.size[0] = 0;
      }
      this.escapeSelectedComment();
    }
    navigateAndFocusComment(annotation) {
      if (!annotation)
        return;
      this.highlightComment(annotation);
      if (this.sectionProperties.selectedComment !== annotation) {
        this.select(annotation, true);
      }
      annotation.focus();
      this.addCommentAttention(annotation);
    }
    getNavigableComments() {
      const props = this.sectionProperties;
      if (props.show === false || !window.mode.isDesktop())
        return [];
      const docType = app.map._docLayer._docType;
      return props.commentList.filter((comment) => {
        const data = comment.sectionProperties.data;
        if (data.id === "new" || comment.pendingInit)
          return false;
        if (docType === "text")
          return data.resolved !== "true" || props.showResolved;
        if (docType === "presentation" || docType === "drawing")
          return app.file.fileBasedView || comment.isInsideActivePart();
        return false;
      });
    }
    getAdjacentComment(comment, direction) {
      const comments = this.getNavigableComments();
      const index = comments.indexOf(comment);
      if (index === -1)
        return null;
      return comments[index + direction] || null;
    }
    focusComment(comment, stop) {
      this.select(comment);
      app.layoutingService.appendLayoutingTask(() => {
        comment.focusTabStop(stop);
      });
    }
    focusCommentRegion() {
      const comments = this.getNavigableComments();
      if (!comments.length)
        return false;
      const props = this.sectionProperties;
      let target = comments.find((comment) => comment === props.expandedComment) || comments.find((comment) => comment === props.selectedComment);
      if (!target) {
        const viewTop = app.activeDocument.activeLayout.viewedRectangle.y1;
        target = comments.find((comment) => Math.abs(comment.sectionProperties.data.anchorPos[1]) >= viewTop) || comments[0];
      }
      this.focusComment(target, "body");
      return true;
    }
    addCommentAttention(annotation) {
      if (!annotation)
        return;
      const wrapper = annotation.sectionProperties.wrapper;
      if (wrapper) {
        wrapper.classList.add("cool-annotation-inedit");
      }
    }
    removeCommentAttention(annotation) {
      if (!annotation)
        return;
      const wrapper = annotation.sectionProperties.wrapper;
      if (wrapper) {
        wrapper.classList.remove("cool-annotation-inedit");
      }
    }
    checkCollapseState() {
      if (!window.mode.isSmallScreenDevice() && app.map._docLayer._docType !== "spreadsheet") {
        if (this.shouldCollapse()) {
          this.sectionProperties.deflectionOfSelectedComment = 180;
          this.setCollapsed();
        } else {
          this.sectionProperties.deflectionOfSelectedComment = 70;
          this.setExpanded();
        }
        if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing")
          this.showHideComments();
      }
    }
    findNextPartWithComment(currentPart) {
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        if (this.sectionProperties.commentList[i].sectionProperties.partIndex > currentPart) {
          return this.sectionProperties.commentList[i].sectionProperties.partIndex;
        }
      }
      return -1;
    }
    findPreviousPartWithComment(currentPart) {
      for (var i = this.sectionProperties.commentList.length - 1; i > -1; i--) {
        if (this.sectionProperties.commentList[i].sectionProperties.partIndex < currentPart) {
          return this.sectionProperties.commentList[i].sectionProperties.partIndex;
        }
      }
      return -1;
    }
    // Drops the selection that the last search put in a comment.
    clearCommentSearchHit() {
      if (this.commentWithSearchHit)
        this.commentWithSearchHit.clearSearchSelection();
      this.commentWithSearchHit = null;
    }
    // Forgets the search match of a comment that is removed from the list.
    forgetCommentSearchHit(comment) {
      if (this.commentWithSearchHit === comment)
        this.commentWithSearchHit = null;
    }
    onAnnotationScrollDown() {
      var index = this.findNextPartWithComment(app.map._docLayer._selectedPart);
      if (index >= 0) {
        this.map.setPart(index);
      }
    }
    onAnnotationScrollUp() {
      var index = this.findPreviousPartWithComment(app.map._docLayer._selectedPart);
      if (index >= 0) {
        this.map.setPart(index);
      }
    }
    checkSize() {
      if (app.map._docLayer._docType === "spreadsheet" || window.mode.isSmallScreenDevice() || this.sectionProperties.commentList.length === 0) {
        if (app.map._docLayer._docType === "presentation" && this.sectionProperties.scrollAnnotation) {
          this.map.removeControl(this.sectionProperties.scrollAnnotation);
          this.sectionProperties.scrollAnnotation = null;
        }
      } else if (app.map._docLayer._docType === "presentation") {
        if (!this.sectionProperties.scrollAnnotation) {
          this.sectionProperties.scrollAnnotation = window.L.control.scrollannotation();
          this.sectionProperties.scrollAnnotation.addTo(this.map);
        }
      }
    }
    isEditing() {
      const textBoxes = this.sectionProperties.commentList.flatMap((section) => [section.sectionProperties.nodeModifyText, section.sectionProperties.nodeReplyText]).filter((textBox) => textBox !== void 0);
      return textBoxes.includes(document.activeElement);
    }
    getActiveEdit() {
      if (!this.sectionProperties.selectedComment) {
        return null;
      }
      if (this.sectionProperties.selectedComment.isEdit()) {
        return this.sectionProperties.selectedComment;
      }
      var openArray = [];
      this.getChildren(this.sectionProperties.selectedComment, openArray);
      for (var i = 0; i < openArray.length; i++) {
        if (openArray[i].isEdit()) {
          return openArray[i];
        }
      }
      return null;
    }
    commentsHiddenOrNotPresent() {
      if (this.sectionProperties.show != true || this.sectionProperties.commentList.length == 0)
        return true;
      return false;
    }
    setCollapsed() {
      if (this.sectionProperties.show != true || this.isEditing()) {
        return;
      }
      this.isCollapsed = true;
      this.unselect();
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        if (this.sectionProperties.commentList[i].sectionProperties.data.id !== "new")
          this.sectionProperties.commentList[i].setCollapsed();
        $(this.sectionProperties.commentList[i].sectionProperties.container).addClass("collapsed-comment");
        if (this.sectionProperties.commentList[i].isRootComment())
          this.collapseReplies(i, this.sectionProperties.commentList[i].sectionProperties.data.id);
      }
    }
    setExpanded() {
      this.isCollapsed = false;
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        this.sectionProperties.commentList[i].setExpanded();
        $(this.sectionProperties.commentList[i].sectionProperties.container).removeClass("collapsed-comment");
      }
    }
    static getCommentWidth() {
      return 200 * 1.3 * app.dpiScale;
    }
    static getBiggerCommentWidth() {
      return 588 * app.dpiScale;
    }
    /// If the current layout has more than one pages in a row, so the comment should be next to
    /// the document content instead of next to the page.
    static isMultiColumnLayout() {
      const type = app.activeDocument.activeLayout.type;
      return type === "ViewLayoutMultiPage" || type === "ViewLayoutCompareChanges" || type === "ViewLayoutFileBased";
    }
    getCommentColumnX(availableSpace) {
      if (_CommentSection.isMultiColumnLayout())
        return this.myTopLeft[0] - availableSpace - app.activeDocument.activeLayout.scrollProperties.viewX;
      if (document.documentElement.dir === "rtl")
        return availableSpace - this.sectionProperties.commentWidth;
      let x = (app.activeDocument.fileSize.cX - app.activeDocument.activeLayout.viewedRectangle.cX1 - app.sectionContainer.getCanvasBoundingClientRect().x) * app.dpiScale;
      x += app.map.navigator ? app.map.navigator.navigationPanel.offsetWidth * app.dpiScale : 0;
      return x;
    }
    keepsSelectedCommentBesideThePage() {
      return app.map._docLayer._docType === "text" && (!_CommentSection.isMultiColumnLayout() || app.activeDocument.activeLayout.type === "ViewLayoutMultiPage") && document.documentElement.dir !== "rtl" && !this.sectionProperties.showSelectedBigger;
    }
    getDocumentCanvasWidth() {
      return parseInt(document.getElementById("document-canvas").style.width);
    }
    getSelectedCommentLeft(columnX) {
      const isRTL = document.documentElement.dir === "rtl";
      return Math.round(columnX / app.dpiScale) - this.sectionProperties.deflectionOfSelectedComment * (isRTL ? -1 : 1);
    }
    getSelectedCommentOverflow() {
      const commentLeft = this.getSelectedCommentLeft(this.getCommentColumnX(this.calculateAvailableSpace()));
      const overflow = commentLeft + this.sectionProperties.commentWidth / app.dpiScale - this.getDocumentCanvasWidth();
      return overflow * app.dpiScale;
    }
    scrollSelectedCommentBesideThePage() {
      const overflow = Math.round(this.getSelectedCommentOverflow());
      if (overflow <= 0)
        return true;
      app.activeDocument.activeLayout.scroll(overflow, 0);
      return Math.round(this.getSelectedCommentOverflow()) <= 0;
    }
    // Width of the empty space on one side of the document, in canvas pixels,
    // the unit the comment column widths and the section coordinates use.
    calculateAvailableSpace() {
      if (_CommentSection.isMultiColumnLayout()) {
        const layout = app.activeDocument.activeLayout;
        const availableSpace = layout.getTotalSideSpace();
        return Math.round(availableSpace * 0.5);
      } else {
        const availableSpace = (this.containerObject.getDocumentAnchorSection().size[0] - app.activeDocument.fileSize.pX) * 0.5;
        return Math.floor(availableSpace);
      }
    }
    shouldCollapse() {
      if (app.map._docLayer._docType === "text")
        return false;
      if (!this.containerObject.getDocumentAnchorSection() || app.map._docLayer._docType === "spreadsheet" || window.mode.isSmallScreenDevice())
        return false;
      const availableSpace = this.calculateAvailableSpace();
      if (app.activeDocument.activeLayout.viewHasEnoughSpaceToShowFullWidthComments())
        return false;
      return availableSpace < this.sectionProperties.commentWidth;
    }
    hideAllComments() {
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        if (!this.sectionProperties.doNotHideCommentTimer || this.sectionProperties.commentList[i] !== this.sectionProperties.selectedComment)
          this.sectionProperties.commentList[i].hide();
        const part = app.map._docLayer._selectedPart;
        if (app.map._docLayer._docType === "spreadsheet") {
          if (parseInt(this.sectionProperties.commentList[i].sectionProperties.data.tab) === part) {
            this.sectionProperties.commentList[i].drawingOrder = 2;
          } else {
            this.sectionProperties.commentList[i].drawingOrder = 1;
          }
        }
      }
      if (app.map._docLayer._docType === "spreadsheet")
        this.containerObject.applyDrawingOrders();
    }
    // Mobile.
    getChildren(comment, array) {
      for (var i = 0; i < comment.sectionProperties.children.length; i++) {
        array.push(comment.sectionProperties.children[i]);
        if (comment.sectionProperties.children[i].sectionProperties.children.length > 0)
          this.getChildren(comment.sectionProperties.children[i], array);
      }
    }
    // Mobile.
    getCommentListOneDimensionalArray() {
      var openArray = [];
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        if (this.sectionProperties.commentList[i].isRootComment()) {
          openArray.push(this.sectionProperties.commentList[i]);
          if (this.sectionProperties.commentList[i].sectionProperties.children.length > 0)
            this.getChildren(this.sectionProperties.commentList[i], openArray);
        }
      }
      return openArray;
    }
    createCommentStructureWriter(menuStructure, threadOnly) {
      var rootComment, comment;
      const commentList = this.getCommentListOneDimensionalArray();
      const showResolved = this.sectionProperties.showResolved;
      if (threadOnly) {
        if (!threadOnly.sectionProperties.data.trackchange && threadOnly.sectionProperties.data.parent !== "0")
          threadOnly = commentList[this.getIndexOf(threadOnly.sectionProperties.data.parent)];
      }
      for (var i = 0; i < commentList.length; i++) {
        if (commentList[i].isRootComment() || commentList[i].sectionProperties.data.trackchange) {
          var commentThread = [];
          do {
            comment = {
              id: "comment" + commentList[i].sectionProperties.data.id,
              enable: true,
              data: commentList[i].sectionProperties.data,
              type: "comment",
              text: commentList[i].sectionProperties.data.text,
              annotation: commentList[i],
              children: []
            };
            if (showResolved || comment.data.resolved !== "true") {
              commentThread.unshift(comment);
            }
            i++;
          } while (commentList[i] && commentList[i].sectionProperties.data.parent !== "0");
          i--;
          if (commentThread.length > 0) {
            rootComment = {
              id: commentThread[commentThread.length - 1].id,
              enable: true,
              data: commentThread[commentThread.length - 1].data,
              type: "rootcomment",
              text: commentThread[commentThread.length - 1].data.text,
              annotation: commentThread[commentThread.length - 1].annotation,
              children: commentThread
            };
            var matchingThread = threadOnly && threadOnly.sectionProperties.data.id === commentThread[0].data.id;
            if (matchingThread)
              menuStructure["children"] = commentThread;
            else if (!threadOnly)
              menuStructure["children"].push(rootComment);
          }
        }
      }
    }
    createCommentStructureImpress(menuStructure, threadOnly) {
      var rootComment;
      for (var i in this.sectionProperties.commentList) {
        const matchingThread = !threadOnly || threadOnly && threadOnly.sectionProperties.data.id === this.sectionProperties.commentList[i].sectionProperties.data.id;
        if (matchingThread && (this.sectionProperties.commentList[i].sectionProperties.partIndex === app.map._docLayer._selectedPart || app.file.fileBasedView)) {
          rootComment = {
            id: "comment" + this.sectionProperties.commentList[i].sectionProperties.data.id,
            enable: true,
            data: this.sectionProperties.commentList[i].sectionProperties.data,
            type: threadOnly ? "comment" : "rootcomment",
            text: this.sectionProperties.commentList[i].sectionProperties.data.text,
            annotation: this.sectionProperties.commentList[i],
            children: []
          };
          menuStructure["children"].push(rootComment);
        }
      }
    }
    createCommentStructureCalc(menuStructure, threadOnly) {
      var rootComment;
      const commentList = this.sectionProperties.commentList;
      const selectedTab = app.map._docLayer._selectedPart;
      for (var i = 0; i < commentList.length; i++) {
        var matchingThread = !threadOnly || threadOnly && threadOnly.sectionProperties.data.id === commentList[i].sectionProperties.data.id;
        if (parseInt(commentList[i].sectionProperties.data.tab) === selectedTab && matchingThread) {
          rootComment = {
            id: "comment" + commentList[i].sectionProperties.data.id,
            enable: true,
            data: commentList[i].sectionProperties.data,
            type: threadOnly ? "comment" : "rootcomment",
            text: commentList[i].sectionProperties.data.text,
            annotation: commentList[i],
            children: []
          };
          menuStructure["children"].push(rootComment);
        }
      }
    }
    // threadOnly - takes annotation indicating which thread will be generated
    createCommentStructure(menuStructure, threadOnly) {
      if (app.map._docLayer._docType === "text") {
        this.createCommentStructureWriter(menuStructure, threadOnly);
      } else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
        this.createCommentStructureImpress(menuStructure, threadOnly);
      } else if (app.map._docLayer._docType === "spreadsheet") {
        this.createCommentStructureCalc(menuStructure, threadOnly);
      }
    }
    isMobileCommentActive() {
      const newComment = document.getElementById(this.mobileCommentId);
      if (!newComment)
        return false;
      return newComment.style.display !== "none";
    }
    getMobileCommentModalId() {
      return this.mobileCommentModalId;
    }
    newAnnotationMobile(comment, addCommentFn, isMod) {
      const commentData = comment.sectionProperties.data;
      const callback = function(div) {
        if (div.textContent || div.innerHTML) {
          var annotation = comment;
          annotation.sectionProperties.data.text = div.textContent;
          annotation.sectionProperties.data.html = div.innerHTML;
          comment.text = div.textContent;
          addCommentFn.call(annotation, annotation, comment);
          if (!isMod)
            this.containerObject.removeSection(annotation);
        } else {
          this.cancel(comment);
        }
      }.bind(this);
      let listId = "mentionPopupList";
      if (this.map.mention)
        listId = this.map.mention.getPopupId() + "List";
      const json = this.map.uiManager._modalDialogJSON(this.mobileCommentId, "", true, [
        {
          id: "input-modal-input",
          type: "multilineedit",
          text: commentData.text && isMod ? commentData.text : "",
          html: commentData.html && isMod ? commentData.html : "",
          contenteditable: true
        },
        {
          id: listId,
          type: "treelistbox",
          text: "",
          enabled: true,
          singleclickactivate: false,
          fireKeyEvents: true,
          hideIfEmpty: true,
          entries: [],
          noSearchField: true
        },
        {
          id: "",
          type: "buttonbox",
          text: "",
          enabled: true,
          children: [
            {
              id: "response-cancel",
              type: "pushbutton",
              text: _("Cancel")
            },
            {
              id: "response-ok",
              type: "pushbutton",
              text: _("Save"),
              "has_default": true
            }
          ],
          vertical: false,
          layoutstyle: "end"
        }
      ]);
      const cancelFunction = function() {
        this.cancel(comment);
        this.map.uiManager.closeModal(this.mobileCommentModalId);
      }.bind(this);
      const mentionListCallback = function(objectType, eventType, object, index) {
        const mention = this.map.mention;
        if (eventType === "close")
          mention.closeMentionPopup(false);
        else if (eventType === "select" || eventType === "activate") {
          const item = mention.getMentionUserData(index);
          const replacement = "@" + mention.getPartialMention();
          const uid = item.label ?? item.username;
          if (uid !== "" && item.profile !== "")
            comment.autoCompleteMention(uid, item.profile, replacement);
          mention.closeMentionPopup(false);
        }
      }.bind(this);
      this.map.uiManager.showModal(json, [
        { id: "response-ok", func: function() {
          if (typeof callback === "function") {
            const input = document.getElementById("input-modal-input");
            callback(input);
          }
          this.map.uiManager.closeModal(this.mobileCommentModalId);
        }.bind(this) },
        { id: "response-cancel", func: cancelFunction },
        { id: "__POPOVER__", func: cancelFunction },
        { id: "__DIALOG__", func: cancelFunction },
        { id: listId, func: mentionListCallback }
      ]);
      app.layoutingService.appendLayoutingTask(() => {
        const multilineEditDiv = document.getElementById("input-modal-input");
        multilineEditDiv.addEventListener("input", function(ev) {
          var _a;
          if (ev && app.map._docLayer._docType === "text") {
            (_a = this.map) == null ? void 0 : _a.mention.handleMentionInput(ev, comment.isNewPara());
          }
        }.bind(this));
        const tagTd = "td", empty = "", tagDiv = "div";
        const author = window.L.DomUtil.create("table", "cool-annotation-table");
        const tbody = window.L.DomUtil.create("tbody", empty, author);
        const tr = window.L.DomUtil.create("tr", empty, tbody);
        const tdImg = window.L.DomUtil.create(tagTd, "cool-annotation-img", tr);
        const tdAuthor = window.L.DomUtil.create(tagTd, "cool-annotation-author", tr);
        const imgAuthor = window.L.DomUtil.create("img", "avatar-img", tdImg);
        const user = this.map.getViewId(commentData.author);
        if (this.map["wopi"] && this.map["wopi"].CommentAvatarUrl)
          imgAuthor.setAttribute("src", this.map["wopi"].CommentAvatarUrl);
        else
          app.LOUtil.setUserImage(imgAuthor, this.map, user);
        imgAuthor.setAttribute("width", 32);
        imgAuthor.setAttribute("height", 32);
        const authorAvatarImg = imgAuthor;
        const contentAuthor = window.L.DomUtil.create(tagDiv, "cool-annotation-content-author", tdAuthor);
        const contentDate = window.L.DomUtil.create(tagDiv, "cool-annotation-date", tdAuthor);
        $(contentAuthor).text(commentData.author);
        if (!this.map["wopi"] || !this.map["wopi"].CommentAvatarUrl)
          $(authorAvatarImg).attr("src", commentData.avatar);
        if (user >= 0) {
          const color = app.LOUtil.rgbToHex(this.map.getViewColor(user));
          $(authorAvatarImg).css("border-color", color);
        }
        if (commentData.dateTime) {
          const d = commentData.dateTimeUtc ? new Date(commentData.dateTimeUtc) : new Date(commentData.dateTime.replace(/,.*/, ""));
          const dateOptions = { weekday: "short", year: "numeric", month: "short", day: "numeric" };
          $(contentDate).text(isNaN(d.getTime()) ? comment.dateTime : d.toLocaleDateString(String.locale, dateOptions));
        }
        const newAnnotationDialog = document.getElementById(this.mobileCommentId);
        $(newAnnotationDialog).css("width", "100%");
        const dialogInput = newAnnotationDialog.children[0];
        $(dialogInput).css("height", "30vh");
        const parent = newAnnotationDialog.parentElement;
        parent.insertBefore(author, parent.childNodes[0]);
        document.getElementById("input-modal-input").focus();
      });
    }
    highlightComment(comment) {
      this.removeHighlighters();
      const commentList = this.sectionProperties.commentList;
      let lastChild = this.getLastChildIndexOf(comment.sectionProperties.data.id);
      while (lastChild >= 0) {
        commentList[lastChild].highlight();
        if (commentList[lastChild].isRootComment())
          break;
        lastChild = this.getIndexOf(commentList[lastChild].sectionProperties.data.parent);
      }
      this.scrollCommentIntoView(comment);
    }
    removeHighlighters() {
      var commentList = this.sectionProperties.commentList;
      for (var i = 0; i < commentList.length; i++) {
        if (commentList[i].sectionProperties.isHighlighted) {
          commentList[i].removeHighlight();
        }
      }
    }
    removeItem(id) {
      var annotation;
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        annotation = this.sectionProperties.commentList[i];
        if (annotation.sectionProperties.data.id === id) {
          this.containerObject.removeSection(annotation.name);
          this.sectionProperties.commentList.splice(i, 1);
          this.updateIdIndexMap();
          break;
        }
      }
      var masterElementIndex = this.sectionProperties.calcMasterList.findIndex((el) => el.id == id);
      if (masterElementIndex >= 0) {
        this.sectionProperties.calcMasterList.splice(masterElementIndex, 1);
      }
      this.checkSize();
      app.map.fire("deleteannotation");
    }
    startCommentPlacement(onPicked) {
      if (this.placementOnPicked)
        return;
      const canvas = document.getElementById("document-canvas");
      if (!canvas)
        return;
      this.placementOnPicked = onPicked;
      canvas.classList.add("comment-placement-cursor");
      canvas.addEventListener("mousedown", this.onPlacementMouseDown, true);
      document.addEventListener("keydown", this.onPlacementKeyDown, true);
    }
    exitCommentPlacement() {
      const canvas = document.getElementById("document-canvas");
      if (canvas) {
        canvas.removeEventListener("mousedown", this.onPlacementMouseDown, true);
        canvas.removeEventListener("mousemove", this.onPlacementMouseMove, true);
        canvas.removeEventListener("mouseup", this.onPlacementMouseUp, true);
        canvas.classList.remove("comment-placement-cursor");
      }
      document.removeEventListener("keydown", this.onPlacementKeyDown, true);
      this.removePlacementOverlay();
      this.placementOnPicked = null;
      this.placementStart = null;
    }
    onPlacementMouseDown(e) {
      if (e.button !== 0)
        return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      this.placementStart = {
        cX: e.clientX - rect.left,
        cY: e.clientY - rect.top
      };
      canvas.addEventListener("mousemove", this.onPlacementMouseMove, true);
      canvas.addEventListener("mouseup", this.onPlacementMouseUp, true);
    }
    onPlacementMouseMove(e) {
      if (!this.placementStart)
        return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const cur = { cX: e.clientX - rect.left, cY: e.clientY - rect.top };
      const dx = cur.cX - this.placementStart.cX;
      const dy = cur.cY - this.placementStart.cY;
      if (!this.placementOverlay && Math.hypot(dx, dy) < _CommentSection.DRAG_THRESHOLD_PX)
        return;
      this.updatePlacementOverlay(canvas, rect, cur);
    }
    onPlacementMouseUp(e) {
      if (e.button !== 0 || !this.placementStart)
        return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const end = { cX: e.clientX - rect.left, cY: e.clientY - rect.top };
      this.finishCommentPlacement(canvas, end);
    }
    updatePlacementOverlay(canvas, rect, cur) {
      if (!this.placementOverlay) {
        this.placementOverlay = document.createElement("div");
        this.placementOverlay.className = "comment-placement-overlay";
        canvas.parentElement.appendChild(this.placementOverlay);
      }
      const x1 = Math.min(this.placementStart.cX, cur.cX);
      const y1 = Math.min(this.placementStart.cY, cur.cY);
      const w = Math.abs(cur.cX - this.placementStart.cX);
      const h = Math.abs(cur.cY - this.placementStart.cY);
      this.placementOverlay.style.left = canvas.offsetLeft + x1 + "px";
      this.placementOverlay.style.top = canvas.offsetTop + y1 + "px";
      this.placementOverlay.style.width = w + "px";
      this.placementOverlay.style.height = h + "px";
    }
    removePlacementOverlay() {
      if (this.placementOverlay && this.placementOverlay.parentNode)
        this.placementOverlay.parentNode.removeChild(this.placementOverlay);
      this.placementOverlay = null;
    }
    onPlacementKeyDown(e) {
      if (e.key !== "Escape")
        return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.exitCommentPlacement();
    }
    finishCommentPlacement(canvas, end) {
      const onPicked = this.placementOnPicked;
      const start = this.placementStart;
      const isDrag = Math.hypot(end.cX - start.cX, end.cY - start.cY) >= _CommentSection.DRAG_THRESHOLD_PX;
      const layout = app.activeDocument.activeLayout;
      const tlPoint = new cool2.SimplePoint(0, 0);
      tlPoint.cX = isDrag ? Math.min(start.cX, end.cX) : end.cX;
      tlPoint.cY = isDrag ? Math.min(start.cY, end.cY) : end.cY;
      const docTL = layout.canvasToDocumentPoint(tlPoint);
      if (Number.isNaN(docTL.x) || Number.isNaN(docTL.y))
        return;
      let docBR = null;
      if (isDrag) {
        const brPoint = new cool2.SimplePoint(0, 0);
        brPoint.cX = Math.max(start.cX, end.cX);
        brPoint.cY = Math.max(start.cY, end.cY);
        docBR = layout.canvasToDocumentPoint(brPoint);
        if (Number.isNaN(docBR.x) || Number.isNaN(docBR.y))
          return;
      }
      const docLayer = app.map._docLayer;
      const fbLayout = layout && layout.type === "ViewLayoutFileBased" ? layout : null;
      const docRects = fbLayout == null ? void 0 : fbLayout.documentRectangles;
      const haveRects = docRects && docRects.length === docLayer._parts;
      let partIndex = -1;
      let yInPart = 0;
      let partTopTwips = 0;
      let partWidthTwips = docLayer._partWidthTwips;
      let partHeightTwips = docLayer._partHeightTwips;
      if (haveRects) {
        for (let i = 0; i < docRects.length; i++) {
          const r = docRects[i];
          if (docTL.y >= r.y1 && docTL.y < r.y1 + r.height) {
            partIndex = i;
            partTopTwips = r.y1;
            yInPart = docTL.y - r.y1;
            partWidthTwips = r.width;
            partHeightTwips = r.height;
            break;
          }
        }
        if (partIndex < 0)
          return;
        if (docTL.x < 0 || docTL.x > partWidthTwips || yInPart > partHeightTwips)
          return;
      } else {
        const additionPerPart = docLayer._partHeightTwips + docLayer._spaceBetweenParts;
        partIndex = Math.floor(docTL.y / additionPerPart);
        yInPart = docTL.y - partIndex * additionPerPart;
        partTopTwips = partIndex * additionPerPart;
        if (partIndex < 0 || partIndex >= docLayer._parts || docTL.x < 0 || docTL.x > docLayer._partWidthTwips || yInPart > docLayer._partHeightTwips)
          return;
      }
      if (docBR) {
        docBR.x = Math.min(docBR.x, partWidthTwips);
        docBR.y = Math.min(docBR.y, partTopTwips + partHeightTwips);
      }
      this.exitCommentPlacement();
      onPicked({ partIndex, partTopTwips, docTL, docBR });
    }
    click(annotation) {
      this.select(annotation);
      app.map.fire("postMessage", {
        msgId: "Clicked_Comment",
        args: { Id: annotation.sectionProperties.data.id }
      });
    }
    save(annotation) {
      var comment;
      if (annotation.sectionProperties.data.id === "new") {
        let positionArgs = {};
        if (annotation.sectionProperties.data.position) {
          const pos = annotation.sectionProperties.data.position;
          let py = pos[1];
          if (app.file.fileBasedView)
            py -= annotation.sectionProperties.data.yAddition || 0;
          positionArgs = {
            PositionX: { type: "int32", value: pos[0] },
            PositionY: { type: "int32", value: py }
          };
          const size = annotation.sectionProperties.data.size;
          if (size) {
            positionArgs.Width = { type: "int32", value: size[0] };
            positionArgs.Height = { type: "int32", value: size[1] };
          }
        }
        comment = {
          Author: {
            type: "string",
            value: annotation.sectionProperties.data.author
          },
          // send if html exists, and it's writer send just html, otherwise text
          ...app.map._docLayer._docType === "text" && annotation.sectionProperties.data.html ? { Html: {
            type: "string",
            value: annotation.sectionProperties.data.html
          } } : { Text: {
            type: "string",
            value: annotation.sectionProperties.data.text
          } },
          ...positionArgs
        };
        var unoCommand = annotation.sectionProperties.data.threaded ? ".uno:InsertThreadedComment" : ".uno:InsertAnnotation";
        if (app.file.fileBasedView) {
          this.map.setPart(app.map._docLayer._selectedPart, false);
          this.map.sendUnoCommand(
            unoCommand,
            comment,
            true
            /* force */
          );
          this.map.setPart(0, false);
        } else {
          this.map.sendUnoCommand(
            unoCommand,
            comment,
            true
            /* force */
          );
        }
        if (!_CommentSection.autoSavedComment)
          this.removeItem(annotation.sectionProperties.data.id);
      } else if (annotation.sectionProperties.data.trackchange) {
        comment = {
          ChangeTrackingId: {
            type: "long",
            value: annotation.sectionProperties.data.index
          },
          Text: {
            type: "string",
            value: annotation.sectionProperties.data.text
          }
        };
        this.map.sendUnoCommand(
          ".uno:CommentChangeTracking",
          comment,
          true
          /* force */
        );
      } else {
        comment = {
          Id: {
            type: "string",
            value: annotation.sectionProperties.data.id
          },
          Author: {
            type: "string",
            value: annotation.sectionProperties.data.author
          },
          // send if html exists, and it's writer send just html, otherwise text
          ...app.map._docLayer._docType === "text" && annotation.sectionProperties.data.html ? { Html: {
            type: "string",
            value: annotation.sectionProperties.data.html
          } } : { Text: {
            type: "string",
            value: annotation.sectionProperties.data.text
          } }
        };
        this.map.sendUnoCommand(
          ".uno:EditAnnotation",
          comment,
          true
          /* force */
        );
      }
      this.unselect();
      this.removeCommentAttention(annotation);
      this.map.focus();
    }
    reply(annotation) {
      if (cool2.Comment.isAnyEdit()) {
        this.navigateAndFocusComment(cool2.Comment.isAnyEdit());
        return;
      }
      if (window.mode.isSmallScreenDevice()) {
        var avatar = void 0;
        var author = this.map.getViewName(app.map._docLayer._viewId);
        if (author in this.map._viewInfoByUserName) {
          avatar = this.map._viewInfoByUserName[author].userextrainfo.avatar;
        }
        if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
          this.newAnnotationMobile(
            annotation,
            annotation.onReplyClick,
            /* isMod */
            false
          );
        } else {
          var replyAnnotation = {
            text: "",
            textrange: "",
            author,
            dateTime: (/* @__PURE__ */ new Date()).toDateString(),
            id: annotation.sectionProperties.data.id,
            avatar,
            parent: annotation.sectionProperties.data.parent,
            anchorPos: [annotation.sectionProperties.data.anchorPos[0], annotation.sectionProperties.data.anchorPos[1]]
          };
          const name = cool2.Comment.makeName(replyAnnotation) + "-reply";
          var replyAnnotationSection = new cool2.Comment(name, replyAnnotation, replyAnnotation.id === "new" ? { noMenu: true } : {}, this);
          this.newAnnotationMobile(
            replyAnnotationSection,
            annotation.onReplyClick,
            /* isMod */
            false
          );
        }
      } else {
        annotation.reply();
        this.select(annotation, true);
        annotation.focus();
      }
    }
    modify(annotation) {
      if (!annotation.isAuthor())
        return;
      if (cool2.Comment.isAnyEdit()) {
        this.navigateAndFocusComment(cool2.Comment.isAnyEdit());
        return;
      }
      if (window.mode.isSmallScreenDevice()) {
        this.newAnnotationMobile(
          annotation,
          function(annotation2) {
            this.save(annotation2);
          }.bind(this),
          /* isMod */
          true
        );
      } else {
        var tempFunction = function() {
          setTimeout(function() {
            if (annotation.sectionProperties.container && annotation.sectionProperties.contextMenu === true) {
              tempFunction();
            } else {
              annotation.edit();
              this.select(annotation, true);
              annotation.focus();
            }
          }.bind(this), 1);
        }.bind(this);
        tempFunction();
      }
    }
    showCollapsedReplies(rootIndex) {
      if (!this.sectionProperties.commentList.length)
        return;
      var lastIndex = this.getLastChildIndexOf(this.sectionProperties.commentList[rootIndex].sectionProperties.data.id);
      var rootComment = this.sectionProperties.commentList[rootIndex];
      while (rootIndex <= lastIndex) {
        this.sectionProperties.commentList[rootIndex].sectionProperties.container.style.display = "";
        this.sectionProperties.commentList[rootIndex].sectionProperties.container.style.visibility = "";
        $(this.sectionProperties.commentList[rootIndex].sectionProperties.container).removeClass("collapsed-comment");
        rootIndex++;
      }
      rootComment.updateThreadInfoIndicator();
    }
    collapseReplies(rootIndex, rootId) {
      var lastChild = this.getLastChildIndexOf(rootId);
      $(this.sectionProperties.commentList[rootIndex].sectionProperties.container).addClass("collapsed-comment");
      for (var i = lastChild; i > rootIndex; i--) {
        this.sectionProperties.commentList[i].sectionProperties.container.style.display = "none";
        $(this.sectionProperties.commentList[i].sectionProperties.container).addClass("collapsed-comment");
      }
      this.sectionProperties.commentList[i].updateThreadInfoIndicator();
    }
    cssToCorePixels(cssPixels) {
      return cssPixels * app.dpiScale;
    }
    select(annotation, force = false) {
      var _a;
      if (force || annotation && !annotation.pendingInit && annotation !== this.sectionProperties.selectedComment && (annotation.sectionProperties.data.resolved !== "true" || this.sectionProperties.showResolved)) {
        var idx = this.getRootIndexOf(annotation.sectionProperties.data.id);
        this.sectionProperties.expandedComment = annotation;
        if (this.sectionProperties.selectedComment === this.sectionProperties.commentList[idx]) {
          this.update();
          return;
        }
        if (this.sectionProperties.selectedComment)
          this.unselect();
        this.sectionProperties.selectedComment = this.sectionProperties.commentList[idx];
        if (this.sectionProperties.selectedComment && !$(this.sectionProperties.selectedComment.sectionProperties.container).hasClass("annotation-active")) {
          $(this.sectionProperties.selectedComment.sectionProperties.container).addClass("annotation-active");
        }
        if (app.map._docLayer._docType === "text" && this.sectionProperties.showSelectedBigger) {
          this.setThreadPopup(this.sectionProperties.selectedComment, true);
        }
        this.scrollCommentIntoView(annotation);
        const selectedComment = this.sectionProperties.selectedComment;
        if (this.isCollapsed) {
          this.showCollapsedReplies(idx);
          selectedComment.updateThreadInfoIndicator();
        }
        if (app.map._docLayer._docType !== "spreadsheet") {
          (_a = this.sectionProperties.selectedComment) == null ? void 0 : _a.setContainerPos(true, this.sectionProperties.canvasContainerBounds);
        }
        if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing" || app.map._docLayer._docType === "text")
          this.listenForClickOutsideComment(true);
        this.update();
      }
    }
    // Focus the edit icon of the given comment, else its menu: only the
    // author's comments have an edit icon
    focusCommentButton(comment) {
      var container = comment.sectionProperties.container;
      app.layoutingService.appendLayoutingTask(() => {
        var _a;
        var editIcon = container == null ? void 0 : container.querySelector(".cool-annotation-menu-edit");
        if (editIcon)
          editIcon.focus();
        if (!editIcon || document.activeElement !== editIcon)
          (_a = comment.sectionProperties.menu) == null ? void 0 : _a.focus();
      });
    }
    isCommentVerticallyInView(comment) {
      const container = comment.sectionProperties.container;
      if (!container || !comment.isContainerVisible())
        return false;
      const rect = container.getBoundingClientRect();
      const documentRect = document.getElementById("document-container").getBoundingClientRect();
      return rect.top >= documentRect.top && rect.bottom <= documentRect.bottom;
    }
    scrollCommentIntoView(comment) {
      if (_CommentSection.importingComments || _CommentSection.showingEveryComment || !comment)
        return;
      if (!comment.sectionProperties || !comment.sectionProperties.data) {
        app.console.error("scrollCommentIntoView: comment without valid data");
        return;
      }
      const rootComment = this.sectionProperties.commentList[this.getRootIndexOf(comment.sectionProperties.data.id)];
      if (!rootComment) {
        app.console.error('scrollCommentIntoView: cannot find root comment with id: "' + comment.sectionProperties.data.id + '"');
        return;
      }
      if (!rootComment.sectionProperties.data.anchorSPoint) {
        const anchorPos2 = rootComment.sectionProperties.data.anchorPos;
        rootComment.sectionProperties.data.anchorSPoint = new cool2.SimplePoint(anchorPos2[0], anchorPos2[1]);
      }
      const anchorPos = rootComment.sectionProperties.data.anchorSPoint;
      const isSpreadsheet = app.map._docLayer._docType === "spreadsheet";
      const cellRange = isSpreadsheet ? rootComment.sectionProperties.data.cellRange : null;
      let leftTwips = anchorPos.toArray()[0];
      let topTwips = anchorPos.toArray()[1];
      if (cellRange) {
        const cellRectangle = app.map._docLayer._cellRangeToTwipRect(cellRange).toRectangle();
        leftTwips = cellRectangle[0];
        topTwips = cellRectangle[1];
      } else if (isSpreadsheet && rootComment.sectionProperties.data.id !== "new") {
        const anchorPrintTwips = app.map._docLayer.sheetGeometry.getPrintTwipsPointFromTile(new cool2.Point(leftTwips, topTwips));
        leftTwips = anchorPrintTwips.x;
        topTwips = anchorPrintTwips.y;
      }
      const layout = app.activeDocument.activeLayout;
      const view = layout.viewedRectangle;
      const split = isSpreadsheet && app.calc.splitCoordinate ? app.calc.splitCoordinate : new cool2.SimplePoint(0, 0);
      const splitXPixels = split.pX;
      const splitYPixels = split.pY;
      const commentHeight = this.cssToCorePixels(rootComment.getCommentHeight());
      const commentBottomTwips = topTwips + Math.round(commentHeight * app.pixelsToTwips);
      const topVisible = _CommentSection.isInScrollingPane(topTwips, split.y, view.y1, view.y2);
      const bottomVisible = _CommentSection.isInScrollingPane(commentBottomTwips, split.y, view.y1, view.y2);
      let scrollX = view.pX1;
      let scrollY = view.pY1;
      const pinnedByFrozenRows = topTwips < split.y;
      const alreadyShown = app.map._docLayer._docType === "text" && this.isCommentVerticallyInView(comment);
      if (!pinnedByFrozenRows && !alreadyShown && (!topVisible || !bottomVisible)) {
        const topPixels = topTwips * app.twipsToPixels;
        const topBottom = this.getScreenTopBottom();
        const viewHeight = topBottom[1] - topBottom[0];
        const paneHeight = viewHeight - splitYPixels;
        const needsScrollDown = topPixels > topBottom[0] + splitYPixels;
        scrollY = topPixels - splitYPixels - paneHeight * 0.05;
        if (needsScrollDown) {
          const bottomViewPos = topPixels + commentHeight + paneHeight * 0.05 - viewHeight;
          if (bottomViewPos < scrollY)
            scrollY = bottomViewPos;
        }
        scrollY = Math.round(scrollY);
      }
      const pinnedByFrozenColumns = leftTwips < split.x;
      const leftVisible = _CommentSection.isInScrollingPane(leftTwips, split.x, view.x1, view.x2);
      if (isSpreadsheet && !app.map._docLayer.isCalcRTL() && !pinnedByFrozenColumns && !leftVisible) {
        const paneWidth = view.pWidth - splitXPixels;
        scrollX = Math.round(leftTwips * app.twipsToPixels - splitXPixels - paneWidth * 0.05);
      }
      const besideThePage = this.keepsSelectedCommentBesideThePage();
      const multiColumn = _CommentSection.isMultiColumnLayout();
      if (besideThePage && !multiColumn)
        scrollX = Math.max(scrollX, Math.round(view.pX1 + this.getSelectedCommentOverflow()));
      if (scrollX !== view.pX1 || scrollY !== view.pY1) {
        layout.scrollTo(scrollX, scrollY);
        if (isSpreadsheet) {
          rootComment.positionCalcComment();
          rootComment.focus();
        }
      }
      if (besideThePage)
        this.pendingSelectedCommentReveal = !this.scrollSelectedCommentBesideThePage();
    }
    // Where a document position on one axis sits: the pane that scrolls runs from
    // the split line, where the frozen rows or columns end, to the far edge of the
    // view. Positions are in twips.
    static isInScrollingPane(position, split, viewStart, viewEnd) {
      return position >= viewStart + split && position <= viewEnd;
    }
    /// returns canvas top and bottom position in core pixels
    getScreenTopBottom() {
      const screenTop = app.activeDocument.activeLayout.viewedRectangle.pY1;
      const screenBottom = screenTop + this.cssToCorePixels($("#map").height());
      return [screenTop, screenBottom];
    }
    unselect() {
      this.pendingSelectedCommentReveal = false;
      this.listenForClickOutsideComment(false);
      if (this.sectionProperties.selectedComment && this.sectionProperties.selectedComment.sectionProperties.data.id != "new") {
        if (this.sectionProperties.selectedComment.sectionProperties.isHighlighted)
          this.sectionProperties.selectedComment.removeHighlight();
        for (const comment of this.sectionProperties.commentList) {
          if (window.L.DomUtil.hasClass(comment.sectionProperties.container, "annotation-active"))
            window.L.DomUtil.removeClass(comment.sectionProperties.container, "annotation-active");
        }
        if (app.map._docLayer._docType === "spreadsheet")
          this.sectionProperties.selectedComment.hide();
        if (this.sectionProperties.commentsAreListed && this.isCollapsed) {
          this.sectionProperties.selectedComment.setCollapsed();
          this.collapseReplies(this.getRootIndexOf(this.sectionProperties.selectedComment.sectionProperties.data.id), this.sectionProperties.selectedComment.sectionProperties.data.id);
        }
        if (app.map._docLayer._docType === "text" && this.sectionProperties.showSelectedBigger) {
          this.setThreadPopup(this.sectionProperties.selectedComment, false);
          this.sectionProperties.showSelectedBigger = false;
        }
        const previouslySelectedComment = this.sectionProperties.selectedComment;
        this.sectionProperties.selectedComment = null;
        this.sectionProperties.expandedComment = null;
        if (app.map._docLayer._docType !== "spreadsheet") {
          previouslySelectedComment.setContainerPos(true, this.sectionProperties.canvasContainerBounds);
        }
        this.update();
      }
    }
    // Escape selected comment and also comment in full view mode.
    escapeSelectedComment() {
      this.escapeListener = (e) => {
        if (e.key !== "Escape")
          return;
        this.unselect();
        this.map.focus();
      };
      document.addEventListener("keydown", this.escapeListener);
    }
    // Whether a card of the thread that starts at rootIndex is in edit mode.
    threadInEditMode(rootIndex) {
      const commentList = this.sectionProperties.commentList;
      if (rootIndex < 0)
        return false;
      for (let i = rootIndex; i < commentList.length; i++) {
        if (i > rootIndex && commentList[i].sectionProperties.data.parent === "0")
          break;
        if (commentList[i].isEdit())
          return true;
      }
      return false;
    }
    // The listener lives only while a comment is open, attached on select and
    // detached on unselect.
    listenForClickOutsideComment(listen) {
      const documentContainer = document.getElementById("document-container");
      if (!documentContainer)
        return;
      if (listen)
        documentContainer.addEventListener("click", this.onClickOutsideComment);
      else
        documentContainer.removeEventListener("click", this.onClickOutsideComment);
    }
    setThreadPopup(comment, popup) {
      if (popup && !$(comment.sectionProperties.container).hasClass("annotation-pop-up"))
        $(comment.sectionProperties.container).addClass("annotation-pop-up");
      else if (!popup && $(comment.sectionProperties.container).hasClass("annotation-pop-up"))
        $(comment.sectionProperties.container).removeClass("annotation-pop-up");
      for (const childComment of comment.sectionProperties.children) {
        this.setThreadPopup(childComment, popup);
      }
    }
    toggleShowBigger(comment) {
      const rootComment = this.sectionProperties.commentList[this.getRootIndexOf(comment.sectionProperties.data.id)];
      const isSelected = this.sectionProperties.selectedComment === rootComment;
      if (this.sectionProperties.showSelectedBigger && isSelected) {
        this.sectionProperties.showSelectedBigger = false;
        this.setThreadPopup(this.sectionProperties.selectedComment, false);
      } else if (!isSelected) {
        if (this.sectionProperties.selectedComment)
          this.unselect();
        this.sectionProperties.showSelectedBigger = true;
        this.select(comment);
      } else {
        this.sectionProperties.showSelectedBigger = true;
        this.setThreadPopup(rootComment, true);
        this.scrollCommentIntoView(comment);
      }
      this.update();
    }
    showInNavigator(comment) {
      if (app.map.getDocType() === "text" || app.map.getDocType() === "spreadsheet") {
        app.dispatcher.dispatch("showcommentsnavigator", comment.sectionProperties.data.id);
      }
    }
    saveReply(annotation) {
      const comment = {
        Id: {
          type: "string",
          value: annotation.sectionProperties.data.id
        },
        // send if html exists, and it's writer send just html, otherwise text
        ...app.map._docLayer._docType === "text" && annotation.sectionProperties.data.html ? { Html: {
          type: "string",
          value: annotation.sectionProperties.data.html
        } } : { Text: {
          type: "string",
          value: annotation.sectionProperties.data.reply
        } }
      };
      if (app.map._docLayer._docType === "text" || app.map._docLayer._docType === "spreadsheet")
        this.map.sendUnoCommand(".uno:ReplyComment", comment);
      else if (app.map._docLayer._docType === "presentation")
        this.map.sendUnoCommand(".uno:ReplyToAnnotation", comment);
      this.unselect();
      this.map.focus();
    }
    cancel(annotation) {
      this.removeCommentAttention(annotation);
      if (annotation.sectionProperties.data.id === "new") {
        this.removeItem(annotation.sectionProperties.data.id);
      }
      if (this.sectionProperties.selectedComment === annotation) {
        this.unselect();
      } else {
        this.update();
      }
      this.map.focus();
    }
    ignoreCursorUntilUserInput() {
      if (this.endCursorMovedByRemove)
        return;
      const events = ["mousedown", "keydown", "touchstart"];
      this.endCursorMovedByRemove = () => {
        this.cardBesideRemoved = null;
        for (const name of events)
          document.removeEventListener(name, this.endCursorMovedByRemove, true);
        this.endCursorMovedByRemove = null;
      };
      for (const name of events)
        document.addEventListener(name, this.endCursorMovedByRemove, true);
    }
    onRedlineAccept(e) {
      const command = {
        AcceptTrackedChange: {
          type: "unsigned short",
          value: e.id.substring("change-".length)
        }
      };
      this.map.sendUnoCommand(".uno:AcceptTrackedChange", command);
      this.unselect();
      this.map.focus();
    }
    onRedlineReject(e) {
      const command = {
        RejectTrackedChange: {
          type: "unsigned short",
          value: e.id.substring("change-".length)
        }
      };
      this.map.sendUnoCommand(".uno:RejectTrackedChange", command);
      this.unselect();
      this.map.focus();
    }
    remove(id) {
      var removedComment = this.getComment(id);
      if (removedComment && !removedComment.canRemove())
        return;
      const comment = {
        Id: {
          type: "string",
          value: id
        }
      };
      if (removedComment) {
        removedComment.sectionProperties.selfRemoved = true;
      }
      if (app.file.fileBasedView)
        this.map.setPart(app.map._docLayer._selectedPart, false);
      if (app.map._docLayer._docType === "text") {
        if (removedComment)
          this.rememberCardBesideRemoved(removedComment);
        this.ignoreCursorUntilUserInput();
        this.map.sendUnoCommand(".uno:DeleteComment", comment);
      } else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing")
        this.map.sendUnoCommand(".uno:DeleteAnnotation", comment);
      else if (app.map._docLayer._docType === "spreadsheet")
        this.map.sendUnoCommand(".uno:DeleteNote", comment);
      if (app.file.fileBasedView)
        this.map.setPart(0, false);
      this.unselect();
      this.map.focus();
    }
    removeThread(id) {
      const rootComment = this.getComment(id);
      if (rootComment && !rootComment.canRemove())
        return;
      const comment = {
        Id: {
          type: "string",
          value: id
        }
      };
      if (app.map._docLayer._docType === "text")
        this.ignoreCursorUntilUserInput();
      this.map.sendUnoCommand(".uno:DeleteCommentThread", comment);
      this.unselect();
      this.map.focus();
    }
    resolve(annotation) {
      if (!annotation.canModerate())
        return;
      const comment = {
        Id: {
          type: "string",
          value: annotation.sectionProperties.data.id
        }
      };
      this.map.sendUnoCommand(".uno:ResolveComment", comment);
    }
    resolveThread(annotation) {
      if (!annotation.canModerate())
        return;
      const comment = {
        Id: {
          type: "string",
          value: annotation.sectionProperties.data.id
        }
      };
      this.map.sendUnoCommand(".uno:ResolveCommentThread", comment);
    }
    promote(annotation) {
      if (!annotation.isAuthor())
        return;
      const comment = {
        Id: {
          type: "string",
          value: annotation.sectionProperties.data.id
        }
      };
      this.map.sendUnoCommand(".uno:PromoteComment", comment);
    }
    getIndexOf(id) {
      const index = this.idIndexMap.get(id);
      return index === void 0 ? -1 : index;
    }
    isSubThreadResolved(annotation) {
      if (annotation.sectionProperties.data.resolved !== "true")
        return false;
      for (var i = 0; i < annotation.sectionProperties.children.length; i++) {
        if (!this.isSubThreadResolved(annotation.sectionProperties.children[i]))
          return false;
      }
      return true;
    }
    isThreadResolved(annotation) {
      if (annotation.isRootComment())
        return this.isSubThreadResolved(annotation);
      const index = this.getRootIndexOf(annotation.sectionProperties.data.parent);
      const top_comment = this.sectionProperties.commentList[index];
      return this.isSubThreadResolved(top_comment);
    }
    isShownBig(annotation) {
      return this.sectionProperties.showSelectedBigger && this.sectionProperties.selectedComment === this.sectionProperties.commentList[this.getRootIndexOf(annotation.sectionProperties.data.id)];
    }
    onResize() {
      this.sectionProperties.commentWidth = _CommentSection.getCommentWidth();
      this.sectionProperties.commentWidthBigger = _CommentSection.getBiggerCommentWidth();
      this.checkCollapseState();
      this.removeHighlighters();
      this.update();
    }
    onNewDocumentTopLeft() {
      if (app.map._docLayer._docType === "spreadsheet") {
        if (this.sectionProperties.selectedComment && !this.sectionProperties.doNotHideCommentTimer)
          this.sectionProperties.selectedComment.hide();
      }
      this._commentPositionDirty = true;
    }
    // The comments are laid out again on the next frame, without animation.
    layoutOnNextDraw() {
      this._commentPositionDirty = true;
      app.sectionContainer.requestReDraw();
    }
    onDraw(frameCount, elapsedTime) {
      if (this._commentPositionDirty) {
        this._commentPositionDirty = false;
        var previousAnimationState = this.disableLayoutAnimation;
        this.disableLayoutAnimation = true;
        this.update(false);
        this.disableLayoutAnimation = previousAnimationState;
      }
    }
    showHideComments() {
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        this.showHideComment(this.sectionProperties.commentList[i]);
      }
    }
    showHideComment(annotation) {
      const commentsShown = this.sectionProperties.show !== false;
      if (!this.sectionProperties.showResolved && app.map._docLayer._docType === "text") {
        const hide = annotation.isContainerVisible() && annotation.sectionProperties.data.resolved === "true";
        if (hide && annotation.isContainerVisible()) {
          if (this.sectionProperties.selectedComment == annotation) {
            this.unselect();
          }
          annotation.hide();
          annotation.update();
        } else if (!hide && !annotation.isContainerVisible() && annotation.sectionProperties.data.resolved === "false" && commentsShown) {
          annotation.show();
          annotation.update();
        }
        this.update();
      } else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
        if (annotation.sectionProperties.partIndex === app.map._docLayer._selectedPart || app.file.fileBasedView) {
          if (!annotation.isContainerVisible() && commentsShown) {
            annotation.show();
            annotation.update();
            this.update();
          }
        } else {
          annotation.hide();
          annotation.update();
          this.update();
        }
      }
    }
    add(comment) {
      if (!comment.sectionProperties) {
        const name = cool2.Comment.makeName(comment);
        const temp = new cool2.Comment(name, comment, comment.id === "new" ? { noMenu: true } : {}, this);
        temp.sectionProperties.data = comment;
        comment = temp;
      }
      comment.sectionProperties.noMenu = comment.sectionProperties.data.id === "new" ? true : false;
      if (this.containerObject.doesSectionExist(comment.name))
        this.removeItem(comment.name);
      this.containerObject.addSection(comment);
      this.sectionProperties.commentList.push(comment);
      this.adjustParentAdd(comment);
      this.orderCommentList();
      this.checkSize();
      if (this.isCollapsed && comment.sectionProperties.data.id !== "new")
        comment.setCollapsed();
      else
        comment.setExpanded();
      const authorName = this.map.getViewName(app.map._docLayer._viewId);
      const newComment = comment.sectionProperties.data.id === "new";
      if (!newComment && authorName === comment.sectionProperties.data.author) {
        this.select(comment);
      }
      app.map.fire("insertannotation");
      return comment;
    }
    adjustRedLine(redline) {
      if (!redline.textRange) {
        console.warn("Redline received has invalid textRange");
        return false;
      }
      redline.id = "change-" + redline.index;
      redline.parent = "0";
      redline.anchorPos = this.stringToRectangles(redline.textRange)[0];
      redline.anchorSPoint = new cool2.SimplePoint(redline.anchorPos[0], redline.anchorPos[1]);
      redline.trackchange = true;
      redline.text = redline.comment;
      redline.rectanglesOriginal = this.stringToRectangles(redline.textRange || redline.anchorPos || redline.rectangle);
      return true;
    }
    getComment(id) {
      const index = this.getIndexOf(id);
      return index == -1 ? null : this.sectionProperties.commentList[index];
    }
    checkIfCommentHasPreAssignedChildren(comment) {
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        var possibleChild = this.sectionProperties.commentList[i];
        if (possibleChild.sectionProperties.possibleParentCommentId !== null) {
          if (possibleChild.sectionProperties.possibleParentCommentId === comment.sectionProperties.data.id) {
            if (!comment.sectionProperties.children.includes(possibleChild))
              comment.sectionProperties.children.push(possibleChild);
            possibleChild.sectionProperties.data.parent = comment.sectionProperties.data.id;
            if (app.map._docLayer._docType === "text")
              possibleChild.sectionProperties.data.parentId = comment.sectionProperties.data.id;
            possibleChild.sectionProperties.possibleParentCommentId = null;
          }
        }
      }
    }
    // Adjust parent-child relationship, if required, after `comment` is added
    adjustParentAdd(comment) {
      if (comment.sectionProperties.data.parent === void 0)
        comment.sectionProperties.data.parent = "0";
      if (comment.sectionProperties.data.parent !== "0") {
        var parentIdx = this.getIndexOf(comment.sectionProperties.data.parent);
        if (parentIdx === -1) {
          console.warn("adjustParentAdd: No parent comment to attach received comment to. Parent comment ID sought is :" + comment.sectionProperties.data.parent + " for current comment with ID : " + comment.sectionProperties.data.id);
          comment.sectionProperties.possibleParentCommentId = comment.sectionProperties.data.parent;
          comment.setAsRootComment();
        } else {
          var parentComment = this.sectionProperties.commentList[parentIdx];
          if (parentComment && !parentComment.sectionProperties.children.includes(comment))
            parentComment.sectionProperties.children.unshift(comment);
        }
      }
      this.checkIfCommentHasPreAssignedChildren(comment);
    }
    // Adjust parent-child relationship, if required, after `comment` is removed
    adjustParentRemove(comment) {
      var parentIdx = this.getIndexOf(comment.getParentCommentId());
      var parentComment = this.sectionProperties.commentList[parentIdx];
      if (parentComment) {
        var index = parentComment.getIndexOfChild(comment);
        if (index >= 0)
          parentComment.removeChildByIndex(index);
      }
      for (var i = 0; i < comment.getChildrenLength(); i++) {
        var childComment = comment.getChildByIndex(i);
        if (childComment)
          childComment.setAsRootComment();
      }
    }
    overWriteCommentChanges(obj, editComment) {
      this.clearAutoSaveStatus();
      editComment.onCancelClick(null);
      this.onACKComment(obj);
    }
    handleCommentConflict(obj, editComment) {
      if (document.getElementById(this.map.uiManager.generateModalId("comments-update")))
        return;
      if (obj.comment.action === "Remove" || obj.comment.action === "RedlinedDeletion") {
        JSDialog.showInfoModalWithOptions("comments-update", {
          "title": _("Comments Updated"),
          "messages": [_("Another user has removed this comment.")],
          "buttons": [{
            "text": _("OK"),
            "callback": () => {
              this.overWriteCommentChanges(obj, editComment);
            }
          }],
          "withCancel": false
        });
        return;
      }
      this.map.uiManager.showYesNoButton("comments-update", _("Comments Updated"), _("Another user has updated the comment. Would you like to overwrite those changes?"), _("Overwrite"), _("Update"), null, () => {
        this.overWriteCommentChanges(obj, editComment);
      }, false);
    }
    checkIfOnlyAnchorPosChanged(obj, editComment) {
      var _a;
      if (obj.comment.action !== "Modify")
        return false;
      var newComment = obj.comment;
      var editCommentData = editComment.sectionProperties.data;
      if (newComment.author !== editCommentData.author || newComment.dateTime !== editCommentData.dateTime || newComment.html !== editCommentData.html || newComment.layoutStatus !== ((_a = editCommentData.layoutStatus) == null ? void 0 : _a.toString()) || newComment.parentId !== editCommentData.parentId || newComment.resolved !== editCommentData.resolved || newComment.textRange !== editCommentData.textRange)
        return false;
      var newAnchorPos = newComment.anchorPos !== void 0 ? newComment.anchorPos : newComment.rectangle;
      if (newAnchorPos === void 0)
        return false;
      if (newAnchorPos.replaceAll(" ", "") !== editCommentData.anchorPos.toString())
        return true;
      return false;
    }
    actionPerformedByCurrentUser(obj) {
      return obj.comment.author === this.map._viewInfo[this.map._docLayer._viewId].username;
    }
    notifyCommentInserted(data) {
      const parent = data.parent ? data.parent : "0";
      const type = parent !== "0" ? "reply" : data.threaded === "true" ? "threaded" : "annotation";
      this.map.fire("postMessage", {
        msgId: "Inserted_Comment",
        args: {
          Id: data.id,
          Type: type,
          Parent: parent,
          Author: data.author,
          DateTime: data.dateTime,
          Text: data.text
        }
      });
    }
    onACKComment(obj) {
      var id;
      if (!obj.redline && obj.comment.id !== void 0 && obj.comment.id !== "new")
        obj.comment.id = String(obj.comment.id);
      const anyEdit = cool2.Comment.isAnyEdit();
      if (anyEdit && !this.checkIfOnlyAnchorPosChanged(obj, anyEdit) && !anyEdit.sectionProperties.selfRemoved && anyEdit.sectionProperties.data.id === obj.comment.id && _CommentSection.autoSavedComment !== anyEdit && !this.actionPerformedByCurrentUser(obj)) {
        this.handleCommentConflict(obj, anyEdit);
        return;
      }
      var changetrack = obj.redline ? true : false;
      var dataroot = changetrack ? "redline" : "comment";
      if (changetrack) {
        obj.redline.id = "change-" + obj.redline.index;
      }
      var action = changetrack ? obj.redline.action : obj.comment.action;
      if (action === "Focus") {
        var comment = this.getComment(obj[dataroot].id);
        if (comment)
          this.focusCommentButton(comment);
        return;
      }
      if (!changetrack && obj.comment.parent === void 0) {
        if (obj.comment.parentId)
          obj.comment.parent = String(obj.comment.parentId);
        else
          obj.comment.parent = "0";
      }
      if (changetrack && obj.redline.author in this.map._viewInfoByUserName) {
        obj.redline.avatar = this.map._viewInfoByUserName[obj.redline.author].userextrainfo.avatar;
      } else if (!changetrack && obj.comment.author in this.map._viewInfoByUserName) {
        obj.comment.avatar = this.map._viewInfoByUserName[obj.comment.author].userextrainfo.avatar;
      }
      if (window.mode.isSmallScreenDevice()) {
        var annotation = this.sectionProperties.commentList[this.getRootIndexOf(obj[dataroot].id)];
        if (!annotation)
          annotation = this.sectionProperties.commentList[this.getRootIndexOf(obj[dataroot].parent)];
      }
      if (action === "Add") {
        if (changetrack) {
          if (!this.adjustRedLine(obj.redline)) {
            return;
          }
          this.add(obj.redline);
        } else {
          const currentComment = this.getComment(obj[dataroot].id);
          if (currentComment !== null) {
            if (obj[dataroot].layoutStatus !== void 0) {
              currentComment.sectionProperties.data.layoutStatus = parseInt(obj[dataroot].layoutStatus);
              currentComment.setLayoutClass();
            }
            return;
          }
          if (app.map._docLayer._docType === "spreadsheet" && obj.comment.id !== "new")
            this.sectionProperties.calcMasterList.push(structuredClone(obj.comment));
          this.adjustComment(obj.comment);
          annotation = this.add(obj.comment);
          if (app.map._docLayer._docType === "spreadsheet")
            annotation.hide();
          if (this.actionPerformedByCurrentUser(obj)) {
            this.notifyCommentInserted(annotation.sectionProperties.data);
            if (app.map._docLayer._docType === "text" && !annotation.isAutoSaved())
              this.addedCommentToShow = annotation;
            if (!annotation.isRootComment())
              app.layoutingService.appendLayoutingTask(() => {
                annotation.scrollDocumentToShowRight();
              });
          }
          var autoSavedComment = _CommentSection.autoSavedComment;
          if (autoSavedComment) {
            var isOurComment = annotation.isAutoSaved();
            if (isOurComment) {
              if (app.definitions.CommentSection.needFocus) {
                app.definitions.CommentSection.needFocus = annotation;
              }
              annotation.sectionProperties.container.style.visibility = "visible";
              annotation.focusLost();
              if (app.map._docLayer._docType === "spreadsheet")
                annotation.show();
              if (autoSavedComment.sectionProperties.data.id === "new")
                this.removeItem(autoSavedComment.sectionProperties.data.id);
              annotation.edit();
              if (this.shouldCollapse())
                annotation.setCollapsed();
              _CommentSection.autoSavedComment = null;
              _CommentSection.commentWasAutoAdded = true;
            }
          }
        }
        if (this.changeAffectsShownComments(annotation))
          this.update();
        if (this.sectionProperties.selectedComment && !this.sectionProperties.selectedComment.isEdit()) {
          this.map.focus();
        }
      } else if (action === "Remove") {
        id = obj[dataroot].id;
        var removed = this.getComment(id);
        if (removed) {
          this.rememberCardBesideRemoved(removed);
          this.adjustParentRemove(removed);
          if (this.sectionProperties.expandedComment === removed)
            this.sectionProperties.expandedComment = this.sectionProperties.selectedComment;
          if (this.sectionProperties.selectedComment === removed) {
            this.unselect();
            this.removeItem(id);
          } else {
            this.removeItem(id);
            if (this.changeAffectsShownComments(removed))
              this.update();
          }
        }
      } else if (action === "RedlinedDeletion") {
        id = obj[dataroot].id;
        var _redlined = this.getComment(id);
        if (_redlined && _redlined.sectionProperties.data.layoutStatus === cool2.CommentLayoutStatus.INSERTED) {
          obj[dataroot].action = "Remove";
          this.onACKComment(obj);
          return;
        }
        if (_redlined) {
          _redlined.sectionProperties.data.layoutStatus = cool2.CommentLayoutStatus.DELETED;
          _redlined.setLayoutClass();
        }
      } else if (action === "Modify") {
        id = obj[dataroot].id;
        var modified = this.getComment(id);
        if (modified) {
          var modifiedObj;
          if (changetrack) {
            if (!this.adjustRedLine(obj.redline)) {
              return;
            }
            modifiedObj = obj.redline;
          } else {
            this.adjustComment(obj.comment);
            modifiedObj = obj.comment;
          }
          const oldParent = modified.getParentCommentId();
          modified.setData(modifiedObj);
          modified.update();
          if (modifiedObj.layoutStatus !== void 0 && modifiedObj.layoutStatus !== null)
            modified.setLayoutClass();
          if (oldParent !== null && modified.isRootComment()) {
            const parentIdx = this.getIndexOf(oldParent);
            const parentComment = this.sectionProperties.commentList[parentIdx];
            if (parentComment) {
              const index = parentComment.getIndexOfChild(modified);
              if (index >= 0)
                parentComment.removeChildByIndex(index);
            }
          }
          if (this.changeAffectsShownComments(modified))
            this.update();
          if (_CommentSection.autoSavedComment) {
            modified.focusLost();
            if (app.map._docLayer._docType === "spreadsheet")
              modified.show();
            modified.edit();
            if (this.shouldCollapse())
              modified.setCollapsed();
          }
        }
      } else if (action === "Resolve") {
        id = obj[dataroot].id;
        var resolved = this.getComment(id);
        if (resolved) {
          var resolvedObj;
          if (changetrack) {
            if (!this.adjustRedLine(obj.redline)) {
              return;
            }
            resolvedObj = obj.redline;
          } else {
            this.adjustComment(obj.comment);
            resolvedObj = obj.comment;
          }
          resolved.setData(resolvedObj);
          resolved.update();
          this.showHideComment(resolved);
          this.update();
        }
      } else if (action === "SearchHighlight") {
        id = obj[dataroot].id;
        const comment2 = this.getComment(id);
        if (comment2) {
          this.clearCommentSearchHit();
          this.commentWithSearchHit = comment2;
          const selection = obj[dataroot].searchSelection.split(",");
          comment2.selectText(parseInt(selection[0]), parseInt(selection[1]), parseInt(selection[2]), parseInt(selection[3]), obj[dataroot].searchText, obj[dataroot].searchOccurrence);
          this.showHideComment(comment2);
        }
      }
      if (window.mode.isSmallScreenDevice()) {
        var shouldOpenWizard = false;
        var wePerformedAction = !changetrack && obj.comment.author === this.map.getViewName(app.map._docLayer._viewId);
        if (window.commentWizard || action === "Add" && wePerformedAction)
          shouldOpenWizard = true;
        if (shouldOpenWizard) {
          app.map._docLayer._openCommentWizard(annotation);
        }
      }
      if (app.map._docLayer._docType === "text") {
        this.updateThreadInfoIndicator();
      }
      if (_CommentSection.pendingImport) {
        app.socket.sendMessage("commandvalues command=.uno:ViewAnnotations");
        _CommentSection.pendingImport = false;
      }
    }
    selectById(commentId) {
      const idx = this.getRootIndexOf(commentId);
      const annotation = this.sectionProperties.commentList[idx];
      this.select(annotation);
    }
    stringToRectangles(str) {
      const strString = typeof str !== "string" ? String(str) : str;
      const matches = strString.match(/\d+/g);
      const rectangles = [];
      if (matches !== null) {
        for (var i = 0; i < matches.length; i += 4) {
          rectangles.push([parseInt(matches[i]), parseInt(matches[i + 1]), parseInt(matches[i + 2]), parseInt(matches[i + 3])]);
        }
      }
      return rectangles;
    }
    onPartChange() {
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        this.showHideComment(this.sectionProperties.commentList[i]);
      }
      if (this.sectionProperties.selectedComment && !this.sectionProperties.doNotHideCommentTimer)
        this.sectionProperties.selectedComment.onCancelClick(null);
      this.checkSize();
    }
    // In file based view, we need to move comments to their part's position.
    // Because all parts are drawn on the screen. Core side doesn't have this feature.
    // Core side sends the information in part coordinates.
    // When a coordinate like [0, 0] is inside 2nd part for example, that coordinate should correspond to a value like (just guessing) [0, 45646].
    // See that y value is different. Because there is 1st part above the 2nd one in the view.
    // We will add their part's position to comment's variables.
    // When we are saving their position, we will remove the additions before sending the information.
    adjustCommentFileBasedView(comment) {
      var index = app.impress.getIndexFromPart(comment.part);
      const layout = app.activeDocument.activeLayout;
      const fbLayout = layout && layout.type === "ViewLayoutFileBased" ? layout : null;
      const partRect = fbLayout == null ? void 0 : fbLayout.getDocumentPartRect(index);
      var yAddition;
      if (partRect) {
        yAddition = partRect.y1;
      } else {
        var partHeightTwips = app.map._docLayer._partHeightTwips + app.map._docLayer._spaceBetweenParts;
        yAddition = index * partHeightTwips;
      }
      comment.yAddition = yAddition;
      comment.trackchange = false;
      comment.rectangles = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle);
      comment.rectangles[0][1] += yAddition;
      comment.rectanglesOriginal = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle);
      comment.rectanglesOriginal[0][1] += yAddition;
      comment.anchorPos = this.stringToRectangles(comment.anchorPos || comment.rectangle)[0];
      comment.anchorPos[1] += yAddition;
      if (comment.rectangle) {
        comment.rectangle = this.stringToRectangles(comment.rectangle)[0];
        comment.rectangle[1] += yAddition;
      }
      comment.anchorSPoint = new cool2.SimplePoint(comment.anchorPos[0], comment.anchorPos[1]);
      comment.part = comment.part ? comment.part : null;
      if (comment.parentId)
        comment.parent = String(comment.parentId);
      var viewId = this.map.getViewId(comment.author);
      var color = viewId >= 0 ? app.LOUtil.rgbToHex(this.map.getViewColor(viewId)) : "#43ACE8";
      comment.color = color;
    }
    // Normally, a comment's position information is the same with the desktop version.
    // So we can use it directly.
    adjustCommentNormal(comment) {
      comment.trackchange = false;
      if (comment.cellRange) {
        comment.cellRange = app.map._docLayer._parseCellRange(comment.cellRange);
      }
      const cellPos = comment.cellRange ? app.map._docLayer._cellRangeToTwipRect(comment.cellRange).toRectangle() : null;
      const rectangles = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle);
      if (rectangles.length === 0 && (cellPos == null ? void 0 : cellPos.length)) {
        rectangles.push(cellPos);
      }
      console.assert(rectangles.length, "Found no rectangles in comment!");
      comment.rectangles = rectangles;
      comment.rectanglesOriginal = structuredClone(rectangles);
      comment.anchorPos = rectangles[0];
      comment.anchorSPoint = new cool2.SimplePoint(comment.anchorPos[0], comment.anchorPos[1]);
      if (app.map._docLayer._docType === "spreadsheet" && app.map._docLayer.sheetGeometry)
        app.map._docLayer.sheetGeometry.convertToTileTwips(comment.anchorSPoint);
      comment.part = comment.part ? comment.part : null;
      comment.tab = comment.tab || comment.tab === 0 ? comment.tab : null;
      comment.layoutStatus = comment.layoutStatus !== void 0 ? parseInt(comment.layoutStatus) : null;
      if (comment.parentId)
        comment.parent = String(comment.parentId);
      if (comment.rectangle) {
        comment.rectangle = this.stringToRectangles(comment.rectangle)[0];
      }
      var viewId = this.map.getViewId(comment.author);
      var color = viewId >= 0 ? app.LOUtil.rgbToHex(this.map.getViewColor(viewId)) : "#43ACE8";
      comment.color = color;
    }
    adjustComment(comment) {
      if (!app.file.fileBasedView)
        this.adjustCommentNormal(comment);
      else
        this.adjustCommentFileBasedView(comment);
    }
    // Returns the last comment id of comment thread containing the given id
    getLastChildIndexOf(id) {
      var index = this.getIndexOf(id);
      index = this.getRootIndexOf(this.sectionProperties.commentList[index].sectionProperties.data.id);
      while (this.sectionProperties.commentList[index + 1] && index + 1 < this.sectionProperties.commentList.length && this.sectionProperties.commentList[index + 1].sectionProperties.data.parent !== "0") {
        index++;
      }
      return index;
    }
    // If the file type is presentation or drawing then we shall check the selected part in order to hide comments from other parts.
    // But if file is in fileBasedView, then we will not hide any comments from not-selected/viewed parts.
    mustCheckSelectedPart() {
      return (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") && !app.file.fileBasedView;
    }
    // Whether a change to the given comment can alter what is on screen. In
    // Writer and Calc every comment takes part in the visible layout, as does
    // every comment in the file-based view, where all slides are on display at
    // once. In Impress and Draw only the comments of the slide on display do.
    changeAffectsShownComments(comment) {
      if (!comment || !this.mustCheckSelectedPart())
        return true;
      return comment.isInsideActivePart();
    }
    layoutUp(subList, actualPosition, lastY, relayout = true) {
      var height;
      for (var i = 0; i < subList.length; i++) {
        if (this.sectionProperties.show != false && !subList[i].isEdit())
          subList[i].show();
        height = subList[i].getCommentHeight(relayout);
        lastY = subList[i].sectionProperties.data.anchorSPoint.vY + height < lastY ? subList[i].sectionProperties.data.anchorSPoint.vY : lastY - height * app.dpiScale;
        subList[i].setContainerPos(false, this.sectionProperties.canvasContainerBounds, actualPosition[0] / app.dpiScale, lastY / app.dpiScale);
      }
      return lastY;
    }
    loopUp(startIndex, x, startY, relayout = true) {
      var tmpIdx = 0;
      var checkSelectedPart = this.mustCheckSelectedPart();
      startY -= this.sectionProperties.marginY;
      for (var i = startIndex; i > -1; ) {
        var subList = [];
        tmpIdx = i;
        do {
          if (this.sectionProperties.commentList[tmpIdx].sectionProperties.data.resolved !== "true" || this.sectionProperties.showResolved) {
            if (!checkSelectedPart || app.map._docLayer._selectedPart === this.sectionProperties.commentList[tmpIdx].sectionProperties.partIndex)
              subList.push(this.sectionProperties.commentList[tmpIdx]);
          }
          tmpIdx = tmpIdx - 1;
        } while (tmpIdx > -1 && this.sectionProperties.commentList[tmpIdx].sectionProperties.data.parent === this.sectionProperties.commentList[tmpIdx + 1].sectionProperties.data.id);
        if (subList.length > 0) {
          if (!subList[0].sectionProperties.data.anchorSPoint)
            subList[0].sectionProperties.data.anchorSPoint = new cool2.SimplePoint(subList[0].sectionProperties.data.anchorPos[0], subList[0].sectionProperties.data.anchorPos[1]);
          startY = this.layoutUp(subList, [x, subList[0].sectionProperties.data.anchorSPoint.vY], startY, relayout);
          i = i - subList.length;
          startY -= this.sectionProperties.marginY;
        } else {
          i = tmpIdx;
        }
      }
      return startY;
    }
    // With followAnchor false, the thread is placed at lastY even when that is
    // above its anchor.
    layoutDown(subList, actualPosition, lastY, relayout = true, followAnchor = true) {
      const selectedComment = subList[0] === this.sectionProperties.selectedComment;
      const documentCanvasWidth = this.getDocumentCanvasWidth();
      const isRTL = document.documentElement.dir === "rtl";
      for (var i = 0; i < subList.length; i++) {
        if (followAnchor)
          lastY = subList[i].sectionProperties.data.anchorSPoint.vY > lastY ? subList[i].sectionProperties.data.anchorSPoint.vY : lastY;
        var renderedCommentTop;
        if (selectedComment) {
          const commentWidth = (this.sectionProperties.showSelectedBigger ? this.sectionProperties.commentWidthBigger : this.sectionProperties.commentWidth) / app.dpiScale;
          let posX = this.sectionProperties.showSelectedBigger ? Math.round((documentCanvasWidth - commentWidth) / 2) : this.getSelectedCommentLeft(actualPosition[0]);
          if (isRTL && posX < 0)
            posX = 0;
          else if (posX + commentWidth > documentCanvasWidth && !this.keepsSelectedCommentBesideThePage()) {
            posX = documentCanvasWidth - commentWidth;
          }
          renderedCommentTop = subList[i].setContainerPos(false, this.sectionProperties.canvasContainerBounds, posX, lastY / app.dpiScale);
        } else {
          renderedCommentTop = subList[i].setContainerPos(false, this.sectionProperties.canvasContainerBounds, actualPosition[0] / app.dpiScale, lastY / app.dpiScale);
        }
        lastY = renderedCommentTop * app.dpiScale;
        lastY += subList[i].getCommentHeight(relayout) * app.dpiScale;
        lastY += Math.round(this.sectionProperties.marginY / 10);
        if (this.sectionProperties.show != false && !subList[i].isEdit())
          subList[i].show();
      }
      return lastY;
    }
    loopDown(startIndex, x, startY, relayout = true) {
      var tmpIdx = 0;
      var checkSelectedPart = this.mustCheckSelectedPart();
      for (var i = startIndex; i < this.sectionProperties.commentList.length; ) {
        var subList = [];
        tmpIdx = i;
        do {
          if (this.sectionProperties.commentList[tmpIdx].sectionProperties.data.resolved !== "true" || this.sectionProperties.showResolved) {
            if (!checkSelectedPart || app.map._docLayer._selectedPart === this.sectionProperties.commentList[tmpIdx].sectionProperties.partIndex)
              subList.push(this.sectionProperties.commentList[tmpIdx]);
          }
          tmpIdx = tmpIdx + 1;
        } while (tmpIdx < this.sectionProperties.commentList.length && this.sectionProperties.commentList[tmpIdx].sectionProperties.data.parent !== "0");
        if (subList.length > 0) {
          if (!subList[0].sectionProperties.data.anchorSPoint)
            subList[0].sectionProperties.data.anchorSPoint = new cool2.SimplePoint(subList[0].sectionProperties.data.anchorPos[0], subList[0].sectionProperties.data.anchorPos[1]);
          startY = this.layoutDown(subList, [x, subList[0].sectionProperties.data.anchorSPoint.vY], startY, relayout);
          i = i + subList.length;
          startY += this.sectionProperties.marginY;
        } else {
          i = tmpIdx;
        }
      }
      return startY;
    }
    // True for Writer in the single-column view, once the page rectangles are
    // known.
    usePerPageLayout() {
      return app.map._docLayer._docType === "text" && !_CommentSection.isMultiColumnLayout() && app.file.writer.pageRectangleList.length > 0;
    }
    // The Writer threads that the column shows. Each thread is a root followed
    // by its replies. Resolved comments are left out unless they are shown.
    collectShownThreads() {
      const list = this.sectionProperties.commentList;
      const threads = [];
      for (let i = 0; i < list.length; ) {
        const thread = [];
        let j = i;
        do {
          const data = list[j].sectionProperties.data;
          if (data.resolved !== "true" || this.sectionProperties.showResolved)
            thread.push(list[j]);
          j++;
        } while (j < list.length && list[j].sectionProperties.data.parent !== "0");
        if (thread.length > 0) {
          const data = thread[0].sectionProperties.data;
          if (!data.anchorSPoint)
            data.anchorSPoint = new cool2.SimplePoint(data.anchorPos[0], data.anchorPos[1]);
          threads.push(thread);
        }
        i = j;
      }
      return threads;
    }
    // The page a twips Y is on. A Y in the gap between two pages goes with the
    // page above.
    pageIndexOfY(y) {
      const pages = app.file.writer.pageRectangleList;
      let first = 0;
      let last = pages.length - 1;
      while (first < last) {
        const middle = first + last + 1 >> 1;
        if (pages[middle][1] <= y)
          first = middle;
        else
          last = middle - 1;
      }
      return first;
    }
    // Lays each page's threads out beside that page, between its top and bottom
    // edges. Returns the bottom of the lowest thread shown, in core pixels.
    layoutByPage(x, relayout) {
      const pages = app.file.writer.pageRectangleList;
      const selected = this.sectionProperties.selectedComment;
      const threadsOfPage = /* @__PURE__ */ new Map();
      let lastY = 0;
      this.pageScrollersInUse.clear();
      for (const thread of this.collectShownThreads()) {
        if (this.sectionProperties.showSelectedBigger && thread[0] === selected) {
          const documentContainer = document.getElementById("document-container");
          for (const comment of thread) {
            if (comment.sectionProperties.container.parentElement !== documentContainer)
              this.moveCard(comment.sectionProperties.container, documentContainer);
          }
          this.layoutDown(thread, [x, thread[0].sectionProperties.data.anchorSPoint.vY], 0, relayout);
          continue;
        }
        const page = this.pageIndexOfY(thread[0].sectionProperties.data.anchorPos[1]);
        if (!threadsOfPage.has(page))
          threadsOfPage.set(page, []);
        threadsOfPage.get(page).push(thread);
      }
      for (const [page, threads] of threadsOfPage) {
        const rect = pages[page];
        const top = new cool2.SimplePoint(rect[0], rect[1]).vY;
        const bottom = new cool2.SimplePoint(rect[0], rect[1] + rect[3]).vY;
        lastY = Math.max(lastY, this.layoutPage(page, threads, x, top, bottom, relayout));
      }
      for (const page of Array.from(this.pageScrollers.keys())) {
        if (!this.pageScrollersInUse.has(page))
          this.releasePageScroller(page);
      }
      return lastY;
    }
    // When a reply or an edit starts on a card outside the page boxes that is
    // out of view, scrolls the document once so that the bottom of the card,
    // where its text box is, shows.
    scrollToEditedComment() {
      const edited = cool2.Comment.isAnyEdit();
      if (edited === this.editShownInView)
        return;
      if (edited && !edited.sectionProperties.container.contains(document.activeElement))
        return;
      this.editShownInView = edited;
      if (edited)
        this.scrollDocumentToCard(edited, false);
    }
    // Scrolls the document so all of a card outside the page boxes shows.
    // Where the card is taller than the view, its top shows when topFirst is
    // true, and its bottom otherwise.
    scrollDocumentToCard(comment, topFirst) {
      const container = comment.sectionProperties.container;
      if (!container.parentElement || container.parentElement.id !== "document-container" || container.style.visibility === "hidden")
        return;
      const margin = this.sectionProperties.marginY / app.dpiScale;
      const viewHeight = this.sectionProperties.canvasContainerBounds.height;
      const top = comment.renderedPosY;
      const bottom = top + comment.getCommentHeight(false);
      let by = 0;
      if (bottom > viewHeight - margin)
        by = bottom - (viewHeight - margin);
      if (top - by < margin && (topFirst || by === 0))
        by = top - margin;
      if (by === 0)
        return;
      const scrollY = Math.max(0, Math.round(app.activeDocument.activeLayout.viewedRectangle.pY1 + by * app.dpiScale));
      app.layoutingService.appendLayoutingTask(() => {
        const layout = app.activeDocument.activeLayout;
        layout.scrollTo(layout.viewedRectangle.pX1, scrollY);
      });
    }
    // Places the threads of a page beside it. Ones that do not all fit between
    // the page's top and bottom edges go into a box as tall as the page, which
    // scrolls them. Returns the bottom of what is shown.
    layoutPage(page, threads, x, top, bottom, relayout) {
      const gap = this.sectionProperties.marginY;
      const replyGap = Math.round(this.sectionProperties.marginY / 10);
      const count = threads.length;
      const anchors = threads.map((thread) => thread[0].sectionProperties.data.anchorSPoint.vY);
      const heights = threads.map((thread) => {
        let height = -replyGap;
        for (const comment of thread)
          height += comment.getCommentHeight(relayout) * app.dpiScale + replyGap;
        return height;
      });
      const selected = threads.findIndex((thread) => thread[0] === this.sectionProperties.selectedComment);
      const ys = anchors.slice();
      for (let i = selected - 1; i >= 0; i--)
        ys[i] = Math.min(anchors[i], ys[i + 1] - gap - heights[i]);
      let next = top;
      for (let i = 0; i < count; i++) {
        ys[i] = Math.max(ys[i], next);
        next = ys[i] + heights[i] + gap;
      }
      if (next - gap > bottom) {
        let limit = bottom;
        for (let i = count - 1; i >= 0; i--) {
          ys[i] = Math.min(ys[i], limit - heights[i]);
          limit = ys[i] - gap;
        }
      }
      if (ys[0] >= top) {
        this.releasePageScroller(page);
        let lastY = 0;
        for (let i = 0; i < count; i++)
          lastY = this.layoutDown(threads[i], [x, anchors[i]], ys[i], false, false);
        return lastY;
      }
      next = top;
      for (let i = 0; i < count; i++) {
        ys[i] = next;
        this.layoutDown(threads[i], [x, anchors[i]], ys[i], false, false);
        next = ys[i] + heights[i] + gap;
      }
      this.putPageInScroller(page, threads, ys, anchors, top, bottom - top, relayout);
      return bottom;
    }
    // Places the threads of a page in the page's scrolling box, stacked from
    // the top of the box. ys, top and height are in core pixels.
    putPageInScroller(page, threads, ys, anchors, top, height, relayout) {
      let scroller = this.pageScrollers.get(page);
      if (!scroller) {
        scroller = window.L.DomUtil.create("div", "cool-annotation-page-scroller", document.getElementById("document-container"));
        scroller.addEventListener("scroll", () => {
          const wanted2 = this.pageScrollTops.get(scroller);
          if (wanted2 !== void 0 && scroller.scrollTop < wanted2 && scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1)
            return;
          this.pageScrollTops.set(scroller, scroller.scrollTop);
        });
        scroller.addEventListener("mouseover", (e) => {
          const button = e.target.closest("[data-title]");
          if (!button)
            return;
          const tooltipHeight = 40;
          const visibleTop2 = Math.max(scroller.getBoundingClientRect().top, this.sectionProperties.canvasContainerBounds.top);
          button.classList.toggle("cool-annotation-tooltip-beside", button.getBoundingClientRect().top - visibleTop2 < tooltipHeight);
        }, true);
        scroller.addEventListener("pointerdown", (e) => {
          const card = e.target.closest(".cool-annotation");
          const comment = card && this.sectionProperties.commentList.find((item) => item.sectionProperties.container === card);
          if (!comment)
            return;
          const selected = this.sectionProperties.selectedComment;
          if (selected && this.getRootIndexOf(comment.sectionProperties.data.id) === this.getRootIndexOf(selected.sectionProperties.data.id))
            return;
          this.cardPressedToSelect = { card, top: card.getBoundingClientRect().top };
        }, true);
        this.pageScrollers.set(page, scroller);
      }
      this.pageScrollersInUse.add(page);
      const comments = threads.flat();
      const left = Math.min(...comments.map((comment) => comment.getContainerPosX()));
      const boxTop = top / app.dpiScale;
      const replyGap = Math.round(this.sectionProperties.marginY / 10) / app.dpiScale;
      const selectedIndex = threads.findIndex((thread) => thread[0] === this.sectionProperties.selectedComment);
      const space = selectedIndex === -1 ? 0 : Math.max(0, (anchors[selectedIndex] - ys[selectedIndex]) / app.dpiScale);
      let selectedTop = -1;
      let selectedAnchor = 0;
      let edited = null;
      let added = null;
      const places = [];
      let cardsMoved = false;
      for (let i = 0; i < threads.length; i++) {
        let cardTop = (ys[i] - top) / app.dpiScale + space;
        if (threads[i][0] === this.sectionProperties.selectedComment) {
          selectedTop = cardTop;
          selectedAnchor = (anchors[i] - top) / app.dpiScale;
        }
        for (const comment of threads[i]) {
          if (comment.sectionProperties.container.parentElement !== scroller)
            cardsMoved = true;
          places.push([Math.round(comment.getContainerPosX() - left), Math.round(cardTop)]);
          comment.renderedPosY = boxTop + cardTop;
          cardTop += comment.getCommentHeight(false) + replyGap;
          if (comment.isEdit())
            edited = comment;
          if (comment === this.addedCommentToShow)
            added = comment;
        }
      }
      const bounds = this.sectionProperties.canvasContainerBounds;
      const scrollbarGap = 8;
      scroller.style.left = Math.round(bounds.left + left - scrollbarGap) + "px";
      scroller.style.top = Math.round(bounds.top + boxTop) + "px";
      scroller.style.height = Math.round(height / app.dpiScale) + "px";
      const cardsKey = places.map((place) => place.join(",")).join(";");
      const cardsChanged = relayout || cardsMoved || this.pageScrollerCards.get(scroller) !== cardsKey;
      if (cardsChanged) {
        this.pageScrollerCards.set(scroller, cardsKey);
        comments.forEach((comment, i) => {
          const card = comment.sectionProperties.container;
          if (card.parentElement !== scroller)
            this.moveCard(card, scroller);
          card.style.left = places[i][0] + "px";
          card.style.top = places[i][1] + "px";
        });
        this.moveCardsOutOfBox(scroller, new Set(comments.map((comment) => comment.sectionProperties.container)));
        let right = 0;
        comments.forEach((comment, i) => {
          right = Math.max(right, places[i][0] + comment.sectionProperties.container.offsetWidth);
        });
        scroller.style.width = Math.round(right + scrollbarGap) + "px";
        const scrollbarWidth = scroller.offsetWidth - scroller.clientWidth;
        if (scrollbarWidth > 0)
          scroller.style.width = Math.round(right + scrollbarGap + scrollbarWidth) + "px";
        scroller.scrollLeft = 0;
      }
      const editedFocused = edited && edited.sectionProperties.container.contains(document.activeElement);
      const selectionToShow = selectedTop !== -1 && this.sectionProperties.selectedComment !== this.selectionShownInBox;
      const beside = this.cardBesideRemoved && this.cardBesideRemoved.card.parentElement === scroller ? this.cardBesideRemoved : null;
      const pressed = this.cardPressedToSelect && selectedIndex !== -1 && threads[selectedIndex].some((comment) => comment.sectionProperties.container === this.cardPressedToSelect.card) ? this.cardPressedToSelect : null;
      if (!cardsChanged && !added && !beside && !(edited ? editedFocused : selectionToShow))
        return;
      const wanted = this.pageScrollTops.get(scroller);
      if (wanted !== void 0)
        scroller.scrollTop = wanted;
      if (beside)
        scroller.scrollTop += beside.card.getBoundingClientRect().top - beside.top;
      const scrolledTo = scroller.scrollTop;
      const visibleTop = scroller.scrollTop + Math.max(0, -boxTop);
      const visibleBottom = scroller.scrollTop + Math.min(scroller.clientHeight, bounds.height - boxTop);
      if (added) {
        const addedTop = added.renderedPosY - boxTop;
        const addedBottom = addedTop + added.getCommentHeight(false);
        if (addedBottom > visibleBottom)
          scroller.scrollTop += Math.min(addedBottom - visibleBottom, addedTop - visibleTop);
        else if (addedTop < visibleTop)
          scroller.scrollTop -= visibleTop - addedTop;
      } else if (edited) {
        const editedBottom = edited.renderedPosY - boxTop + edited.getCommentHeight(false);
        if (editedFocused && visibleBottom > visibleTop && editedBottom > visibleBottom)
          scroller.scrollTop += editedBottom - visibleBottom;
      } else if (selectionToShow && pressed) {
        scroller.scrollTop += pressed.card.getBoundingClientRect().top - pressed.top;
      } else if (selectionToShow) {
        const scrollTop = scroller.scrollTop;
        scroller.scrollTop = selectedTop - selectedAnchor;
        const by = scroller.scrollTop - scrollTop;
        const authorLineHeight = 60;
        const headHeight = Math.min(authorLineHeight, this.sectionProperties.selectedComment.getCommentHeight(false));
        if (selectedTop < visibleTop + by)
          scroller.scrollTop -= visibleTop + by - selectedTop;
        else if (selectedTop + headHeight > visibleBottom + by)
          scroller.scrollTop += selectedTop + headHeight - visibleBottom - by;
      }
      if (scroller.scrollTop !== scrolledTo)
        this.pageScrollTops.set(scroller, scroller.scrollTop);
    }
    // Remembers the card above one that is being removed from a box, or the
    // card below it when it is the first, with that card's top on screen. The
    // cards left in the box change height and place after a removal.
    rememberCardBesideRemoved(removed) {
      if (this.cardBesideRemoved && this.cardBesideRemoved.removed === removed)
        return;
      const card = removed.sectionProperties.container;
      const scroller = card.parentElement;
      if (!scroller || !scroller.classList.contains("cool-annotation-page-scroller"))
        return;
      const cards = Array.from(scroller.children).filter((child) => child.classList.contains("cool-annotation") && child.style.visibility !== "hidden").sort((a, b) => a.offsetTop - b.offsetTop);
      const index = cards.indexOf(card);
      const neighbour = index > 0 ? cards[index - 1] : cards[index + 1];
      if (neighbour)
        this.cardBesideRemoved = { card: neighbour, top: neighbour.getBoundingClientRect().top, removed };
    }
    // Moves a card into or out of a page's box. Taking a card out of the DOM
    // drops the focus, and a card that loses the focus with an empty reply or
    // edit box closes that box. So movingCards is true during the move, and
    // the card gets the focus and the caret back afterwards. The caret is kept
    // as a node and an offset, which stay valid while the card moves.
    moveCard(card, parent) {
      const focused = document.activeElement;
      const hadFocus = focused && card.contains(focused);
      const selection = window.getSelection();
      const caret = hadFocus && selection.rangeCount ? { node: selection.anchorNode, offset: selection.anchorOffset } : null;
      this.movingCards = true;
      try {
        parent.appendChild(card);
        if (hadFocus) {
          focused.focus({ preventScroll: true });
          if (caret && focused.contains(caret.node))
            selection.collapse(caret.node, caret.offset);
        }
      } finally {
        this.movingCards = false;
      }
    }
    // Moves the cards in a box, except the ones in keep, back to their places
    // in the view.
    moveCardsOutOfBox(scroller, keep) {
      const documentContainer = document.getElementById("document-container");
      for (const comment of this.sectionProperties.commentList) {
        const card = comment.sectionProperties.container;
        if (card.parentElement === scroller && !keep.has(card)) {
          this.moveCard(card, documentContainer);
          comment.setContainerPos(true);
        }
      }
    }
    releasePageScroller(page) {
      const scroller = this.pageScrollers.get(page);
      if (!scroller)
        return;
      this.moveCardsOutOfBox(scroller, /* @__PURE__ */ new Set());
      scroller.remove();
      this.pageScrollers.delete(page);
    }
    releasePageScrollers() {
      for (const page of Array.from(this.pageScrollers.keys()))
        this.releasePageScroller(page);
    }
    hideArrow() {
      if (this.sectionProperties.arrow) {
        document.getElementById("document-container").removeChild(this.sectionProperties.arrow);
        this.sectionProperties.arrow = null;
        app.sectionContainer.requestReDraw();
      }
    }
    // Ends the line from the text at the left edge of the selected card when
    // the card starts left of the comment column, as it can when it is held
    // inside the view or placed in its page's box.
    endArrowAtSelectedComment() {
      const selected = this.sectionProperties.selectedComment;
      if (!this.sectionProperties.arrow || !selected)
        return;
      const line = this.sectionProperties.arrow.firstElementChild;
      const x1 = Number(line.getAttribute("x1"));
      const x2 = Number(line.getAttribute("x2"));
      if (x2 <= x1)
        return;
      const cardLeft = Math.floor(selected.sectionProperties.container.getBoundingClientRect().left - this.sectionProperties.canvasContainerBounds.left);
      if (cardLeft < x2)
        line.setAttribute("x2", String(Math.max(x1, cardLeft)));
    }
    showArrow(startPoint, endPoint) {
      startPoint[0] = Math.floor(startPoint[0] / app.dpiScale);
      startPoint[1] = Math.floor(startPoint[1] / app.dpiScale);
      endPoint[0] = Math.floor(endPoint[0] / app.dpiScale);
      endPoint[1] = Math.floor(endPoint[1] / app.dpiScale);
      if (this.sectionProperties.arrow !== null) {
        var line = this.sectionProperties.arrow.firstElementChild;
        line.setAttribute("x1", String(startPoint[0]));
        line.setAttribute("y1", String(startPoint[1]));
        line.setAttribute("x2", String(endPoint[0]));
        line.setAttribute("y2", String(endPoint[1]));
      } else {
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("version", "1.1");
        svg.style.zIndex = "12";
        svg.style.pointerEvents = "none";
        svg.id = "comment-arrow-container";
        svg.style.position = "absolute";
        svg.style.top = svg.style.left = svg.style.right = svg.style.bottom = "0";
        svg.setAttribute("width", String(this.context.canvas.width));
        svg.setAttribute("height", String(this.context.canvas.height));
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.id = "comment-arrow-line";
        line.setAttribute("x1", String(startPoint[0]));
        line.setAttribute("y1", String(startPoint[1]));
        line.setAttribute("x2", String(endPoint[0]));
        line.setAttribute("y2", String(endPoint[1]));
        line.setAttribute("stroke", "darkblue");
        line.setAttribute("stroke-width", "1");
        svg.appendChild(line);
        document.getElementById("document-container").appendChild(svg);
        this.sectionProperties.arrow = svg;
      }
    }
    // The absolute VIEW-space Y (twips) the lowest comment reaches, used to grow
    // viewSize.y. `lastY` is the on-screen (scroll-relative) bottom of the comment
    // stack; converting it to view space needs the on-screen->view offset, which
    // is exactly what documentToViewY adds on top of a point's view-space Y:
    //   - Single-window layouts fold the scroll (and centering) into the viewed
    //     rectangle, and view space == document space, so viewedRectangle.pY1 is
    //     that offset.
    //   - The multi-column layouts (MultiPage/Compare/FileBased) keep the scroll in
    //     scrollProperties.viewY and the canvas anchor in the documentToViewY
    //     mapping (vY = viewY_of_point - scrollProperties.viewY + anchorThickness),
    //     so the offset is scrollProperties.viewY minus the anchor thickness.
    // Either way lastY already carries -offset (through the anchor vY used while the
    // stack was laid out this same frame), so the offset cancels and the result is
    // scroll-invariant - it does not run away as viewSize.y grows.
    commentStackBottomViewTwips(lastY) {
      const layout = app.activeDocument.activeLayout;
      if (!_CommentSection.isMultiColumnLayout())
        return (lastY + layout.viewedRectangle.pY1) * app.pixelsToTwips;
      const anchorThickness = app.sectionContainer.getDocumentAnchor()[1];
      return (lastY + layout.scrollProperties.viewY - anchorThickness) * app.pixelsToTwips;
    }
    getColumnWidth() {
      if (app.map._docLayer._docType !== "text")
        return this.sectionProperties.commentWidth;
      let widest = 0;
      for (const comment of this.sectionProperties.commentList)
        widest = Math.max(widest, comment.sectionProperties.container.offsetWidth);
      const width = widest * app.dpiScale;
      if (width <= this.sectionProperties.commentWidth)
        return this.sectionProperties.commentWidth;
      return width + this.sectionProperties.columnEndMargin * app.dpiScale;
    }
    layout(relayout = true) {
      if (window.mode.isSmallScreenDevice() || app.map._docLayer._docType === "spreadsheet") {
        if (this.sectionProperties.commentList.length > 0)
          this.orderCommentList();
        this.addedCommentToShow = null;
        this.cardBesideRemoved = null;
        return;
      }
      this.sectionProperties.canvasContainerBounds = document.getElementById("document-container").getBoundingClientRect();
      const availableSpace = this.calculateAvailableSpace();
      let byPage = false;
      if (!this.commentsHiddenOrNotPresent()) {
        this.orderCommentList();
        if (relayout)
          this.resetCommentsSize();
        var isRTL = document.documentElement.dir === "rtl";
        var topRight = [this.myTopLeft[0], this.myTopLeft[1] + this.sectionProperties.marginY + new cool2.SimplePoint(0, 0).vY];
        var yOrigin = 0;
        var selectedIndex = null;
        var x = this.getCommentColumnX(availableSpace);
        if (this.sectionProperties.selectedComment) {
          selectedIndex = this.getRootIndexOf(this.sectionProperties.selectedComment.sectionProperties.data.id);
          yOrigin = this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorSPoint.vY;
          var tempCrd = this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorSPoint.vToArray();
          var resolved = this.sectionProperties.commentList[selectedIndex].sectionProperties.data.resolved;
          if (this.sectionProperties.showSelectedBigger) {
            this.hideArrow();
          } else if (!resolved || resolved === "false" || this.sectionProperties.showResolved) {
            var posX = isRTL ? this.containerObject.getDocumentAnchorSection().size[0] + x + 15 : x;
            this.showArrow([tempCrd[0], tempCrd[1]], [posX, tempCrd[1]]);
          }
        } else
          this.hideArrow();
        if (relayout)
          this.resizeLastComment();
        var lastY = 0;
        var stackFromTop = selectedIndex === null || app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing";
        byPage = this.usePerPageLayout();
        if (byPage) {
          lastY = this.layoutByPage(x, relayout);
        } else if (stackFromTop) {
          lastY = this.loopDown(0, x, topRight[1], relayout);
        } else {
          this.loopUp(selectedIndex - 1, x, yOrigin, relayout);
          lastY = this.loopDown(selectedIndex, x, yOrigin, relayout);
        }
        if (!byPage)
          this.releasePageScrollers();
      } else {
        this.releasePageScrollers();
        for (const comment of this.sectionProperties.commentList) {
          comment.setContainerPos(false, this.sectionProperties.canvasContainerBounds);
        }
      }
      if (relayout) {
        this.resizeComments();
        if (!this.commentsHiddenOrNotPresent()) {
          if (byPage)
            lastY = this.layoutByPage(x, false);
          else if (stackFromTop)
            lastY = this.loopDown(0, x, topRight[1], false);
          else
            lastY = this.loopDown(selectedIndex, x, yOrigin, false);
          this.updateChildLines();
        }
      }
      if (byPage && !this.commentsHiddenOrNotPresent()) {
        if (this.sectionProperties.selectedComment !== this.selectionShownInBox)
          this.cardPressedToSelect = null;
        this.selectionShownInBox = this.sectionProperties.selectedComment;
        if (relayout) {
          for (const scroller of this.pageScrollers.values())
            this.pageScrollTops.set(scroller, scroller.scrollTop);
        }
        this.scrollToEditedComment();
        if (this.addedCommentToShow)
          this.scrollDocumentToCard(this.addedCommentToShow, true);
      }
      this.addedCommentToShow = null;
      if (this.cardBesideRemoved && this.sectionProperties.commentList.indexOf(this.cardBesideRemoved.removed) === -1)
        this.cardBesideRemoved = null;
      this.endArrowAtSelectedComment();
      const noComments = this.commentsHiddenOrNotPresent();
      const columnWidth = noComments ? 0 : this.getColumnWidth();
      const extraWidth = !noComments && availableSpace < columnWidth && !this.isCollapsed ? columnWidth * app.pixelsToTwips : 0;
      const commentBottomY = noComments ? 0 : this.commentStackBottomViewTwips(lastY);
      app.activeDocument.activeLayout.ensureViewSizeCoversComments(extraWidth, commentBottomY);
      if (this.pendingSelectedCommentReveal) {
        if (this.sectionProperties.selectedComment && this.keepsSelectedCommentBesideThePage())
          this.pendingSelectedCommentReveal = !this.scrollSelectedCommentBesideThePage();
        else
          this.pendingSelectedCommentReveal = false;
      }
      for (const comment of this.sectionProperties.commentList)
        comment.revealSearchSelection();
      this.disableLayoutAnimation = false;
    }
    update(reLayout = true) {
      if (reLayout)
        this.sectionProperties.reLayout = true;
      this.updateDOM();
    }
    updateDOM() {
      if (!this.sectionProperties.firstImport)
        return;
      app.layoutingService.appendLayoutingTask(() => {
        const reLayout = this.sectionProperties.reLayout;
        this.sectionProperties.reLayout = false;
        this.layout(reLayout);
        if (reLayout && app.map._docLayer._docType === "text")
          this.updateThreadInfoIndicator();
      });
      app.sectionContainer.requestReDraw();
    }
    updateThreadInfoIndicator() {
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        var comment = this.sectionProperties.commentList[i];
        var replyCount = 0;
        var anyEdit = false;
        if (comment && comment.isRootComment()) {
          var lastIndex = this.getLastChildIndexOf(comment.sectionProperties.data.id);
          var j = i;
          while (this.sectionProperties.commentList[j] && j <= lastIndex) {
            anyEdit = this.sectionProperties.commentList[j].isEdit() || anyEdit;
            if (this.sectionProperties.commentList[j].sectionProperties.data.parent !== "0") {
              if ((this.sectionProperties.commentList[j].sectionProperties.data.layoutStatus !== cool2.CommentLayoutStatus.DELETED || this.map["stateChangeHandler"].getItemValue(".uno:ShowTrackedChanges") === "true") && this.sectionProperties.commentList[j].sectionProperties.data.resolved !== "true") {
                replyCount++;
              }
            }
            j++;
          }
        }
        if (anyEdit)
          comment.updateThreadInfoIndicator("!");
        else
          comment.updateThreadInfoIndicator(replyCount);
      }
    }
    updateChildLines() {
      for (let i = 0; i < this.sectionProperties.commentList.length; i++) {
        this.sectionProperties.commentList[i].updateChildLines();
      }
    }
    // Returns the root comment index of given id
    getRootIndexOf(id) {
      var index = this.getIndexOf(id);
      while (index >= 0) {
        if (this.sectionProperties.commentList[index].sectionProperties.data.parent !== "0")
          index--;
        else
          break;
      }
      return index;
    }
    setViewResolved(state) {
      this.sectionProperties.showResolved = state;
      const showResolvedComments = state && this.sectionProperties.show !== false;
      for (var idx = 0; idx < this.sectionProperties.commentList.length; idx++) {
        if (this.sectionProperties.commentList[idx].sectionProperties.data.resolved === "true") {
          if (!showResolvedComments) {
            if (this.sectionProperties.selectedComment == this.sectionProperties.commentList[idx]) {
              this.unselect();
            }
            this.sectionProperties.commentList[idx].hide();
          } else {
            this.sectionProperties.commentList[idx].show();
          }
        }
        this.sectionProperties.commentList[idx].update();
      }
      this.update();
    }
    /*
        also consider whether the comment to be shown is a resolved
        comment and if so then check if the `showResolved` toggle
        is on or off.
    */
    setView(state) {
      this.sectionProperties.show = state;
      const commentShouldCollapse = this.shouldCollapse();
      _CommentSection.showingEveryComment = true;
      for (var idx = 0; idx < this.sectionProperties.commentList.length; idx++) {
        if (state == false) {
          this.sectionProperties.commentList[idx].hide();
        } else if (this.sectionProperties.commentList[idx].sectionProperties.data.resolved != "true" || this.sectionProperties.showResolved == true) {
          this.sectionProperties.commentList[idx].show();
          if (commentShouldCollapse) {
            this.sectionProperties.commentList[idx].setCollapsed();
          }
        }
      }
      if (state && commentShouldCollapse && !this.isCollapsed)
        this.setCollapsed();
      _CommentSection.showingEveryComment = false;
      this.update();
    }
    orderCommentList() {
      this.sectionProperties.commentList.sort(function(a, b) {
        return Math.abs(a.sectionProperties.data.anchorPos[1]) - Math.abs(b.sectionProperties.data.anchorPos[1]) || Math.abs(a.sectionProperties.data.anchorPos[0]) - Math.abs(b.sectionProperties.data.anchorPos[0]);
      });
      if (app.map._docLayer._docType === "text")
        this.orderTextComments();
      this.updateIdIndexMap();
    }
    // How tall the text can be for the whole card to fit the view.
    // The rest of the card is measured from the page.
    maxContentHeightInView(comment) {
      const contentHeight = comment.sectionProperties.contentNode.getBoundingClientRect().height;
      const rest = comment.getCommentHeight(true) - contentHeight;
      return this.sectionProperties.canvasContainerBounds.height - rest - 2 * this.sectionProperties.marginY / app.dpiScale;
    }
    // Give each comment its default text height, capped to what fits in view.
    resetCommentsSize() {
      if (app.map._docLayer._docType === "text") {
        for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
          const comment = this.sectionProperties.commentList[i];
          if (comment.sectionProperties.contentNode.style.display !== "none") {
            const maxHeight = comment === this.sectionProperties.expandedComment ? this.annotationMaxSize : this.annotationMinSize;
            const fits = Math.max(this.maxContentHeightInView(comment), this.annotationMinSize);
            comment.sectionProperties.contentNode.style.maxHeight = Math.round(Math.min(maxHeight, fits)) + "px";
          }
        }
      }
    }
    // grow comments size if they have more text, and there is enough space between other comments
    resizeComments() {
      var growUp = false;
      if (app.map._docLayer._docType === "text") {
        const minMaxHeight = Number(getComputedStyle(document.documentElement).getPropertyValue("--annotation-min-size"));
        const maxMaxHeight = Number(getComputedStyle(document.documentElement).getPropertyValue("--annotation-max-size"));
        for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
          if (this.sectionProperties.commentList[i].sectionProperties.contentNode.style.display !== "none" && !this.sectionProperties.commentList[i].isEdit()) {
            var actHeight = this.sectionProperties.commentList[i].sectionProperties.contentText.getBoundingClientRect().height;
            if (actHeight > minMaxHeight) {
              if (actHeight > maxMaxHeight) {
                actHeight = maxMaxHeight;
              }
              var maxSize = maxMaxHeight;
              if (i + 1 < this.sectionProperties.commentList.length)
                maxSize = this.sectionProperties.commentList[i + 1].getContainerPosY() - this.sectionProperties.commentList[i].getContainerPosY() - this.sectionProperties.commentList[i].sectionProperties.author.getBoundingClientRect().height - 3 * this.sectionProperties.marginY / app.dpiScale - 2;
              if (maxSize > maxMaxHeight) {
                maxSize = maxMaxHeight;
              } else if (growUp && actHeight > maxSize) {
                var spaceBefore = this.sectionProperties.commentList[i].getContainerPosY();
                if (i > 0) {
                  spaceBefore -= this.sectionProperties.commentList[i - 1].getContainerPosY() + this.sectionProperties.commentList[i - 1].getCommentHeight() + this.sectionProperties.marginY;
                } else {
                  spaceBefore += app.activeDocument.activeLayout.viewedRectangle.pY1;
                }
                if (spaceBefore > 0) {
                  var moveUp = 0;
                  if (actHeight - maxSize < spaceBefore) {
                    moveUp = actHeight - maxSize;
                  } else {
                    moveUp = spaceBefore;
                  }
                  const posX = this.sectionProperties.commentList[i].getContainerPosX();
                  const posY = this.sectionProperties.commentList[i].getContainerPosY() - moveUp;
                  this.sectionProperties.commentList[i].setContainerPos(false, this.sectionProperties.canvasContainerBounds, posX, posY);
                  maxSize += moveUp;
                }
              }
              if (maxSize > minMaxHeight) {
                const comment = this.sectionProperties.commentList[i];
                const contentNode = comment.sectionProperties.contentNode;
                const oldMaxHeight = parseFloat(contentNode.style.maxHeight) || minMaxHeight;
                const oldContent = Math.min(actHeight, oldMaxHeight);
                maxSize = Math.min(maxSize, this.maxContentHeightInView(comment));
                contentNode.style.maxHeight = Math.round(maxSize) + "px";
                if (comment.cachedCommentHeight !== null) {
                  const newContent = Math.min(actHeight, maxSize);
                  comment.cachedCommentHeight += newContent - oldContent;
                }
              }
            }
          }
        }
        this.updateChildLines();
      }
    }
    resizeLastComment() {
      if (app.map._docLayer._docType === "text" && !this.commentsHiddenOrNotPresent()) {
        const minMaxHeight = Number(getComputedStyle(document.documentElement).getPropertyValue("--annotation-min-size"));
        const maxMaxHeight = Number(getComputedStyle(document.documentElement).getPropertyValue("--annotation-max-size"));
        var i = this.sectionProperties.commentList.length - 1;
        if (this.sectionProperties.commentList[i].sectionProperties.contentNode.style.display !== "none" && !this.sectionProperties.commentList[i].isEdit()) {
          var actHeight = this.sectionProperties.commentList[i].sectionProperties.contentText.getBoundingClientRect().height;
          if (actHeight > minMaxHeight) {
            if (actHeight > maxMaxHeight) {
              actHeight = maxMaxHeight;
            }
            this.sectionProperties.commentList[i].sectionProperties.contentNode.style.maxHeight = Math.round(actHeight) + "px";
          }
        }
      }
    }
    updateIdIndexMap() {
      this.idIndexMap.clear();
      const commentList = this.sectionProperties.commentList;
      for (var idx = 0; idx < commentList.length; idx++) {
        const comment = commentList[idx];
        console.assert(comment.sectionProperties && comment.sectionProperties.data, "no sectionProperties.data!");
        this.idIndexMap.set(comment.sectionProperties.data.id, idx);
      }
    }
    turnIntoAList(commentList) {
      var newArray;
      if (!Array.isArray(commentList)) {
        newArray = new Array(0);
        for (var prop in commentList) {
          if (Object.prototype.hasOwnProperty.call(commentList, prop)) {
            newArray.push(commentList[prop]);
          }
        }
      } else {
        newArray = commentList;
      }
      return newArray;
    }
    addUpdateChildGroups() {
      var parentCommentList = [];
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        var comment = this.sectionProperties.commentList[i];
        comment.sectionProperties.children = [];
        if (comment.sectionProperties.data.parent !== "0") {
          if (!parentCommentList.includes(comment.sectionProperties.data.parent))
            parentCommentList.push(comment.sectionProperties.data.parent);
        }
      }
      for (var i = 0; i < parentCommentList.length; i++) {
        var parentComment;
        for (var j = 0; j < this.sectionProperties.commentList.length; j++) {
          if (this.sectionProperties.commentList[j].sectionProperties.data.id === parentCommentList[i]) {
            parentComment = this.sectionProperties.commentList[j];
            break;
          }
        }
        if (parentComment) {
          for (var j = 0; j < this.sectionProperties.commentList.length; j++) {
            if (this.sectionProperties.commentList[j].sectionProperties.data.parent === parentCommentList[i])
              parentComment.sectionProperties.children.push(this.sectionProperties.commentList[j]);
          }
        } else
          console.warn("Couldn't find parent comment.");
      }
    }
    addChildrenCommentsToList(comment, newOrder) {
      comment.sectionProperties.children.forEach(function(element) {
        newOrder.push(element);
        if (element.sectionProperties.children.length > 0)
          this.addChildrenCommentsToList(element, newOrder);
      }.bind(this));
    }
    orderTextComments() {
      var newOrder = [];
      const ids = new Set(this.sectionProperties.commentList.map((comment2) => comment2.sectionProperties.data.id));
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        var comment = this.sectionProperties.commentList[i];
        if (!comment.isRootComment() && !ids.has(comment.sectionProperties.data.parent))
          comment.setAsRootComment();
        if (comment.isRootComment()) {
          newOrder.push(comment);
          if (comment.sectionProperties.children.length > 0)
            this.addChildrenCommentsToList(comment, newOrder);
        }
      }
      this.sectionProperties.commentList = newOrder;
    }
    // Needed in the case of a document with lots of comments(30K)
    // filters out comments that don't below to current tab.
    // Doing this at this outer level makes a big difference.
    spreadSheetFilteredComments(newCommentList) {
      const out = [];
      if (newCommentList) {
        this.sectionProperties.calcMasterList = newCommentList;
      }
      for (let i = 0; i < this.sectionProperties.calcMasterList.length; i++) {
        const comment = this.sectionProperties.calcMasterList[i];
        if (comment.tab == app.map._docLayer._selectedPart) {
          out.push(structuredClone(comment));
        }
      }
      this.sectionProperties.calcLastTab = app.map._docLayer._selectedPart;
      return out;
    }
    // Needed for calc because of spreadSheetFilteredComments().
    // Gets called every updateparts event.
    importPartSpecificComments() {
      if (app.map._docLayer._docType !== "spreadsheet") {
        return;
      }
      if (this.sectionProperties.calcLastTab == app.map._docLayer._selectedPart) {
        return;
      }
      this.sectionProperties.calcCommandStateChanged = false;
      this.importComments();
    }
    importComments(commentList) {
      this.disableLayoutAnimation = true;
      var comment;
      if (cool2.Comment.isAnyEdit()) {
        _CommentSection.pendingImport = true;
        return;
      }
      const preserveSelectedId = this.sectionProperties.doNotHideCommentTimer && this.sectionProperties.selectedComment ? this.sectionProperties.selectedComment.sectionProperties.data.id : null;
      _CommentSection.importingComments = true;
      let drawPaused = false;
      if (app.map._docLayer._docType === "spreadsheet") {
        if (!commentList) {
          this.containerObject.pauseDrawing();
          drawPaused = true;
          commentList = this.spreadSheetFilteredComments();
        } else {
          commentList = this.turnIntoAList(commentList);
          commentList = this.spreadSheetFilteredComments(commentList);
        }
      } else {
        console.assert(commentList);
        commentList = this.turnIntoAList(commentList);
      }
      this.clearList();
      if (commentList.length > 0) {
        for (var i = 0; i < commentList.length; i++) {
          comment = commentList[i];
          this.adjustComment(comment);
          if (comment.author in this.map._viewInfoByUserName) {
            comment.avatar = this.map._viewInfoByUserName[comment.author].userextrainfo.avatar;
          }
          const name = cool2.Comment.makeName(comment);
          var commentSection = new cool2.Comment(name, comment, {}, this);
          if (!this.containerObject.addSection(commentSection))
            continue;
          this.sectionProperties.commentList.push(commentSection);
          this.idIndexMap.set(commentSection.sectionProperties.data.id, i);
        }
        if (app.map._docLayer._docType === "text")
          this.addUpdateChildGroups();
        this.orderCommentList();
        this.checkSize();
        this.update();
      }
      const show = this.map.stateChangeHandler.getItemValue("showannotations");
      this.setView(show === true || show === "true");
      const showResolved = this.map.stateChangeHandler.getItemValue("ShowResolvedAnnotations");
      this.setViewResolved(showResolved === true || showResolved === "true");
      if (app.map._docLayer._docType === "spreadsheet")
        this.hideAllComments();
      if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing")
        this.showHideComments();
      this.sectionProperties.reLayout = true;
      this.sectionProperties.firstImport = true;
      this.updateDOM();
      _CommentSection.importingComments = false;
      if (drawPaused) {
        this.containerObject.resumeDrawing();
      }
      if (preserveSelectedId !== null)
        this.selectById(preserveSelectedId);
    }
    // Accepts redlines/changes comments.
    importChanges(changesList) {
      var changeComment;
      this.clearChanges();
      changesList = this.turnIntoAList(changesList);
      if (changesList.length > 0) {
        for (let i = 0; i < changesList.length; i++) {
          changeComment = changesList[i];
          if (!this.adjustRedLine(changeComment))
            continue;
          if (changeComment.author in this.map._viewInfoByUserName) {
            changeComment.avatar = this.map._viewInfoByUserName[changeComment.author].userextrainfo.avatar;
          }
          const name = cool2.Comment.makeName(changeComment);
          const commentSection = new cool2.Comment(name, changeComment, {}, this);
          if (!this.containerObject.addSection(commentSection))
            continue;
          this.sectionProperties.commentList.push(commentSection);
        }
        this.orderCommentList();
        this.checkSize();
        this.update();
      }
      if (app.map._docLayer._docType === "spreadsheet")
        this.hideAllComments();
    }
    // Remove redline comments.
    clearChanges() {
      this.containerObject.pauseDrawing();
      for (var i = this.sectionProperties.commentList.length - 1; i > -1; i--) {
        if (this.sectionProperties.commentList[i].sectionProperties.data.trackchange) {
          this.containerObject.removeSection(this.sectionProperties.commentList[i].name);
          this.sectionProperties.commentList.splice(i, 1);
        }
      }
      this.updateIdIndexMap();
      this.containerObject.resumeDrawing();
      this.sectionProperties.selectedComment = null;
      this.sectionProperties.expandedComment = null;
      this.checkSize();
    }
    clearAutoSaveStatus() {
      _CommentSection.autoSavedComment = null;
      _CommentSection.commentWasAutoAdded = false;
    }
    // Remove only text comments from the document (excluding change tracking comments)
    clearList() {
      this.containerObject.pauseDrawing();
      for (var i = this.sectionProperties.commentList.length - 1; i > -1; i--) {
        if (!this.sectionProperties.commentList[i].sectionProperties.data.trackchange) {
          this.containerObject.removeSection(this.sectionProperties.commentList[i].name);
          this.sectionProperties.commentList.splice(i, 1);
        }
      }
      this.updateIdIndexMap();
      this.containerObject.resumeDrawing();
      this.sectionProperties.selectedComment = null;
      this.sectionProperties.expandedComment = null;
      this.checkSize();
      this.clearAutoSaveStatus();
    }
    onCommentsDataUpdate() {
      for (var i = this.sectionProperties.commentList.length - 1; i > -1; i--) {
        const comment = this.sectionProperties.commentList[i];
        if (!comment.valid && comment.sectionProperties.data.id !== "new") {
          comment.sectionProperties.commentListSection.removeItem(comment.sectionProperties.data.id);
        }
        comment.onCommentDataUpdate();
      }
    }
    rejectAllTrackedCommentChanges() {
      for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
        const comment = this.sectionProperties.commentList[i];
        if (comment.sectionProperties.data.layoutStatus === cool2.CommentLayoutStatus.DELETED) {
          comment.sectionProperties.data.layoutStatus = cool2.CommentLayoutStatus.VISIBLE;
          comment.sectionProperties.container.classList.remove("tracked-deleted-comment-show");
          comment.updateRemovedField();
        }
      }
    }
    hasAnyComments() {
      return this.sectionProperties.commentList.length > 0;
    }
  };
  _CommentSection.commentWasAutoAdded = false;
  _CommentSection.pendingImport = false;
  _CommentSection.importingComments = false;
  _CommentSection.showingEveryComment = false;
  _CommentSection.DRAG_THRESHOLD_PX = 5;
  let CommentSection = _CommentSection;
  cool2.CommentSection = CommentSection;
})(cool || (cool = {}));
app.definitions.CommentSection = cool.CommentSection;
