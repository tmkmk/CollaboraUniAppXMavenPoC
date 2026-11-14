const _LayerRendererGl = class _LayerRendererGl {
  constructor(offscreenCanvas) {
    this.imageBitmapIdCounter = 0;
    this.textureCache = /* @__PURE__ */ new Map();
    this.imageBitmapIdMap = /* @__PURE__ */ new WeakMap();
    this.vertexShaderSource = `
			attribute vec2 a_position;
			attribute vec2 a_texCoord;
			varying vec2 v_texCoord;
			void main() {
				gl_Position = vec4(a_position, 0, 1);
				v_texCoord = a_texCoord;
			}
		`;
    this.fragmentShaderSource = `
		precision mediump float;
		uniform vec4 fromFillColor;
		uniform vec4 toFillColor;
		uniform vec4 fromLineColor;
		uniform vec4 toLineColor;
		uniform float alpha;
		varying vec2 v_texCoord;
		uniform sampler2D u_sampler;

		${GlHelpers.nearestPointOnSegment}
		${GlHelpers.computeColor}

		void main() {
			vec4 color = texture2D(u_sampler, v_texCoord);
			color = computeColor(color);
			color = color * alpha;
			gl_FragColor = color;
		}
		`;
    this.offscreenCanvas = offscreenCanvas;
    this.glContext = new RenderContextGl(this.offscreenCanvas);
    this.gl = this.glContext.getGl();
    this.initializeWebGL();
    this.disposed = false;
  }
  initialize() {
  }
  isGlRenderer() {
    return true;
  }
  isDisposed() {
    return this.disposed;
  }
  getRenderContext() {
    return this.glContext;
  }
  initializeWebGL() {
    const gl = this.gl;
    const vertexShader = this.glContext.createVertexShader(this.vertexShaderSource);
    const fragmentShader = this.glContext.createFragmentShader(this.fragmentShaderSource);
    this.program = this.glContext.createProgram(vertexShader, fragmentShader);
    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    this.texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");
    this.samplerLocation = gl.getUniformLocation(this.program, "u_sampler");
    this.positionBuffer = gl.createBuffer();
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLocation);
    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.gl.disable(this.gl.DEPTH_TEST);
  }
  initPositionBuffer(bounds) {
    const gl = this.gl;
    let vertices = _LayerRendererGl.DefaultVertices;
    if (bounds) {
      vertices = [];
      for (let i = 0; i < bounds.length; ++i) {
        const x = 2 * bounds[i].x - 1;
        vertices.push(x);
        const y = -(2 * bounds[i].y - 1);
        vertices.push(y);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    const positions = new Float32Array(vertices);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  }
  clearCanvas() {
    if (!this.disposed) {
      const gl = this.gl;
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }
  static computeColor(properties) {
    let bounds = null;
    let alpha = 1;
    let fromFillColor = _LayerRendererGl.DefaultFromColor;
    let toFillColor = _LayerRendererGl.DefaultToColor;
    let fromLineColor = _LayerRendererGl.DefaultFromColor;
    let toLineColor = _LayerRendererGl.DefaultToColor;
    if (properties) {
      bounds = properties.bounds;
      alpha = properties.alpha;
      const colorMap = properties.colorMap;
      if (colorMap) {
        if (colorMap.fromFillColor && colorMap.toFillColor) {
          fromFillColor = colorMap.fromFillColor.toFloat32Array();
          toFillColor = colorMap.toFillColor.toFloat32Array();
        }
        if (colorMap.fromLineColor && colorMap.toLineColor) {
          fromLineColor = colorMap.fromLineColor.toFloat32Array();
          toLineColor = colorMap.toLineColor.toFloat32Array();
        }
      }
    }
    return {
      bounds,
      alpha,
      fromFillColor,
      toFillColor,
      fromLineColor,
      toLineColor
    };
  }
  drawBitmap(imageInfo, properties) {
    if (this.disposed) {
      app.console.log("LayerRenderer is disposed");
      return;
    }
    if (!imageInfo) {
      app.console.log("LayerRenderer.drawBitmap: no image");
      return;
    }
    const { bounds, alpha, fromFillColor, toFillColor, fromLineColor, toLineColor } = _LayerRendererGl.computeColor(properties);
    let texture;
    let textureKey;
    if (imageInfo instanceof ImageBitmap) {
      if (!this.imageBitmapIdMap.has(imageInfo)) {
        this.imageBitmapIdMap.set(imageInfo, this.imageBitmapIdCounter++);
      }
      textureKey = `imageBitmap_${this.imageBitmapIdMap.get(imageInfo)}`;
    } else {
      textureKey = imageInfo.checksum;
    }
    if (this.textureCache.has(textureKey)) {
      texture = this.textureCache.get(textureKey);
    } else {
      if (imageInfo instanceof ImageBitmap) {
        texture = this.glContext.loadTexture(imageInfo, false, true);
      } else {
        texture = this.glContext.loadTexture(imageInfo.data, false, true);
      }
      this.textureCache.set(textureKey, texture);
    }
    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);
    this.initPositionBuffer(bounds);
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, "alpha"), alpha);
    this.gl.uniform4fv(this.gl.getUniformLocation(this.program, "fromFillColor"), fromFillColor);
    this.gl.uniform4fv(this.gl.getUniformLocation(this.program, "toFillColor"), toFillColor);
    this.gl.uniform4fv(this.gl.getUniformLocation(this.program, "fromLineColor"), fromLineColor);
    this.gl.uniform4fv(this.gl.getUniformLocation(this.program, "toLineColor"), toLineColor);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.samplerLocation, 0);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
  dispose() {
    this.gl = null;
    this.offscreenCanvas = null;
    this.disposed = true;
  }
  hexToRgba(hex) {
    hex = hex.replace(/^#/, "");
    let bigint;
    if (hex.length === 3) {
      const r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      const g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      const b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
      return { r, g, b, a: 0 };
    } else if (hex.length === 6) {
      bigint = parseInt(hex, 16);
      const r = bigint >> 16 & 255;
      const g = bigint >> 8 & 255;
      const b = bigint & 255;
      return { r, g, b, a: 0 };
    } else if (hex.length === 8) {
      bigint = parseInt(hex, 16);
      const r = bigint >> 24 & 255;
      const g = bigint >> 16 & 255;
      const b = bigint >> 8 & 255;
      const a = bigint & 255;
      return { r, g, b, a };
    } else if (hex.length === 4) {
      const r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      const g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      const b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
      const a = parseInt(hex.charAt(3) + hex.charAt(2), 16);
      return { r, g, b, a };
    } else {
      return null;
    }
  }
  fillColor(slideInfo) {
    if (this.disposed)
      return true;
    if (slideInfo.background && slideInfo.background.fillColor) {
      const fillColor = slideInfo.background.fillColor;
      const rgba = this.hexToRgba(fillColor);
      if (rgba) {
        this.gl.clearColor(rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a / 255);
      } else {
        this.gl.clearColor(1, 1, 1, 1);
      }
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    } else {
      this.gl.clearColor(1, 1, 1, 1);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    if (!slideInfo.background)
      return true;
    return false;
  }
};
_LayerRendererGl.DefaultVertices = [-1, -1, 1, -1, -1, 1, 1, 1];
_LayerRendererGl.DefaultFromColor = new Float32Array([0, 0, 0, 0]);
_LayerRendererGl.DefaultToColor = new Float32Array([0, 0, 0, 0]);
let LayerRendererGl = _LayerRendererGl;
class LayerRenderer2d {
  constructor(offscreenCanvas) {
    this.offscreenCanvas = offscreenCanvas;
    this.context2d = new RenderContext2d(this.offscreenCanvas);
    this.offscreenContext = this.context2d.get2dOffscreen();
    if (!this.offscreenContext) {
      throw new Error("2D Canvas context not available");
    }
    this.disposed = false;
  }
  initialize() {
  }
  isGlRenderer() {
    return false;
  }
  isDisposed() {
    return this.disposed;
  }
  getRenderContext() {
    return this.context2d;
  }
  clearCanvas() {
    if (this.disposed)
      return;
    this.offscreenContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    this.offscreenContext.fillStyle = "#FFFFFF";
    this.offscreenContext.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
  }
  drawBitmap(imageInfo, properties) {
    if (this.disposed)
      return;
    if (!imageInfo) {
      app.console.log("Canvas2DRenderer.drawBitmap: no image");
      return;
    }
    if (imageInfo instanceof ImageBitmap) {
      this.offscreenContext.drawImage(imageInfo, 0, 0);
    } else if (imageInfo.type === "png" || imageInfo.data instanceof ImageBitmap) {
      this.offscreenContext.drawImage(imageInfo.data, 0, 0);
    } else {
      throw "No supported bitmap to draw found";
    }
  }
  dispose() {
    this.disposed = true;
    this.offscreenContext = null;
    this.offscreenCanvas = null;
  }
  fillColor(slideInfo) {
    if (this.disposed)
      return;
    this.offscreenContext.fillStyle = "#FFFFFF";
    this.offscreenContext.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    if (!slideInfo.background)
      return true;
    if (slideInfo.background.fillColor) {
      this.offscreenContext.fillStyle = "#" + slideInfo.background.fillColor;
      window.app.console.log("LayerDrawing.drawBackground: " + this.offscreenContext.fillStyle);
      this.offscreenContext.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
      return true;
    }
    return false;
  }
}
SlideShow.LayerRendererGl = LayerRendererGl;
SlideShow.LayerRenderer2d = LayerRenderer2d;
