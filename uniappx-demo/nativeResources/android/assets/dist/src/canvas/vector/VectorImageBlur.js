var cool;
(function(cool2) {
  const _VectorImageBlur = class _VectorImageBlur {
    /// Blur the pixels in place. The deviation is in pixels.
    static blur(data, width, height, deviation) {
      if (!(deviation > 0) || !(width > 0 && height > 0))
        return;
      const count = width * height;
      const channels = [
        new Float32Array(count),
        new Float32Array(count),
        new Float32Array(count),
        new Float32Array(count)
      ];
      for (let index = 0; index < count; index++) {
        const alpha = data[4 * index + 3];
        channels[0][index] = data[4 * index] * alpha / 255;
        channels[1][index] = data[4 * index + 1] * alpha / 255;
        channels[2][index] = data[4 * index + 2] * alpha / 255;
        channels[3][index] = alpha;
      }
      const pass = new Float32Array(count);
      for (const size of _VectorImageBlur.boxSizes(deviation)) {
        const radius = (size - 1) / 2;
        for (const channel of channels) {
          _VectorImageBlur._boxBlur(channel, pass, height, width, width, 1, radius);
          _VectorImageBlur._boxBlur(pass, channel, width, 1, height, width, radius);
        }
      }
      for (let index = 0; index < count; index++) {
        const alpha = channels[3][index];
        const scale = alpha > 0 ? 255 / alpha : 0;
        data[4 * index] = channels[0][index] * scale;
        data[4 * index + 1] = channels[1][index] * scale;
        data[4 * index + 2] = channels[2][index] * scale;
        data[4 * index + 3] = alpha;
      }
    }
    /// The odd widths of the three boxes closest to a Gaussian of the
    /// deviation.
    static boxSizes(deviation) {
      const boxes = _VectorImageBlur._BOX_COUNT;
      const variance = deviation * deviation;
      let lower = Math.floor(Math.sqrt(12 * variance / boxes + 1));
      if (lower % 2 === 0)
        lower--;
      const upper = lower + 2;
      const lowerCount = Math.round((12 * variance - boxes * lower * lower - 4 * boxes * lower - 3 * boxes) / (-4 * lower - 4));
      const sizes = [];
      for (let box = 0; box < boxes; box++)
        sizes.push(box < lowerCount ? lower : upper);
      return sizes;
    }
    // Average each value with radius values on each side. Lines start
    // lineStep apart, and the values of a line are step apart.
    static _boxBlur(source, target, lines, lineStep, length, step, radius) {
      const size = 2 * radius + 1;
      for (let line = 0; line < lines; line++) {
        const start = line * lineStep;
        let sum = 0;
        for (let offset = 0; offset <= Math.min(radius, length - 1); offset++)
          sum += source[start + offset * step];
        for (let position = 0; position < length; position++) {
          target[start + position * step] = sum / size;
          const entering = position + radius + 1;
          if (entering < length)
            sum += source[start + entering * step];
          const leaving = position - radius;
          if (leaving >= 0)
            sum -= source[start + leaving * step];
        }
      }
    }
  };
  _VectorImageBlur._BOX_COUNT = 3;
  let VectorImageBlur = _VectorImageBlur;
  cool2.VectorImageBlur = VectorImageBlur;
})(cool || (cool = {}));
