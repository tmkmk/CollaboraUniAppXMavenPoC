const _GroupButtonSection = class _GroupButtonSection extends GenericButtonSection {
  constructor(objectId, role, slot) {
    var _a;
    super(_GroupButtonSection.nameFor(objectId, role), _GroupButtonSection.size, _GroupButtonSection.size, "group-button group-button-" + role, "");
    this.pressable = true;
    this.objectId = objectId;
    this.role = role;
    this.slot = slot;
    this.sectionProperties.lastInputEvent = null;
    (_a = this.getHTMLObject()) == null ? void 0 : _a.setAttribute("data-cooltip", _GroupButtonSection.tooltipFor(role));
  }
  /*
      The text shown while the pointer rests on the button, the one the toolbar shows for the
      same command, with its shortcut. The engine's command that opens a diagram has no text on
      this side, so it is given here.
  */
  static tooltipFor(role) {
    const command = role === "enter" ? ".uno:EnterGroup" : role === "leave" ? ".uno:LeaveGroup" : role === "ungroup" ? ".uno:FormatUngroup" : void 0;
    if (!command)
      return _("Edit Diagram");
    return JSDialog.ShortcutsUtil.getTooltipLabel(_UNO(command, "presentation"), command);
  }
  /// The name of the button for that role beside the band of that object.
  static nameFor(objectId, role) {
    return _GroupButtonSection.namePrefix + String(objectId) + "_" + role;
  }
  /// How far one button is below the one above it, in core pixels.
  static step() {
    return (_GroupButtonSection.size + _GroupButtonSection.spaceBetween) * app.dpiScale;
  }
  /// Takes the place in the column and whether the button may be pressed, and stands there.
  standAt(slot, pressable) {
    var _a, _b;
    this.slot = slot;
    this.pressable = pressable;
    (_a = this.getHTMLObject()) == null ? void 0 : _a.classList.toggle("group-button-off", !pressable);
    if (!pressable)
      (_b = this.getHTMLObject()) == null ? void 0 : _b.classList.remove("hovered");
    this.follow();
  }
  /*
      Puts the button where it belongs now, beside the band as it stands. While the mouse drags
      the selection the button cannot be pressed, so it is not shown then, and it comes back
      beside the band where the drag left it.
  */
  follow() {
    var _a, _b;
    const shown = !((_a = GraphicSelection.selectionSection) == null ? void 0 : _a.isDragged());
    if (shown !== this.isSectionShown())
      this.setShowSection(shown);
    if (!shown) {
      (_b = app.map.tooltip) == null ? void 0 : _b.beginHide();
      return;
    }
    const at = this.calculatePositionPixel();
    this.setPosition(at[0], at[1]);
    this.adjustHTMLObjectPosition();
  }
  /*
      Where the button stands: clear of the band on its right, by the space between two buttons,
      and its place in the column down from the top of the band. Where the band is not there to
      be asked, the button stays where it stands.
  */
  calculatePositionPixel() {
    var _a;
    const band = (_a = GraphicSelection.selectionSection) == null ? void 0 : _a.bandBox(this.objectId);
    if (!band)
      return [this.position[0], this.position[1]];
    return [
      Math.round(band.maxX + HandleLook.reachOfASurround() + _GroupButtonSection.spaceBetween * app.dpiScale),
      Math.round(band.minY + this.slot * _GroupButtonSection.step())
    ];
  }
  /*
      Shows the button where it comes into the part of the document in view, and hides it where
      it leaves it, also when it is moved there by its band rather than by the view scrolling,
      as a turned group's band growing and shrinking again takes it out of view and back.
  */
  onDocumentObjectVisibilityChange() {
    this.onNewDocumentTopLeft();
  }
  onMouseEnter(point, e) {
    var _a;
    if (this.pressable)
      super.onMouseEnter(point, e);
    (_a = app.map.tooltip) == null ? void 0 : _a.beginShow(this.getHTMLObject());
  }
  onMouseLeave(point, e) {
    var _a;
    super.onMouseLeave(point, e);
    (_a = app.map.tooltip) == null ? void 0 : _a.beginHide();
  }
  onRemove() {
    var _a;
    (_a = app.map.tooltip) == null ? void 0 : _a.beginHide();
    super.onRemove();
  }
  onClick(point, e) {
    if (this.pressable)
      GraphicSelection.pressTheGroupButton(this.objectId, this.role);
  }
};
_GroupButtonSection.namePrefix = "GroupButton_";
_GroupButtonSection.size = 32;
_GroupButtonSection.spaceBetween = 5;
let GroupButtonSection = _GroupButtonSection;
