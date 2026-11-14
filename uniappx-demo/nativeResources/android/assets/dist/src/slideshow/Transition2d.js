class TransitionParameters {
  constructor() {
    this.context = null;
    this.current = null;
    this.next = null;
    this.transitionFilterInfo = null;
    this.callback = null;
    this.refreshSlides = null;
  }
}
class TransitionBase extends SlideChangeGl {
  constructor(transitionParameters) {
    super(transitionParameters);
    this.transitionFilterInfo = null;
    this.transitionFilterInfo = transitionParameters.transitionFilterInfo;
    this.createProgram();
    this.prepareTransition();
  }
  startTransition() {
    this.time = null;
  }
  start() {
    this.startTransition();
  }
  endTransition() {
    this.releaseResources();
    app.console.debug("Transition completed");
  }
  releaseResources() {
    if (this.context.isDisposed())
      return;
    this.gl.bindVertexArray(null);
    if (this.vao) {
      this.gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    const attachedShaders = this.gl.getAttachedShaders(this.program);
    if (attachedShaders) {
      attachedShaders.forEach((shader) => {
        this.gl.detachShader(this.program, shader);
        this.gl.deleteShader(shader);
      });
    }
    this.gl.deleteProgram(this.program);
    this.program = null;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  renderUniformValue() {
  }
}
const _Transition2d = class _Transition2d extends TransitionBase {
  constructor(transitionParameters) {
    super(transitionParameters);
    this._uniformCache = /* @__PURE__ */ new Map();
  }
  getFragmentShader() {
    const isSlideTransition = !!this.leavingSlide;
    return `#version 300 es
				precision mediump float;

				${isSlideTransition ? "uniform sampler2D leavingSlideTexture;" : ""}
				uniform sampler2D enteringSlideTexture;
				uniform float time;
				${!isSlideTransition ? "uniform float alpha;" : ""}

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					vec4 color0 = ${isSlideTransition ? "texture(leavingSlideTexture, v_texCoord)" : "vec4(0, 0, 0, 0)"};
					vec4 color1 = texture(enteringSlideTexture, v_texCoord);
					${!isSlideTransition ? "color1 *= alpha;" : ""}
					outColor = mix(color0, color1, time);
				}
				`;
  }
  setPositionBuffer(bounds) {
    if (!bounds)
      return;
    const v = [];
    for (let i = 0; i < bounds.length; ++i) {
      const x = 2 * bounds[i].x - 1;
      v.push(x);
      const y = -(2 * bounds[i].y - 1);
      v.push(y);
    }
    const positions = new Float32Array([
      ...[v[0], v[1], 0, 0, 1],
      ...[v[2], v[3], 0, 1, 1],
      ...[v[4], v[5], 0, 0, 0],
      ...[v[6], v[7], 0, 1, 0]
    ]);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  }
  getUniformLocation(name) {
    if (!this.program)
      return null;
    if (this._uniformCache.has(name)) {
      return this._uniformCache.get(name);
    }
    const loc = this.gl.getUniformLocation(this.program, name);
    this._uniformCache.set(name, loc);
    return loc;
  }
  render(nT, properties) {
    if (this.context.isDisposed())
      return;
    const isSlideTransition = !!this.leavingSlide;
    app.console.debug(`Transition2d.render: nT: ${nT}`);
    const gl = this.gl;
    if (isSlideTransition) {
      gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (!this.program) {
      app.console.error("Transition2d.render: this.program is missing");
      return;
    }
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform1f(gl.getUniformLocation(this.program, "time"), nT);
    if (isSlideTransition) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.leavingSlide);
      gl.uniform1i(gl.getUniformLocation(this.program, "leavingSlideTexture"), 0);
    } else {
      const { bounds, alpha, fromFillColor, toFillColor, fromLineColor, toLineColor } = LayerRendererGl.computeColor(properties);
      app.console.debug(`Transition2d.render: alpha: ${alpha}`);
      this.setPositionBuffer(bounds);
      this.gl.uniform1f(this.getUniformLocation("alpha"), alpha);
      this.gl.uniform4fv(this.getUniformLocation("fromFillColor"), fromFillColor);
      this.gl.uniform4fv(this.getUniformLocation("toFillColor"), toFillColor);
      this.gl.uniform4fv(this.getUniformLocation("fromLineColor"), fromLineColor);
      this.gl.uniform4fv(this.getUniformLocation("toLineColor"), toLineColor);
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.enteringSlide);
    gl.uniform1i(gl.getUniformLocation(this.program, "enteringSlideTexture"), 1);
    this.renderUniformValue();
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (isSlideTransition) {
      app.map.fire("newslideshowframe", {
        frame: gl.canvas
      });
    }
  }
};
_Transition2d.DefaultFromColor = new Float32Array([0, 0, 0, 0]);
_Transition2d.DefaultToColor = new Float32Array([0, 0, 0, 0]);
let Transition2d = _Transition2d;
SlideShow.Transition2d = Transition2d;
