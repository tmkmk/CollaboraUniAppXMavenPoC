const _PaneSplitter = class _PaneSplitter {
  constructor(map) {
    this.pointerId = -1;
    this.startX = 0;
    this.startWidth = 0;
    this.startUpperLimit = 0;
    this.map = map;
    this.mainContent = document.getElementById("main-document-content");
    if (!this.mainContent)
      return;
    this.handle = this.createHandle();
    this.mainContent.appendChild(this.handle);
    this.updateAria();
  }
  // The divider is a vertical bar, so left and right resize it. A screen
  // reader announces it as a separator carrying the current width.
  createHandle() {
    return h("div", { class: "pane-splitter", role: "separator", "aria-orientation": "vertical", tabindex: "0", "aria-label": _("Resize panels"), onPointerDown: (e) => this.onPointerDown(e), onPointerMove: (e) => this.onPointerMove(e), onPointerUp: (e) => this.onPointerUp(e), onPointerCancel: (e) => this.onPointerUp(e), onDblClick: () => this.onDoubleClick(), onKeyDown: (e) => this.onKeyDown(e) });
  }
  // The panels are maximized, so the divider is on show and its moves
  // apply.
  isActive() {
    return this.map.paneExpander && this.map.paneExpander.getMode() === "expanded";
  }
  // The width the divider returns to on a double click, and the width it
  // reports before the first drag: an even split of the container.
  defaultWidth() {
    return Math.round(this.mainContent.getBoundingClientRect().width / 2);
  }
  currentWidth() {
    const value = this.mainContent.style.getPropertyValue(_PaneSplitter.PROPERTY_NAME);
    const parsed = parseFloat(value);
    return isNaN(parsed) ? this.defaultWidth() : parsed;
  }
  // The widest the navigation grid may get: the container less the minimum
  // the import grid keeps on the far side of the divider.
  upperLimit() {
    const available = this.mainContent.getBoundingClientRect().width;
    return Math.max(_PaneSplitter.MIN_WIDTH, available - _PaneSplitter.MIN_WIDTH);
  }
  // Update the layout to a new width, clamped between the grids' minimum
  // and the given upper limit.
  applyWidth(px, upper) {
    const clamped = Math.round(Math.max(_PaneSplitter.MIN_WIDTH, Math.min(upper, px)));
    this.mainContent.style.setProperty(_PaneSplitter.PROPERTY_NAME, clamped + "px");
    this.setAriaValues(_PaneSplitter.MIN_WIDTH, upper, clamped);
  }
  onPointerDown(e) {
    if (e.button > 0 || e.isPrimary === false)
      return;
    this.startX = e.clientX;
    this.startWidth = this.currentWidth();
    this.startUpperLimit = this.upperLimit();
    this.pointerId = e.pointerId;
    this.handle.setPointerCapture(e.pointerId);
    this.handle.classList.add("dragging");
    e.preventDefault();
  }
  onPointerMove(e) {
    if (this.pointerId !== e.pointerId)
      return;
    if (!this.isActive())
      return;
    const rtl = document.documentElement.dir === "rtl";
    const inlineDelta = (rtl ? -1 : 1) * (e.clientX - this.startX);
    this.applyWidth(this.startWidth + inlineDelta, this.startUpperLimit);
  }
  onPointerUp(e) {
    if (this.pointerId !== e.pointerId)
      return;
    if (this.handle.hasPointerCapture(e.pointerId))
      this.handle.releasePointerCapture(e.pointerId);
    this.pointerId = -1;
    this.handle.classList.remove("dragging");
  }
  // A double click puts the grids back to the even split.
  onDoubleClick() {
    this.applyWidth(this.defaultWidth(), this.upperLimit());
  }
  onKeyDown(e) {
    const rtl = document.documentElement.dir === "rtl";
    let inlineDelta = 0;
    if (e.key === "ArrowRight")
      inlineDelta = rtl ? -1 : 1;
    else if (e.key === "ArrowLeft")
      inlineDelta = rtl ? 1 : -1;
    else if (e.key === "Home") {
      this.applyWidth(_PaneSplitter.MIN_WIDTH, this.upperLimit());
      e.preventDefault();
      return;
    } else if (e.key === "End") {
      const upper = this.upperLimit();
      this.applyWidth(upper, upper);
      e.preventDefault();
      return;
    } else
      return;
    this.applyWidth(this.currentWidth() + inlineDelta * _PaneSplitter.KEY_STEP, this.upperLimit());
    e.preventDefault();
  }
  setAriaValues(min, max, now) {
    this.handle.setAttribute("aria-valuemin", String(min));
    this.handle.setAttribute("aria-valuemax", String(Math.round(max)));
    this.handle.setAttribute("aria-valuenow", String(Math.round(now)));
  }
  // Report the width the divider controls, so its position is spoken
  // correctly when the maximized layout brings it on show.
  updateAria() {
    if (!this.handle)
      return;
    this.setAriaValues(_PaneSplitter.MIN_WIDTH, this.upperLimit(), this.currentWidth());
  }
  // The expand mode changed; refresh the spoken position to match the
  // boundary the divider now sits on.
  onModeChange() {
    this.updateAria();
  }
};
_PaneSplitter.PROPERTY_NAME = "--expanded-navigation-width";
_PaneSplitter.MIN_WIDTH = 240;
_PaneSplitter.KEY_STEP = 16;
let PaneSplitter = _PaneSplitter;
