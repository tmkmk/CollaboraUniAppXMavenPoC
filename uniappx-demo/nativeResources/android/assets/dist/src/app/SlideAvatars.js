const _SlideAvatars = class _SlideAvatars {
  static slots(people, slotCount = _SlideAvatars.slotCount) {
    if (!(people > 0) || !(slotCount > 0))
      return { faces: 0, hidden: 0 };
    if (people <= slotCount)
      return { faces: people, hidden: 0 };
    if (slotCount === 1)
      return { faces: 0, hidden: people };
    return { faces: slotCount - 1, hidden: people - (slotCount - 1) };
  }
  // Nine stands for nine or more.
  static counterText(hidden) {
    if (hidden > _SlideAvatars.counterCap)
      return _SlideAvatars.counterCap + "+";
    return "+" + hidden;
  }
};
_SlideAvatars.slotCount = 3;
_SlideAvatars.counterCap = 9;
let SlideAvatars = _SlideAvatars;
app.SlideAvatars = SlideAvatars;
