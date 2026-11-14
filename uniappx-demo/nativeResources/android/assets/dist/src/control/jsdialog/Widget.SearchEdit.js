const _SearchEditWidget = class _SearchEditWidget extends EditWidget {
  constructor(parentContainer, data, builder, callback) {
    super(parentContainer, data, builder, callback);
    this.lastViewportHeight = 0;
    this.lastViewportWidth = 0;
    this.tallestViewportHeight = 0;
  }
  onSearchInput() {
    this.updateSearchButtons();
    if (window.L.Map.THIS.getDocType() === "text") {
      app.searchService.search(
        this.edit.input.value,
        false,
        "",
        0,
        true
        /* expand search */
      );
    }
  }
  onSearchKeyDown(e) {
    var entry = this.edit.input;
    if (e.keyCode === 71 && e.ctrlKey || e.keyCode === 114 || e.keyCode === 13) {
      if (e.shiftKey) {
        app.searchService.search(entry.value, true);
      } else {
        app.searchService.search(entry.value);
      }
      e.preventDefault();
    } else if (e.ctrlKey && e.keyCode === 70) {
      entry.focus();
      entry.select();
      e.preventDefault();
    } else if (e.keyCode === 27) {
      window.L.Map.THIS.cancelSearch();
    }
  }
  onSearchFocus() {
    window.L.Map.THIS.fire("searchstart");
    this.updateSearchButtons();
  }
  onSearchBlur() {
    if (window.mode.isSmallScreenDevice())
      return;
    window.L.Map.THIS._onGotFocus();
  }
  onViewportResize() {
    const viewport = window.visualViewport;
    if (!viewport)
      return;
    const rotated = viewport.width !== this.lastViewportWidth;
    const grown = viewport.height > this.lastViewportHeight;
    this.lastViewportHeight = viewport.height;
    this.lastViewportWidth = viewport.width;
    if (rotated) {
      this.tallestViewportHeight = viewport.height;
      return;
    }
    this.tallestViewportHeight = Math.max(this.tallestViewportHeight, viewport.height);
    const fullHeight = viewport.height >= this.tallestViewportHeight - _SearchEditWidget.fullHeightTolerance;
    const focused = document.activeElement === this.edit.input;
    if (grown && fullHeight && focused)
      this.edit.input.blur();
  }
  updateSearchButtons() {
    var toolbar = window.mode.isSmallScreenDevice() ? app.map.mobileSearchBar : app.map.statusBar;
    if (!toolbar) {
      console.debug("Cannot find search bar");
      return;
    }
    if (this.edit.input.value === "") {
      toolbar.enableItem("searchprev", false);
      toolbar.enableItem("searchnext", false);
      if (window.mode.isSmallScreenDevice()) {
        toolbar.enableItem("cancelsearch", false);
      } else {
        toolbar.showItem("cancelsearch", false);
      }
    } else {
      toolbar.enableItem("searchprev", true);
      toolbar.enableItem("searchnext", true);
      if (window.mode.isSmallScreenDevice()) {
        toolbar.enableItem("cancelsearch", true);
      } else {
        toolbar.showItem("cancelsearch", true);
      }
    }
  }
  setupEventListeners() {
    super.setupEventListeners();
    this.edit.input.addEventListener("input", this.onSearchInput.bind(this));
    this.edit.input.addEventListener("keydown", this.onSearchKeyDown.bind(this));
    this.edit.input.addEventListener("focus", this.onSearchFocus.bind(this));
    this.edit.input.addEventListener("blur", this.onSearchBlur.bind(this));
    const viewport = window.visualViewport;
    if (window.mode.isSmallScreenDevice() && viewport) {
      this.lastViewportHeight = viewport.height;
      this.lastViewportWidth = viewport.width;
      this.tallestViewportHeight = viewport.height;
      if (_SearchEditWidget.viewportResizeHandler)
        viewport.removeEventListener("resize", _SearchEditWidget.viewportResizeHandler);
      _SearchEditWidget.viewportResizeHandler = this.onViewportResize.bind(this);
      viewport.addEventListener("resize", _SearchEditWidget.viewportResizeHandler);
    }
  }
};
_SearchEditWidget.viewportResizeHandler = null;
_SearchEditWidget.fullHeightTolerance = 4;
let SearchEditWidget = _SearchEditWidget;
JSDialog.searchEdit = function(parentContainer, data, builder, callback) {
  const widget = new SearchEditWidget(parentContainer, data, builder, callback);
  return widget.build();
};
