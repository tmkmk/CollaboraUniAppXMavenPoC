class SlideShowContext {
  constructor(aSlideShowHandler, aTimerEventQueue, aEventMultiplexer, aNextEffectEventArray, aInteractiveAnimationSequenceMap, aActivityQueue) {
    this.aSlideShowHandler = aSlideShowHandler;
    this.aTimerEventQueue = aTimerEventQueue;
    this.aEventMultiplexer = aEventMultiplexer;
    this.aNextEffectEventArray = aNextEffectEventArray;
    this.aInteractiveAnimationSequenceMap = aInteractiveAnimationSequenceMap;
    this.aActivityQueue = aActivityQueue;
    this.bIsSkipping = false;
  }
}
const _SlideShowHandler = class _SlideShowHandler {
  constructor(presenter) {
    this.nNextUpdateFrame = null;
    this.nNextUpdateTimeout = null;
    this.updateHandler = this.update.bind(this);
    this.bIsAutomaticAdvancePaused = false;
    this.nAutomaticAdvanceRemaining = 0;
    this.nAutomaticAdvanceStartTime = 0;
    this.bIsFirstAutoEffectRunning = false;
    this.aPendingA11yTimeouts = [];
    this.sPendingA11ySlideContent = null;
    this.nPendingA11ySlideContentTimeout = null;
    this.transitionsWithMipMapEnabled = /* @__PURE__ */ new Set([
      TransitionSubType.CORNERSOUT,
      TransitionSubType.TOPTOBOTTOM,
      TransitionSubType.LEFTTORIGHT,
      TransitionSubType.BOTTOMRIGHT,
      TransitionSubType.BOTTOMLEFT,
      TransitionSubType.TOPCENTER,
      TransitionSubType.CORNERSIN,
      TransitionSubType.TOPLEFT,
      TransitionSubType.CIRCLE,
      TransitionSubType.FANOUTHORIZONTAL,
      TransitionSubType.ACROSS,
      TransitionSubType.DIAMOND,
      TransitionSubType.HEART,
      TransitionSubType.AIRPLANE
    ]);
    this._labelMap = {
      rewind: _("Previous"),
      dispatch: _("Next"),
      skip: _("Skip"),
      rewindAll: _("First"),
      skipAll: _("Skip All"),
      firstPage: _("First Slide"),
      nextPage: _("Next Slide"),
      prevPage: _("Previous Slide"),
      lastPage: _("Last Slide"),
      quit: _("End Show"),
      pauseShow: _("Paused"),
      resumeShow: _("Resumed")
    };
    this.presenter = presenter;
    this.aTimer = new ElapsedTime();
    this.aTimerEventQueue = new TimerEventQueue(this.aTimer);
    this.aActivityQueue = new ActivityQueue(this.aTimer);
    this.aNextEffectEventArray = null;
    this.aInteractiveAnimationSequenceMap = null;
    this.aEventMultiplexer = null;
    this._context = new SlideShowContext(this, this.aTimerEventQueue, this.aEventMultiplexer, this.aNextEffectEventArray, this.aInteractiveAnimationSequenceMap, this.aActivityQueue);
    this.bIsIdle = true;
    this.bIsEnabled = true;
    this.bNoSlideTransition = false;
    this.bIsTransitionRunning = false;
    this.nCurrentEffect = 0;
    this.bIsNextEffectRunning = false;
    this.bIsRewinding = false;
    this.bIsSkipping = false;
    this.bIsSkippingAll = false;
    this.nTotalInteractivePlayingEffects = 0;
    this.aStartedEffectList = [];
    this.aStartedEffectIndexMap = /* @__PURE__ */ new Map();
    this.aStartedEffectIndexMap.set(-1, void 0);
    this.automaticAdvanceTimeout = null;
  }
  get automaticAdvanceTimeoutRewindedEffect() {
    const automaticAdvanceTimeout = this.automaticAdvanceTimeout;
    return automaticAdvanceTimeout.rewindedEffect;
  }
  setMetaPresentation(metaPres) {
    this.theMetaPres = metaPres;
  }
  setNavigator(slideShowNavigator) {
    this.slideShowNavigator = slideShowNavigator;
  }
  isGlSupported() {
    return !this.presenter._slideRenderer._context.is2dGl();
  }
  setSlideEvents(aNextEffectEventArray, aInteractiveAnimationSequenceMap, aEventMultiplexer) {
    if (!aNextEffectEventArray)
      window.app.console.log("SlideShow.setSlideEvents: aNextEffectEventArray is not valid");
    if (!aInteractiveAnimationSequenceMap)
      window.app.console.log("SlideShow.setSlideEvents:aInteractiveAnimationSequenceMap  is not valid");
    if (!aEventMultiplexer)
      window.app.console.log("SlideShow.setSlideEvents: aEventMultiplexer is not valid");
    this._context.aNextEffectEventArray = aNextEffectEventArray;
    this.aNextEffectEventArray = aNextEffectEventArray;
    this._context.aInteractiveAnimationSequenceMap = aInteractiveAnimationSequenceMap;
    this.aInteractiveAnimationSequenceMap = aInteractiveAnimationSequenceMap;
    this._context.aEventMultiplexer = aEventMultiplexer;
    this.aEventMultiplexer = aEventMultiplexer;
    this.nCurrentEffect = 0;
  }
  createSlideTransition(aSlideTransitionHandler, transitionParameters, aTransitionEndEvent) {
    if (this.bNoSlideTransition)
      return null;
    const aSlideTransition = aSlideTransitionHandler.createSlideTransition(transitionParameters);
    if (!aSlideTransition)
      return null;
    let nDuration = 1e-3;
    if (aSlideTransitionHandler.getDuration().isValue()) {
      nDuration = aSlideTransitionHandler.getDuration().getValue();
    } else {
      window.app.console.log("SlideShow.createSlideTransition: duration is not a number");
    }
    const aCommonParameterSet = new ActivityParamSet();
    aCommonParameterSet.aEndEvent = aTransitionEndEvent;
    aCommonParameterSet.aTimerEventQueue = this.aTimerEventQueue;
    aCommonParameterSet.aActivityQueue = this.aActivityQueue;
    aCommonParameterSet.nMinDuration = nDuration;
    aCommonParameterSet.nMinNumberOfFrames = aSlideTransitionHandler.getMinFrameCount();
    aCommonParameterSet.nSlideWidth = this.theMetaPres.getDocWidth();
    aCommonParameterSet.nSlideHeight = this.theMetaPres.getDocHeight();
    return new SimpleActivity(aCommonParameterSet, aSlideTransition, DirectionType.Forward);
  }
  addA11yString(a11yString) {
    this.clearPendingA11yStrings();
    this.writeA11yString(a11yString);
  }
  addA11yStringDelayed(a11yString, nDelay) {
    const nTimeout = window.setTimeout(() => {
      this.aPendingA11yTimeouts = this.aPendingA11yTimeouts.filter((nPending) => nPending !== nTimeout);
      this.writeA11yString(a11yString);
    }, nDelay);
    this.aPendingA11yTimeouts.push(nTimeout);
  }
  /** The content of a slide is announced once, when moving to the slide,
   * cancelling all other announcements
   */
  addA11ySlideContent(a11yString) {
    this.clearPendingA11ySlideContent();
    this.sPendingA11ySlideContent = a11yString;
    this.scheduleA11ySlideContent();
  }
  scheduleA11ySlideContent() {
    if (this.sPendingA11ySlideContent === null)
      return;
    this.nPendingA11ySlideContentTimeout = window.setTimeout(() => {
      const a11yString = this.sPendingA11ySlideContent;
      this.clearPendingA11ySlideContent();
      this.writeA11yString(a11yString);
    }, _SlideShowHandler.A11Y_SLIDE_CONTENT_DELAY);
  }
  clearPendingA11ySlideContent() {
    if (this.nPendingA11ySlideContentTimeout !== null) {
      clearTimeout(this.nPendingA11ySlideContentTimeout);
      this.nPendingA11ySlideContentTimeout = null;
    }
    this.sPendingA11ySlideContent = null;
  }
  clearPendingA11yStrings() {
    this.aPendingA11yTimeouts.forEach((nTimeout) => clearTimeout(nTimeout));
    this.aPendingA11yTimeouts = [];
    if (this.nPendingA11ySlideContentTimeout !== null) {
      clearTimeout(this.nPendingA11ySlideContentTimeout);
      this.scheduleA11ySlideContent();
    }
  }
  writeA11yString(a11yString) {
    if (this.presenter._enableA11y) {
      const canvas = this.getContext()._canvas;
      if (canvas) {
        const a11yContainer = window.L.DomUtil.create("div", "");
        a11yContainer.tabIndex = -1;
        canvas.replaceChildren();
        a11yContainer.innerHTML = app.LOUtil.sanitize(a11yString);
        const aBlocks = Array.from(a11yContainer.querySelectorAll("h1, h2, p, li")).map((el) => el.textContent.trim()).filter((s) => s.length > 0);
        a11yContainer.textContent = aBlocks.length ? aBlocks.join(". ") : a11yContainer.textContent;
        canvas.appendChild(a11yContainer);
      }
    }
  }
  isEnabled() {
    return this.bIsEnabled;
  }
  disable() {
    this.bIsEnabled = false;
    this.dispose();
  }
  isRunning() {
    return !this.bIsIdle;
  }
  isTransitionPlaying() {
    return this.bIsTransitionRunning;
  }
  isMainEffectPlaying() {
    return this.bIsNextEffectRunning;
  }
  isInteractiveEffectPlaying() {
    return this.nTotalInteractivePlayingEffects > 0;
  }
  isAnyEffectPlaying() {
    return this.isMainEffectPlaying() || this.isInteractiveEffectPlaying();
  }
  hasAnyEffectStarted() {
    return this.aStartedEffectList.length > 0;
  }
  getCurrentEffect() {
    return this.nCurrentEffect;
  }
  notifyNextEffectStart() {
    var _a;
    assert(!this.bIsNextEffectRunning, "SlideShowHandler.notifyNextEffectStart: an effect is already started.");
    ANIMDBG.print("SlideShowHandler.notifyNextEffectStart invoked.");
    this.bIsNextEffectRunning = true;
    this.aEventMultiplexer.registerNextEffectEndHandler(this.notifyNextEffectEnd.bind(this));
    const aEffect = new Effect();
    aEffect.start();
    this.aStartedEffectIndexMap.set(-1, this.aStartedEffectList.length);
    this.aStartedEffectList.push(aEffect);
    const sCurSlideHash = this.theMetaPres.getCurrentSlideHash();
    const curMetaSlide = this.theMetaPres.getMetaSlide(sCurSlideHash);
    if (curMetaSlide == null ? void 0 : curMetaSlide.animationsHandler) {
      const aAnimatedElementMap = curMetaSlide.animationsHandler.getAnimatedElementMap();
      const currentEffect = this.nCurrentEffect;
      aAnimatedElementMap.forEach((aAnimatedElement) => {
        aAnimatedElement.notifyNextEffectStart(currentEffect);
      });
    }
    this.announceEffect((_a = this.aNextEffectEventArray) == null ? void 0 : _a.nodeAt(this.nCurrentEffect));
  }
  announceEffect(aEffectNode) {
    var _a;
    const sPresetLabel = aEffectNode == null ? void 0 : aEffectNode.getPresetLabel();
    const sObjectName = (_a = aEffectNode == null ? void 0 : aEffectNode.getTargetAnimatedElement()) == null ? void 0 : _a.getTitle();
    let sAnnouncement;
    if (sPresetLabel && sObjectName)
      sAnnouncement = _("Animation: {0}, {1}").replace("{0}", sPresetLabel).replace("{1}", sObjectName);
    else if (sPresetLabel || sObjectName)
      sAnnouncement = _("Animation: {0}").replace("{0}", sPresetLabel || sObjectName);
    else
      sAnnouncement = _("Animation");
    this.addA11yStringDelayed(sAnnouncement, 500);
  }
  notifyNextEffectEnd() {
    assert(this.bIsNextEffectRunning, "SlideShow.notifyNextEffectEnd: effect already ended.");
    ANIMDBG.print("SlideShowHandler.notifyNextEffectEnd invoked.");
    this.bIsNextEffectRunning = false;
    const effectIndex = this.aStartedEffectIndexMap.get(-1);
    if (effectIndex !== void 0 && this.aStartedEffectList[effectIndex]) {
      this.aStartedEffectList[effectIndex].end();
    }
    if (this.automaticAdvanceTimeout !== null) {
      if (this.automaticAdvanceTimeoutRewindedEffect === this.nCurrentEffect) {
        this.automaticAdvanceTimeout = null;
        this.notifyAnimationsEnd();
      }
    }
  }
  notifyAnimationsEnd() {
    ANIMDBG.print("SlideShowHandler.notifyAnimationsEnd: current slide index: " + this.slideShowNavigator.currentSlideIndex);
    const sCurrSlideHash = this.theMetaPres.getCurrentSlideHash();
    if (this.theMetaPres.isLastSlide(sCurrSlideHash) && !this.presenter._isWelcomePresentation)
      return;
    assert(this.automaticAdvanceTimeout === null, "SlideShow.notifyAnimationsEnd: Timeout already set.");
    const slideInfo = this.theMetaPres.getSlideInfo(sCurrSlideHash);
    if ((slideInfo == null ? void 0 : slideInfo.nextSlideDuration) && slideInfo.nextSlideDuration > 0) {
      this.startAutomaticAdvanceTimeout(slideInfo.nextSlideDuration);
    }
  }
  /** startAutomaticAdvanceTimeout
   *  Wait the given number of milliseconds and then move on to the next
   *  slide. While paused the wait is only recorded, ready to be started
   *  once the show is resumed.
   */
  startAutomaticAdvanceTimeout(nDuration) {
    this.nAutomaticAdvanceRemaining = nDuration;
    if (this.bIsAutomaticAdvancePaused)
      return;
    this.nAutomaticAdvanceStartTime = Date.now();
    this.automaticAdvanceTimeout = window.setTimeout(this.slideShowNavigator.switchSlide.bind(this.slideShowNavigator, 1, false), nDuration);
  }
  /** toggleAutomaticAdvancePause
   *  Hold or release the countdown that moves the show on to the next slide
   *  by itself. Releasing waits out only the time that was left.
   */
  toggleAutomaticAdvancePause() {
    if (this.bIsAutomaticAdvancePaused) {
      this.bIsAutomaticAdvancePaused = false;
      this.addA11yString(this._labelMap["resumeShow"]);
      if (this.nAutomaticAdvanceRemaining > 0)
        this.startAutomaticAdvanceTimeout(this.nAutomaticAdvanceRemaining);
      return;
    }
    this.bIsAutomaticAdvancePaused = true;
    this.addA11yString(this._labelMap["pauseShow"]);
    if (typeof this.automaticAdvanceTimeout === "number") {
      clearTimeout(this.automaticAdvanceTimeout);
      this.automaticAdvanceTimeout = null;
      const nWaited = Date.now() - this.nAutomaticAdvanceStartTime;
      this.nAutomaticAdvanceRemaining = Math.max(0, this.nAutomaticAdvanceRemaining - nWaited);
    }
  }
  notifySlideStart(nNewSlideIndex, nOldSlideIndex) {
    this.nAutomaticAdvanceRemaining = 0;
    this.nCurrentEffect = 0;
    this.bIsNextEffectRunning = false;
    this.bIsRewinding = false;
    this.bIsSkipping = false;
    this.bIsSkippingAll = false;
    this.nTotalInteractivePlayingEffects = 0;
    this.aStartedEffectList = [];
    this.aStartedEffectIndexMap = /* @__PURE__ */ new Map();
    this.aStartedEffectIndexMap.set(-1, void 0);
    if (nOldSlideIndex !== void 0) {
      const metaOldSlide = this.theMetaPres.getMetaSlideByIndex(nOldSlideIndex);
      if (metaOldSlide == null ? void 0 : metaOldSlide.animationsHandler) {
        const aAnimatedElementMap = metaOldSlide.animationsHandler.getAnimatedElementMap();
        aAnimatedElementMap.forEach((aAnimatedElement) => {
          aAnimatedElement.notifySlideEnd();
        });
      }
    }
    const metaNewSlide = this.theMetaPres.getMetaSlideByIndex(nNewSlideIndex);
    if (metaNewSlide == null ? void 0 : metaNewSlide.animationsHandler) {
      const aAnimatedElementMap = metaNewSlide.animationsHandler.getAnimatedElementMap();
      aAnimatedElementMap.forEach((aAnimatedElement) => {
        aAnimatedElement.notifySlideStart(this._context);
      });
    }
    this.slideCompositor.notifyTransitionStart(this.theMetaPres.getSlideHash(nNewSlideIndex));
    this.presenter._map.fire("transitionstart", { slide: nNewSlideIndex });
    const bMovingForward = nOldSlideIndex === void 0 ? this.isStarting : nNewSlideIndex > nOldSlideIndex;
    const slideInfo = this.getSlideInfo(nNewSlideIndex);
    if (bMovingForward && slideInfo.transitionLabel) {
      this.addA11yStringDelayed(_("Transition: {0}").replace("{0}", slideInfo.transitionLabel), _SlideShowHandler.A11Y_TRANSITION_DELAY);
    }
  }
  notifyTransitionEnd(nNewSlide, nOldSlide) {
    NAVDBG.print("SlideShowHandler.notifyTransitionEnd: nNewSlide: " + nNewSlide + ", nOldSlide: " + nOldSlide + ", this.bIsRewinding: " + this.bIsRewinding);
    this.bIsTransitionRunning = false;
    if (!this.presenter._checkAlreadyPresenting())
      return;
    if (this.bIsRewinding) {
      this.theMetaPres.getMetaSlideByIndex(nNewSlide).hide();
      this.slideShowNavigator.rewindToPreviousSlide();
      this.bIsRewinding = false;
      return;
    }
    const sCurSlideHash = this.theMetaPres.getCurrentSlideHash();
    this.slideCompositor.notifyTransitionEnd(sCurSlideHash);
    try {
      this.presentSlide(nNewSlide);
    } catch (message) {
      app.console.error("notifyTransitionEnd: " + message);
    }
    this.presenter._map.fire("transitionend", { slide: nNewSlide });
    this.enteringSlideTexture = null;
    this.isStarting = false;
    if (this.isEnabled()) {
      this.dispose();
      const aCurrentSlide = this.theMetaPres.getMetaSlide(sCurSlideHash);
      if (aCurrentSlide && aCurrentSlide.animationsHandler && aCurrentSlide.animationsHandler.elementsParsed()) {
        aCurrentSlide.animationsHandler.start();
        this.aEventMultiplexer.registerAnimationsEndHandler(this.notifyAnimationsEnd.bind(this));
      } else
        this.notifyAnimationsEnd();
      this.update();
    } else
      this.notifyAnimationsEnd();
  }
  notifyInteractiveAnimationSequenceStart(nNodeId) {
    ++this.nTotalInteractivePlayingEffects;
    const aEffect = new Effect(nNodeId);
    aEffect.start();
    this.aStartedEffectIndexMap.set(nNodeId, this.aStartedEffectList.length);
    this.aStartedEffectList.push(aEffect);
  }
  notifyInteractiveAnimationSequenceEnd(nNodeId) {
    assert(this.isInteractiveEffectPlaying(), "SlideShow.notifyInteractiveAnimationSequenceEnd: no interactive effect playing.");
    const effectIndex = this.aStartedEffectIndexMap.get(nNodeId);
    if (effectIndex !== void 0 && this.aStartedEffectList[effectIndex]) {
      this.aStartedEffectList[effectIndex].end();
    }
    --this.nTotalInteractivePlayingEffects;
  }
  /** nextEffect
   *  Start the next effect belonging to the main animation sequence if any.
   *  If there is an already playing effect belonging to any animation sequence
   *  it is skipped.
   *
   *  @return {Boolean}
   *      False if there is no more effect to start, true otherwise.
   */
  nextEffect() {
    if (!this.isEnabled())
      return false;
    this.addA11yString(this._labelMap["dispatch"]);
    if (this.isTransitionPlaying()) {
      this.skipTransition();
      return true;
    }
    if (this.isFirstAutoEffectRunning()) {
      this.skipFirstAutoEffect();
      return true;
    }
    ANIMDBG.print(`SlideShowHandler.nextEffect: current effect: ${this.nCurrentEffect}`);
    if (this.isAnyEffectPlaying()) {
      this.skipAllPlayingEffects();
      return true;
    }
    if (!this.aNextEffectEventArray)
      return false;
    if (this.nCurrentEffect >= this.aNextEffectEventArray.size())
      return false;
    this.notifyNextEffectStart();
    this.aNextEffectEventArray.at(this.nCurrentEffect).fire();
    ++this.nCurrentEffect;
    this.presenter.sendSlideShowFollowMessage("effect " + JSON.stringify({ currentEffect: this.nCurrentEffect }));
    this.update();
    return true;
  }
  /** skipTransition
   *  Skip the current playing slide transition.
   */
  skipTransition() {
    if (this.bIsSkipping || this.bIsRewinding)
      return;
    this.bIsSkipping = true;
    this.aActivityQueue.endAll();
    this.aTimerEventQueue.forceEmpty();
    this.aActivityQueue.endAll();
    this.update();
    this.bIsSkipping = false;
  }
  /** skipAllPlayingEffects
   *  Skip all playing effect, independently to which animation sequence they
   *  belong.
   *
   */
  skipAllPlayingEffects() {
    this.addA11yString(this._labelMap["skipAll"]);
    if (this.bIsSkipping || this.bIsRewinding)
      return true;
    this.bIsSkipping = true;
    for (let i = 0; i < this.aStartedEffectList.length; ++i) {
      const aEffect = this.aStartedEffectList[i];
      if (aEffect.isPlaying()) {
        if (aEffect.isMainEffect())
          this.aEventMultiplexer.notifySkipEffectEvent();
        else
          this.aEventMultiplexer.notifySkipInteractiveEffectEvent(aEffect.getId());
      }
    }
    this.update();
    this.bIsSkipping = false;
    return true;
  }
  /** skipNextEffect
   *  Skip the next effect to be played (if any) that belongs to the main
   *  animation sequence.
   *  Require: no effect is playing.
   *
   *  @return {Boolean}
   *      False if there is no more effect to skip, true otherwise.
   */
  skipNextEffect() {
    if (this.bIsSkipping || this.bIsRewinding)
      return true;
    ANIMDBG.print(`SlideShowHandler.skipNextEffect: current effect: ${this.nCurrentEffect}`);
    assert(!this.isAnyEffectPlaying(), "SlideShowHandler.skipNextEffect");
    if (!this.aNextEffectEventArray)
      return false;
    if (this.nCurrentEffect >= this.aNextEffectEventArray.size())
      return false;
    this.notifyNextEffectStart();
    this.bIsSkipping = true;
    this.aNextEffectEventArray.at(this.nCurrentEffect).fire();
    this.aEventMultiplexer.notifySkipEffectEvent();
    ++this.nCurrentEffect;
    this.presenter.sendSlideShowFollowMessage("effect " + JSON.stringify({ currentEffect: this.nCurrentEffect }));
    this.update();
    this.bIsSkipping = false;
    return true;
  }
  skipNEffects(nEffectNumber) {
    for (let i = 0; i < nEffectNumber; i++)
      if (!this.skipNextEffect())
        break;
  }
  /** skipPlayingOrNextEffect
   *  Skip the next effect to be played that belongs to the main animation
   *  sequence  or all playing effects.
   *
   *  @return {Boolean}
   *      False if there is no more effect to skip, true otherwise.
   */
  skipPlayingOrNextEffect() {
    this.addA11yStringDelayed(this._labelMap["skip"], 600);
    if (this.isTransitionPlaying()) {
      this.skipTransition();
      return true;
    }
    if (this.isFirstAutoEffectRunning()) {
      this.skipFirstAutoEffect();
      return true;
    }
    if (this.isAnyEffectPlaying())
      return this.skipAllPlayingEffects();
    else
      return this.skipNextEffect();
  }
  /** skipAllEffects
   *  Skip all left effects that belongs to the main animation sequence and all
   *  playing effects on the current slide.
   *
   *  @return {Boolean}
   *      True if it is already skipping or when it has ended skipping,
   *      false if the next slide needs to be displayed.
   */
  skipAllEffects() {
    if (this.bIsSkippingAll)
      return true;
    this.bIsSkippingAll = true;
    if (this.isTransitionPlaying()) {
      this.skipTransition();
    }
    if (this.isFirstAutoEffectRunning()) {
      this.skipFirstAutoEffect();
    }
    if (this.isAnyEffectPlaying()) {
      this.skipAllPlayingEffects();
    } else if (!this.aNextEffectEventArray || this.nCurrentEffect >= this.aNextEffectEventArray.size()) {
      this.bIsSkippingAll = false;
      return false;
    }
    while (this.nCurrentEffect < this.aNextEffectEventArray.size()) {
      this.skipNextEffect();
    }
    this.bIsSkippingAll = false;
    return true;
  }
  /** rewindTransition
   * Rewind the current playing slide transition.
   */
  rewindTransition() {
    if (this.bIsSkipping || this.bIsRewinding)
      return;
    this.bIsRewinding = true;
    this.aActivityQueue.endAll();
    this.update();
    this.bIsRewinding = false;
  }
  /** rewindEffect
   *  Rewind all the effects started after at least one of the current playing
   *  effects. If there is no playing effect, it rewinds the last played one,
   *  both in case it belongs to the main or to an interactive animation sequence.
   *
   */
  rewindEffect() {
    if (this.bIsSkipping || this.bIsRewinding)
      return;
    if (this.automaticAdvanceTimeout !== null && !this.automaticAdvanceTimeoutRewindedEffect) {
      clearTimeout(this.automaticAdvanceTimeout);
      this.automaticAdvanceTimeout = { rewindedEffect: this.nCurrentEffect };
    }
    this.addA11yString(this._labelMap["rewind"]);
    if (!this.hasAnyEffectStarted()) {
      this.rewindToPreviousSlide();
      return;
    }
    this.bIsRewinding = true;
    let nFirstPlayingEffectIndex = void 0;
    let i = 0;
    for (; i < this.aStartedEffectList.length; ++i) {
      const aEffect = this.aStartedEffectList[i];
      if (aEffect.isPlaying()) {
        nFirstPlayingEffectIndex = i;
        break;
      }
    }
    if (nFirstPlayingEffectIndex !== void 0) {
      i = this.aStartedEffectList.length - 1;
      for (; i >= nFirstPlayingEffectIndex; --i) {
        const aEffect = this.aStartedEffectList[i];
        if (aEffect.isPlaying()) {
          if (aEffect.isMainEffect()) {
            this.aEventMultiplexer.notifyRewindCurrentEffectEvent();
            if (this.nCurrentEffect > 0)
              --this.nCurrentEffect;
          } else {
            this.aEventMultiplexer.notifyRewindRunningInteractiveEffectEvent(aEffect.getId());
          }
        } else if (aEffect.isEnded()) {
          if (aEffect.isMainEffect()) {
            this.aEventMultiplexer.notifyRewindLastEffectEvent();
            if (this.nCurrentEffect > 0)
              --this.nCurrentEffect;
          } else {
            this.aEventMultiplexer.notifyRewindEndedInteractiveEffectEvent(aEffect.getId());
          }
        }
      }
      this.update();
      i = this.aStartedEffectList.length - 1;
      for (; i >= nFirstPlayingEffectIndex; --i) {
        const aEffect = this.aStartedEffectList.pop();
        if (!aEffect.isMainEffect())
          this.aStartedEffectIndexMap.delete(aEffect.getId());
      }
    } else {
      const aEffect = this.aStartedEffectList.pop();
      if (!aEffect.isMainEffect())
        this.aStartedEffectIndexMap.delete(aEffect.getId());
      if (aEffect.isEnded()) {
        if (aEffect.isMainEffect()) {
          this.aEventMultiplexer.notifyRewindLastEffectEvent();
          if (this.nCurrentEffect > 0)
            --this.nCurrentEffect;
        } else {
          this.aEventMultiplexer.notifyRewindEndedInteractiveEffectEvent(aEffect.getId());
        }
      }
      this.update();
    }
    this.bIsRewinding = false;
    this.presenter.sendSlideShowFollowMessage("effect " + JSON.stringify({ currentEffect: this.nCurrentEffect - 1 }));
  }
  /** rewindToPreviousSlide
   *  Displays the previous slide with all effects, that belong to the main
   *  animation sequence, played.
   *
   */
  rewindToPreviousSlide() {
    NAVDBG.print("SlideShowHandler.rewindToPreviousSlide");
    if (this.isFirstAutoEffectRunning()) {
      this.rewindFirstAutoEffect();
    }
    if (this.isTransitionPlaying()) {
      this.rewindTransition();
      return;
    }
    if (this.isAnyEffectPlaying())
      return;
    this.slideShowNavigator.rewindToPreviousSlide();
  }
  /** rewindAllEffects
   *  Rewind all effects already played on the current slide.
   *
   */
  rewindAllEffects() {
    this.addA11yString(this._labelMap["rewindAll"]);
    if (!this.hasAnyEffectStarted()) {
      this.rewindToPreviousSlide();
      return;
    }
    while (this.hasAnyEffectStarted()) {
      this.rewindEffect();
    }
  }
  getVideoRenderer(slideHash, videoInfo) {
    return this.slideCompositor.getVideoRenderer(slideHash, videoInfo);
  }
  cleanLeavingSlideStatus(nOldSlide, bSkipSlideTransition) {
    const aMetaDoc = this.theMetaPres;
    if (nOldSlide !== void 0) {
      this.slideCompositor.pauseVideos(aMetaDoc.getSlideHash(nOldSlide));
      const oldMetaSlide = aMetaDoc.getMetaSlideByIndex(nOldSlide);
      if (this.isEnabled()) {
        if (oldMetaSlide.animationsHandler && oldMetaSlide.animationsHandler.isAnimated()) {
          oldMetaSlide.animationsHandler.end(bSkipSlideTransition);
          this.dispose();
        }
      }
      if (this.automaticAdvanceTimeout !== null) {
        clearTimeout(this.automaticAdvanceTimeout);
        this.automaticAdvanceTimeout = null;
      }
    }
  }
  // This method must be invoked by SlideShowNavigator.displaySlide only,
  // since we need to update the current slide index.
  displaySlide(nNewSlide, nOldSlide, bSkipSlideTransition, nSlideEffect = void 0) {
    NAVDBG.print("SlideShowHandler.displaySlide: nNewSlide: " + nNewSlide + ", nOldSlide: " + nOldSlide);
    const aMetaDoc = this.theMetaPres;
    if (nNewSlide >= aMetaDoc.numberOfSlides) {
      this.exitSlideShow();
    }
    this.clearPendingA11ySlideContent();
    this.clearPendingA11yStrings();
    if (this.theMetaPres.numberOfSlides - 1 == nNewSlide) {
      this.addA11yString(this._labelMap["lastPage"]);
    } else if (nNewSlide == 0) {
      this.addA11yString(this._labelMap["firstPage"]);
    } else if (nNewSlide == nOldSlide + 1) {
      this.addA11yString(this._labelMap["nextPage"]);
    } else if (nNewSlide == nOldSlide - 1) {
      this.addA11yString(this._labelMap["prevPage"]);
    }
    if (this.isTransitionPlaying()) {
      this.skipTransition();
    }
    if (this.isFirstAutoEffectRunning()) {
      this.skipFirstAutoEffect();
    }
    if (nOldSlide !== void 0) {
      this.cleanLeavingSlideStatus(nOldSlide, bSkipSlideTransition);
    }
    this.notifySlideStart(nNewSlide, nOldSlide);
    if (this.isEnabled() && this.isGlSupported() && !bSkipSlideTransition) {
      if (nOldSlide === void 0 && this.isStarting || nOldSlide !== void 0 && nNewSlide > nOldSlide) {
        const aNewMetaSlide = aMetaDoc.getMetaSlideByIndex(nNewSlide);
        const aSlideTransitionHandler = aNewMetaSlide.transitionHandler;
        if (aSlideTransitionHandler && aSlideTransitionHandler.isValid()) {
          const aTransitionEndEvent = makeEvent(this.notifyTransitionEnd.bind(this, nNewSlide, nOldSlide));
          try {
            const transitionParameters = this.createTransitionParameters(nNewSlide, nOldSlide);
            this.enteringSlideTexture = transitionParameters.next;
            const aTransitionActivity = this.createSlideTransition(aSlideTransitionHandler, transitionParameters, aTransitionEndEvent);
            if (aTransitionActivity) {
              this.bIsTransitionRunning = true;
              this.slideRenderer.pauseRendering();
              this.aActivityQueue.addActivity(aTransitionActivity);
              this.update();
              this.presenter.stopLoader();
              return;
            }
          } catch (message) {
            app.console.error("displaySlide failed: " + message);
          }
        }
      }
    }
    this.notifyTransitionEnd(nNewSlide, nOldSlide);
    if (nSlideEffect !== void 0)
      this.skipNEffects(nSlideEffect);
  }
  exitSlideShow() {
    this.clearPendingA11ySlideContent();
    this.addA11yString(this._labelMap["quit"]);
    this.automaticAdvanceTimeout = null;
    this.bIsAutomaticAdvancePaused = false;
    this.nAutomaticAdvanceRemaining = 0;
  }
  update() {
    this.aTimer.holdTimer();
    this.aTimerEventQueue.process();
    this.aActivityQueue.process();
    this.aActivityQueue.processDequeued();
    this.aTimer.releaseTimer();
    const bActivitiesLeft = !this.aActivityQueue.isEmpty();
    const bTimerEventsLeft = !this.aTimerEventQueue.isEmpty();
    this.cancelNextUpdate();
    const renderer = this.slideRenderer;
    if (bActivitiesLeft) {
      this.bIsIdle = false;
      this.nNextUpdateFrame = app.timerRegistry.requestAnimationFrame("slideshowupdate", this.updateHandler, renderer ? renderer.canvasWindow : window);
    } else if (bTimerEventsLeft) {
      let nNextTimeout = this.aTimerEventQueue.nextTimeout();
      if (nNextTimeout < _SlideShowHandler.MINIMUM_TIMEOUT)
        nNextTimeout = _SlideShowHandler.MINIMUM_TIMEOUT;
      else if (nNextTimeout > _SlideShowHandler.MAXIMUM_TIMEOUT)
        nNextTimeout = _SlideShowHandler.MAXIMUM_TIMEOUT;
      this.bIsIdle = false;
      this.nNextUpdateTimeout = app.timerRegistry.setTimeout("slideshowupdate", this.updateHandler, nNextTimeout * 1e3);
    } else {
      this.bIsIdle = true;
    }
    if (renderer)
      renderer.renderPendingFrame();
  }
  cancelNextUpdate() {
    if (this.nNextUpdateFrame !== null)
      app.timerRegistry.cancelAnimationFrame(this.nNextUpdateFrame);
    if (this.nNextUpdateTimeout !== null)
      app.timerRegistry.clearTimeout(this.nNextUpdateTimeout);
    this.nNextUpdateFrame = null;
    this.nNextUpdateTimeout = null;
  }
  dispose() {
    this.aTimerEventQueue.clear();
    this.aActivityQueue.clear();
    this.aNextEffectEventArray = null;
    this.aEventMultiplexer = null;
    this.automaticAdvanceTimeout = null;
  }
  getContext() {
    return this._context;
  }
  get slideRenderer() {
    return this.presenter._slideRenderer;
  }
  get slideCompositor() {
    return this.presenter._slideCompositor;
  }
  getSlideInfo(nSlideIndex) {
    return this.theMetaPres.getSlideInfoByIndex(nSlideIndex);
  }
  getAnimatedLayerInfo(slideHash, targetElement) {
    return this.slideCompositor.getAnimatedLayerInfo(slideHash, targetElement);
  }
  isMipMapsEnable(transitionFilterInfo) {
    return transitionFilterInfo.transitionType === TransitionType.MISCSHAPEWIPE && this.transitionsWithMipMapEnabled.has(transitionFilterInfo.transitionSubtype);
  }
  getTexture(nSlideIndex, transitionFilterInfo) {
    const isMipMapEnable = this.isMipMapsEnableFor(transitionFilterInfo);
    const slideTexture = this.slideRenderer.createSlideTexture(nSlideIndex, isMipMapEnable);
    if (slideTexture)
      return slideTexture;
    const slideImage = this.slideCompositor.getSlide(nSlideIndex);
    if (!slideImage) {
      app.console.error("SlideShowHandler: cannot get texture");
      return null;
    }
    return this.slideRenderer.createTexture(slideImage, isMipMapEnable);
  }
  isMipMapsEnableFor(transitionFilterInfo) {
    return !!transitionFilterInfo && !!transitionFilterInfo.transitionType && !!transitionFilterInfo.transitionSubtype && this.isMipMapsEnable(transitionFilterInfo);
  }
  presentSlide(nSlideIndex) {
    const slideInfo = this.getSlideInfo(nSlideIndex);
    if (slideInfo.a11y) {
      this.addA11ySlideContent(slideInfo.a11y);
    }
    let slideTexture = this.enteringSlideTexture;
    if (!slideTexture)
      slideTexture = this.getTexture(nSlideIndex);
    this.slideRenderer.renderSlide(slideTexture, this.getSlideInfo(nSlideIndex));
    this.presenter.stopLoader();
  }
  createTransitionParameters(nNewSlide, nOldSlide) {
    let leavingSlideTexture = null;
    const transitionFilterInfo = TransitionFilterInfo.fromSlideInfo(this.getSlideInfo(nNewSlide));
    if (this.isStarting) {
      leavingSlideTexture = this.slideRenderer.createEmptyTexture();
    } else {
      leavingSlideTexture = nOldSlide !== void 0 && this.slideRenderer.lastRenderedSlideIndex === nOldSlide ? this.slideRenderer.getSlideTexture() : this.getTexture(nOldSlide, transitionFilterInfo);
    }
    const enteringSlideTexture = this.getTexture(nNewSlide, transitionFilterInfo);
    const transitionParameters = new TransitionParameters();
    transitionParameters.context = this.slideRenderer._context;
    transitionParameters.current = leavingSlideTexture;
    transitionParameters.next = enteringSlideTexture;
    transitionParameters.transitionFilterInfo = transitionFilterInfo;
    const isLeavingSlideMoving = !this.isStarting && nOldSlide !== void 0 && this.slideCompositor.hasMasterVideos(nOldSlide);
    const isEnteringSlideMoving = this.slideCompositor.hasMasterVideos(nNewSlide);
    if (isLeavingSlideMoving || isEnteringSlideMoving) {
      const isMipMapEnable = this.isMipMapsEnableFor(transitionFilterInfo);
      let leavingSlideFrames = -1;
      let enteringSlideFrames = -1;
      transitionParameters.refreshSlides = () => {
        if (isLeavingSlideMoving)
          leavingSlideFrames = this.refreshSlideTexture(leavingSlideTexture, nOldSlide, leavingSlideFrames, isMipMapEnable);
        if (isEnteringSlideMoving)
          enteringSlideFrames = this.refreshSlideTexture(enteringSlideTexture, nNewSlide, enteringSlideFrames, isMipMapEnable);
      };
    }
    return transitionParameters;
  }
  // Draw the slide as it is now into texture, if its videos have shown a new frame since
  // drawnFrames. Returns the frame count the texture now shows.
  refreshSlideTexture(texture, nSlideIndex, drawnFrames, isMipMapEnable) {
    const frames = this.slideCompositor.getMasterVideoFrames(nSlideIndex);
    if (frames !== drawnFrames)
      this.slideRenderer.refreshSlideTexture(texture, nSlideIndex, isMipMapEnable);
    return frames;
  }
  notifyFirstAutoEffectStarted() {
    app.console.debug("SlideShowHandler.notifyFirstAutoEffectStarted");
    this.bIsFirstAutoEffectRunning = true;
  }
  notifyFirstAutoEffectEnded() {
    app.console.debug("SlideShowHandler.notifyFirstAutoEffectEnded");
    this.bIsFirstAutoEffectRunning = false;
  }
  isFirstAutoEffectRunning() {
    return this.bIsFirstAutoEffectRunning;
  }
  skipFirstAutoEffect() {
    app.console.debug("SlideShowHandler.skipFirstAutoEffect");
    this.bIsSkipping = true;
    this.aEventMultiplexer.notifySkipEffectEvent();
    this.update();
    this.bIsSkipping = false;
  }
  rewindFirstAutoEffect() {
    this.bIsRewinding = true;
    this.aEventMultiplexer.notifyRewindCurrentEffectEvent();
    this.update();
    this.bIsRewinding = false;
  }
};
_SlideShowHandler.MAXIMUM_FRAME_COUNT = 120;
_SlideShowHandler.MINIMUM_TIMEOUT = 1 / _SlideShowHandler.MAXIMUM_FRAME_COUNT;
_SlideShowHandler.MAXIMUM_TIMEOUT = 4;
_SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS = 10;
_SlideShowHandler.A11Y_TRANSITION_DELAY = 1e3;
_SlideShowHandler.A11Y_SLIDE_CONTENT_DELAY = 2e3;
let SlideShowHandler = _SlideShowHandler;
