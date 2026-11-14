var cool;
(function(cool2) {
  const _VectorFormControlLayer = class _VectorFormControlLayer {
    /// Places the elements of the form controls of the page, or takes them all away where
    /// data is absent. originX and originY are where the page's origin lies on the canvas
    /// and scale the canvas pixels to a twip.
    static update(data, originX, originY, scale) {
      const layer = _VectorFormControlLayer;
      const shown = /* @__PURE__ */ new Set();
      layer.shownPart = data ? String(data.partId) : "";
      if (data && !app.map.isFormControlDesignMode()) {
        for (const id of data.order) {
          const object = data.objects.get(id);
          if ((object == null ? void 0 : object.objectKind) !== layer.formControlKind)
            continue;
          if (object.layer !== void 0 && !RenderManager.isLayerVisible(object.layer))
            continue;
          const primitive = layer._primitiveIn(object.primitives ?? []);
          if (!primitive)
            continue;
          shown.add(id);
          layer._place(id, primitive, originX, originY, scale);
        }
      }
      for (const [id, entry] of layer._elements)
        if (!shown.has(id)) {
          entry.element.remove();
          layer._elements.delete(id);
        }
    }
    // the form control among the primitives of an object, at any depth
    static _primitiveIn(primitives) {
      for (const primitive of primitives) {
        if (primitive.type === cool2.FormControlPrimitive.type)
          return primitive;
        const children = primitive.children;
        const found = children ? _VectorFormControlLayer._primitiveIn(children) : void 0;
        if (found)
          return found;
      }
      return void 0;
    }
    static _place(id, primitive, originX, originY, scale) {
      const layer = _VectorFormControlLayer;
      const matrix = cool2.Matrix2D.fromArray(primitive.matrix);
      if (!matrix)
        return;
      const built = JSON.stringify(primitive);
      let entry = layer._elements.get(id);
      if (!entry || entry.built !== built) {
        entry == null ? void 0 : entry.element.remove();
        entry = { built, element: layer._make(id, primitive) };
        layer._elements.set(id, entry);
        layer._holderElement().appendChild(entry.element);
      }
      const origin = matrix.apply(0, 0);
      const style = entry.element.style;
      style.left = (originX + origin.x * scale) / app.dpiScale + "px";
      style.top = (originY + origin.y * scale) / app.dpiScale + "px";
      style.transform = "scale(" + scale * layer.twipsPerPixel / app.dpiScale + ")";
    }
    // the element over the canvas that holds the controls; it lets the pointer through
    // where no control is
    static _holderElement() {
      var _a;
      const layer = _VectorFormControlLayer;
      if (!layer._holder || !layer._holder.isConnected) {
        layer._holder = h("div", { class: "vector-form-controls", style: {
          position: "absolute",
          left: "0",
          top: "0",
          right: "0",
          bottom: "0",
          overflow: "hidden",
          pointerEvents: "none"
        } });
        (_a = document.getElementById("canvas-container")) == null ? void 0 : _a.appendChild(layer._holder);
        const holder = layer._holder;
        window.addEventListener("pointerdown", (event) => {
          if (!holder.contains(event.target))
            holder.classList.add("passing");
        }, true);
        window.addEventListener("pointerup", () => holder.classList.remove("passing"), true);
      }
      return layer._holder;
    }
    static _make(id, primitive) {
      var _a, _b, _c;
      const layer = _VectorFormControlLayer;
      const control = cool2.VectorFormControlRenderer.element(primitive);
      control.style.margin = "0";
      const element = h("div", { class: "vector-form-control", style: {
        position: "absolute",
        transformOrigin: "0 0",
        pointerEvents: "auto",
        fontFamily: "var(--cool-font)"
      } }, control);
      switch (primitive.kind) {
        case "pushButton":
        case "imageButton":
          element.addEventListener("click", () => layer._send(id, "press", ""));
          break;
        case "checkBox":
          (_a = element.querySelector("input")) == null ? void 0 : _a.addEventListener("change", (event) => layer._send(id, "state", event.target.checked ? "1" : "0"));
          break;
        case "optionButton":
          (_b = element.querySelector("input")) == null ? void 0 : _b.addEventListener("change", () => layer._send(id, "check", ""));
          break;
        case "textBox":
        case "formattedField":
        case "numericField":
        case "currencyField":
        case "dateField":
        case "timeField":
        case "patternField":
        case "comboBox":
          layer._makeTypable(id, element, primitive);
          break;
        case "listBox":
          if (primitive.dropdown)
            layer._makeDropDownList(id, element, primitive);
          else
            layer._makeList(id, element, primitive);
          break;
        case "fileSelection":
          layer._makeTypable(id, element, primitive);
          (_c = element.querySelector("button")) == null ? void 0 : _c.setAttribute("disabled", "");
          break;
        case "spinButton":
          layer._makeSpinButton(id, element, primitive);
          break;
        case "scrollBar":
          layer._makeScrollBar(id, element, primitive);
          break;
      }
      element.querySelectorAll("button, input, select, textarea, a").forEach((focusable) => focusable.setAttribute("tabindex", "-1"));
      element.addEventListener("mousedown", (event) => {
        if (!event.target.classList.contains("vector-form-field"))
          event.preventDefault();
      });
      element.addEventListener("wheel", (event) => {
        var _a2;
        event.preventDefault();
        (_a2 = document.getElementById("document-canvas")) == null ? void 0 : _a2.dispatchEvent(new WheelEvent("wheel", event));
      }, { passive: false });
      const input = element.querySelector("input");
      const label = element.querySelector("label");
      if (input && label)
        label.addEventListener("click", () => {
          if (!input.disabled)
            input.click();
        });
      return element;
    }
    /*
      The text a field shows becomes an input to type in, a text area where the field holds
      several lines. Return, or leaving the field, sends what was typed; Escape takes it back.
      The keys typed there are the field's, the document does not see them, and Return and
      Escape give the keyboard back to the document.
    */
    static _makeTypable(id, element, primitive) {
      var _a, _b, _c, _d;
      const shown = (_a = element.querySelector(".ui-edit")) == null ? void 0 : _a.firstElementChild;
      if (!shown)
        return;
      const original = primitive.text ?? "";
      const style = {
        flex: "1",
        minWidth: "0",
        alignSelf: "stretch",
        boxSizing: "border-box",
        margin: "0",
        padding: "0 4px",
        border: "none",
        backgroundColor: "transparent",
        font: "inherit",
        color: "inherit",
        textAlign: primitive.align !== void 0 ? ["left", "center", "right"][primitive.align] ?? "left" : "left",
        resize: "none"
      };
      const input = primitive.multiLine ? h("textarea", { class: "vector-form-field", style }) : h("input", { type: "text", class: "vector-form-field", style });
      input.value = original;
      if (primitive.disabled)
        input.disabled = true;
      shown.replaceWith(input);
      input.addEventListener("change", () => _VectorFormControlLayer._send(id, "text", input.value));
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        const key = event.key;
        if (key === "Escape")
          input.value = original;
        if (key === "Escape" || key === "Enter" && !primitive.multiLine) {
          event.preventDefault();
          input.blur();
          app.map.focus();
        }
      });
      for (const type of ["keypress", "keyup", "input"])
        input.addEventListener(type, (event) => event.stopPropagation());
      const layer = _VectorFormControlLayer;
      const extras = Array.from(((_b = input.parentElement) == null ? void 0 : _b.children) ?? []).slice(1);
      const dropArrow = primitive.dropdown ? extras[0] : void 0;
      const spinArrows = primitive.spin ? (_c = extras[primitive.dropdown ? 1 : 0]) == null ? void 0 : _c.children : void 0;
      const spin = (up) => {
        if (input.disabled)
          return;
        if (input.value !== original)
          layer._send(id, "text", input.value);
        layer._send(id, "spin", up ? "up" : "down");
      };
      if (spinArrows && spinArrows.length >= 2) {
        spinArrows[0].addEventListener("click", () => spin(true));
        spinArrows[1].addEventListener("click", () => spin(false));
        input.addEventListener("keydown", (event) => {
          const key = event.key;
          if (key !== "ArrowUp" && key !== "ArrowDown")
            return;
          event.preventDefault();
          spin(key === "ArrowUp");
        });
      }
      if (!dropArrow)
        return;
      dropArrow.style.cursor = "pointer";
      if (primitive.kind === "comboBox" && ((_d = primitive.items) == null ? void 0 : _d.length)) {
        const entries = primitive.items;
        dropArrow.addEventListener("click", () => {
          if (input.disabled || layer._closeOpenPart(element))
            return;
          const close = layer._openUnder(element, h("div", { class: "jsdialog ui-listbox", style: {
            height: "auto",
            maxHeight: "none",
            display: "block",
            padding: "0"
          } }, entries.map((entry) => h("div", { style: { padding: "0 4px", cursor: "pointer" }, onClick: () => {
            input.value = entry;
            close();
            layer._send(id, "text", entry);
            app.map.focus();
          } }, entry))));
        });
      }
      if (primitive.kind === "dateField")
        dropArrow.addEventListener("click", () => {
          if (input.disabled || layer._closeOpenPart(element))
            return;
          const close = layer._openUnder(element, layer._calendar(primitive.date, (picked) => {
            close();
            layer._send(id, "date", picked);
            app.map.focus();
          }));
        });
    }
    /*
      Opens a part under the control, a list of entries or a calendar, over the controls below
      it. A click elsewhere or Escape closes it, also with the keyboard outside the field.
      Answers the function that closes it.
    */
    static _openUnder(element, part) {
      part.classList.add("vector-form-open-part");
      Object.assign(part.style, {
        position: "absolute",
        left: "0",
        top: "100%",
        minWidth: "100%",
        boxSizing: "border-box",
        border: "1px solid var(--color-border-input-dark)",
        backgroundColor: "var(--color-background-lighter)"
      });
      const close = () => {
        part.remove();
        element.style.zIndex = "";
        window.removeEventListener("pointerdown", closeOutside, true);
        window.removeEventListener("keydown", closeByEscape, true);
      };
      const closeOutside = (event) => {
        if (!element.contains(event.target))
          close();
      };
      const closeByEscape = (event) => {
        if (event.key !== "Escape")
          return;
        event.stopPropagation();
        close();
      };
      element.style.zIndex = "1";
      element.appendChild(part);
      window.addEventListener("pointerdown", closeOutside, true);
      window.addEventListener("keydown", closeByEscape, true);
      part.closePart = close;
      return close;
    }
    // closes the part open under the control, answering whether there was one
    static _closeOpenPart(element) {
      var _a;
      const open = element.querySelector(".vector-form-open-part");
      (_a = open == null ? void 0 : open.closePart) == null ? void 0 : _a.call(open);
      return !!open;
    }
    /*
      A calendar of a month, the one of the date given as YYYY-MM-DD, or of today: the month
      with arrows to the one before and after, the days of the week, and the days, the given
      one marked. A click on a day answers it as YYYY-MM-DD.
    */
    static _calendar(given, onPick) {
      const parts = (given ?? "").split("-").map(Number);
      const chosen = parts.length === 3 && parts[0] ? parts : void 0;
      const today = /* @__PURE__ */ new Date();
      let year = chosen ? chosen[0] : today.getFullYear();
      let month = chosen ? chosen[1] - 1 : today.getMonth();
      const language = navigator.language;
      const calendar = h("div", { class: "jsdialog", style: { padding: "2px", fontSize: "0.9em" } });
      const two = (n) => (n < 10 ? "0" : "") + n;
      const show = () => {
        calendar.textContent = "";
        const first = new Date(year, month, 1);
        const step = (by) => {
          month += by;
          year += Math.floor(month / 12);
          month = (month % 12 + 12) % 12;
          show();
        };
        const cell = {
          textAlign: "center",
          padding: "1px 3px",
          cursor: "pointer"
        };
        calendar.appendChild(h(
          "div",
          { style: { display: "flex", justifyContent: "space-between" } },
          h("span", { style: cell, onClick: () => step(-1) }, "\u25C2"),
          h("span", null, first.toLocaleDateString(language, {
            month: "long",
            year: "numeric"
          })),
          h("span", { style: cell, onClick: () => step(1) }, "\u25B8")
        ));
        const grid = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, auto)" } });
        for (let day = 0; day < 7; ++day)
          grid.appendChild(h("span", { style: {
            textAlign: "center",
            padding: "1px 3px",
            opacity: "0.6"
          } }, new Date(2024, 0, 1 + day).toLocaleDateString(language, {
            weekday: "narrow"
          })));
        for (let gap = (first.getDay() + 6) % 7; gap > 0; --gap)
          grid.appendChild(h("span", null));
        const days = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= days; ++day) {
          const isChosen = !!chosen && chosen[0] === year && chosen[1] === month + 1 && chosen[2] === day;
          grid.appendChild(h("span", { style: isChosen ? {
            ...cell,
            backgroundColor: "var(--color-primary)",
            color: "var(--color-primary-text)"
          } : cell, onClick: () => onPick(year + "-" + two(month + 1) + "-" + two(day)) }, String(day)));
        }
        calendar.appendChild(grid);
      };
      show();
      return calendar;
    }
    /*
      A list that drops down: a list of the browser's own lies over the drawn field, unseen, so
      a click on the field opens it, and the entry chosen there is selected.
    */
    static _makeDropDownList(id, element, primitive) {
      const chosen = (primitive.selected ?? [])[0] ?? -1;
      const list = h("select", { class: "vector-form-field", style: {
        position: "absolute",
        left: "0",
        top: "0",
        width: "100%",
        height: "100%",
        opacity: "0",
        cursor: "pointer"
      } }, (primitive.items ?? []).map((item, at) => h("option", { value: String(at) }, item)));
      list.selectedIndex = chosen;
      if (primitive.disabled)
        list.disabled = true;
      list.addEventListener("change", () => {
        _VectorFormControlLayer._send(id, "select", String(list.selectedIndex));
        app.map.focus();
      });
      list.addEventListener("keydown", (event) => event.stopPropagation());
      element.appendChild(list);
    }
    /*
      A list that shows its entries: a click selects the entry alone; with Ctrl, in a list that
      takes several, the entry joins the selection or leaves it.
    */
    static _makeList(id, element, primitive) {
      if (primitive.disabled)
        return;
      const selected = primitive.selected ?? [];
      element.querySelectorAll(".ui-listbox > div").forEach((entry, at) => {
        entry.style.cursor = "pointer";
        entry.addEventListener("click", (event) => {
          const toggling = primitive.multiSelection && (event.ctrlKey || event.metaKey);
          const wanted = !toggling ? [at] : selected.includes(at) ? selected.filter((place) => place !== at) : selected.concat([at]);
          _VectorFormControlLayer._send(id, "select", wanted.join(","));
        });
      });
    }
    // where the value of a scroll bar or a spin button goes, kept within its bounds
    static _moveTo(id, primitive, value) {
      const min = primitive.min ?? 0;
      const max = primitive.max ?? 100;
      const within = Math.round(Math.min(max, Math.max(min, value)));
      if (within !== (primitive.value ?? min))
        _VectorFormControlLayer._send(id, "value", String(within));
    }
    /// A spin button: up, or right where it runs across, adds a step, the other arrow takes one.
    static _makeSpinButton(id, element, primitive) {
      var _a;
      if (primitive.disabled)
        return;
      const arrows = (_a = element.firstElementChild) == null ? void 0 : _a.children;
      if (!arrows || arrows.length < 2)
        return;
      const step = primitive.step ?? 1;
      const value = primitive.value ?? primitive.min ?? 0;
      const first = primitive.vertical ? step : -step;
      arrows[0].addEventListener("click", () => _VectorFormControlLayer._moveTo(id, primitive, value + first));
      arrows[1].addEventListener("click", () => _VectorFormControlLayer._moveTo(id, primitive, value - first));
    }
    /*
      A scroll bar: its arrows go a step, a click on the track before or after the thumb a page,
      and the thumb is dragged to where the value goes, which is sent when it is let go.
    */
    static _makeScrollBar(id, element, primitive) {
      var _a;
      if (primitive.disabled)
        return;
      const parts = (_a = element.firstElementChild) == null ? void 0 : _a.children;
      if (!parts || parts.length < 3)
        return;
      const before = parts[0];
      const track = parts[1];
      const after = parts[2];
      const thumb = track.firstElementChild;
      if (!thumb)
        return;
      const layer = _VectorFormControlLayer;
      const vertical = primitive.vertical === true;
      const min = primitive.min ?? 0;
      const max = primitive.max ?? 100;
      const value = primitive.value ?? min;
      const step = primitive.step ?? 1;
      const pageStep = primitive.pageStep ?? primitive.visible ?? Math.max(1, (max - min) / 10);
      before.addEventListener("click", () => layer._moveTo(id, primitive, value - step));
      after.addEventListener("click", () => layer._moveTo(id, primitive, value + step));
      track.addEventListener("click", (event) => {
        if (event.target === thumb)
          return;
        const box = thumb.getBoundingClientRect();
        const ahead = vertical ? event.clientY > box.bottom : event.clientX > box.right;
        layer._moveTo(id, primitive, value + (ahead ? pageStep : -pageStep));
      });
      thumb.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const trackBox = track.getBoundingClientRect();
        const thumbBox = thumb.getBoundingClientRect();
        const along = (e) => vertical ? e.clientY : e.clientX;
        const trackStart = vertical ? trackBox.top : trackBox.left;
        const travel = (vertical ? trackBox.height - thumbBox.height : trackBox.width - thumbBox.width) || 1;
        const grab = along(event) - (vertical ? thumbBox.top : thumbBox.left);
        const shareAt = (e) => Math.min(1, Math.max(0, (along(e) - grab - trackStart) / travel));
        const travelPercent = 100 - (parseFloat(vertical ? thumb.style.height : thumb.style.width) || 0);
        thumb.setPointerCapture(event.pointerId);
        const move = (e) => {
          const placed = shareAt(e) * travelPercent + "%";
          if (vertical)
            thumb.style.top = placed;
          else
            thumb.style.left = placed;
        };
        const up = (e) => {
          thumb.removeEventListener("pointermove", move);
          thumb.removeEventListener("pointerup", up);
          layer._moveTo(id, primitive, min + shareAt(e) * (max - min));
        };
        thumb.addEventListener("pointermove", move);
        thumb.addEventListener("pointerup", up);
      });
    }
    static _send(id, action, value) {
      app.socket.sendMessage("formcontrol id=" + id + " action=" + action + " value=" + encodeURIComponent(value));
    }
  };
  _VectorFormControlLayer.formControlKind = 32;
  _VectorFormControlLayer.twipsPerPixel = 15;
  _VectorFormControlLayer._elements = /* @__PURE__ */ new Map();
  _VectorFormControlLayer.shownPart = "";
  let VectorFormControlLayer = _VectorFormControlLayer;
  cool2.VectorFormControlLayer = VectorFormControlLayer;
})(cool || (cool = {}));
