var AirplanePiece;
(function(AirplanePiece2) {
  AirplanePiece2[AirplanePiece2["Keel"] = 0] = "Keel";
  AirplanePiece2[AirplanePiece2["Wing"] = 1] = "Wing";
  AirplanePiece2[AirplanePiece2["Flap"] = 2] = "Flap";
})(AirplanePiece || (AirplanePiece = {}));
const _AirplaneTransitionImp = class _AirplaneTransitionImp extends SimpleTransition {
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
  getVertexShader() {
    return `#version 300 es
				precision mediump float;

				in vec3 a_position;
				in vec3 a_normal;
				in vec2 a_texCoord;

				uniform float u_aspect;
				uniform float u_eyeDistance;

				out vec2 v_texturePosition;
				out vec3 v_normal;

				void main(void) {
					// Perspective projection, where the z = 0 plane fills the viewport. The
					// x axis is in units of half slide height, so rotations keep the shape.
					float w = (u_eyeDistance - a_position.z) / u_eyeDistance;
					float depth = clamp(-a_position.z / 20.0, -1.0, 1.0);
					gl_Position = vec4(a_position.x / u_aspect, a_position.y, depth * w, w);
					v_texturePosition = a_texCoord;
					v_normal = a_normal;
				}
				`;
  }
  getFragmentShader() {
    return `#version 300 es
				precision mediump float;

				uniform sampler2D slideTexture;
				uniform bool u_lit;

				in vec2 v_texturePosition;
				in vec3 v_normal;

				out vec4 outColor;

				void main() {
					vec4 fragment = texture(slideTexture, v_texturePosition);
					if (u_lit) {
						const float ambient = 0.55;
						vec3 lightVector = normalize(vec3(-0.3, 0.5, 1.0));
						float light = ambient + (1.0 - ambient) * max(dot(lightVector, normalize(v_normal)), 0.0);
						fragment.rgb *= light;
					}
					outColor = vec4(fragment.rgb, 1.0);
				}
				`;
  }
  getAspect() {
    return this.context.canvas.width / this.context.canvas.height;
  }
  // Slide coordinates to world coordinates of the flat slide.
  toWorld(slidePos) {
    return [(2 * slidePos[0] - 1) * this.getAspect(), 1 - 2 * slidePos[1], 0];
  }
  static smoothStep(x) {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  }
  static phase(t, start, end) {
    return _AirplaneTransitionImp.smoothStep((t - start) / (end - start));
  }
  // Rotation around the line going through a and b.
  static rotateAroundLine(a, b, angle) {
    const matrix = mat4.create();
    mat4.translate(matrix, matrix, a);
    mat4.rotate(matrix, matrix, angle, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    mat4.translate(matrix, matrix, [-a[0], -a[1], -a[2]]);
    return matrix;
  }
  // The triangles of one side (-1: left, 1: right) of the slide, in slide coordinates.
  static getPieceTriangle(piece, side) {
    const apex = _AirplaneTransitionImp.apex;
    const keelBottom = [
      0.5 + side * _AirplaneTransitionImp.keelWidth,
      1
    ];
    const bottomCorner = [0.5 + side * 0.5, 1];
    const topCorner = [0.5 + side * 0.5, 0];
    switch (piece) {
      case AirplanePiece.Keel:
        return [apex, keelBottom, [0.5, 1]];
      case AirplanePiece.Wing:
        return [apex, bottomCorner, keelBottom];
      case AirplanePiece.Flap:
        return [apex, topCorner, bottomCorner];
    }
  }
  // Transformation of a piece of the slide, relative to the dart; null if it's not visible.
  getPieceMatrix(t, piece, side) {
    const apex = this.toWorld(_AirplaneTransitionImp.apex);
    const fold = _AirplaneTransitionImp.phase(t, 0.18, 0.4);
    const keelMatrix = _AirplaneTransitionImp.rotateAroundLine(apex, this.toWorld([0.5, 1]), side * OpsHelper.deg2rad(88) * fold);
    if (piece === AirplanePiece.Keel)
      return keelMatrix;
    if (piece === AirplanePiece.Wing) {
      const keelBottom = this.toWorld([
        0.5 + side * _AirplaneTransitionImp.keelWidth,
        1
      ]);
      const wingMatrix = _AirplaneTransitionImp.rotateAroundLine(apex, keelBottom, -side * OpsHelper.deg2rad(75) * fold);
      return mat4.multiply(mat4.create(), keelMatrix, wingMatrix);
    }
    const flap = _AirplaneTransitionImp.phase(t, 0, 0.26);
    if (flap >= 1)
      return null;
    const corner = this.toWorld([0.5 + side * 0.5, 1]);
    const crease = [corner[0] - apex[0], corner[1] - apex[1]];
    const length = Math.hypot(crease[0], crease[1]);
    let normal = [crease[1] / length, -crease[0] / length];
    if (normal[0] * side < 0)
      normal = [-normal[0], -normal[1]];
    const outwards = 1.5 * flap * flap;
    const matrix = mat4.create();
    mat4.translate(matrix, matrix, [
      normal[0] * outwards,
      normal[1] * outwards,
      1.5 * flap
    ]);
    return mat4.multiply(matrix, matrix, _AirplaneTransitionImp.rotateAroundLine(apex, corner, -side * OpsHelper.deg2rad(70) * flap));
  }
  static getKeyframe(t) {
    const keyframes = _AirplaneTransitionImp.keyframes;
    for (let i = 0; i + 1 < keyframes.length; ++i) {
      const from = keyframes[i];
      const to = keyframes[i + 1];
      if (t > to.time)
        continue;
      let x = (t - from.time) / (to.time - from.time);
      if (from.smooth)
        x = _AirplaneTransitionImp.smoothStep(x);
      const mix = (a, b) => a + (b - a) * x;
      return {
        time: t,
        screenX: mix(from.screenX, to.screenX),
        screenY: mix(from.screenY, to.screenY),
        depth: mix(from.depth, to.depth),
        yaw: mix(from.yaw, to.yaw),
        pitch: mix(from.pitch, to.pitch),
        roll: mix(from.roll, to.roll),
        smooth: from.smooth
      };
    }
    return keyframes[keyframes.length - 1];
  }
  // Transformation of the whole dart: puts the center of its central triangle at the position
  // of the current keyframe, with the orientation of the current keyframe.
  getDartMatrix(t) {
    const keyframe = _AirplaneTransitionImp.getKeyframe(t);
    const eyeDistance = _AirplaneTransitionImp.eyeDistance;
    const perspective = (eyeDistance - keyframe.depth) / eyeDistance;
    const matrix = mat4.create();
    mat4.translate(matrix, matrix, [
      (2 * keyframe.screenX - 1) * this.getAspect() * perspective,
      (1 - 2 * keyframe.screenY) * perspective,
      keyframe.depth
    ]);
    mat4.rotateZ(matrix, matrix, OpsHelper.deg2rad(keyframe.yaw));
    mat4.rotateX(matrix, matrix, OpsHelper.deg2rad(keyframe.pitch));
    mat4.rotateY(matrix, matrix, OpsHelper.deg2rad(keyframe.roll));
    mat4.translate(matrix, matrix, [0, 1 / 3, 0]);
    return matrix;
  }
  getDartVertices(t) {
    const vertices = [];
    const dartMatrix = this.getDartMatrix(t);
    const eye = [0, 0, _AirplaneTransitionImp.eyeDistance];
    for (const piece of [
      AirplanePiece.Keel,
      AirplanePiece.Wing,
      AirplanePiece.Flap
    ]) {
      for (const side of [-1, 1]) {
        const pieceMatrix = this.getPieceMatrix(t, piece, side);
        if (!pieceMatrix)
          continue;
        const matrix = mat4.multiply(mat4.create(), dartMatrix, pieceMatrix);
        const triangle = _AirplaneTransitionImp.getPieceTriangle(piece, side);
        const positions = triangle.map((slidePos) => {
          const position = vec3.create();
          vec3.transformMat4(position, this.toWorld(slidePos), matrix);
          return position;
        });
        const normal = vec3.create();
        vec3.cross(normal, vec3.sub(vec3.create(), positions[1], positions[0]), vec3.sub(vec3.create(), positions[2], positions[0]));
        vec3.normalize(normal, normal);
        const toEye = vec3.sub(vec3.create(), eye, positions[0]);
        if (vec3.dot(normal, toEye) < 0)
          vec3.negate(normal, normal);
        for (let i = 0; i < 3; ++i) {
          vertices.push({
            position: positions[i],
            normal,
            texCoord: triangle[i]
          });
        }
      }
    }
    return vertices;
  }
  getEnteringVertices() {
    const vertices = [];
    const corners = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [0, 1]
    ];
    for (const corner of corners) {
      vertices.push({
        position: this.toWorld(corner),
        normal: [0, 0, 1],
        texCoord: corner
      });
    }
    return vertices;
  }
  drawTriangles(vertices, textureNum) {
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[textureNum]);
    this.gl.uniform1i(this.gl.getUniformLocation(this.program, "slideTexture"), 0);
    this.setBufferData(vertices);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, vertices.length);
  }
  // Draws one frame, called from render() on each requestAnimationFrame() tick. t is 0..1
  displaySlides_(t) {
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, "u_aspect"), this.getAspect());
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, "u_eyeDistance"), _AirplaneTransitionImp.eyeDistance);
    const litLocation = this.gl.getUniformLocation(this.program, "u_lit");
    this.gl.depthMask(false);
    this.gl.uniform1i(litLocation, 0);
    this.drawTriangles(this.getEnteringVertices(), 1);
    this.gl.depthMask(true);
    this.gl.uniform1i(litLocation, 1);
    this.drawTriangles(this.getDartVertices(t), 0);
  }
};
_AirplaneTransitionImp.eyeDistance = 4;
_AirplaneTransitionImp.keelWidth = 0.14;
_AirplaneTransitionImp.apex = [0.5, 0];
_AirplaneTransitionImp.keyframes = [
  { time: 0, screenX: 0.5, screenY: 0.667, depth: 0, yaw: 0, pitch: 0, roll: 0, smooth: true },
  { time: 0.12, screenX: 0.5, screenY: 0.667, depth: 0, yaw: 0, pitch: 0, roll: 0, smooth: true },
  { time: 0.24, screenX: 0.38, screenY: 0.74, depth: 0, yaw: -30, pitch: -15, roll: 0, smooth: true },
  { time: 0.34, screenX: 0.22, screenY: 0.84, depth: 0.3, yaw: -58, pitch: -40, roll: 0, smooth: false },
  { time: 0.8, screenX: 0.22, screenY: 0.82, depth: -0.1, yaw: -60, pitch: -40, roll: 0, smooth: false },
  { time: 0.84, screenX: 0.32, screenY: 0.64, depth: -0.6, yaw: -48, pitch: -40, roll: -25, smooth: false },
  { time: 0.88, screenX: 0.45, screenY: 0.48, depth: -1.5, yaw: -35, pitch: -45, roll: -45, smooth: false },
  { time: 0.91, screenX: 0.56, screenY: 0.36, depth: -2.5, yaw: -30, pitch: -45, roll: -39, smooth: false },
  { time: 0.935, screenX: 0.84, screenY: -0.15, depth: -4, yaw: -30, pitch: -45, roll: -39, smooth: false },
  { time: 1, screenX: 0.95, screenY: -0.6, depth: -5, yaw: -30, pitch: -45, roll: -39, smooth: false }
];
let AirplaneTransitionImp = _AirplaneTransitionImp;
function AirplaneTransition(transitionParameters) {
  const newTransitionParameters = {
    ...transitionParameters,
    leavingPrimitives: [],
    enteringPrimitives: [],
    allOperations: []
  };
  return new AirplaneTransitionImp(newTransitionParameters);
}
SlideShow.AirplaneTransition = AirplaneTransition;
