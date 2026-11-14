var cool;
(function(cool2) {
  const _VectorPrimitiveRenderer = class _VectorPrimitiveRenderer {
    constructor(bitmapLookup, fontLoaded, onPictureReady) {
      this._slideWidth = 0;
      this._slideHeight = 0;
      this._colorFilters = new cool2.VectorColorFilters();
      this._modifiedImages = new cool2.VectorModifiedImages();
      this._editViewContentVisible = false;
      this._documentBackground = cool2.VectorColors.DEFAULT_DOCUMENT_BACKGROUND;
      this._documentBackgroundIsDark = false;
      this._pageBackdrop = void 0;
      this._pageBackdropTransparency = 0;
      this._authoredColors = false;
      this._pictureDepth = 0;
      this._colorOverride = null;
      this._textOverride = null;
      this._paragraphFilter = null;
      this._paragraphIndex = 0;
      this._textBlockDepth = 0;
      this._measuredWidths = /* @__PURE__ */ new Map();
      this._recoloredDecorations = /* @__PURE__ */ new WeakMap();
      this._bitmapLookup = bitmapLookup;
      this._fontLoaded = fontLoaded;
      this._formControls = new cool2.VectorFormControlRenderer(onPictureReady);
      this._scratch = new cool2.VectorScratchCanvases();
      this._gradients = new cool2.VectorGradientPrimitiveRenderer(this._scratch, (color) => this._fillColor(color));
      this._fillGraphics = new cool2.VectorFillGraphicPrimitiveRenderer(bitmapLookup);
    }
    /// Set the slide size in twips before rendering a primitive tree, so the
    /// background fills the slide and leaves the area around it untouched.
    setSlideBounds(width, height) {
      this._slideWidth = width;
      this._slideHeight = height;
    }
    /// Show or hide the content only an editing view shows: the prompt
    /// of an empty placeholder, the stand-in graphic of an empty picture
    /// and the wave under a misspelled word. A thumbnail and a slideshow
    /// leave it out.
    setEditViewContentVisible(visible) {
      this._editViewContentVisible = visible;
    }
    /// Draw the following primitives in these colors instead of their own.
    /// Null restores their own colors.
    setColorOverride(override) {
      this._colorOverride = override;
    }
    /// Draw the following text in this look. Null restores its own.
    setTextOverride(override) {
      this._textOverride = override;
    }
    /// Draw only some paragraphs of the following text. Null draws all of
    /// them. Paragraphs count from 0 in each text block, so the copy in a
    /// shadow is filtered like the text itself.
    setParagraphFilter(filter) {
      this._paragraphFilter = filter;
      this._paragraphIndex = 0;
    }
    _drawsParagraph(index) {
      var _a;
      const filter = this._paragraphFilter;
      if (!filter)
        return true;
      if (filter.only !== void 0)
        return filter.only === index;
      return !((_a = filter.skip) == null ? void 0 : _a.includes(index));
    }
    setDocumentBackground(color) {
      this._documentBackground = color;
      this._documentBackgroundIsDark = cool2.VectorColors.isDark(color);
    }
    setPageBackdrop(color, transparency = 0) {
      this._pageBackdrop = color;
      this._pageBackdropTransparency = transparency;
    }
    /// Draw the fills and lines in the colors the document gives them,
    /// or in colors that follow a dark view.
    setAuthoredColors(authored) {
      this._authoredColors = authored;
    }
    _followsDarkView() {
      return this._documentBackgroundIsDark && !this._authoredColors;
    }
    // On a dark view a light surface turns dark, the same way the
    // document background does.
    _surfaceColor(color) {
      if (!this._followsDarkView())
        return color;
      return cool2.VectorColors.getDarkVariant(color, this._documentBackground);
    }
    // An override stands in for the primitive's own color and follows
    // the view the same way.
    _fillColor(color) {
      var _a;
      const own = ((_a = this._colorOverride) == null ? void 0 : _a.fill) ?? color ?? "#000000";
      return this._pictureDepth > 0 ? own : this._surfaceColor(own);
    }
    // On a dark view a dark line turns light, so it shows on the fills
    // that turned dark.
    _lineColor(color) {
      var _a;
      const own = ((_a = this._colorOverride) == null ? void 0 : _a.stroke) ?? color ?? "#000000";
      if (this._pictureDepth > 0 || !this._followsDarkView() || !cool2.VectorColors.isDark(own))
        return own;
      return cool2.VectorColors.getLightVariant(own);
    }
    // The color a fill shows over what lies behind it, when it lets
    // a share of that show through.
    _surfaceOver(fill, transparency, behind) {
      if (!transparency)
        return fill;
      return cool2.VectorColors.blend(fill, behind, transparency);
    }
    _pageSurface() {
      if (this._pageBackdrop === void 0)
        return this._documentBackground;
      return this._surfaceOver(this._surfaceColor(this._pageBackdrop), this._pageBackdropTransparency, this._documentBackground);
    }
    // The surface right behind a text run: its character highlight,
    // else the fill of its shape or cell over the page, else the
    // page. A value with no channels to read names no surface.
    _textSurface(primitive) {
      const highlight = primitive.fillcolor;
      if (highlight !== void 0 && cool2.VectorColors.parse(highlight))
        return this._fillColor(highlight);
      const backdrop = primitive.backdrop;
      if (backdrop !== void 0 && cool2.VectorColors.parse(backdrop))
        return this._surfaceOver(this._fillColor(backdrop), primitive.backdropTransparency, this._pageSurface());
      return this._pageSurface();
    }
    _textColor(primitive) {
      var _a;
      if (((_a = this._colorOverride) == null ? void 0 : _a.text) !== void 0)
        return this._colorOverride.text;
      return this.ownTextColor(primitive);
    }
    /// The color the text run is drawn in. An automatic color resolves to
    /// black or white for the surface under the run.
    ownTextColor(primitive) {
      const surface = this._textSurface(primitive);
      const color = primitive.fontcolor;
      if (color === void 0 || color === cool2.VectorColors.AUTOMATIC)
        return cool2.VectorColors.isDark(surface) ? "#FFFFFF" : "#000000";
      return this._readableColor(color, surface);
    }
    // A color of the document drawn over the given surface. On a dark view
    // a dark surface lightens it. A picture keeps the colors it has.
    _readableColor(color, surface) {
      if (this._pictureDepth === 0 && this._documentBackgroundIsDark && cool2.VectorColors.isDark(surface))
        return cool2.VectorColors.getLightVariant(color);
      return color;
    }
    /// Draws the objects named, each moved by the matrix. The tail of a caption keeps
    /// its end, so it is laid out anew rather than moved.
    renderObjectsMoved(context, objects, objectIds, matrix) {
      for (const id of objectIds) {
        const object = objects.get(id);
        if (!(object == null ? void 0 : object.primitives))
          continue;
        this.renderPrimitive(context, {
          type: cool2.TransformPrimitive.type,
          matrix: matrix.toArray(),
          children: cool2.CaptionTail.changedBy(object, matrix) ?? object.primitives
        });
      }
    }
    // A paragraph drawn alone is drawn without its object.
    _leavesOutObject(kind) {
      var _a;
      return ((_a = this._paragraphFilter) == null ? void 0 : _a.only) !== void 0 && this._textBlockDepth === 0 && kind.isObjectDrawing === true;
    }
    renderPrimitive(context, primitive) {
      var _a;
      if (!primitive || !primitive.type)
        return;
      switch (primitive.type) {
        case cool2.BackgroundColorPrimitive.type:
          if (this._leavesOutObject(cool2.BackgroundColorPrimitive))
            return;
          this._renderBackgroundColor(context, primitive);
          break;
        case cool2.PolyPolygonColorPrimitive.type:
        case cool2.PolyPolygonRGBAPrimitive.type:
          if (this._leavesOutObject(cool2.PolyPolygonColorPrimitive))
            return;
          this._renderPolyPolygonColor(context, primitive);
          break;
        case cool2.PolygonStrokePrimitive.type:
        case cool2.PolyPolygonStrokePrimitive.type:
          if (this._leavesOutObject(cool2.PolygonStrokePrimitive))
            return;
          this._renderPolygonStroke(context, primitive);
          break;
        case cool2.PolygonHairlinePrimitive.type:
          if (this._leavesOutObject(cool2.PolygonHairlinePrimitive))
            return;
          this._renderPolygonHairline(context, primitive);
          break;
        case cool2.FilledRectanglePrimitive.type:
          if (this._leavesOutObject(cool2.FilledRectanglePrimitive))
            return;
          this._renderFilledRectangle(context, primitive);
          break;
        case cool2.LineRectanglePrimitive.type:
          if (this._leavesOutObject(cool2.LineRectanglePrimitive))
            return;
          this._renderLineRectangle(context, primitive);
          break;
        case cool2.SingleLinePrimitive.type:
          if (this._leavesOutObject(cool2.SingleLinePrimitive))
            return;
          this._renderSingleLine(context, primitive);
          break;
        case cool2.WrongSpellPrimitive.type:
          if (!this._editViewContentVisible)
            return;
          cool2.VectorWrongSpellPrimitiveRenderer.render(context, primitive, this._hairlineWidth(context));
          break;
        case cool2.PointArrayPrimitive.type:
          if (this._leavesOutObject(cool2.PointArrayPrimitive))
            return;
          this._renderPointArray(context, primitive);
          break;
        case cool2.FillGradientPrimitive.type:
          if (this._leavesOutObject(cool2.FillGradientPrimitive))
            return;
          this._gradients.renderFillGradient(context, primitive);
          break;
        case cool2.PolyPolygonGradientPrimitive.type:
          if (this._leavesOutObject(cool2.PolyPolygonGradientPrimitive))
            return;
          this._gradients.renderPolyPolygonGradient(context, primitive);
          break;
        case cool2.PolyPolygonAlphaGradientPrimitive.type:
          if (this._leavesOutObject(cool2.PolyPolygonAlphaGradientPrimitive))
            return;
          this._gradients.renderPolyPolygonAlphaGradient(context, primitive);
          break;
        case cool2.SvgLinearGradientPrimitive.type:
          this._gradients.renderSvgLinearGradient(context, primitive);
          break;
        case cool2.SvgRadialGradientPrimitive.type:
          this._gradients.renderSvgRadialGradient(context, primitive);
          break;
        case cool2.FillHatchPrimitive.type:
        case cool2.PolyPolygonHatchPrimitive.type:
          if (this._leavesOutObject(cool2.FillHatchPrimitive))
            return;
          this._renderHatch(context, primitive);
          break;
        case cool2.FillGraphicPrimitive.type:
          if (this._leavesOutObject(cool2.FillGraphicPrimitive))
            return;
          this._fillGraphics.renderFillGraphic(context, primitive);
          break;
        case cool2.PolyPolygonGraphicPrimitive.type:
          if (this._leavesOutObject(cool2.PolyPolygonGraphicPrimitive))
            return;
          this._fillGraphics.renderPolyPolygonGraphic(context, primitive);
          break;
        case cool2.BitmapPrimitive.type:
          if (this._leavesOutObject(cool2.BitmapPrimitive))
            return;
          this._renderBitmap(context, primitive);
          break;
        case cool2.FormControlPrimitive.type:
          this._formControls.render(context, primitive);
          break;
        case cool2.BitmapAlphaPrimitive.type:
          if (this._leavesOutObject(cool2.BitmapAlphaPrimitive))
            return;
          this._renderBitmapAlpha(context, primitive);
          break;
        case cool2.GraphicPrimitive.type:
          if (this._leavesOutObject(cool2.GraphicPrimitive))
            return;
          this._renderGraphic(context, primitive);
          return;
        case cool2.TextSimplePortionPrimitive.type:
          if ((_a = this._textOverride) == null ? void 0 : _a.underline)
            this._renderTextDecoratedPortion(context, primitive);
          else
            this._renderTextSimplePortion(context, primitive);
          break;
        case cool2.TextDecoratedPortionPrimitive.type:
          this._renderTextDecoratedPortion(context, primitive);
          break;
        case cool2.TextHierarchyBlockPrimitive.type:
          ++this._textBlockDepth;
          this._renderTextHierarchyBlock(context, primitive);
          --this._textBlockDepth;
          return;
        case cool2.TextHierarchyParagraphPrimitive.type:
          this._renderTextHierarchyParagraph(context, primitive);
          return;
        case cool2.GroupPrimitive.type:
        case cool2.ObjectInfoPrimitive.type:
        case cool2.PolygonStrokeArrowPrimitive.type:
        case cool2.CaptionTailPrimitive.type:
        case cool2.TextHierarchyFieldPrimitive.type:
        case cool2.TextHierarchyLinePrimitive.type:
        case cool2.TextHierarchyBulletPrimitive.type:
        case cool2.TextHierarchyEmphasisMarkPrimitive.type:
          break;
        case cool2.TransformPrimitive.type:
          this._renderTransform(context, primitive);
          return;
        case cool2.UnifiedTransparencePrimitive.type:
          this._renderUnifiedTransparence(context, primitive);
          return;
        case cool2.ModifiedColorPrimitive.type:
          this._renderModifiedColor(context, primitive);
          return;
        case cool2.PatternFillPrimitive.type:
          if (this._leavesOutObject(cool2.PatternFillPrimitive))
            return;
          this._renderPatternFill(context, primitive);
          return;
        case cool2.TransparencePrimitive.type:
          this._renderTransparence(context, primitive);
          return;
        case cool2.ShadowPrimitive.type:
          this._renderShadow(context, primitive);
          return;
        case cool2.GlowPrimitive.type:
          if (this._leavesOutObject(cool2.GlowPrimitive))
            return;
          this._renderGlow(context, primitive);
          return;
        case cool2.SoftEdgePrimitive.type:
          if (this._leavesOutObject(cool2.SoftEdgePrimitive))
            return;
          this._renderSoftEdge(context, primitive);
          return;
        case cool2.ReflectionPrimitive.type:
          this._renderReflection(context, primitive);
          return;
        case cool2.InvertPrimitive.type:
          this._renderInvert(context, primitive);
          return;
        case cool2.MaskPrimitive.type:
          this._renderMask(context, primitive);
          return;
        case cool2.PagePreviewPrimitive.type:
          if (this._leavesOutObject(cool2.PagePreviewPrimitive))
            return;
          this._renderPagePreview(context, primitive);
          return;
        case cool2.HiddenGeometryPrimitive.type:
          return;
        case cool2.ExclusiveEditViewPrimitive.type:
          if (!this._editViewContentVisible)
            return;
          break;
        default:
          _VectorPrimitiveRenderer._reportUnknownType(primitive.type);
          break;
      }
      if (primitive.children)
        this._renderPrimitives(context, primitive.children);
    }
    // A type named "module:id" is a primitive the engine writes as its
    // decomposition, so its children are all it draws. Any other type the
    // renderer has no case for carries fields of its own that nothing
    // draws, which a warning names.
    static _reportUnknownType(type) {
      if (type.includes(":") || _VectorPrimitiveRenderer._reportedUnknownTypes.has(type))
        return;
      _VectorPrimitiveRenderer._reportedUnknownTypes.add(type);
      window.app.console.warn('VectorPrimitiveRenderer: no drawing for primitive type "' + type + '", only its children are drawn');
    }
    // The objects of the shown page sit on the fill of that page, so
    // the page backdrop is the one of the shown page while its content
    // draws.
    _renderPagePreview(context, primitive) {
      if (!primitive.children)
        return;
      const backdrop = this._pageBackdrop;
      const transparency = this._pageBackdropTransparency;
      this.setPageBackdrop(primitive.backdrop, primitive.backdropTransparency);
      this._renderPrimitives(context, primitive.children);
      this.setPageBackdrop(backdrop, transparency);
    }
    _renderBackgroundColor(context, primitive) {
      context.save();
      context.globalAlpha = 1 - (primitive.transparency ?? 0);
      context.fillStyle = primitive.color !== void 0 ? this._surfaceColor(primitive.color) : this._documentBackground;
      context.fillRect(0, 0, this._slideWidth, this._slideHeight);
      context.restore();
    }
    _renderPolyPolygonColor(context, primitive) {
      if (!primitive.path || !primitive.color)
        return;
      const path = new Path2D(primitive.path);
      const transparency = primitive.transparency ?? 0;
      const needsAlphaBracket = transparency > 0;
      if (needsAlphaBracket) {
        context.save();
        context.globalAlpha = 1 - transparency;
      }
      context.fillStyle = this._fillColor(primitive.color);
      context.fill(path, "evenodd");
      if (needsAlphaBracket)
        context.restore();
    }
    /// Width that draws as one device pixel under the current transform.
    /// The context is in twips, so the scale has to be divided out.
    _hairlineWidth(context) {
      if (typeof context.getTransform !== "function")
        return 1;
      const matrix = context.getTransform();
      const scale = Math.hypot(matrix.a, matrix.b);
      return scale > 0 ? 1 / scale : 1;
    }
    _renderPolygonStroke(context, primitive) {
      var _a, _b;
      if (!primitive.path)
        return;
      const line = primitive.line ?? {};
      const path = new Path2D(primitive.path);
      context.save();
      context.strokeStyle = this._lineColor(line.color);
      const width = line.width ?? 0;
      context.lineWidth = width === 0 ? this._hairlineWidth(context) : width;
      context.lineJoin = line.linejoin === "round" || line.linejoin === "bevel" ? line.linejoin : "miter";
      context.lineCap = line.linecap === "round" || line.linecap === "square" ? line.linecap : "butt";
      if ((_b = (_a = primitive.stroke) == null ? void 0 : _a.dotDashArray) == null ? void 0 : _b.length)
        context.setLineDash(primitive.stroke.dotDashArray);
      context.stroke(path);
      context.restore();
    }
    _renderPolygonHairline(context, primitive) {
      if (!primitive.path)
        return;
      const path = new Path2D(primitive.path);
      context.save();
      context.strokeStyle = this._lineColor(primitive.color);
      context.lineWidth = this._hairlineWidth(context);
      context.stroke(path);
      context.restore();
    }
    _renderFilledRectangle(context, primitive) {
      const bounds = cool2.Range2D.fromArray(primitive.bounds);
      if (!bounds)
        return;
      context.save();
      context.fillStyle = this._fillColor(primitive.color);
      context.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);
      context.restore();
    }
    _renderLineRectangle(context, primitive) {
      const bounds = cool2.Range2D.fromArray(primitive.bounds);
      if (!bounds)
        return;
      context.save();
      context.strokeStyle = this._lineColor(primitive.color);
      context.lineWidth = this._hairlineWidth(context);
      context.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height);
      context.restore();
    }
    _renderSingleLine(context, primitive) {
      const startX = primitive.startX ?? 0;
      const startY = primitive.startY ?? 0;
      const endX = primitive.endX ?? 0;
      const endY = primitive.endY ?? 0;
      context.save();
      context.strokeStyle = this._lineColor(primitive.color);
      context.lineWidth = this._hairlineWidth(context);
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.stroke();
      context.restore();
    }
    /// The font family for a run: the face the engine sent once its font
    /// has loaded, otherwise the run's family name.
    static resolveFontFamily(primitive, fontLoaded) {
      if (primitive.fontId !== void 0 && fontLoaded && fontLoaded(primitive.fontId))
        return "vecfont-" + primitive.fontId;
      return primitive.familyname ?? "sans-serif";
    }
    /// The CSS font string of a run with the given family. The override's
    /// slant and weight replace the run's own where given.
    static cssFont(primitive, family, override) {
      let style = primitive.italic ? "italic" : "normal";
      let weight = _VectorPrimitiveRenderer._FONT_WEIGHT_CSS[primitive.weight ?? 5] ?? 400;
      if (primitive.fontId !== void 0 && family === "vecfont-" + primitive.fontId) {
        if (!primitive.syntheticItalic)
          style = "normal";
        if (!primitive.syntheticBold)
          weight = 400;
      }
      if ((override == null ? void 0 : override.italic) !== void 0)
        style = override.italic ? "italic" : "normal";
      if ((override == null ? void 0 : override.weight) !== void 0)
        weight = _VectorPrimitiveRenderer._FONT_WEIGHT_CSS[override.weight] ?? 400;
      return `${style} ${weight} ${primitive.fontSize ?? 12}px "${family}"`;
    }
    // Sets up the canvas font and (when needed) the rotation
    // transform for a text primitive, and returns the drawing
    // anchor and the substring to paint. Callers must save and
    // restore the context around the call. Returns null if there
    // is nothing to draw.
    _setupTextFrame(context, primitive) {
      var _a;
      if (!primitive.text)
        return null;
      const start = primitive.textPosition ?? 0;
      const length = primitive.textLength ?? primitive.text.length - start;
      const text = primitive.text.substring(start, start + length);
      if (!text)
        return null;
      const fontSize = primitive.fontSize ?? 12;
      if (!(fontSize > 0))
        return null;
      const matrix = cool2.Matrix2D.fromArray(primitive.matrix) ?? new cool2.Matrix2D(fontSize, 0, 0, fontSize, 0, 0);
      const family = ((_a = this._textOverride) == null ? void 0 : _a.family) ?? _VectorPrimitiveRenderer.resolveFontFamily(primitive, this._fontLoaded);
      context.font = _VectorPrimitiveRenderer.cssFont(primitive, family, this._textOverride);
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      const transformed = matrix.b !== 0 || matrix.c !== 0 || matrix.a !== fontSize || matrix.d !== fontSize;
      if (transformed) {
        cool2.Matrix2D.IDENTITY.scale(1 / fontSize, 1 / fontSize).then(matrix).applyTo(context);
      }
      const xScale = matrix.lengthOfXAxis();
      return {
        x: transformed ? 0 : matrix.e,
        y: transformed ? 0 : matrix.f,
        fontSize,
        advanceScale: transformed && xScale > 0 ? fontSize / xScale : 1,
        text
      };
    }
    // The x past each UTF-16 unit of the visible text, in the parent space:
    // the running sum of the advances. Null when the run has no advances,
    // too few for the text, or is right-to-left, which needs the browser's
    // ordering and shaping.
    static _advanceDistances(primitive, text) {
      const steps = primitive.advances;
      if (!steps || steps.length < text.length || text.length === 0 || primitive.rtl)
        return null;
      const distances = [];
      let reached = 0;
      for (let k = 0; k < text.length; k++) {
        reached += steps[k];
        distances.push(reached);
      }
      return distances;
    }
    _renderTextSimplePortion(context, primitive) {
      this._fillTextHighlight(context, primitive);
      this._renderTextEffects(context, primitive, (color) => this._fillTextRun(context, primitive, color ?? this._textColor(primitive)));
    }
    // The highlight lies behind the text and casts no shadow.
    _fillTextHighlight(context, primitive) {
      var _a;
      const path = (_a = primitive.highlight) == null ? void 0 : _a.path;
      const color = primitive.fillcolor;
      if (!path || !color || !cool2.VectorColors.parse(color))
        return;
      context.save();
      context.fillStyle = color;
      context.fill(new Path2D(path));
      context.restore();
    }
    // Fills the glyphs of a run in one color.
    _fillTextRun(context, primitive, color) {
      context.save();
      const frame = this._setupTextFrame(context, primitive);
      if (frame) {
        context.fillStyle = color;
        this._drawTextRun(context, primitive, frame);
      }
      context.restore();
    }
    // Draws a run with its shadow, relief or outline, as the drawing layer
    // builds them. drawBody draws the glyphs and the decorations in the
    // color it is given, or in their own colors when it gets none. A run
    // with relief has no shadow and no outline.
    _renderTextEffects(context, primitive, drawBody) {
      const decorated = primitive;
      const relief = decorated.relief ?? 0;
      if (!relief && !decorated.shadow && !primitive.outline) {
        drawBody(void 0);
        return;
      }
      const moved = (x, y, color) => {
        context.save();
        context.translate(x, y);
        drawBody(color);
        context.restore();
      };
      const textColor = this._textColor(primitive);
      if (!relief && decorated.shadow) {
        const offset = (primitive.fontSize ?? 12) / 24;
        moved(offset, offset, _VectorPrimitiveRenderer._textShadowColor(textColor));
      }
      const step = _VectorPrimitiveRenderer._deviceStep(context, 1.1);
      const diagonalX = step.x / Math.SQRT2;
      const diagonalY = step.y / Math.SQRT2;
      if (relief) {
        const blackText = _VectorPrimitiveRenderer._isBlack(textColor);
        const sign = blackText && relief === _VectorPrimitiveRenderer._RELIEF_ENGRAVED ? -1 : 1;
        const matrix = cool2.Matrix2D.fromArray(primitive.matrix);
        const angle = matrix ? Math.atan2(matrix.b, matrix.a) : 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        moved(sign * (diagonalX * cos - diagonalY * sin), sign * (diagonalX * sin + diagonalY * cos), blackText ? "#000000" : "#BFBFBF");
        drawBody(blackText ? "#FFFFFF" : void 0);
        return;
      }
      if (primitive.outline) {
        const directions = [
          [step.x, 0],
          [diagonalX, diagonalY],
          [0, step.y],
          [-diagonalX, diagonalY],
          [-step.x, 0],
          [-diagonalX, -diagonalY],
          [0, -step.y],
          [diagonalX, -diagonalY]
        ];
        for (const [x, y] of directions)
          moved(x, y, void 0);
        drawBody("#FFFFFF");
        return;
      }
      drawBody(void 0);
    }
    // Light gray under black or nearly black text, else black. The
    // luminance has the engine's weights.
    static _textShadowColor(textColor) {
      const rgb = cool2.VectorColors.parse(textColor);
      const luminance = rgb ? rgb.r * 0.3 + rgb.g * 0.59 + rgb.b * 0.11 : 0;
      return luminance < 8 / 255 ? "#C0C0C0" : "#000000";
    }
    static _isBlack(color) {
      const rgb = cool2.VectorColors.parse(color);
      return !!rgb && rgb.r === 0 && rgb.g === 0 && rgb.b === 0;
    }
    // A distance of the given number of device pixels along each device
    // axis, in the current drawing units.
    static _deviceStep(context, pixels) {
      if (typeof context.getTransform !== "function")
        return { x: pixels, y: pixels };
      const { a, b, c, d } = context.getTransform();
      const determinant = a * d - b * c;
      if (!determinant)
        return { x: pixels, y: pixels };
      return {
        x: (d - c) * pixels / determinant,
        y: (a - b) * pixels / determinant
      };
    }
    // Draws the run in one call when it has no usable advances or the
    // browser width already matches them. Otherwise each word is drawn at
    // the sum of the advances before it, and stretched to its advance width
    // when the browser measures it differently. Spaces draw nothing and are
    // skipped. The browser still shapes inside a word, so ligatures, marks
    // and joined letters stay whole.
    _drawTextRun(context, primitive, frame) {
      const draw = (text2, x, y) => context.fillText(text2, x, y);
      const text = frame.text;
      const distances = _VectorPrimitiveRenderer._advanceDistances(primitive, text);
      if (!distances) {
        draw(text, frame.x, frame.y);
        return;
      }
      const startOf = (k) => k === 0 ? 0 : distances[k - 1] * frame.advanceScale;
      const transform = context.getTransform();
      const pixelsPerUnit = Math.hypot(transform.a, transform.b) || 1;
      const tolerance = 0.5 / pixelsPerUnit;
      if (Math.abs(this._measuredWidth(context, text) - startOf(text.length)) <= tolerance) {
        draw(text, frame.x, frame.y);
        return;
      }
      for (const [from, to] of _VectorPrimitiveRenderer._words(text)) {
        const word = text.substring(from, to);
        const x = frame.x + startOf(from);
        const width = startOf(to) - startOf(from);
        const measured = this._measuredWidth(context, word);
        if (measured > 0 && Math.abs(measured - width) > tolerance) {
          context.save();
          context.translate(x, frame.y);
          context.scale(width / measured, 1);
          draw(word, 0, 0);
          context.restore();
        } else {
          draw(word, x, frame.y);
        }
      }
    }
    // The words of a text as [from, to) ranges of UTF-16 units, split at
    // white space.
    static _words(text) {
      const words = [];
      let from = -1;
      for (let k = 0; k <= text.length; k++) {
        const space = k === text.length || /\s/.test(text[k]);
        if (space && from >= 0) {
          words.push([from, k]);
          from = -1;
        } else if (!space && from < 0) {
          from = k;
        }
      }
      return words;
    }
    _measuredWidth(context, text) {
      const key = context.font + "\n" + text;
      let width = this._measuredWidths.get(key);
      if (width === void 0) {
        if (this._measuredWidths.size >= _VectorPrimitiveRenderer._MEASURED_WIDTHS_LIMIT)
          this._measuredWidths.clear();
        width = context.measureText(text).width;
        this._measuredWidths.set(key, width);
      }
      return width;
    }
    // A block holds the paragraphs of one text, numbered from 0. The count
    // of an enclosing text is restored afterwards.
    _renderTextHierarchyBlock(context, primitive) {
      var _a;
      const outerIndex = this._paragraphIndex;
      this._paragraphIndex = 0;
      const scale = (_a = this._textOverride) == null ? void 0 : _a.sizeScale;
      const center = scale !== void 0 && scale !== 1 ? this._drawnParagraphsCenter(primitive) : null;
      if (center && scale !== void 0) {
        context.save();
        context.translate(center[0], center[1]);
        context.scale(scale, scale);
        context.translate(-center[0], -center[1]);
      }
      if (primitive.children)
        this._renderPrimitives(context, primitive.children);
      if (center)
        context.restore();
      this._paragraphIndex = outerIndex;
    }
    // The middle of the drawn paragraphs of the block, or null when none
    // has bounds.
    _drawnParagraphsCenter(block) {
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      let index = 0;
      for (const child of block.children ?? []) {
        if (child.type !== cool2.TextHierarchyParagraphPrimitive.type)
          continue;
        if (!this._drawsParagraph(index++))
          continue;
        const bounds = child.bounds;
        if (!bounds)
          continue;
        left = Math.min(left, bounds[0]);
        top = Math.min(top, bounds[1]);
        right = Math.max(right, bounds[2]);
        bottom = Math.max(bottom, bounds[3]);
      }
      if (left > right || top > bottom)
        return null;
      return [(left + right) / 2, (top + bottom) / 2];
    }
    _renderTextHierarchyParagraph(context, primitive) {
      const index = this._paragraphIndex++;
      if (!this._drawsParagraph(index))
        return;
      if (primitive.children)
        this._renderPrimitives(context, primitive.children);
    }
    _renderTextDecoratedPortion(context, run) {
      var _a;
      const primitive = run;
      const decorations = primitive.decorations;
      const decorationsInTextColor = primitive.decorationsInTextColor;
      const underlineOverride = (_a = this._textOverride) == null ? void 0 : _a.underline;
      const underlineChanges = underlineOverride !== void 0 && underlineOverride !== !!primitive.underline;
      const plain = !decorations && !decorationsInTextColor || underlineChanges && !underlineOverride;
      this._fillTextHighlight(context, primitive);
      this._renderTextEffects(context, primitive, (color) => {
        const textColor = color ?? this._textColor(primitive);
        this._fillTextRun(context, primitive, textColor);
        if (plain) {
          this._drawPlainDecorations(context, primitive, color, false);
          return;
        }
        if (decorations)
          this._renderPrimitives(context, color ? this._recolored(decorations, color) : decorations);
        if (decorationsInTextColor)
          this._renderPrimitives(context, this._recolored(decorationsInTextColor, textColor));
        if (underlineChanges)
          this._drawPlainDecorations(context, primitive, color, true);
      });
    }
    _recolored(primitives, color) {
      let byColor = this._recoloredDecorations.get(primitives);
      if (!byColor) {
        byColor = /* @__PURE__ */ new Map();
        this._recoloredDecorations.set(primitives, byColor);
      }
      let recolored = byColor.get(color);
      if (!recolored) {
        recolored = _VectorPrimitiveRenderer._withColor(primitives, color);
        byColor.set(color, recolored);
      }
      return recolored;
    }
    // A copy of a subtree with the color of every stroke, fill and text
    // replaced. The decorations of a run are made of these alone.
    static _withColor(primitives, color) {
      return primitives.map((primitive) => {
        const copy = { ...primitive };
        if (copy.line)
          copy.line = { ...copy.line, color };
        else
          copy.color = color;
        if (copy.type === cool2.TextSimplePortionPrimitive.type || copy.type === cool2.TextDecoratedPortionPrimitive.type)
          copy.fontcolor = color;
        if (copy.children)
          copy.children = _VectorPrimitiveRenderer._withColor(copy.children, color);
        return copy;
      });
    }
    // Plain lines for a run without the engine's decorations: one solid
    // line each, placed by fractions of the font size. With underlineOnly
    // the overline and strikeout are left to the engine.
    _drawPlainDecorations(context, primitive, color, underlineOnly) {
      var _a;
      const underline = ((_a = this._textOverride) == null ? void 0 : _a.underline) ?? primitive.underline;
      const overline = !underlineOnly && primitive.overline;
      const strikeout = !underlineOnly && primitive.strikeout;
      if (!underline && !overline && !strikeout)
        return;
      context.save();
      const frame = this._setupTextFrame(context, primitive);
      if (frame) {
        const distances = _VectorPrimitiveRenderer._advanceDistances(primitive, frame.text);
        const width = distances ? distances[frame.text.length - 1] * frame.advanceScale : context.measureText(frame.text).width;
        const lineWidth = Math.max(1, frame.fontSize / 20);
        const textColor = color ?? this._textColor(primitive);
        const lineColor = (decorationColor) => {
          if (color !== void 0)
            return color;
          if (decorationColor === void 0)
            return textColor;
          const surface = this._textSurface(primitive);
          return this._readableColor(decorationColor, surface);
        };
        const drawLine = (lineY, lineColor2) => {
          context.strokeStyle = lineColor2;
          context.lineWidth = lineWidth;
          context.beginPath();
          context.moveTo(frame.x, lineY);
          context.lineTo(frame.x + width, lineY);
          context.stroke();
        };
        if (underline) {
          const lineY = primitive.underlineAbove ? frame.y - frame.fontSize * 0.85 : frame.y + frame.fontSize * 0.15;
          drawLine(lineY, lineColor(primitive.underlineColor));
        }
        if (overline)
          drawLine(frame.y - frame.fontSize * 0.85, lineColor(primitive.overlineColor));
        if (strikeout)
          drawLine(frame.y - frame.fontSize * 0.3, textColor);
      }
      context.restore();
    }
    _renderBitmap(context, primitive) {
      this._drawRaster(context, primitive.matrix, primitive.checksum);
    }
    _renderBitmapAlpha(context, primitive) {
      this._drawRaster(context, primitive.matrix, primitive.checksum, {
        // The wire counts transparency up from 0 for opaque.
        alpha: typeof primitive.transparency === "number" ? 1 - primitive.transparency : void 0
      });
    }
    _renderGraphic(context, primitive) {
      if (primitive.vector) {
        if (!primitive.children)
          return;
        this._pictureDepth++;
        try {
          this._renderPrimitives(context, primitive.children);
        } finally {
          this._pictureDepth--;
        }
        return;
      }
      this._drawRaster(context, primitive.matrix, primitive.checksum, {
        imageRect: primitive.imageRect,
        rotation: primitive.rotation,
        // The wire gives a byte, with 255 for opaque.
        alpha: typeof primitive.alpha === "number" ? primitive.alpha / 255 : void 0,
        mirror: primitive.mirror,
        colorModifiers: primitive.colorModifiers
      });
    }
    // Resolve the image through the checksum lookup and draw it
    // into the unit square mapped by the wire matrix. Skips when
    // the matrix is missing, no lookup is registered, the lookup
    // has no entry yet, or the image is still decoding.
    _drawRaster(context, wireMatrix, checksum, options = {}) {
      const matrix = cool2.Matrix2D.fromArray(wireMatrix);
      if (!matrix)
        return;
      if (!this._bitmapLookup)
        return;
      const image = this._bitmapLookup(checksum);
      if (!image)
        return;
      if (!image.complete)
        return;
      const { imageRect, rotation, alpha, mirror, colorModifiers } = options;
      context.save();
      if (typeof alpha === "number" && alpha < 1)
        context.globalAlpha = alpha;
      matrix.applyTo(context);
      if (mirror) {
        const mx = mirror & 1 ? -1 : 1;
        const my = mirror & 2 ? -1 : 1;
        context.translate(mx < 0 ? 1 : 0, my < 0 ? 1 : 0);
        context.scale(mx, my);
      }
      if (rotation) {
        const radians = rotation / 10 * Math.PI / 180;
        context.translate(0.5, 0.5);
        context.rotate(radians);
        context.translate(-0.5, -0.5);
      }
      const source = (colorModifiers == null ? void 0 : colorModifiers.length) ? this._colorChangedImage(context, image, colorModifiers, imageRect) : image;
      if (imageRect) {
        context.beginPath();
        context.rect(0, 0, 1, 1);
        context.clip();
        context.drawImage(source, imageRect.x, imageRect.y, imageRect.width, imageRect.height);
      } else {
        context.drawImage(source, 0, 0, 1, 1);
      }
      context.restore();
    }
    // The image with its colors changed: through an SVG filter where the
    // canvas has filters, else a copy at the drawn size. The engine changes
    // pixels before scaling, so mono or gamma can differ along sharp edges.
    _colorChangedImage(context, image, modifiers, imageRect) {
      if (cool2.VectorColorFilters.canFilter(context)) {
        const filter = this._colorFilters.filterFor(modifiers);
        if (filter)
          context.filter = this._composeFilter(context, filter);
        return image;
      }
      const matrix = context.getTransform();
      return this._modifiedImages.get(image, modifiers, Math.hypot(matrix.a, matrix.b) * ((imageRect == null ? void 0 : imageRect.width) ?? 1), Math.hypot(matrix.c, matrix.d) * ((imageRect == null ? void 0 : imageRect.height) ?? 1));
    }
    _renderPointArray(context, primitive) {
      var _a;
      if (!((_a = primitive.points) == null ? void 0 : _a.length))
        return;
      context.save();
      context.fillStyle = this._lineColor(primitive.color);
      for (const point of primitive.points)
        context.fillRect(point.x, point.y, 1, 1);
      context.restore();
    }
    _renderTransform(context, primitive) {
      const matrix = cool2.Matrix2D.fromArray(primitive.matrix);
      if (matrix) {
        context.save();
        matrix.applyTo(context);
      }
      if (primitive.children)
        this._renderPrimitives(context, primitive.children);
      if (matrix)
        context.restore();
    }
    _renderModifiedColor(context, primitive) {
      const children = primitive.children;
      if (!children)
        return;
      if (primitive.modifier === "gray" || primitive.modifier === "invert") {
        this._renderGrayOrInvert(context, children, primitive.bounds, primitive.modifier === "invert");
        return;
      }
      const plain = () => this._renderPrimitives(context, children);
      if (!cool2.VectorColorModifiers.changesColors(primitive)) {
        plain();
        return;
      }
      this._scratch.withEffectSlots(plain, (slot) => {
        const region = cool2.VectorScratchCanvases.effectRegion(context, primitive.bounds, 0);
        if (!region)
          return;
        const content = this._renderToScratch(context, slot, children, region);
        if (!content) {
          plain();
          return;
        }
        if (!_VectorPrimitiveRenderer._modifiesByCompositing(primitive) && cool2.VectorColorFilters.canFilter(context)) {
          context.save();
          const filter = this._colorFilters.filterFor([primitive]);
          if (filter)
            context.filter = this._composeFilter(context, filter);
          this._scratch.drawOnto(context, content, region);
          context.restore();
          return;
        }
        _VectorPrimitiveRenderer._modifyScratch(content, primitive);
        this._scratch.drawOnto(context, content, region);
      });
    }
    // Replace and interpolate are composited fills, which all browsers do.
    static _modifiesByCompositing(modifier) {
      return modifier.modifier === "replace" || modifier.modifier === "interpolate";
    }
    // Change the colors on a scratch canvas, keeping its alpha. Replace and
    // interpolate are composited fills, the rest read the pixels back.
    static _modifyScratch(content, modifier) {
      const width = content.canvas.width;
      const height = content.canvas.height;
      const value = Math.min(Math.max(modifier.value ?? 0, 0), 1);
      content.save();
      content.setTransform(1, 0, 0, 1, 0, 0);
      if (modifier.modifier === "replace") {
        content.globalCompositeOperation = "source-in";
        content.fillStyle = modifier.color ?? "#000000";
        content.fillRect(0, 0, width, height);
      } else if (modifier.modifier === "interpolate") {
        content.globalCompositeOperation = "source-atop";
        content.globalAlpha = 1 - value;
        content.fillStyle = modifier.color ?? "#000000";
        content.fillRect(0, 0, width, height);
      } else {
        const pixels = content.getImageData(0, 0, width, height);
        cool2.VectorColorModifiers.applyToPixels(pixels.data, [modifier]);
        content.putImageData(pixels, 0, 0);
      }
      content.restore();
    }
    _renderGrayOrInvert(context, children, bounds, invert) {
      const filtered = () => {
        context.save();
        context.filter = this._composeFilter(context, invert ? "invert(1)" : "grayscale(1)");
        this._renderPrimitives(context, children);
        context.restore();
      };
      this._scratch.withEffectSlots(filtered, (slot) => {
        if (!this._renderModifiedOnScratch(context, slot, children, bounds, invert))
          filtered();
      });
    }
    // Gray or invert a subtree with blend modes, which every browser
    // has. A blend works on colors that are not premultiplied and
    // mixes in the backdrop where the content is partly transparent.
    // Over opaque black each pixel is its premultiplied color
    // instead, both modifiers map that exactly, and dividing by the
    // alpha afterwards gives the plain color back. False when there
    // is no canvas for it.
    _renderModifiedOnScratch(context, slot, children, bounds, invert) {
      const region = cool2.VectorScratchCanvases.effectRegion(context, bounds, 0);
      if (!region)
        return true;
      const content = this._renderToScratch(context, slot, children, region);
      if (!content)
        return false;
      const width = region.width;
      const height = region.height;
      const color = this._scratch.slotContext(slot + 1, width, height);
      const alpha = color ? this._scratch.slotContext(slot + 2, width, height) : null;
      if (!color || !alpha)
        return false;
      color.save();
      color.fillStyle = "#000000";
      color.fillRect(0, 0, width, height);
      color.drawImage(content.canvas, 0, 0);
      alpha.save();
      alpha.drawImage(content.canvas, 0, 0);
      alpha.globalCompositeOperation = "source-in";
      alpha.fillStyle = "#ffffff";
      alpha.fillRect(0, 0, width, height);
      alpha.globalCompositeOperation = "destination-over";
      alpha.fillStyle = "#000000";
      alpha.fillRect(0, 0, width, height);
      if (invert) {
        color.globalCompositeOperation = "difference";
        color.drawImage(alpha.canvas, 0, 0);
      } else {
        color.globalCompositeOperation = "saturation";
        color.fillStyle = "#808080";
        color.fillRect(0, 0, width, height);
      }
      alpha.globalCompositeOperation = "difference";
      alpha.fillStyle = "#ffffff";
      alpha.fillRect(0, 0, width, height);
      color.globalCompositeOperation = "color-dodge";
      color.drawImage(alpha.canvas, 0, 0);
      color.globalCompositeOperation = "destination-in";
      color.drawImage(content.canvas, 0, 0);
      alpha.restore();
      color.restore();
      this._scratch.drawOnto(context, color, region);
      return true;
    }
    /// Prepend a filter to the context's active filter list. The
    /// engine applies the innermost colour modifier first and
    /// canvas filters run left to right, so the new filter leads.
    _composeFilter(context, filter) {
      const active = context.filter;
      return active && active !== "none" ? filter + " " + active : filter;
    }
    _renderUnifiedTransparence(context, primitive) {
      context.save();
      context.globalAlpha = 1 - (primitive.transparence ?? 0);
      if (primitive.children)
        this._renderPrimitives(context, primitive.children);
      context.restore();
    }
    _renderMask(context, primitive) {
      context.save();
      if (primitive.clip)
        context.clip(new Path2D(primitive.clip), "evenodd");
      if (primitive.children)
        this._renderPrimitives(context, primitive.children);
      context.restore();
    }
    /// Drop the effects' scratch canvases. The next effect makes new ones.
    releaseScratchCanvases() {
      this._scratch.release();
    }
    /// Drop the color-changed images and filters. Draws rebuild them.
    releaseColorChangedImages() {
      this._modifiedImages.release();
      this._colorFilters.release();
    }
    // Gaussian deviation for a blur radius. The engine takes the radius as
    // three deviations.
    static _blurDeviation(radius) {
      return radius / 3;
    }
    // How far a Gaussian blur reaches: three deviations.
    static _blurReach(deviation) {
      return 3 * deviation;
    }
    _renderHatch(context, primitive) {
      const hatch = primitive.hatch;
      if (!hatch)
        return;
      const path = primitive.path;
      const output = primitive.outputRange;
      const area = cool2.Range2D.fromArray(primitive.bounds ?? output);
      if (!area)
        return;
      context.save();
      if (path)
        context.clip(new Path2D(path), "evenodd");
      else
        cool2.VectorScratchCanvases.clipToRange(context, area);
      if (hatch.fillBackground && primitive.backgroundColor) {
        context.fillStyle = this._fillColor(primitive.backgroundColor);
        context.fillRect(area.minX, area.minY, area.width, area.height);
      }
      this._drawHatchLines(context, hatch, cool2.Range2D.fromArray(primitive.definitionRange) ?? area, area);
      context.restore();
    }
    // Single is one set along the hatch angle, double adds one square
    // to it, and triple a third at forty-five degrees.
    _drawHatchLines(context, hatch, layout, area) {
      const pixels = cool2.VectorScratchCanvases.pixelsPerUnit(context);
      const distance = hatch.distance ?? 0;
      if (!(distance > 0))
        return;
      const spacing = Math.max(distance, 1 / pixels);
      const angle = hatch.angle ?? 0;
      const angles = [angle];
      if (hatch.style === "double" || hatch.style === "triple")
        angles.push(angle - Math.PI / 2);
      if (hatch.style === "triple")
        angles.push(angle - Math.PI / 4);
      const centerX = layout.centerX;
      const centerY = layout.centerY;
      const reach = Math.hypot(area.width, area.height) / 2 + Math.hypot(centerX - area.centerX, centerY - area.centerY);
      const steps = Math.ceil(reach / spacing);
      context.strokeStyle = this._lineColor(hatch.color);
      context.lineWidth = 1 / pixels;
      context.beginPath();
      for (const lineAngle of angles) {
        const alongX = Math.cos(lineAngle);
        const alongY = -Math.sin(lineAngle);
        const acrossX = Math.sin(lineAngle);
        const acrossY = Math.cos(lineAngle);
        for (let step = -steps; step <= steps; step++) {
          const offset = step * spacing;
          const originX = centerX + acrossX * offset;
          const originY = centerY + acrossY * offset;
          context.moveTo(originX - alongX * reach, originY - alongY * reach);
          context.lineTo(originX + alongX * reach, originY + alongY * reach);
        }
      }
      context.stroke();
    }
    _renderPatternFill(context, primitive) {
      const path = primitive.path;
      const area = primitive.bounds;
      const reference = primitive.referenceRange;
      if (!path || !area || !reference)
        return;
      if (area.length < 4 || reference.length < 4)
        return;
      const children = primitive.children;
      if (!children)
        return;
      const areaWidth = area[2] - area[0];
      const areaHeight = area[3] - area[1];
      const unitWidth = reference[2] - reference[0];
      const unitHeight = reference[3] - reference[1];
      const tileWidth = unitWidth * areaWidth;
      const tileHeight = unitHeight * areaHeight;
      if (!(tileWidth > 0 && tileHeight > 0))
        return;
      const pixels = cool2.VectorScratchCanvases.pixelsPerUnit(context);
      if (tileWidth * pixels < 1 || tileHeight * pixels < 1)
        return;
      context.save();
      context.clip(new Path2D(path), "evenodd");
      context.translate(area[0], area[1]);
      context.scale(areaWidth, areaHeight);
      const eachTile = () => this._drawEachPatternTile(context, reference, children);
      this._scratch.withEffectSlots(eachTile, (slot) => {
        if (!this._fillWithPatternTile(context, slot, reference, children)) {
          eachTile();
        }
      });
      context.restore();
    }
    // Map the children onto each tile, clipped to it as in the engine.
    _drawEachPatternTile(context, reference, children) {
      const unitWidth = reference[2] - reference[0];
      const unitHeight = reference[3] - reference[1];
      cool2.VectorScratchCanvases.iterateTiles(reference, 0, 0, (x, y) => {
        context.save();
        context.translate(x, y);
        context.scale(unitWidth, unitHeight);
        context.beginPath();
        context.rect(0, 0, 1, 1);
        context.clip();
        this._renderPrimitives(context, children);
        context.restore();
      });
    }
    // Fill the bounds with one tile drawn at the target's resolution. False
    // without a canvas, or when the tile is larger than the target.
    _fillWithPatternTile(context, slot, reference, children) {
      const unitWidth = reference[2] - reference[0];
      const unitHeight = reference[3] - reference[1];
      const matrix = context.getTransform();
      const width = Math.ceil(Math.hypot(matrix.a, matrix.b) * unitWidth);
      const height = Math.ceil(Math.hypot(matrix.c, matrix.d) * unitHeight);
      if (width > context.canvas.width || height > context.canvas.height)
        return false;
      const tile = this._scratch.slotContext(slot, width, height);
      if (!tile)
        return false;
      tile.setTransform(width, 0, 0, height, 0, 0);
      this._renderPrimitives(tile, children);
      const pattern = context.createPattern(tile.canvas, "repeat");
      if (!pattern)
        return false;
      pattern.setTransform({
        a: unitWidth / width,
        b: 0,
        c: 0,
        d: unitHeight / height,
        e: reference[0],
        f: reference[1]
      });
      context.fillStyle = pattern;
      context.fillRect(0, 0, 1, 1);
      return true;
    }
    // Draw a subtree onto a scratch canvas aligned with the region. A
    // matrix applies on top of the target's transform. A scale below one
    // shrinks the canvas by that factor.
    _renderToScratch(context, slot, children, region, matrix, scale = 1) {
      const scratch = this._scratch.slotContext(slot, Math.ceil(region.width * scale), Math.ceil(region.height * scale));
      if (!scratch)
        return null;
      cool2.VectorScratchCanvases.alignWith(scratch, context, region, scale);
      if (matrix && matrix.length >= 6) {
        scratch.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
      }
      if (children)
        this._renderPrimitives(scratch, children);
      return scratch;
    }
    // Draw the source's coverage onto a same-size target in one color,
    // blurred by a Gaussian of the deviation in pixels. The canvas shadow
    // does the blur, with shadowBlur twice the deviation, and every browser
    // supports it. The source goes one width off to the left, so only its
    // shadow lands.
    static _drawBlurredSilhouette(target, source, color, deviation) {
      target.save();
      target.setTransform(1, 0, 0, 1, 0, 0);
      target.shadowColor = color;
      target.shadowBlur = 2 * deviation;
      target.shadowOffsetX = source.width;
      target.shadowOffsetY = 0;
      target.drawImage(source, -source.width, 0);
      target.restore();
    }
    // Draws the children unchanged.
    _childrenPainter(context, primitive) {
      return () => {
        if (primitive.children)
          this._renderPrimitives(context, primitive.children);
      };
    }
    // Grow the scratch content by the given pixels, drawing the canvas onto
    // itself at offsets around a full turn.
    _dilateScratch(scratch, radius) {
      const steps = Math.min(32, Math.max(8, Math.ceil(Math.PI * radius / 2)));
      const offset = Math.PI * radius / steps;
      scratch.save();
      scratch.setTransform(1, 0, 0, 1, 0, 0);
      scratch.globalCompositeOperation = "source-over";
      for (let step = 0; step < steps; step++) {
        const angle = step / steps * 2 * Math.PI;
        scratch.drawImage(scratch.canvas, Math.cos(angle) * offset, Math.sin(angle) * offset);
      }
      scratch.restore();
    }
    // Shrink the scratch content by growing its outside and cutting that
    // away.
    _erodeScratch(scratch, radius, outsideSlot) {
      const width = scratch.canvas.width;
      const height = scratch.canvas.height;
      const outside = this._scratch.slotContext(outsideSlot, width, height);
      if (!outside)
        return;
      outside.save();
      outside.setTransform(1, 0, 0, 1, 0, 0);
      outside.fillStyle = "#000000";
      outside.fillRect(0, 0, width, height);
      outside.globalCompositeOperation = "destination-out";
      outside.drawImage(scratch.canvas, 0, 0);
      outside.restore();
      this._dilateScratch(outside, radius);
      scratch.save();
      scratch.setTransform(1, 0, 0, 1, 0, 0);
      scratch.globalCompositeOperation = "destination-out";
      scratch.drawImage(outside.canvas, 0, 0);
      scratch.restore();
    }
    // A subtree in one color, moved by the matrix, grown by the dilate
    // radius and blurred by a Gaussian of the deviation in pixels. The
    // bounds cover the result. The subtree goes on the slot's canvas, the
    // result on the next.
    _renderColoredBlur(context, children, bounds, slot, color, deviation, dilateRadius, opacity, matrix) {
      const region = cool2.VectorScratchCanvases.effectRegion(context, bounds, dilateRadius + _VectorPrimitiveRenderer._blurReach(deviation));
      if (!region)
        return;
      const scratch = this._renderToScratch(context, slot, children, region, matrix);
      if (!scratch)
        return;
      if (dilateRadius >= _VectorPrimitiveRenderer._VISIBLE_SPREAD)
        this._dilateScratch(scratch, dilateRadius);
      const blurred = this._scratch.slotContext(slot + 1, region.width, region.height);
      if (!blurred)
        return;
      _VectorPrimitiveRenderer._drawBlurredSilhouette(blurred, scratch.canvas, color, deviation);
      this._scratch.drawOnto(context, blurred, region, opacity);
    }
    _renderShadow(context, primitive) {
      this._scratch.withEffectSlots(void 0, (slot) => {
        this._renderColoredBlur(context, primitive.children, primitive.bounds, slot, primitive.color ?? "#000000", _VectorPrimitiveRenderer._blurDeviation((primitive.blur ?? 0) * cool2.VectorScratchCanvases.pixelsPerUnit(context)), 0, 1, primitive.matrix);
      });
    }
    _renderGlow(context, primitive) {
      this._scratch.withEffectSlots(void 0, (slot) => {
        const radius = (primitive.radius ?? 0) * cool2.VectorScratchCanvases.pixelsPerUnit(context);
        this._renderColoredBlur(context, primitive.children, primitive.bounds, slot, primitive.color ?? "#000000", _VectorPrimitiveRenderer._blurDeviation(radius / 2), radius / 2, 1 - (primitive.transparency ?? 0));
      });
    }
    _renderSoftEdge(context, primitive) {
      const plain = this._childrenPainter(context, primitive);
      this._scratch.withEffectSlots(plain, (slot) => {
        const radius = (primitive.radius ?? 0) * cool2.VectorScratchCanvases.pixelsPerUnit(context);
        const deviation = _VectorPrimitiveRenderer._blurDeviation(radius);
        const region = cool2.VectorScratchCanvases.effectRegion(context, primitive.bounds, radius + _VectorPrimitiveRenderer._blurReach(deviation));
        if (!region)
          return;
        const content = this._renderToScratch(context, slot, primitive.children, region);
        if (!content) {
          plain();
          return;
        }
        const shrunk = radius >= _VectorPrimitiveRenderer._VISIBLE_SPREAD ? this._scratch.slotContext(slot + 1, region.width, region.height) : null;
        if (!shrunk) {
          this._scratch.drawOnto(context, content, region);
          return;
        }
        shrunk.save();
        shrunk.setTransform(1, 0, 0, 1, 0, 0);
        shrunk.globalCompositeOperation = "copy";
        shrunk.drawImage(content.canvas, 0, 0);
        shrunk.restore();
        this._erodeScratch(shrunk, radius, slot + 2);
        const fade = this._scratch.slotContext(slot + 2, region.width, region.height);
        if (!fade) {
          this._scratch.drawOnto(context, content, region);
          return;
        }
        _VectorPrimitiveRenderer._drawBlurredSilhouette(fade, shrunk.canvas, "#000000", deviation);
        content.save();
        content.setTransform(1, 0, 0, 1, 0, 0);
        content.globalCompositeOperation = "destination-in";
        content.drawImage(fade.canvas, 0, 0);
        content.restore();
        this._scratch.drawOnto(context, content, region);
      });
    }
    _renderReflection(context, primitive) {
      const range = primitive.range;
      if (!range || range.length < 4 || !primitive.children)
        return;
      this._scratch.withEffectSlots(void 0, (slot) => {
        const radius = (primitive.blur ?? 0) * cool2.VectorScratchCanvases.pixelsPerUnit(context);
        const deviation = radius >= 1 ? radius / 2 : 0;
        const region = cool2.VectorScratchCanvases.effectRegion(context, primitive.bounds, _VectorPrimitiveRenderer._blurReach(deviation));
        if (!region)
          return;
        const filtered = deviation > 0 && cool2.VectorColorFilters.canFilter(context);
        const scale = deviation > 0 && !filtered ? Math.min(1, Math.sqrt(_VectorPrimitiveRenderer._MAX_BLURRED_REFLECTION_PIXELS / (region.width * region.height))) : 1;
        const content = this._renderToScratch(context, slot, primitive.children, region, primitive.matrix, scale);
        if (!content)
          return;
        _VectorPrimitiveRenderer._fadeReflection(content, context, region, scale, range, primitive);
        if (filtered) {
          context.save();
          context.filter = this._composeFilter(context, "blur(" + deviation + "px)");
          this._scratch.drawOnto(context, content, region);
          context.restore();
          return;
        }
        if (deviation > 0) {
          const width = content.canvas.width;
          const height = content.canvas.height;
          const image = content.getImageData(0, 0, width, height);
          cool2.VectorImageBlur.blur(image.data, width, height, deviation * scale);
          content.putImageData(image, 0, 0);
        }
        this._scratch.drawOnto(context, content, region, void 0, scale);
      });
    }
    // Fade the alpha down the range from the start to the end transparency,
    // and clear it outside the range.
    static _fadeReflection(content, context, region, scale, range, primitive) {
      const clampToUnit = (value) => Math.min(1, Math.max(0, value));
      const startPosition = clampToUnit(primitive.startPosition ?? 0);
      const endPosition = Math.max(startPosition, clampToUnit(primitive.endPosition ?? 1));
      const start = "rgba(0,0,0," + (1 - clampToUnit(primitive.startTransparency ?? 1)) + ")";
      const end = "rgba(0,0,0," + (1 - clampToUnit(primitive.endTransparency ?? 1)) + ")";
      cool2.VectorScratchCanvases.alignWith(content, context, region, scale);
      const gradient = content.createLinearGradient(0, range[1], 0, range[3]);
      gradient.addColorStop(0, start);
      gradient.addColorStop(startPosition, start);
      gradient.addColorStop(endPosition, end);
      gradient.addColorStop(1, end);
      content.save();
      content.globalCompositeOperation = "destination-in";
      content.fillStyle = gradient;
      content.fillRect(range[0], range[1], range[2] - range[0], range[3] - range[1]);
      content.restore();
    }
    _renderInvert(context, primitive) {
      const plain = this._childrenPainter(context, primitive);
      this._scratch.withEffectSlots(plain, (slot) => {
        const region = cool2.VectorScratchCanvases.effectRegion(context, primitive.bounds, 0);
        if (!region)
          return;
        const content = this._renderToScratch(context, slot, primitive.children, region);
        if (!content) {
          plain();
          return;
        }
        let target;
        try {
          target = context.getImageData(region.x, region.y, region.width, region.height);
        } catch {
          plain();
          return;
        }
        const image = content.getImageData(0, 0, region.width, region.height);
        _VectorPrimitiveRenderer._xorOnto(image.data, target.data);
        content.putImageData(image, 0, 0);
        this._scratch.drawOnto(context, content, region);
      });
    }
    // Turn the content into what XOR paints over the target: the target's
    // red, green and blue XORed with the content's, with the target's
    // alpha. A pixel is changed wherever both have any alpha, as in the
    // engine, and left clear everywhere else. The canvas pixels are not
    // premultiplied, so the colors XOR as they are.
    static _xorOnto(content, target) {
      for (let index = 0; index < content.length; index += 4) {
        const alpha = target[index + 3];
        if (content[index + 3] === 0 || alpha === 0) {
          content[index + 3] = 0;
          continue;
        }
        content[index] ^= target[index];
        content[index + 1] ^= target[index + 1];
        content[index + 2] ^= target[index + 2];
        content[index + 3] = alpha;
      }
    }
    _renderTransparence(context, primitive) {
      const maskPrimitives = primitive.transparence;
      if (!(maskPrimitives == null ? void 0 : maskPrimitives.length))
        return;
      const plain = this._childrenPainter(context, primitive);
      this._scratch.withEffectSlots(plain, (slot) => {
        const region = cool2.VectorScratchCanvases.effectRegion(context, primitive.bounds, 0);
        if (!region)
          return;
        const content = this._renderToScratch(context, slot, primitive.children, region);
        const mask = content ? this._scratch.slotContext(slot + 1, region.width, region.height) : null;
        if (!content || !mask) {
          plain();
          return;
        }
        const width = region.width;
        const height = region.height;
        mask.setTransform(1, 0, 0, 1, 0, 0);
        mask.fillStyle = "#ffffff";
        mask.fillRect(0, 0, width, height);
        cool2.VectorScratchCanvases.alignWith(mask, context, region);
        this._renderPrimitives(mask, maskPrimitives);
        const contentImage = content.getImageData(0, 0, width, height);
        const maskImage = mask.getImageData(0, 0, width, height);
        _VectorPrimitiveRenderer._applyLuminanceMask(contentImage.data, maskImage.data);
        content.putImageData(contentImage, 0, 0);
        this._scratch.drawOnto(context, content, region);
      });
    }
    // Scale the content's alpha by one minus the mask's luminance, with the
    // engine's weights.
    static _applyLuminanceMask(content, mask) {
      for (let index = 0; index < content.length; index += 4) {
        const luminance = mask[index] * 0.2125 + mask[index + 1] * 0.7154 + mask[index + 2] * 0.0721;
        content[index + 3] = Math.round(content[index + 3] * (1 - luminance / 255));
      }
    }
    _renderPrimitives(context, primitives) {
      for (const primitive of primitives) {
        this.renderPrimitive(context, primitive);
      }
    }
  };
  _VectorPrimitiveRenderer._reportedUnknownTypes = /* @__PURE__ */ new Set();
  _VectorPrimitiveRenderer._FONT_WEIGHT_CSS = {
    0: 400,
    1: 100,
    2: 200,
    3: 300,
    4: 350,
    5: 400,
    6: 500,
    7: 600,
    8: 700,
    9: 800,
    10: 900
  };
  _VectorPrimitiveRenderer._RELIEF_ENGRAVED = 2;
  _VectorPrimitiveRenderer._MEASURED_WIDTHS_LIMIT = 32768;
  _VectorPrimitiveRenderer._VISIBLE_SPREAD = 0.5;
  _VectorPrimitiveRenderer._MAX_BLURRED_REFLECTION_PIXELS = 25e4;
  let VectorPrimitiveRenderer = _VectorPrimitiveRenderer;
  cool2.VectorPrimitiveRenderer = VectorPrimitiveRenderer;
})(cool || (cool = {}));
