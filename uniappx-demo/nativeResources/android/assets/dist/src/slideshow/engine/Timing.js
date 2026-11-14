var TimingType;
(function(TimingType2) {
  TimingType2[TimingType2["Unknown"] = 0] = "Unknown";
  TimingType2[TimingType2["Offset"] = 1] = "Offset";
  TimingType2[TimingType2["WallClock"] = 2] = "WallClock";
  TimingType2[TimingType2["Indefinite"] = 3] = "Indefinite";
  TimingType2[TimingType2["Event"] = 4] = "Event";
  TimingType2[TimingType2["SyncBase"] = 5] = "SyncBase";
  TimingType2[TimingType2["Media"] = 6] = "Media";
})(TimingType || (TimingType = {}));
var EventTrigger;
(function(EventTrigger2) {
  EventTrigger2[EventTrigger2["Unknown"] = 0] = "Unknown";
  EventTrigger2[EventTrigger2["OnBegin"] = 1] = "OnBegin";
  EventTrigger2[EventTrigger2["OnEnd"] = 2] = "OnEnd";
  EventTrigger2[EventTrigger2["BeginEvent"] = 3] = "BeginEvent";
  EventTrigger2[EventTrigger2["EndEvent"] = 4] = "EndEvent";
  EventTrigger2[EventTrigger2["OnClick"] = 5] = "OnClick";
  EventTrigger2[EventTrigger2["OnDblClick"] = 6] = "OnDblClick";
  EventTrigger2[EventTrigger2["OnMouseEnter"] = 7] = "OnMouseEnter";
  EventTrigger2[EventTrigger2["OnMouseLeave"] = 8] = "OnMouseLeave";
  EventTrigger2[EventTrigger2["OnNext"] = 9] = "OnNext";
  EventTrigger2[EventTrigger2["OnPrev"] = 10] = "OnPrev";
  EventTrigger2[EventTrigger2["Repeat"] = 11] = "Repeat";
})(EventTrigger || (EventTrigger = {}));
function getEventTriggerType(sEventTrigger) {
  if (sEventTrigger == "BeginEvent")
    return EventTrigger.BeginEvent;
  else if (sEventTrigger == "EndEvent")
    return EventTrigger.EndEvent;
  else if (sEventTrigger == "OnNext")
    return EventTrigger.OnNext;
  else if (sEventTrigger == "OnPrev")
    return EventTrigger.OnPrev;
  else if (sEventTrigger == "OnClick")
    return EventTrigger.OnClick;
  else
    return EventTrigger.Unknown;
}
const _Timing = class _Timing {
  constructor(aAnimationNode, sTimingAttribute) {
    this.eTimingType = TimingType.Unknown;
    this.nOffset = 0;
    this.sEventBaseElementId = "";
    this.eEventType = EventTrigger.Unknown;
    this.aAnimationNode = aAnimationNode;
    this.sTimingDescription = removeWhiteSpaces(sTimingAttribute);
    this.nOffset = 0;
    this.sEventBaseElementId = "";
  }
  getAnimationNode() {
    return this.aAnimationNode;
  }
  getType() {
    return this.eTimingType;
  }
  getOffset() {
    return this.nOffset;
  }
  getEventBaseElementId() {
    return this.sEventBaseElementId;
  }
  getEventType() {
    return this.eEventType;
  }
  parse() {
    if (!this.sTimingDescription) {
      this.eTimingType = TimingType.Offset;
      return;
    }
    if (this.sTimingDescription == "indefinite")
      this.eTimingType = TimingType.Indefinite;
    else {
      const nFirstCharCode = this.sTimingDescription.charCodeAt(0);
      let bPositiveOffset = !(nFirstCharCode == _Timing.CHARCODE_MINUS);
      if (nFirstCharCode == _Timing.CHARCODE_PLUS || nFirstCharCode == _Timing.CHARCODE_MINUS || nFirstCharCode >= _Timing.CHARCODE_0 && nFirstCharCode <= _Timing.CHARCODE_9) {
        const sClockValue = nFirstCharCode == _Timing.CHARCODE_PLUS || nFirstCharCode == _Timing.CHARCODE_MINUS ? this.sTimingDescription.substring(1) : this.sTimingDescription;
        const TimeInSec = _Timing.parseClockValue(sClockValue);
        if (TimeInSec != void 0) {
          this.eTimingType = TimingType.Offset;
          this.nOffset = bPositiveOffset ? TimeInSec : -TimeInSec;
        }
      } else {
        let aTimingSplit = [];
        bPositiveOffset = true;
        if (this.sTimingDescription.indexOf("+") != -1) {
          aTimingSplit = this.sTimingDescription.split("+");
        } else if (this.sTimingDescription.indexOf("-") != -1) {
          aTimingSplit = this.sTimingDescription.split("-");
          bPositiveOffset = false;
        } else {
          aTimingSplit[0] = this.sTimingDescription;
          aTimingSplit[1] = "";
        }
        if (aTimingSplit[0].indexOf(".") != -1) {
          const aEventSplit = aTimingSplit[0].split(".");
          this.sEventBaseElementId = aEventSplit[0];
          this.eEventType = getEventTriggerType(aEventSplit[1]);
        } else {
          this.eEventType = getEventTriggerType(aTimingSplit[0]);
        }
        if (this.eEventType == EventTrigger.Unknown)
          return;
        if (this.eEventType == EventTrigger.BeginEvent || this.eEventType == EventTrigger.EndEvent) {
          this.eTimingType = TimingType.SyncBase;
        } else {
          this.eTimingType = TimingType.Event;
        }
        if (aTimingSplit[1]) {
          const sClockValue = aTimingSplit[1];
          const TimeInSec = _Timing.parseClockValue(sClockValue);
          if (TimeInSec != void 0) {
            this.nOffset = bPositiveOffset ? TimeInSec : -TimeInSec;
          } else {
            this.eTimingType = TimingType.Unknown;
          }
        }
      }
    }
  }
  static parseClockValue(sClockValue) {
    if (!sClockValue)
      return 0;
    let nTimeInSec = void 0;
    const reFullClockValue = /^([0-9]+):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?$/;
    const rePartialClockValue = /^([0-5][0-9]):([0-5][0-9])(.[0-9]+)?$/;
    const reTimeCountValue = /^([0-9]+)(.[0-9]+)?(h|min|s|ms)?$/;
    if (reFullClockValue.test(sClockValue)) {
      const aClockTimeParts = reFullClockValue.exec(sClockValue);
      const nHours = parseInt(aClockTimeParts[1]);
      const nMinutes = parseInt(aClockTimeParts[2]);
      let nSeconds = parseInt(aClockTimeParts[3]);
      if (aClockTimeParts[4])
        nSeconds += parseFloat(aClockTimeParts[4]);
      nTimeInSec = (nHours * 60 + nMinutes) * 60 + nSeconds;
    } else if (rePartialClockValue.test(sClockValue)) {
      const aClockTimeParts = rePartialClockValue.exec(sClockValue);
      const nMinutes = parseInt(aClockTimeParts[1]);
      let nSeconds = parseInt(aClockTimeParts[2]);
      if (aClockTimeParts[3])
        nSeconds += parseFloat(aClockTimeParts[3]);
      nTimeInSec = nMinutes * 60 + nSeconds;
    } else if (reTimeCountValue.test(sClockValue)) {
      const aClockTimeParts = reTimeCountValue.exec(sClockValue);
      let nTimeCount = parseInt(aClockTimeParts[1]);
      if (aClockTimeParts[2])
        nTimeCount += parseFloat(aClockTimeParts[2]);
      if (aClockTimeParts[3]) {
        if (aClockTimeParts[3] == "h") {
          nTimeInSec = nTimeCount * 3600;
        } else if (aClockTimeParts[3] == "min") {
          nTimeInSec = nTimeCount * 60;
        } else if (aClockTimeParts[3] == "s") {
          nTimeInSec = nTimeCount;
        } else if (aClockTimeParts[3] == "ms") {
          nTimeInSec = nTimeCount / 1e3;
        }
      } else {
        nTimeInSec = nTimeCount;
      }
    }
    if (nTimeInSec)
      nTimeInSec = parseFloat(nTimeInSec.toFixed(3));
    return nTimeInSec;
  }
  info(bVerbose = false) {
    let sInfo = "";
    if (bVerbose) {
      sInfo = "description: " + this.sTimingDescription + ", ";
      sInfo += ", type: " + TimingType[this.getType()];
      sInfo += ", offset: " + this.getOffset();
      sInfo += ", event base element id: " + this.getEventBaseElementId();
      sInfo += ", timing event type: " + EventTrigger[this.getEventType()];
    } else {
      switch (this.getType()) {
        case TimingType.Indefinite:
          sInfo += "indefinite";
          break;
        case TimingType.Offset:
          sInfo += this.getOffset();
          break;
        case TimingType.Event:
        case TimingType.SyncBase:
          if (this.getEventBaseElementId())
            sInfo += this.getEventBaseElementId() + ".";
          sInfo += EventTrigger[this.getEventType()];
          if (this.getOffset()) {
            if (this.getOffset() > 0)
              sInfo += "+";
            sInfo += this.getOffset();
          }
          break;
      }
    }
    return sInfo;
  }
};
_Timing.CHARCODE_PLUS = "+".charCodeAt(0);
_Timing.CHARCODE_MINUS = "-".charCodeAt(0);
_Timing.CHARCODE_0 = "0".charCodeAt(0);
_Timing.CHARCODE_9 = "9".charCodeAt(0);
let Timing = _Timing;
