const _GlitterTransitionImp = class _GlitterTransitionImp extends PermTextureTransition {
  constructor(transitionParameters) {
    super(transitionParameters);
  }
  initWebglFlags() {
    if (this.context.isDisposed())
      return;
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.disable(this.gl.BLEND);
  }
  initBuffers() {
    if (this.meshVertexCount)
      return;
    this.meshVertexCount = this.uploadMesh(_GlitterTransitionImp.buildMesh(), _GlitterTransitionImp.stride, [
      ["a_position", 3, 0],
      ["a_normal", 3, 3],
      ["a_texCoord", 2, 6],
      ["a_center", 3, 8]
    ]);
  }
  // The hexagons sit on a grid of columns by rows cells, two cells wide and four cells tall with
  // every second row shifted by one cell. Each one is a fan of six triangles around its center.
  static buildMesh() {
    const columns = _GlitterTransitionImp.columns;
    const rows = _GlitterTransitionImp.rows;
    const data = [];
    const cell = (x, y) => {
      return [
        Math.min(Math.max(x, 0), columns) / columns,
        Math.min(Math.max(y, 0), rows) / rows
      ];
    };
    const toModel = (point) => {
      return [2 * point[0] - 1, -2 * point[1] + 1];
    };
    for (let y = 0; y < rows + 2; y += 2) {
      for (let x = 0; x < columns + 2; x += 2) {
        const corners = y % 4 === 0 ? [
          cell(x - 1, y - 1),
          cell(x, y - 2),
          cell(x + 1, y - 1),
          cell(x + 1, y),
          cell(x, y + 1),
          cell(x - 1, y)
        ] : [
          cell(x - 2, y - 1),
          cell(x - 1, y - 2),
          cell(x, y - 1),
          cell(x, y),
          cell(x - 1, y + 1),
          cell(x - 2, y)
        ];
        const center = toModel(cell(x, y + 0.5));
        for (let i = 0; i < 6; i++) {
          const triangle = [
            toModel(corners[i]),
            toModel(corners[(i + 1) % 6]),
            center
          ];
          for (const point of triangle) {
            data.push(point[0], point[1], 0, 0, 0, 1, 0, 0);
            data.push(center[0], center[1], 0);
          }
        }
      }
    }
    return new Float32Array(data);
  }
  getVertexShader() {
    return SlideshowShaders["GlitterTransition.vert.glsl"];
  }
  getFragmentShader() {
    return SlideshowShaders["GlitterTransition.frag.glsl"];
  }
  displaySlides_(t) {
    const gl = this.gl;
    this.applyAllOperation(t);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
    gl.uniform1i(gl.getUniformLocation(this.program, "leavingSlideTexture"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
    gl.uniform1i(gl.getUniformLocation(this.program, "enteringSlideTexture"), 1);
    this.displayPermSlide_();
    gl.drawArrays(gl.TRIANGLES, 0, this.meshVertexCount);
  }
};
_GlitterTransitionImp.columns = 80;
_GlitterTransitionImp.rows = Math.floor(_GlitterTransitionImp.columns * 4 / 3);
_GlitterTransitionImp.stride = 3 + 3 + 2 + 3;
let GlitterTransitionImp = _GlitterTransitionImp;
function GlitterTransition(transitionParameters) {
  const newTransitionParameters = {
    ...transitionParameters,
    leavingPrimitives: [],
    enteringPrimitives: [],
    allOperations: []
  };
  return new GlitterTransitionImp(newTransitionParameters);
}
SlideShow.GlitterTransition = GlitterTransition;
