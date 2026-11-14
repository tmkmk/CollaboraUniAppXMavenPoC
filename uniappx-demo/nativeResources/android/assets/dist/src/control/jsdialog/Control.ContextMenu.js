const _ContextMenuControl = class _ContextMenuControl extends JSControl {
  constructor(options) {
    super(options);
    this._prevMousePos = null;
    this._currMousePos = null;
    this._menuID = _ContextMenuControl.menuID;
    this._menuPosID = "canvas-context-menupos";
    this._menuPosEl = null;
    this._autoFillContextMenu = false;
    this._spellingContextMenu = false;
    this._editEngine = null;
    this.hasContextMenu = false;
    this.options.allowlist = JSDialog.MenuCommands.allowlist;
    this.options.mobileDenylist = JSDialog.MenuCommands.mobileDenylist;
  }
  onAdd(map) {
    this._prevMousePos = null;
    this._autoFillContextMenu = false;
    map._contextMenu = this;
    map.on("locontextmenu", this._onContextMenu, this);
    map.on("mousedown", this._onMouseDown, this);
    map.on("mouseup", this._onMouseUp, this);
    map.on("keydown", this._onKeyDown, this);
    map.on("closepopups", this._onClosePopup, this);
    return null;
  }
  _onClosePopup() {
    if (!this.hasContextMenu) {
      return;
    }
    if (this._autoFillContextMenu) {
      this._autoFillContextMenu = false;
      app.map._docLayer._resetReferencesMarks();
    }
    this.hasContextMenu = false;
    if (!JSDialog.IsDropdownOpen(this._menuID))
      return;
    JSDialog.CloseDropdown(this._menuID);
    app.map.focus();
  }
  _onMouseDown() {
    if (app.activeDocument && app.activeDocument.mouseControl)
      this._prevMousePos = app.activeDocument.mouseControl.getMousePagePosition();
    this._onClosePopup();
  }
  _onMouseUp() {
    if (app.activeDocument && app.activeDocument.mouseControl)
      this._currMousePos = app.activeDocument.mouseControl.getMousePagePosition();
  }
  _onKeyDown(e) {
    if (e.originalEvent.keyCode === 27) {
      this._onClosePopup();
    }
  }
  _onContextMenu(obj) {
    Util.ensureValue(this._map);
    const map = this._map;
    const keyboardInvoked = obj.mouse === "false";
    const active = document.activeElement;
    this._editEngine = active ? active.closest(".ui-editengine") : null;
    if (!map.isEditMode()) {
      return;
    }
    this._amendContextMenuData(obj);
    this._appendContributedContextMenuItems(obj.menu);
    const contextMenu = this._createContextMenuStructure(obj);
    if (Object.keys(contextMenu).length == 0) {
      return;
    }
    this._spellingContextMenu = false;
    this._autoFillContextMenu = false;
    for (const menuItem in contextMenu) {
      if (menuItem.indexOf(".uno:SpellCheckIgnore") !== -1) {
        this._spellingContextMenu = true;
        break;
      } else if (menuItem.indexOf(".uno:AutoFill") !== -1) {
        map.fire("closeautofillpreviewpopup");
        this._autoFillContextMenu = true;
        break;
      }
    }
    if (window.mode.isSmallScreenDevice()) {
      window.contextMenuWizard = true;
      const insertCommentEntry = contextMenu[".uno:InsertAnnotation"];
      if (insertCommentEntry && typeof insertCommentEntry !== "string")
        insertCommentEntry.callback = () => app.map.insertComment();
      const menuData = window.L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(contextMenu, true, "");
      map.fire("mobilewizard", { data: menuData });
    } else {
      this._addMenu(contextMenu, keyboardInvoked);
      $("#" + this._menuPosID).focus();
      this.hasContextMenu = true;
    }
  }
  _addMenu(contextMenu, keyboardInvoked) {
    var _a;
    Util.ensureValue(this._map);
    const map = this._map;
    Util.ensureValue(app.activeDocument);
    Util.ensureValue(app.activeDocument.mouseControl);
    const container = document.getElementById("canvas-container");
    Util.ensureValue(container);
    const position = this._editEngine && this._getEditEngineMenuPosition(container) || keyboardInvoked && app.activeDocument.mouseControl.getCursorCanvasPosition() || app.activeDocument.mouseControl.getMouseCanvasPosition();
    Util.ensureValue(position);
    if (!this._menuPosEl) {
      this._menuPosEl = document.createElement("div");
      this._menuPosEl.id = this._menuPosID;
      container.append(this._menuPosEl);
    }
    const menuPosEl = this._menuPosEl;
    menuPosEl.style.position = "absolute";
    menuPosEl.style.zIndex = "1500";
    menuPosEl.style.left = position.x + "px";
    menuPosEl.style.top = position.y + "px";
    const onEditEngineMenu = (_a = this._editEngine) == null ? void 0 : _a.onEditEngineMenu;
    menuPosEl._onDropDown = onEditEngineMenu || null;
    const entries = this._getMenuEntries(contextMenu);
    const callback = (objectType, eventType, object, data, entry) => {
      var _a2, _b, _c;
      const key = entry.id;
      if (key === ".uno:InsertAnnotation") {
        app.map.insertComment();
        return false;
      }
      if (key === "saveimagetowopi") {
        const ext = GraphicSelection.graphicExtension() ?? "png";
        map._saveImageToWopi = true;
        map.openSaveAs(ext);
        return false;
      }
      if (key.startsWith("ext:")) {
        app.dispatcher.dispatch(key);
        (_a2 = this._map) == null ? void 0 : _a2.focus();
        return false;
      }
      if (key === "fitslidetoview") {
        app.dispatcher.dispatch("fitslidetoview", {
          part: app.impress.selectedPreviewPart
        });
        (_b = this._map) == null ? void 0 : _b.focus();
        return false;
      }
      if (this._editEngine)
        this._editEngine.focus();
      const unoentry = entry;
      Util.ensureValue(unoentry.uno);
      const uno = unoentry.uno.indexOf(".uno:") === 0 ? unoentry.uno : ".uno:" + unoentry.uno;
      if (app.map._clip === void 0 || !app.map._clip.filterExecCopyPaste(uno)) {
        app.map.sendUnoCommand(uno);
        if (this._spellingContextMenu)
          app.map._docLayer._clearSelections();
      }
      if (!this._editEngine)
        (_c = this._map) == null ? void 0 : _c.focus();
      return false;
    };
    JSDialog.OpenDropdown(
      this._menuID,
      menuPosEl,
      entries,
      callback,
      "",
      false,
      true,
      // When opened from the keyboard, select and focus the first entry
      // so the arrow keys work at once. A right-click opens with no entry
      // preselected.
      !keyboardInvoked
      /* noDefaultSelection? */
    );
  }
  // The point of the last mouse press in the editengine widget, or the bottom left of its caret
  // when a key was pressed after it, relative to the container.
  _getEditEngineMenuPosition(container) {
    var _a;
    const origin = container.getBoundingClientRect();
    const mouse = (_a = this._editEngine) == null ? void 0 : _a.editEngineMousePoint;
    if (mouse)
      return { x: mouse.x - origin.left, y: mouse.y - origin.top };
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0)
      return null;
    const range = selection.getRangeAt(0);
    let caret = range.getBoundingClientRect();
    if (!caret.height) {
      const node = range.startContainer;
      const line = node instanceof Element ? node : node.parentElement;
      if (line)
        caret = line.getBoundingClientRect();
    }
    return { x: caret.left - origin.left, y: caret.bottom - origin.top };
  }
  _getMenuEntries(contextMenu) {
    const entries = [];
    for (const [command, value] of Object.entries(contextMenu)) {
      if (typeof value === "string") {
        entries.push({
          id: command,
          type: "separator"
        });
        continue;
      }
      if (!value.items) {
        entries.push({
          id: command,
          uno: command,
          type: "comboboxentry",
          text: value.name,
          img: value.icon || command,
          class: this._commandClass(command) + (value.checked ? " context-menu-checked" : ""),
          shortcut: JSDialog.ShortcutsUtil.getShortcutText(command)
        });
        continue;
      }
      const items = this._getMenuEntries(value.items);
      entries.push({
        id: command,
        uno: command,
        type: "comboboxentry",
        text: value.name,
        items,
        img: command,
        class: this._commandClass(value.command || command)
      });
    }
    return entries;
  }
  _commandClass(command) {
    return command.replace(/[^a-zA-Z0-9]/g, "");
  }
  _amendContextMenuData(obj) {
    if (this._editEngine) {
      const excluded = [".uno:PasteSpecialMenu", ".uno:InsertAnnotation"];
      obj.menu = obj.menu.filter((item) => excluded.indexOf(item.command) === -1);
    }
    if (GraphicSelection.hasActiveSelection()) {
      const menu = obj.menu;
      let insertIndex = -1;
      menu.forEach(function(item, index) {
        if (item.command === ".uno:Paste") {
          insertIndex = index + 1;
        }
      });
      if (insertIndex != -1) {
        menu.splice(insertIndex, 0, {
          text: _("Delete"),
          type: "command",
          command: ".uno:Delete",
          enabled: "true"
        });
      }
      Util.ensureValue(this._map);
      if (!this._map["wopi"].UserCanNotWriteRelative) {
        let saveGraphicIndex = -1;
        menu.forEach((item, index) => {
          if (item.command === ".uno:SaveGraphic") {
            saveGraphicIndex = index + 1;
          }
        });
        if (saveGraphicIndex != -1) {
          menu.splice(saveGraphicIndex, 0, {
            text: _("Save Image to Server"),
            type: "command",
            command: "saveimagetowopi",
            enabled: "true"
          });
        }
      }
    }
    if (app.map._docLayer._docType === "presentation" && app.impress.hasOverviewPage && app.map._docLayer._selectedPart === 0 && !app.impress.previewEditMode.active && app.impress.selectedPreviewPart >= 1) {
      obj.menu.splice(0, 0, {
        text: _("Fit slide to view"),
        type: "command",
        command: "fitslidetoview",
        enabled: "true"
      });
    }
  }
  // Appends each loaded extension's contributes.contextMenu entries to the raw menu
  // array sent by core, before it is turned into the render structure. Every
  // extension that contributes at least one matching entry gets its own trailing
  // group, separated from what came before by one separator - an extension never
  // gets to place an entry among the document's own items. A leading separator
  // with nothing before it (the first extension's own separator, when core sent no
  // items at all) is dropped by _createContextMenuStructure's own separator
  // handling, so this never has to special-case an empty starting menu.
  _appendContributedContextMenuItems(menu) {
    if (!window.enableExperimentalFeatures)
      return;
    const hasTextSelection = !!(app.activeDocument && app.activeDocument.activeView.hasTextSelection);
    const hasImageSelection = GraphicSelection.hasActiveSelection();
    const matchesContext = (contexts) => {
      if (!contexts || contexts.length === 0)
        return true;
      return contexts.some((context) => {
        if (context === "text-selection")
          return hasTextSelection;
        if (context === "image")
          return hasImageSelection;
        return false;
      });
    };
    const exts = app.map._extensions || {};
    Object.keys(exts).sort().forEach((extId) => {
      const manifest = exts[extId].options.manifest;
      const contributed = manifest.contributes && manifest.contributes.contextMenu;
      if (!contributed || !contributed.length)
        return;
      const commands = manifest.contributes.commands || [];
      const baseUrl = exts[extId].options.baseUrl;
      let addedSeparator = false;
      contributed.forEach((contextMenuEntry) => {
        if (!matchesContext(contextMenuEntry.contexts))
          return;
        const command = commands.filter((c) => c.id === contextMenuEntry.command)[0];
        if (!command) {
          console.warn("extension " + extId + ': context menu references unknown command "' + contextMenuEntry.command + '"');
          return;
        }
        if (!addedSeparator) {
          menu.push({ type: "separator", command: "", enabled: "true" });
          addedSeparator = true;
        }
        menu.push({
          text: command.title,
          type: "command",
          command: "ext:" + extId + ":" + contextMenuEntry.command,
          enabled: "true",
          icon: command.icon ? baseUrl + command.icon : void 0
        });
      });
    });
  }
  _createContextMenuStructure(obj) {
    Util.ensureValue(this._map);
    const docType = this._map.getDocType();
    const contextMenu = {};
    let sepIdx = 1;
    let itemName;
    let subMenuIdx = 1;
    let isLastItemText = false;
    const menu = obj.menu;
    for (const idx in menu) {
      const item = menu[idx];
      if (item.enabled === "false") {
        continue;
      }
      if (this._map.uiManager.hiddenCommands[item.command]) {
        continue;
      }
      if (item.type === "menu" && item.text && item.text.replace("~", "") === "Paste Special" && item.menu && item.menu.length) {
        item.text = _("Paste Special");
        item.command = ".uno:PasteSpecial";
        item.type = item.menu[0].type;
        item.menu = void 0;
      }
      if (item.type === "command" && item.text && item.text.replace("~", "") === "Copy Cells") {
        item.text = _("Copy Cells");
        item.command = ".uno:AutoFill?Copy:bool=true";
      }
      if (item.type === "command" && item.text && item.text.replace("~", "") === "Fill Series") {
        item.text = _("Fill Series");
        item.command = ".uno:AutoFill?Copy:bool=false";
      }
      if (item.type === "separator") {
        if (isLastItemText) {
          contextMenu["sep" + sepIdx++] = "";
        }
        isLastItemText = false;
      } else if (item.type === "command") {
        if (item.command && !item.command.startsWith(".uno:")) {
          Util.ensureValue(item.text);
          itemName = item.text;
          contextMenu[item.command] = {
            name: _(itemName),
            isHtmlName: false
          };
          if (item.icon)
            contextMenu[item.command].icon = item.icon;
          isLastItemText = true;
          continue;
        }
        let commandName = item.command.substring(5);
        let hasParam = false;
        if (commandName.indexOf("?") !== -1) {
          commandName = commandName.substring(0, commandName.indexOf("?"));
          hasParam = true;
        }
        if (commandName === "FontDialog" && !hasParam)
          continue;
        Util.ensureValue(this.options.allowlist);
        Util.ensureValue(this.options.mobileDenylist);
        if (commandName !== "None" && this.options.allowlist.general.indexOf(commandName) === -1 && (this._map["wopi"].HideChangeTrackingControls || this.options.allowlist.tracking.indexOf(commandName) === -1) && !(docType === "text" && this.options.allowlist.text.indexOf(commandName) !== -1) && !(docType === "spreadsheet" && this.options.allowlist.spreadsheet.indexOf(commandName) !== -1) && !(docType === "presentation" && this.options.allowlist.presentation.indexOf(commandName) !== -1) && !(docType === "drawing" && this.options.allowlist.drawing.indexOf(commandName) !== -1)) {
          continue;
        }
        if (window.mode.isSmallScreenDevice() && this.options.mobileDenylist.indexOf(commandName) !== -1)
          continue;
        if (commandName == "None" && !item.text)
          continue;
        if (hasParam || commandName === "None" || commandName === "FontDialogForParagraph" || commandName === "Delete" || commandName == "PasteSpecial" || commandName === "UpdateCurIndex" || commandName === "RemoveTableOf" || commandName === "EditCurIndex") {
          Util.ensureValue(item.text);
          itemName = window.removeAccessKey(item.text);
          itemName = itemName.replace(" ", "\xA0");
        } else {
          itemName = _UNO(item.command, docType, true);
        }
        contextMenu[item.command] = {
          name: _(itemName),
          isHtmlName: true
        };
        if (item.icon)
          contextMenu[item.command].icon = item.icon;
        if ((item.checktype === "checkmark" || item.checktype === "radio") && item.checked === "true")
          contextMenu[item.command].checked = true;
        isLastItemText = true;
      } else if (item.type === "menu") {
        Util.ensureValue(item.text);
        itemName = item.text;
        const submenu = this._createContextMenuStructure(item);
        if (Object.keys(submenu).length === 0) {
          continue;
        }
        contextMenu["submenu" + subMenuIdx++] = {
          name: _(itemName).replace(/\(~[A-Za-z]\)/, "").replace("~", ""),
          command: item.command,
          items: submenu
        };
        isLastItemText = true;
      }
    }
    const lastItem = Object.keys(contextMenu)[Object.keys(contextMenu).length - 1];
    if (lastItem !== void 0 && lastItem.startsWith("sep")) {
      delete contextMenu[lastItem];
    }
    return contextMenu;
  }
};
_ContextMenuControl.menuID = "jsd-context-menu";
let ContextMenuControl = _ContextMenuControl;
