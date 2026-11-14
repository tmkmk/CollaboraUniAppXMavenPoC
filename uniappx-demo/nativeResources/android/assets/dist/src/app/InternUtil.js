const _InternPointUtil = class _InternPointUtil {
  static scale(zoom) {
    return zoom ? Math.pow(_InternPointUtil.SCALE, zoom) : 1;
  }
  static flexConstruct(x, y) {
    if (x === void 0 || x === null) {
      return void 0;
    }
    if (x instanceof cool.SimplePoint) {
      return x;
    }
    const pt = new cool.SimplePoint(0, 0);
    let done = false;
    if (Array.isArray(x) && x.length === 2 && typeof x[0] === "number" && typeof x[1] === "number") {
      pt.x = x[0];
      pt.y = x[1];
      done = true;
    }
    if (typeof x === "object" && "x" in x && "y" in x) {
      pt.x = x.x;
      pt.y = x.y;
      done = true;
    }
    if (typeof x === "number" && typeof y === "number") {
      pt.x = x;
      pt.y = y;
      done = true;
    }
    if (!done) {
      return void 0;
    }
    return pt;
  }
  // Needed in DocumentBase.unproject()
  // constructs Twips point from css pixel point at a given zoom.
  static pointToIntern(point, zoom) {
    const multFactor = 15 * app.dpiScale / _InternPointUtil.scale(zoom - _InternPointUtil.BASE_ZOOM);
    return new cool.SimplePoint(point.x * multFactor, point.y * multFactor);
  }
  // Needed in DocumentBase.project()
  // constructs css pixel point from Intern at a given zoom.
  static internToPoint(intern, zoom) {
    const multFactor = _InternPointUtil.scale(zoom - _InternPointUtil.BASE_ZOOM) / (15 * app.dpiScale);
    return new cool.Point(intern.x * multFactor, intern.y * multFactor);
  }
  // used in DocumentBase.rescale(), only makes sense for pixel points.
  // (cool.Point, number, number) -> cool.Point
  static rescale(point, oldZoom, newZoom) {
    const scale = _InternPointUtil.scale(newZoom - oldZoom);
    return cool.Point.toPoint(point.x * scale, point.y * scale);
  }
};
_InternPointUtil.SCALE = 1.2;
_InternPointUtil.BASE_ZOOM = 10;
let InternPointUtil = _InternPointUtil;
class InternBoundsUtil {
  // Assumes everything is already in internal units(twips for now).
  static flexConstruct(a, b) {
    if (!a) {
      return void 0;
    }
    if (a instanceof cool.SimpleRectangle) {
      return a;
    }
    const rect = new cool.SimpleRectangle(0, 0, 0, 0);
    let done1 = false;
    let done2 = false;
    if (a instanceof cool.SimplePoint) {
      rect.x1 = a.x;
      rect.y1 = a.y;
      done1 = true;
    } else if (Array.isArray(a) && a.length >= 2 && typeof a[0] === "number" && typeof a[1] === "number") {
      rect.x1 = a[0];
      rect.y1 = a[1];
      done1 = true;
    } else if (Array.isArray(a) && a.length >= 2 && a[0] instanceof cool.SimplePoint && a[1] instanceof cool.SimplePoint) {
      rect.x1 = a[0].x;
      rect.y1 = a[0].y;
      rect.x2 = a[1].x;
      rect.y2 = a[1].y;
      done1 = true;
      done2 = true;
    } else if (Array.isArray(a) && a.length >= 2 && Array.isArray(a[0]) && Array.isArray(a[1])) {
      rect.x1 = a[0][0];
      rect.y1 = a[0][1];
      rect.x2 = a[1][0];
      rect.y2 = a[1][1];
      done1 = true;
      done2 = true;
    }
    if (!done1) {
      return void 0;
    }
    if (done2) {
      return rect;
    }
    if (b instanceof cool.SimplePoint) {
      rect.x2 = b.x;
      rect.y2 = b.y;
      done2 = true;
    } else if (Array.isArray(b) && typeof b[0] === "number" && typeof b[1] === "number") {
      rect.x2 = b[0];
      rect.y2 = b[1];
      done2 = true;
    } else if (typeof b === "undefined") {
      rect.x2 = rect.x1;
      rect.y2 = rect.y1;
      done2 = true;
    }
    if (!done2) {
      return void 0;
    }
    return rect;
  }
  static getTopLeft(bounds) {
    return new cool.SimplePoint(bounds.x1, bounds.y1);
  }
  static getBottomRight(bounds) {
    return new cool.SimplePoint(bounds.x2, bounds.y2);
  }
}
