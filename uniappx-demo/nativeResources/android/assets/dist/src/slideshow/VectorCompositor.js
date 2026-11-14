const _VectorCompositor = class _VectorCompositor extends SlideCompositor {
  constructor(slideShowPresenter) {
    super(slideShowPresenter);
    this.offscreenCanvas = null;
    this.offscreenContext = null;
    this.renderContext = null;
    this.videos = new SlideVideos();
    this.masterVideos = new MasterVideos();
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.disposed = false;
    this.onDataChanged = null;
    this.pendingSlideNumber = null;
    this.pendingReady = null;
    this.layers = /* @__PURE__ */ new Map();
    this.cancelPaintingAhead = null;
    this.shownSlideHash = null;
  }
  _addHooks() {
    this.onDataChanged = () => this._onDataChanged();
    RenderManager.onVectorChanged(this.onDataChanged);
  }
  removeHooks() {
    if (this.onDataChanged)
      RenderManager.offVectorChanged(this.onDataChanged);
    this.onDataChanged = null;
  }
  onUpdatePresentationInfo() {
    this.videos.deleteResources();
    this.videos.clear();
    this.masterVideos.deleteResources();
    [this.canvasWidth, this.canvasHeight] = this._computeCanvasSize();
    this.offscreenCanvas = new OffscreenCanvas(this.canvasWidth, this.canvasHeight);
    this.offscreenContext = this.offscreenCanvas.getContext("2d");
    this.renderContext = new RenderContext2d(this.offscreenCanvas);
    this._stopPaintingAhead();
    this.shownSlideHash = null;
    this._invalidateLayers();
    this.disposed = false;
    this._fetchAllSlides();
  }
  getCanvasSize() {
    return [this.canvasWidth, this.canvasHeight];
  }
  fetchAndRun(slideNumber, callback) {
    super.fetchAndRun(slideNumber, callback);
    queueMicrotask(() => {
      if (this.disposed)
        return;
      this._runWhenReady(slideNumber, () => {
        const done = this._onGotSlideCallback;
        this._onGotSlideCallback = null;
        if (done)
          done.call(this);
      });
    });
  }
  getSlide(slideNumber) {
    return this._composeSlide(slideNumber);
  }
  getAnimatedSlide(slideIndex) {
    return this._composeSlide(slideIndex);
  }
  // --- fetching ---------------------------------------------------
  _fetchAllSlides() {
    this._metaPresentation.getMetaSlides().forEach((_metaSlide, hash) => {
      const info = this._metaPresentation.getSlideInfo(hash);
      if (info) {
        RenderManager.requestPartById(info.part, cool.VectorMode.Slides);
      }
    });
  }
  /// The id of the page that shows the slide. The slideshow can run from
  /// any view, and the slide info names each slide by its id.
  _partIdForSlide(slideNumber) {
    const hash = this._metaPresentation.getSlideHash(slideNumber);
    return this._partIdForSlideHash(hash);
  }
  _partIdForSlideHash(slideHash) {
    const info = slideHash ? this._metaPresentation.getSlideInfo(slideHash) : null;
    return info ? info.part : null;
  }
  _runWhenReady(slideNumber, ready) {
    const partId = this._partIdForSlide(slideNumber);
    if (partId !== null && RenderManager.isPartDrawableById(partId, cool.VectorMode.Slides)) {
      ready();
      return;
    }
    this.pendingSlideNumber = slideNumber;
    this.pendingReady = ready;
  }
  _onDataChanged() {
    this._invalidateLayers();
    if (this.disposed)
      return;
    if (this.shownSlideHash)
      this._paintNextSlideAhead(this.shownSlideHash);
    this._refreshShownSlide();
    if (this.pendingReady === null)
      return;
    const partId = this._partIdForSlide(this.pendingSlideNumber);
    if (partId === null || !RenderManager.isPartDrawableById(partId, cool.VectorMode.Slides))
      return;
    const ready = this.pendingReady;
    this.pendingReady = null;
    this.pendingSlideNumber = null;
    ready();
  }
  // An element without a base takes it from the tree that arrived. Every
  // slide is checked, since a transition enters a slide before it is the
  // one drawn last.
  _refreshShownSlide() {
    var _a;
    this._metaPresentation.getMetaSlides().forEach((_metaSlide, slideHash) => {
      var _a2;
      if (!this._drawableData(slideHash))
        return;
      (_a2 = this.getAnimatedElementMap(slideHash)) == null ? void 0 : _a2.forEach((element) => element.refreshContent());
    });
    (_a = this._slideShowPresenter._slideRenderer) == null ? void 0 : _a.requestRender();
  }
  // --- composing --------------------------------------------------
  _composeSlide(slideNumber) {
    if (this.disposed || !this.offscreenContext)
      return null;
    const slideHash = this._metaPresentation.getSlideHash(slideNumber);
    const data = this._drawableData(slideHash);
    if (!data)
      return null;
    const context = this.offscreenContext;
    context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    context.save();
    context.scale(this.canvasWidth / data.slideWidth, this.canvasHeight / data.slideHeight);
    const states = this._drawStates(slideHash, data);
    RenderManager.renderInto(context, data, {
      authoredColors: true,
      states,
      drawOver: this._videosOverShapes(slideHash, data, states)
    });
    context.restore();
    return this.offscreenCanvas.transferToImageBitmap();
  }
  // What draws the video of each shape that holds one, by shape id. The shapes of the master
  // page are included. A video is placed on the canvas in pixels, so the context goes back to
  // pixels while it is drawn.
  _videosOverShapes(slideHash, data, states) {
    const overShapes = /* @__PURE__ */ new Map();
    for (const shapeId of this.videos.shapeIds(slideHash)) {
      overShapes.set(shapeId, (context) => {
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        this.videos.renderVideo(slideHash, shapeId, this._videoLook(data, states, shapeId));
        context.restore();
      });
    }
    for (const videoRenderer of this._masterVideoRenderers(slideHash)) {
      overShapes.set(videoRenderer.infoId, (context) => {
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        videoRenderer.render();
        context.restore();
      });
    }
    return overShapes;
  }
  _masterVideoRenderers(slideHash) {
    var _a;
    const masterHash = (_a = this._metaPresentation.getSlideInfo(slideHash)) == null ? void 0 : _a.masterPage;
    return masterHash ? this.masterVideos.get(masterHash) : [];
  }
  // How the video of the shape is drawn: in the state of the shape.
  // Undefined where no animation moves the shape.
  _videoLook(data, states, shapeId) {
    if (!states)
      return void 0;
    const state = ImpressVectorManager.stateOf(data, shapeId, states);
    if (!state)
      return void 0;
    return {
      state,
      slideWidth: data.slideWidth,
      slideHeight: data.slideHeight
    };
  }
  // The object id of each animation target of the slide, with the positions
  // of the paragraphs of its text that an animation moves on their own. A
  // video counts as a target, so its frame draws in its place in the paint
  // order, unless a group above it is a target and its run holds the video.
  _animatedTargets(slideHash, data) {
    var _a, _b, _c;
    const targets = /* @__PURE__ */ new Map();
    const elements = this.getAnimatedElementMap(slideHash);
    if (elements) {
      for (const target of elements.keys()) {
        const { id, paragraph } = _VectorCompositor._splitTarget(target);
        if (!data.objects.has(id))
          continue;
        if (!targets.has(id))
          targets.set(id, []);
        if (paragraph !== void 0)
          targets.get(id).push(paragraph);
      }
    }
    targets.forEach((paragraphs) => paragraphs.sort((a, b) => a - b));
    for (const video of ((_a = this._metaPresentation.getSlideInfo(slideHash)) == null ? void 0 : _a.videos) ?? []) {
      const id = video.id;
      if (!data.objects.has(id) || targets.has(id))
        continue;
      let above = (_b = data.objects.get(id)) == null ? void 0 : _b.parent;
      while (above !== void 0 && !targets.has(above))
        above = (_c = data.objects.get(above)) == null ? void 0 : _c.parent;
      if (above === void 0)
        targets.set(id, []);
    }
    return targets;
  }
  // The frame each video shows now, by the object id of its shape. The
  // shapes of the master page are included. A video without a frame yet
  // leaves its placeholder showing.
  _videoFrames(slideHash, data) {
    var _a, _b;
    const frames = /* @__PURE__ */ new Map();
    for (const video of ((_a = this._metaPresentation.getSlideInfo(slideHash)) == null ? void 0 : _a.videos) ?? []) {
      if (!data.objects.has(video.id))
        continue;
      const frame = (_b = this.videos.get(slideHash, video)) == null ? void 0 : _b.currentFrame();
      if (frame)
        frames.set(video.id, frame);
    }
    for (const videoRenderer of this._masterVideoRenderers(slideHash)) {
      const frame = videoRenderer.currentFrame();
      if (frame)
        frames.set(videoRenderer.infoId, frame);
    }
    return frames;
  }
  drawsFrames() {
    return !this.disposed;
  }
  drawFrameInto(context, slideIndex, texture) {
    if (this.disposed || context.isDisposed())
      return false;
    const slideHash = this._metaPresentation.getSlideHash(slideIndex);
    const data = this._drawableData(slideHash);
    if (!data)
      return false;
    this._dropDisposedLayers();
    const layers = this._slideLayers(context, slideHash, data);
    if (!layers)
      return false;
    return layers.draw(this._drawStates(slideHash, data), texture, this._videoFrames(slideHash, data));
  }
  // The layers of a context that is gone are freed with it.
  _dropDisposedLayers() {
    this.layers.forEach((sets, owner) => {
      if (!owner.isDisposed())
        return;
      for (const layers of sets)
        layers.dispose();
      this.layers.delete(owner);
    });
  }
  _invalidateLayers() {
    this.layers.forEach((sets) => sets.forEach((layers) => layers.invalidate()));
  }
  // The layers of the slide in the context, made anew where the context holds none for it.
  // A full context reuses the set of its least recently drawn slide. During a transition the
  // slide it leaves and the one it enters are both drawn from layers painted before. Null while
  // the canvas of the context has no size.
  _slideLayers(context, slideHash, data) {
    var _a;
    const width = context.canvas.width;
    const height = context.canvas.height;
    if (width <= 0 || height <= 0)
      return null;
    const master = data.masterPartId !== void 0 ? RenderManager.requestPartById(data.masterPartId, cool.VectorMode.MasterPages) ?? null : null;
    let sets = this.layers.get(context);
    if (!sets) {
      sets = [];
      this.layers.set(context, sets);
    }
    const index = sets.findIndex((layers2) => layers2.holds(slideHash, data, master, width, height));
    let layers;
    if (index >= 0) {
      layers = sets.splice(index, 1)[0];
    } else {
      layers = sets.length < _VectorCompositor.layerSetsPerContext ? new VectorSlideLayers(context) : sets.pop();
      const masterVideoIds = new Set((((_a = this._metaPresentation.getSlideInfo(slideHash)) == null ? void 0 : _a.masterVideos) ?? []).map((video) => video.id));
      layers.build(slideHash, data, this._animatedTargets(slideHash, data), width, height, master, masterVideoIds);
    }
    sets.unshift(layers);
    return layers;
  }
  // Paint the layers of the slide after slideHash ahead of time, one layer per idle callback,
  // in every context that frames are drawn into. A full-canvas layer takes about as long as a
  // frame, so the frames between two callbacks go to the video.
  _paintNextSlideAhead(slideHash) {
    var _a;
    this._stopPaintingAhead();
    const nextHash = (_a = this._metaPresentation.getSlideInfo(slideHash)) == null ? void 0 : _a.next;
    if (!nextHash)
      return;
    const step = () => {
      this.cancelPaintingAhead = null;
      if (this.disposed)
        return;
      const data = this._drawableData(nextHash);
      if (!data)
        return;
      this._dropDisposedLayers();
      let isLayerLeft = false;
      this.layers.forEach((_sets, context) => {
        var _a2;
        if ((_a2 = this._slideLayers(context, nextHash, data)) == null ? void 0 : _a2.paintNext())
          isLayerLeft = true;
      });
      if (isLayerLeft)
        this._whenIdle(step);
    };
    this._whenIdle(step);
  }
  // Run callback once the browser is idle. The timeout runs it also while the frames of a
  // video keep the browser busy. A browser without idle callbacks runs it after a short delay.
  _whenIdle(callback) {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(callback, { timeout: 1e3 });
      this.cancelPaintingAhead = () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(callback, 50);
      this.cancelPaintingAhead = () => clearTimeout(id);
    }
  }
  _stopPaintingAhead() {
    var _a;
    (_a = this.cancelPaintingAhead) == null ? void 0 : _a.call(this);
    this.cancelPaintingAhead = null;
  }
  /// The cached tree of the slide, or null until the slide and its master,
  /// which holds the background and footers, have arrived.
  _drawableData(slideHash) {
    const partId = this._partIdForSlideHash(slideHash);
    if (partId === null)
      return null;
    if (!RenderManager.isPartDrawableById(partId, cool.VectorMode.Slides))
      return null;
    const data = RenderManager.requestPartById(partId, cool.VectorMode.Slides);
    if (!data || data.slideWidth <= 0 || data.slideHeight <= 0)
      return null;
    return data;
  }
  // The state of every animated target by object id. A paragraph target
  // is the shape id, an underscore and the paragraph position. A target
  // without a base rectangle is drawn as it comes.
  _drawStates(slideHash, data) {
    const elements = this.getAnimatedElementMap(slideHash);
    if (!elements || elements.size === 0)
      return void 0;
    const states = /* @__PURE__ */ new Map();
    elements.forEach((element, target) => {
      if (!element.isValid())
        return;
      const { id: objectId, paragraph } = _VectorCompositor._splitTarget(target);
      if (!data.objects.has(objectId))
        return;
      let state = states.get(objectId);
      if (!state) {
        state = {};
        states.set(objectId, state);
      }
      const drawState = element.getDrawState();
      if (paragraph === void 0) {
        Object.assign(state, drawState);
      } else {
        if (!state.paragraphs)
          state.paragraphs = /* @__PURE__ */ new Map();
        state.paragraphs.set(paragraph, drawState);
      }
    });
    for (const state of states.values()) {
      if (!state.paragraphs)
        continue;
      for (const [paragraph, own] of state.paragraphs)
        state.paragraphs.set(paragraph, _VectorCompositor.overOwner(state, own));
    }
    return states;
  }
  /// A paragraph's state on top of its shape's. Transforms chain, opacities multiply, and
  /// an unset clip, colors or text look falls back to the shape's. Hidden when either is.
  static overOwner(owner, own) {
    if (owner.hidden || own.hidden)
      return { hidden: true };
    const state = {};
    const ownMatrix = cool.Matrix2D.fromArray(own.transform);
    const ownerMatrix = cool.Matrix2D.fromArray(owner.transform);
    const matrix = ownMatrix && ownerMatrix ? ownMatrix.then(ownerMatrix) : ownMatrix ?? ownerMatrix;
    if (matrix)
      state.transform = matrix.toArray();
    if (own.alpha !== void 0 || owner.alpha !== void 0)
      state.alpha = (own.alpha ?? 1) * (owner.alpha ?? 1);
    const clip = own.clip ?? owner.clip;
    if (clip)
      state.clip = clip;
    const colorOverride = own.colorOverride ?? owner.colorOverride;
    if (colorOverride)
      state.colorOverride = colorOverride;
    const textOverride = own.textOverride ?? owner.textOverride;
    if (textOverride)
      state.textOverride = textOverride;
    return state;
  }
  // A shape target is its object id, a paragraph target the id, an
  // underscore and the paragraph position.
  static _splitTarget(target) {
    const separator = target.indexOf("_");
    if (separator < 0)
      return { id: Number(target), paragraph: void 0 };
    return {
      id: Number(target.substring(0, separator)),
      paragraph: Number(target.substring(separator + 1))
    };
  }
  // --- animation and video ----------------------------------------
  createAnimatedElement(sId, slideHash, title, slideWidth, slideHeight, bIsTextElement) {
    return new AnimatedElementVector(this, sId, slideHash, title, slideWidth, slideHeight, bIsTextElement);
  }
  getAnimatedLayerInfo(_slideHash, _targetElement) {
    return null;
  }
  getLayerImage(_slideHash, _targetElement) {
    return null;
  }
  /// The box of the shape or the bounds of the paragraph, in twips. Null
  /// without a cached tree or such a target.
  getLayerBounds(slideHash, targetElement) {
    const target = this._findTarget(slideHash, targetElement);
    if (!target)
      return null;
    if (target.paragraph) {
      const bounds = target.paragraph.bounds;
      if (!bounds)
        return null;
      return new DOMRect(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]);
    }
    const object = target.object;
    if (object.x === void 0 || object.width === void 0)
      return null;
    return new DOMRect(object.x, object.y, object.width, object.height);
  }
  /// The target's colors as #rrggbb: the solid fill and line of the shape,
  /// and the color of the first text run, of its own paragraph for a
  /// paragraph target. Absent where there is none or it is automatic. Null
  /// without a cached tree or such a target.
  getTargetColors(slideHash, targetElement) {
    var _a, _b;
    const target = this._findTarget(slideHash, targetElement);
    if (!target)
      return null;
    const text = target.paragraph ? [target.paragraph] : cool.TextHierarchyParagraphPrimitive.collect(target.object.primitives);
    return {
      fillColor: (_a = target.object.properties) == null ? void 0 : _a.fillColor,
      lineColor: (_b = target.object.properties) == null ? void 0 : _b.lineColor,
      fontColor: _VectorCompositor._firstFontColor(target.data, text)
    };
  }
  // The object the target names, its paragraph for a paragraph target,
  // and the cached part. Null without a cached tree or such an object.
  _findTarget(slideHash, targetElement) {
    const partId = this._partIdForSlideHash(slideHash);
    if (partId === null)
      return null;
    const data = RenderManager.requestPartById(partId, cool.VectorMode.Slides);
    if (!data)
      return null;
    const { id, paragraph } = _VectorCompositor._splitTarget(targetElement);
    const object = data.objects.get(id);
    if (!object)
      return null;
    if (paragraph === void 0)
      return { data, object };
    const paragraphNode = cool.TextHierarchyParagraphPrimitive.collect(object.primitives)[paragraph];
    return paragraphNode ? { data, object, paragraph: paragraphNode } : null;
  }
  // The color of the first text run, automatic resolved against the
  // surface under it, or undefined without text.
  static _firstFontColor(data, primitives) {
    if (!primitives)
      return void 0;
    for (const primitive of primitives) {
      if (primitive.type === cool.TextSimplePortionPrimitive.type || primitive.type === cool.TextDecoratedPortionPrimitive.type)
        return RenderManager.textColorOf(data, primitive);
      const found = _VectorCompositor._firstFontColor(data, primitive.children);
      if (found)
        return found;
    }
    return void 0;
  }
  getLayerRendererContext() {
    return null;
  }
  getVideoRenderer(slideHash, videoInfo) {
    return this.videos.get(slideHash, videoInfo);
  }
  pauseVideos(slideHash) {
    this.videos.pause(slideHash);
  }
  // --- transitions and lifecycle ----------------------------------
  hasMasterVideos(slideIndex) {
    const slideHash = this._metaPresentation.getSlideHash(slideIndex);
    return this._masterVideoRenderers(slideHash).length > 0;
  }
  getMasterVideoFrames(slideIndex) {
    var _a;
    const slideHash = this._metaPresentation.getSlideHash(slideIndex);
    const masterHash = (_a = this._metaPresentation.getSlideInfo(slideHash)) == null ? void 0 : _a.masterPage;
    return masterHash ? this.masterVideos.presentedFrames(masterHash) : 0;
  }
  // The primitive trees are already cached before a transition starts. The background video of
  // the slide coming in plays from the start of the transition.
  notifyTransitionStart(slideHash) {
    this._stopPaintingAhead();
    this.shownSlideHash = null;
    if (this.disposed || !this.renderContext)
      return;
    this.masterVideos.start(this._metaPresentation.getSlideInfo(slideHash), this.renderContext);
  }
  notifyTransitionEnd(slideHash) {
    if (this.disposed || !this.renderContext)
      return;
    const slideInfo = this._metaPresentation.getSlideInfo(slideHash);
    this.masterVideos.start(slideInfo, this.renderContext);
    if (slideInfo)
      this.masterVideos.keepOnly(slideInfo.masterPage);
    else
      this.masterVideos.deleteResources();
    this.videos.enterSlide(slideHash, slideInfo, this.renderContext);
    this.shownSlideHash = slideHash;
    this._paintNextSlideAhead(slideHash);
  }
  deleteResources() {
    this.disposed = true;
    this.videos.deleteResources();
    this.videos.clear();
    this.masterVideos.deleteResources();
    this.offscreenCanvas = null;
    this.offscreenContext = null;
    this.renderContext = null;
    this._stopPaintingAhead();
    this.shownSlideHash = null;
    this.layers.forEach((sets) => sets.forEach((layers) => layers.dispose()));
    this.layers.clear();
    this.pendingReady = null;
    this.pendingSlideNumber = null;
  }
  // --- canvas sizing ----------------------------------------------
  // Primitives render at any scale, so the resolution is the requested size in device pixels.
  computeLayerResolution(width, height) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    return [width * devicePixelRatio, height * devicePixelRatio];
  }
  // The canvas takes the display resolution, fitted to the slide aspect ratio.
  _computeCanvasSize() {
    const [width, height] = this.computeLayerResolution(window.screen.width, window.screen.height);
    return this.computeLayerSize(width, height);
  }
};
_VectorCompositor.layerSetsPerContext = 2;
let VectorCompositor = _VectorCompositor;
SlideShow.VectorCompositor = VectorCompositor;
