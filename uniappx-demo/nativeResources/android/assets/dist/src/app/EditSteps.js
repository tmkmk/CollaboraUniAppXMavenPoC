const _EditSteps = class _EditSteps {
  /// The value of that preference where it is a number above nought, the default otherwise.
  static setting(name, byDefault) {
    var _a;
    const value = ((_a = window.prefs) == null ? void 0 : _a.getNumber(name, byDefault)) ?? byDefault;
    return value > 0 ? value : byDefault;
  }
  /// One pixel as it is seen, in twips: the twips of a core pixel are the twips of a screen
  /// pixel only where the screen is not scaled, so the scale goes in.
  static pixel() {
    return app.pixelsToTwips * app.dpiScale;
  }
  /// What a distance in the document is multiplied by for the page shown: one up to ten times
  /// an A4 page, then the power of ten below how many times larger the page is.
  static pageFactor() {
    var _a;
    const size = (_a = app.activeDocument) == null ? void 0 : _a.fileSize;
    if (!size)
      return 1;
    const times = Math.max(size.x, size.y) / _EditSteps.a4LongerSide;
    if (!(times >= 10))
      return 1;
    return Math.pow(10, Math.floor(Math.log10(times)));
  }
  /*
      How far a key moves an object or a handle, in twips: 25 millimetres with Ctrl
      (vectorKeyStepControl), 10 with Shift (vectorKeyStepShift), 1 with no modifier
      (vectorKeyStep), each grown with the page, and one pixel with Alt. The office takes the
      last three.
  */
  static moveStep(event) {
    let millimetres;
    if (event.ctrlKey)
      millimetres = _EditSteps.setting("vectorKeyStepControl", 25);
    else if (event.shiftKey)
      millimetres = _EditSteps.setting("vectorKeyStepShift", 10);
    else if (event.altKey)
      return _EditSteps.pixel();
    else
      millimetres = _EditSteps.setting("vectorKeyStep", 1);
    return millimetres * _EditSteps.millimetre * _EditSteps.pageFactor();
  }
  /*
      How far a key scrolls the view along each axis, in twips, for a view of that size in twips.
      The office scrolls by a share of what is in view rather than by a distance, so a step
      means the same at every zoom: half of it with Ctrl (vectorScrollStepControl), the office's
      page, a quarter with Shift (vectorScrollStepShift), a twentieth with no modifier
      (vectorScrollStep), the office's line, and one pixel with Alt.
  */
  static scrollStep(event, viewWidth, viewHeight) {
    let share;
    if (event.ctrlKey)
      share = _EditSteps.setting("vectorScrollStepControl", 0.5);
    else if (event.shiftKey)
      share = _EditSteps.setting("vectorScrollStepShift", 0.25);
    else if (event.altKey) {
      const pixel = _EditSteps.pixel();
      return new cool.Point(pixel, pixel);
    } else
      share = _EditSteps.setting("vectorScrollStep", 0.05);
    return new cool.Point(viewWidth * share, viewHeight * share);
  }
  /*
      the step the length of a line snaps to while one of its ends is dragged, in twips: 10
      millimetres with Ctrl (vectorLengthSnapControl), 1 with Alt (vectorLengthSnapAlt), each
      grown with the page
  */
  static lengthSnap(steps) {
    const millimetres = steps === "whole" ? _EditSteps.setting("vectorLengthSnapControl", 10) : _EditSteps.setting("vectorLengthSnapAlt", 1);
    return millimetres * _EditSteps.millimetre * _EditSteps.pageFactor();
  }
  /*
      The step in degrees a turn snaps to, counted from the page: 45 with Ctrl
      (vectorTurnSnapControl), 15 with Shift (vectorTurnSnapShift), 5 with Alt
      (vectorTurnSnapAlt). With no modifier the mouse has no step, and a key the one below.
  */
  static turnSnap(event) {
    if (event == null ? void 0 : event.ctrlKey)
      return _EditSteps.setting("vectorTurnSnapControl", 45);
    if (event == null ? void 0 : event.shiftKey)
      return _EditSteps.setting("vectorTurnSnapShift", 15);
    if (event == null ? void 0 : event.altKey)
      return _EditSteps.setting("vectorTurnSnapAlt", 5);
    return null;
  }
  /*
      The angle on from that one by a key: the next step of that size up for a way of 1, the
      next one down for -1. A hair is allowed for, so an angle that stands on a step goes on to
      the next one.
  */
  static nextStep(angle, step, way) {
    const inSteps = angle / step;
    const next = way > 0 ? Math.floor(inSteps + 1e-6) + 1 : Math.ceil(inSteps - 1e-6) - 1;
    return next * step;
  }
  /// The step in degrees a key with no modifier turns to, counted from the page
  /// (vectorKeyTurnStep).
  static keyTurnStep() {
    return _EditSteps.setting("vectorKeyTurnStep", 1);
  }
};
_EditSteps.a4LongerSide = 297 * 1440 / 25.4;
_EditSteps.millimetre = 1440 / 25.4;
let EditSteps = _EditSteps;
