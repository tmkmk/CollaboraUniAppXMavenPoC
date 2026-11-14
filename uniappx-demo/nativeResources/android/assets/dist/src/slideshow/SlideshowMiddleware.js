const _SlideBitmapManager = class _SlideBitmapManager {
  static decompressImageData(imgRawData, width, height) {
    const workers = window.app.socket.getTaskWorkers();
    if (workers.length) {
      if (this.lastWorker === -1) {
        window.app.socket.addTaskErrorHandler(this.onWorkerError.bind(this));
        window.app.socket.setTaskHandler("decompressedImageData", this.onWorkerDecompressedImageData.bind(this));
        this.lastWorker = 0;
      }
      const worker = workers[this.lastWorker];
      this.lastWorker = (this.lastWorker + 1) % workers.length;
      return new Promise((resolve, reject) => {
        this.pendingBitmaps.set(this.lastMessageId, [resolve, reject]);
        worker.postMessage({
          message: "decompressImageData",
          id: this.lastMessageId++,
          rawData: imgRawData,
          width,
          height
        });
      });
    }
    const img = window.fzstd.decompress(imgRawData);
    const clampedArray = new Uint8ClampedArray(img);
    const imgData = new ImageData(clampedArray, width, height);
    return createImageBitmap(imgData, { premultiplyAlpha: "none" });
  }
  static onWorkerDecompressedImageData(e) {
    const callbacks = this.pendingBitmaps.get(e.data.id);
    if (callbacks) {
      callbacks[0](e.data.bitmap);
      this.pendingBitmaps.delete(e.data.id);
    } else
      window.app.console.error("Decompressed image with unrecognised id");
  }
  static onWorkerError(e) {
    for (const callbacks of this.pendingBitmaps.values()) {
      callbacks[1](null);
    }
    this.pendingBitmaps.clear();
    this.lastWorker = -1;
  }
  static renderCachedCompressedSlide(layers) {
    const layerBitmapPromises = [];
    for (const layer of layers) {
      const { json, imgRawData } = layer;
      if ((json == null ? void 0 : json.width) && (json == null ? void 0 : json.height)) {
        console.debug("CompressedCache: fetching layers from compressed cache", layer);
        layerBitmapPromises.push(this.decompressImageData(imgRawData, json.width, json.height));
      }
    }
    Promise.all(layerBitmapPromises).then((bitmaps) => {
      let i = 0;
      for (const layer of layers) {
        const json = layer.json;
        if ((json == null ? void 0 : json.width) && (json == null ? void 0 : json.height))
          app.map.fire("slidelayer", {
            message: json,
            image: bitmaps[i++]
          });
      }
    }).then(() => {
      console.debug("CompressedCache: Complete Slide rendering");
      app.map.fire("sliderenderingcomplete", {
        success: "success",
        compressedLayers: false
      });
    }).catch((err) => {
      app.map.fire("sliderenderingcomplete", {
        success: "fail",
        compressedLayers: false
      });
      console.error("Something Went wrong while preparing layers", err);
    });
  }
  static decompressSlideLayer(json, imgBytes) {
    if (json.isCompressed) {
      this.cacheCompressedLayer(json, imgBytes);
    } else if (json.width && json.height) {
      const imgPromise = this.decompressImageData(imgBytes, json.width, json.height);
      this.pendingLayers.push(imgPromise);
      return imgPromise;
    }
    return null;
  }
  static waitForSlideDecompression(json) {
    if (json.compressedLayers && this.compressedSlideCache.get(json.slidehash) != null) {
      const layers = this.compressedSlideCache.get(json.slidehash);
      if (json.status === "success") {
        app.map.fire("compressedslide", {
          slideHash: json.slidehash,
          layers
        });
      }
      this.compressedSlideCache.delete(json.slidehash);
      return null;
    }
    const pendingLayers = this.pendingLayers;
    this.pendingLayers = [];
    return Promise.all(pendingLayers);
  }
  static cacheCompressedLayer(json, imgRawData) {
    if (!this.compressedSlideCache.has(json.slideHash)) {
      this.compressedSlideCache.set(json.slideHash, []);
    }
    this.compressedSlideCache.get(json.slideHash).push({ json, imgRawData });
  }
};
_SlideBitmapManager.pendingLayers = [];
_SlideBitmapManager.compressedSlideCache = /* @__PURE__ */ new Map();
_SlideBitmapManager.lastWorker = -1;
_SlideBitmapManager.lastMessageId = 0;
_SlideBitmapManager.pendingBitmaps = /* @__PURE__ */ new Map();
let SlideBitmapManager = _SlideBitmapManager;
