const _JSDialogMessageRouter = class _JSDialogMessageRouter {
  constructor() {
    this.pendingByJsontype = /* @__PURE__ */ new Map();
  }
  // show labels instead of editable fields in message boxes
  _preProcessMessageDialog(msgData) {
    if (!msgData.children)
      return;
    let hasMessage = false;
    for (var i in msgData.children) {
      var child = msgData.children[i];
      if (child.type === "multilineedit") {
        child.type = "fixedtext";
        hasMessage = true;
      } else if (child.type === "image") {
        const asset = window.mode.isSmallScreenDevice() ? void 0 : _JSDialogMessageRouter.messageImages[child.id];
        if (asset)
          child.image = app.LOUtil.getImageURL(asset);
        else
          child.id = "";
      } else if (child.children)
        this._preProcessMessageDialog(child);
    }
    if (hasMessage)
      msgData.spacing = _JSDialogMessageRouter.messageSpacing;
  }
  isReady(jsontype) {
    if (jsontype === "notebookbar")
      return !!(app.socket._map.uiManager && app.socket._map.uiManager.notebookbar);
    if (jsontype === "addressinputfield")
      return !!app.socket._map.addressInputField;
    if (jsontype === "formulabar")
      return !!app.socket._map.formulabar;
    if (jsontype === "notespanel")
      return !!app.socket._map.notesPanel;
    return true;
  }
  flushPending(jsontype) {
    const queue = this.pendingByJsontype.get(jsontype);
    if (!queue)
      return;
    this.pendingByJsontype.delete(jsontype);
    for (const fire of queue)
      fire();
  }
  processMessage(msgData, callbackFn) {
    if (msgData.action) {
      var fireJSDialogEvent = function() {
        switch (msgData.action) {
          case "update":
            app.socket._map.fire("jsdialogupdate", { data: msgData });
            return true;
          case "action":
            app.socket._map.fire("jsdialogaction", { data: msgData });
            return true;
        }
        return false;
      };
      const jsontype = msgData.jsontype;
      const queue = this.pendingByJsontype.get(jsontype);
      if (queue || !this.isReady(jsontype)) {
        const q = queue || [];
        q.push(fireJSDialogEvent);
        if (!queue)
          this.pendingByJsontype.set(jsontype, q);
        return;
      } else if (fireJSDialogEvent() === true) {
        return;
      }
    }
    if (msgData.type === "messagebox")
      this._preProcessMessageDialog(msgData);
    if (msgData.jsontype === "popup")
      return;
    if (window.mode.isSmallScreenDevice()) {
      if (msgData.type === "dropdown" || msgData.type === "snackbar" || msgData.type === "modalpopup" && msgData.id === JSDialog.generateModalId(app.idleHandlerId)) {
        app.socket._map.fire("jsdialog", {
          data: msgData,
          callback: callbackFn
        });
        return;
      }
      if (msgData.type == "borderwindow")
        return;
      if (msgData.jsontype === "formulabar") {
        app.socket._map.fire("formulabar", { data: msgData });
        return;
      }
      if (msgData.enabled || msgData.jsontype === "dialog" || msgData.type === "modalpopup") {
        app.socket._map.fire("mobilewizard", {
          data: msgData,
          callback: callbackFn
        });
      } else {
        console.warn('jsdialog: unhandled jsdialog mobile message: {jsontype: "' + msgData.jsontype + '", type: "' + msgData.type + '" ... }');
      }
    } else if (msgData.jsontype === "dialog") {
      app.socket._map.fire("jsdialog", { data: msgData, callback: callbackFn });
    } else if (msgData.jsontype === "sidebar") {
      app.socket._map.fire("sidebar", { data: msgData });
    } else if (msgData.jsontype === "navigator") {
      app.socket._map.fire("navigator", { data: msgData });
    } else if (msgData.jsontype === "formulabar") {
      app.socket._map.fire("formulabar", { data: msgData });
    } else if (msgData.jsontype === "notebookbar") {
      if (msgData.children) {
        for (var i = 0; i < msgData.children.length; i++) {
          if (msgData.children[i].type === "control") {
            msgData.children[i].id = msgData.id;
            app.socket._map.fire("notebookbar", msgData.children[i]);
            return;
          }
        }
      }
    } else if (msgData.jsontype === "quickfind") {
      app.socket._map.fire("quickfind", { data: msgData });
    } else if (msgData.jsontype === "notespanel") {
      app.socket._map.fire("notespanel", { data: msgData });
    } else {
      console.warn('Unhandled jsdialog message: {jsontype: "' + msgData.jsontype + '", type: "' + msgData.type + '" ... }');
    }
  }
};
_JSDialogMessageRouter.messageSpacing = 4;
_JSDialogMessageRouter.messageImages = {
  warningbox: "warningbox.svg"
};
let JSDialogMessageRouter = _JSDialogMessageRouter;
JSDialog.MessageRouter = new JSDialogMessageRouter();
