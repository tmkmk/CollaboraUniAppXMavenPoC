const NSS_SVG = "http://www.w3.org/2000/svg";
var PropertyValueType;
(function(PropertyValueType2) {
  PropertyValueType2[PropertyValueType2["Unknown"] = 0] = "Unknown";
  PropertyValueType2[PropertyValueType2["Number"] = 1] = "Number";
  PropertyValueType2[PropertyValueType2["Enum"] = 2] = "Enum";
  PropertyValueType2[PropertyValueType2["Color"] = 3] = "Color";
  PropertyValueType2[PropertyValueType2["String"] = 4] = "String";
  PropertyValueType2[PropertyValueType2["Bool"] = 5] = "Bool";
  PropertyValueType2[PropertyValueType2["TupleNumber"] = 6] = "TupleNumber";
})(PropertyValueType || (PropertyValueType = {}));
var PropertyOperators;
(function(PropertyOperators2) {
  const GenericPropOpSet = {
    equal: (a, b) => {
      return a === b;
    },
    add: (a, b) => {
      return a;
    },
    scale: (k, v) => {
      return v;
    }
  };
  const NumberPropOpSet = {
    equal: (a, b) => {
      return a === b;
    },
    add: (a, b) => {
      return a + b;
    },
    scale: (k, v) => {
      return k * v;
    }
  };
  const TupleNumberPropOpSet = {
    equal: (a, b) => {
      assert(a.length === b.length, "Tuples length mismatch.");
      return a.toString() === b.toString();
    },
    add: (a, b) => {
      assert(a.length === b.length, "Tuples length mismatch.");
      const r = [];
      for (let i = 0; i < a.length; ++i) {
        r.push(a[i] + b[i]);
      }
      return r;
    },
    scale: (k, v) => {
      const r = [];
      for (let i = 0; i < v.length; ++i) {
        r.push(k * v[i]);
      }
      return r;
    }
  };
  const ColorPropOpSet = {
    equal: (a, b) => {
      return a.equal(b);
    },
    add: (a, b) => {
      const c = a.clone();
      c.add(b);
      return c;
    },
    scale: (k, v) => {
      const c = v.clone();
      c.scale(k);
      return c;
    }
  };
  PropertyOperators2.aOperatorSetMap = /* @__PURE__ */ new Map();
  PropertyOperators2.aOperatorSetMap.set(PropertyValueType.Number, NumberPropOpSet);
  PropertyOperators2.aOperatorSetMap.set(PropertyValueType.Enum, GenericPropOpSet);
  PropertyOperators2.aOperatorSetMap.set(PropertyValueType.String, GenericPropOpSet);
  PropertyOperators2.aOperatorSetMap.set(PropertyValueType.Bool, GenericPropOpSet);
  PropertyOperators2.aOperatorSetMap.set(PropertyValueType.TupleNumber, TupleNumberPropOpSet);
  PropertyOperators2.aOperatorSetMap.set(PropertyValueType.Color, ColorPropOpSet);
})(PropertyOperators || (PropertyOperators = {}));
const aOperatorSetMap = PropertyOperators.aOperatorSetMap;
var PropertyInterpolator;
(function(PropertyInterpolator2) {
  function getInterpolator(eValueType, eValueSubType, eClockDirection) {
    switch (eValueType) {
      case PropertyValueType.Number:
        return (nFrom, nTo, nT) => {
          return (1 - nT) * nFrom + nT * nTo;
        };
      case PropertyValueType.TupleNumber:
        return (aFrom, aTo, nT) => {
          const aRes = [];
          for (let i = 0; i < aFrom.length; ++i) {
            aRes.push((1 - nT) * aFrom[i] + nT * aTo[i]);
          }
          return aRes;
        };
      case PropertyValueType.Color:
        if (eValueSubType !== void 0) {
          switch (eValueSubType) {
            case ColorSpace.rgb:
              return (nFrom, nTo, nT) => {
                return RGBColor.interpolate(nFrom, nTo, nT);
              };
            case ColorSpace.hsl: {
              const bCCW = eClockDirection == ClockDirection.counterClockwise;
              return (nFrom, nTo, nT) => {
                return HSLColor.interpolate(nFrom, nTo, nT, bCCW);
              };
            }
          }
        } else {
          window.app.console.log("PropertyInterpolator.getInterpolator: color space not defined.");
        }
        break;
      default:
        window.app.console.log("PropertyInterpolator.getInterpolator: not found any valid interpolator for value type " + PropertyValueType[eValueType]);
    }
    return null;
  }
  PropertyInterpolator2.getInterpolator = getInterpolator;
})(PropertyInterpolator || (PropertyInterpolator = {}));
const aPropertyGetterSetterMap = {
  height: {
    type: PropertyValueType.Number,
    get: "getHeight",
    set: "setHeight",
    getmod: (nWidth, nHeight) => makeScaler(1 / nHeight),
    setmod: (nWidth, nHeight) => makeScaler(nHeight)
  },
  opacity: {
    type: PropertyValueType.Number,
    get: "getOpacity",
    set: "setOpacity"
  },
  scale: {
    type: PropertyValueType.TupleNumber,
    get: "getSize",
    set: "setSize"
  },
  translate: {
    type: PropertyValueType.TupleNumber,
    get: "getPos",
    set: "setPos"
  },
  rotate: {
    type: PropertyValueType.Number,
    get: "getRotationAngle",
    set: "setRotationAngle"
  },
  skewx: {
    type: PropertyValueType.Number,
    get: "getSkewX",
    set: "setSkewX"
  },
  skewy: {
    type: PropertyValueType.Number,
    get: "getSkewY",
    set: "setSkewY"
  },
  width: {
    type: PropertyValueType.Number,
    get: "getWidth",
    set: "setWidth",
    getmod: (nWidth, nHeight) => makeScaler(1 / nWidth),
    setmod: (nWidth, nHeight) => makeScaler(nWidth)
  },
  x: {
    type: PropertyValueType.Number,
    get: "getX",
    set: "setX",
    getmod: (nWidth, nHeight) => makeScaler(1 / nWidth),
    setmod: (nWidth, nHeight) => makeScaler(nWidth)
  },
  y: {
    type: PropertyValueType.Number,
    get: "getY",
    set: "setY",
    getmod: (nWidth, nHeight) => makeScaler(1 / nHeight),
    setmod: (nWidth, nHeight) => makeScaler(nHeight)
  },
  visibility: {
    type: PropertyValueType.Enum,
    get: "getVisibility",
    set: "setVisibility"
  },
  fillstyle: {
    type: PropertyValueType.String,
    get: "getFillStyle",
    set: "setFillStyle"
  },
  linestyle: {
    type: PropertyValueType.String,
    get: "getLineStyle",
    set: "setLineStyle"
  },
  fillcolor: {
    type: PropertyValueType.Color,
    get: "getFillColor",
    set: "setFillColor"
  },
  linecolor: {
    type: PropertyValueType.Color,
    get: "getStrokeColor",
    set: "setStrokeColor"
  },
  charcolor: {
    type: PropertyValueType.Color,
    get: "getFontColor",
    set: "setFontColor"
  },
  charheight: {
    type: PropertyValueType.Number,
    get: "getFontScale",
    set: "setFontScale"
  },
  charweight: {
    type: PropertyValueType.String,
    get: "getFontWeight",
    set: "setFontWeight"
  },
  charposture: {
    type: PropertyValueType.String,
    get: "getFontPosture",
    set: "setFontPosture"
  },
  charunderline: {
    type: PropertyValueType.String,
    get: "getFontUnderline",
    set: "setFontUnderline"
  },
  charfontname: {
    type: PropertyValueType.String,
    get: "getFontName",
    set: "setFontName"
  },
  dimcolor: {
    type: PropertyValueType.Color,
    get: "getDimColor",
    set: "setDimColor"
  }
};
class TransitionFiltersManager {
  constructor() {
    this.filterQueue = new Array();
    this.frameInfoMap = /* @__PURE__ */ new Map();
  }
  isEmpty() {
    return this.filterQueue.length === 0;
  }
  add(animation, time) {
    this.frameInfoMap.set(animation.getNodeId(), {
      animation,
      time
    });
    this.updateQueue(animation.getNodeId());
  }
  updateQueue(nodeId) {
    const length = this.filterQueue.length;
    const last = this.filterQueue[length];
    if (nodeId === last)
      return;
    const index = this.filterQueue.indexOf(nodeId);
    if (index > -1) {
      this.filterQueue.splice(index, 1);
    }
    this.filterQueue.push(nodeId);
  }
  apply(properties) {
    let applied = false;
    this.filterQueue.forEach((nodeId) => {
      const frameInfo = this.frameInfoMap.get(nodeId);
      if (frameInfo) {
        applied = true;
        ANIMDBG.print(`TransitionFiltersManager.apply: node: ${nodeId}`);
        frameInfo.animation.renderFrame(frameInfo.time, properties);
      }
    });
    return applied;
  }
  /// The last performed frame of a transition filter, or undefined.
  getLastFrame() {
    const nodeId = this.filterQueue[this.filterQueue.length - 1];
    return nodeId === void 0 ? void 0 : this.frameInfoMap.get(nodeId);
  }
  clear() {
    this.frameInfoMap.forEach((frameInfo) => {
      frameInfo.animation.notifySlideEnd();
    });
    this.filterQueue = [];
    this.frameInfoMap.clear();
  }
  getState() {
    return {
      filterQueue: structuredClone(this.filterQueue),
      frameInfoMap: new Map(this.frameInfoMap)
    };
  }
  setState(state) {
    this.filterQueue = structuredClone(state.filterQueue);
    this.frameInfoMap = new Map(state.frameInfoMap);
  }
}
function BBoxToString(aBB) {
  return `{ x: ${aBB.x}, y: ${aBB.y}, width: ${aBB.width}, height: ${aBB.height} }`;
}
const _AnimatedElement = class _AnimatedElement {
  constructor(sId, slideHash, title, slideWidth, slideHeight) {
    this.aBaseBBox = null;
    this.nBaseCenterX = 0;
    this.nBaseCenterY = 0;
    this.eAdditiveMode = AdditiveMode.Replace;
    this.aStateSet = /* @__PURE__ */ new Map();
    this.aStateOnNextEffectSet = /* @__PURE__ */ new Map();
    this.nScaleFactorX = 1;
    this.nScaleFactorY = 1;
    this.nRotationAngle = 0;
    this.nSkewX = 0;
    this.nSkewY = 0;
    this.aBaseFillColor = _AnimatedElement.DefaultColor;
    this.aFillColor = _AnimatedElement.DefaultColor;
    this.aBaseLineColor = _AnimatedElement.DefaultColor;
    this.aLineColor = _AnimatedElement.DefaultColor;
    this.aBaseFontColor = _AnimatedElement.DefaultColor;
    this.aFontColor = _AnimatedElement.DefaultColor;
    this.aDimColor = _AnimatedElement.DefaultColor;
    this.aFontLook = _AnimatedElement.ownFontLook();
    this.bInitiallyVisible = true;
    this.aClipPath = null;
    this.runningAnimations = 0;
    this.activeAnimationNodes = /* @__PURE__ */ new Map();
    ANIMDBG.print(`AnimatedElement(${sId}, ${slideHash})`);
    this.sId = sId;
    this.slideHash = slideHash;
    this._title = title;
    this.slideWidth = slideWidth;
    this.slideHeight = slideHeight;
    this.bIsValid = false;
    this.transitionFiltersManager = new TransitionFiltersManager();
    const presenter = app.map.slideShowPresenter;
    this.slideRenderer = presenter._slideRenderer;
  }
  getId() {
    return this.sId;
  }
  isValid() {
    return this.bIsValid;
  }
  getTitle() {
    return this._title;
  }
  isTextElement() {
    return false;
  }
  cloneBBox(aBBox) {
    if (!aBBox)
      return null;
    return new DOMRect(aBBox.x, aBBox.y, aBBox.width, aBBox.height);
  }
  // The rectangle of the target on the slide, in twips. Every transform is
  // relative to it.
  setBaseBBox(aBounds) {
    this.aBaseBBox = this.cloneBBox(aBounds);
    ({ x: this.nBaseCenterX, y: this.nBaseCenterY } = getRectCenter(this.aBaseBBox));
  }
  updateCanvasSize(size) {
    this.canvasWidth = size[0];
    this.canvasHeight = size[1];
    this.canvasScaleFactor = {
      x: this.canvasWidth / this.slideWidth,
      y: this.canvasHeight / this.slideHeight
    };
    app.console.debug(`AnimatedElement.updateCanvasSize: (${this.canvasWidth}x${this.canvasHeight}), scale factor: ${this.canvasScaleFactor}`);
  }
  // Fetch the base rectangle, base colors and content at slide start. The
  // base has no content and keeps a placeholder rectangle.
  updateContentInfo() {
    this.aBaseBBox = new DOMRect(0, 0, 1920, 1080);
    window.app.console.log("AnimatedElement.updateContentInfo: no content available");
  }
  // Fetch the content again for an element that had none at slide start.
  // The state starts over from the new base. True when there is content.
  refreshContent() {
    if (this.bIsValid)
      return true;
    this.updateContentInfo();
    if (!this.bIsValid)
      return false;
    this.resetProperties();
    return true;
  }
  setInitialVisibility(bVisible) {
    this.bInitiallyVisible = bVisible;
  }
  // The visibility at slide start.
  getInitialVisibility() {
    return this.bInitiallyVisible;
  }
  // Take the content from a newly delivered shape layer. The base has none.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  updateAnimationInfo(_animatedLayerInfo) {
  }
  // Draw the current state into the layer compose. The base draws nothing.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  renderLayer(_renderer) {
  }
  // Give a shape transition filter its rendering context and texture. The
  // base has neither.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setTransitionParameters(_transitionParameters) {
  }
  resetProperties() {
    this.nCenterX = this.nBaseCenterX;
    this.nCenterY = this.nBaseCenterY;
    this.nScaleFactorX = 1;
    this.nScaleFactorY = 1;
    this.nRotationAngle = 0;
    this.nSkewX = 0;
    this.nSkewY = 0;
    this.aTMatrix = new DOMMatrix([1, 0, 0, 1, 0, 0]);
    this.nOpacity = 1;
    this.aFillColor = this.aBaseFillColor;
    this.aLineColor = this.aBaseLineColor;
    this.aFontColor = this.aBaseFontColor;
    this.aFontLook = _AnimatedElement.ownFontLook();
    this.bVisible = this.getInitialVisibility();
    this.transitionFiltersManager.clear();
  }
  initClipPath() {
    this.aClipPath = document.createElementNS(NSS_SVG, "path");
    const nWidth = this.aActiveBBox.width;
    const nHeight = this.aActiveBBox.height;
    const sPathData = "M " + this.aActiveBBox.x + " " + this.aActiveBBox.y + " h " + nWidth + " v " + nHeight + " h -" + nWidth + " z";
    this.aClipPath.setAttribute("d", sPathData);
  }
  cleanClipPath() {
    this.aClipPath = null;
  }
  // The current state for a renderer: the transformed base rectangle in
  // slide-relative unit coordinates, the opacity and the color map.
  getRenderProperties() {
    const T = this.aTMatrix;
    const tl = new DOMPoint(this.aBaseBBox.x, this.aBaseBBox.y);
    const br = new DOMPoint(tl.x + this.aBaseBBox.width, tl.y + this.aBaseBBox.height);
    const bl = new DOMPoint(tl.x, br.y);
    const tr = new DOMPoint(br.x, tl.y);
    const unitBounds = [];
    for (const v of [bl, br, tl, tr]) {
      const u = v.matrixTransform(T);
      u.x = u.x / this.slideWidth;
      u.y = u.y / this.slideHeight;
      unitBounds.push(u);
    }
    return {
      bounds: unitBounds,
      alpha: this.nOpacity,
      colorMap: this.getColorMap()
    };
  }
  /// How the target is drawn now: left out while hidden, else under the
  /// element's transform, opacity, colors and text look, clipped by the
  /// last transition filter.
  getDrawState() {
    if (!this.getVisibility())
      return { hidden: true };
    const state = {};
    const transform = this.getTransformMatrix();
    if (transform && !transform.isIdentity)
      state.transform = [
        transform.a,
        transform.b,
        transform.c,
        transform.d,
        transform.e,
        transform.f
      ];
    let opacity = this.getOpacity() ?? 1;
    const filterFrame = this.getTransitionFilterFrame();
    if (filterFrame) {
      const mask = new ShapeTransitionMask(filterFrame.info);
      if (mask.hasArea()) {
        const clip = mask.clipAt(filterFrame.time, this.getBaseBBox());
        if (clip)
          state.clip = clip;
      } else {
        opacity *= mask.fadeAt(filterFrame.time);
      }
    }
    if (opacity < 1)
      state.alpha = opacity;
    const colorOverride = this.getColorOverride();
    if (colorOverride)
      state.colorOverride = colorOverride;
    const textOverride = this.getTextOverride();
    if (textOverride)
      state.textOverride = textOverride;
    return state;
  }
  // The text look of a font animation on the target, or undefined.
  getTextOverride() {
    const look = this.getFontLook();
    const override = {};
    if (look.scale !== 1)
      override.sizeScale = look.scale;
    const weight = Number(look.weight);
    if (look.weight !== "" && Number.isFinite(weight))
      override.weight = weight;
    if (look.posture)
      override.italic = look.posture !== "normal";
    if (look.underline)
      override.underline = look.underline !== "none";
    if (look.name)
      override.family = look.name;
    return Object.keys(override).length ? override : void 0;
  }
  // The colors a color animation has moved, or undefined. A shape element
  // carries fill and line, a text element its font color in the fill
  // slot. Both are named once either moved, so only a color that differs
  // from its base stands in.
  getColorOverride() {
    const colorMap = this.getColorMap();
    const fillMoved = colorMap.toFillColor && !(colorMap.fromFillColor && colorMap.toFillColor.equal(colorMap.fromFillColor));
    const lineMoved = colorMap.toLineColor && !(colorMap.fromLineColor && colorMap.toLineColor.equal(colorMap.fromLineColor));
    if (!fillMoved && !lineMoved)
      return void 0;
    if (this.isTextElement())
      return { text: colorMap.toFillColor.toString(true) };
    const override = {};
    if (fillMoved)
      override.fill = colorMap.toFillColor.toString(true);
    if (lineMoved)
      override.stroke = colorMap.toLineColor.toString(true);
    return override;
  }
  // The colors a color animation changed, as pairs of base color and
  // current color. Empty when none changed.
  getColorMap() {
    const colorMap = {};
    if (this.isTextElement()) {
      if (!this.aFontColor.equal(this.aBaseFontColor)) {
        colorMap.fromFillColor = this.aBaseFontColor;
        colorMap.toFillColor = this.aFontColor;
      }
    } else if (!this.aFillColor.equal(this.aBaseFillColor) || !this.aLineColor.equal(this.aBaseLineColor)) {
      colorMap.fromFillColor = this.aBaseFillColor;
      colorMap.toFillColor = this.aFillColor;
      colorMap.fromLineColor = this.aBaseLineColor;
      colorMap.toLineColor = this.aLineColor;
    }
    return colorMap;
  }
  notifySlideStart(aSlideShowContext) {
    if (!aSlideShowContext) {
      window.app.console.log("AnimatedElement.notifySlideStart: slideshow context is not valid");
    }
    this.aSlideShowContext = aSlideShowContext;
    this.runningAnimations = 0;
    this.activeAnimationNodes.clear();
    this.nCurrentEffect = void 0;
    this.aStateOnNextEffectSet.clear();
    this.updateContentInfo();
    this.resetProperties();
    this.DBG(".notifySlideStart invoked");
  }
  notifySlideEnd() {
    this.transitionFiltersManager.clear();
  }
  notifyAnimationStart() {
    if (!this.isActive()) {
      this.slideRenderer.notifyAnimationStarted(this.sId);
    }
    ++this.runningAnimations;
  }
  isActive() {
    return this.runningAnimations > 0;
  }
  notifyAnimationEnd() {
    if (this.runningAnimations <= 0) {
      window.app.console.log("AnimatedElement.notifyAnimationEnd: running animations <= 0");
      return;
    }
    --this.runningAnimations;
    if (!this.isActive()) {
      this.slideRenderer.notifyAnimationEnded(this.sId);
    }
  }
  notifyNextEffectStart(nEffectIndex) {
    this.nCurrentEffect = nEffectIndex;
    this.activeAnimationNodes.set(this.nCurrentEffect, /* @__PURE__ */ new Set());
  }
  /** saveState
   *  Save the state of the managed animated element and append it to aStateSet
   *  using the passed animation node id as key.
   *
   *  @param nAnimationNodeId
   *      A non negative integer representing the unique id of an animation node.
   */
  saveState(nAnimationNodeId) {
    ANIMDBG.print("AnimatedElement(" + this.getId() + ").saveState(" + nAnimationNodeId + ")");
    const aState = {
      nCenterX: this.nCenterX,
      nCenterY: this.nCenterY,
      nScaleFactorX: this.nScaleFactorX,
      nScaleFactorY: this.nScaleFactorY,
      nRotationAngle: this.nRotationAngle,
      nSkewX: this.nSkewX,
      nSkewY: this.nSkewY,
      aTMatrix: DOMMatrix.fromMatrix(this.aTMatrix),
      nOpacity: this.nOpacity,
      aFillColor: this.aFillColor,
      aLineColor: this.aLineColor,
      aFontColor: this.aFontColor,
      aFontLook: { ...this.aFontLook },
      bVisible: this.bVisible,
      transitionFiltersState: this.transitionFiltersManager.getState()
    };
    this.aStateSet.set(nAnimationNodeId, aState);
    const currentEffectNodes = this.activeAnimationNodes.get(this.nCurrentEffect);
    if (currentEffectNodes) {
      currentEffectNodes.add(nAnimationNodeId);
      if (currentEffectNodes.size === 1)
        this.aStateOnNextEffectSet.set(this.nCurrentEffect, aState);
    } else {
      window.app.console.log(`AnimatedElement(${this.getId()}).saveState(${nAnimationNodeId}): current effect not found: ${this.nCurrentEffect}`);
    }
  }
  /** restoreState
   *  Restore the state of the managed animated element to the state with key
   *  the passed animation node id.
   *
   *  @param nAnimationNodeId
   *      A non negative integer representing the unique id of an animation node.
   *
   *  @return
   *      True if the restoring operation is successful, false otherwise.
   */
  restoreState(nAnimationNodeId) {
    if (!this.aStateSet.has(nAnimationNodeId)) {
      window.app.console.log("AnimatedElement(" + this.getId() + ").restoreState: state " + nAnimationNodeId + " is not valid");
      return false;
    }
    ANIMDBG.print("AnimatedElement(" + this.getId() + ").restoreState(" + nAnimationNodeId + ")");
    let aState = this.aStateSet.get(nAnimationNodeId);
    this.activeAnimationNodes.forEach((nodes, effect, map) => {
      if (nodes.has(nAnimationNodeId)) {
        nodes.delete(nAnimationNodeId);
        if (nodes.size === 0) {
          map.delete(effect);
          const state = this.aStateOnNextEffectSet.get(effect);
          if (state)
            aState = state;
          this.aStateOnNextEffectSet.delete(effect);
        }
        return;
      }
    });
    const bRet = true;
    if (bRet) {
      this.nCenterX = aState.nCenterX;
      this.nCenterY = aState.nCenterY;
      this.nScaleFactorX = aState.nScaleFactorX;
      this.nScaleFactorY = aState.nScaleFactorY;
      this.nRotationAngle = aState.nRotationAngle;
      this.nSkewX = aState.nSkewX;
      this.nSkewY = aState.nSkewY;
      this.aTMatrix = DOMMatrix.fromMatrix(aState.aTMatrix);
      this.nOpacity = aState.nOpacity;
      this.aFillColor = aState.aFillColor;
      this.aLineColor = aState.aLineColor;
      this.aFontColor = aState.aFontColor;
      this.aFontLook = { ...aState.aFontLook };
      this.bVisible = aState.bVisible;
      this.transitionFiltersManager.setState(aState.transitionFiltersState);
    }
    this.aStateSet.delete(nAnimationNodeId);
    this.notifyAnimationStart();
    this.notifyAnimationEnd();
    return bRet;
  }
  getBaseBBox() {
    return this.aBaseBBox;
  }
  // The current transform, in slide coordinates, about the base center.
  getTransformMatrix() {
    return this.aTMatrix;
  }
  getBaseCenterX() {
    return this.nBaseCenterX;
  }
  getBaseCenterY() {
    return this.nBaseCenterY;
  }
  applyTransform() {
  }
  getAdditiveMode() {
    return this.eAdditiveMode;
  }
  setAdditiveMode(eAdditiveMode) {
    this.eAdditiveMode = eAdditiveMode;
  }
  updateTransformationMatrix() {
    const aTMatrix = new DOMMatrix([1, 0, 0, 1, 0, 0]);
    const skewXAngle = 180 * Math.atan(this.nSkewX) / Math.PI;
    const skewYAngle = 180 * Math.atan(this.nSkewY) / Math.PI;
    aTMatrix.translateSelf(this.nCenterX, this.nCenterY).rotateSelf(this.nRotationAngle).scaleSelf(this.nScaleFactorX, this.nScaleFactorY).skewXSelf(skewYAngle).skewXSelf(skewXAngle).translateSelf(-this.nBaseCenterX, -this.nBaseCenterY);
    this.aTMatrix = aTMatrix;
  }
  // Get/Set Properties
  getX() {
    return this.nCenterX;
  }
  getY() {
    return this.nCenterY;
  }
  getPos() {
    return [this.getX(), this.getY()];
  }
  getWidth() {
    return this.nScaleFactorX * this.getBaseBBox().width;
  }
  getHeight() {
    return this.nScaleFactorY * this.getBaseBBox().height;
  }
  getSize() {
    return [this.getWidth(), this.getHeight()];
  }
  setX(nNewCenterX) {
    ANIMDBG.print("AnimatedElement.setX(" + nNewCenterX + ")");
    if (nNewCenterX === this.nCenterX)
      return;
    this.nCenterX = nNewCenterX;
    this.updateTransformationMatrix();
  }
  setY(nNewCenterY) {
    ANIMDBG.print("AnimatedElement.setY(" + nNewCenterY + ")");
    if (nNewCenterY === this.nCenterY)
      return;
    this.nCenterY = nNewCenterY;
    this.updateTransformationMatrix();
  }
  setPos(aNewPos) {
    const nNewCenterX = aNewPos[0];
    const nNewCenterY = aNewPos[1];
    ANIMDBG.print("AnimatedElement.setPos(" + nNewCenterX + ", " + nNewCenterY + ")");
    if (nNewCenterX === this.nCenterX && nNewCenterY === this.nCenterY)
      return;
    this.nCenterX = nNewCenterX;
    this.nCenterY = nNewCenterY;
    this.updateTransformationMatrix();
  }
  setWidth(nNewWidth) {
    ANIMDBG.print("AnimatedElement.setWidth(" + nNewWidth + ")");
    const nBaseWidth = this.getBaseBBox().width;
    let nScaleFactorX = nNewWidth / nBaseWidth;
    if (Math.abs(nScaleFactorX) < 1e-5)
      nScaleFactorX = Math.sign(nScaleFactorX) * 1e-5;
    if (nScaleFactorX == this.nScaleFactorX)
      return;
    this.nScaleFactorX = nScaleFactorX;
    this.updateTransformationMatrix();
  }
  setHeight(nNewHeight) {
    ANIMDBG.print("AnimatedElement.setHeight(" + nNewHeight + ")");
    const nBaseHeight = this.getBaseBBox().height;
    let nScaleFactorY = nNewHeight / nBaseHeight;
    if (Math.abs(nScaleFactorY) < 1e-5)
      nScaleFactorY = Math.sign(nScaleFactorY) * 1e-5;
    if (nScaleFactorY == this.nScaleFactorY)
      return;
    this.nScaleFactorY = nScaleFactorY;
    this.updateTransformationMatrix();
  }
  setSize(aNewSize) {
    const nNewWidth = aNewSize[0];
    const nNewHeight = aNewSize[1];
    ANIMDBG.print("AnimatedElement.setSize(" + nNewWidth + ", " + nNewHeight + ")");
    const nBaseWidth = this.getBaseBBox().width;
    let nScaleFactorX = nNewWidth / nBaseWidth;
    if (Math.abs(nScaleFactorX) < 1e-5)
      nScaleFactorX = Math.sign(nScaleFactorX) * 1e-5;
    const nBaseHeight = this.getBaseBBox().height;
    let nScaleFactorY = nNewHeight / nBaseHeight;
    if (Math.abs(nScaleFactorY) < 1e-5)
      nScaleFactorY = Math.sign(nScaleFactorY) * 1e-5;
    if (nScaleFactorX == this.nScaleFactorX && nScaleFactorY == this.nScaleFactorY)
      return;
    this.nScaleFactorX = nScaleFactorX;
    this.nScaleFactorY = nScaleFactorY;
    this.updateTransformationMatrix();
  }
  getOpacity() {
    return this.nOpacity;
  }
  setOpacity(nValue) {
    this.nOpacity = clampN(nValue, 0, 1);
    ANIMDBG.print("AnimatedElement.setOpacity(" + nValue + ")");
  }
  getRotationAngle() {
    return this.nRotationAngle;
  }
  setRotationAngle(nNewRotAngle) {
    this.nRotationAngle = nNewRotAngle;
    this.updateTransformationMatrix();
    ANIMDBG.print("AnimatedElement.setRotationAngle(" + nNewRotAngle + ")");
  }
  getSkewX() {
    return this.nSkewX;
  }
  setSkewX(nSkewValue) {
    this.nSkewX = nSkewValue;
    this.updateTransformationMatrix();
    ANIMDBG.print("AnimatedElement.setSkewX(" + nSkewValue + ")");
  }
  getSkewY() {
    return this.nSkewY;
  }
  setSkewY(nSkewValue) {
    this.nSkewY = nSkewValue;
    this.updateTransformationMatrix();
    ANIMDBG.print("AnimatedElement.setSkewY(" + nSkewValue + ")");
  }
  getVisibility() {
    return this.bVisible;
  }
  setVisibility(sValue) {
    this.bVisible = sValue === "visible";
    app.console.debug("AnimatedElement.setVisibility(" + sValue + ")");
  }
  getFillColor() {
    return this.aFillColor;
  }
  setFillColor(aRGBValue) {
    window.app.console.log("AnimatedElement.setFillColor(" + aRGBValue.toString() + ")");
    this.aFillColor = aRGBValue;
  }
  getStrokeColor() {
    return this.aLineColor;
  }
  setStrokeColor(aRGBValue) {
    window.app.console.log("AnimatedElement.setStrokeColor(" + aRGBValue.toString() + ")");
    this.aLineColor = aRGBValue;
  }
  getFontColor() {
    return this.aFontColor;
  }
  setFontColor(aRGBValue) {
    window.app.console.log("AnimatedElement.setFontColor(" + aRGBValue.toString() + ")");
    this.aFontColor = aRGBValue;
  }
  static ownFontLook() {
    return { scale: 1, weight: "", posture: "", underline: "", name: "" };
  }
  getFontLook() {
    return this.aFontLook;
  }
  getFontScale() {
    return this.aFontLook.scale;
  }
  setFontScale(nValue) {
    this.aFontLook.scale = nValue;
  }
  getFontWeight() {
    return this.aFontLook.weight;
  }
  setFontWeight(sValue) {
    this.aFontLook.weight = sValue ?? "";
  }
  getFontPosture() {
    return this.aFontLook.posture;
  }
  setFontPosture(sValue) {
    this.aFontLook.posture = sValue ?? "";
  }
  getFontUnderline() {
    return this.aFontLook.underline;
  }
  setFontUnderline(sValue) {
    this.aFontLook.underline = sValue ?? "";
  }
  getFontName() {
    return this.aFontLook.name;
  }
  setFontName(sValue) {
    this.aFontLook.name = sValue ?? "";
  }
  setDefaultDimColor(aRGBValue) {
    window.app.console.log("AnimatedElement.setDefaultDimColor(" + aRGBValue.toString() + ")");
    this.aDimColor = aRGBValue;
  }
  getDimColor() {
    return this.aDimColor;
  }
  setDimColor(aRGBValue) {
    window.app.console.log("AnimatedElement.setDimColor(" + aRGBValue.toString() + ")");
    this.aDimColor = aRGBValue;
    this.aLineColor = aRGBValue;
    this.aFillColor = aRGBValue;
    this.aFontColor = aRGBValue;
  }
  getFillStyle() {
    return "solid";
  }
  setFillStyle(sValue) {
    window.app.console.log("AnimatedElement.setFillStyle(" + sValue + ") not implemented");
  }
  getLineStyle() {
    return "solid";
  }
  setLineStyle(sValue) {
    window.app.console.log("AnimatedElement.setLineStyle(" + sValue + ") not implemented");
  }
  setClipPath(aClipPath) {
    if (this.aClipPath) {
      const sPathData = aClipPath.getAttribute("d");
      this.aClipPath.setAttribute("d", sPathData);
    }
  }
  setTransitionFilterFrame(aTransitionFilterAnimation, nT) {
    this.transitionFiltersManager.add(aTransitionFilterAnimation, nT);
  }
  /// The last transition filter on the element and the time it reached,
  /// 0 to 1, or undefined.
  getTransitionFilterFrame() {
    const frame = this.transitionFiltersManager.getLastFrame();
    if (!frame)
      return void 0;
    return {
      info: frame.animation.getTransitionFilterInfo(),
      time: frame.time
    };
  }
  DBG(sMessage, nTime) {
    aAnimatedElementDebugPrinter.print("AnimatedElement(" + this.getId() + ")" + sMessage, nTime);
  }
};
_AnimatedElement.DefaultColor = new RGBColor(0, 0, 0);
_AnimatedElement.SupportedProperties = /* @__PURE__ */ new Set([
  "x",
  "y",
  "width",
  "height",
  "opacity",
  "visibility",
  "rotate",
  "skewx",
  "skewy",
  "fillstyle",
  "linestyle",
  "fillcolor",
  "linecolor",
  "charcolor",
  "charheight",
  "charweight",
  "charposture",
  "charunderline",
  "charfontname",
  "dimcolor"
]);
_AnimatedElement.SupportedTransformations = /* @__PURE__ */ new Set([
  "translate",
  "scale",
  "rotate"
]);
let AnimatedElement = _AnimatedElement;
