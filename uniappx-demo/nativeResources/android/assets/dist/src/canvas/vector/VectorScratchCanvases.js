var cool;
(function(cool2) {
  const _VectorScratchCanvases = class _VectorScratchCanvases {
    constructor() {
      this._canvases = [];
      this._depth = 0;
    }
    /// Drop the canvases. The next drawing makes new ones.
    release() {
      this._canvases = [];
    }
    // Run an effect on the slots of its nesting level. Past the last level
    // the fallback runs instead.
    withEffectSlots(fallback, work) {
      if (this._depth >= _VectorScratchCanvases._MAX_EFFECT_DEPTH) {
        if (fallback)
          fallback();
        return;
      }
      const slot = this._depth * _VectorScratchCanvases._SLOTS_PER_EFFECT;
      this._depth++;
      try {
        work(slot);
      } finally {
        this._depth--;
      }
    }
    // The slot's canvas at the given size, cleared.
    slotContext(slot, width, height) {
      let canvas = this._canvases[slot];
      if (!canvas) {
        canvas = document.createElement("canvas");
        this._canvases[slot] = canvas;
      }
      const scratch = canvas.getContext("2d");
      if (!scratch)
        return null;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      } else {
        scratch.setTransform(1, 0, 0, 1, 0, 0);
        scratch.clearRect(0, 0, width, height);
      }
      return scratch;
    }
    // Onto the region, with the opacity on top of the target's. A canvas
    // drawn at a scale is stretched back to the region.
    drawOnto(context, scratch, region, opacity, scale = 1) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      if (opacity !== void 0 && opacity < 1)
        context.globalAlpha *= opacity;
      if (scale === 1)
        context.drawImage(scratch.canvas, region.x, region.y);
      else
        context.drawImage(scratch.canvas, region.x, region.y, scratch.canvas.width / scale, scratch.canvas.height / scale);
      context.restore();
    }
    // The target's transform, with the region's corner as origin, times
    // the scale.
    static alignWith(scratch, context, region, scale = 1) {
      const matrix = context.getTransform();
      scratch.setTransform(scale * matrix.a, scale * matrix.b, scale * matrix.c, scale * matrix.d, scale * (matrix.e - region.x), scale * (matrix.f - region.y));
    }
    // The whole target, as a region.
    static wholeTarget(context) {
      return {
        x: 0,
        y: 0,
        width: context.canvas.width,
        height: context.canvas.height
      };
    }
    // The target pixels an effect draws on: its bounds, which hold the
    // whole effect, within the target grown by the spread so content just
    // off the edge still blurs in. Without bounds, the grown target. Null
    // when off the target.
    static effectRegion(context, bounds, spread) {
      const width = context.canvas.width;
      const height = context.canvas.height;
      if (!(width > 0 && height > 0))
        return null;
      const limit = Math.max(width, height);
      const margin = Math.ceil(Math.min(Math.max(spread, 0), limit)) + 1;
      let minX = -margin;
      let minY = -margin;
      let maxX = width + margin;
      let maxY = height + margin;
      if (bounds && bounds.length >= 4) {
        const matrix = context.getTransform();
        let boundsMinX = Infinity;
        let boundsMinY = Infinity;
        let boundsMaxX = -Infinity;
        let boundsMaxY = -Infinity;
        for (const cornerX of [bounds[0], bounds[2]]) {
          for (const cornerY of [bounds[1], bounds[3]]) {
            const x2 = matrix.a * cornerX + matrix.c * cornerY + matrix.e;
            const y2 = matrix.b * cornerX + matrix.d * cornerY + matrix.f;
            boundsMinX = Math.min(boundsMinX, x2);
            boundsMinY = Math.min(boundsMinY, y2);
            boundsMaxX = Math.max(boundsMaxX, x2);
            boundsMaxY = Math.max(boundsMaxY, y2);
          }
        }
        minX = Math.max(minX, boundsMinX - 1);
        minY = Math.max(minY, boundsMinY - 1);
        maxX = Math.min(maxX, boundsMaxX + 1);
        maxY = Math.min(maxY, boundsMaxY + 1);
      }
      const x = Math.floor(minX);
      const y = Math.floor(minY);
      const regionWidth = Math.ceil(maxX) - x;
      const regionHeight = Math.ceil(maxY) - y;
      if (!(regionWidth > 0 && regionHeight > 0))
        return null;
      return { x, y, width: regionWidth, height: regionHeight };
    }
    // Pixels per twip along the x axis of the active transform.
    // Canvas measures a blur radius in pixels whatever the transform
    // says, and a hairline stays one pixel wide at every zoom.
    static pixelsPerUnit(context) {
      const matrix = context.getTransform();
      const scale = Math.hypot(matrix.a, matrix.b);
      return scale > 0 ? scale : 1;
    }
    // Tiles of a repeating fill over the unit square, as the engine
    // lays them out: rows or columns step back to cover the near
    // edge, and an offset shifts every other one.
    static iterateTiles(range, offsetX, offsetY, visit) {
      const width = range[2] - range[0];
      const height = range[3] - range[1];
      let startX = range[0];
      let startY = range[1];
      let columnIndex = 0;
      let rowIndex = 0;
      if (startX > 0) {
        const back = Math.floor(startX / width) + 1;
        columnIndex -= back;
        startX -= back * width;
      }
      if (startX + width < 0) {
        const forward = Math.floor(-startX / width);
        columnIndex += forward;
        startX += forward * width;
      }
      if (startY > 0) {
        const back = Math.floor(startY / height) + 1;
        rowIndex -= back;
        startY -= back * height;
      }
      if (startY + height < 0) {
        const forward = Math.floor(-startY / height);
        rowIndex += forward;
        startY += forward * height;
      }
      if (offsetY !== 0) {
        for (let x = startX; x < 1; x += width, columnIndex++) {
          const first = columnIndex % 2 ? startY - height + offsetY * height : startY;
          for (let y = first; y < 1; y += height)
            visit(x, y);
        }
        return;
      }
      for (let y = startY; y < 1; y += height, rowIndex++) {
        const first = rowIndex % 2 ? startX - width + offsetX * width : startX;
        for (let x = first; x < 1; x += width)
          visit(x, y);
      }
    }
    /// Clip a target to a rectangle, in the coordinates it draws in.
    static clipToRange(context, range) {
      context.beginPath();
      context.rect(range.minX, range.minY, range.width, range.height);
      context.clip();
    }
  };
  _VectorScratchCanvases._SLOTS_PER_EFFECT = 3;
  _VectorScratchCanvases._MAX_EFFECT_DEPTH = 3;
  let VectorScratchCanvases = _VectorScratchCanvases;
  cool2.VectorScratchCanvases = VectorScratchCanvases;
})(cool || (cool = {}));
