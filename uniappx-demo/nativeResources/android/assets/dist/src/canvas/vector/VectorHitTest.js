var cool;
(function(cool2) {
  const _VectorHitTest = class _VectorHitTest {
    static context() {
      if (_VectorHitTest._context === void 0)
        _VectorHitTest._context = document.createElement("canvas").getContext("2d");
      return _VectorHitTest._context;
    }
    /** What the point hits among the primitives, or nothing when it hits none of them.
     *
     * The primitives are in the order they are painted, and the answer is the last of them
     * that is hit, so what lies on top of everything else is what answers. Primitives that
     * paint over the whole object are tested against the range, the area the object covers.
     */
    static hit(primitives, position, range, walk = _VectorHitTest.wholeOf()) {
      if (!primitives)
        return void 0;
      let result = void 0;
      primitives.forEach((primitive) => {
        const hit = _VectorHitTest.hitPrimitive(primitive, position, range, walk);
        if (hit)
          result = hit;
      });
      return result;
    }
    /// Whether the point hits any of the primitives.
    static isHit(primitives, position, range) {
      return _VectorHitTest.hit(primitives, position, range) !== void 0;
    }
    /** Whether the point lies in the unit square put through the matrix.
     *
     * This is the shape of an object as its own transformation describes it, so it carries the
     * rotation and the shear that an upright rectangle around the object cannot. What an object
     * paints beyond that square, a wide outline or a shadow, lies outside it.
     */
    static isInUnitSquare(matrix, position) {
      if (!matrix)
        return false;
      return _VectorHitTest.hitFill(_VectorHitTest.pathOfUnitSquare(matrix), position) !== void 0;
    }
    /** Whether the point hits the text of the primitives, and nothing else of them.
     *
     * The tolerance is what decides how far from the glyphs still counts, per axis, so a
     * caller that asks about a line of text gives a wide reach along the line and none across
     * it. The document engine asks the same question, with the same per-axis tolerance, to
     * decide whether a click would go into the text of a shape.
     */
    static isHitText(primitives, position) {
      return _VectorHitTest.hit(primitives, position, void 0, {
        ..._VectorHitTest.wholeOf(),
        textOnly: true
      }) !== void 0;
    }
    static hitPrimitive(primitive, position, range, walk = _VectorHitTest.wholeOf()) {
      var _a;
      if (!primitive || !primitive.type)
        return void 0;
      const fields = primitive;
      switch (primitive.type) {
        case cool2.TextSimplePortionPrimitive.type:
        case cool2.TextDecoratedPortionPrimitive.type:
          return _VectorHitTest.result("text", walk, _VectorHitTest.isInText(primitive, position));
        case cool2.TransformPrimitive.type:
        case cool2.ReflectionPrimitive.type:
          return _VectorHitTest.hit(primitive.children, _VectorHitTest.positionThrough(position, cool2.Matrix2D.fromArray(fields.matrix)), range, {
            ...walk,
            matrix: _VectorHitTest.matrixThrough(walk.matrix, fields.matrix)
          });
        case cool2.MaskPrimitive.type:
          if (fields.clip && _VectorHitTest.hitFill(new Path2D(fields.clip), position) === void 0)
            return void 0;
          return _VectorHitTest.hit(primitive.children, position, range, walk);
        case cool2.HiddenGeometryPrimitive.type:
          return _VectorHitTest.hit(primitive.children, position, range, {
            ...walk,
            hidden: true
          });
        case cool2.ExclusiveEditViewPrimitive.type:
          return _VectorHitTest.hit(primitive.children, position, range, {
            ...walk,
            editView: true
          });
        case cool2.PolygonHairlinePrimitive.type: {
          if (walk.textOnly)
            return void 0;
          const line = _VectorHitTest.pathOf(fields.path);
          return _VectorHitTest.result("line", walk, _VectorHitTest.isAlongStrokedPath(line, position, 0), line);
        }
        case cool2.PolygonStrokePrimitive.type:
        case cool2.PolyPolygonStrokePrimitive.type: {
          if (walk.textOnly)
            return void 0;
          const stroke = _VectorHitTest.pathOf(fields.path);
          return _VectorHitTest.result("line", walk, _VectorHitTest.isAlongStrokedPath(stroke, position, ((_a = fields.line) == null ? void 0 : _a.width) ?? 0, fields.line), stroke);
        }
        case cool2.SingleLinePrimitive.type: {
          if (walk.textOnly)
            return void 0;
          const line = fields;
          const path = new Path2D();
          path.moveTo(line.startX ?? 0, line.startY ?? 0);
          path.lineTo(line.endX ?? 0, line.endY ?? 0);
          return _VectorHitTest.result("line", walk, _VectorHitTest.isAlongStrokedPath(path, position, 0), path);
        }
        case cool2.LineRectanglePrimitive.type: {
          if (walk.textOnly)
            return void 0;
          const outline = _VectorHitTest.pathOfRange(cool2.Range2D.fromArray(fields.bounds));
          return _VectorHitTest.result("line", walk, _VectorHitTest.isAlongStrokedPath(outline, position, 0), outline);
        }
        case cool2.PolyPolygonColorPrimitive.type:
        case cool2.PolyPolygonRGBAPrimitive.type:
        case "polyPolygonGradient":
        case "polyPolygonAlphaGradient":
        case "polyPolygonHatch":
        case "polyPolygonGraphic":
        case "patternFill": {
          if (walk.textOnly)
            return void 0;
          const fill = _VectorHitTest.pathOf(fields.path);
          return _VectorHitTest.fillResult(walk, _VectorHitTest.hitFill(fill, position), fill);
        }
        case cool2.FilledRectanglePrimitive.type: {
          if (walk.textOnly)
            return void 0;
          const area = _VectorHitTest.pathOfRange(cool2.Range2D.fromArray(fields.bounds));
          return _VectorHitTest.fillResult(walk, _VectorHitTest.hitFill(area, position), area);
        }
        case "fillGradient":
        case "fillHatch":
        case "fillGraphic": {
          if (walk.textOnly)
            return void 0;
          const covered = _VectorHitTest.pathOfRange(cool2.Range2D.fromArray(fields.outputRange)) ?? _VectorHitTest.pathOfUnitSquare(cool2.Matrix2D.fromArray(fields.matrix));
          return _VectorHitTest.fillResult(walk, _VectorHitTest.hitFill(covered, position), covered);
        }
        case cool2.BackgroundColorPrimitive.type: {
          if (walk.textOnly)
            return void 0;
          const down = walk.matrix.invert();
          if (!down)
            return void 0;
          const whole = _VectorHitTest.pathThrough(_VectorHitTest.pathOfRange(range), down);
          return _VectorHitTest.fillResult(walk, _VectorHitTest.hitFill(whole, position), whole);
        }
        case cool2.BitmapPrimitive.type:
        case cool2.BitmapAlphaPrimitive.type:
        case cool2.GraphicPrimitive.type:
        case cool2.FormControlPrimitive.type: {
          if (fields.matrix) {
            if (walk.textOnly)
              return void 0;
            const image = _VectorHitTest.pathOfUnitSquare(cool2.Matrix2D.fromArray(fields.matrix));
            return _VectorHitTest.result("bitmap", walk, _VectorHitTest.hitFill(image, position) !== void 0, image);
          }
          return _VectorHitTest.hit(primitive.children, position, range, walk);
        }
        case cool2.PointArrayPrimitive.type:
          if (walk.textOnly)
            return void 0;
          return _VectorHitTest.result("point", walk, _VectorHitTest.isAtPoint(primitive, position));
        case "shadow":
          return void 0;
        case cool2.TextHierarchyFieldPrimitive.type:
          return _VectorHitTest.hit(primitive.children, position, range, {
            ...walk,
            link: walk.link || primitive.fieldType === "url"
          });
        default:
          return _VectorHitTest.hit(primitive.children, position, range, walk);
      }
    }
    /*
        The outline of what the primitives draw as geometry, in the coordinates they are written
        in: the boundary of every fill and the course of every line, through the transforms
        they hang under. Text is left out, so the outline of a shape is not that of the letters
        in it, and so are shadows and the background that covers the whole object. A fill
        inside a mask, a gradient or a picture filling a shape, is outlined by the mask, which
        is what gives it its shape. Nothing where the primitives draw no geometry.
    */
    static outlineOf(primitives) {
      const outline = new Path2D();
      let anything = false;
      const add = (path, matrix) => {
        if (!path)
          return;
        outline.addPath(path, {
          a: matrix.a,
          b: matrix.b,
          c: matrix.c,
          d: matrix.d,
          e: matrix.e,
          f: matrix.f
        });
        anything = true;
      };
      const walk = (list, matrix) => {
        for (const primitive of list ?? []) {
          const fields = primitive;
          switch (primitive.type) {
            case cool2.TextSimplePortionPrimitive.type:
            case cool2.TextDecoratedPortionPrimitive.type:
            case cool2.BackgroundColorPrimitive.type:
            case cool2.PointArrayPrimitive.type:
            case "shadow":
              break;
            case cool2.TransformPrimitive.type:
            case cool2.ReflectionPrimitive.type:
              walk(primitive.children, _VectorHitTest.matrixThrough(matrix, fields.matrix));
              break;
            case cool2.MaskPrimitive.type:
              if (fields.clip)
                add(new Path2D(fields.clip), matrix);
              else
                walk(primitive.children, matrix);
              break;
            case cool2.PolygonHairlinePrimitive.type:
            case cool2.PolygonStrokePrimitive.type:
            case cool2.PolyPolygonStrokePrimitive.type:
            case cool2.PolyPolygonColorPrimitive.type:
            case cool2.PolyPolygonRGBAPrimitive.type:
            case "polyPolygonGradient":
            case "polyPolygonAlphaGradient":
            case "polyPolygonHatch":
            case "polyPolygonGraphic":
            case "patternFill":
              add(_VectorHitTest.pathOf(fields.path), matrix);
              break;
            case cool2.SingleLinePrimitive.type: {
              const line = fields;
              const path = new Path2D();
              path.moveTo(line.startX ?? 0, line.startY ?? 0);
              path.lineTo(line.endX ?? 0, line.endY ?? 0);
              add(path, matrix);
              break;
            }
            case cool2.LineRectanglePrimitive.type:
            case cool2.FilledRectanglePrimitive.type:
              add(_VectorHitTest.pathOfRange(cool2.Range2D.fromArray(fields.bounds)), matrix);
              break;
            case "fillGradient":
            case "fillHatch":
            case "fillGraphic":
              add(_VectorHitTest.pathOfRange(cool2.Range2D.fromArray(fields.outputRange)) ?? _VectorHitTest.pathOfUnitSquare(cool2.Matrix2D.fromArray(fields.matrix)), matrix);
              break;
            case cool2.BitmapPrimitive.type:
            case cool2.BitmapAlphaPrimitive.type:
            case cool2.GraphicPrimitive.type:
              if (fields.matrix)
                add(_VectorHitTest.pathOfUnitSquare(cool2.Matrix2D.fromArray(fields.matrix)), matrix);
              else
                walk(primitive.children, matrix);
              break;
            default:
              walk(primitive.children, matrix);
          }
        }
      };
      walk(primitives, cool2.Matrix2D.IDENTITY);
      return anything ? outline : void 0;
    }
    static result(kind, walk, hit, path) {
      if (!hit)
        return void 0;
      return {
        kind,
        hidden: walk.hidden,
        editView: walk.editView,
        edge: false,
        link: kind === "text" && walk.link,
        path: _VectorHitTest.pathThrough(path, walk.matrix)
      };
    }
    static fillResult(walk, where, path) {
      if (!where)
        return void 0;
      return {
        kind: "fill",
        hidden: walk.hidden,
        editView: walk.editView,
        edge: where === "edge",
        link: false,
        path: _VectorHitTest.pathThrough(path, walk.matrix)
      };
    }
    /// A walk that asks about everything, in the coordinates the primitives are written in.
    static wholeOf() {
      return {
        textOnly: false,
        hidden: false,
        editView: false,
        link: false,
        matrix: cool2.Matrix2D.IDENTITY
      };
    }
    /// The two matrices as one: what maps a child onto what the walk was asked in.
    static matrixThrough(parent, child) {
      const own = cool2.Matrix2D.fromArray(child);
      return own ? own.then(parent) : parent;
    }
    /// The path in the coordinates the walk was asked in.
    static pathThrough(path, matrix) {
      if (!path)
        return void 0;
      const mapped = new Path2D();
      mapped.addPath(path, {
        a: matrix.a,
        b: matrix.b,
        c: matrix.c,
        d: matrix.d,
        e: matrix.e,
        f: matrix.f
      });
      return mapped;
    }
    /// The position and the tolerance in the coordinates a child of the matrix is written in.
    static positionThrough(position, matrix) {
      const back = matrix == null ? void 0 : matrix.invert();
      if (!back)
        return position;
      const at = back.apply(position.x, position.y);
      return {
        x: at.x,
        y: at.y,
        toleranceX: Math.abs(back.a) * position.toleranceX + Math.abs(back.c) * position.toleranceY,
        toleranceY: Math.abs(back.b) * position.toleranceX + Math.abs(back.d) * position.toleranceY
      };
    }
    static tolerance(position) {
      return Math.max(position.toleranceX, position.toleranceY);
    }
    static pathOfRange(range) {
      if (!range)
        return void 0;
      const path = new Path2D();
      path.rect(range.minX, range.minY, range.width, range.height);
      return path;
    }
    /** The four corners of the unit square put through the matrix.
     *
     * It is the area an image covers, and the shape of an object as its own transformation
     * describes it.
     */
    static pathOfUnitSquare(matrix) {
      if (!matrix)
        return void 0;
      const path = new Path2D();
      [
        matrix.apply(0, 0),
        matrix.apply(1, 0),
        matrix.apply(1, 1),
        matrix.apply(0, 1)
      ].forEach((corner, at) => at ? path.lineTo(corner.x, corner.y) : path.moveTo(corner.x, corner.y));
      path.closePath();
      return path;
    }
    /// Where the point lies in a filled path: inside it, within the tolerance of its
    /// boundary, or neither. The engine fills with the even-odd rule, so a subpath inside
    /// another subpath is a hole there as well.
    static hitFill(path, position) {
      const context = _VectorHitTest.context();
      if (!path || !context)
        return void 0;
      if (context.isPointInPath(path, position.x, position.y, "evenodd"))
        return "inside";
      return _VectorHitTest.isAlongStrokedPath(path, position, 0) ? "edge" : void 0;
    }
    static pathOf(path) {
      return path ? new Path2D(path) : void 0;
    }
    /// Within half the line width of the path, plus the tolerance. The joins and caps are the
    /// ones the line is drawn with, so a mitered corner reaches as far as it is painted.
    static isAlongStrokedPath(path, position, width, line) {
      const context = _VectorHitTest.context();
      if (!path || !context)
        return false;
      const reach = width + 2 * _VectorHitTest.tolerance(position);
      if (!(reach > 0))
        return false;
      context.save();
      context.lineWidth = reach;
      context.lineJoin = (line == null ? void 0 : line.linejoin) === "round" || (line == null ? void 0 : line.linejoin) === "bevel" ? line.linejoin : "miter";
      context.lineCap = (line == null ? void 0 : line.linecap) === "round" || (line == null ? void 0 : line.linecap) === "square" ? line.linecap : "butt";
      const hit = context.isPointInStroke(path, position.x, position.y);
      context.restore();
      return hit;
    }
    /// A text is hit inside the area its glyphs occupy, measured for the font the portion
    /// names, the way the engine uses the area a text portion covers.
    static isInText(primitive, position) {
      const context = _VectorHitTest.context();
      if (!context || !primitive.text)
        return false;
      const start = primitive.textPosition ?? 0;
      const length = primitive.textLength ?? primitive.text.length - start;
      const text = primitive.text.substring(start, start + length);
      if (!text)
        return false;
      const fontSize = primitive.fontSize ?? 0;
      if (!(fontSize > 0))
        return false;
      const glyphs = cool2.Matrix2D.fromArray(primitive.matrix) ?? cool2.Matrix2D.IDENTITY.scale(fontSize, fontSize);
      const local = _VectorHitTest.positionThrough(position, new cool2.Matrix2D(glyphs.a / fontSize, glyphs.b / fontSize, glyphs.c / fontSize, glyphs.d / fontSize, glyphs.e, glyphs.f));
      context.font = `${primitive.italic ? "italic" : "normal"} ${fontSize}px "${primitive.familyname ?? "sans-serif"}"`;
      const metrics = context.measureText(text);
      const width = metrics.width;
      const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
      const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
      const box = _VectorHitTest.pathOfRange(new cool2.Range2D(-local.toleranceX, -ascent - local.toleranceY, width + local.toleranceX, descent + local.toleranceY));
      return _VectorHitTest.hitFill(box, {
        x: local.x,
        y: local.y,
        toleranceX: 0,
        toleranceY: 0
      }) !== void 0;
    }
    static isAtPoint(primitive, position) {
      if (!primitive.points)
        return false;
      const reach = _VectorHitTest.tolerance(position);
      return primitive.points.some((point) => Math.hypot(point.x - position.x, point.y - position.y) <= reach);
    }
  };
  _VectorHitTest._context = void 0;
  let VectorHitTest = _VectorHitTest;
  cool2.VectorHitTest = VectorHitTest;
})(cool || (cool = {}));
