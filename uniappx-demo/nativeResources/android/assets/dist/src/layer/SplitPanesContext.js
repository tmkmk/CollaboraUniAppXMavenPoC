var cool;
(function(cool2) {
  const _SplitPanesContext = class _SplitPanesContext {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(docLayer) {
      console.assert(docLayer, "no docLayer!");
      console.assert(docLayer._map, "no map!");
      this._docLayer = docLayer;
      this._map = docLayer._map;
      this._setDefaults();
    }
    _setDefaults() {
      this._splitPos = new cool2.Point(0, 0);
    }
    get options() {
      return _SplitPanesContext.options;
    }
    getMaxSplitPosX() {
      const rawMax = Math.floor(app.sectionContainer.getWidth() * this.options.maxHorizontalSplitPercent / 100);
      return this._docLayer.getSnapDocPosX(rawMax);
    }
    getMaxSplitPosY() {
      const rawMax = Math.floor(app.sectionContainer.getHeight() * this.options.maxVerticalSplitPercent / 100);
      return this._docLayer.getSnapDocPosY(rawMax);
    }
    setSplitPos(splitX, splitY, forceUpdate = false) {
      var xchanged = this.setHorizSplitPos(
        splitX,
        forceUpdate,
        true
        /* noFire */
      );
      var ychanged = this.setVertSplitPos(
        splitY,
        forceUpdate,
        true
        /* noFire */
      );
      if (xchanged || ychanged) {
        this._map.fire("splitposchanged");
        const section = app.sectionContainer.getSectionWithName(app.CSections.Splitter.name);
        if (section) {
          section.setPosition(0, 0);
        }
      }
    }
    getSplitPos() {
      return this._splitPos.divideBy(app.dpiScale);
    }
    justifySplitPos(split, isHoriz) {
      if (split <= 0) {
        return 0;
      }
      var maxSplitPos = isHoriz ? this.getMaxSplitPosX() : this.getMaxSplitPosY();
      if (split >= maxSplitPos) {
        return maxSplitPos;
      }
      return isHoriz ? this._docLayer.getSnapDocPosX(split) : this._docLayer.getSnapDocPosY(split);
    }
    setHorizSplitPos(splitX, forceUpdate, noFire) {
      console.assert(typeof splitX === "number", "splitX must be a number");
      if (this._splitPos.x === splitX) {
        return false;
      }
      var changed = false;
      var newX = this.justifySplitPos(
        splitX,
        true
        /* isHoriz */
      );
      if (newX !== this._splitPos.x) {
        this._splitPos.x = newX;
        changed = true;
      }
      app.calc.splitCoordinate.pX = newX;
      if (!noFire)
        this._map.fire("splitposchanged");
      return changed;
    }
    setVertSplitPos(splitY, forceUpdate, noFire) {
      console.assert(typeof splitY === "number", "splitY must be a number");
      if (this._splitPos.y === splitY) {
        return false;
      }
      var changed = false;
      var newY = this.justifySplitPos(
        splitY,
        false
        /* isHoriz */
      );
      if (newY !== this._splitPos.y) {
        this._splitPos.y = newY;
        changed = true;
      }
      app.calc.splitCoordinate.pY = newY;
      if (!noFire)
        this._map.fire("splitposchanged");
      return changed;
    }
    getPanesProperties() {
      var paneStatusList = [];
      if (this._splitPos.x && this._splitPos.y) {
        paneStatusList.push({
          xFixed: true,
          yFixed: true
        });
      }
      if (this._splitPos.y) {
        paneStatusList.push({
          xFixed: false,
          yFixed: true
        });
      }
      if (this._splitPos.x) {
        paneStatusList.push({
          xFixed: true,
          yFixed: false
        });
      }
      paneStatusList.push({
        xFixed: false,
        yFixed: false
      });
      return paneStatusList;
    }
    // When view is split by horizontal and/or vertical line(s), there are up to 4 different parts of the file visible on the screen.
    // This function returns the viewed parts' coordinates as simple rectangles.
    getViewRectangles() {
      const viewRectangles = new Array();
      viewRectangles.push(app.activeDocument.activeLayout.viewedRectangle.clone());
      if (this._splitPos.x) {
        viewRectangles[0].pX1 = 0;
        viewRectangles[0].pX2 = this._splitPos.x;
        const topRightPane = app.activeDocument.activeLayout.viewedRectangle.clone();
        const width = app.activeDocument.activeLayout.viewedRectangle.pWidth - viewRectangles[0].pWidth;
        topRightPane.pX1 = app.activeDocument.activeLayout.viewedRectangle.pX2 - width;
        topRightPane.pWidth = width;
        viewRectangles.push(topRightPane);
      }
      if (this._splitPos.y) {
        viewRectangles[0].pY1 = 0;
        viewRectangles[0].pY2 = this._splitPos.y;
        const bottomLeftPane = app.activeDocument.activeLayout.viewedRectangle.clone();
        const height = app.activeDocument.activeLayout.viewedRectangle.pHeight - viewRectangles[0].pHeight;
        bottomLeftPane.pY1 = app.activeDocument.activeLayout.viewedRectangle.pY2 - height;
        bottomLeftPane.pHeight = height;
        viewRectangles.push(bottomLeftPane);
      }
      if (this._splitPos.x && this._splitPos.y) {
        viewRectangles[1].pY1 = 0;
        viewRectangles[1].pY2 = this._splitPos.y;
        viewRectangles[2].pX1 = 0;
        viewRectangles[2].pX2 = this._splitPos.x;
        const bottomRightPane = app.activeDocument.activeLayout.viewedRectangle.clone();
        const width = app.activeDocument.activeLayout.viewedRectangle.pWidth - viewRectangles[0].pWidth;
        const height = app.activeDocument.activeLayout.viewedRectangle.pHeight - viewRectangles[0].pHeight;
        bottomRightPane.pX1 = app.activeDocument.activeLayout.viewedRectangle.pX2 - width;
        bottomRightPane.pWidth = width;
        bottomRightPane.pY1 = app.activeDocument.activeLayout.viewedRectangle.pY2 - height;
        bottomRightPane.pHeight = height;
        viewRectangles.push(bottomRightPane);
      }
      return viewRectangles;
    }
    // returns all the pane rectangles for the provided full-map area (all in core pixels).
    getPxBoundList(pxBounds) {
      if (!pxBounds) {
        const vr = app.activeDocument.activeLayout.viewedRectangle;
        pxBounds = new cool2.Bounds(new cool2.Point(vr.pX1, vr.pY1), new cool2.Point(vr.pX1 + vr.pWidth, vr.pY1 + vr.pHeight));
      }
      var topLeft = pxBounds.getTopLeft();
      var bottomRight = pxBounds.getBottomRight();
      var boundList = [];
      if (this._splitPos.x && this._splitPos.y) {
        boundList.push(new cool2.Bounds(new cool2.Point(0, 0), this._splitPos));
      }
      if (this._splitPos.y) {
        boundList.push(new cool2.Bounds(new cool2.Point(topLeft.x + this._splitPos.x, 0), new cool2.Point(bottomRight.x, this._splitPos.y)));
      }
      if (this._splitPos.x) {
        boundList.push(new cool2.Bounds(new cool2.Point(0, topLeft.y + this._splitPos.y), new cool2.Point(this._splitPos.x, bottomRight.y)));
      }
      if (!boundList.length) {
        boundList.push(new cool2.Bounds(topLeft, bottomRight));
      } else {
        boundList.push(new cool2.Bounds(topLeft.add(this._splitPos), bottomRight));
      }
      return boundList;
    }
    intersectsVisible(areaPx) {
      const vr = app.activeDocument.activeLayout.viewedRectangle;
      var pixBounds = new cool2.Bounds(new cool2.Point(vr.pX1, vr.pY1), new cool2.Point(vr.pX1 + vr.pWidth, vr.pY1 + vr.pHeight));
      var boundList = this.getPxBoundList(pixBounds);
      for (var i = 0; i < boundList.length; ++i) {
        if (areaPx.intersects(boundList[i])) {
          return true;
        }
      }
      return false;
    }
  };
  _SplitPanesContext.options = {
    maxHorizontalSplitPercent: 70,
    maxVerticalSplitPercent: 70
  };
  let SplitPanesContext = _SplitPanesContext;
  cool2.SplitPanesContext = SplitPanesContext;
})(cool || (cool = {}));
