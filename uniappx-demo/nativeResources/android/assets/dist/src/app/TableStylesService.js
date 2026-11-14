function getElementColor(style, type) {
  const el = style.Elements.find((e) => e.Type === type);
  return el ? el.FillColor : void 0;
}
function toHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + clamp(r).toString(16).padStart(2, "0") + clamp(g).toString(16).padStart(2, "0") + clamp(b).toString(16).padStart(2, "0");
}
function darkenColor(hex, factor) {
  const [r, g, b] = parseHexToRgb(hex);
  return toHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}
const _TableStylesService = class _TableStylesService {
  static getGroup(name) {
    const lower = name.toLowerCase();
    if (lower.includes("light"))
      return "light";
    if (lower.includes("medium"))
      return "medium";
    if (lower.includes("dark"))
      return "dark";
    return "other";
  }
  static getGroupLabel(group) {
    switch (group) {
      case "light":
        return _("Light");
      case "medium":
        return _("Medium");
      case "dark":
        return _("Dark");
      default:
        return _("Custom");
    }
  }
  get() {
    return this.styles;
  }
  constructor() {
    this.styles = new Array();
    this.enabled = true;
    this.menuAnchor = null;
    app.map.on("commandstatechanged", this.onCommandState.bind(this));
  }
  /** Build the .uno:DatabaseSettings args from a TableStyleInfo, translating
   * state-side property names to the PoolItem MID names declared in
   * scslots.sdi (HeaderRow, FirstCol, ...) that the SDI parameter list
   * expects. Total Row lives on its own slot (.uno:TableTotalRow). */
  buildArgs(state) {
    return {
      "DatabaseSettings.HeaderRow": {
        type: "boolean",
        value: state.ContainsHeader
      },
      "DatabaseSettings.FirstCol": {
        type: "boolean",
        value: state.UseFirstColumnFormatting
      },
      "DatabaseSettings.LastCol": {
        type: "boolean",
        value: state.UseLastColumnFormatting
      },
      "DatabaseSettings.StripedRows": {
        type: "boolean",
        value: state.UseRowStripes
      },
      "DatabaseSettings.StripedCols": {
        type: "boolean",
        value: state.UseColStripes
      },
      "DatabaseSettings.ShowFilters": {
        type: "boolean",
        value: state.AutoFilter
      },
      "DatabaseSettings.StyleID": {
        type: "string",
        value: state.TableStyleName || ""
      }
    };
  }
  onCommandState(e) {
    if (e.commandName === ".uno:TableStyles") {
      if (e.state === "")
        return;
      try {
        this.styles = JSON.parse(e.state).TableStyles;
        this.styles.sort((a, b) => {
          const tableGroupA = _TableStylesService.groupOrder[_TableStylesService.getGroup(a.Name)] ?? 4;
          const tableGroupB = _TableStylesService.groupOrder[_TableStylesService.getGroup(b.Name)] ?? 4;
          if (tableGroupA !== tableGroupB)
            return tableGroupA - tableGroupB;
          return a.Name.localeCompare(b.Name, void 0, {
            numeric: true,
            sensitivity: "base"
          });
        });
      } catch (e2) {
        app.console.error("Failed to parse TableStyles: " + e2);
      }
      app.map.fire("jsdialogupdate", {
        data: {
          id: WindowId.Notebookbar + "",
          type: "",
          jsontype: "notebookbar",
          action: "update",
          control: this.generateTableStylesJSON()
        }
      });
    } else if (e.commandName === ".uno:DatabaseSettings") {
      const enabled = e.enabled !== false;
      if (enabled !== this.enabled) {
        this.enabled = enabled;
        app.map.fire("jsdialogupdate", {
          data: {
            id: WindowId.Notebookbar + "",
            type: "",
            jsontype: "notebookbar",
            action: "update",
            control: this.generateTableStylesJSON()
          }
        });
      }
      const currentStyle = e.state;
      let position = -1;
      if (currentStyle) {
        const layout = this.getEntriesLayout();
        const targetName = currentStyle.TableStyleName || "None";
        position = layout.findIndex((item) => {
          var _a;
          return !item.isSeparator && ((_a = item.style) == null ? void 0 : _a.Name) === targetName;
        });
        if (position === -1) {
          position = layout.findIndex((item) => !item.isSeparator);
          if (position === -1)
            position = 0;
        }
      }
      app.map.fire("jsdialogaction", {
        data: {
          id: WindowId.Notebookbar + "",
          type: "",
          jsontype: "notebookbar",
          action: "action",
          data: {
            control_id: "tablestyles_design",
            action_type: "select",
            position,
            data: {
              position
            }
          }
        }
      });
    }
  }
  generateTableStylesJSON() {
    return {
      id: "Tablestyles_design--group",
      type: "overflowgroup",
      name: _("Table Styles"),
      icon: "lc_tablestyle.svg",
      children: [
        {
          id: "tablestyles_design-iconview-list",
          type: "iconviewlist",
          accessibility: { focusBack: false, combination: "TL", de: null },
          children: [
            {
              id: "tablestyles_design",
              type: "iconview",
              text: _("Table Styles"),
              command: ".uno:DatabaseSettings",
              enabled: this.enabled,
              aria: { label: _("Table Styles") },
              accessibility: {
                focusBack: true,
                combination: "TS"
              },
              entries: this.generateJSON(),
              singleclickactivate: true,
              textWithIconEnabled: false,
              selectionmode: "single"
            }
          ]
        }
      ]
    };
  }
  getNoneStyle() {
    return {
      Name: "None",
      UIName: _("None"),
      Elements: []
    };
  }
  styleHasElement(style, elementType) {
    for (const element of style.Elements)
      if (element.Type === elementType)
        return true;
    return false;
  }
  applyStyle(newStyleNumber) {
    const tableStyleEntry = newStyleNumber === -1 ? this.getNoneStyle() : this.styles[newStyleNumber];
    if (!tableStyleEntry) {
      app.console.error("TableStylesService: not found style with id: " + newStyleNumber);
      return;
    }
    let tableStyle = app.map["stateChangeHandler"].getItemValue(".uno:DatabaseSettings");
    if (!tableStyle) {
      tableStyle = {
        ContainsHeader: this.styleHasElement(tableStyleEntry, "HeaderRow"),
        UseFirstColumnFormatting: this.styleHasElement(tableStyleEntry, "FirstColumn"),
        UseLastColumnFormatting: this.styleHasElement(tableStyleEntry, "LastColumn"),
        UseRowStripes: this.styleHasElement(tableStyleEntry, "FirstRowStripe"),
        UseColStripes: this.styleHasElement(tableStyleEntry, "FirstColumnStripe"),
        AutoFilter: true
      };
    }
    const updated = { ...tableStyle, TableStyleName: tableStyleEntry.Name };
    app.map.sendUnoCommand(".uno:DatabaseSettings", this.buildArgs(updated));
  }
  // Show a right-click menu on a gallery entry offering to make that style the
  // document's default for newly inserted tables. The menu opens at the
  // pointer: the same gallery entry can be rendered twice (in the notebookbar
  // strip and in its expanded dropdown), so the pointer position is the one
  // anchor that always matches the copy the user clicked.
  showSetDefaultMenu(data) {
    if (typeof data.row !== "number" || data.row < 0)
      return;
    const style = this.styles[data.row];
    if (!style)
      return;
    const styleName = style.Name;
    const entries = [
      {
        id: "set-default-table-style",
        type: "comboboxentry",
        text: _("Set as Default"),
        pos: 0
      },
      {
        id: "duplicate-table-style",
        type: "comboboxentry",
        text: _("Duplicate Style"),
        pos: 1
      }
    ];
    const anchor = this.getMenuAnchor();
    anchor.style.left = data.clientX + "px";
    anchor.style.top = data.clientY + "px";
    const callback = (_objectType, eventType, _object, _entryData, entry) => {
      if (eventType !== "selected")
        return false;
      const id = entry.id;
      if (id === "set-default-table-style") {
        app.map.sendUnoCommand(".uno:SetDefaultTableStyle", {
          StyleName: { type: "string", value: styleName }
        });
      } else if (id === "duplicate-table-style") {
        app.map.sendUnoCommand(".uno:DuplicateTableStyle", {
          StyleName: { type: "string", value: styleName }
        });
      }
      JSDialog.CloseAllDropdowns();
      return true;
    };
    JSDialog.OpenDropdown("table-style-context-menu", anchor, entries, callback, "", false, false, true);
  }
  // A zero-size element pinned at the pointer position; the context menu is
  // anchored to it so the popup opens where the user clicked.
  getMenuAnchor() {
    if (!this.menuAnchor) {
      this.menuAnchor = document.createElement("div");
      this.menuAnchor.id = "table-style-context-menu-anchor";
      this.menuAnchor.style.position = "fixed";
      document.body.appendChild(this.menuAnchor);
    }
    return this.menuAnchor;
  }
  generateIcon(style) {
    const wholeTable = getElementColor(style, "WholeTable") || "FFFF";
    const headerRow = getElementColor(style, "HeaderRow") || wholeTable;
    const firstRowStripe = getElementColor(style, "FirstRowStripe") || wholeTable;
    const secondRowStripe = getElementColor(style, "SecondRowStripe") || wholeTable;
    const wt = "#" + wholeTable;
    const hr = "#" + headerRow;
    const frs = "#" + firstRowStripe;
    const srs = "#" + secondRowStripe;
    const getStyleIndex = (variant) => {
      const match = style.Name.match(new RegExp(`${variant}(\\d+)$`));
      return match ? parseInt(match[1], 10) : 1;
    };
    let svg;
    if (style.Name.indexOf("Light") >= 0) {
      svg = lightTableStyleSvg(hr, wt, frs, getStyleIndex("Light"));
    } else if (style.Name.indexOf("Medium") >= 0) {
      svg = mediumTableStyleSvg(hr, wt, frs, getStyleIndex("Medium"));
    } else if (style.Name.indexOf("Dark") >= 0) {
      svg = darkTableStyleSvg(hr, wt, frs, getStyleIndex("Dark"));
    } else {
      svg = customTableStyleSvg(hr, frs, srs);
    }
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }
  getEntriesLayout() {
    const layout = [];
    layout.push({
      isSeparator: true,
      text: _TableStylesService.getGroupLabel("light")
    });
    layout.push({ isSeparator: false, style: this.getNoneStyle() });
    let previousGroup = "light";
    this.styles.forEach((element) => {
      const currentGroup = _TableStylesService.getGroup(element.Name);
      if (currentGroup === "other")
        return;
      if (currentGroup !== previousGroup) {
        layout.push({
          isSeparator: true,
          text: _TableStylesService.getGroupLabel(currentGroup)
        });
      }
      previousGroup = currentGroup;
      layout.push({ isSeparator: false, style: element });
    });
    const customStyles = this.styles.filter((style) => _TableStylesService.getGroup(style.Name) === "other");
    if (customStyles.length > 0) {
      layout.push({
        isSeparator: true,
        text: _TableStylesService.getGroupLabel("other")
      });
      customStyles.forEach((style) => {
        layout.push({ isSeparator: false, style });
      });
    }
    return layout;
  }
  generateJSON() {
    if (!this.styles)
      return [];
    const currentStyle = app.map["stateChangeHandler"].getItemValue(".uno:DatabaseSettings");
    const iconViewEntries = new Array();
    let i = 0;
    const layout = this.getEntriesLayout();
    layout.forEach((item) => {
      if (item.isSeparator) {
        iconViewEntries.push({
          row: "sep-" + i,
          separator: true,
          text: item.text || "",
          image: ""
        });
      } else {
        if (!item.style)
          return;
        const element = item.style;
        const isNone = element.Name === "None";
        const selected = isNone ? !currentStyle || currentStyle.TableStyleName === "" || currentStyle.TableStyleName === "None" : currentStyle && element.Name === currentStyle.TableStyleName;
        const formattedText = isNone ? _("None") : element.UIName;
        iconViewEntries.push({
          row: isNone ? -1 : i++,
          text: formattedText,
          image: isNone ? "images/lc_table_none.svg" : this.generateIcon(element),
          width: 50,
          height: 50,
          selected
        });
      }
    });
    return iconViewEntries;
  }
};
_TableStylesService.groupOrder = {
  light: 1,
  medium: 2,
  dark: 3,
  other: 4
};
let TableStylesService = _TableStylesService;
