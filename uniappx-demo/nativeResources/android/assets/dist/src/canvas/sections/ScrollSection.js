var cool;
(function(cool2) {
  const _ScrollSection = class _ScrollSection extends CanvasSectionObject {
    constructor(isRTL) {
      super(app.CSections.Scroll.name);
      this.processingOrder = app.CSections.Scroll.processingOrder;
      this.drawingOrder = app.CSections.Scroll.drawingOrder;
      this.zIndex = app.CSections.Scroll.zIndex;
      this.windowSection = true;
      this.autoScrollVelocity = null;
      this.pendingScrollEvent = null;
      this.stepByStepScrolling = false;
      this.onEscapeKey = (event) => {
        if (event.key !== "Escape")
          return;
        const before = this.sectionProperties.viewBeforeTheBarDrag;
        const onABar = this.sectionProperties.clickScrollVertical || this.sectionProperties.clickScrollHorizontal;
        if (!onABar || !before)
          return;
        event.preventDefault();
        event.stopPropagation();
        this.sectionProperties.clickScrollVertical = false;
        this.sectionProperties.clickScrollHorizontal = false;
        this.sectionProperties.viewAtDragStart = null;
        this.sectionProperties.viewBeforeTheBarDrag = null;
        this.listenForEscape(false);
        app.sectionContainer.cancelDragging();
        app.activeDocument.activeLayout.showAtTheMiddle(before);
      };
      this.map = window.L.Map.THIS;
      this.isRTL = isRTL ?? (() => false);
      this.map.on("scrollby", this.onScrollBy, this);
      this.map.on("scrollvelocity", this.onScrollVelocity, this);
      this.map.on("handleautoscroll", this.onHandleAutoScroll, this);
    }
    onInitialize() {
      this.sectionProperties.viewAtDragStart = null;
      this.sectionProperties.scrollBarThickness = 6 * app.roundedDpiScale;
      this.sectionProperties.drawScrollBarRailway = true;
      this.sectionProperties.scrollBarRailwayThickness = 6 * app.roundedDpiScale;
      this.sectionProperties.scrollBarRailwayAlpha = this.map._docLayer._docType === "spreadsheet" ? 1 : 0.5;
      this.refreshScrollBarColors();
      this.map.on("darkmodechanged", this.refreshScrollBarColors, this);
      this.sectionProperties.drawVerticalScrollBar = window.mode.isDesktop() ? true : false;
      this.sectionProperties.drawHorizontalScrollBar = window.mode.isDesktop() ? true : false;
      this.sectionProperties.clickScrollVertical = false;
      this.sectionProperties.clickScrollHorizontal = false;
      this.sectionProperties.mouseIsOnVerticalScrollBar = false;
      this.sectionProperties.mouseIsOnHorizontalScrollBar = false;
      this.sectionProperties.minimumScrollSize = 80 * app.roundedDpiScale;
      this.sectionProperties.circleSliderRadius = 24 * app.roundedDpiScale;
      this.sectionProperties.arrowCornerLength = 10 * app.roundedDpiScale;
      this.sectionProperties.alphaWhenVisible = 0.5;
      this.sectionProperties.alphaWhenBeingUsed = 0.8;
      this.sectionProperties.currentAlpha = 1;
      this.sectionProperties.idleDuration = 2e3;
      this.sectionProperties.fadeOutStartingTime = 1800;
      this.sectionProperties.fadeOutDuration = this.sectionProperties.idleDuration - this.sectionProperties.fadeOutStartingTime;
      this.sectionProperties.animatingScroll = false;
      this.sectionProperties.reducedMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
      this.updateAnimateWheelScroll();
      if (this.sectionProperties.reducedMotionQuery) {
        this.sectionProperties.reducedMotionQuery.addEventListener("change", this.updateAnimateWheelScroll.bind(this));
      }
      this.sectionProperties.lastElapsedTime = 0;
      this.sectionProperties.scrollAnimationDelta = [0, 0];
      this.sectionProperties.scrollAnimationAcc = [0, 0];
      this.sectionProperties.scrollAnimationVelocity = [0, 0];
      this.sectionProperties.scrollAnimationDirection = [0, 0];
      this.sectionProperties.scrollAnimationDisableTimeout = null;
      this.sectionProperties.scrollWheelDelta = [0, 0];
      this.sectionProperties.stepDuration = 50;
      this.sectionProperties.quickScrollHorizontalTimer = null;
      this.sectionProperties.scrollQuirks = true;
      this.sectionProperties.alwaysDrawVerticalScrollBar = this.map._docLayer._docType === "spreadsheet" && !window.mode.isDesktop() || app.map.getDocType() === "text" && window.mode.isDesktop();
    }
    updateAnimateWheelScroll() {
      const reduceMotion = this.sectionProperties.reducedMotionQuery !== null && this.sectionProperties.reducedMotionQuery.matches;
      const isMac = window.L.Browser.mac;
      const smoothScroll = window.prefs.getBoolean("smoothScroll", true);
      this.sectionProperties.animateWheelScroll = window.mode.isDesktop() && !reduceMotion && !isMac && smoothScroll;
    }
    completePendingScroll() {
      if (this.pendingScrollEvent) {
        this.onScrollTo(this.pendingScrollEvent);
        this.pendingScrollEvent = null;
      }
    }
    refreshScrollBarColors() {
      const style = getComputedStyle(document.documentElement);
      this.sectionProperties.scrollBarThumbColor = style.getPropertyValue("--color-scrollbar-thumb").trim() || "#7E8182";
      this.sectionProperties.scrollBarRailwayColor = style.getPropertyValue("--color-scrollbar-railway").trim() || "#EFEFEF";
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onScrollTo(e) {
      if (!this.containerObject.drawingAllowed()) {
        this.pendingScrollEvent = e;
        return;
      }
      app.activeDocument.activeLayout.scrollTo(e.x, e.y);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onScrollBy(e) {
      app.activeDocument.activeLayout.scroll(e.x, e.y);
    }
    cancelAutoScroll() {
      if (this.autoScrollTimer !== null) {
        app.timerRegistry.clearInterval(this.autoScrollTimer);
        this.autoScrollTimer = null;
      }
      this.autoScrollVelocity = null;
      this.map.isAutoScrolling = false;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onScrollVelocity(e) {
      if (e.vx === 0 && e.vy === 0) {
        this.cancelAutoScroll();
        return;
      }
      if (this.autoScrollTimer !== null && this.autoScrollVelocity !== null && this.autoScrollVelocity.x === e.vx && this.autoScrollVelocity.y === e.vy)
        return;
      this.cancelAutoScroll();
      this.autoScrollVelocity = { x: e.vx, y: e.vy };
      this.map.isAutoScrolling = true;
      this.autoScrollTimer = app.timerRegistry.setInterval("autoscroll", window.L.bind(function() {
        this.onScrollBy({ x: e.vx, y: e.vy });
      }, this), 100);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onHandleAutoScroll(e) {
      var vx = 0;
      var vy = 0;
      const layout = app.activeDocument.activeLayout;
      const roomBefore = layout.laysRoomBeforeTheDocument();
      const topLeftX = roomBefore ? layout.scrollProperties.viewX / app.dpiScale : layout.viewedRectangle.cX1;
      const topLeftY = roomBefore ? layout.scrollProperties.viewY / app.dpiScale : layout.viewedRectangle.cY1;
      const frame = app.activeDocument.activeLayout.frameSize;
      const band = 50;
      const calmStep = 25;
      const calmPastTheEdge = 30;
      const doublingDistance = 75;
      const largestStep = 150;
      const stepFor = (intoTheBand) => {
        if (!roomBefore)
          return band;
        const beyondTheCalm = Math.max(0, intoTheBand - band - calmPastTheEdge);
        return Math.min(largestStep, calmStep * Math.pow(2, beyondTheCalm / doublingDistance));
      };
      const roomNeeded = roomBefore ? 0 : band;
      if (e.pos.y > frame.cY - band) {
        vy = stepFor(e.pos.y - (frame.cY - band));
      } else if (e.pos.y < band && topLeftY > roomNeeded) {
        vy = -stepFor(band - e.pos.y);
      }
      const mousePosX = this.isRTL() ? frame.cX - e.pos.x : e.pos.x;
      const mapLeft = this.isRTL() ? frame.cX - topLeftX : topLeftX;
      if (mousePosX > frame.cX - band) {
        vx = stepFor(mousePosX - (frame.cX - band));
      } else if (mousePosX < band && mapLeft > roomNeeded) {
        vx = -stepFor(band - mousePosX);
      }
      this.onScrollVelocity({ vx, vy, pos: e.pos });
    }
    DrawVerticalScrollBarMobile() {
      const scrollProps = app.activeDocument.activeLayout.scrollProperties;
      this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? this.sectionProperties.alphaWhenBeingUsed : this.sectionProperties.alphaWhenVisible;
      this.context.strokeStyle = "#7E8182";
      this.context.fillStyle = "white";
      var circleStartY = scrollProps.startY + this.sectionProperties.circleSliderRadius;
      var circleStartX = this.isRTL() ? this.sectionProperties.circleSliderRadius * 0.5 : this.size[0] - this.sectionProperties.circleSliderRadius * 0.5;
      this.context.beginPath();
      this.context.arc(circleStartX, circleStartY, this.sectionProperties.circleSliderRadius, 0, Math.PI * 2, true);
      this.context.fill();
      this.context.stroke();
      this.context.fillStyle = "#7E8182";
      this.context.beginPath();
      var x = circleStartX - this.sectionProperties.arrowCornerLength * 0.5;
      var y = circleStartY - 5 * app.roundedDpiScale;
      this.context.moveTo(x, y);
      x += this.sectionProperties.arrowCornerLength;
      this.context.lineTo(x, y);
      x -= this.sectionProperties.arrowCornerLength * 0.5;
      y -= Math.sin(Math.PI / 3) * this.sectionProperties.arrowCornerLength;
      this.context.lineTo(x, y);
      x -= this.sectionProperties.arrowCornerLength * 0.5;
      y += Math.sin(Math.PI / 3) * this.sectionProperties.arrowCornerLength;
      this.context.lineTo(x, y);
      this.context.fill();
      x = circleStartX - this.sectionProperties.arrowCornerLength * 0.5;
      y = circleStartY + 5 * app.roundedDpiScale;
      this.context.moveTo(x, y);
      x += this.sectionProperties.arrowCornerLength;
      this.context.lineTo(x, y);
      x -= this.sectionProperties.arrowCornerLength * 0.5;
      y += Math.sin(Math.PI / 3) * this.sectionProperties.arrowCornerLength;
      this.context.lineTo(x, y);
      x -= this.sectionProperties.arrowCornerLength * 0.5;
      y -= Math.sin(Math.PI / 3) * this.sectionProperties.arrowCornerLength;
      this.context.lineTo(x, y);
      this.context.fill();
      this.context.globalAlpha = 1;
    }
    drawVerticalScrollBar() {
      const scrollProps = app.activeDocument.activeLayout.scrollProperties;
      const isDarkBackground = this.map.uiManager.isBackgroundDark();
      const docType = app.map._docLayer._docType;
      var startX = this.isRTL() ? scrollProps.edgeOffset : this.size[0] - this.sectionProperties.scrollBarThickness - scrollProps.edgeOffset;
      if (isDarkBackground && (docType === "text" || docType === "drawing")) {
        this.sectionProperties.scrollBarRailwayColor = "transparent";
      }
      if (this.sectionProperties.drawScrollBarRailway) {
        this.context.globalAlpha = this.sectionProperties.scrollBarRailwayAlpha;
        this.context.fillStyle = this.sectionProperties.scrollBarRailwayColor;
        this.context.fillRect(this.myTopLeft[0] + this.size[0] - scrollProps.edgeOffset - this.sectionProperties.scrollBarRailwayThickness, scrollProps.verticalScrollRailwayOffset, this.sectionProperties.scrollBarRailwayThickness, scrollProps.verticalScrollRailwayLength);
      }
      this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? this.sectionProperties.alphaWhenBeingUsed : this.sectionProperties.alphaWhenVisible;
      this.context.fillStyle = this.sectionProperties.scrollBarThumbColor;
      this.context.fillRect(startX, scrollProps.startY, this.sectionProperties.scrollBarThickness, scrollProps.verticalScrollSize - this.sectionProperties.scrollBarThickness);
      this.context.globalAlpha = 1;
      if (this.containerObject.testing) {
        var element = document.getElementById("test-div-vertical-scrollbar");
        if (!element) {
          element = document.createElement("div");
          element.id = "test-div-vertical-scrollbar";
          document.body.appendChild(element);
        }
        element.textContent = String(scrollProps.startY);
        element.style.display = "none";
        element.style.position = "fixed";
        element.style.zIndex = "-1";
      }
    }
    drawHorizontalScrollBar() {
      const scrollProps = app.activeDocument.activeLayout.scrollProperties;
      var startY = this.size[1] - this.sectionProperties.scrollBarThickness - scrollProps.edgeOffset;
      const sizeX = scrollProps.horizontalScrollSize - this.sectionProperties.scrollBarThickness;
      const docWidth = app.sectionContainer.getWidth();
      const startX = this.isRTL() ? docWidth - scrollProps.startX - sizeX : scrollProps.startX;
      if (this.sectionProperties.drawScrollBarRailway) {
        this.context.globalAlpha = this.sectionProperties.scrollBarRailwayAlpha;
        this.context.fillStyle = this.sectionProperties.scrollBarRailwayColor;
        this.context.fillRect(scrollProps.horizontalScrollRailwayOffset, this.myTopLeft[1] + this.size[1] - scrollProps.edgeOffset - this.sectionProperties.scrollBarRailwayThickness, scrollProps.horizontalScrollRailwayLength, this.sectionProperties.scrollBarRailwayThickness);
      }
      this.context.globalAlpha = this.sectionProperties.clickScrollHorizontal ? this.sectionProperties.alphaWhenBeingUsed : this.sectionProperties.alphaWhenVisible;
      this.context.fillStyle = this.sectionProperties.scrollBarThumbColor;
      this.context.fillRect(startX, startY, sizeX, this.sectionProperties.scrollBarThickness);
      this.context.globalAlpha = 1;
      if (this.containerObject.testing) {
        var element = document.getElementById("test-div-horizontal-scrollbar");
        if (!element) {
          element = document.createElement("div");
          element.id = "test-div-horizontal-scrollbar";
          document.body.appendChild(element);
        }
        element.textContent = String(scrollProps.startX);
        element.style.display = "none";
        element.style.position = "fixed";
        element.style.zIndex = "-1";
      }
    }
    calculateCurrentAlpha(elapsedTime) {
      if (elapsedTime >= this.sectionProperties.fadeOutStartingTime) {
        this.sectionProperties.currentAlpha = Math.max((1 - (elapsedTime - this.sectionProperties.fadeOutStartingTime) / this.sectionProperties.fadeOutDuration) * this.sectionProperties.alphaWhenVisible, 0.1);
      } else {
        this.sectionProperties.currentAlpha = this.sectionProperties.alphaWhenVisible;
      }
    }
    onDraw(frameCount, elapsedTime) {
      app.activeDocument.activeLayout.refreshScrollProperties();
      if (this.isAnimating && frameCount >= 0)
        this.calculateCurrentAlpha(elapsedTime);
      if (this.sectionProperties.drawVerticalScrollBar || this.sectionProperties.alwaysDrawVerticalScrollBar) {
        if (window.mode.isSmallScreenDevice())
          this.DrawVerticalScrollBarMobile();
        else
          this.drawVerticalScrollBar();
      }
      if (this.sectionProperties.drawHorizontalScrollBar) {
        this.drawHorizontalScrollBar();
      }
    }
    onAnimate(frameCount, elapsedTime) {
      const timeDelta = (elapsedTime - this.sectionProperties.lastElapsedTime) / (1e3 / 60);
      if (this.sectionProperties.animatingScroll) {
        const lineHeight = this.containerObject.getScrollLineHeight();
        const accel = lineHeight * _ScrollSection.scrollAnimationAcceleration * timeDelta * app.dpiScale;
        const deltas = [0, 0];
        for (let i = 0; i < 2; ++i) {
          const sign = this.sectionProperties.scrollAnimationDirection[i];
          this.sectionProperties.scrollAnimationAcc[i] += this.sectionProperties.scrollAnimationDelta[i];
          this.sectionProperties.scrollAnimationDelta[i] = 0;
          this.sectionProperties.scrollAnimationVelocity[i] += this.sectionProperties.scrollAnimationAcc[i] != 0 ? accel : -accel;
          this.sectionProperties.scrollAnimationVelocity[i] = Math.max(0, this.sectionProperties.scrollAnimationVelocity[i]);
          deltas[i] = this.sectionProperties.scrollAnimationVelocity[i] * sign;
          if (Math.abs(deltas[i]) >= Math.abs(this.sectionProperties.scrollAnimationAcc[i]))
            this.sectionProperties.scrollAnimationAcc[i] = 0;
          else
            this.sectionProperties.scrollAnimationAcc[i] -= deltas[i];
        }
        if (deltas[0] !== 0)
          this.scrollHorizontalWithOffset(deltas[0]);
        if (deltas[1] !== 0)
          this.scrollVerticalWithOffset(deltas[1]);
      } else {
        if (this.sectionProperties.scrollWheelDelta[0] !== 0) {
          const delta = this.sectionProperties.scrollWheelDelta[0];
          this.sectionProperties.scrollWheelDelta[0] = 0;
          this.scrollHorizontalWithOffset(delta);
        }
        if (this.sectionProperties.scrollWheelDelta[1] !== 0) {
          const delta = this.sectionProperties.scrollWheelDelta[1];
          this.sectionProperties.scrollWheelDelta[1] = 0;
          this.scrollVerticalWithOffset(delta);
        }
      }
      this.sectionProperties.lastElapsedTime = elapsedTime;
      const animatingScrollbar = elapsedTime && elapsedTime < this.sectionProperties.fadeOutDuration;
      const animatingScroll = this.sectionProperties.animatingScroll && (timeDelta <= 0 || this.sectionProperties.scrollAnimationVelocity.reduce((a, x) => a + x, 0) !== 0);
      if (!animatingScrollbar && !animatingScroll)
        this.containerObject.stopAnimating();
    }
    onAnimationEnded(frameCount, elapsedTime) {
      this.sectionProperties.animatingScroll = false;
      this.sectionProperties.scrollAnimationAcc = [0, 0];
      this.sectionProperties.scrollAnimationVelocity = [0, 0];
      this.sectionProperties.scrollAnimationDirection = [0, 0];
    }
    increaseScrollBarThickness() {
      this.sectionProperties.scrollBarThickness = this.sectionProperties.scrollBarRailwayThickness = 8 * app.roundedDpiScale;
      this.containerObject.requestReDraw();
    }
    decreaseScrollBarThickness() {
      this.sectionProperties.scrollBarThickness = this.sectionProperties.scrollBarRailwayThickness = 6 * app.roundedDpiScale;
      this.containerObject.requestReDraw();
    }
    hideHorizontalScrollBar() {
      this.sectionProperties.drawHorizontalScrollBar = false;
      if (this.sectionProperties.mouseIsOnHorizontalScrollBar) {
        this.sectionProperties.mouseIsOnHorizontalScrollBar = false;
      }
      this.decreaseScrollBarThickness();
    }
    hideVerticalScrollBar() {
      if (this.sectionProperties.mouseIsOnVerticalScrollBar) {
        this.sectionProperties.mouseIsOnVerticalScrollBar = false;
      }
      this.decreaseScrollBarThickness();
      if (!window.mode.isDesktop() || app.map._docLayer._docType !== "spreadsheet") {
        this.sectionProperties.drawVerticalScrollBar = false;
      }
    }
    showHorizontalScrollBar() {
      this.sectionProperties.drawHorizontalScrollBar = true;
      setTimeout(() => {
        if (this.sectionProperties.mouseIsOnHorizontalScrollBar) {
          this.increaseScrollBarThickness();
        }
      }, 100);
      if (!this.containerObject.isDraggingSomething() && !window.mode.isDesktop())
        this.containerObject.requestReDraw();
    }
    showVerticalScrollBar() {
      this.sectionProperties.drawVerticalScrollBar = true;
      setTimeout(() => {
        if (this.sectionProperties.mouseIsOnVerticalScrollBar) {
          this.increaseScrollBarThickness();
        }
      }, 100);
      if (!this.containerObject.isDraggingSomething() && !window.mode.isDesktop())
        this.containerObject.requestReDraw();
    }
    setCursorForScrollBar() {
      this.context.canvas.style.cursor = "pointer";
      if (this.context.canvas.classList.contains("spreadsheet-cursor"))
        this.context.canvas.classList.remove("spreadsheet-cursor");
    }
    isMouseOnScrollBar(point) {
      const scrollProps = app.activeDocument.activeLayout.scrollProperties;
      const documentAnchor = app.sectionContainer.getSectionWithName(app.CSections.Tiles.name);
      const mirrorX = this.isRTL();
      let temp = point.pY >= this.size[1] - scrollProps.usableThickness;
      temp = temp && (!mirrorX && point.pX <= this.size[0] - scrollProps.horizontalScrollRightOffset && point.pX >= scrollProps.xOffset || mirrorX && point.pX >= scrollProps.horizontalScrollRightOffset && point.pX >= scrollProps.xOffset);
      this.sectionProperties.mouseIsOnHorizontalScrollBar = temp;
      if (app.activeDocument.activeLayout.canScrollHorizontal(documentAnchor)) {
        if (window.mode.isDesktop() || this.sectionProperties.mouseIsOnHorizontalScrollBar)
          this.showHorizontalScrollBar();
        else if (this.sectionProperties.drawHorizontalScrollBar === true)
          this.hideHorizontalScrollBar();
      } else if (this.sectionProperties.drawHorizontalScrollBar === true)
        this.hideHorizontalScrollBar();
      temp = point.pX >= this.size[0] - scrollProps.usableThickness;
      temp = temp && (!mirrorX && point.pX >= this.size[0] - scrollProps.usableThickness) || mirrorX && point.pX <= scrollProps.usableThickness;
      this.sectionProperties.mouseIsOnVerticalScrollBar = temp;
      if (app.activeDocument.activeLayout.canScrollVertical(documentAnchor)) {
        if (window.mode.isDesktop() || this.sectionProperties.mouseIsOnVerticalScrollBar)
          this.showVerticalScrollBar();
        else
          this.hideVerticalScrollBar();
      } else
        this.hideVerticalScrollBar();
      if (this.sectionProperties.mouseIsOnHorizontalScrollBar || this.sectionProperties.mouseIsOnVerticalScrollBar) {
        this.setCursorForScrollBar();
      }
    }
    onMouseLeave() {
      this.hideVerticalScrollBar();
      this.hideHorizontalScrollBar();
    }
    scrollVerticalWithOffset(offset) {
      if (!app.activeDocument.activeLayout.canScrollVertical(app.sectionContainer.getSectionWithName(app.CSections.Tiles.name)))
        return;
      const userIsScrolling = true;
      app.activeDocument.activeLayout.scroll(0, offset, userIsScrolling);
      if (app.file.fileBasedView)
        this.map._docLayer._checkSelectedPart();
      return true;
    }
    scrollHorizontalWithOffset(offset) {
      if (!app.activeDocument.activeLayout.canScrollHorizontal(app.sectionContainer.getSectionWithName(app.CSections.Tiles.name)))
        return;
      const userIsScrolling = true;
      app.activeDocument.activeLayout.scroll(offset, 0, userIsScrolling);
      return true;
    }
    onMouseMove(position, dragDistance, e) {
      const scrollProps = app.activeDocument.activeLayout.scrollProperties;
      this.clearQuickScrollTimeout();
      if (this.sectionProperties.clickScrollVertical && this.containerObject.isDraggingSomething()) {
        if (!this.sectionProperties.viewAtDragStart)
          this.sectionProperties.viewAtDragStart = [scrollProps.viewX, scrollProps.viewY];
        this.showVerticalScrollBar();
        const wantedY = this.sectionProperties.viewAtDragStart[1] + dragDistance[1] * scrollProps.verticalScrollRatio;
        this.scrollVerticalWithOffset(wantedY - scrollProps.viewY);
        this.stopPropagating();
      } else if (this.sectionProperties.clickScrollHorizontal && this.containerObject.isDraggingSomething()) {
        if (!this.sectionProperties.viewAtDragStart)
          this.sectionProperties.viewAtDragStart = [scrollProps.viewX, scrollProps.viewY];
        this.showHorizontalScrollBar();
        const sign = this.isRTL() ? -1 : 1;
        this.scrollHorizontalWithOffset(sign * (this.sectionProperties.viewAtDragStart[0] - scrollProps.viewX) + dragDistance[0] * scrollProps.horizontalScrollRatio);
        this.stopPropagating();
      } else {
        const draggingOnDocument = this.containerObject.isDraggingSomething();
        this.isMouseOnScrollBar(position);
        const onScrollBar = this.sectionProperties.mouseIsOnVerticalScrollBar || this.sectionProperties.mouseIsOnHorizontalScrollBar;
        if (!draggingOnDocument && onScrollBar)
          this.stopPropagating();
      }
    }
    /*
        When user presses the button while the mouse pointer is on the railway of the scroll bar but not on the scroll bar directly,
        we quickly scroll the document to that position.
    */
    quickScrollVertical(point, originalSign) {
      if (!window.mode.isDesktop())
        return;
      window.L.DomUtil.addClass(document.documentElement, "prevent-select");
      const scrollProps = app.activeDocument.activeLayout.scrollProperties;
      if (this.stepByStepScrolling) {
        var sign = point.pY - (scrollProps.startY + scrollProps.verticalScrollSize) > 0 ? 1 : point.pY - scrollProps.startY < 0 ? -1 : 0;
        var offset = scrollProps.verticalScrollStep * sign;
        if (this.sectionProperties.quickScrollVerticalTimer)
          clearTimeout(this.sectionProperties.quickScrollVerticalTimer);
        if (this.sectionProperties.clickScrollVertical)
          this.sectionProperties.quickScrollVerticalTimer = setTimeout(() => {
            if (!originalSign || originalSign === sign) {
              this.quickScrollVertical(point, sign);
            }
          }, this.sectionProperties.stepDuration);
      } else {
        offset = (point.pY - (scrollProps.startY + scrollProps.verticalScrollSize * 0.5)) * scrollProps.verticalScrollRatio;
      }
      this.scrollVerticalWithOffset(offset);
    }
    /*
        When user presses the button while the mouse pointer is on the railway of the scroll bar but not on the scroll bar directly,
        we quickly scroll the document to that position.
    */
    quickScrollHorizontal(point, originalSign) {
      if (!window.mode.isDesktop())
        return;
      window.L.DomUtil.addClass(document.documentElement, "prevent-select");
      const scrollProps = app.activeDocument.activeLayout.scrollProperties;
      const sizeX = scrollProps.horizontalScrollSize - this.sectionProperties.scrollBarThickness;
      const docWidth = app.sectionContainer.getWidth();
      const startX = this.isRTL() ? docWidth - scrollProps.startX - sizeX : scrollProps.startX;
      if (this.stepByStepScrolling) {
        var sign = point.pX - (startX + sizeX) > 0 ? 1 : point.pX - startX < 0 ? -1 : 0;
        var offset = scrollProps.horizontalScrollStep * sign;
        if (this.sectionProperties.quickScrollHorizontalTimer)
          clearTimeout(this.sectionProperties.quickScrollHorizontalTimer);
        if (this.sectionProperties.clickScrollHorizontal)
          this.sectionProperties.quickScrollHorizontalTimer = setTimeout(() => {
            if (!originalSign || originalSign === sign) {
              this.quickScrollHorizontal(point, sign);
            }
          }, this.sectionProperties.stepDuration);
      } else {
        offset = (point.pX - (scrollProps.startX + scrollProps.horizontalScrollSize * 0.5)) * scrollProps.horizontalScrollRatio;
      }
      this.scrollHorizontalWithOffset(offset);
    }
    clearQuickScrollTimeout() {
      if (this.sectionProperties.quickScrollVerticalTimer) {
        clearTimeout(this.sectionProperties.quickScrollVerticalTimer);
        this.sectionProperties.quickScrollVerticalTimer = null;
      }
      if (this.sectionProperties.quickScrollHorizontalTimer) {
        clearTimeout(this.sectionProperties.quickScrollHorizontalTimer);
        this.sectionProperties.quickScrollHorizontalTimer = null;
      }
    }
    /*
        Scroll bar dragging maps the mouse movement to a document position with
        the current ratio between the scroll bar length and the scrollable area.
        In spreadsheets the scrollable area grows when the view reaches its end,
        which changes that ratio mid-drag: the scroll bar shrinks and jumps under
        the pointer and the document grows without limit while the user keeps
        dragging. So freeze the document size when the scroll bar is grabbed and
        recalculate it once when it is released.
    */
    freezeDocumentSize() {
      if (this.map._docLayer._docType === "spreadsheet")
        this.map._docLayer.freezeDocumentSize();
    }
    unfreezeDocumentSize() {
      if (this.map._docLayer._docType === "spreadsheet")
        this.map._docLayer.unfreezeDocumentSize();
    }
    onMouseDown(point, e) {
      const layout = app.activeDocument.activeLayout;
      const scrollProps = layout.scrollProperties;
      this.clearQuickScrollTimeout();
      this.onMouseMove(point, null, e);
      this.isMouseOnScrollBar(point);
      const mirrorX = this.isRTL();
      const documentAnchor = app.sectionContainer.getSectionWithName(app.CSections.Tiles.name);
      const roomBefore = layout.type === "ViewLayoutCompareChanges" || layout.laysRoomBeforeTheDocument();
      this.sectionProperties.viewBeforeTheBarDrag = layout.laysRoomBeforeTheDocument() ? layout.zoomAnchorPoint() : null;
      this.listenForEscape(this.sectionProperties.viewBeforeTheBarDrag !== null);
      const initialVerticalCheck = roomBefore ? layout.canScrollVertical(documentAnchor) : layout.viewedRectangle.pY1 >= 0;
      if (initialVerticalCheck) {
        if (!mirrorX && point.pX >= this.size[0] - scrollProps.usableThickness || mirrorX && point.pY <= scrollProps.usableThickness) {
          if (point.pY > scrollProps.yOffset) {
            this.sectionProperties.clickScrollVertical = true;
            this.map.scrollingIsHandled = true;
            this.containerObject.capturePointerForDrag();
            this.freezeDocumentSize();
            this.quickScrollVertical(point);
            e.stopPropagation();
            this.stopPropagating();
          } else {
            this.sectionProperties.clickScrollVertical = false;
          }
        } else {
          this.sectionProperties.clickScrollVertical = false;
        }
      }
      const canScrollH = layout.canScrollHorizontal(documentAnchor);
      if (canScrollH) {
        if (point.pY >= this.size[1] - scrollProps.usableThickness) {
          if (!mirrorX && point.pX >= scrollProps.xOffset && point.pX <= this.size[0] - scrollProps.horizontalScrollRightOffset || mirrorX && point.pX >= scrollProps.xOffset && point.pX >= scrollProps.horizontalScrollRightOffset) {
            this.sectionProperties.clickScrollHorizontal = true;
            this.map.scrollingIsHandled = true;
            this.containerObject.capturePointerForDrag();
            this.freezeDocumentSize();
            this.quickScrollHorizontal(point);
            e.stopPropagation();
            this.stopPropagating();
          } else {
            this.sectionProperties.clickScrollHorizontal = false;
          }
        } else {
          this.sectionProperties.clickScrollHorizontal = false;
        }
      }
    }
    listenForEscape(listen) {
      document.removeEventListener("keydown", this.onEscapeKey, true);
      if (listen)
        document.addEventListener("keydown", this.onEscapeKey, true);
    }
    onMouseUp(point, e) {
      window.L.DomUtil.removeClass(document.documentElement, "prevent-select");
      this.map.scrollingIsHandled = false;
      this.clearQuickScrollTimeout();
      this.unfreezeDocumentSize();
      if (this.sectionProperties.clickScrollVertical) {
        this.containerObject.releasePointerForDrag();
        e.stopPropagation();
        this.stopPropagating();
        this.sectionProperties.clickScrollVertical = false;
      } else if (this.sectionProperties.clickScrollHorizontal) {
        this.containerObject.releasePointerForDrag();
        e.stopPropagation();
        this.stopPropagating();
        this.sectionProperties.clickScrollHorizontal = false;
      }
      this.sectionProperties.viewAtDragStart = null;
      this.sectionProperties.viewBeforeTheBarDrag = null;
      this.listenForEscape(false);
      if (e.type === "touchend")
        this.onMouseLeave();
      else
        this.onMouseMove(point, null, e);
    }
    onClick(point, e) {
      if (this.isAnimating && this.sectionProperties.animatingWheelScrollVertical)
        this.containerObject.stopAnimating();
    }
    animateScroll(delta) {
      const lineHeight = this.containerObject.getScrollLineHeight();
      for (let i = 0; i < 2; ++i) {
        if (Math.abs(delta[i]) === 0)
          continue;
        const sign = delta[i] > 0 ? 1 : -1;
        if (sign !== this.sectionProperties.scrollAnimationDirection[i]) {
          this.sectionProperties.scrollAnimationVelocity[i] = 0;
          this.sectionProperties.scrollAnimationAcc[i] = 0;
          this.sectionProperties.scrollAnimationDirection[i] = sign;
        }
        this.sectionProperties.scrollAnimationDelta[i] = lineHeight * _ScrollSection.scrollWheelDelta * sign * app.dpiScale;
      }
      if (!this.sectionProperties.animatingScroll) {
        this.sectionProperties.animatingScroll = true;
        this.sectionProperties.lastElapsedTime = 0;
        if (!this.startAnimating({ "defer": true })) {
          if (this.isAnimating)
            this.resetAnimation();
          else
            this.sectionProperties.animatingScroll = false;
        }
      }
    }
    onMouseWheel(point, delta, e) {
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.stopPropagating();
        return;
      }
      this.map.fire("closepopups");
      if (e.deltaX !== 0)
        e.preventDefault();
      let hscroll = 0, vscroll = 0;
      if (Math.abs(delta[1]) > Math.abs(delta[0])) {
        if (e.shiftKey)
          hscroll = delta[1];
        else
          vscroll = delta[1];
      } else
        hscroll = delta[0];
      let shouldAnimate = this.sectionProperties.animateWheelScroll && !this.sectionProperties.scrollAnimationDisableTimeout;
      if (shouldAnimate) {
        if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
          this.sectionProperties.scrollQuirks = false;
          if (Math.abs(e.wheelDeltaY) <= 32 && Math.abs(e.wheelDeltaX) <= 32)
            shouldAnimate = false;
        } else if (!this.sectionProperties.scrollQuirks)
          shouldAnimate = false;
        if (e.deltaX !== 0 && e.deltaY !== 0) {
          shouldAnimate = false;
        } else if (this.sectionProperties.scrollQuirks) {
          const nowIsAccurate = performance.now() % 1 !== 0;
          const hasFractionalComponent = e.deltaX % 1 !== 0 || e.deltaY % 1 !== 0;
          const deltaMaybeDiscrete = Math.abs(e.wheelDelta) % 60 === 0;
          if (hasFractionalComponent && (!nowIsAccurate || !deltaMaybeDiscrete)) {
            shouldAnimate = false;
          } else if (nowIsAccurate && !deltaMaybeDiscrete) {
            shouldAnimate = false;
          }
        }
      }
      hscroll *= app.dpiScale;
      vscroll *= app.dpiScale;
      if (shouldAnimate)
        this.animateScroll([hscroll, vscroll]);
      else {
        this.sectionProperties.animatingScroll = false;
        if (this.sectionProperties.scrollAnimationDisableTimeout)
          clearTimeout(this.sectionProperties.scrollAnimationDisableTimeout);
        this.sectionProperties.scrollAnimationDisableTimeout = setTimeout(() => {
          this.sectionProperties.scrollAnimationDisableTimeout = null;
        }, _ScrollSection.scrollDirectTimeoutMs);
        this.sectionProperties.scrollWheelDelta[0] += hscroll;
        this.sectionProperties.scrollWheelDelta[1] += vscroll;
        if (!this.isAnimating)
          this.startAnimating({});
      }
    }
  };
  _ScrollSection.scrollAnimationAcceleration = 0.1;
  _ScrollSection.scrollWheelDelta = 3;
  _ScrollSection.scrollDirectTimeoutMs = 100;
  let ScrollSection = _ScrollSection;
  cool2.ScrollSection = ScrollSection;
})(cool || (cool = {}));
