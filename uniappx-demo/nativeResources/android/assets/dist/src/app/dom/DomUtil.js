const _DomUtil = class _DomUtil {
  static get(id, doc = window.document) {
    return typeof id === "string" ? doc.getElementById(id) : id;
  }
  static getStyle(el, style, doc = window.document) {
    let value = el.style.getPropertyValue(style) || el.currentStyle && el.currentStyle[style];
    if ((!value || value === "auto") && doc.defaultView) {
      const css = doc.defaultView.getComputedStyle(el, null);
      value = css ? css.getPropertyValue(style) : null;
    }
    return value === "auto" ? null : value;
  }
  static setStyle(el, style, value) {
    if (el !== void 0)
      el.style.setProperty(style, value);
  }
  // Reading a geometry property makes the browser apply the pending style changes before it
  // answers, so a transition started after this call animates from the values set before it.
  static forceLayoutFlush(element) {
    return element.offsetHeight;
  }
  static getDurationMs(token) {
    var _a, _b;
    if (!_DomUtil.durationCache) {
      const durationCache = /* @__PURE__ */ new Map();
      (_b = (_a = window.matchMedia) == null ? void 0 : _a.call(window, "(prefers-reduced-motion: reduce)")) == null ? void 0 : _b.addEventListener("change", () => durationCache.clear());
      _DomUtil.durationCache = durationCache;
    }
    const cached = _DomUtil.durationCache.get(token);
    if (cached !== void 0)
      return cached;
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    const duration = parseFloat(value);
    if (isNaN(duration))
      return 0;
    const durationMs = value.endsWith("ms") ? duration : duration * 1e3;
    _DomUtil.durationCache.set(token, durationMs);
    return durationMs;
  }
  static create(tagName, className, container, data, doc = window.document) {
    const el = doc.createElement(tagName);
    el.className = className;
    if (container) {
      container.appendChild(el);
    }
    return el;
  }
  static createWithId(tagName, id, container, data, doc = window.document) {
    const el = doc.createElement(tagName);
    el.id = id;
    if (container) {
      container.appendChild(el);
    }
    return el;
  }
  static remove(el) {
    if (!el) {
      return;
    }
    const parent = el.parentNode;
    if (parent) {
      parent.removeChild(el);
    }
  }
  static empty(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }
  static getClass(el) {
    const baseVal = el.className.baseVal;
    return baseVal === void 0 ? el.className : baseVal;
  }
  static hasClass(el, name) {
    if (el.classList !== void 0) {
      return el.classList.contains(name);
    }
    const className = _DomUtil.getClass(el);
    return className.length > 0 && new RegExp("(^|\\s)" + name + "(\\s|$)").test(className);
  }
  static setClass(el, name) {
    if (el.className.baseVal === void 0) {
      el.className = name;
    } else {
      el.className.baseVal = name;
    }
  }
  static addClass(el, name) {
    if (!el) {
      return;
    }
    if (el.classList !== void 0) {
      const classes = app.util.splitWords(name);
      for (let i = 0, len = classes.length; i < len; i++) {
        el.classList.add(classes[i]);
      }
    } else if (!_DomUtil.hasClass(el, name)) {
      const className = _DomUtil.getClass(el);
      _DomUtil.setClass(el, (className ? className + " " : "") + name);
    }
  }
  static removeClass(el, name) {
    if (!el) {
      return;
    }
    if (el.classList !== void 0) {
      el.classList.remove(name);
    } else {
      _DomUtil.setClass(el, app.util.trim((" " + _DomUtil.getClass(el) + " ").replace(" " + name + " ", " ")));
    }
  }
  static removeChildNodes(el) {
    while (el.hasChildNodes()) {
      Util.ensureValue(el.lastChild);
      el.removeChild(el.lastChild);
    }
  }
  static setOpacity(el, value) {
    if ("opacity" in el.style) {
      el.style.opacity = String(value);
    } else if ("filter" in el.style) {
      _DomUtil._setOpacityIE(el, +value);
    }
  }
  static _setOpacityIE(el, value) {
    let filter = void 0;
    const filterName = "DXImageTransform.Microsoft.Alpha";
    try {
      filter = el.filters.item(filterName);
    } catch (e) {
      if (value === 1) {
        return;
      }
    }
    value = Math.round(value * 100);
    if (filter) {
      filter.Enabled = value !== 100;
      filter.Opacity = value;
    } else {
      el.style.filter += " progid:" + filterName + "(opacity=" + value + ")";
    }
  }
  // needed for initializing some static data members and functions.
  static testProp(props) {
    const style = document.documentElement.style;
    for (let i = 0; i < props.length; i++) {
      if (props[i] in style) {
        return props[i];
      }
    }
    return void 0;
  }
  static setTransform(el, offset, scale) {
    const pos = offset || new cool.Point(0, 0);
    Util.ensureValue(_DomUtil.TRANSFORM);
    el.style.setProperty(_DomUtil.TRANSFORM, "translate3d(" + pos.x + "px," + pos.y + "px,0)" + (scale ? " scale(" + scale + ")" : ""));
  }
  static setPosition(el, point, no3d = false) {
    el._leaflet_pos = point;
    Util.ensureValue(window.L);
    if (window.L.Browser.any3d && !no3d) {
      _DomUtil.setTransform(el, point);
    } else {
      el.style.left = point.x + "px";
      el.style.top = point.y + "px";
    }
  }
  static getPosition(el) {
    return el._leaflet_pos;
  }
  static isPortrait() {
    return window.matchMedia && window.matchMedia("(orientation: portrait)").matches;
  }
  // Add/remove a portrait or landscape class from the list of elements.
  static updateElementsOrientation(elements) {
    let remove = "portrait";
    let add = "landscape";
    if (_DomUtil.isPortrait()) {
      remove = "landscape";
      add = "portrait";
    }
    for (let i = 0; i < elements.length; ++i) {
      const element = elements[i];
      const domElement = _DomUtil.get(element);
      if (domElement) {
        _DomUtil.removeClass(domElement, remove);
        _DomUtil.addClass(domElement, add);
      } else {
        app.console.warn("updateElementsOrientation(): Cannot find element with id = " + element);
      }
    }
  }
  static getTransitionEnd() {
    const transition = _DomUtil.testProp([
      "webkitTransition",
      "transition",
      "OTransition",
      "MozTransition",
      "msTransition"
    ]);
    return transition === "webkitTransition" || transition === "OTransition" ? transition + "End" : "transitionend";
  }
  static getDisbleTextSelection() {
    if ("onselectstart" in document) {
      return () => {
        window.L.DomEvent.on(window, "selectstart", window.L.DomEvent.preventDefault);
      };
    }
    return () => {
      if (_DomUtil.userSelectProperty) {
        const style = document.documentElement.style;
        _DomUtil._userSelect = style.getPropertyValue(_DomUtil.userSelectProperty);
        style.setProperty(_DomUtil.userSelectProperty, "none");
      }
    };
  }
  static getEnableTextSelection() {
    if ("onselectstart" in document) {
      return () => {
        window.L.DomEvent.off(window, "selectstart", window.L.DomEvent.preventDefault);
      };
    }
    return () => {
      if (_DomUtil.userSelectProperty) {
        document.documentElement.style.setProperty(_DomUtil.userSelectProperty, _DomUtil._userSelect);
        this._userSelect = void 0;
      }
    };
  }
  static disableImageDrag() {
    window.L.DomEvent.on(window, "dragstart", window.L.DomEvent.preventDefault);
  }
  static enableImageDrag() {
    window.L.DomEvent.off(window, "dragstart", window.L.DomEvent.preventDefault);
  }
  static preventOutline(element) {
    _DomUtil.restoreOutline();
    _DomUtil._outlineElement = element;
    _DomUtil._outlineStyle = element.style.outline;
    element.style.outline = "none";
    window.L.DomEvent.on(window, "keydown", _DomUtil.restoreOutline);
  }
  static restoreOutline() {
    if (!_DomUtil._outlineElement) {
      return;
    }
    _DomUtil._outlineElement.style.outline = _DomUtil._outlineStyle;
    _DomUtil._outlineElement = void 0;
    _DomUtil._outlineStyle = "none";
    window.L.DomEvent.off(window, "keydown", _DomUtil.restoreOutline);
  }
};
_DomUtil.durationCache = null;
_DomUtil.TRANSFORM = _DomUtil.testProp([
  "transform",
  "WebkitTransform",
  "OTransform",
  "MozTransform",
  "msTransform"
]);
_DomUtil.TRANSFORM_ORIGIN = _DomUtil.testProp([
  "transformOrigin",
  "msTransformOrigin",
  "WebkitTransformOrigin"
]);
_DomUtil.TRANSITION_END = _DomUtil.getTransitionEnd();
_DomUtil.userSelectProperty = _DomUtil.testProp([
  "userSelect",
  "WebkitUserSelect",
  "OUserSelect",
  "MozUserSelect",
  "msUserSelect"
]);
_DomUtil._userSelect = void 0;
_DomUtil.disableTextSelection = _DomUtil.getDisbleTextSelection();
_DomUtil.enableTextSelection = _DomUtil.getEnableTextSelection();
_DomUtil._outlineStyle = "none";
let DomUtil = _DomUtil;
window.L.DomUtil = DomUtil;
