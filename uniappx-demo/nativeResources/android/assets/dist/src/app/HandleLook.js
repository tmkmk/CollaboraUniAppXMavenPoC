const _HandleLook = class _HandleLook {
  /// that size, or the one set for the view that draws from the objects
  static sizeNow() {
    return VectorSettings.handleSize(_HandleLook.size);
  }
  /*
      That color moved towards white by that share of the whole range, or towards black where
      the share is negative.
  */
  static blended(color, by) {
    const part = (at) => parseInt(color.substr(at, 2), 16);
    const moved = (value) => Math.round(Math.min(255, Math.max(0, value + by * 255))).toString(16).padStart(2, "0");
    return "#" + moved(part(1)) + moved(part(3)) + moved(part(5));
  }
  /// How wide a handle of that kind is drawn, in core pixels.
  static widthOf(kind) {
    return _HandleLook.sizeNow() * _HandleLook.shareOfTheSize[kind] * app.dpiScale;
  }
  /// How much a larger handle of that kind reaches beyond the usual one on each side, in core
  /// pixels.
  static largerBy(kind) {
    return _HandleLook.widthOf(kind) * _HandleLook.shareALargerHandleGrows;
  }
  /// How far the eight are drawn outside the places they stand on, in core pixels.
  static distanceTheEightMoveOut() {
    const share = Math.max(-1, Math.min(1, _HandleLook.shareTheEightMoveOut));
    return share * _HandleLook.widthOf("framing") * 0.5;
  }
  /*
      Where a handle is drawn, in twips, which is where it stands unless it is one of the eight
      and those are drawn outside the frame.
  */
  static drawnAt(handle) {
    const away = handle.awayFromItsPlace;
    const distance = away ? (handle.awayBy ?? _HandleLook.distanceTheEightMoveOut()) * app.pixelsToTwips : 0;
    return new cool.SimplePoint(handle.point.x + (away ? away.x * distance : 0), handle.point.y + (away ? away.y * distance : 0));
  }
  /// How far a band stands off from what it goes round, in core pixels.
  static distanceBeforeASurround() {
    return _HandleLook.sizeNow() * _HandleLook.shareOfTheSizeBeforeASurround * app.dpiScale;
  }
  /// How wide a band is drawn, in core pixels.
  static widthOfASurround() {
    return _HandleLook.sizeNow() * _HandleLook.shareOfTheSizeOfASurround * app.dpiScale;
  }
  /// How far the outer edge of a band lies from what it goes round, in core pixels.
  static reachOfASurround() {
    return _HandleLook.distanceBeforeASurround() + _HandleLook.widthOfASurround();
  }
  /*
      Lays the outline of a handle of that kind into the path being built, grown by however much
      the handle is being shown larger, and answers the color it is filled with.
  */
  /*
      Lays the handle above the selection in the mode that shears into the path being built: a
      rectangle slanted by thirty degrees, a little wider than high, a little wider than the
      circle of the turning mode and less high, turned by that angle with the selection. It is
      filled and edged as that circle is.
  */
  static layShearing(context, at, grown, turnedBy = 0) {
    const size = _HandleLook.widthOf("turning") + 2 * grown;
    const wide = size * 0.9;
    const high = size * 0.75;
    const slant = high * Math.tan(Math.PI / 6);
    const corners = cool.Matrix2D.IDENTITY.rotateAround(0, 0, turnedBy).translate(at.vX, at.vY);
    [
      corners.apply(-wide / 2 + slant / 2, -high / 2),
      corners.apply(wide / 2 + slant / 2, -high / 2),
      corners.apply(wide / 2 - slant / 2, high / 2),
      corners.apply(-wide / 2 - slant / 2, high / 2)
    ].forEach((corner, index) => index ? context.lineTo(corner.x, corner.y) : context.moveTo(corner.x, corner.y));
    context.closePath();
    return _HandleLook.colorOfTheKind.turning;
  }
  static lay(context, kind, at, grown, turnedBy) {
    const across = _HandleLook.widthOf(kind) + 2 * grown;
    if (_HandleLook.shapeOfTheKind[kind] !== "square")
      context.arc(at.vX, at.vY, across * 0.5, 0, Math.PI * 2);
    else if (turnedBy && _HandleLook.turnTheEightWithTheObject) {
      context.save();
      context.translate(at.vX, at.vY);
      context.rotate(turnedBy);
      context.rect(-across * 0.5, -across * 0.5, across, across);
      context.restore();
    } else
      context.rect(at.vX - across * 0.5, at.vY - across * 0.5, across, across);
    return _HandleLook.colorOfTheKind[kind];
  }
  /*
      The look of a marker class of the tiled view, as the page's rules give it, the rules of
      the branding included: the picture of its background, its width, and the picture it
      shows under the mouse. That one is set for the mouse over the element, which no element
      out of view can be asked for, so it is found by its name: "-hover" before the ending of
      a picture, "-selected" for the select square of a table. The drag marker is the picture
      of the office's own look, the one without "_branding" in its name.
  */
  static markerLook(className) {
    let look = _HandleLook.markerLooks.get(className);
    if (look)
      return look;
    const probe = document.createElement("div");
    probe.className = className;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const found = /url\("?([^")]+)"?\)/.exec(style.backgroundImage);
    const width = parseFloat(style.width) || 0;
    probe.remove();
    const picture = found ? found[1] : "";
    const lit = picture.includes("select-marker") ? picture.replace("select-marker", "select-marker-selected") : picture.replace(/(_branding)?\.svg$/, "-hover$1.svg");
    look = {
      picture,
      lit,
      drag: picture.replace("_branding.svg", ".svg"),
      width
    };
    if (picture)
      _HandleLook.markerLooks.set(className, look);
    return look;
  }
  // the picture at that address, which draws the document again once it has loaded
  static markerPicture(address) {
    let picture = _HandleLook.markerPictures.get(address);
    if (!picture) {
      picture = new Image();
      picture.onload = () => {
        var _a;
        return (_a = app.sectionContainer) == null ? void 0 : _a.requestReDraw();
      };
      picture.src = address;
      _HandleLook.markerPictures.set(address, picture);
    }
    return picture;
  }
  /*
      Draws the picture of a marker class of the tiled view with its middle at that point, that
      large in CSS pixels, upright or laid in the axes given. Under the mouse or the keyboard,
      where grown is above nought, it grows as a handle there does, unless grows is false, and
      shows the picture underMouse names: the one the tiled view shows under the mouse ('lit',
      the default), the drag marker ('drag', the picture without the branding) or its usual one.
      With always set it shows that picture always. A picture the branding does not have falls
      back to the usual one.
  */
  static drawMarker(context, className, at, size, grown, options = {}) {
    const look = _HandleLook.markerLook(className);
    if (!look.picture)
      return;
    const which = options.underMouse ?? "lit";
    const other = (grown > 0 || options.always) && which !== "usual" ? _HandleLook.markerPicture(which === "drag" ? look.drag : look.lit) : void 0;
    const picture = other && other.complete && other.naturalWidth ? other : _HandleLook.markerPicture(look.picture);
    if (!picture.complete || !picture.naturalWidth)
      return;
    const axes = options.axes;
    const grows = options.grows ?? true;
    const across = size * app.dpiScale + (grows ? 2 * grown : 0);
    context.save();
    if (axes)
      context.setTransform(axes[0].x, axes[0].y, axes[1].x, axes[1].y, at.vX, at.vY);
    else
      context.setTransform(1, 0, 0, 1, at.vX, at.vY);
    context.drawImage(picture, -across * 0.5, -across * 0.5, across, across);
    context.restore();
  }
};
_HandleLook.size = 12;
_HandleLook.shareOfTheSize = {
  framing: 1,
  turning: 1,
  shaping: 1,
  tiePoint: 5 / 6,
  pathPoint: 2 / 3,
  weight: 1 / 2,
  crop: 1
};
_HandleLook.shapeOfTheKind = {
  framing: "square",
  turning: "circle",
  shaping: "circle",
  tiePoint: "circle",
  pathPoint: "square",
  weight: "circle",
  /*
      A crop mark is neither: an L at a corner of the picture and a bar along a side, each
      a handle long and half a handle thick, laid in the picture's own axes by the group
      that draws them. The size and the color come from here.
  */
  crop: "square"
};
_HandleLook.colorOfTheKind = {
  framing: "#FFFFFF",
  turning: "#FFFFFF",
  shaping: "#FFFF00",
  /*
      A point to tie a connector to is drawn in a dimmed red: it is offered while something
      else is being done and should not shout over the handles beside it.
  */
  tiePoint: "#B03A3A",
  pathPoint: "#1C99E0",
  weight: "#1C99E0",
  // A crop mark is drawn in the handle color darkened by cropMarkShade. This is what it
  // falls back on where that cannot be worked out.
  crop: "#FFFFFF"
};
_HandleLook.shareOfTheSizeBeforeASurround = 2 / 5;
_HandleLook.shareOfTheSizeOfASurround = 2 / 5;
_HandleLook.colorOfTheSurround = {
  group: "#CFE0F4",
  diagram: "#F0F0F0"
};
_HandleLook.surroundBlend = 0.1;
_HandleLook.bandRoundAGroup = true;
_HandleLook.shareTheEightMoveOut = 0.5;
_HandleLook.turnTheEightWithTheObject = true;
_HandleLook.cropMarkShade = 0.12;
_HandleLook.outlineColour = "black";
_HandleLook.tiePointKeepingItsDistance = "#CC6666";
_HandleLook.tiePointFallenBackOn = "#6A2323";
_HandleLook.deactivatedColour = "#E0E0E0";
_HandleLook.deactivatedOutlineColour = "#909090";
_HandleLook.outlineOfADrag = "#1C99E0";
_HandleLook.helperLineColour = "#1C99E0";
_HandleLook.helperLineDarkColour = "#0B3F63";
_HandleLook.helperLineAlpha = 0.7;
_HandleLook.helperLineDash = 4;
_HandleLook.shareALargerHandleGrows = 1 / 4;
_HandleLook.markerLooks = /* @__PURE__ */ new Map();
_HandleLook.markerPictures = /* @__PURE__ */ new Map();
let HandleLook = _HandleLook;
