var cool;
(function(cool2) {
  const _Matrix2D = class _Matrix2D {
    constructor(a, b, c, d, e, f) {
      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
      this.e = e;
      this.f = f;
    }
    /// The mapping that takes the unit square onto the range: the corner 0, 0 to its minimum
    /// and the corner 1, 1 to its maximum.
    static fromRange(range) {
      return new _Matrix2D(range.width, 0, 0, range.height, range.minX, range.minY);
    }
    /// From the six values in canvas order [a, b, c, d, e, f]. Null
    /// when there are fewer than six.
    static fromArray(values) {
      if (!values || values.length < 6)
        return null;
      return new _Matrix2D(values[0], values[1], values[2], values[3], values[4], values[5]);
    }
    /// This transform followed by outer.
    then(outer) {
      return new _Matrix2D(outer.a * this.a + outer.c * this.b, outer.b * this.a + outer.d * this.b, outer.a * this.c + outer.c * this.d, outer.b * this.c + outer.d * this.d, outer.a * this.e + outer.c * this.f + outer.e, outer.b * this.e + outer.d * this.f + outer.f);
    }
    scale(x, y) {
      return this.then(new _Matrix2D(x, 0, 0, y, 0, 0));
    }
    translate(x, y) {
      return this.then(new _Matrix2D(1, 0, 0, 1, x, y));
    }
    /// Turn by the angle in radians about the given point.
    rotateAround(centerX, centerY, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return this.then(new _Matrix2D(cos, sin, -sin, cos, centerX - cos * centerX + sin * centerY, centerY - sin * centerX - cos * centerY));
    }
    /// How long the transform makes a step of one along the x axis.
    lengthOfXAxis() {
      return Math.hypot(this.a, this.b);
    }
    /// How long the transform makes a step of one along the y axis.
    lengthOfYAxis() {
      return Math.hypot(this.c, this.d);
    }
    /// The angle in radians the transform turns the x axis by, as the canvas counts angles.
    rotation() {
      return Math.atan2(this.b, this.a);
    }
    /// Whether the other one is the same transform, to within the given difference in each of
    /// the six values.
    equals(other, tolerance) {
      const theirs = other.toArray();
      return this.toArray().every((value, at) => Math.abs(value - theirs[at]) < tolerance);
    }
    /// The transform that undoes this one, or null where this one cannot be undone, which is
    /// a transform that flattens everything onto a line or a point.
    invert() {
      const determinant = this.a * this.d - this.b * this.c;
      if (!determinant)
        return null;
      return new _Matrix2D(this.d / determinant, -this.b / determinant, -this.c / determinant, this.a / determinant, (this.c * this.f - this.d * this.e) / determinant, (this.b * this.e - this.a * this.f) / determinant);
    }
    /// The point after the transform.
    apply(x, y) {
      return new cool2.Point(this.a * x + this.c * y + this.e, this.b * x + this.d * y + this.f);
    }
    /// Multiply the context's current transform by this one.
    applyTo(context) {
      context.transform(this.a, this.b, this.c, this.d, this.e, this.f);
    }
    toArray() {
      return [this.a, this.b, this.c, this.d, this.e, this.f];
    }
  };
  _Matrix2D.IDENTITY = new _Matrix2D(1, 0, 0, 1, 0, 0);
  let Matrix2D = _Matrix2D;
  cool2.Matrix2D = Matrix2D;
})(cool || (cool = {}));
