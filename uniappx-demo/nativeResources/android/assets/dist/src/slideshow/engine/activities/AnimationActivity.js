class ActivityParamSet {
  constructor() {
    this.nMinNumberOfFrames = SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS;
    this.bAutoReverse = false;
    this.nRepeatCount = 1;
    this.nAccelerationFraction = 0;
    this.nDecelerationFraction = 0;
    this.aDiscreteTimes = [];
  }
}
const _AnimationActivity = class _AnimationActivity {
  constructor() {
    this.nId = _AnimationActivity.getUniqueId();
  }
  static getUniqueId() {
    ++_AnimationActivity.CURR_UNIQUE_ID;
    return _AnimationActivity.CURR_UNIQUE_ID;
  }
  getId() {
    return this.nId;
  }
};
_AnimationActivity.CURR_UNIQUE_ID = 0;
let AnimationActivity = _AnimationActivity;
