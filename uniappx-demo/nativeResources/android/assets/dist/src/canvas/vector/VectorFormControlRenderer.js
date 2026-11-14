var cool;
(function(cool2) {
  const _VectorFormControlRenderer = class _VectorFormControlRenderer {
    constructor(onPictureReady) {
      this._pictures = /* @__PURE__ */ new WeakMap();
      this._onPictureReady = onPictureReady;
    }
    render(context, primitive) {
      const matrix = cool2.Matrix2D.fromArray(primitive.matrix);
      if (!matrix)
        return;
      const picture = this._pictures.get(primitive);
      if (!picture) {
        const made = new Image();
        this._pictures.set(primitive, made);
        void this._paint(primitive, made);
        return;
      }
      if (!picture.complete || !picture.naturalWidth)
        return;
      context.save();
      matrix.applyTo(context);
      context.drawImage(picture, 0, 0, 1, 1);
      context.restore();
    }
    // a box with an arrow in it, as a drop-down, a spin, a scroll and a navigation button show it
    static _arrowBox(arrow, grow = false) {
      return h("div", { style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: grow ? "1 1 0" : "0 0 auto",
        minWidth: "1.2em",
        minHeight: "0",
        boxSizing: "border-box",
        padding: "0 2px",
        border: "1px solid var(--color-border-input-dark)",
        backgroundColor: "var(--color-background-dark)",
        color: "var(--color-text-dark)",
        fontSize: "0.8em",
        lineHeight: "1"
      } }, arrow);
    }
    // a field with its text, with a drop-down button or spin buttons at its end where it has them
    static _field(primitive, text) {
      const field = h(
        "div",
        { class: "jsdialog ui-edit", style: {
          display: "flex",
          alignItems: primitive.multiLine ? "flex-start" : "center",
          alignSelf: "stretch",
          flex: "1",
          maxHeight: "none",
          padding: "0",
          overflow: "hidden"
        } },
        h("div", { style: {
          flex: "1",
          padding: "0 4px",
          overflow: "hidden",
          whiteSpace: primitive.multiLine ? "pre-wrap" : "nowrap",
          lineHeight: "normal"
        } }, text)
      );
      const renderer = _VectorFormControlRenderer;
      if (primitive.dropdown)
        field.appendChild(renderer._arrowBox(renderer.arrowDown));
      if (primitive.spin)
        field.appendChild(h(
          "div",
          { style: {
            display: "flex",
            flexDirection: "column",
            alignSelf: "stretch"
          } },
          renderer._arrowBox(renderer.arrowUp, true),
          renderer._arrowBox(renderer.arrowDown, true)
        ));
      return field;
    }
    // the entries of a list, the selected ones in the selection's colour
    static _list(primitive) {
      const selected = new Set(primitive.selected ?? []);
      return h("div", { class: "jsdialog ui-listbox", style: {
        display: "block",
        height: "100%",
        padding: "0",
        overflow: "hidden"
      } }, (primitive.items ?? []).map((item, at) => h("div", { style: selected.has(at) ? {
        padding: "0 4px",
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-text)"
      } : { padding: "0 4px" } }, item)));
    }
    // a scroll bar: its two arrows and the thumb on the track between, where the value stands
    static _scrollBar(primitive) {
      const renderer = _VectorFormControlRenderer;
      const vertical = primitive.vertical === true;
      const min = primitive.min ?? 0;
      const max = primitive.max ?? 100;
      const range = Math.max(1, max - min);
      const visible = Math.min(range, Math.max(1, primitive.visible ?? range / 10));
      const at = Math.min(1, Math.max(0, ((primitive.value ?? min) - min) / range));
      const thumbShare = visible / (range + visible) * 100;
      const thumbStart = at * (100 - thumbShare);
      const thumb = h("div", { style: {
        position: "absolute",
        backgroundColor: "var(--color-border-input-dark)",
        borderRadius: "2px",
        ...vertical ? {
          left: "2px",
          right: "2px",
          top: thumbStart + "%",
          height: thumbShare + "%"
        } : {
          top: "2px",
          bottom: "2px",
          left: thumbStart + "%",
          width: thumbShare + "%"
        }
      } });
      return h(
        "div",
        { class: "jsdialog", style: {
          display: "flex",
          flexDirection: vertical ? "column" : "row"
        } },
        renderer._arrowBox(vertical ? renderer.arrowUp : renderer.arrowLeft),
        h("div", { style: {
          position: "relative",
          flex: "1",
          backgroundColor: "var(--color-background-dark)"
        } }, thumb),
        renderer._arrowBox(vertical ? renderer.arrowDown : renderer.arrowRight)
      );
    }
    // a navigation bar: where the record stands and the buttons that go through the records,
    // greyed as the office shows it while the form has no data source to go through
    static _navigationBar(compact = false) {
      const renderer = _VectorFormControlRenderer;
      const small = h("div", { class: "jsdialog ui-edit", style: {
        width: "3em",
        height: "80%",
        padding: "0",
        maxHeight: "none"
      } });
      return h(
        "div",
        { class: "jsdialog", style: {
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 4px",
          backgroundColor: "var(--color-background-lighter)",
          opacity: "0.5",
          ...compact ? { flex: "0 0 auto", height: "1.5em", fontSize: "0.8em" } : {}
        } },
        h("span", null, _("Record")),
        small,
        h("span", null, _("of")),
        small.cloneNode(true),
        renderer._arrowBox("|" + renderer.arrowLeft),
        renderer._arrowBox(renderer.arrowLeft),
        renderer._arrowBox(renderer.arrowRight),
        renderer._arrowBox(renderer.arrowRight + "|"),
        renderer._arrowBox(renderer.arrowRight + "*")
      );
    }
    // a table control: the labels of its columns over an empty row, a marker column in front
    static _table(primitive) {
      var _a;
      const cell = {
        border: "1px solid var(--color-border-input-dark)",
        padding: "0 4px",
        textAlign: "left",
        fontWeight: "normal",
        height: "1.2em"
      };
      const columns = ((_a = primitive.columns) == null ? void 0 : _a.length) ? primitive.columns : [""];
      return h(
        "div",
        { class: "jsdialog", style: {
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--color-background-lighter)",
          border: "1px solid var(--color-border-input-dark)"
        } },
        h(
          "table",
          { style: { borderCollapse: "collapse", width: "100%", flex: "1" } },
          h(
            "tr",
            { style: { backgroundColor: "var(--color-background-dark)" } },
            h("th", { style: { ...cell, width: "1.5em" } }),
            columns.map((label) => h("th", { style: cell }, label))
          ),
          h(
            "tr",
            { style: { height: "100%" } },
            h("td", { style: {
              ...cell,
              backgroundColor: "var(--color-background-dark)"
            } }, _VectorFormControlRenderer.arrowRight),
            columns.map(() => h("td", { style: {
              ...cell,
              backgroundColor: "var(--color-background-lighter)"
            } }))
          )
        ),
        _VectorFormControlRenderer._navigationBar(true)
      );
    }
    // the element of the control's kind, with the classes of JSDialog's widgets
    /// The HTML element of the control, with the look its model sets, at its size at a zoom of one.
    static element(primitive) {
      const renderer = _VectorFormControlRenderer;
      const control = renderer._build(primitive);
      renderer._applyModel(control, primitive);
      const size = renderer.sizeOf(primitive);
      if (size) {
        control.style.width = size.width + "px";
        control.style.height = size.height + "px";
      }
      return control;
    }
    /// The size of the control in CSS pixels at a zoom of one, from the matrix of its square.
    static sizeOf(primitive) {
      const matrix = cool2.Matrix2D.fromArray(primitive.matrix);
      if (!matrix)
        return void 0;
      const origin = matrix.apply(0, 0);
      const across = matrix.apply(1, 0);
      const down = matrix.apply(0, 1);
      const twips = _VectorFormControlRenderer.twipsPerPixel;
      return {
        width: Math.max(1, Math.round(Math.hypot(across.x - origin.x, across.y - origin.y) / twips)),
        height: Math.max(1, Math.round(Math.hypot(down.x - origin.x, down.y - origin.y) / twips))
      };
    }
    static _build(primitive) {
      const renderer = _VectorFormControlRenderer;
      const label = primitive.label ?? "";
      const text = primitive.text ?? "";
      const checked = primitive.state === 1;
      switch (primitive.kind) {
        case "checkBox":
          return h(
            "div",
            { class: "checkbutton jsdialog" },
            h("input", { type: "checkbox", checked }),
            h("label", null, label)
          );
        case "optionButton":
          return h(
            "div",
            { class: "radiobutton jsdialog" },
            h("input", { type: "radio", checked }),
            h("label", null, label)
          );
        case "label":
          return h("div", { class: "jsdialog ui-text", style: { display: "block", backgroundColor: "transparent" } }, label);
        case "groupBox":
          return h(
            "fieldset",
            { class: "jsdialog", style: {
              margin: "0",
              padding: "0 4px",
              border: "1px solid var(--color-border-input-dark)",
              borderRadius: "var(--border-radius)"
            } },
            h("legend", { style: { padding: "0 2px" } }, label)
          );
        case "textBox":
        case "formattedField":
        case "numericField":
        case "currencyField":
        case "dateField":
        case "timeField":
        case "patternField":
        case "comboBox":
          return renderer._field(primitive, text);
        case "fileSelection":
          return h(
            "div",
            { class: "jsdialog", style: { display: "flex", alignItems: "stretch", gap: "0" } },
            renderer._field(primitive, text),
            h(
              "button",
              { class: "ui-pushbutton jsdialog" },
              h("span", null, _("Browse..."))
            )
          );
        case "listBox":
          return primitive.dropdown ? renderer._field(primitive, (primitive.items ?? [])[(primitive.selected ?? [])[0]] ?? "") : renderer._list(primitive);
        case "imageButton":
        case "imageControl":
          return h("div", { class: "jsdialog", style: { border: "1px solid var(--color-border-input-dark)" } });
        case "scrollBar":
          return renderer._scrollBar(primitive);
        case "spinButton":
          return h(
            "div",
            { class: "jsdialog", style: {
              display: "flex",
              flexDirection: primitive.vertical ? "column" : "row"
            } },
            renderer._arrowBox(primitive.vertical ? renderer.arrowUp : renderer.arrowLeft, true),
            renderer._arrowBox(primitive.vertical ? renderer.arrowDown : renderer.arrowRight, true)
          );
        case "tableControl":
          return renderer._table(primitive);
        case "navigationBar":
          return renderer._navigationBar();
        default:
          return h(
            "button",
            { class: "ui-pushbutton jsdialog" },
            h("span", null, label)
          );
      }
    }
    // what the model sets itself goes over the look of the widget
    static _applyModel(element, primitive) {
      const style = element.style;
      style.boxSizing = "border-box";
      if (primitive.textColor)
        style.color = primitive.textColor;
      if (primitive.background)
        style.backgroundColor = primitive.background;
      const align = primitive.align !== void 0 ? ["left", "center", "right"][primitive.align] ?? "" : primitive.kind === "pushButton" ? "center" : "left";
      if (primitive.kind === "pushButton")
        style.textAlign = align;
      else {
        style.justifyContent = "flex-start";
        element.querySelectorAll("label").forEach((label) => {
          label.style.flex = "1";
          label.style.textAlign = align;
          label.style.padding = "0 0 0 4px";
        });
      }
      const font = primitive.font;
      style.fontFamily = ((font == null ? void 0 : font.name) ? '"' + font.name + '", ' : "") + _VectorFormControlRenderer._fallbackFont;
      if (font == null ? void 0 : font.height)
        style.fontSize = font.height + "pt";
      if (font == null ? void 0 : font.bold)
        style.fontWeight = "bold";
      if (font == null ? void 0 : font.italic)
        style.fontStyle = "italic";
      if (primitive.disabled)
        [element, ...Array.from(element.querySelectorAll("button, input"))].filter((input) => input.matches("button, input")).forEach((input) => input.setAttribute("disabled", ""));
      element.querySelectorAll("*").forEach((inner) => {
        inner.style.font = "inherit";
        if (primitive.textColor || inner.tagName === "LABEL")
          inner.style.color = "inherit";
      });
      if (primitive.border === 0) {
        style.border = "none";
        element.querySelectorAll(".ui-edit").forEach((field) => {
          field.style.border = "none";
        });
      }
    }
    async _paint(primitive, picture) {
      const size = _VectorFormControlRenderer.sizeOf(primitive);
      if (!size)
        return;
      const width = size.width;
      const height = size.height;
      const control = _VectorFormControlRenderer.element(primitive);
      const holder = h("div", { style: {
        position: "fixed",
        left: "-10000px",
        top: "0",
        fontFamily: "var(--cool-font)",
        width: width + "px",
        height: height + "px"
      } }, control);
      document.body.appendChild(holder);
      let markup;
      try {
        await this._writeLookInto(control);
        markup = new XMLSerializer().serializeToString(control);
      } finally {
        holder.remove();
      }
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%;">' + markup + "</div></foreignObject></svg>";
      picture.onload = () => {
        var _a;
        return (_a = this._onPictureReady) == null ? void 0 : _a.call(this);
      };
      picture.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }
    // writes the computed look of the element and all it holds into their style, with the
    // images it uses as data, as an SVG image takes nothing from the page
    async _writeLookInto(element) {
      const elements = [element, ...Array.from(element.querySelectorAll("*"))];
      const looks = elements.map((one) => {
        const computed = window.getComputedStyle(one);
        return _VectorFormControlRenderer.lookProperties.map((name) => [
          name,
          computed.getPropertyValue(name)
        ]);
      });
      await Promise.all(looks.flat().map(async (entry) => {
        const found = /url\("?([^")]+)"?\)/.exec(entry[1]);
        if (!found || found[1].startsWith("data:"))
          return;
        const data = await _VectorFormControlRenderer._asData(found[1]);
        if (data)
          entry[1] = entry[1].replace(found[0], 'url("' + data + '")');
      }));
      elements.forEach((one, at) => {
        const style = one.style;
        for (const [name, value] of looks[at])
          if (value)
            style.setProperty(name, value);
      });
      element.style.margin = "0";
    }
    static async _asData(url) {
      try {
        const response = await fetch(url);
        if (!response.ok)
          return void 0;
        const blob = await response.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(void 0);
          reader.readAsDataURL(blob);
        });
      } catch {
        return void 0;
      }
    }
  };
  _VectorFormControlRenderer.twipsPerPixel = 15;
  _VectorFormControlRenderer.lookProperties = [
    "display",
    "flex-direction",
    "align-items",
    "justify-content",
    "box-sizing",
    "margin",
    "padding",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-radius",
    "background-color",
    "background-image",
    "background-repeat",
    "background-position",
    "background-size",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "text-align",
    "white-space",
    "vertical-align",
    "width",
    "height",
    "opacity",
    "appearance",
    "overflow"
  ];
  _VectorFormControlRenderer._fallbackFont = "sans-serif";
  _VectorFormControlRenderer.arrowUp = "\u25B4";
  _VectorFormControlRenderer.arrowDown = "\u25BE";
  _VectorFormControlRenderer.arrowLeft = "\u25C2";
  _VectorFormControlRenderer.arrowRight = "\u25B8";
  let VectorFormControlRenderer = _VectorFormControlRenderer;
  cool2.VectorFormControlRenderer = VectorFormControlRenderer;
})(cool || (cool = {}));
