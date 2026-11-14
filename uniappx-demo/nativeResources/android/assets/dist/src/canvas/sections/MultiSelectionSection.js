const _MultiSelectionSection = class _MultiSelectionSection extends SelectionSection {
  constructor(objectIds) {
    super(_MultiSelectionSection.sectionName);
    this.objectIds = objectIds.slice();
  }
  /// Takes the objects the selection now holds and works its handles out again.
  setObjects(objectIds) {
    this.objectIds = objectIds.slice();
    this.forgetTheSquare();
    this.refresh();
  }
  selectedObjects() {
    return this.objectIds;
  }
};
_MultiSelectionSection.sectionName = "selected-objects";
let MultiSelectionSection = _MultiSelectionSection;
app.definitions.multiSelectionSection = MultiSelectionSection;
