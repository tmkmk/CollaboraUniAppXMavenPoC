var cool;
(function(cool2) {
  const _VectorGradientPrimitiveRenderer = class _VectorGradientPrimitiveRenderer {
    constructor(scratch, fillColor = (color) => color) {
      this._scratch = scratch;
      this._fillColor = fillColor;
    }
    renderFillGradient(context, primitive) {
      const gradient = primitive.gradient;
      const output = cool2.Range2D.fromArray(primitive.outputRange);
      if (!gradient || !output)
        return;
      this._paintGradient(context, gradient, primitive.alphaGradient, cool2.Range2D.fromArray(primitive.definitionRange) ?? output, primitive.transparency, () => cool2.VectorScratchCanvases.clipToRange(context, output));
    }
    renderPolyPolygonGradient(context, primitive) {
      const gradient = primitive.gradient;
      const path = primitive.path;
      if (!gradient || !path)
        return;
      const range = cool2.Range2D.fromArray(primitive.definitionRange) ?? cool2.Range2D.fromArray(primitive.bounds);
      this._paintGradient(context, gradient, primitive.alphaGradient, range, primitive.transparency, () => context.clip(new Path2D(path), "evenodd"));
    }
    renderPolyPolygonAlphaGradient(context, primitive) {
      const gradient = primitive.alphaGradient;
      const path = primitive.path;
      if (!gradient || !path)
        return;
      const fill = _VectorGradientPrimitiveRenderer._parseColor(primitive.color && this._fillColor(primitive.color));
      const stops = _VectorGradientPrimitiveRenderer._rampStops(gradient, fill);
      context.save();
      context.clip(new Path2D(path), "evenodd");
      this._fillRamp(context, gradient, cool2.Range2D.fromArray(primitive.bounds), stops);
      context.restore();
    }
    renderSvgLinearGradient(context, primitive) {
      this._paintSvgGradient(context, primitive, (unit) => {
        const repeats = _VectorGradientPrimitiveRenderer._repeats(primitive);
        const from = repeats ? Math.floor(unit.minX) : Math.min(unit.minX, 0);
        const to = repeats ? Math.ceil(unit.maxX) : Math.max(unit.maxX, 1);
        const ramp = context.createLinearGradient(from, 0, to, 0);
        return _VectorGradientPrimitiveRenderer._addSvgStops(ramp, primitive, from, to);
      });
    }
    renderSvgRadialGradient(context, primitive) {
      this._paintSvgGradient(context, primitive, (unit) => {
        var _a, _b;
        const reach = Math.max(Math.hypot(unit.minX, unit.minY), Math.hypot(unit.maxX, unit.minY), Math.hypot(unit.minX, unit.maxY), Math.hypot(unit.maxX, unit.maxY));
        if (!(reach > 0))
          return null;
        const to = _VectorGradientPrimitiveRenderer._repeats(primitive) ? Math.ceil(reach) : Math.max(reach, 1);
        const stepX = ((_a = primitive.focalStep) == null ? void 0 : _a[0]) ?? 0;
        const stepY = ((_b = primitive.focalStep) == null ? void 0 : _b[1]) ?? 0;
        const ramp = context.createRadialGradient(stepX * reach, stepY * reach, 0, stepX * (reach - to), stepY * (reach - to), to);
        return _VectorGradientPrimitiveRenderer._addSvgStops(ramp, primitive, 0, to);
      });
    }
    // Fill the path with the color of a single stop, or with the ramp laid
    // out in the unit gradient over the range the shape covers.
    _paintSvgGradient(context, primitive, createRamp) {
      const stops = primitive.colorStops;
      if (!primitive.path || !(stops == null ? void 0 : stops.length))
        return;
      const path = new Path2D(primitive.path);
      if (stops.length === 1) {
        context.save();
        context.fillStyle = _VectorGradientPrimitiveRenderer._svgStopColor(stops[0]);
        context.fill(path, "evenodd");
        context.restore();
        return;
      }
      const unitToObject = cool2.Matrix2D.fromArray(primitive.unitToObject);
      const objectToUnit = unitToObject == null ? void 0 : unitToObject.invert();
      const bounds = cool2.Range2D.fromArray(primitive.bounds);
      if (!unitToObject || !objectToUnit || !bounds)
        return;
      const corners = [
        objectToUnit.apply(bounds.minX, bounds.minY),
        objectToUnit.apply(bounds.maxX, bounds.minY),
        objectToUnit.apply(bounds.minX, bounds.maxY),
        objectToUnit.apply(bounds.maxX, bounds.maxY)
      ];
      const xs = corners.map((corner) => corner.x);
      const ys = corners.map((corner) => corner.y);
      const unit = new cool2.Range2D(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      const ramp = createRamp(unit);
      if (!ramp)
        return;
      context.save();
      context.clip(path, "evenodd");
      unitToObject.applyTo(context);
      context.fillStyle = ramp;
      context.fillRect(unit.minX, unit.minY, unit.width, unit.height);
      context.restore();
    }
    static _repeats(primitive) {
      return primitive.spreadMethod === "repeat" || primitive.spreadMethod === "reflect";
    }
    // Add the stops to a ramp that runs from gradient position from to to.
    // Repeat starts the stops over at each whole position, and reflect
    // runs every other unit backwards.
    static _addSvgStops(ramp, primitive, from, to) {
      const stops = primitive.colorStops ?? [];
      let last = 0;
      const place = (position, stop) => {
        const offset = Math.min(Math.max((position - from) / (to - from), last), 1);
        ramp.addColorStop(offset, _VectorGradientPrimitiveRenderer._svgStopColor(stop));
        last = offset;
      };
      if (!_VectorGradientPrimitiveRenderer._repeats(primitive) || to - from > _VectorGradientPrimitiveRenderer._SVG_MAXIMUM_REPEATS) {
        for (const stop of stops)
          place(stop.offset, stop);
        return ramp;
      }
      for (let unit = from; unit < to; unit++) {
        const backwards = primitive.spreadMethod === "reflect" && Math.abs(unit % 2) === 1;
        const ordered = backwards ? [...stops].reverse() : stops;
        place(unit, ordered[0]);
        for (const stop of ordered)
          place(unit + (backwards ? 1 - stop.offset : stop.offset), stop);
        place(unit + 1, ordered[ordered.length - 1]);
      }
      return ramp;
    }
    static _svgStopColor(stop) {
      return _VectorGradientPrimitiveRenderer._cssColor({
        ..._VectorGradientPrimitiveRenderer._parseColor(stop.color),
        alpha: stop.opacity ?? 1
      });
    }
    // Fill the clip with a color ramp, its transparency from an alpha
    // ramp when there is one.
    _paintGradient(context, gradient, alphaGradient, range, transparency, clip) {
      const stops = _VectorGradientPrimitiveRenderer._rampStops(gradient, void 0, this._fillColor);
      if (!stops.length)
        return;
      context.save();
      if (transparency)
        context.globalAlpha = 1 - transparency;
      clip();
      if (!alphaGradient) {
        this._fillRamp(context, gradient, range, stops);
        context.restore();
        return;
      }
      const plainRamp = () => this._fillRamp(context, gradient, range, stops);
      try {
        this._scratch.withEffectSlots(plainRamp, (slot) => {
          const width = context.canvas.width;
          const height = context.canvas.height;
          const scratch = width > 0 && height > 0 ? this._scratch.slotContext(slot, width, height) : null;
          if (!scratch) {
            plainRamp();
            return;
          }
          scratch.setTransform(context.getTransform());
          this._fillRamp(scratch, gradient, range, stops);
          scratch.globalCompositeOperation = "destination-in";
          this._fillRamp(scratch, alphaGradient, range, _VectorGradientPrimitiveRenderer._rampStops(alphaGradient, {
            red: 0,
            green: 0,
            blue: 0,
            alpha: 1
          }));
          scratch.globalCompositeOperation = "source-over";
          this._scratch.drawOnto(context, scratch, cool2.VectorScratchCanvases.wholeTarget(context));
        });
      } finally {
        context.restore();
      }
    }
    // The canvas gradient for a ramp, in the ramp's own space.
    _rampGradient(context, style, stops) {
      if (style === "axial") {
        return _VectorGradientPrimitiveRenderer._mirroredGradient(context, stops.map((stop) => ({ ...stop, offset: 1 - stop.offset })), 0, -1, 0, 1);
      }
      if (style === "radial" || style === "elliptical") {
        const gradient2 = context.createRadialGradient(0, 0, 0, 0, 0, 1);
        for (const stop of stops) {
          gradient2.addColorStop(1 - stop.offset, _VectorGradientPrimitiveRenderer._cssColor(stop));
        }
        return gradient2;
      }
      const gradient = context.createLinearGradient(0, 0, 0, 1);
      for (const stop of stops) {
        gradient.addColorStop(stop.offset, _VectorGradientPrimitiveRenderer._cssColor(stop));
      }
      return gradient;
    }
    // Paint a ramp over the clip. The frame places it, so the fill
    // works in ramp space.
    _fillRamp(context, gradient, range, stops) {
      if (!stops.length)
        return;
      const frame = cool2.VectorGradientFrame.create(gradient, range);
      if (!frame)
        return;
      const reach = _VectorGradientPrimitiveRenderer._RAMP_REACH;
      context.save();
      frame.matrix.applyTo(context);
      if (stops.length === 1) {
        context.fillStyle = _VectorGradientPrimitiveRenderer._cssColor(stops[0]);
        context.fillRect(-reach, -reach, reach * 2, reach * 2);
      } else if (gradient.style === "square" || gradient.style === "rect") {
        this._fillBoxedRamp(context, stops, frame.aspectRatio);
      } else {
        context.fillStyle = this._rampGradient(context, gradient.style, stops);
        context.fillRect(-reach, -reach, reach * 2, reach * 2);
      }
      context.restore();
    }
    // A linear gradient read inwards from both ends, so the last
    // stop sits in the middle. The middle stretch, inner in units of
    // the line's half-length, holds that color throughout.
    static _mirroredGradient(context, stops, x0, y0, x1, y1, inner = 0) {
      const gradient = context.createLinearGradient(x0, y0, x1, y1);
      const span = (1 - inner) / 2;
      for (const stop of stops) {
        const color = _VectorGradientPrimitiveRenderer._cssColor(stop);
        gradient.addColorStop(stop.offset * span, color);
        gradient.addColorStop(1 - stop.offset * span, color);
      }
      return gradient;
    }
    // The square and rect ramps fall off from each edge of a box to
    // the middle. That is the ramp mirrored top to bottom, with the
    // ramp mirrored side to side over the left and right wedges, and
    // both give the same color along a wedge edge. The engine
    // stretches the wider axis, so the last stop lands on a segment
    // rather than a point.
    _fillBoxedRamp(context, stops, aspectRatio) {
      const reach = _VectorGradientPrimitiveRenderer._RAMP_REACH;
      context.fillStyle = _VectorGradientPrimitiveRenderer._cssColor(stops[0]);
      context.fillRect(-reach, -reach, reach * 2, reach * 2);
      const innerX = aspectRatio > 1 ? 1 - 1 / aspectRatio : 0;
      const innerY = aspectRatio > 0 && aspectRatio < 1 ? 1 - aspectRatio : 0;
      context.fillStyle = _VectorGradientPrimitiveRenderer._mirroredGradient(context, stops, 0, -1, 0, 1, innerY);
      context.fillRect(-1, -1, 2, 2);
      context.beginPath();
      context.moveTo(-1, -1);
      context.lineTo(-innerX, -innerY);
      context.lineTo(-innerX, innerY);
      context.lineTo(-1, 1);
      context.closePath();
      context.moveTo(1, -1);
      context.lineTo(innerX, -innerY);
      context.lineTo(innerX, innerY);
      context.lineTo(1, 1);
      context.closePath();
      context.fillStyle = _VectorGradientPrimitiveRenderer._mirroredGradient(context, stops, -1, 0, 1, 0, innerX);
      context.fill();
    }
    static _parseColor(color) {
      if (!color || color.charAt(0) !== "#" || color.length < 7)
        return { red: 0, green: 0, blue: 0, alpha: 1 };
      return {
        red: parseInt(color.substring(1, 3), 16),
        green: parseInt(color.substring(3, 5), 16),
        blue: parseInt(color.substring(5, 7), 16),
        alpha: 1
      };
    }
    static _cssColor(color) {
      return "rgba(" + color.red + "," + color.green + "," + color.blue + "," + color.alpha + ")";
    }
    static _mixColor(from, to, position) {
      const mix = (start, end) => start + (end - start) * position;
      return {
        red: Math.round(mix(from.red, to.red)),
        green: Math.round(mix(from.green, to.green)),
        blue: Math.round(mix(from.blue, to.blue)),
        alpha: mix(from.alpha, to.alpha)
      };
    }
    // The stops a gradient describes. An alpha ramp keeps the given
    // color and reads each stop's luminance as its transparency. A color
    // ramp draws each stop in the color stopColor gives for it.
    static _rampStops(gradient, fill, stopColor = (color) => color) {
      const source = gradient.colorStops;
      if (!source || !source.length)
        return [];
      let stops = source.map((stop) => {
        const color = _VectorGradientPrimitiveRenderer._parseColor(!fill && stop.color ? stopColor(stop.color) : stop.color);
        if (typeof stop.opacity === "number")
          color.alpha = stop.opacity;
        if (fill) {
          const luminance = (color.red * 0.299 + color.green * 0.587 + color.blue * 0.114) / 255;
          return {
            offset: stop.offset,
            red: fill.red,
            green: fill.green,
            blue: fill.blue,
            alpha: 1 - luminance
          };
        }
        return { offset: stop.offset, ...color };
      });
      const steps = gradient.steps ?? 0;
      if (steps > 0 && stops.length > 1)
        stops = _VectorGradientPrimitiveRenderer._bandStops(stops, steps);
      return stops;
    }
    // The most bands worth drawing between two colors. The engine
    // takes it from their distance in the widest channel.
    static _bandLimit(from, to) {
      const distance = Math.max(Math.abs(from.red - to.red), Math.abs(from.green - to.green), Math.abs(from.blue - to.blue));
      return Math.round(distance / 255 * 127.5);
    }
    // Flat bands the way the engine counts them: the step count
    // applies per pair of stops, and the end bands carry the pair's
    // colors exactly.
    static _bandStops(stops, steps) {
      const banded = [];
      for (let index = 0; index < stops.length - 1; index++) {
        const from = stops[index];
        const to = stops[index + 1];
        const span = to.offset - from.offset;
        if (!(span > 0))
          continue;
        const bands = Math.max(1, Math.min(steps, _VectorGradientPrimitiveRenderer._bandLimit(from, to)));
        const width = span / bands;
        for (let band = 0; band < bands; band++) {
          const color = bands === 1 ? from : _VectorGradientPrimitiveRenderer._mixColor(from, to, band / (bands - 1));
          banded.push({ offset: from.offset + band * width, ...color });
          banded.push({ offset: from.offset + (band + 1) * width, ...color });
        }
      }
      return banded.length ? banded : stops;
    }
  };
  _VectorGradientPrimitiveRenderer._SVG_MAXIMUM_REPEATS = 512;
  _VectorGradientPrimitiveRenderer._RAMP_REACH = 4;
  let VectorGradientPrimitiveRenderer = _VectorGradientPrimitiveRenderer;
  cool2.VectorGradientPrimitiveRenderer = VectorGradientPrimitiveRenderer;
})(cool || (cool = {}));
