const _BackstageView = class _BackstageView extends window.L.Class {
  isOpen() {
    return this.isVisible;
  }
  constructor(map) {
    var _a;
    super();
    this.isVisible = false;
    this.templates = null;
    this.templatesPromise = null;
    this.templatesLoadError = false;
    this.templateSearchQuery = "";
    this.templateFilter = "all";
    this.templateSectionsContainer = null;
    this.manageSearchQuery = "";
    this.manageFilter = "all";
    this.manageListContainer = null;
    this.userTemplates = [];
    this.templateDropHandler = null;
    this.closeAddTemplateDialog = null;
    this.viewRequest = 0;
    this.saveTabElement = null;
    this.snackbarElement = null;
    this.snackbarTimer = null;
    this.actionHandlers = {
      open: () => this.executeOpen(),
      save: () => this.executeSave(),
      saveas: () => this.executeSaveAs(),
      print: () => this.executePrint(),
      share: () => this.executeShare(),
      repair: () => this.executeRepair(),
      properties: () => this.executeDocumentProperties(),
      history: () => this.executeRevisionHistory(),
      options: () => this.executeOptions(),
      about: () => this.executeAbout(),
      sign: () => this.executeSign(),
      quit: () => this.executeQuit()
    };
    this.getFileName = (wopi) => {
      var _a2, _b, _c;
      if (wopi == null ? void 0 : wopi.BreadcrumbDocName)
        return wopi.BreadcrumbDocName;
      if (wopi == null ? void 0 : wopi.BaseFileName)
        return wopi.BaseFileName;
      const doc = (_b = (_a2 = this.map) == null ? void 0 : _a2.options) == null ? void 0 : _b.doc;
      if (doc) {
        const filename = (_c = doc.split("/").pop()) == null ? void 0 : _c.split("?")[0];
        if (filename)
          return decodeURIComponent(filename);
      }
      return "";
    };
    this.map = map;
    this.isStarterMode = window.starterScreen;
    this.container = this.createContainer();
    document.body.appendChild(this.container);
    (_a = this.map) == null ? void 0 : _a.on("commandstatechanged", (e) => {
      if (e.commandName === ".uno:ModifiedStatus") {
        this.updateSaveButtonState();
      }
    }, this);
    this.boundOnKeyDown = (e) => this.onKeyDown(e);
    document.addEventListener("keydown", this.boundOnKeyDown);
  }
  createContainer() {
    const container = BackstageTemplates.shell({
      isStarterMode: this.isStarterMode,
      closeButtonEnabled: !!window.L.Params.closeButtonEnabled,
      tabs: this.getTabsConfig(),
      onTabClick: (cfg) => this.onTabClick(cfg),
      onClose: () => this.hide(),
      onBackClick: () => this.hide(),
      saveTabRef: (el) => {
        this.saveTabElement = el;
      },
      contentAreaRef: (el) => {
        this.contentArea = el;
      }
    });
    new ResizeObserver(() => this.fitHomeTemplateCards()).observe(this.contentArea);
    this.renderHomeView();
    return container;
  }
  onTabClick(config) {
    if (config.type === "view")
      this.handleViewTab(config);
    else
      this.handleActionTab(config);
  }
  isPdfOpen() {
    const name = String(this.map.options.doc || "").split("?")[0];
    return name.toLowerCase().endsWith(".pdf");
  }
  getTabsConfig() {
    return [
      {
        id: "home",
        label: _("Home"),
        type: "view",
        viewType: "home",
        icon: "lc_home.svg",
        visible: true
      },
      {
        id: "new",
        label: _("New"),
        type: "view",
        viewType: "templates",
        icon: "lc_newdoc.svg",
        visible: true
      },
      {
        id: "open",
        label: _("Open"),
        type: "view",
        actionType: "open",
        viewType: "open",
        icon: "lc_open.svg",
        visible: true
      },
      {
        type: "separator",
        id: "sidebar-common-break",
        label: "",
        visible: !this.isStarterMode
      },
      {
        id: "share",
        label: _("Share"),
        type: "action",
        actionType: "share",
        icon: "lc_shareas.svg",
        visible: !this.isStarterMode && this.isFeatureEnabled("share")
      },
      {
        id: "info",
        label: _("Info"),
        type: "view",
        viewType: "info",
        icon: "lc_printpreview.svg",
        visible: !this.isStarterMode
      },
      {
        id: "save",
        label: _("Save"),
        type: "action",
        actionType: "save",
        icon: "lc_save.svg",
        visible: !this.isStarterMode && this.isFeatureEnabled("save")
      },
      {
        id: "saveas",
        label: _("Save As"),
        type: "action",
        actionType: "saveas",
        icon: "lc_saveacopy.svg",
        visible: !this.isStarterMode && this.isFeatureEnabled("saveAs")
      },
      {
        id: "print",
        label: _("Print"),
        type: "action",
        actionType: "print",
        icon: "lc_printlayout.svg",
        visible: !this.isStarterMode && this.isFeatureEnabled("print")
      },
      {
        id: "export",
        label: _("Export"),
        type: "view",
        viewType: "export",
        icon: "lc_exportto.svg",
        visible: !this.isStarterMode
      },
      {
        id: "sign",
        label: _("Sign"),
        type: "action",
        actionType: "sign",
        icon: "lc_signature.svg",
        // Hidden for PDF: the Sign action dispatches .uno:Signature, which
        // opens the document signature dialog. That is not the way PDFs are
        // signed here (use Insert > Signature Line instead).
        visible: !this.isStarterMode && !!window.documentSigningEnabled && !this.isPdfOpen()
      },
      {
        type: "separator",
        id: "sidebar-horizontal-break",
        label: "",
        visible: !this.isStarterMode
      },
      {
        id: "quit",
        label: _("Quit"),
        type: "action",
        actionType: "quit",
        visible: !this.isStarterMode && window.mode.isCODesktop()
      },
      {
        id: "options",
        label: _("Options"),
        type: "action",
        actionType: "options",
        visible: !this.isStarterMode
      },
      {
        id: "about",
        label: _("About"),
        type: "action",
        actionType: "about",
        visible: !this.isStarterMode
      }
    ];
  }
  handleViewTab(config) {
    const viewRenderers = {
      home: () => this.renderHomeView(),
      templates: () => this.renderNewView(),
      open: () => this.renderOpenView(),
      info: () => this.renderInfoView(),
      export: () => this.renderExportView()
    };
    const viewType = config.viewType;
    if (!viewType)
      return;
    const renderer = viewRenderers[viewType];
    if (renderer)
      renderer();
  }
  handleActionTab(config) {
    if (config.actionType === "save" && !this.isDocumentModified())
      return;
    const handler = this.actionHandlers[config.actionType || ""];
    if (handler)
      handler();
  }
  isFeatureEnabled(feature) {
    const wopi = this.map["wopi"] || {};
    const featureFlags = {
      share: !!wopi.EnableShare,
      save: !wopi.HideSaveOption && !this.map.isReadOnlyMode(),
      saveAs: !wopi.UserCanNotWriteRelative || window.ThisIsTheQtApp || window.ThisIsTheWindowsApp,
      print: !wopi.HidePrintOption,
      repair: !wopi.HideRepairOption
    };
    return featureFlags[feature] !== false;
  }
  renderHomeView(userTemplatesLoaded = false) {
    if (this.hasUserTemplates() && !userTemplatesLoaded) {
      this.afterUserTemplatesLoad(() => this.renderHomeView(true));
      return;
    }
    this.setActiveTab("backstage-home");
    this.clearContent();
    this.contentArea.appendChild(BackstageTemplates.sectionHeader(_("Home"), _("Start something new, or continue where you left off.")));
    if (!this.templates) {
      this.contentArea.appendChild(BackstageTemplates.templatesLoading());
      this.loadTemplatesData().then(() => {
        if (this.isVisible)
          this.renderHomeView(true);
      });
      return;
    }
    this.contentArea.appendChild(BackstageTemplates.homeTemplatesSection({
      favoriteTemplates: this.getFavoriteTemplates(),
      favoriteState: (template) => this.favoriteState(template, () => this.renderHomeView(true)),
      blankTemplates: [
        this.getBlankTemplate("writer"),
        this.getBlankTemplate("calc"),
        this.getBlankTemplate("impress"),
        this.getBlankTemplate("draw")
      ],
      onTemplateClick: (t) => this.triggerNewDocument(t),
      onMoreTemplatesClick: () => {
        const newTabElement = document.getElementById("backstage-new");
        if (newTabElement)
          newTabElement.click();
        else
          this.renderNewView();
      }
    }));
    this.fitHomeTemplateCards();
    this.contentArea.appendChild(BackstageTemplates.sectionHeader(_("Recent")));
    this.renderRecentDocuments();
  }
  fitHomeTemplateCards() {
    const row = this.contentArea.querySelector(".backstage-home-templates-row");
    if (!row)
      return;
    const cards = Array.from(row.querySelectorAll(".backstage-template-card"));
    cards.forEach((card) => {
      card.style.display = "";
    });
    for (let index = cards.length - 1; index >= 0 && row.scrollWidth > row.clientWidth; index--) {
      cards[index].style.display = "none";
    }
  }
  async renderRecentDocuments() {
    try {
      const result = await window.postMobileCall("GETRECENTDOCS");
      if (!result || typeof result !== "string") {
        this.contentArea.appendChild(BackstageTemplates.emptyRecentDocs());
        return;
      }
      const docs = JSON.parse(result);
      if (!Array.isArray(docs) || docs.length === 0) {
        this.contentArea.appendChild(BackstageTemplates.emptyRecentDocs());
        return;
      }
      const rows = docs.map((doc, i) => {
        const { fileName, filePath, timestamp, uri } = this.parseDocumentData(doc);
        return {
          index: i,
          fileName,
          filePath,
          formattedTime: this.formatTimestamp(timestamp),
          uri,
          iconClass: this.getDocumentIconClass(doc.doctype || "writer")
        };
      });
      this.contentArea.appendChild(BackstageTemplates.recentDocsTable(rows, (uri) => this.openRecentDocument(uri)));
    } catch (e) {
      console.error("Failed to get recent documents:", e);
      this.contentArea.appendChild(BackstageTemplates.emptyRecentDocs());
    }
  }
  parseDocumentData(doc) {
    var _a;
    const uri = doc.uri || "";
    const displayUri = doc.displayUri || uri;
    const url = new URL(displayUri);
    let fullPath = url.pathname;
    if (window.ThisIsTheWindowsApp && fullPath[0] === "/" && fullPath[2] === ":")
      fullPath = fullPath.slice(1);
    if (window.ThisIsTheWindowsApp && url.host !== "")
      fullPath = "//" + url.host + fullPath;
    if (window.ThisIsTheWindowsApp)
      fullPath = fullPath.replaceAll("/", "\\");
    fullPath = decodeURIComponent(fullPath);
    const lastSlashIndex = Math.max(fullPath.lastIndexOf("/"), fullPath.lastIndexOf("\\"));
    const fileName = doc.name || (lastSlashIndex >= 0 ? fullPath.slice(lastSlashIndex + 1) : fullPath);
    const filePath = lastSlashIndex >= 0 ? fullPath.slice(0, lastSlashIndex + 1) : "/";
    if (!doc.doctype) {
      const ext = ((_a = fileName.split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
      if (["ods", "ots", "xls", "xlsx", "csv", "fods"].includes(ext)) {
        doc.doctype = "calc";
      } else if (["odp", "otp", "ppt", "pptx", "fodp"].includes(ext)) {
        doc.doctype = "impress";
      } else if (["odg", "otg", "svg", "vsd", "vsdx", "fodg"].includes(ext)) {
        doc.doctype = "draw";
      } else if (ext === "pdf") {
        doc.doctype = "pdf";
      } else {
        doc.doctype = "writer";
      }
    }
    return {
      fileName,
      filePath,
      timestamp: doc.timestamp || "",
      uri
    };
  }
  formatTimestamp(timestamp) {
    if (!timestamp)
      return "";
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime()))
        return timestamp;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${year}/${month}/${day} at ${hours}:${minutes}:${seconds}`;
    } catch {
      return timestamp;
    }
  }
  openRecentDocument(uri) {
    var _a, _b;
    if (!uri) {
      console.warn("openRecentDocument: URI is missing");
      return;
    }
    const currentDoc = (_b = (_a = this.map) == null ? void 0 : _a.options) == null ? void 0 : _b.doc;
    if (currentDoc && decodeURIComponent(uri) === decodeURIComponent(currentDoc)) {
      this.returnToDocumentView();
      return;
    }
    window.postMobileMessage(`opendoc file=${encodeURIComponent(uri)}`);
    this.returnToDocumentView();
  }
  getDocumentIconClass(docType) {
    switch (docType) {
      case "calc":
        return "backstage-doc-icon-calc";
      case "impress":
        return "backstage-doc-icon-impress";
      case "draw":
        return "backstage-doc-icon-draw";
      case "pdf":
        return "backstage-doc-icon-pdf";
      case "writer":
      default:
        return "backstage-doc-icon-writer";
    }
  }
  renderOpenView() {
    this.setActiveTab("backstage-open");
    this.clearContent();
    this.contentArea.appendChild(BackstageTemplates.openView({
      onOpenLocal: () => this.executeOpen(),
      cloudTiles: this.getRegisteredCloudProviders().map((p) => ({
        id: p.id,
        typeName: BackstageCloudKinds.label(p.kind),
        kind: p.kind,
        userName: p.name,
        onClick: () => this.openCloudProvider(p),
        onEdit: () => this.showAddCloudDialog(p)
      })),
      onAddCloudClick: () => this.showAddCloudDialog()
    }));
  }
  mountDialog(build) {
    const opener = document.activeElement;
    const ref = {};
    const close = () => {
      var _a;
      (_a = ref.overlay) == null ? void 0 : _a.remove();
      if (opener && document.contains(opener) && typeof opener.focus === "function") {
        opener.focus();
      } else {
        const activeTab = this.container.querySelector(".backstage-sidebar-item.active") || this.getSidebarNavItems()[0] || this.container;
        activeTab == null ? void 0 : activeTab.focus();
      }
    };
    ref.overlay = build(close);
    ref.overlay.onDismiss = close;
    this.container.appendChild(ref.overlay);
  }
  showAddCloudDialog(provider) {
    this.mountDialog((close) => BackstageTemplates.addCloudDialog({
      isEdit: !!provider,
      initialKind: (provider == null ? void 0 : provider.kind) ?? BackstageCloudKinds.defaultKind(),
      initialDomain: (provider == null ? void 0 : provider.url) ?? "",
      initialName: (provider == null ? void 0 : provider.name) ?? "",
      onCancel: close,
      onSubmit: (kind, name, domain) => {
        if (provider) {
          this.updateCloudProvider(provider.id, kind, name, domain);
          close();
          this.renderOpenView();
        } else {
          const added = this.saveCloudProvider(kind, name, domain);
          close();
          this.renderOpenView();
          this.showCloudAddedDialog(added);
        }
      },
      onDelete: provider ? () => this.showRemoveConfirmDialog(provider, async () => {
        if (!await this.removeCloudProvider(provider.id))
          return;
        close();
        this.renderOpenView();
      }) : void 0
    }));
  }
  showCloudAddedDialog(provider) {
    this.mountDialog((close) => BackstageTemplates.cloudAddedDialog({
      typeName: BackstageCloudKinds.label(provider.kind),
      kind: provider.kind,
      userName: provider.name,
      onClose: close,
      onOpen: () => {
        close();
        this.openCloudProvider(provider);
      }
    }));
  }
  showRemoveConfirmDialog(provider, onConfirm) {
    this.mountDialog((close) => BackstageTemplates.removeConfirmDialog({
      typeName: BackstageCloudKinds.label(provider.kind),
      kind: provider.kind,
      userName: provider.name,
      onCancel: close,
      onConfirm: () => {
        close();
        onConfirm();
      }
    }));
  }
  getRegisteredCloudProviders() {
    try {
      const raw = localStorage.getItem(_BackstageView.CLOUD_PROVIDERS_KEY);
      if (!raw)
        return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed))
        return [];
      return parsed.filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && typeof p.url === "string" && BackstageCloudKinds.isValidKind(p.kind));
    } catch (e) {
      console.error("Failed to read cloud providers:", e);
      return [];
    }
  }
  saveCloudProvider(kind, name, domain) {
    const newProvider = {
      id: `${kind}-${Date.now()}`,
      kind,
      name,
      url: domain
    };
    const providers = this.getRegisteredCloudProviders();
    providers.push(newProvider);
    try {
      localStorage.setItem(_BackstageView.CLOUD_PROVIDERS_KEY, JSON.stringify(providers));
    } catch (e) {
      console.error("Failed to persist cloud provider:", e);
    }
    return newProvider;
  }
  updateCloudProvider(id, kind, name, domain) {
    const providers = this.getRegisteredCloudProviders().map((p) => p.id === id ? { ...p, kind, name, url: domain } : p);
    try {
      localStorage.setItem(_BackstageView.CLOUD_PROVIDERS_KEY, JSON.stringify(providers));
    } catch (e) {
      console.error("Failed to update cloud provider:", e);
    }
  }
  // Returns false when the app keeps the account because it still has open documents.
  async removeCloudProvider(id) {
    window.app.console.debug("Backstage: removing account " + id);
    const answer = await window.postMobileCall("removecloudaccount account=" + id);
    if (answer === "refused") {
      this.map.uiManager.showInfoModal("cloud-account-in-use", _("Account in use"), _("Close the documents of this account before you remove it."), "", _("OK"));
      return false;
    }
    const providers = this.getRegisteredCloudProviders().filter((p) => p.id !== id);
    try {
      localStorage.setItem(_BackstageView.CLOUD_PROVIDERS_KEY, JSON.stringify(providers));
    } catch (e) {
      console.error("Failed to remove cloud provider:", e);
    }
    return true;
  }
  openCloudProvider(provider) {
    window.app.console.debug("Backstage: opening account " + provider.id);
    window.postMobileMessage("openremote " + provider.url + " account=" + provider.id);
  }
  renderNewView(userTemplatesLoaded = false) {
    if (this.hasUserTemplates() && !userTemplatesLoaded) {
      this.afterUserTemplatesLoad(() => this.renderNewView(true));
      return;
    }
    this.setActiveTab("backstage-new");
    this.clearContent();
    this.templateSectionsContainer = null;
    this.contentArea.appendChild(BackstageTemplates.sectionHeader(_("New")));
    if (!this.templates) {
      this.contentArea.appendChild(BackstageTemplates.templatesLoading());
      this.loadTemplatesData().then(() => {
        if (this.isVisible)
          this.renderNewView();
      });
      return;
    }
    this.templateSectionsContainer = this.buildTemplateSections();
    this.contentArea.appendChild(BackstageTemplates.templateExplorer({
      blankTemplates: this.getNewViewBlankTemplates(),
      searchQuery: this.templateSearchQuery,
      filter: this.templateFilter,
      sections: this.templateSectionsContainer,
      onTemplateClick: (t) => this.triggerNewDocument(t),
      onSearchInput: (value) => {
        this.templateSearchQuery = value;
        this.updateTemplateSections();
      },
      onFilterChange: (filter) => {
        this.templateFilter = filter;
        this.updateTemplateSections();
      }
    }));
  }
  buildTemplateSections() {
    const builtInTemplates = [
      ...this.getIntroDocsData(),
      ...this.getTemplatesData()
    ];
    return BackstageTemplates.templateSections({
      userTemplates: this.hasUserTemplates() ? this.getFilteredTemplates(this.getUserTemplateCards()) : null,
      builtInTemplates: this.getFilteredTemplates(builtInTemplates),
      searchQuery: this.templateSearchQuery,
      onClick: (t) => this.triggerNewDocument(t),
      onAddTemplate: () => this.showAddTemplateDialog(() => this.renderNewView()),
      onManageTemplates: () => this.renderManageTemplatesView(),
      favoriteState: (template) => this.favoriteState(template, () => this.updateTemplateSections())
    });
  }
  getFavoriteIds() {
    try {
      const ids = JSON.parse(window.prefs.get(_BackstageView.FAVORITES_KEY) || "[]");
      return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }
  setFavoriteIds(ids) {
    window.prefs.set(_BackstageView.FAVORITES_KEY, JSON.stringify(ids));
  }
  favoriteState(template, refresh) {
    return {
      isFavorite: this.getFavoriteIds().includes(template.id),
      onToggle: () => this.toggleFavorite(template, refresh)
    };
  }
  toggleFavorite(template, refresh) {
    var _a, _b;
    const ids = this.getFavoriteIds();
    const wasFavorite = ids.includes(template.id);
    this.setFavoriteIds(wasFavorite ? ids.filter((id) => id !== template.id) : [...ids, template.id]);
    this.showSnackbar(wasFavorite ? _("Template removed from favorites") : _("Template added to favorites"));
    const starHadKeyboardFocus = !!((_a = document.activeElement) == null ? void 0 : _a.matches(".backstage-template-favorite:focus-visible"));
    refresh();
    if (starHadKeyboardFocus)
      (_b = this.contentArea.querySelector("#" + CSS.escape(template.id) + " .backstage-template-favorite")) == null ? void 0 : _b.focus();
  }
  showSnackbar(text) {
    var _a;
    (_a = this.snackbarElement) == null ? void 0 : _a.remove();
    app.timerRegistry.clearTimeout(this.snackbarTimer);
    const snackbar = BackstageTemplates.snackbar(text);
    this.snackbarElement = snackbar;
    this.container.appendChild(snackbar);
    this.snackbarTimer = app.timerRegistry.setTimeout("backstagesnackbar", () => {
      snackbar.classList.add("is-leaving");
      this.snackbarTimer = app.timerRegistry.setTimeout("backstagesnackbarfade", () => {
        snackbar.remove();
        this.snackbarElement = null;
        this.snackbarTimer = null;
      }, window.L.DomUtil.getDurationMs("--duration-fast"));
    }, 1e4);
  }
  // Only the Qt app keeps templates of the user so far.
  hasUserTemplates() {
    return !!window.ThisIsTheQtApp;
  }
  async loadUserTemplates() {
    const list = await window.postMobileCall("GETUSERTEMPLATES");
    this.userTemplates = Array.isArray(list) ? list : [];
  }
  // Renders the view when the list arrives, if the backstage still shows the same view. When the
  // list cannot be read, the view shows the templates that it had before.
  afterUserTemplatesLoad(render) {
    const request = ++this.viewRequest;
    this.loadUserTemplates().catch((e) => console.error("Failed to read user templates:", e)).then(() => {
      if (this.isVisible && request === this.viewRequest)
        render();
    });
  }
  getUserTemplateCards() {
    return this.userTemplates.map((template) => ({
      id: "user-template-" + template.id,
      name: template.name,
      type: template.type,
      path: template.path,
      basename: template.name,
      preview: template.preview,
      searchText: [template.name, template.type].join(" ").toLowerCase()
    }));
  }
  // The favorite templates, in the order that the user marked them. A favorite whose template
  // no longer exists is left out.
  getFavoriteTemplates() {
    const templates = /* @__PURE__ */ new Map();
    [
      ...this.hasUserTemplates() ? this.getUserTemplateCards() : [],
      ...this.getIntroDocsData(),
      ...this.getTemplatesData()
    ].forEach((template) => templates.set(template.id, template));
    return this.getFavoriteIds().map((id) => templates.get(id)).filter(Boolean);
  }
  renderManageTemplatesView(userTemplatesLoaded = false) {
    if (!userTemplatesLoaded) {
      this.afterUserTemplatesLoad(() => this.renderManageTemplatesView(true));
      return;
    }
    this.setActiveTab("backstage-new");
    this.clearContent();
    this.templateSectionsContainer = null;
    this.manageListContainer = this.buildManageTemplatesList();
    this.contentArea.appendChild(BackstageTemplates.manageTemplatesView({
      hasTemplates: this.userTemplates.length > 0,
      searchQuery: this.manageSearchQuery,
      filter: this.manageFilter,
      list: this.manageListContainer,
      onAdd: () => this.showAddTemplateDialog(() => this.renderManageTemplatesView()),
      onBack: () => this.renderNewView(),
      onSearchInput: (value) => {
        this.manageSearchQuery = value;
        this.updateManageTemplatesList();
      },
      onFilterChange: (filter) => {
        this.manageFilter = filter;
        this.updateManageTemplatesList();
      }
    }));
  }
  buildManageTemplatesList() {
    const query = this.manageSearchQuery.trim().toLowerCase();
    return BackstageTemplates.manageTemplatesList({
      templates: this.userTemplates.filter((template) => (this.manageFilter === "all" || template.type === this.manageFilter) && (!query || template.name.toLowerCase().includes(query))),
      searchQuery: this.manageSearchQuery,
      onRename: (template) => this.showRenameTemplateDialog(template),
      onRemove: (template) => this.showRemoveTemplateDialog(template)
    });
  }
  // Only the list is rebuilt, so the search field keeps its focus.
  updateManageTemplatesList() {
    var _a;
    if (!((_a = this.manageListContainer) == null ? void 0 : _a.isConnected))
      return;
    const list = this.buildManageTemplatesList();
    this.manageListContainer.replaceWith(list);
    this.manageListContainer = list;
  }
  showAddTemplateDialog(onAdded) {
    this.mountDialog((close) => {
      const finish = () => {
        this.closeAddTemplateDialog = null;
        this.templateDropHandler = null;
        window.postMobileMessage("SETTEMPLATEDROPTARGET off");
        close();
      };
      const dialog = BackstageTemplates.addTemplateDialog({
        onBrowse: async () => await window.postMobileCall("PICKUSERTEMPLATE") || null,
        onCancel: finish,
        onAdd: async (file, name) => {
          const added = await window.postMobileCall("ADDUSERTEMPLATE name=" + encodeURIComponent(name) + " source=" + encodeURIComponent(file.path));
          if (!added)
            return false;
          finish();
          onAdded();
          return true;
        }
      });
      this.closeAddTemplateDialog = finish;
      this.templateDropHandler = dialog.setFile;
      window.postMobileMessage("SETTEMPLATEDROPTARGET on");
      return dialog.element;
    });
  }
  // Takes a file dropped on the window as the file to add as a template.
  onTemplateFileDropped(file) {
    if (this.templateDropHandler)
      this.templateDropHandler(file);
  }
  showRenameTemplateDialog(template) {
    this.mountDialog((close) => BackstageTemplates.renameTemplateDialog({
      name: template.name,
      onCancel: close,
      onRename: async (name) => {
        const renamed = await window.postMobileCall("RENAMEUSERTEMPLATE id=" + template.id + " name=" + encodeURIComponent(name));
        if (!renamed)
          return false;
        close();
        this.renderManageTemplatesView();
        return true;
      }
    }));
  }
  showRemoveTemplateDialog(template) {
    this.mountDialog((close) => BackstageTemplates.removeTemplateDialog({
      name: template.name,
      onCancel: close,
      onConfirm: async () => {
        close();
        if (await window.postMobileCall("REMOVEUSERTEMPLATE id=" + template.id)) {
          const cardId = "user-template-" + template.id;
          this.setFavoriteIds(this.getFavoriteIds().filter((id) => id !== cardId));
        }
        this.renderManageTemplatesView();
      }
    }));
  }
  updateTemplateSections() {
    if (!this.templateSectionsContainer)
      return;
    const sections = this.buildTemplateSections();
    this.templateSectionsContainer.replaceWith(sections);
    this.templateSectionsContainer = sections;
  }
  // The New view names the blank documents by their type alone.
  getNewViewBlankTemplates() {
    return ["writer", "calc", "impress", "draw"].map((type) => ({
      ...this.getBlankTemplate(type),
      name: BackstageTemplates.typeLabel(type)
    }));
  }
  getIntroDocsData() {
    const entries = window.CODA_INTRODOCS || [];
    const docs = [];
    entries.forEach((entry) => {
      const path = entry.path;
      if (!path)
        return;
      const type = this.normalizeTemplateType(entry.type, path);
      if (!type)
        return;
      if (!entry.name)
        return;
      const name = _(entry.name);
      const id = entry.id || this.slugify(entry.name + path);
      const previews = this.localizedPreviews(entry.preview);
      docs.push({
        id,
        name,
        type,
        path,
        basename: entry.basename ? _(entry.basename) : void 0,
        preview: previews[0],
        previewFallbacks: previews.slice(1),
        searchText: [name, type, path].join(" ").toLowerCase()
      });
    });
    return docs;
  }
  // The build ships the English preview of an intro document as
  // introdocs/preview/<Doc>.png and a rendering per translated language as
  // <Doc>-<bcp47>.png (see introdocs/render_previews.py). Lists the files
  // to try for the UI language, most specific first, ending with the
  // English one.
  localizedPreviews(preview) {
    if (!preview)
      return [];
    const match = /^(.*)\.png$/.exec(preview);
    if (!match)
      return [preview];
    const candidates = [];
    for (const tag of this.previewLanguageTags())
      candidates.push(match[1] + "-" + tag + ".png");
    candidates.push(preview);
    return candidates;
  }
  // The tags the engine matches the UI language against when it
  // translates the document, in its order: the full tag, then the
  // language alone. English is the source language and has no file of
  // its own.
  previewLanguageTags() {
    const lang = String(window.LANG || "").replace(/_/g, "-");
    if (!lang || lang === "en-US")
      return [];
    const tags = [lang];
    const language = lang.split("-")[0];
    if (language !== lang)
      tags.push(language);
    return tags;
  }
  renderInfoView() {
    this.setActiveTab("backstage-info");
    this.clearContent();
    this.contentArea.appendChild(BackstageTemplates.sectionHeader(_("Document Info"), _("View document properties and information")));
    this.contentArea.appendChild(BackstageTemplates.infoPropertiesColumn(this.getDocumentProperties(), () => this.executeDocumentProperties()));
  }
  renderExportView() {
    this.setActiveTab("backstage-export");
    this.clearContent();
    const exportOptions = this.getExportOptionsFromNotebookbar();
    if (exportOptions.downloadAs.length > 0) {
      this.contentArea.appendChild(BackstageTemplates.sectionHeader(_("Export Document"), _("export your documents in different formats")));
      this.contentArea.appendChild(BackstageTemplates.exportGrid(exportOptions.downloadAs, (action, command) => this.dispatchExportAction(action, command)));
    }
  }
  getDocumentProperties() {
    var _a, _b, _c;
    const docType = this.getDocTypeString();
    const docLayer = (_a = this.map) == null ? void 0 : _a._docLayer;
    const wopi = (_b = this.map) == null ? void 0 : _b["wopi"];
    const typeLabels = {
      text: { type: _("Text Document"), parts: _("Pages") },
      spreadsheet: { type: _("Spreadsheet"), parts: _("Sheets") },
      presentation: { type: _("Presentation"), parts: _("Slides") },
      drawing: { type: _("Drawing"), parts: _("Pages") }
    };
    const config = typeLabels[docType] || {
      type: _("Document"),
      parts: _("Parts")
    };
    const properties = [
      { label: _("Type"), value: config.type },
      {
        label: config.parts,
        value: (docLayer == null ? void 0 : docLayer._parts) ? String(docLayer._parts) : "-"
      },
      {
        label: _("Mode"),
        value: ((_c = this.map) == null ? void 0 : _c.isEditMode()) ? _("Edit") : _("View Only")
      }
    ];
    const filename = this.getFileName(wopi);
    if (filename) {
      properties.splice(1, 0, {
        label: _("File Name"),
        value: filename
      });
    }
    return properties;
  }
  clearContent() {
    this.contentArea.replaceChildren();
  }
  setActiveTab(tabId) {
    var _a;
    ++this.viewRequest;
    document.querySelectorAll(".backstage-sidebar-item").forEach((el) => el.classList.remove("active"));
    (_a = document.getElementById(tabId)) == null ? void 0 : _a.classList.add("active");
  }
  getTemplatesData() {
    const entries = this.templates || [];
    const templates = [];
    entries.forEach((entry) => {
      const absolutePath = entry.path;
      if (!absolutePath)
        return;
      const type = this.normalizeTemplateType(entry.type, absolutePath);
      if (!type)
        return;
      if (!entry.name)
        return;
      const name = _(entry.name);
      const id = entry.id || this.slugify(entry.name + absolutePath);
      const searchComponents = [name, type, absolutePath];
      templates.push({
        id,
        name,
        type,
        path: absolutePath,
        basename: entry.basename ? _(entry.basename) : void 0,
        preview: entry.preview || void 0,
        featured: !!entry.featured,
        searchText: searchComponents.join(" ").toLowerCase()
      });
    });
    const typeOrder = {
      writer: 1,
      calc: 2,
      impress: 3,
      draw: 4
    };
    return templates.sort((a, b) => {
      const typeComparison = typeOrder[a.type] - typeOrder[b.type];
      if (typeComparison !== 0)
        return typeComparison;
      return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
    });
  }
  async loadTemplatesData() {
    if (this.templatesPromise)
      return this.templatesPromise;
    const loader = (async () => {
      try {
        const entries = window.CODA_TEMPLATES || [];
        this.templates = entries;
        this.templatesLoadError = false;
        if (!entries || entries.length === 0) {
          console.warn("Templates manifest loaded but contains no templates!");
        }
      } catch (error) {
        console.error("Unable to load templates manifest", error);
        this.templates = [];
        this.templatesLoadError = true;
      }
    })();
    this.templatesPromise = loader.finally(() => {
      this.templatesPromise = null;
    });
    return this.templatesPromise;
  }
  getFilteredTemplates(allTemplates) {
    const query = this.templateSearchQuery.trim().toLowerCase();
    return allTemplates.filter((template) => (this.templateFilter === "all" || template.type === this.templateFilter) && (!query || template.searchText.includes(query)));
  }
  getBlankTemplate(type) {
    let name;
    let previewPath;
    switch (type) {
      case "calc":
        name = _("Blank Spreadsheet");
        previewPath = "images/templates/preview/blank_spreadsheet.svg";
        break;
      case "impress":
        name = _("Blank Presentation");
        previewPath = "images/templates/preview/blank_presentation.svg";
        break;
      case "draw":
        name = _("Blank Drawing");
        previewPath = "images/templates/preview/blank_drawing.svg";
        break;
      case "writer":
      default:
        name = _("Blank Document");
        previewPath = "images/templates/preview/blank_writer.svg";
        break;
    }
    return {
      id: `blank-${type}`,
      name,
      type,
      preview: previewPath,
      searchText: `${name.toLowerCase()} ${type} blank`
    };
  }
  detectTypeFromPath(templatePath) {
    var _a;
    const extension = ((_a = templatePath.split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
    const map = {
      ott: "writer",
      oth: "writer",
      otm: "writer",
      ots: "calc",
      otp: "impress",
      otg: "draw"
    };
    return map[extension] || null;
  }
  normalizeTemplateType(entryType, templatePath) {
    const normalized = (entryType || "").toLowerCase();
    if (normalized === "writer" || normalized === "calc" || normalized === "impress" || normalized === "draw")
      return normalized;
    return this.detectTypeFromPath(templatePath);
  }
  slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  }
  getDocTypeString() {
    const docLayer = this.map && this.map._docLayer;
    const docType = docLayer && docLayer._docType;
    return docType || "text";
  }
  getExportOptionsFromNotebookbar() {
    const builder = new window.L.Control.NotebookbarBuilder();
    const downloadAsOpts = builder._getDownloadAsSubmenuOpts ? builder._getDownloadAsSubmenuOpts() || [] : [];
    return {
      exportAs: [],
      downloadAs: downloadAsOpts
    };
  }
  executeOpen() {
    if (this.isStarterMode) {
      window.postMobileMessage("uno .uno:Open");
    } else {
      this.sendUnoCommand(".uno:Open");
    }
  }
  executeOptions() {
    this.map.settings.showSettingsDialog();
  }
  executeAbout() {
    this.map.showLOAboutDialog();
  }
  executeSave() {
    if (this.map && this.map.save) {
      this.map.save(false, false);
    }
    this.hide();
  }
  executeSaveAs() {
    this.sendUnoCommand(".uno:SaveAs");
    this.hide();
  }
  executePrint() {
    if (window.ThisIsAMobileApp) {
      window.postMobileMessage("PRINT");
    } else if (this.map && this.map.print) {
      this.map.print();
    }
    this.hide();
  }
  executeShare() {
    this.fireMapEvent("postMessage", { msgId: "UI_Share" });
    this.hide();
  }
  executeRevisionHistory() {
    this.fireMapEvent("postMessage", { msgId: "rev-history" });
    this.hide();
  }
  executeRepair() {
    this.sendUnoCommand(".uno:Repair");
    this.hide();
  }
  executeSign() {
    this.sendUnoCommand(".uno:Signature");
    this.hide();
  }
  executeQuit() {
    this.sendUnoCommand(".uno:Quit");
  }
  executeDocumentProperties() {
    this.sendUnoCommand(".uno:SetDocumentProperties");
    this.hide();
  }
  triggerNewDocument(template) {
    const docType = template.type || "writer";
    const params = ["type=" + docType];
    if (template.path) {
      params.push("template=" + encodeURIComponent(template.path));
    }
    const basename = template.basename || _("Untitled");
    params.push("basename=" + encodeURIComponent(basename));
    window.postMobileMessage("newdoc " + params.join(" "));
    this.returnToDocumentView();
  }
  // In starter mode there is no document to return to; the app closes
  // the starter window itself. Also called by the apps once a native
  // file-open dialog picks a document.
  returnToDocumentView() {
    if (!this.isStarterMode) {
      this.hide();
    }
  }
  dispatchExportAction(action, command) {
    const actionToDispatch = command || action;
    if (window.app && window.app.dispatcher) {
      window.app.dispatcher.dispatch(actionToDispatch);
    } else {
      console.warn("app.dispatcher not available, using fallback");
      this.handleExportFallback(actionToDispatch);
    }
    this.hide();
  }
  getBaseFileName() {
    var _a, _b;
    const fileName = ((_b = (_a = this.map) == null ? void 0 : _a["wopi"]) == null ? void 0 : _b.BaseFileName) || "document";
    const lastDot = fileName.lastIndexOf(".");
    return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  }
  handleExportFallback(action) {
    if (action === "exportdirectpdf") {
      if (this.map && this.map.downloadAs) {
        this.map.downloadAs(this.getBaseFileName() + ".pdf", "pdf");
      }
      return;
    }
    if (action.startsWith("downloadas-")) {
      const format = action.substring("downloadas-".length);
      if (this.map && this.map.downloadAs) {
        this.map.downloadAs(this.getBaseFileName() + "." + format, format);
      }
      return;
    }
    console.error("something want wrong with this action: ", action);
  }
  sendUnoCommand(command) {
    if (this.map && this.map.sendUnoCommand) {
      this.map.sendUnoCommand(command);
    }
  }
  fireMapEvent(eventName, data) {
    if (this.map && this.map.fire) {
      this.map.fire(eventName, data);
    }
  }
  show(tab = "home") {
    if (this.isVisible && tab === "home") {
      return;
    }
    if (!this.isVisible) {
      this.isVisible = true;
      $(this.container).removeClass("hidden");
      this.hideDocumentContainer();
      this.updateSaveButtonState();
      this.fireMapEvent("backstageshow");
    }
    if (tab === "new") {
      this.renderNewView();
    } else {
      this.renderHomeView();
    }
    const activeTab = this.container.querySelector(".backstage-sidebar-item.active") || this.getSidebarNavItems()[0] || this.container;
    if (activeTab) {
      activeTab.focus();
    }
  }
  hide() {
    var _a;
    if (!this.isVisible) {
      return;
    }
    this.isVisible = false;
    (_a = this.closeAddTemplateDialog) == null ? void 0 : _a.call(this);
    $(this.container).addClass("hidden");
    this.showDocumentContainer();
    this.focusMap();
    this.fireMapEvent("backstagehide");
  }
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  hideDocumentContainer() {
    const container = document.getElementById("document-container");
    if (container)
      container.classList.add("hidden");
    $(".notebookbar-scroll-wrapper").addClass("hidden");
  }
  showDocumentContainer() {
    const container = document.getElementById("document-container");
    if (container)
      container.classList.remove("hidden");
    $(".notebookbar-scroll-wrapper").removeClass("hidden");
  }
  focusMap() {
    if (this.map && this.map.focus) {
      this.map.focus();
    }
  }
  isDocumentModified() {
    var _a, _b;
    return ((_b = (_a = this.map) == null ? void 0 : _a.stateChangeHandler) == null ? void 0 : _b.getItemValue(".uno:ModifiedStatus")) === "true";
  }
  updateSaveButtonState() {
    if (!this.saveTabElement)
      return;
    this.saveTabElement.classList.toggle("disabled", !this.isDocumentModified());
  }
  getSidebarNavItems() {
    const sidebar = this.container.querySelector(".backstage-sidebar");
    if (!sidebar)
      return [];
    const items = Array.from(sidebar.querySelectorAll(".backstage-sidebar-back, .backstage-sidebar-item:not(.separator):not(.disabled)"));
    return items.filter((el) => el.offsetParent !== null);
  }
  onKeyDown(e) {
    var _a, _b;
    if (!this.isVisible)
      return;
    if (((_a = this.map) == null ? void 0 : _a.uiManager) && this.map.uiManager.isAnyDialogOpen() || ((_b = this.map) == null ? void 0 : _b.jsdialog) && this.map.jsdialog.hasDialogOpened()) {
      return;
    }
    const activeEl = document.activeElement;
    if (activeEl && activeEl !== document.body && !this.container.contains(activeEl)) {
      return;
    }
    const overlays = this.container.querySelectorAll(".backstage-modal-overlay");
    const modalOverlay = overlays[overlays.length - 1];
    if (modalOverlay) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        const onDismiss = modalOverlay.onDismiss;
        if (typeof onDismiss === "function") {
          onDismiss();
        } else {
          const cancelBtn = modalOverlay.querySelector(".backstage-modal-cancel");
          if (cancelBtn) {
            cancelBtn.click();
          } else {
            modalOverlay.remove();
          }
        }
      }
      return;
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      if (!this.isStarterMode) {
        this.hide();
      }
      return;
    }
    const items = this.getSidebarNavItems();
    if (!items.length)
      return;
    const currentIndex = items.indexOf(activeEl);
    const sidebar = this.container.querySelector(".backstage-sidebar");
    const inSidebar = currentIndex !== -1 || sidebar && sidebar.contains(activeEl) || activeEl === this.container;
    const isTextInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || activeEl.isContentEditable;
    if (e.key === "ArrowDown" || e.key === "Tab" && !e.shiftKey) {
      if (inSidebar) {
        e.stopPropagation();
        e.preventDefault();
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length;
        items[nextIndex].focus();
        return;
      }
    } else if (e.key === "ArrowUp" || e.key === "Tab" && e.shiftKey) {
      if (inSidebar) {
        e.stopPropagation();
        e.preventDefault();
        const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        items[prevIndex].focus();
        return;
      }
    } else if (e.key === "Enter" || e.key === " ") {
      if (currentIndex !== -1) {
        e.stopPropagation();
        e.preventDefault();
        items[currentIndex].click();
        return;
      }
    } else if (e.key === "ArrowRight" && inSidebar) {
      const firstContentFocusable = this.contentArea.querySelector('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]');
      if (firstContentFocusable) {
        e.stopPropagation();
        e.preventDefault();
        firstContentFocusable.focus();
        return;
      }
    } else if (e.key === "ArrowLeft" && !isTextInput && this.contentArea.contains(activeEl)) {
      const activeTab = this.container.querySelector(".backstage-sidebar-item.active") || items[0];
      if (activeTab) {
        e.stopPropagation();
        e.preventDefault();
        activeTab.focus();
        return;
      }
    }
  }
};
_BackstageView.CLOUD_PROVIDERS_KEY = "coda.cloudProviders";
_BackstageView.FAVORITES_KEY = "templateFavorites";
let BackstageView = _BackstageView;
window.L.Control.BackstageView = BackstageView;
