const _FormulaErrorHelpSection = class _FormulaErrorHelpSection extends HTMLObjectSection {
  constructor(documentPosition, errorInfo) {
    super(app.CSections.FormulaErrorHelpButton.name, null, null, documentPosition, "formula-error-help-btn", true);
    this.menuDiv = null;
    this.zIndex = app.CSections.FormulaErrorHelpButton.zIndex;
    this.errorInfo = errorInfo;
    const objectDiv = this.getHTMLObject();
    objectDiv.style.pointerEvents = "";
    const icon = document.createElement("div");
    icon.className = "formula-error-icon";
    icon.textContent = "!";
    objectDiv.appendChild(icon);
    objectDiv.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.menuDiv) {
        this.closeMenu();
      } else {
        this.openMenu();
      }
    };
  }
  openMenu() {
    this.closeMenu();
    const menu = document.createElement("div");
    menu.className = "formula-error-menu";
    const header = document.createElement("div");
    header.className = "formula-error-menu-header";
    const errorLabel = document.createElement("span");
    errorLabel.className = "formula-error-menu-error-code";
    errorLabel.textContent = this.errorInfo.error;
    header.appendChild(errorLabel);
    const desc = document.createElement("span");
    desc.textContent = " " + (this.errorInfo.errorDescription || this.errorInfo.error);
    header.appendChild(desc);
    menu.appendChild(header);
    const sep = document.createElement("div");
    sep.className = "formula-error-menu-separator";
    menu.appendChild(sep);
    this.addMenuItem(menu, _("Help on this error"), () => {
      const siteLocales = [
        "ar",
        "ast",
        "bg",
        "ca",
        "ca-valencia",
        "cs",
        "da",
        "de",
        "el",
        "en-GB",
        "en-US",
        "eo",
        "es",
        "et",
        "eu",
        "fi",
        "fr",
        "gl",
        "he",
        "hr",
        "hu",
        "id",
        "is",
        "it",
        "ja",
        "ko",
        "lo",
        "lt",
        "lv",
        "nb",
        "nl",
        "nn",
        "pl",
        "pt",
        "pt-BR",
        "ro",
        "ru",
        "sk",
        "sl",
        "sq",
        "sv",
        "tr",
        "uk",
        "vi",
        "zh-CN",
        "zh-TW"
      ];
      const uiLocale = window.langParam || "en-US";
      const candidates = [uiLocale, uiLocale.split("-")[0]];
      const locale = candidates.find((l) => siteLocales.includes(l)) ?? "en-US";
      const url = `https://help.collaboraoffice.com/latest/${locale}/text/scalc/05/02140000.html?DbPAR=CALC`;
      window.open(url, "_blank", "noopener");
    });
    this.addMenuItem(menu, _("Inspect with Function Wizard"), () => {
      app.map.sendUnoCommand(".uno:FunctionDialog");
    });
    this.addMenuItem(menu, _("Edit in Formula Bar"), () => {
      app.map.sendUnoCommand(".uno:StartFormula");
      app.map.onFormulaBarFocus();
      app.map.formulabarFocus();
    });
    if (app.map.isAIConfigured) {
      this.addMenuItem(menu, _("Help fix this error with AI"), () => {
        app.dispatcher.dispatch("helpfixformulaerror");
      });
    }
    const objectDiv = this.getHTMLObject();
    objectDiv.appendChild(menu);
    this.menuDiv = menu;
    const closeHandler = (ev) => {
      if (!objectDiv.contains(ev.target)) {
        this.closeMenu();
        document.removeEventListener("mousedown", closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener("mousedown", closeHandler);
    }, 0);
  }
  addMenuItem(container, label, action) {
    const item = document.createElement("div");
    item.className = "formula-error-menu-item";
    item.textContent = label;
    item.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      _FormulaErrorHelpSection.hide();
      action();
    };
    container.appendChild(item);
  }
  closeMenu() {
    if (this.menuDiv) {
      this.menuDiv.remove();
      this.menuDiv = null;
    }
  }
  static show(documentPosition, errorInfo) {
    _FormulaErrorHelpSection.hide();
    const section = new _FormulaErrorHelpSection(documentPosition, errorInfo);
    app.sectionContainer.addSection(section);
  }
  static hide() {
    if (_FormulaErrorHelpSection.isOpen())
      app.sectionContainer.removeSection(app.CSections.FormulaErrorHelpButton.name);
  }
  static isOpen() {
    return app.sectionContainer.doesSectionExist(app.CSections.FormulaErrorHelpButton.name);
  }
};
_FormulaErrorHelpSection.sectionName = "formula error help button";
let FormulaErrorHelpSection = _FormulaErrorHelpSection;
app.definitions.formulaErrorHelpSection = FormulaErrorHelpSection;
