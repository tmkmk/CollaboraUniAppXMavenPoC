var NodeState;
(function(NodeState2) {
  NodeState2[NodeState2["Invalid"] = 0] = "Invalid";
  NodeState2[NodeState2["Unresolved"] = 1] = "Unresolved";
  NodeState2[NodeState2["Resolved"] = 2] = "Resolved";
  NodeState2[NodeState2["Active"] = 4] = "Active";
  NodeState2[NodeState2["Frozen"] = 8] = "Frozen";
  NodeState2[NodeState2["Ended"] = 16] = "Ended";
})(NodeState || (NodeState = {}));
var FillModes;
(function(FillModes2) {
  FillModes2[FillModes2["Default"] = 0] = "Default";
  FillModes2[FillModes2["Inherit"] = 0] = "Inherit";
  FillModes2[FillModes2["Remove"] = 1] = "Remove";
  FillModes2[FillModes2["Freeze"] = 2] = "Freeze";
  FillModes2[FillModes2["Hold"] = 3] = "Hold";
  FillModes2[FillModes2["Transition"] = 4] = "Transition";
  FillModes2[FillModes2["Auto"] = 5] = "Auto";
})(FillModes || (FillModes = {}));
var RestartMode;
(function(RestartMode2) {
  RestartMode2[RestartMode2["Default"] = 0] = "Default";
  RestartMode2[RestartMode2["Inherit"] = 0] = "Inherit";
  RestartMode2[RestartMode2["Always"] = 1] = "Always";
  RestartMode2[RestartMode2["WhenNotActive"] = 2] = "WhenNotActive";
  RestartMode2[RestartMode2["Never"] = 3] = "Never";
})(RestartMode || (RestartMode = {}));
var ImpressNodeType;
(function(ImpressNodeType2) {
  ImpressNodeType2[ImpressNodeType2["Default"] = 0] = "Default";
  ImpressNodeType2[ImpressNodeType2["OnClick"] = 1] = "OnClick";
  ImpressNodeType2[ImpressNodeType2["WithPrevious"] = 2] = "WithPrevious";
  ImpressNodeType2[ImpressNodeType2["AfterPrevious"] = 3] = "AfterPrevious";
  ImpressNodeType2[ImpressNodeType2["MainSequence"] = 4] = "MainSequence";
  ImpressNodeType2[ImpressNodeType2["TimingRoot"] = 5] = "TimingRoot";
  ImpressNodeType2[ImpressNodeType2["InteractiveSequence"] = 6] = "InteractiveSequence";
})(ImpressNodeType || (ImpressNodeType = {}));
var TransitionMode;
(function(TransitionMode2) {
  TransitionMode2[TransitionMode2["out"] = 0] = "out";
  TransitionMode2[TransitionMode2["in"] = 1] = "in";
})(TransitionMode || (TransitionMode = {}));
var AdditiveMode;
(function(AdditiveMode2) {
  AdditiveMode2[AdditiveMode2["Unknown"] = 0] = "Unknown";
  AdditiveMode2[AdditiveMode2["Base"] = 1] = "Base";
  AdditiveMode2[AdditiveMode2["Replace"] = 2] = "Replace";
  AdditiveMode2[AdditiveMode2["Multiply"] = 3] = "Multiply";
  AdditiveMode2[AdditiveMode2["None"] = 4] = "None";
})(AdditiveMode || (AdditiveMode = {}));
var AccumulateMode;
(function(AccumulateMode2) {
  AccumulateMode2[AccumulateMode2["None"] = 0] = "None";
  AccumulateMode2[AccumulateMode2["Sum"] = 1] = "Sum";
})(AccumulateMode || (AccumulateMode = {}));
var CalcMode;
(function(CalcMode2) {
  CalcMode2[CalcMode2["Discrete"] = 1] = "Discrete";
  CalcMode2[CalcMode2["Linear"] = 2] = "Linear";
  CalcMode2[CalcMode2["Paced"] = 3] = "Paced";
  CalcMode2[CalcMode2["Spline"] = 4] = "Spline";
})(CalcMode || (CalcMode = {}));
function createStateTransitionTable() {
  const aSTT = /* @__PURE__ */ new Map();
  aSTT.set(RestartMode.Never, /* @__PURE__ */ new Map());
  aSTT.set(RestartMode.WhenNotActive, /* @__PURE__ */ new Map());
  aSTT.set(RestartMode.Always, /* @__PURE__ */ new Map());
  const aTable0 = /* @__PURE__ */ new Map([
    [NodeState.Invalid, NodeState.Invalid],
    [NodeState.Unresolved, NodeState.Resolved | NodeState.Ended],
    [NodeState.Resolved, NodeState.Active | NodeState.Ended],
    [NodeState.Active, NodeState.Ended],
    [NodeState.Frozen, NodeState.Invalid],
    [NodeState.Ended, NodeState.Ended]
    // this state is a sink here (cannot restart)
  ]);
  aSTT.get(RestartMode.Never).set(FillModes.Remove, aTable0);
  const aTable1 = /* @__PURE__ */ new Map([
    [NodeState.Invalid, NodeState.Invalid],
    [NodeState.Unresolved, NodeState.Resolved | NodeState.Ended],
    [NodeState.Resolved, NodeState.Active | NodeState.Ended],
    [NodeState.Active, NodeState.Frozen | NodeState.Ended],
    [NodeState.Frozen, NodeState.Ended],
    [NodeState.Ended, NodeState.Ended]
    // this state is a sink here (cannot restart)
  ]);
  aSTT.get(RestartMode.Never).set(FillModes.Freeze, aTable1);
  aSTT.get(RestartMode.Never).set(FillModes.Hold, aTable1);
  aSTT.get(RestartMode.Never).set(FillModes.Transition, aTable1);
  const aTable2 = /* @__PURE__ */ new Map([
    [NodeState.Invalid, NodeState.Invalid],
    [NodeState.Unresolved, NodeState.Resolved | NodeState.Ended],
    [NodeState.Resolved, NodeState.Active | NodeState.Ended],
    [NodeState.Active, NodeState.Ended],
    [NodeState.Frozen, NodeState.Invalid],
    [NodeState.Ended, NodeState.Resolved | NodeState.Active | NodeState.Ended]
    // restart is possible
  ]);
  aSTT.get(RestartMode.WhenNotActive).set(FillModes.Remove, aTable2);
  const aTable3 = /* @__PURE__ */ new Map([
    [NodeState.Invalid, NodeState.Invalid],
    [NodeState.Unresolved, NodeState.Resolved | NodeState.Ended],
    [NodeState.Resolved, NodeState.Active | NodeState.Ended],
    [NodeState.Active, NodeState.Frozen | NodeState.Ended],
    [NodeState.Frozen, NodeState.Resolved | NodeState.Active | NodeState.Ended],
    [NodeState.Ended, NodeState.Resolved | NodeState.Active | NodeState.Ended]
    // restart is possible
  ]);
  aSTT.get(RestartMode.WhenNotActive).set(FillModes.Freeze, aTable3);
  aSTT.get(RestartMode.WhenNotActive).set(FillModes.Hold, aTable3);
  aSTT.get(RestartMode.WhenNotActive).set(FillModes.Transition, aTable3);
  const aTable4 = /* @__PURE__ */ new Map([
    [NodeState.Invalid, NodeState.Invalid],
    [NodeState.Unresolved, NodeState.Resolved | NodeState.Ended],
    [NodeState.Resolved, NodeState.Active | NodeState.Ended],
    [NodeState.Active, NodeState.Resolved | NodeState.Active | NodeState.Ended],
    [NodeState.Frozen, NodeState.Invalid],
    [NodeState.Ended, NodeState.Resolved | NodeState.Active | NodeState.Ended]
    // restart is possible
  ]);
  aSTT.get(RestartMode.Always).set(FillModes.Remove, aTable4);
  const aTable5 = /* @__PURE__ */ new Map([
    [NodeState.Invalid, NodeState.Invalid],
    [NodeState.Unresolved, NodeState.Resolved | NodeState.Ended],
    [NodeState.Resolved, NodeState.Active | NodeState.Ended],
    [
      NodeState.Active,
      NodeState.Resolved | NodeState.Active | NodeState.Frozen | NodeState.Ended
    ],
    [NodeState.Frozen, NodeState.Resolved | NodeState.Active | NodeState.Ended],
    [NodeState.Ended, NodeState.Resolved | NodeState.Active | NodeState.Ended]
    // restart is possible
  ]);
  aSTT.get(RestartMode.Always).set(FillModes.Freeze, aTable5);
  aSTT.get(RestartMode.Always).set(FillModes.Hold, aTable5);
  aSTT.get(RestartMode.Always).set(FillModes.Transition, aTable5);
  return aSTT;
}
const aStateTransitionTable = createStateTransitionTable();
function getTransitionTable(eRestartMode, eFillMode) {
  if (eRestartMode == RestartMode.Default) {
    window.app.console.log("getTransitionTable: unexpected restart mode: " + eRestartMode + ". Used NEVER instead.");
    eRestartMode = RestartMode.Never;
  }
  if (eFillMode == FillModes.Default || eFillMode == FillModes.Auto) {
    eFillMode = FillModes.Remove;
  }
  return aStateTransitionTable.get(eRestartMode).get(eFillMode);
}
class StateTransition {
  constructor(aBaseNode) {
    this.aNode = aBaseNode;
    this.eToState = NodeState.Invalid;
  }
  enter(eNodeState, bForce) {
    if (!bForce)
      bForce = false;
    if (this.eToState != NodeState.Invalid) {
      window.app.console.log("StateTransition.enter: commit() before enter()ing again!");
      return false;
    }
    if (!bForce && !this.aNode.isTransition(this.aNode.getState(), eNodeState))
      return false;
    if ((this.aNode.nCurrentStateTransition & eNodeState) != 0)
      return false;
    this.aNode.nCurrentStateTransition |= eNodeState;
    this.eToState = eNodeState;
    return true;
  }
  commit() {
    if (this.eToState != NodeState.Invalid) {
      this.aNode.setState(this.eToState);
      this.clear();
    }
  }
  clear() {
    if (this.eToState != NodeState.Invalid) {
      this.aNode.nCurrentStateTransition &= ~this.eToState;
      this.eToState = NodeState.Invalid;
    }
  }
}
const _BaseNode = class _BaseNode {
  constructor(aNodeInfo, aParentNode, aNodeContext) {
    this.sClassName = "BaseNode";
    this.bIsFirstAutoEffect = false;
    this.bIsMainSequenceRootNode = false;
    this.bIsInteractiveSequenceRootNode = false;
    this.nId = _BaseNode.getUniqueId();
    if (!aNodeInfo)
      window.app.console.log("BaseNode(id:" + this.nId + ") constructor: aNodeInfo is not valid");
    if (!aNodeContext)
      window.app.console.log("BaseNode(id:" + this.nId + ") constructor: aNodeContext is not valid");
    if (!aNodeContext._context)
      window.app.console.log("BaseNode(id:" + this.nId + ") constructor: aNodeContext.aContext is not valid");
    this.eAnimationNodeType = getAnimationNodeType(aNodeInfo);
    this.bIsContainer = false;
    this.aNodeInfo = aNodeInfo;
    this.aParentNode = aParentNode;
    this.aNodeContext = aNodeContext;
    this._context = aNodeContext._context;
    this.nStartDelay = aNodeContext.nStartDelay;
    this.eCurrentState = NodeState.Unresolved;
    this.nCurrentStateTransition = 0;
    this.aDeactivatingListenerArray = [];
    this.aActivationEvent = null;
    this.aDeactivationEvent = null;
    this.aBegin = null;
    this.aDuration = null;
    this.aEnd = null;
    this.eFillMode = FillModes.Freeze;
    this.eRestartMode = RestartMode.Never;
    this.nRepeatCount = void 0;
    this.nAccelerate = 0;
    this.nDecelerate = 0;
    this.bAutoReverse = false;
  }
  static getUniqueId() {
    ++_BaseNode.CURR_UNIQUE_ID;
    return _BaseNode.CURR_UNIQUE_ID;
  }
  getId() {
    return this.nId;
  }
  parseNodeInfo() {
    if (this.aNodeInfo.id)
      this.aNodeContext.aAnimationNodeMap.set(this.aNodeInfo.id, this);
    this.aBegin = new Timing(this, this.aNodeInfo.begin);
    this.aBegin.parse();
    this.aEnd = null;
    if (this.aNodeInfo.end) {
      this.aEnd = new Timing(this, this.aNodeInfo.end);
      this.aEnd.parse();
    }
    this.aDuration = new Duration(this.aNodeInfo.dur);
    if (!this.aDuration.isSet()) {
      if (this.isContainer())
        this.aDuration = null;
      else
        this.aDuration = new Duration("indefinite");
    }
    if (this.aNodeInfo.fill && this.aNodeInfo.fill in FillModes) {
      const sFill = this.aNodeInfo.fill;
      this.eFillMode = FillModes[sFill];
    } else {
      this.eFillMode = FillModes.Default;
    }
    if (this.aNodeInfo.restart && this.aNodeInfo.restart in RestartMode) {
      const sRestart = this.aNodeInfo.restart;
      this.eRestartMode = RestartMode[sRestart];
    } else {
      this.eRestartMode = RestartMode.Default;
    }
    this.nRepeatCount = 1;
    if (this.aNodeInfo.repeatCount)
      this.nRepeatCount = parseFloat(this.aNodeInfo.repeatCount);
    if (isNaN(this.nRepeatCount) && this.aNodeInfo.repeatCount !== "indefinite")
      this.nRepeatCount = 1;
    this.nAccelerate = 0;
    const sAccelerate = this.aNodeInfo.accelerate;
    if (sAccelerate)
      this.nAccelerate = parseFloat(sAccelerate);
    if (isNaN(this.nAccelerate))
      this.nAccelerate = 0;
    this.nDecelerate = 0;
    const sDecelerate = this.aNodeInfo.decelerate;
    if (sDecelerate)
      this.nDecelerate = parseFloat(sDecelerate);
    if (isNaN(this.nDecelerate))
      this.nDecelerate = 0;
    this.bAutoReverse = false;
    const sAutoReverse = this.aNodeInfo.autoreverse;
    if (sAutoReverse == "true")
      this.bAutoReverse = true;
    if (this.eFillMode === FillModes.Default) {
      if (this.getParentNode())
        this.eFillMode = this.getParentNode().getFillMode();
      else
        this.eFillMode = FillModes.Auto;
    }
    if (this.eFillMode === FillModes.Auto) {
      this.eFillMode = this.aEnd || this.nRepeatCount != 1 || this.aDuration && !this.aDuration.isIndefinite() ? FillModes.Remove : FillModes.Freeze;
    }
    if (this.eRestartMode === RestartMode.Default) {
      if (this.getParentNode())
        this.eRestartMode = this.getParentNode().getRestartMode();
      else
        this.eRestartMode = RestartMode.Always;
    }
    if (this.nAccelerate + this.nDecelerate > 1) {
      this.nAccelerate = 0;
      this.nDecelerate = 0;
    }
    this.aStateTransTable = getTransitionTable(this.getRestartMode(), this.getFillMode());
  }
  getParentNode() {
    return this.aParentNode;
  }
  init() {
    this.DBG(this.callInfo("init"));
    if (!this.checkValidNode())
      return false;
    if (this.aActivationEvent)
      this.aActivationEvent.dispose();
    if (this.aDeactivationEvent)
      this.aDeactivationEvent.dispose();
    this.eCurrentState = NodeState.Unresolved;
    return this.init_st();
  }
  resolve() {
    if (this.aNodeContext.bIsInvalid || !this.checkValidNode())
      return false;
    this.DBG(this.callInfo("resolve"));
    if (this.eCurrentState == NodeState.Resolved)
      window.app.console.log("BaseNode.resolve: already in RESOLVED state");
    const aStateTrans = new StateTransition(this);
    if (aStateTrans.enter(NodeState.Resolved) && this.isTransition(NodeState.Resolved, NodeState.Active) && this.resolve_st()) {
      aStateTrans.commit();
      if (this.aActivationEvent) {
        this.aActivationEvent.charge();
      } else {
        this.aActivationEvent = makeDelay(this.activate.bind(this), this.getBegin().getOffset() + this.nStartDelay);
      }
      registerEvent(this, this.aNodeContext._context.aSlideShowHandler, this.getBegin(), this.aActivationEvent, this.aNodeContext);
      return true;
    }
    return false;
  }
  activate() {
    if (!this.checkValidNode())
      return false;
    if (this.eCurrentState === NodeState.Active)
      window.app.console.log("BaseNode.activate: already in ACTIVE state");
    this.DBG(this.callInfo("activate"), getCurrentSystemTime());
    const aStateTrans = new StateTransition(this);
    if (aStateTrans.enter(NodeState.Active)) {
      this.activate_st();
      aStateTrans.commit();
      if (this.bIsFirstAutoEffect)
        this.aNodeContext._context.aSlideShowHandler.notifyFirstAutoEffectStarted();
      if (!this._context.aEventMultiplexer)
        window.app.console.log("BaseNode.activate: this.aContext.aEventMultiplexer is not valid");
      this._context.aEventMultiplexer.notifyEvent(EventTrigger.BeginEvent, this.getId());
      return true;
    }
    return false;
  }
  deactivate() {
    if (this.inStateOrTransition(NodeState.Ended | NodeState.Frozen) || !this.checkValidNode())
      return;
    if (this.isTransition(this.eCurrentState, NodeState.Frozen)) {
      this.DBG(this.callInfo("deactivate"), getCurrentSystemTime());
      const aStateTrans = new StateTransition(this);
      if (aStateTrans.enter(
        NodeState.Frozen,
        true
        /* FORCE */
      )) {
        this.deactivate_st(NodeState.Frozen);
        aStateTrans.commit();
        this.notifyEndListeners();
        if (this.bIsFirstAutoEffect)
          this.aNodeContext._context.aSlideShowHandler.notifyFirstAutoEffectEnded();
        if (this.aActivationEvent)
          this.aActivationEvent.dispose();
        if (this.aDeactivationEvent)
          this.aDeactivationEvent.dispose();
      }
    } else {
      this.end();
    }
  }
  end() {
    const bIsFrozenOrInTransitionToFrozen = this.inStateOrTransition(NodeState.Frozen);
    if (this.inStateOrTransition(NodeState.Ended) || !this.checkValidNode())
      return;
    if (!this.isTransition(this.eCurrentState, NodeState.Ended))
      window.app.console.log("BaseNode.end: end state not reachable in transition table");
    this.DBG(this.callInfo("end"), getCurrentSystemTime());
    const aStateTrans = new StateTransition(this);
    if (aStateTrans.enter(
      NodeState.Ended,
      true
      /* FORCE */
    )) {
      this.deactivate_st(NodeState.Ended);
      aStateTrans.commit();
      if (!bIsFrozenOrInTransitionToFrozen)
        this.notifyEndListeners();
      if (this.bIsFirstAutoEffect)
        this.aNodeContext._context.aSlideShowHandler.notifyFirstAutoEffectEnded();
      if (this.aActivationEvent)
        this.aActivationEvent.dispose();
      if (this.aDeactivationEvent)
        this.aDeactivationEvent.dispose();
    }
  }
  dispose() {
    if (this.aActivationEvent)
      this.aActivationEvent.dispose();
    if (this.aDeactivationEvent)
      this.aDeactivationEvent.dispose();
    this.aDeactivatingListenerArray = [];
  }
  getState() {
    return this.eCurrentState;
  }
  setState(nodeState) {
    this.eCurrentState = nodeState;
  }
  registerDeactivatingListener(aNotifiee) {
    if (!this.checkValidNode())
      return false;
    if (!aNotifiee) {
      window.app.console.log("BaseNode.registerDeactivatingListener(): invalid notifiee");
      return false;
    }
    this.aDeactivatingListenerArray.push(aNotifiee);
    return true;
  }
  notifyDeactivating(aNotifier) {
    assert(aNotifier.getState() === NodeState.Frozen || aNotifier.getState() === NodeState.Ended, "BaseNode.notifyDeactivating: Notifier node is neither in FROZEN nor in ENDED state");
  }
  isContainer() {
    return this.bIsContainer;
  }
  getPresetLabel() {
    return this.aNodeInfo.presetLabel;
  }
  getTargetAnimatedElement() {
    return null;
  }
  isMainSequenceRootNode() {
    return this.bIsMainSequenceRootNode;
  }
  isInteractiveSequenceRootNode() {
    return this.bIsInteractiveSequenceRootNode;
  }
  makeDeactivationEvent(nDelay) {
    if (this.aDeactivationEvent) {
      this.aDeactivationEvent.charge();
    } else if (typeof nDelay == "number") {
      this.aDeactivationEvent = makeDelay(this.deactivate.bind(this), nDelay);
    } else {
      this.aDeactivationEvent = null;
    }
    return this.aDeactivationEvent;
  }
  scheduleDeactivationEvent(aEvent) {
    this.DBG(this.callInfo("scheduleDeactivationEvent"));
    if (!aEvent) {
      if (this.getDuration() && this.getDuration().isValue())
        aEvent = this.makeDeactivationEvent(this.getDuration().getValue());
    }
    if (aEvent) {
      this._context.aTimerEventQueue.addEvent(aEvent);
    }
  }
  checkValidNode() {
    return this.eCurrentState !== NodeState.Invalid;
  }
  init_st() {
    return true;
  }
  resolve_st() {
    return true;
  }
  activate_st() {
    this.scheduleDeactivationEvent();
  }
  deactivate_st(aNodeState) {
  }
  notifyEndListeners() {
    const nDeactivatingListenerCount = this.aDeactivatingListenerArray.length;
    for (let i = 0; i < nDeactivatingListenerCount; ++i) {
      this.aDeactivatingListenerArray[i].notifyDeactivating(this);
    }
    this._context.aEventMultiplexer.notifyEvent(EventTrigger.EndEvent, this.getId());
    if (this.getParentNode() && this.getParentNode().isMainSequenceRootNode())
      this._context.aEventMultiplexer.notifyNextEffectEndEvent();
    if (this.isMainSequenceRootNode())
      this._context.aEventMultiplexer.notifyAnimationsEndEvent();
  }
  getContext() {
    return this._context;
  }
  isTransition(eFromState, eToState) {
    return (this.aStateTransTable.get(eFromState) & eToState) !== 0;
  }
  inStateOrTransition(nMask) {
    return (this.eCurrentState & nMask) != 0 || (this.nCurrentStateTransition & nMask) != 0;
  }
  getBegin() {
    return this.aBegin;
  }
  getEnd() {
    return this.aEnd;
  }
  getDuration() {
    return this.aDuration;
  }
  getFillMode() {
    return this.eFillMode;
  }
  getRestartMode() {
    return this.eRestartMode;
  }
  getRepeatCount() {
    return this.nRepeatCount;
  }
  getAccelerateValue() {
    return this.nAccelerate;
  }
  getDecelerateValue() {
    return this.nDecelerate;
  }
  isAutoReverseEnabled() {
    return this.bAutoReverse;
  }
  info(bVerbose = false) {
    let sInfo = `${this.sClassName}(${this.aNodeInfo.nodeName}, ${this.getId()}, ${NodeState[this.getState()]})`;
    if (bVerbose) {
      sInfo += ";  is container: " + this.isContainer();
      if (this.getBegin()) {
        if (this.getBegin().getEventType() === EventTrigger.OnNext)
          sInfo += ";  \x1B[31mbegin: " + this.getBegin().info() + "\x1B[m";
        else
          sInfo += ";  begin: " + this.getBegin().info();
      }
      if (this.getDuration())
        sInfo += ";  dur: " + this.getDuration().info();
      if (this.getEnd())
        sInfo += ";  end: " + this.getEnd().info();
      if (this.getFillMode())
        sInfo += ";  fill: " + FillModes[this.getFillMode()];
      if (this.getRestartMode())
        sInfo += ";  restart: " + RestartMode[this.getRestartMode()];
      if (this.getRepeatCount() && this.getRepeatCount() != 1)
        sInfo += ";  repeatCount: " + this.getRepeatCount();
      if (this.aNodeInfo.presetId)
        sInfo += `; \x1B[31mpresetId: ${this.aNodeInfo.presetId}\x1B[m`;
      if (this.aNodeInfo.presetSubType)
        sInfo += `; presetSubType: ${this.aNodeInfo.presetSubType}`;
      if (this.getAccelerateValue())
        sInfo += ";  accelerate: " + this.getAccelerateValue();
      if (this.getDecelerateValue())
        sInfo += ";  decelerate: " + this.getDecelerateValue();
      if (this.isAutoReverseEnabled())
        sInfo += ";  autoReverse: true";
    }
    return sInfo;
  }
  callInfo(sMethodName) {
    const sInfo = this.sClassName + "( " + this.getId() + ", " + NodeState[this.getState()] + " )." + sMethodName;
    return sInfo;
  }
  DBG(sMessage, nTime) {
    ANIMDBG.print(sMessage, nTime);
  }
};
_BaseNode.CURR_UNIQUE_ID = 0;
let BaseNode = _BaseNode;
