const _OnboardingTourController = class _OnboardingTourController {
  constructor() {
    this.steps = [];
    this.stepIndex = 0;
    this.highlighted = null;
    this.uiReady = false;
    this.startTask = null;
    this.arrowKeysTask = null;
  }
  isRunning() {
    return this.steps.length > 0;
  }
  // The id of the step on screen, or null when no tour is running.
  currentStepId() {
    return this.isRunning() ? this.steps[this.stepIndex].id : null;
  }
  // The document is on screen and sidebar initialization has finished, whether or not the
  // sidebar was requested.
  onSidebarSettled() {
    this.uiReady = true;
    this.maybeAutoStart();
  }
  // Opens the tour whatever the stored preference says, so that the user can ask for it again
  // once it has been seen. The tour exists on the desktop layout only.
  start() {
    if (!window.mode.isDesktop())
      return;
    if (this.isRunning() && !this.isPopupOpen())
      this.reset();
    if (this.isRunning())
      return;
    const steps = this.collectSteps();
    if (!steps.length)
      return;
    app.map.uiManager.setDocTypePref("onboardingTourSeen", true);
    this.steps = steps;
    this.showStep(0);
  }
  // Closes the tour from any step and takes the highlight away. The focus goes back to the
  // document.
  end() {
    if (this.startTask !== null) {
      app.layoutingService.cancelLayoutingTask(this.startTask);
      this.startTask = null;
    }
    this.cancelArrowKeysTask();
    if (!this.isRunning())
      return;
    this.reset();
    app.map.uiManager.closeModal(_OnboardingTourController.popupId());
  }
  next() {
    if (!this.isRunning())
      return;
    if (this.stepIndex + 1 >= this.steps.length)
      this.end();
    else
      this.showStep(this.stepIndex + 1);
  }
  back() {
    if (!this.isRunning() || this.stepIndex === 0)
      return;
    this.showStep(this.stepIndex - 1);
  }
  static popupId() {
    return JSDialog.generateModalId(_OnboardingTourController.modalId);
  }
  isPopupOpen() {
    const jsdialog = app.map.jsdialog;
    return !!jsdialog && !!jsdialog.dialogs[_OnboardingTourController.popupId()];
  }
  reset() {
    this.steps = [];
    this.stepIndex = 0;
    this.setHighlight(null);
  }
  maybeAutoStart() {
    if (!this.uiReady || this.isRunning() || this.startTask !== null)
      return;
    if (!window.mode.isDesktop())
      return;
    if (app.isReadOnly())
      return;
    if (app.map.uiManager.getBooleanDocTypePref("onboardingTourSeen", false))
      return;
    this.startTask = app.layoutingService.appendLayoutingTask(() => {
      this.startTask = null;
      this.startUnlessWelcomeIsOpen();
    });
  }
  // The welcome dialog explains the release and the tour explains the screen, so the tour
  // waits until the welcome has been closed.
  startUnlessWelcomeIsOpen() {
    const welcome = app.map.welcome;
    if (welcome && welcome.isOpen()) {
      app.map.once("welcomeclosed", () => this.maybeAutoStart());
      return;
    }
    this.start();
  }
  showStep(index) {
    this.stepIndex = index;
    const step = this.steps[index];
    if (step.beforeShow)
      step.beforeShow();
    const target = _OnboardingTourController.resolveTarget(step);
    this.setHighlight(target);
    const uiManager = app.map.uiManager;
    uiManager.closeModal(_OnboardingTourController.popupId(), true);
    const json = uiManager._modalDialogJSON(_OnboardingTourController.modalId, step.title, false, this.buildWidgets(index), "onboarding-next-button");
    if (target) {
      json.popupParent = target;
      json.popupAnchor = step.anchor || "";
      json.fitContent = true;
    }
    uiManager.showModal(json, [
      { id: "onboarding-skip", type: "click", func: () => this.end() },
      { id: "onboarding-back", type: "click", func: () => this.back() },
      { id: "onboarding-next", type: "click", func: () => this.next() },
      // The popup closed by Escape or by the close button of its title bar.
      { id: "__POPOVER__", type: "close", func: () => this.end() }
    ]);
    this.cancelArrowKeysTask();
    this.arrowKeysTask = app.layoutingService.appendLayoutingTask(() => {
      this.arrowKeysTask = null;
      this.addArrowKeys();
    });
  }
  cancelArrowKeysTask() {
    if (this.arrowKeysTask === null)
      return;
    app.layoutingService.cancelLayoutingTask(this.arrowKeysTask);
    this.arrowKeysTask = null;
  }
  // The arrow keys move between the steps while the card has the focus. The listener is on the
  // popup window, so it goes away with the popup.
  addArrowKeys() {
    const popup = document.getElementById(_OnboardingTourController.popupId());
    if (!popup)
      return;
    popup.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.back();
      }
    });
  }
  // The text, the progress and the buttons of the card for the step at index.
  buildWidgets(index) {
    const step = this.steps[index];
    const isLast = index + 1 === this.steps.length;
    const text = {
      id: "onboarding-text",
      type: "fixedtext",
      text: step.text
    };
    const progress = {
      id: "onboarding-progress",
      type: "progressdots",
      count: this.steps.length,
      current: index
    };
    const skip = {
      id: "onboarding-skip",
      type: "pushbutton",
      text: _("Skip")
    };
    const back = {
      id: "onboarding-back",
      type: "pushbutton",
      text: _("Back"),
      enabled: index > 0
    };
    const next = {
      id: "onboarding-next",
      type: "pushbutton",
      text: isLast ? _("Done") : _("Next"),
      has_default: true
    };
    const buttons = {
      id: "onboarding-buttons",
      type: "buttonbox",
      layoutstyle: "end",
      children: [skip, back, next]
    };
    const footer = {
      id: "onboarding-footer",
      type: "container",
      vertical: false,
      children: [progress, buttons]
    };
    return [text, footer];
  }
  // Moves the highlight to the given element, or removes it when the element is null.
  setHighlight(element) {
    if (this.highlighted)
      this.highlighted.classList.remove("onboarding-highlight");
    this.highlighted = element;
    if (element)
      element.classList.add("onboarding-highlight");
  }
  // The steps that suit this document type and user interface mode and whose element is on
  // screen. A step whose element is missing is left out. The choice is made once, when the
  // tour starts.
  collectSteps() {
    const docType = app.map.getDocType();
    const uiMode = app.map.uiManager.getCurrentMode();
    return getOnboardingSteps().filter((step) => {
      if (step.docTypes && step.docTypes.indexOf(docType) === -1)
        return false;
      if (step.uiModes && step.uiModes.indexOf(uiMode) === -1)
        return false;
      if (step.isAvailable && !step.isAvailable())
        return false;
      if (!step.target)
        return true;
      return _OnboardingTourController.resolveTarget(step) !== null;
    });
  }
  // Returns the element a step points at, or null when the step speaks about the document as
  // a whole or the element is not on screen in this view.
  static resolveTarget(step) {
    if (!step.target)
      return null;
    const element = typeof step.target === "string" ? document.querySelector(step.target) : step.target();
    if (!(element instanceof HTMLElement))
      return null;
    if (!_OnboardingTourController.isOnScreen(element))
      return null;
    return element;
  }
  // Whether the element takes up room on screen. The size comes from the layout box, which an
  // element that is sliding into place already has in full.
  static isOnScreen(element) {
    return element.offsetWidth > 0 && element.offsetHeight > 0;
  }
  // The first of these selectors that finds an element on screen. It lets a step name several
  // places the same thing can live in.
  static firstOnScreen(selectors) {
    for (let i = 0; i < selectors.length; i++) {
      const element = document.querySelector(selectors[i]);
      if (element instanceof HTMLElement && _OnboardingTourController.isOnScreen(element))
        return element;
    }
    return null;
  }
};
_OnboardingTourController.modalId = "onboarding-tour";
let OnboardingTourController = _OnboardingTourController;
