const _Interaction = class _Interaction {
  static set() {
    if (!_Interaction.setInUse)
      _Interaction.setInUse = new ClassicInteractionSet();
    return _Interaction.setInUse;
  }
  /*
      Where the selection says one stands: the page where nothing is selected or the parent of
      what is selected is the page, a diagram where that parent or any parent above it is one,
      a group otherwise. The objects of a selection all have the same parent, so the first says
      it for all of them.
  */
  static placeOf(selected) {
    var _a, _b;
    if (RenderManager.isVectorRendering() && GraphicSelection.inPlaceActive && GraphicSelection.inPlaceArea && GraphicSelection.inPlaceObject !== void 0)
      return { kind: "inPlace", object: GraphicSelection.inPlaceObject };
    const first = selected[0];
    const parent = first === void 0 ? void 0 : RenderGeometrySection.parentOf(first);
    if (selected.length === 1 && ((_a = RenderGeometrySection.objectOf(first)) == null ? void 0 : _a.objectKind) === _Interaction.tableKind)
      return { kind: "table", table: first, group: parent || void 0 };
    if (!parent)
      return { kind: "page" };
    for (let above = parent, guard = 0; above && guard < 100; above = RenderGeometrySection.parentOf(above), ++guard) {
      if ((_b = RenderGeometrySection.objectOf(above)) == null ? void 0 : _b.isDiagram)
        return { kind: "diagram", group: parent, diagram: above };
    }
    return { kind: "group", group: parent };
  }
  /// The context for the selection as it is now.
  static context() {
    return _Interaction.contextAt(_Interaction.placeOf(GraphicSelection.selectedObjectIDs));
  }
  /// The context for that place, which may be one the selection stood at before.
  static contextAt(place) {
    return _Interaction.set().contextFor(place);
  }
  /// The groups above those objects, from their parent up to the one the page holds.
  static groupsAbove(selected) {
    const groups = [];
    const first = selected[0];
    let above = first === void 0 ? void 0 : RenderGeometrySection.parentOf(first);
    for (let guard = 0; above && guard < 100; ++guard) {
      groups.push(above);
      above = RenderGeometrySection.parentOf(above);
    }
    return groups;
  }
};
_Interaction.commandsForOneOrMore = [
  ".uno:ObjectAlignLeft",
  ".uno:AlignCenter",
  ".uno:ObjectAlignRight",
  ".uno:AlignUp",
  ".uno:AlignMiddle",
  ".uno:AlignDown",
  ".uno:ObjectAlign",
  ".uno:BringToFront",
  ".uno:ObjectForwardOne",
  ".uno:ObjectBackOne",
  ".uno:SendToBack",
  ".uno:TransformDialog"
];
_Interaction.commandsForOne = [
  ".uno:NameGroup",
  ".uno:ObjectTitleDescription"
];
_Interaction.commandsForThreeOrMore = [
  ".uno:DistributeSelection",
  ".uno:DistributeHorzLeft",
  ".uno:DistributeHorzCenter",
  ".uno:DistributeHorzDistance",
  ".uno:DistributeHorzRight",
  ".uno:DistributeVertTop",
  ".uno:DistributeVertCenter",
  ".uno:DistributeVertDistance",
  ".uno:DistributeVertBottom"
];
_Interaction.commandsByKind = [
  ".uno:FlipHorizontal",
  ".uno:FlipVertical",
  ".uno:ChangeBezier",
  ".uno:ConvertToEditableShape",
  ".uno:FormatArea",
  ".uno:FormatLine"
];
_Interaction.statesGivenHere = [
  ".uno:EnterGroup",
  ".uno:LeaveGroup",
  ".uno:FormatUngroup",
  ".uno:FormatGroup",
  ..._Interaction.commandsForOneOrMore,
  ..._Interaction.commandsForOne,
  ..._Interaction.commandsForThreeOrMore,
  ..._Interaction.commandsByKind
];
_Interaction.tableKind = 35;
_Interaction.setInUse = null;
let Interaction = _Interaction;
