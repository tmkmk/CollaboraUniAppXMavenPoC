const _EventBase = class _EventBase {
  constructor() {
    this.nId = _EventBase.getUniqueId();
  }
  static getUniqueId() {
    ++_EventBase.CURR_UNIQUE_ID;
    return _EventBase.CURR_UNIQUE_ID;
  }
  getId() {
    return this.nId;
  }
};
_EventBase.CURR_UNIQUE_ID = 0;
let EventBase = _EventBase;
class DelayEvent extends EventBase {
  constructor(aFunctor, nTimeout) {
    super();
    this.bWasFired = false;
    this.aFunctor = aFunctor;
    this.nTimeout = nTimeout;
  }
  fire() {
    assert(this.isCharged(), "DelayEvent.fire: assertion isCharged failed");
    this.bWasFired = true;
    this.aFunctor();
    return true;
  }
  isCharged() {
    return !this.bWasFired;
  }
  getActivationTime(nCurrentTime) {
    return this.nTimeout + nCurrentTime;
  }
  dispose() {
    if (this.isCharged())
      this.bWasFired = true;
  }
  charge() {
    if (!this.isCharged())
      this.bWasFired = false;
  }
}
class WakeupEvent extends EventBase {
  constructor(aTimer, aActivityQueue) {
    super();
    this.nNextTime = 0;
    this.aActivity = null;
    this.aTimer = new ElapsedTime(aTimer);
    this.aActivityQueue = aActivityQueue;
  }
  clone() {
    const aWakeupEvent = new WakeupEvent(this.aTimer.getTimeBase(), this.aActivityQueue);
    aWakeupEvent.nNextTime = this.nNextTime;
    aWakeupEvent.aActivity = this.aActivity;
    return aWakeupEvent;
  }
  dispose() {
    this.aActivity = null;
  }
  fire() {
    if (!this.aActivity)
      return false;
    return this.aActivityQueue.addActivity(this.aActivity);
  }
  isCharged() {
    return true;
  }
  getActivationTime(nCurrentTime) {
    const nElapsedTime = this.aTimer.getElapsedTime();
    return Math.max(nCurrentTime, nCurrentTime - nElapsedTime + this.nNextTime);
  }
  start() {
    this.aTimer.reset();
  }
  setNextTimeout(nNextTime) {
    this.nNextTime = nNextTime;
  }
  setActivity(aActivity) {
    this.aActivity = aActivity;
  }
}
function makeEvent(aFunctor) {
  return new DelayEvent(aFunctor, 0);
}
function makeDelay(aFunctor, nTimeout) {
  return new DelayEvent(aFunctor, nTimeout);
}
function registerEvent(aAnimationNode, aSlideShow, aTiming, aEvent, aNodeContext) {
  const nNodeId = aAnimationNode.getId();
  const aSlideShowContext = aNodeContext._context;
  const eTimingType = aTiming.getType();
  aRegisterEventDebugPrinter.print("registerEvent( node id: " + nNodeId + ", timing: " + aTiming.info() + " )");
  if (eTimingType == TimingType.Offset) {
    aSlideShowContext.aTimerEventQueue.addEvent(aEvent);
  } else if (aNodeContext.bFirstRun) {
    const aEventMultiplexer = aSlideShowContext.aEventMultiplexer;
    if (!aEventMultiplexer) {
      window.app.console.log("registerEvent: event multiplexer not initialized");
      return;
    }
    const aNextEffectEventArray = aSlideShowContext.aNextEffectEventArray;
    if (!aNextEffectEventArray) {
      window.app.console.log("registerEvent: next effect event array not initialized");
      return;
    }
    const aInteractiveAnimationSequenceMap = aSlideShowContext.aInteractiveAnimationSequenceMap;
    if (!aInteractiveAnimationSequenceMap) {
      window.app.console.log("registerEvent: interactive animation sequence map not initialized");
      return;
    }
    switch (eTimingType) {
      case TimingType.Event:
        {
          const eEventType = aTiming.getEventType();
          const sEventBaseElemId = aTiming.getEventBaseElementId();
          if (sEventBaseElemId) {
            const aSourceEventElement = aNodeContext.makeSourceEventElement(sEventBaseElemId, aSlideShow);
            if (!aInteractiveAnimationSequenceMap.has(nNodeId)) {
              aInteractiveAnimationSequenceMap.set(nNodeId, new InteractiveAnimationSequence(nNodeId, aSlideShow));
            }
            let bEventRegistered = false;
            switch (eEventType) {
              case EventTrigger.OnClick:
                aEventMultiplexer.registerEvent(eEventType, aSourceEventElement.getId(), aEvent);
                aEventMultiplexer.registerRewindedEffectHandler(aSourceEventElement.getId(), aSourceEventElement.charge.bind(aSourceEventElement));
                bEventRegistered = true;
                break;
              default:
                window.app.console.log("generateEvent: not handled event type: " + eEventType);
            }
            if (bEventRegistered) {
              const aStartEvent = aInteractiveAnimationSequenceMap.get(nNodeId).getStartEvent();
              const aEndEvent = aInteractiveAnimationSequenceMap.get(nNodeId).getEndEvent();
              aEventMultiplexer.registerEvent(eEventType, aSourceEventElement.getId(), aStartEvent);
              aEventMultiplexer.registerEvent(EventTrigger.EndEvent, nNodeId, aEndEvent);
              aEventMultiplexer.registerRewindedEffectHandler(nNodeId, aInteractiveAnimationSequenceMap.get(nNodeId).chargeEvents.bind(aInteractiveAnimationSequenceMap.get(nNodeId)));
            }
          } else {
            switch (eEventType) {
              case EventTrigger.OnNext:
                aNextEffectEventArray.appendEvent(aEvent, aAnimationNode);
                break;
              default:
                window.app.console.log("registerEvent: not handled event type: " + eEventType);
            }
          }
        }
        break;
      case TimingType.SyncBase:
        {
          const eEventType = aTiming.getEventType();
          const sEventBaseElemId = aTiming.getEventBaseElementId();
          if (sEventBaseElemId) {
            const aAnimationNode2 = aNodeContext.aAnimationNodeMap.get(sEventBaseElemId);
            if (!aAnimationNode2) {
              window.app.console.log("registerEvent: TimingType.SyncBase: event base element not found: " + sEventBaseElemId);
              return;
            }
            aEventMultiplexer.registerEvent(eEventType, aAnimationNode2.getId(), aEvent);
          } else {
            window.app.console.log("registerEvent: TimingType.SyncBase: event base element not specified");
          }
        }
        break;
      default:
        window.app.console.log("registerEvent: not handled timing type: " + eTimingType);
    }
  }
}
