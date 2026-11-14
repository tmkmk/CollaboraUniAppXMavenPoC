!function(f) {
  typeof module != "undefined" && typeof exports == "object" ? module.exports = f() : typeof define != "undefined" && define.amd ? define(["fzstd", f]) : (typeof self != "undefined" ? self : this).fzstd = f();
}(function() {
  var _e = {};
  "use strict";
  var r = ArrayBuffer, t = Uint8Array, e = Uint16Array, n = Int16Array, a = Uint32Array, s = Int32Array, i = function(r2, e2, n2) {
    if (t.prototype.slice)
      return t.prototype.slice.call(r2, e2, n2);
    (null == e2 || e2 < 0) && (e2 = 0), (null == n2 || n2 > r2.length) && (n2 = r2.length);
    var a2 = new t(n2 - e2);
    return a2.set(r2.subarray(e2, n2)), a2;
  }, o = function(r2, e2, n2, a2) {
    if (t.prototype.fill)
      return t.prototype.fill.call(r2, e2, n2, a2);
    for ((null == n2 || n2 < 0) && (n2 = 0), (null == a2 || a2 > r2.length) && (a2 = r2.length); n2 < a2; ++n2)
      r2[n2] = e2;
    return r2;
  }, u = function(r2, e2, n2, a2) {
    if (t.prototype.copyWithin)
      return t.prototype.copyWithin.call(r2, e2, n2, a2);
    for ((null == n2 || n2 < 0) && (n2 = 0), (null == a2 || a2 > r2.length) && (a2 = r2.length); n2 < a2; )
      r2[e2++] = r2[n2++];
  };
  _e.ZstdErrorCode = { InvalidData: 0, WindowSizeTooLarge: 1, InvalidBlockType: 2, FSEAccuracyTooHigh: 3, DistanceTooFarBack: 4, UnexpectedEOF: 5 };
  var f = ["invalid zstd data", "window size too large (>2046MB)", "invalid block type", "FSE accuracy too high", "match distance too far back", "unexpected EOF"], h = function(r2, t2, e2) {
    var n2 = Error(t2 || f[r2]);
    if (n2.code = r2, Error.captureStackTrace && Error.captureStackTrace(n2, h), !e2)
      throw n2;
    return n2;
  }, l = function(r2, t2, e2) {
    for (var n2 = 0, a2 = 0; n2 < e2; ++n2)
      a2 |= r2[t2++] << (n2 << 3);
    return a2;
  }, v = function(r2, t2) {
    return (r2[t2] | r2[t2 + 1] << 8 | r2[t2 + 2] << 16 | r2[t2 + 3] << 24) >>> 0;
  }, c = function(r2, e2) {
    var n2 = r2[0] | r2[1] << 8 | r2[2] << 16;
    if (3126568 == n2 && 253 == r2[3]) {
      var a2 = r2[4], i2 = a2 >> 5 & 1, o2 = a2 >> 2 & 1, u2 = 3 & a2, f2 = a2 >> 6;
      8 & a2 && h(0);
      var c2 = 6 - i2, b2 = 3 == u2 ? 4 : u2, y2 = l(r2, c2, b2), p2 = f2 ? 1 << f2 : i2, w2 = l(r2, c2 += b2, p2) + (1 == f2 && 256), g2 = w2;
      if (!i2) {
        var d2 = 1 << 10 + (r2[5] >> 3);
        g2 = d2 + (d2 >> 3) * (7 & r2[5]);
      }
      g2 > 2145386496 && h(1);
      var m2 = new t((1 == e2 ? w2 || g2 : e2 ? 0 : g2) + 12);
      return m2[0] = 1, m2[4] = 4, m2[8] = 8, { b: c2 + p2, y: 0, l: 0, d: y2, w: e2 && 1 != e2 ? e2 : m2.subarray(12), e: g2, o: new s(m2.buffer, 0, 3), u: w2, c: o2, m: Math.min(131072, g2) };
    }
    if (25481893 == (n2 >> 4 | r2[3] << 20))
      return v(r2, 4) + 8;
    h(0);
  }, b = function(r2) {
    for (var t2 = 0; 1 << t2 <= r2; ++t2)
      ;
    return t2 - 1;
  }, y = function(a2, s2, i2) {
    var o2 = 4 + (s2 << 3), u2 = 5 + (15 & a2[s2]);
    u2 > i2 && h(3);
    for (var f2 = 1 << u2, l2 = f2, v2 = -1, c2 = -1, y2 = -1, p2 = f2, w2 = new r(512 + (f2 << 2)), g2 = new n(w2, 0, 256), d2 = new e(w2, 0, 256), m2 = new e(w2, 512, f2), z2 = 512 + (f2 << 1), E2 = new t(w2, z2, f2), k2 = new t(w2, z2 + f2); v2 < 255 && l2 > 0; ) {
      var A2 = b(l2 + 1), T2 = o2 >> 3, x2 = (1 << A2 + 1) - 1, F2 = (a2[T2] | a2[T2 + 1] << 8 | a2[T2 + 2] << 16) >> (7 & o2) & x2, S2 = (1 << A2) - 1, B2 = x2 - l2 - 1, I2 = F2 & S2;
      if (I2 < B2 ? (o2 += A2, F2 = I2) : (o2 += A2 + 1, F2 > S2 && (F2 -= B2)), g2[++v2] = --F2, -1 == F2 ? (l2 += F2, E2[--p2] = v2) : l2 -= F2, !F2)
        do {
          var U = o2 >> 3;
          c2 = (a2[U] | a2[U + 1] << 8) >> (7 & o2) & 3, o2 += 2, v2 += c2;
        } while (3 == c2);
    }
    (v2 > 255 || l2) && h(0);
    for (var D = 0, M = (f2 >> 1) + (f2 >> 3) + 3, W = f2 - 1, O = 0; O <= v2; ++O) {
      var j = g2[O];
      if (j < 1)
        d2[O] = -j;
      else
        for (y2 = 0; y2 < j; ++y2) {
          E2[D] = O;
          do {
            D = D + M & W;
          } while (D >= p2);
        }
    }
    for (D && h(0), y2 = 0; y2 < f2; ++y2) {
      var C = d2[E2[y2]]++, H = k2[y2] = u2 - b(C);
      m2[y2] = (C << H) - f2;
    }
    return [o2 + 7 >> 3, { b: u2, s: E2, n: k2, t: m2 }];
  }, p = function(r2, n2) {
    var a2 = 0, s2 = -1, i2 = new t(292), u2 = r2[n2], f2 = i2.subarray(0, 256), l2 = i2.subarray(256, 268), v2 = new e(i2.buffer, 268);
    if (u2 < 128) {
      var c2 = y(r2, n2 + 1, 6), p2 = c2[1], w2 = c2[0] << 3, g2 = r2[n2 += u2];
      g2 || h(0);
      for (var d2 = 0, m2 = 0, z2 = p2.b, E2 = z2, k2 = (++n2 << 3) - 8 + b(g2); !((k2 -= z2) < w2); ) {
        var A2 = k2 >> 3;
        if (f2[++s2] = p2.s[d2 += (r2[A2] | r2[A2 + 1] << 8) >> (7 & k2) & (1 << z2) - 1], (k2 -= E2) < w2)
          break;
        f2[++s2] = p2.s[m2 += (r2[A2 = k2 >> 3] | r2[A2 + 1] << 8) >> (7 & k2) & (1 << E2) - 1], z2 = p2.n[d2], d2 = p2.t[d2], E2 = p2.n[m2], m2 = p2.t[m2];
      }
      ++s2 > 255 && h(0);
    } else {
      for (s2 = u2 - 127; a2 < s2; a2 += 2) {
        var T2 = r2[++n2];
        f2[a2] = T2 >> 4, f2[a2 + 1] = 15 & T2;
      }
      ++n2;
    }
    var x2 = 0;
    for (a2 = 0; a2 < s2; ++a2)
      (I2 = f2[a2]) > 11 && h(0), x2 += I2 && 1 << I2 - 1;
    var F2 = b(x2) + 1, S2 = 1 << F2, B2 = S2 - x2;
    for (B2 & B2 - 1 && h(0), f2[s2++] = b(B2) + 1, a2 = 0; a2 < s2; ++a2) {
      var I2;
      ++l2[f2[a2] = (I2 = f2[a2]) && F2 + 1 - I2];
    }
    var U = new t(S2 << 1), D = U.subarray(0, S2), M = U.subarray(S2);
    for (v2[F2] = 0, a2 = F2; a2 > 0; --a2) {
      var W = v2[a2];
      o(M, a2, W, v2[a2 - 1] = W + l2[a2] * (1 << F2 - a2));
    }
    for (v2[0] != S2 && h(0), a2 = 0; a2 < s2; ++a2) {
      var O = f2[a2];
      if (O) {
        var j = v2[O];
        o(D, a2, j, v2[O] = j + (1 << F2 - O));
      }
    }
    return [n2, { n: M, b: F2, s: D }];
  }, w = y(new t([81, 16, 99, 140, 49, 198, 24, 99, 12, 33, 196, 24, 99, 102, 102, 134, 70, 146, 4]), 0, 6)[1], g = y(new t([33, 20, 196, 24, 99, 140, 33, 132, 16, 66, 8, 33, 132, 16, 66, 8, 33, 68, 68, 68, 68, 68, 68, 68, 68, 36, 9]), 0, 6)[1], d = y(new t([32, 132, 16, 66, 102, 70, 68, 68, 68, 68, 36, 73, 2]), 0, 5)[1], m = function(r2, t2) {
    for (var e2 = r2.length, n2 = new s(e2), a2 = 0; a2 < e2; ++a2)
      n2[a2] = t2, t2 += 1 << r2[a2];
    return n2;
  }, z = new t(new s([0, 0, 0, 0, 16843009, 50528770, 134678020, 202050057, 269422093]).buffer, 0, 36), E = m(z, 0), k = new t(new s([0, 0, 0, 0, 0, 0, 0, 0, 16843009, 50528770, 117769220, 185207048, 252579084, 16]).buffer, 0, 53), A = m(k, 3), T = function(r2, t2, e2) {
    var n2 = r2.length, a2 = t2.length, s2 = r2[n2 - 1], i2 = (1 << e2.b) - 1, o2 = -e2.b;
    s2 || h(0);
    for (var u2 = 0, f2 = e2.b, l2 = (n2 << 3) - 8 + b(s2) - f2, v2 = -1; l2 > o2 && v2 < a2; ) {
      var c2 = l2 >> 3;
      t2[++v2] = e2.s[u2 = (u2 << f2 | (r2[c2] | r2[c2 + 1] << 8 | r2[c2 + 2] << 16) >> (7 & l2)) & i2], l2 -= f2 = e2.n[u2];
    }
    l2 == o2 && v2 + 1 == a2 || h(0);
  }, x = function(r2, t2, e2) {
    var n2 = 6, a2 = t2.length + 3 >> 2, s2 = a2 << 1, i2 = a2 + s2;
    T(r2.subarray(n2, n2 += r2[0] | r2[1] << 8), t2.subarray(0, a2), e2), T(r2.subarray(n2, n2 += r2[2] | r2[3] << 8), t2.subarray(a2, s2), e2), T(r2.subarray(n2, n2 += r2[4] | r2[5] << 8), t2.subarray(s2, i2), e2), T(r2.subarray(n2), t2.subarray(i2), e2);
  }, F = function(r2, n2, a2) {
    var s2, u2 = n2.b, f2 = r2[u2], l2 = f2 >> 1 & 3;
    n2.l = 1 & f2;
    var v2 = f2 >> 3 | r2[u2 + 1] << 5 | r2[u2 + 2] << 13, c2 = (u2 += 3) + v2;
    if (1 == l2) {
      if (u2 >= r2.length)
        return;
      return n2.b = u2 + 1, a2 ? (o(a2, r2[u2], n2.y, n2.y += v2), a2) : o(new t(v2), r2[u2]);
    }
    if (!(c2 > r2.length)) {
      if (0 == l2)
        return n2.b = c2, a2 ? (a2.set(r2.subarray(u2, c2), n2.y), n2.y += v2, a2) : i(r2, u2, c2);
      if (2 == l2) {
        var m2 = r2[u2], F2 = 3 & m2, S2 = m2 >> 2 & 3, B2 = m2 >> 4, I2 = 0, U = 0;
        F2 < 2 ? 1 & S2 ? B2 |= r2[++u2] << 4 | (2 & S2 && r2[++u2] << 12) : B2 = m2 >> 3 : (U = S2, S2 < 2 ? (B2 |= (63 & r2[++u2]) << 4, I2 = r2[u2] >> 6 | r2[++u2] << 2) : 2 == S2 ? (B2 |= r2[++u2] << 4 | (3 & r2[++u2]) << 12, I2 = r2[u2] >> 2 | r2[++u2] << 6) : (B2 |= r2[++u2] << 4 | (63 & r2[++u2]) << 12, I2 = r2[u2] >> 6 | r2[++u2] << 2 | r2[++u2] << 10)), ++u2;
        var D = a2 ? a2.subarray(n2.y, n2.y + n2.m) : new t(n2.m), M = D.length - B2;
        if (0 == F2)
          D.set(r2.subarray(u2, u2 += B2), M);
        else if (1 == F2)
          o(D, r2[u2++], M);
        else {
          var W = n2.h;
          if (2 == F2) {
            var O = p(r2, u2);
            I2 += u2 - (u2 = O[0]), n2.h = W = O[1];
          } else
            W || h(0);
          (U ? x : T)(r2.subarray(u2, u2 += I2), D.subarray(M), W);
        }
        var j = r2[u2++];
        if (j) {
          255 == j ? j = 32512 + (r2[u2++] | r2[u2++] << 8) : j > 127 && (j = j - 128 << 8 | r2[u2++]);
          var C = r2[u2++];
          3 & C && h(0);
          for (var H = [g, d, w], L = 2; L > -1; --L) {
            var Z = C >> 2 + (L << 1) & 3;
            if (1 == Z) {
              var q = new t([0, 0, r2[u2++]]);
              H[L] = { s: q.subarray(2, 3), n: q.subarray(0, 1), t: new e(q.buffer, 0, 1), b: 0 };
            } else
              2 == Z ? (u2 = (s2 = y(r2, u2, 9 - (1 & L)))[0], H[L] = s2[1]) : 3 == Z && (n2.t || h(0), H[L] = n2.t[L]);
          }
          var G = n2.t = H, J = G[0], K = G[1], N = G[2], P = r2[c2 - 1];
          P || h(0);
          var Q = (c2 << 3) - 8 + b(P) - N.b, R = Q >> 3, V = 0, X = (r2[R] | r2[R + 1] << 8) >> (7 & Q) & (1 << N.b) - 1, Y = (r2[R = (Q -= K.b) >> 3] | r2[R + 1] << 8) >> (7 & Q) & (1 << K.b) - 1, $ = (r2[R = (Q -= J.b) >> 3] | r2[R + 1] << 8) >> (7 & Q) & (1 << J.b) - 1;
          for (++j; --j; ) {
            var _ = N.s[X], rr = N.n[X], tr = J.s[$], er = J.n[$], nr = K.s[Y], ar = K.n[Y], sr = 1 << nr, ir = sr + ((r2[R = (Q -= nr) >> 3] | r2[R + 1] << 8 | r2[R + 2] << 16 | r2[R + 3] << 24) >>> (7 & Q) & sr - 1);
            R = (Q -= k[tr]) >> 3;
            var or = A[tr] + ((r2[R] | r2[R + 1] << 8 | r2[R + 2] << 16) >> (7 & Q) & (1 << k[tr]) - 1);
            R = (Q -= z[_]) >> 3;
            var ur = E[_] + ((r2[R] | r2[R + 1] << 8 | r2[R + 2] << 16) >> (7 & Q) & (1 << z[_]) - 1);
            if (R = (Q -= rr) >> 3, X = N.t[X] + ((r2[R] | r2[R + 1] << 8) >> (7 & Q) & (1 << rr) - 1), R = (Q -= er) >> 3, $ = J.t[$] + ((r2[R] | r2[R + 1] << 8) >> (7 & Q) & (1 << er) - 1), R = (Q -= ar) >> 3, Y = K.t[Y] + ((r2[R] | r2[R + 1] << 8) >> (7 & Q) & (1 << ar) - 1), ir > 3)
              n2.o[2] = n2.o[1], n2.o[1] = n2.o[0], n2.o[0] = ir -= 3;
            else {
              var fr = ir - (0 != ur);
              fr ? (ir = 3 == fr ? n2.o[0] - 1 : n2.o[fr], fr > 1 && (n2.o[2] = n2.o[1]), n2.o[1] = n2.o[0], n2.o[0] = ir) : ir = n2.o[0];
            }
            for (L = 0; L < ur; ++L)
              D[V + L] = D[M + L];
            M += ur;
            var hr = (V += ur) - ir;
            if (hr < 0) {
              var lr = -hr, vr = n2.e + hr;
              for (lr > or && (lr = or), L = 0; L < lr; ++L)
                D[V + L] = n2.w[vr + L];
              V += lr, or -= lr, hr = 0;
            }
            for (L = 0; L < or; ++L)
              D[V + L] = D[hr + L];
            V += or;
          }
          if (V != M)
            for (; M < D.length; )
              D[V++] = D[M++];
          else
            V = D.length;
          a2 ? n2.y += V : D = i(D, 0, V);
        } else if (a2) {
          if (n2.y += B2, M)
            for (L = 0; L < B2; ++L)
              D[L] = D[M + L];
        } else
          M && (D = i(D, M));
        return n2.b = c2, D;
      }
      h(2);
    }
  }, S = function(r2, e2) {
    if (1 == r2.length)
      return r2[0];
    for (var n2 = new t(e2), a2 = 0, s2 = 0; a2 < r2.length; ++a2) {
      var i2 = r2[a2];
      n2.set(i2, s2), s2 += i2.length;
    }
    return n2;
  };
  function B(r2, t2) {
    for (var e2 = 0, n2 = [], a2 = +!t2, s2 = 0; r2.length; ) {
      var i2 = c(r2, a2 || t2);
      if ("object" == typeof i2) {
        for (a2 ? (t2 = null, i2.w.length == i2.u && (n2.push(t2 = i2.w), s2 += i2.u)) : (n2.push(t2), i2.e = 0); !i2.l; ) {
          var o2 = F(r2, i2, t2);
          o2 || h(5), t2 ? i2.e = i2.y : (n2.push(o2), s2 += o2.length, u(i2.w, 0, o2.length), i2.w.set(o2, i2.w.length - o2.length));
        }
        e2 = i2.b + 4 * i2.c;
      } else
        e2 = i2;
      r2 = r2.subarray(e2);
    }
    return S(n2, s2);
  }
  _e.decompress = B;
  var I = function() {
    function r2(r3) {
      this.ondata = r3, this.c = [], this.l = 0, this.z = 0;
    }
    return r2.prototype.push = function(r3, t2) {
      if ("number" == typeof this.s) {
        var e2 = Math.min(r3.length, this.s);
        r3 = r3.subarray(e2), this.s -= e2;
      }
      var n2 = r3.length + this.l;
      if (!this.s) {
        if (t2) {
          if (!n2)
            return;
          n2 < 5 && h(5);
        } else if (n2 < 18)
          return this.c.push(r3), void (this.l = n2);
        if (this.l && (this.c.push(r3), r3 = S(this.c, n2), this.c = [], this.l = 0), "number" == typeof (this.s = c(r3)))
          return this.push(r3, t2);
      }
      if ("number" != typeof this.s) {
        if (n2 < (this.z || 4))
          return t2 && h(5), this.c.push(r3), void (this.l = n2);
        if (this.l && (this.c.push(r3), r3 = S(this.c, n2), this.c = [], this.l = 0), !this.z && n2 < (this.z = 2 & r3[this.s.b] ? 5 : 4 + (r3[this.s.b] >> 3 | r3[this.s.b + 1] << 5 | r3[this.s.b + 2] << 13)))
          return t2 && h(5), this.c.push(r3), void (this.l = n2);
        for (this.z = 0; ; ) {
          var a2 = F(r3, this.s);
          if (!a2) {
            t2 && h(5);
            var s2 = r3.subarray(this.s.b);
            return this.s.b = 0, this.c.push(s2), void (this.l += s2.length);
          }
          if (this.ondata(a2, false), u(this.s.w, 0, a2.length), this.s.w.set(a2, this.s.w.length - a2.length), this.s.l) {
            var i2 = r3.subarray(this.s.b);
            return this.s = 4 * this.s.c, void this.push(i2, t2);
          }
        }
      }
    }, r2;
  }();
  _e.Decompress = I;
  return _e;
});
var cool;
(function(cool2) {
  class RawDelta {
    constructor(delta, id, isKeyframe) {
      this._delta = delta;
      this._id = id;
      this._isKeyframe = isKeyframe;
    }
    get length() {
      return this.delta.length;
    }
    get delta() {
      return this._delta;
    }
    get id() {
      return this._id;
    }
    get isKeyframe() {
      return this._isKeyframe;
    }
  }
  cool2.RawDelta = RawDelta;
  const _CanvasTileUtils = class _CanvasTileUtils {
    static getUnpremultiplyTable() {
      if (this.unpremultiplyTable)
        return this.unpremultiplyTable;
      const table = new Uint8Array(256 * 256);
      for (let a = 1; a < 256; ++a) {
        const base = a << 8;
        for (let v = 0; v < 256; ++v)
          table[base + v] = Math.min(255, Math.ceil(v * 255 / a));
      }
      this.unpremultiplyTable = table;
      return table;
    }
    // Convert premultiplied-alpha RGBA to straight alpha, in place.
    // byteOffset/byteLength delimit the region to touch.
    static unpremultiply(data, byteLength, byteOffset = 0) {
      const table = this.getUnpremultiplyTable();
      for (let i = byteOffset; i < byteOffset + byteLength; i += 4) {
        const alpha = data[i + 3];
        if (alpha === 255)
          continue;
        const base = alpha << 8;
        data[i] = table[base + data[i]];
        data[i + 1] = table[base + data[i + 1]];
        data[i + 2] = table[base + data[i + 2]];
      }
    }
    // output.byteOffset + outputOffset must be a multiple of 4, and output must
    // hold width * height * 4 bytes from outputOffset. Decoding stops at the
    // first row that does not fit in data, and leaves the rows below as they were.
    static unrle(data, width, height, output, outputOffset = 0) {
      const output32 = new Uint32Array(output.buffer, output.byteOffset + outputOffset, width * height);
      const input = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const littleEndian = this.littleEndian;
      let offset = 0;
      const rleMaskSizeBytes = 256 / 8;
      for (let y = 0; y < height; ++y) {
        if (offset + 2 + rleMaskSizeBytes > data.length)
          return data.length;
        const rleSize = data[offset] + data[offset + 1] * 256;
        if (offset + 2 + rleMaskSizeBytes + rleSize * 4 > data.length)
          return data.length;
        offset += 2;
        const rleMask = offset;
        offset += rleMaskSizeBytes;
        if (rleSize > 0)
          this.unpremultiply(data, rleSize * 4, offset);
        let lastPixel = 0;
        let lastMask = 0;
        let bitToCheck = 256;
        let rleMaskOffset = rleMask;
        let pixOffset = y * width;
        let pixSrc = offset;
        for (let x = 0; x < width; ++x) {
          if (bitToCheck > 128) {
            bitToCheck = 1;
            lastMask = data[rleMaskOffset++];
          }
          if (!(lastMask & bitToCheck)) {
            lastPixel = input.getUint32(pixSrc, littleEndian);
            pixSrc += 4;
          }
          bitToCheck = bitToCheck << 1;
          output32[pixOffset++] = lastPixel;
        }
        offset += rleSize * 4;
      }
      return offset;
    }
    static updateImageFromDeltas(imageData, deltas, keyframeDeltaSize, tileSize, debug = false) {
      let nDelta = 0;
      let offset = keyframeDeltaSize;
      while (offset < deltas.length) {
        if (debug)
          console.debug("Next delta at " + offset + " length " + (deltas.length - offset));
        const delta = !offset ? deltas : deltas.subarray(offset);
        const susDeltaSize = tileSize * tileSize * 4;
        if (debug && delta.length >= susDeltaSize) {
          console.warn("Unusual delta possibly mis-tagged, suspicious size vs. type " + delta.length + " vs. " + susDeltaSize);
        }
        const oldData = this.hasRowCopy(delta) ? this.snapshot(imageData) : imageData;
        if (debug)
          console.debug("Applying delta chunk " + nDelta++ + " of total size " + delta.length + " at stream offset " + offset);
        const len = this.applyDeltaChunk(imageData, delta, oldData, tileSize, tileSize, debug);
        if (debug)
          console.debug("Applied delta chunk of size " + len);
        offset += len;
      }
    }
    // Whether the chunk, which ends at 't', has a row copy ('c'). Spans ('d')
    // are skipped by their length.
    static hasRowCopy(delta) {
      for (let i = 0; i < delta.length; ) {
        if (delta[i] === 99)
          return true;
        if (delta[i] !== 100)
          return false;
        i += 4 + delta[i + 3] * 4;
      }
      return false;
    }
    static snapshot(image) {
      if (!this.previousImage || this.previousImage.length !== image.length)
        this.previousImage = new Uint8Array(image.length);
      this.previousImage.set(image);
      return this.previousImage;
    }
    static applyDeltaChunk(imgData, delta, oldData, width, height, debug = false) {
      const pixSize = width * height * 4;
      let offset = 0;
      if (0) {
        for (let i2 = 0; i2 < pixSize; ++i2)
          oldData[i2 * 4 + 1] = 128;
      }
      if (0) {
        for (let i2 = 0; i2 < pixSize * 4; ++i2)
          imgData[i2] = 128;
      }
      let i = 0;
      for (let stop = false; i < delta.length && !stop; ) {
        switch (delta[i]) {
          case 99: {
            const count = delta[i + 1];
            const srcRow = delta[i + 2];
            const destRow = delta[i + 3];
            if (debug)
              console.debug("[" + i + "]: copy " + count + " row(s) " + srcRow + " to " + destRow);
            i += 4;
            const rowBytes = width * 4;
            const rows = Math.min(count, height - destRow);
            if (rows > 0)
              imgData.set(oldData.subarray(srcRow * rowBytes, (srcRow + rows) * rowBytes), destRow * rowBytes);
            break;
          }
          case 100: {
            const destRow = delta[i + 1];
            const destCol = delta[i + 2];
            let span = delta[i + 3];
            offset = destRow * width * 4 + destCol * 4;
            if (debug)
              console.debug("[" + i + "]: apply new span of size " + span + " at pos " + destCol + ", " + destRow + " into delta at byte: " + offset);
            i += 4;
            span *= 4;
            this.unpremultiply(delta, span, i);
            if (span <= this.smallSpanBytes || offset + span > imgData.length)
              for (let j = 0; j < span; ++j)
                imgData[offset++] = delta[i + j];
            else
              imgData.set(delta.subarray(i, i + span), offset);
            i += span;
            break;
          }
          case 116: {
            stop = true;
            i++;
            break;
          }
          default: {
            console.error("[" + i + "]: ERROR: Unknown delta code " + delta[i]);
            i = delta.length;
            break;
          }
        }
      }
      return i;
    }
  };
  _CanvasTileUtils.littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  _CanvasTileUtils.previousImage = null;
  _CanvasTileUtils.smallSpanBytes = 32;
  _CanvasTileUtils.unpremultiplyTable = null;
  let CanvasTileUtils = _CanvasTileUtils;
  cool2.CanvasTileUtils = CanvasTileUtils;
})(cool || (cool = {}));
if ("undefined" === typeof window) {
  let syncImageCache2 = function(cachedTiles) {
    for (const key of Array.from(tileImageCache.keys())) {
      if (!cachedTiles.has(key))
        tileImageCache.delete(key);
    }
  }, onMessage2 = function(e) {
    switch (e.data.message) {
      case "trimImageCache":
        syncImageCache2(e.data.cachedTiles);
        break;
      case "endTransaction": {
        syncImageCache2(e.data.cachedTiles);
        const bitmaps = [];
        const tilesWithBitmaps = [];
        const tileByteSize = e.data.tileSize * e.data.tileSize * 4;
        for (const tile of e.data.deltas) {
          const deltas = self.fzstd.decompress(tile.rawDelta);
          let keyframeDeltaSize = 0;
          let imageData = null;
          if (tile.isKeyframe) {
            imageData = new Uint8Array(tileByteSize);
            keyframeDeltaSize = cool.CanvasTileUtils.unrle(
              deltas,
              e.data.tileSize,
              e.data.tileSize,
              imageData
            );
          } else
            imageData = tileImageCache.get(tile.key);
          delete tile.rawDelta;
          if (imageData === null) {
            console.warn("Delta update received on tile with no cached image");
            continue;
          }
          cool.CanvasTileUtils.updateImageFromDeltas(
            imageData,
            deltas,
            keyframeDeltaSize,
            e.data.tileSize
          );
          tileImageCache.set(tile.key, imageData);
          const clampedData = new Uint8ClampedArray(
            imageData.buffer,
            imageData.byteOffset,
            imageData.byteLength
          );
          const image = new ImageData(
            clampedData,
            e.data.tileSize,
            e.data.tileSize
          );
          bitmaps.push(
            createImageBitmap(image, {
              premultiplyAlpha: "none"
            })
          );
          tilesWithBitmaps.push(tile);
        }
        Promise.all(bitmaps).then((bitmaps2) => {
          for (const bitmap of bitmaps2) {
            const tile = tilesWithBitmaps.shift();
            tile.bitmap = bitmap;
          }
          postMessage(
            {
              message: e.data.message,
              deltas: e.data.deltas,
              tileSize: e.data.tileSize
            },
            bitmaps2
          );
        });
        break;
      }
      case "decompressImageData": {
        const img = new Uint8ClampedArray(
          self.fzstd.decompress(e.data.rawData)
        );
        createImageBitmap(new ImageData(img, e.data.width, e.data.height), {
          premultiplyAlpha: "none"
        }).then((bitmap) => {
          postMessage(
            {
              message: "decompressedImageData",
              id: e.data.id,
              bitmap
            },
            [bitmap]
          );
        });
        break;
      }
      default:
        console.error("Unrecognised worker message");
    }
  };
  var syncImageCache = syncImageCache2, onMessage = onMessage2;
  self.L = {};
  let tileImageCache = /* @__PURE__ */ new Map();
  addEventListener("message", onMessage2);
  console.info("TaskWorker initialised");
}
