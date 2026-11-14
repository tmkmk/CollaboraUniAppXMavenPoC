const _SlideQuadsGl = class _SlideQuadsGl {
  constructor(context) {
    this.width = 0;
    this.height = 0;
    this.direction = 1;
    this.texture = null;
    this.target = null;
    this.targetsComplete = null;
    this.frameTextures = /* @__PURE__ */ new Map();
    this.refusedSources = /* @__PURE__ */ new WeakSet();
    this.context = context;
    const gl = context.getGl();
    this.quadProgram = context.createProgram(context.createVertexShader(SlideshowShaders["SlideQuad.vert.glsl"]), context.createFragmentShader(SlideshowShaders["SlideQuad.frag.glsl"]));
    this.quadArray = gl.createVertexArray();
    gl.bindVertexArray(this.quadArray);
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const unitLocation = gl.getAttribLocation(this.quadProgram, "a_unit");
    gl.enableVertexAttribArray(unitLocation);
    gl.vertexAttribPointer(unitLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }
  get frameWidth() {
    return this.width;
  }
  get frameHeight() {
    return this.height;
  }
  /// 1 while the frame goes into the canvas, -1 while it goes into a texture, which holds its
  /// top row first.
  get yDirection() {
    return this.direction;
  }
  /// Start a frame of width by height pixels, cleared to black. It goes into texture when
  /// given, resized to the frame, else into the canvas, which then has the frame's size. False
  /// when the texture cannot be drawn into.
  begin(width, height, texture) {
    if (this.context.isDisposed())
      return false;
    const gl = this.context.getGl();
    this.width = width;
    this.height = height;
    this.texture = texture ?? null;
    this.target = texture ? this._targetTexture(texture) : null;
    if (texture && !this.target)
      return false;
    this.direction = this.target ? -1 : 1;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  /// Finish the frame and draw into the canvas again. A texture that samples between mipmap
  /// levels gets them made anew from the frame.
  end() {
    const gl = this.context.getGl();
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    if (this.target)
      this._releaseTarget(this.texture, this.target);
    this.texture = null;
    this.target = null;
  }
  /// Draw texture over rectangle. transform maps the rectangle in canvas pixels, and alpha
  /// scales the colors.
  drawQuad(texture, rectangle, alpha = 1, transform = _SlideQuadsGl.identity) {
    const gl = this.context.getGl();
    gl.useProgram(this.quadProgram);
    gl.bindVertexArray(this.quadArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(this.quadProgram, "u_texture"), 0);
    gl.uniform1f(gl.getUniformLocation(this.quadProgram, "u_alpha"), alpha);
    gl.uniform4f(gl.getUniformLocation(this.quadProgram, "u_rect"), rectangle[0], rectangle[1], rectangle[2], rectangle[3]);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.quadProgram, "u_transform"), false, transform);
    gl.uniform2f(gl.getUniformLocation(this.quadProgram, "u_canvas"), this.width, this.height);
    gl.uniform1f(gl.getUniformLocation(this.quadProgram, "u_yDirection"), this.direction);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  /// The rectangle of the frame in the frame being drawn. A flipped frame covers the same
  /// rectangle from its other edge.
  frameRectangle(frame) {
    const [left, right, top, bottom] = frame.edges;
    let x = left * this.width;
    let y = top * this.height;
    let width = (right - left) * this.width;
    let height = (bottom - top) * this.height;
    if (frame.mirror & 1) {
      x += width;
      width = -width;
    }
    if (frame.mirror & 2) {
      y += height;
      height = -height;
    }
    return [x, y, width, height];
  }
  /// The texture of key with the picture of source uploaded into it, or null when the browser
  /// refuses to hand over the pictures of source.
  frameTexture(key, source) {
    if (this.refusedSources.has(source))
      return null;
    const gl = this.context.getGl();
    let texture = this.frameTextures.get(key);
    if (!texture) {
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.frameTextures.set(key, texture);
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (!RenderContextGl.uploadPicture(gl, source)) {
      this.refusedSources.add(source);
      return null;
    }
    return texture;
  }
  /// Free the frame textures.
  clearFrames() {
    if (!this.context.isDisposed()) {
      const gl = this.context.getGl();
      this.frameTextures.forEach((texture) => gl.deleteTexture(texture));
    }
    this.frameTextures.clear();
  }
  /// Free the frame textures and the program.
  dispose() {
    this.clearFrames();
    if (this.context.isDisposed())
      return;
    const gl = this.context.getGl();
    gl.deleteProgram(this.quadProgram);
    gl.deleteVertexArray(this.quadArray);
  }
  // Size the texture to the frame and make it the draw target, with a stencil buffer for
  // clips. Null when the texture cannot be drawn into.
  _targetTexture(texture) {
    if (this.targetsComplete === false)
      return null;
    const gl = this.context.getGl();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const stencil = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, this.width, this.height);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
    const target = { framebuffer, stencil };
    if (this.targetsComplete === null)
      this.targetsComplete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (!this.targetsComplete) {
      this._releaseTarget(null, target);
      return null;
    }
    return target;
  }
  _releaseTarget(texture, target) {
    const gl = this.context.getGl();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteRenderbuffer(target.stencil);
    gl.viewport(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.direction = 1;
    if (!texture)
      return;
    if (!this.context.isMipMapped(texture))
      return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
};
_SlideQuadsGl.identity = new Float32Array([
  1,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  1
]);
let SlideQuadsGl = _SlideQuadsGl;
