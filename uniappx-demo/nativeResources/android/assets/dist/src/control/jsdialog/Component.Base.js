const _JSDialogComponent = class _JSDialogComponent {
  constructor(map, name, allowedJsonType) {
    this.map = map;
    this.name = name;
    this.allowedJsonType = allowedJsonType;
    this.model = new JSDialogModelState(name);
  }
  getContainer() {
    return this.container;
  }
  /// connects component to the JSDialogMessageRouter
  registerMessageHandlers() {
    this.map.on("jsdialogupdate", this.onJSUpdate, this);
    this.map.on("jsdialogaction", this.onJSAction, this);
  }
  /// disconnects component from JSDialogMessageRouter
  unregisterMessageHandlers() {
    this.map.off("jsdialogupdate", this.onJSUpdate, this);
    this.map.off("jsdialogaction", this.onJSAction, this);
  }
  /// Widgets in the container belong to the component that last built its full content.
  /// A widget patch finds its target by id inside the container, so patches are applied
  /// only while this component owns the content.
  ownsContainerContent() {
    if (!this.container)
      return false;
    const owner = _JSDialogComponent.containerContentOwner.get(this.container);
    return !owner || owner === this.allowedJsonType;
  }
  /// records this component as the owner of the container content
  markContainerContentOwner() {
    if (this.container)
      _JSDialogComponent.containerContentOwner.set(this.container, this.allowedJsonType);
  }
  /// handle update message
  onJSUpdate(e) {
    const data = e.data;
    if (data.jsontype !== this.allowedJsonType)
      return false;
    if (!data.control.id) {
      app.console.debug('Missing "control.id" in update message');
      return false;
    }
    if (this.model)
      this.model.widgetUpdate(data.control);
    if (!this.container)
      return false;
    if (!this.builder)
      return false;
    app.console.debug("Component " + this.name + " handles update message: " + JSDialog.verbose ? this.model.safeStringify(data.control) : data.control.id);
    if (!this.ownsContainerContent())
      return false;
    this.builder.updateWidget(this.container, data.control);
    return true;
  }
  /// handle action message
  onJSAction(e) {
    const data = e.data;
    if (data.jsontype !== this.allowedJsonType)
      return false;
    if (!data.data.control_id) {
      app.console.debug('Missing "control_id" in action message');
      return false;
    }
    if (this.model)
      this.model.widgetAction(data);
    if (!this.builder)
      return false;
    if (!this.container)
      return false;
    app.console.debug("Component " + this.name + " handles action message: " + JSDialog.verbose ? this.model.safeStringify(data.data) : data.data.control_id);
    if (!this.ownsContainerContent())
      return false;
    this.builder.executeAction(() => this.container, data.data);
    return true;
  }
  // tabs related - JSBuilder might want to put tabs into component
  getTabs() {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setTabs(tabs) {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  showTabs() {
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  hideTabs() {
  }
  // customization
  /// shows item with given id and returns true if it was found
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  showItem(id, show) {
    return false;
  }
  /// hides item with given id and returns true if it was found
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  hideItem(id) {
    return false;
  }
};
_JSDialogComponent.containerContentOwner = /* @__PURE__ */ new WeakMap();
let JSDialogComponent = _JSDialogComponent;
