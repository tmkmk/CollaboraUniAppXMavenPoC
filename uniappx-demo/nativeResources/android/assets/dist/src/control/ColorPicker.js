const _ColorPicker = class _ColorPicker {
  constructor(selectedColorSample, options) {
    this.onShow = () => {
      if (!this._initialized || this._selectedColor === "#")
        return;
      this._initIndexes();
      this._updateTintsView();
    };
    this.options = Object.assign({
      selectedColor: "#ff0000",
      noColorControl: true,
      autoColorControl: false,
      selectionCallback: (_2) => {
      }
    }, options);
    if (this.options.noColorControl && this.options.autoColorControl) {
      this.options.autoColorControl = false;
      window.app.console.warn("ColorPicker: requested both no color and auto color control");
    }
    this._selectedBasicColorIndex = 0;
    this._selectedTintIndex = 0;
    const pickerID = _ColorPicker.ID++;
    this._basicColorSampleIdTag = _ColorPicker.ID_TAG + pickerID + "-basic-color-";
    this._tintSampleIdTag = _ColorPicker.ID_TAG + pickerID + "-tint-";
    this._noColorControlId = _ColorPicker.ID_TAG + pickerID + "-no-color";
    this._autoColorControlId = _ColorPicker.ID_TAG + pickerID + "-auto-color";
    this._createBasicColorSelectionMark();
    this._selectedColorElement = selectedColorSample;
    this._selectedColor = this.options.selectedColor;
    this._selectionCallback = this.options.selectionCallback;
    this._initIndexes();
    this._container = this._createControl();
    this._initialized = true;
  }
  getContainer() {
    return this._container;
  }
  _initIndexes() {
    for (var i = 0; i < this._getBasicColorCount(); ++i) {
      var tintSet = this._getTintSet(i);
      if (!tintSet)
        return;
      for (var j = 0; j < tintSet.length; ++j) {
        var tint = tintSet[j];
        if (tint === this._selectedColor) {
          this._selectedBasicColorIndex = i;
          this._selectedTintIndex = j;
          return;
        }
      }
    }
  }
  _createControl() {
    var children = [];
    if (this.options.noColorControl || this.options.autoColorControl)
      children.push(this._createPseudoColorControl());
    children.push(this._createBasicColorSamples());
    children.push(this._createTintSamples());
    return {
      type: "divcontainer",
      style: "colors-container",
      children
    };
  }
  _createPseudoColorControl() {
    var noColorControl = this.options.noColorControl;
    var icon = {
      type: "fixedtext",
      text: "",
      style: noColorControl ? "no-color-control-icon" : "auto-color-control-icon"
    };
    var label = noColorControl ? {
      type: "fixedtext",
      style: "no-color-control-label",
      text: _("No color")
    } : {
      type: "fixedtext",
      style: "auto-color-control-label",
      text: _("Automatic color")
    };
    var description = { type: "divcontainer", children: [icon, label] };
    var checked = noColorControl ? {
      type: "fixedtext",
      id: this._noColorControlId,
      style: "no-color-control-mark",
      text: ""
    } : {
      type: "fixedtext",
      id: this._autoColorControlId,
      style: "auto-color-control-mark",
      text: ""
    };
    var container = {
      type: "divcontainer",
      style: noColorControl ? "colors-container-no-color-row" : "colors-container-auto-color-row",
      handlers: [
        {
          event: "click",
          handler: window.L.bind(this.onClickPseudoColor, this)
        }
      ],
      children: [description, checked]
    };
    return container;
  }
  _createBasicColorSamples() {
    var colorEntries = [];
    for (var k = 0; k < this._getBasicColorCount(); ++k) {
      var selected = k === this._selectedBasicColorIndex;
      var entry = {
        type: "colorsample",
        id: this._basicColorSampleIdTag + k,
        selected,
        color: this._getBasicColor(k),
        size: "small",
        handlers: [
          {
            event: "click",
            handler: window.L.bind(this.onClickBasicColorSample, this)
          }
        ]
      };
      if (selected) {
        entry.mark = this._basicColorSelectionMark;
      }
      colorEntries.push(entry);
    }
    return {
      type: "divcontainer",
      style: "colors-container-basic-colors-row",
      children: colorEntries
    };
  }
  _createTintSamples() {
    var tints = this._getTintSet(this._selectedBasicColorIndex);
    var k, selected, entry, tintRowLength = tints.length / 2;
    var tintsEntries1 = [];
    for (k = 0; k < tintRowLength; ++k) {
      selected = tints[k] === this._selectedColor;
      entry = {
        type: "colorsample",
        id: this._tintSampleIdTag + k,
        selected,
        color: tints[k],
        size: "big",
        handlers: [
          {
            event: "click",
            handler: window.L.bind(this.onClickTintSample, this)
          }
        ]
      };
      tintsEntries1.push(entry);
    }
    var tintsRow1 = {
      type: "divcontainer",
      style: "colors-container-tints",
      children: tintsEntries1
    };
    var tintsEntries2 = [];
    for (k = tintRowLength; k < tints.length; ++k) {
      selected = tints[k] === this._selectedColor;
      entry = {
        type: "colorsample",
        id: this._tintSampleIdTag + k,
        selected,
        color: tints[k],
        size: "big",
        handlers: [
          {
            event: "click",
            handler: window.L.bind(this.onClickTintSample, this)
          }
        ]
      };
      tintsEntries2.push(entry);
    }
    var tintsRow2 = {
      type: "divcontainer",
      style: "colors-container-tints",
      children: tintsEntries2
    };
    return { type: "divcontainer", children: [tintsRow1, tintsRow2] };
  }
  _createBasicColorSelectionMark() {
    this._basicColorSelectionMark = window.L.DomUtil.create("div", "colors-container-basic-color-mark", null);
  }
  _getBasicColorCount() {
    return _ColorPicker.BASIC_COLORS.length;
  }
  _getBasicColor(index) {
    if (!(index >= 0 && index < _ColorPicker.BASIC_COLORS.length)) {
      return "";
    }
    return _ColorPicker.BASIC_COLORS[index];
  }
  _getTintSet(basicColorIndex) {
    const basicColor = this._getBasicColor(basicColorIndex);
    if (basicColor === "")
      return [];
    return _ColorPicker.TINTS[basicColor];
  }
  _extractBasicColorIndex(sampleId) {
    if (!sampleId.startsWith(this._basicColorSampleIdTag))
      return -1;
    var index = parseInt(sampleId.substring(this._basicColorSampleIdTag.length));
    if (index < 0 || index >= this._getBasicColorCount())
      return -1;
    return index;
  }
  _extractTintIndex(sampleId) {
    if (!sampleId.startsWith(this._tintSampleIdTag))
      return -1;
    var index = parseInt(sampleId.substring(this._tintSampleIdTag.length));
    if (index < 0 || index >= this._getTintSet(this._selectedBasicColorIndex).length)
      return -1;
    return index;
  }
  _getColorCode(colorIndex, colorType) {
    var sampleElem = this._getSampleElement(colorIndex, colorType);
    return sampleElem.name;
  }
  onClickPseudoColor() {
    this._selectedColor = "#";
    this._unselectSample(this._selectedTintIndex, "TINT");
    this._updatePseudoColorControl(true);
    this._selectionCallback("transparent");
  }
  onClickBasicColorSample(e) {
    var basicColorIndex = this._extractBasicColorIndex(e.id);
    if (basicColorIndex < 0)
      return;
    this._selectedBasicColorIndex = this._updateSelectedSample(basicColorIndex, this._selectedBasicColorIndex, "BASIC_COLOR");
    this._updateTintsView();
    this._selectTintIndex(3);
  }
  onClickTintSample(e) {
    var tintIndex = this._extractTintIndex(e.id);
    if (tintIndex < 0)
      return;
    this._selectTintIndex(tintIndex);
  }
  _selectTintIndex(tintIndex) {
    this._selectedTintIndex = this._updateSelectedSample(tintIndex, this._selectedTintIndex, "TINT");
    this._selectedColor = "#" + this._getColorCode(this._selectedTintIndex, "TINT");
    this._updatePseudoColorControl(false);
    this._updateSelectedColorElement();
    this._selectionCallback(this._getColorCode(this._selectedTintIndex, "TINT"));
  }
  _updateSelectedSample(colorIndex, selectedColorIndex, colorType) {
    this._unselectSample(selectedColorIndex, colorType);
    this._selectSample(colorIndex, colorType);
    return colorIndex;
  }
  _unselectSample(colorIndex, colorType) {
    var sampleElem = this._getSampleElement(colorIndex, colorType);
    if (sampleElem && sampleElem.firstChild) {
      if (colorType === "BASIC_COLOR") {
        sampleElem.removeChild(sampleElem.firstChild);
        window.L.DomUtil.removeClass(sampleElem, "colors-container-selected-basic-color");
      } else if (colorType === "TINT") {
        const child = sampleElem.firstChild;
        if (!("style" in child)) {
          throw new Error("Assertion failed: sampleElem.firstChild is not a HTMLElement");
        }
        child.style.visibility = "hidden";
      }
    }
  }
  _selectSample(colorIndex, colorType) {
    var sampleElem = this._getSampleElement(colorIndex, colorType);
    if (sampleElem) {
      if (colorType === "BASIC_COLOR") {
        sampleElem.appendChild(this._basicColorSelectionMark);
        window.L.DomUtil.addClass(sampleElem, "colors-container-selected-basic-color");
      } else if (colorType === "TINT" && sampleElem.firstChild) {
        const child = sampleElem.firstChild;
        if (!("style" in child)) {
          throw new Error("Assertion failed: sampleElem.firstChild is not a HTMLElement");
        }
        child.style.visibility = "visible";
      }
    }
  }
  _updateTintsView() {
    var tintSet = this._getTintSet(this._selectedBasicColorIndex);
    if (!tintSet)
      return;
    for (var i = 0; i < tintSet.length; ++i) {
      var tint = tintSet[i];
      var sampleElem = this._getSampleElement(i, "TINT");
      if (sampleElem) {
        sampleElem.style.backgroundColor = tint;
        sampleElem.name = tint.substring(1);
        if (sampleElem.firstChild) {
          const child = sampleElem.firstChild;
          if (!("style" in child)) {
            throw new Error("Assertion failed: sampleElem.firstChild is not a HTMLElement");
          }
          if (tint === this._selectedColor) {
            child.style.visibility = "visible";
          } else {
            child.style.visibility = "hidden";
          }
        }
      }
    }
  }
  _updatePseudoColorControl(checked) {
    if (this.options.noColorControl)
      this._updateNoColorControl(checked);
    else if (this.options.autoColorControl)
      this._updateAutoColorControl(checked);
  }
  _updateNoColorControl(checked) {
    var noColorElem = window.L.DomUtil.get(this._noColorControlId);
    if (noColorElem) {
      if (noColorElem.checked !== checked) {
        noColorElem.checked = checked;
        if (this._selectedColorElement) {
          if (checked) {
            noColorElem.textContent = "\u2714";
            window.L.DomUtil.addClass(this._selectedColorElement, "no-color-selected");
            this._selectedColorElement.textContent = "\\";
          } else {
            noColorElem.replaceChildren();
            window.L.DomUtil.removeClass(this._selectedColorElement, "no-color-selected");
            this._selectedColorElement.replaceChildren();
          }
        }
      }
    }
  }
  _updateAutoColorControl(checked) {
    var autoColorElem = window.L.DomUtil.get(this._autoColorControlId);
    if (autoColorElem) {
      if (autoColorElem.checked !== checked) {
        autoColorElem.checked = checked;
        if (this._selectedColorElement) {
          if (checked) {
            autoColorElem.textContent = "\u2714";
            window.L.DomUtil.addClass(this._selectedColorElement, "auto-color-selected");
            this._selectedColorElement.textContent = "\\";
          } else {
            autoColorElem.replaceChildren();
            window.L.DomUtil.removeClass(this._selectedColorElement, "auto-color-selected");
            this._selectedColorElement.replaceChildren();
          }
        }
      }
    }
  }
  _getSampleElement(index, type) {
    var sampleId;
    if (type === "BASIC_COLOR") {
      sampleId = this._basicColorSampleIdTag + index;
    } else if (type === "TINT") {
      sampleId = this._tintSampleIdTag + index;
    }
    return window.L.DomUtil.get(sampleId);
  }
  _updateSelectedColorElement() {
    if (this._selectedColorElement) {
      this._selectedColorElement.style.backgroundColor = this._selectedColor;
    }
  }
};
_ColorPicker.ID = 0;
_ColorPicker.ID_TAG = "color-picker-";
_ColorPicker.BASIC_COLORS = [
  "#000000",
  "#980000",
  "#ff0000",
  "#ff9900",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#9900ff",
  "#ff00ff"
];
_ColorPicker.TINTS = {
  "#000000": [
    "#000000",
    "#434343",
    "#666666",
    "#888888",
    "#bbbbbb",
    "#dddddd",
    "#eeeeee",
    "#ffffff"
  ],
  "#980000": [
    "#5b0f00",
    "#85200c",
    "#a61c00",
    "#980000",
    "#cc4125",
    "#dd7e6b",
    "#e6b8af",
    "#ffffff"
  ],
  "#ff0000": [
    "#660000",
    "#990000",
    "#cc0000",
    "#ff0000",
    "#e06666",
    "#ea9999",
    "#f4cccc",
    "#ffffff"
  ],
  "#ff9900": [
    "#783f04",
    "#b45f06",
    "#e69138",
    "#ff9900",
    "#f6b26b",
    "#f9cb9c",
    "#fce5cd",
    "#ffffff"
  ],
  "#ffff00": [
    "#7f6000",
    "#bf9000",
    "#f1c232",
    "#ffff00",
    "#ffd966",
    "#ffe599",
    "#fff2cc",
    "#ffffff"
  ],
  "#00ff00": [
    "#274e13",
    "#38761d",
    "#6aa84f",
    "#00ff00",
    "#93c47d",
    "#b6d7a8",
    "#d9ead3",
    "#ffffff"
  ],
  "#00ffff": [
    "#0c343d",
    "#134f5c",
    "#45818e",
    "#00ffff",
    "#76a5af",
    "#a2c4c9",
    "#d0e0e3",
    "#ffffff"
  ],
  // '#4a86e8': ['#1c4587', '#1155cc', '#3c78d8', '#4a86e8',
  // 	'#6d9eeb', '#a4c2f4', '#c9daf8', '#ffffff'],
  "#0000ff": [
    "#073763",
    "#0b5394",
    "#3d85c6",
    "#0000ff",
    "#6fa8dc",
    "#9fc5e8",
    "#cfe2f3",
    "#ffffff"
  ],
  "#9900ff": [
    "#20124d",
    "#351c75",
    "#674ea7",
    "#9900ff",
    "#8e7cc3",
    "#b4a7d6",
    "#d9d2e9",
    "#ffffff"
  ],
  "#ff00ff": [
    "#4c1130",
    "#741b47",
    "#a64d79",
    "#ff00ff",
    "#c27ba0",
    "#d5a6bd",
    "#ead1dc",
    "#ffffff"
  ]
};
let ColorPicker = _ColorPicker;
