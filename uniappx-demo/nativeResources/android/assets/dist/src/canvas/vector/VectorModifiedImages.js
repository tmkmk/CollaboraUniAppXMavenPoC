var cool;
(function(cool2) {
  const _VectorModifiedImages = class _VectorModifiedImages {
    /// The budget is in bytes, at four bytes per pixel.
    constructor(budget = 64 * 1024 * 1024) {
      this._imageIds = /* @__PURE__ */ new WeakMap();
      this._nextImageId = 0;
      this._copies = /* @__PURE__ */ new Map();
      this._bytes = 0;
      this._budget = budget;
    }
    /// The modified image, at least width by height where the image is that
    /// large. The image itself when no canvas is available.
    get(image, modifiers, width, height) {
      if (!(image.naturalWidth > 0 && image.naturalHeight > 0))
        return image;
      const svg = _VectorModifiedImages._isSvg(image);
      const maxWidth = svg ? _VectorModifiedImages._MAX_SVG_SIZE : image.naturalWidth;
      const maxHeight = svg ? _VectorModifiedImages._MAX_SVG_SIZE : image.naturalHeight;
      const neededWidth = Math.min(maxWidth, Math.max(1, Math.ceil(width)));
      const neededHeight = Math.min(maxHeight, Math.max(1, Math.ceil(height)));
      const key = this._imageId(image) + " " + JSON.stringify(modifiers);
      const cached = this._copies.get(key);
      if (cached) {
        this._copies.delete(key);
        if (cached.canvas.width >= neededWidth && cached.canvas.height >= neededHeight) {
          this._copies.set(key, cached);
          return cached.canvas;
        }
        this._free(cached);
      }
      const copyWidth = Math.min(maxWidth, Math.ceil(neededWidth * _VectorModifiedImages._HEADROOM));
      const copyHeight = Math.min(maxHeight, Math.ceil(neededHeight * _VectorModifiedImages._HEADROOM));
      const canvas = document.createElement("canvas");
      canvas.width = copyWidth;
      canvas.height = copyHeight;
      const copy = canvas.getContext("2d");
      if (!copy)
        return image;
      copy.drawImage(image, 0, 0, copyWidth, copyHeight);
      const pixels = copy.getImageData(0, 0, copyWidth, copyHeight);
      cool2.VectorColorModifiers.applyToPixels(pixels.data, modifiers);
      copy.putImageData(pixels, 0, 0);
      const entry = { canvas, bytes: copyWidth * copyHeight * 4 };
      this._copies.set(key, entry);
      this._bytes += entry.bytes;
      this._keepToBudget(key);
      return canvas;
    }
    /// Drop every copy.
    release() {
      this._copies.forEach((entry) => this._free(entry));
      this._copies.clear();
    }
    // The image data arrives as a data URL with its MIME type.
    static _isSvg(image) {
      return image.src.startsWith("data:image/svg+xml");
    }
    _imageId(image) {
      let id = this._imageIds.get(image);
      if (id === void 0) {
        id = this._nextImageId++;
        this._imageIds.set(image, id);
      }
      return id;
    }
    // Drop the oldest copies to fit the budget, always keeping the newest.
    _keepToBudget(newest) {
      for (const [key, entry] of Array.from(this._copies)) {
        if (this._bytes <= this._budget)
          return;
        if (key === newest)
          continue;
        this._copies.delete(key);
        this._free(entry);
      }
    }
    // A zero-size canvas frees its pixels before garbage collection.
    _free(entry) {
      this._bytes -= entry.bytes;
      entry.canvas.width = 0;
      entry.canvas.height = 0;
    }
  };
  _VectorModifiedImages._HEADROOM = 1.25;
  _VectorModifiedImages._MAX_SVG_SIZE = 4096;
  let VectorModifiedImages = _VectorModifiedImages;
  cool2.VectorModifiedImages = VectorModifiedImages;
})(cool || (cool = {}));
