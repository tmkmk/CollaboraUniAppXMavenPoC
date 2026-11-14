var cool;
(function(cool2) {
  const _VectorColorFilters = class _VectorColorFilters {
    constructor() {
      this._svg = null;
      this._filters = /* @__PURE__ */ new Map();
      this._count = 0;
    }
    /// Whether the context has filters. Safari has them only behind a flag.
    static canFilter(context) {
      return typeof context.filter === "string";
    }
    /// Filter for the modifiers, first to last. Null when no color changes.
    filterFor(modifiers) {
      const steps = [];
      for (const modifier of modifiers)
        steps.push(...cool2.VectorColorModifiers.steps(modifier));
      const key = JSON.stringify(steps);
      const known = this._filters.get(key);
      if (known !== void 0)
        return known;
      let filter = null;
      if (steps.length) {
        this._count++;
        const id = "cool-vector-color-" + this._count;
        this._container().appendChild(_VectorColorFilters._build(id, steps));
        filter = "url(#" + id + ")";
      }
      this._filters.set(key, filter);
      return filter;
    }
    /// Take the filters out of the document. The next list builds anew.
    release() {
      if (this._svg)
        this._svg.remove();
      this._svg = null;
      this._filters.clear();
    }
    _container() {
      if (!this._svg) {
        const svg = document.createElementNS(_VectorColorFilters._SVG_NAMESPACE, "svg");
        svg.setAttribute("width", "0");
        svg.setAttribute("height", "0");
        svg.setAttribute("aria-hidden", "true");
        svg.style.position = "absolute";
        document.body.appendChild(svg);
        this._svg = svg;
      }
      return this._svg;
    }
    static _element(name) {
      return document.createElementNS(_VectorColorFilters._SVG_NAMESPACE, name);
    }
    // One filter primitive per step, each fed by the one before.
    static _build(id, steps) {
      const filter = _VectorColorFilters._element("filter");
      filter.setAttribute("id", id);
      filter.setAttribute("color-interpolation-filters", "sRGB");
      for (const step of steps) {
        if (step.kind === "matrix") {
          const values = [];
          for (let row = 0; row < 3; row++) {
            const start = row * 4;
            values.push(step.rows[start], step.rows[start + 1], step.rows[start + 2], 0, step.rows[start + 3]);
          }
          values.push(0, 0, 0, 1, 0);
          const matrix = _VectorColorFilters._element("feColorMatrix");
          matrix.setAttribute("type", "matrix");
          matrix.setAttribute("values", values.join(" "));
          filter.appendChild(matrix);
          continue;
        }
        const transfer = _VectorColorFilters._element("feComponentTransfer");
        ["feFuncR", "feFuncG", "feFuncB"].forEach((name, channel) => {
          const channelFunction = _VectorColorFilters._element(name);
          if (step.kind === "linear") {
            channelFunction.setAttribute("type", "linear");
            channelFunction.setAttribute("slope", String(step.slopes[channel]));
            channelFunction.setAttribute("intercept", String(step.intercepts[channel]));
          } else if (step.kind === "power") {
            channelFunction.setAttribute("type", "gamma");
            channelFunction.setAttribute("amplitude", "1");
            channelFunction.setAttribute("exponent", String(step.exponent));
            channelFunction.setAttribute("offset", "0");
          }
          transfer.appendChild(channelFunction);
        });
        filter.appendChild(transfer);
      }
      return filter;
    }
  };
  _VectorColorFilters._SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  let VectorColorFilters = _VectorColorFilters;
  cool2.VectorColorFilters = VectorColorFilters;
})(cool || (cool = {}));
