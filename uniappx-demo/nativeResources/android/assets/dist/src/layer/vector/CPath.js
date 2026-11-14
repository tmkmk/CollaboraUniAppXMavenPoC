const _CPath = class _CPath extends CEventsHandler {
  constructor(options) {
    super();
    this.name = "";
    this.stroke = true;
    this.color = "#3388ff";
    this.weight = 3;
    this.opacity = 1;
    this.lineCap = "round";
    this.lineJoin = "round";
    this.fill = false;
    this.fillGradient = false;
    this.fillColor = this.color;
    this.fillOpacity = 0.2;
    this.fillRule = "evenodd";
    this.interactive = true;
    this.fixed = false;
    this.thickness = 2;
    this.viewId = -1;
    this.groupType = PathGroupType.Other;
    this.radius = 0;
    this.radiusY = 0;
    this.zIndex = 0;
    this.isDeleted = false;
    this.renderer = null;
    this.underMouse = false;
    this.popupHandlersAdded = false;
    this.setStyleOptions(options);
    this.radius = options.radius !== void 0 ? options.radius : this.radius;
    this.radiusY = options.radiusY !== void 0 ? options.radiusY : this.radiusY;
    this.point = options.point !== void 0 ? options.point : this.point;
    this.toCompatUnits = options.toCompatUnits !== void 0 ? options.toCompatUnits : this.toCompatUnits;
    this.viewId = _CPath.getViewId(options);
    if (options.groupType !== void 0)
      this.groupType = options.groupType;
    _CPath.countObjects += 1;
    this.id = _CPath.countObjects;
    this.zIndex = this.id;
    this.addSupportedEvents(["popupopen", "popupclose"]);
  }
  static getViewId(options) {
    if (options.viewId === void 0 || options.viewId === null)
      return -1;
    else
      return parseInt(options.viewId);
  }
  setStyleOptions(options) {
    this.name = options.name !== void 0 ? options.name : this.name;
    this.stroke = options.stroke !== void 0 ? options.stroke : this.stroke;
    this.color = options.color !== void 0 ? options.color : this.color;
    this.weight = options.weight !== void 0 ? options.weight : this.weight;
    this.opacity = options.opacity !== void 0 ? options.opacity : this.opacity;
    this.lineCap = options.lineCap !== void 0 ? options.lineCap : this.lineCap;
    this.lineJoin = options.lineJoin !== void 0 ? options.lineJoin : this.lineJoin;
    this.fill = options.fill !== void 0 ? options.fill : this.fill;
    this.fillColor = options.fillColor !== void 0 ? options.fillColor : this.fillColor;
    this.fillOpacity = options.fillOpacity !== void 0 ? options.fillOpacity : this.fillOpacity;
    this.fillRule = options.fillRule !== void 0 ? options.fillRule : this.fillRule;
    this.cursorType = options.cursorType !== void 0 ? options.cursorType : this.cursorType;
    this.thickness = options.thickness !== void 0 ? options.thickness : this.thickness;
    this.interactive = options.interactive !== void 0 ? options.interactive : this.interactive;
    this.fixed = options.fixed !== void 0 ? options.fixed : this.fixed;
  }
  setRenderer(rendererObj) {
    this.renderer = rendererObj;
    if (this.renderer) {
      this.addPathTestDiv();
    }
    this.fire("add", {});
  }
  // Adds a div for cypress-tests (if active) for this CPath if not already done.
  addPathTestDiv() {
    var testContainer = this.renderer.getTestDiv();
    if (testContainer && !this.testDiv) {
      this.testDiv = document.createElement("div");
      this.testDiv.id = "test-div-overlay-" + this.name;
      testContainer.appendChild(this.testDiv);
    }
  }
  // Used by cypress tests to assert on the bounds of CPaths.
  updateTestData() {
    if (!this.testDiv)
      return;
    var bounds = this.getBounds();
    if (this.empty() || !bounds.isValid()) {
      this.testDiv.innerText = "{}";
      return;
    }
    var topLeft = bounds.getTopLeft();
    var size = bounds.getSize();
    this.testDiv.innerText = JSON.stringify({
      top: Math.round(topLeft.y),
      left: Math.round(topLeft.x),
      width: Math.round(size.x),
      height: Math.round(size.y)
    });
  }
  getId() {
    return this.id;
  }
  setDeleted() {
    this.fire("remove", {});
    this.isDeleted = true;
    if (this.testDiv) {
      this.testDiv.remove();
      this.testDiv = void 0;
    }
  }
  isUnderMouse() {
    return this.underMouse;
  }
  setUnderMouse(isUnder) {
    this.underMouse = isUnder;
  }
  onMouseEnter(position) {
    this.fire("mouseenter", { position });
  }
  onMouseLeave(position) {
    this.fire("mouseleave", { position });
  }
  redraw(oldBounds) {
    if (this.renderer)
      this.renderer.updatePath(this, oldBounds);
  }
  setStyle(style) {
    var oldBounds = this.getBounds();
    this.setStyleOptions(style);
    if (this.renderer) {
      this.renderer.updateStyle(this, oldBounds);
    }
  }
  updatePathAllPanes(paintArea) {
    if (this.fixed) {
      var fixedMapArea = this.renderer.getFixedBounds();
      this.updatePath(fixedMapArea, fixedMapArea);
      this.updateTestData();
      return;
    }
    var paneBoundsList = this.renderer.getPaneBoundsList();
    let maxXBound = 0;
    let maxYBound = 0;
    for (const paneBounds of paneBoundsList) {
      maxXBound = Math.max(maxXBound, paneBounds.min.x);
      maxYBound = Math.max(maxYBound, paneBounds.min.y);
    }
    for (var i = 0; i < paneBoundsList.length; ++i) {
      var panePaintArea = paintArea ? paintArea.clone() : paneBoundsList[i].clone();
      var paneArea = paneBoundsList[i];
      if (paintArea) {
        if (!paneArea.intersects(panePaintArea))
          continue;
        panePaintArea.min.x = Math.max(panePaintArea.min.x, paneArea.min.x);
        panePaintArea.min.y = Math.max(panePaintArea.min.y, paneArea.min.y);
        panePaintArea.max.x = Math.min(panePaintArea.max.x, paneArea.max.x);
        panePaintArea.max.y = Math.min(panePaintArea.max.y, paneArea.max.y);
      }
      let freezeX;
      let freezeY;
      if (paneArea.min.x === 0 && maxXBound !== 0) {
        freezeX = true;
      } else {
        freezeX = false;
      }
      if (paneArea.min.y === 0 && maxYBound !== 0) {
        freezeY = true;
      } else {
        freezeY = false;
      }
      this.updatePath(panePaintArea, paneArea, { freezeX, freezeY });
    }
    this.updateTestData();
  }
  updatePath(paintArea, paneBounds, freezePane) {
  }
  bringToFront() {
    if (this.renderer) {
      this.renderer.bringToFront(this);
    }
  }
  bringToBack() {
    if (this.renderer) {
      this.renderer.bringToBack(this);
    }
  }
  getBounds() {
    return void 0;
  }
  empty() {
    return true;
  }
  getParts() {
    return Array();
  }
  clickTolerance() {
    return (this.stroke ? this.weight / 2 : 0) + (window.touch.currentlyUsingTouchscreen() ? 10 : 0);
  }
  setCursorType(cursorType) {
    this.cursorType = cursorType;
  }
  onResize() {
  }
  getMap() {
    if (this.renderer) {
      return this.renderer.getMap();
    }
  }
};
_CPath.countObjects = 0;
let CPath = _CPath;
var PathGroupType;
(function(PathGroupType2) {
  PathGroupType2[PathGroupType2["CellSelection"] = 0] = "CellSelection";
  PathGroupType2[PathGroupType2["TextSelection"] = 1] = "TextSelection";
  PathGroupType2[PathGroupType2["CellCursor"] = 2] = "CellCursor";
  PathGroupType2[PathGroupType2["Other"] = 3] = "Other";
})(PathGroupType || (PathGroupType = {}));
class CPathGroup {
  constructor(paths) {
    this.paths = paths;
  }
  forEach(callback) {
    this.paths.forEach(callback);
  }
  push(path) {
    this.paths.push(path);
  }
}
