const _A11yValidatorException = class _A11yValidatorException extends Error {
  constructor(message) {
    super(message);
    this.name = _A11yValidatorException.PREFIX;
    Object.setPrototypeOf(this, _A11yValidatorException.prototype);
  }
};
_A11yValidatorException.PREFIX = "A11yValidatorException";
let A11yValidatorException = _A11yValidatorException;
const _A11yValidator = class _A11yValidator {
  constructor() {
    this.checks = [];
    this._directlyValidatedElements = null;
    this.setupChecks();
  }
  setupChecks() {
    this.checks.push(this.checkNativeButtonElement.bind(this));
    this.checks.push(this.checkImageAltAttribute.bind(this));
    this.checks.push(this.checkLabelElement.bind(this));
    this.checks.push(this.checkElementHasLabel.bind(this));
    this.checks.push(this.checkAriaControls.bind(this));
    this.checks.push(this.checkFrameOnlyDecorativeImages.bind(this));
    this.checks.push(this.checkNoSpatialReferences.bind(this));
  }
  findSpatialMatch(text) {
    var _a, _b;
    if (!text)
      return null;
    const re = _A11yValidator.SPATIAL_RE;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const before = (_a = text.slice(0, m.index).match(/(\w+)\W*$/)) == null ? void 0 : _a[1];
      const after = (_b = text.slice(m.index + m[0].length).match(/^\W*(\w+)/)) == null ? void 0 : _b[1];
      const neighbours = [before, after].filter((w) => !!w).map((w) => w.toLowerCase());
      if (!neighbours.some((w) => _A11yValidator.CONTENT_NOUNS.has(w)))
        return m[0];
    }
    return null;
  }
  checkNoSpatialReferences(type, element) {
    const sources = [
      ["aria-label", element.getAttribute("aria-label")],
      ["aria-description", element.getAttribute("aria-description")],
      ["alt", element.tagName === "IMG" ? element.getAttribute("alt") : null]
    ];
    const describedBy = element.getAttribute("aria-describedby") || "";
    for (const id of describedBy.trim().split(/\s+/).filter(Boolean)) {
      const ref = document.getElementById(id);
      if (!ref)
        continue;
      sources.push([
        `aria-describedby="${id}"`,
        (ref.textContent || "").trim()
      ]);
    }
    for (const [source, text] of sources) {
      const match = this.findSpatialMatch(text);
      if (match)
        throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': widget of type '${type}' has spatial reference '${match}' in ${source} ('${text.trim()}'). Spatial words like "above"/"below" are useless to screen-reader users; refer to widgets by name instead.`);
    }
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i];
      if (this.shouldCheckChild(child))
        this.checkNoSpatialReferences(type, child);
    }
  }
  checkWidget(type, element) {
    for (const check of this.checks) {
      try {
        check(type, element);
      } catch (error) {
        if (error instanceof A11yValidatorException)
          console.error(error);
        throw error;
      }
    }
  }
  checkNativeButtonElement(type, element) {
    if (element.tagName !== "BUTTON" && element.getAttribute("role") === "button") {
      throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': widget of type '${type}' has ${element.tagName} element with role="button". It should use native <button> element instead.`);
    }
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i];
      if (this.shouldCheckChild(child)) {
        this.checkNativeButtonElement(type, child);
      }
    }
  }
  /// The widget an image belongs to, which is the nearest one the walk
  /// validates on its own.
  owningWidget(image) {
    var _a;
    let at = image.parentElement;
    while (at) {
      if ((_a = this._directlyValidatedElements) == null ? void 0 : _a.has(at))
        return at;
      at = at.parentElement;
    }
    return null;
  }
  checkImageAltAttribute(type, element) {
    const images = element.querySelectorAll("img");
    images.forEach((img, index) => {
      const owner = this.owningWidget(img);
      if (owner && owner !== element)
        return;
      const hasAlt = img.hasAttribute("alt");
      const altValue = img.getAttribute("alt");
      if (!this.isVisible(img))
        return;
      if (!hasAlt) {
        throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': image in widget of type '${type}' is missing alt attribute`);
      }
      const parent = img.parentElement;
      const span = parent && parent.querySelector("span.unolabel, span.ui-iconview-entry-title");
      const explicitLabel = span && span.innerText.trim().length > 0;
      const visibleLabel = parent && document.querySelector(`label[for="${parent.id}"]`);
      const parentHasLabel = parent && (parent.hasAttribute("aria-label") || parent.hasAttribute("aria-labelledby") || visibleLabel || explicitLabel);
      const isFocusable = img.tabIndex === 0;
      if (altValue === "" && parent) {
        const isDecorativeImg = img.classList.contains("ui-decorative-image");
        if (isFocusable) {
          throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': focusable image in widget of type '${type}' has empty alt attribute (screen readers need alt text for focusable images) or make it decorative by removing tabIndex`);
        }
        if (!parentHasLabel && !isDecorativeImg) {
          throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': image in widget of type '${type}' has empty alt attribute but parent element lacks label`);
        }
      }
      if (altValue !== "" && parentHasLabel && !isFocusable) {
        throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(img)}': image in widget of type '${type}' has non-empty alt attribute but parent element also has label (should not duplicate)`);
      }
    });
  }
  checkElementHasLabel(type, element) {
    if (element.hasAttribute("aria-labelledby")) {
      const labelledbyValue = element.getAttribute("aria-labelledby");
      const labelledbyIds = labelledbyValue.trim().split(/\s+/);
      for (const labelledbyId of labelledbyIds) {
        const referencedElement = document.getElementById(labelledbyId);
        if (!referencedElement) {
          throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': element in widget of type '${type}' has aria-labelledby attribute pointing to non-existing element with id: '${labelledbyId}'`);
        }
        if (labelledbyIds.length === 1) {
          const labelHasHtmlFor = referencedElement.tagName === "LABEL" && referencedElement.htmlFor;
          const htmlForPointsToThisElement = labelHasHtmlFor && referencedElement.htmlFor === element.id;
          const isHiddenLabel = !this.isVisible(referencedElement);
          if (htmlForPointsToThisElement && !isHiddenLabel) {
            throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': element in widget of type '${type}' has aria-labelledby attribute pointing to label element with id: '${labelledbyId}', but that label also has htmlFor attribute pointing to this element. Should not duplicate labelling.`);
          }
        }
      }
    } else {
      const visibleLabel = document.querySelector(`label[for="${element.id}"]`);
      if (!visibleLabel) {
        const ariaLabel = element.getAttribute("aria-label") ?? "";
        const hasAriaLabel = ariaLabel.trim() !== "";
        if (JSDialog.GetFormControlTypesInBrowser().has(element.tagName) && !hasAriaLabel) {
          throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': element in widget of type '${type}' is missing label: it should have either <label>, aria-labelledby or aria-label attribute.`);
        }
      }
    }
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i];
      if (this.shouldCheckChild(child)) {
        this.checkElementHasLabel(type, child);
      }
    }
  }
  checkLabelElement(type, element) {
    var _a;
    if (element.tagName === "LABEL") {
      const htmlFor = (_a = element.htmlFor) == null ? void 0 : _a.trim();
      if (htmlFor) {
        const referencedElement = document.getElementById(htmlFor);
        if (!referencedElement) {
          throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': label element in widget of type '${type}' has htmlFor attribute pointing to non-existing element with id '${htmlFor}'`);
        } else if (!JSDialog.GetFormControlTypesInBrowser().has(referencedElement.tagName)) {
          throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': label element in widget of type '${type}' references non-labelable element <${referencedElement.tagName.toLowerCase()}> via htmlFor attribute. Try using aria-labelledby on the referenced element instead.`);
        } else if (referencedElement.hasAttribute("aria-labelledby") || referencedElement.hasAttribute("aria-label")) {
          const ariaLabelledBy = referencedElement.getAttribute("aria-labelledby");
          const isMultiLabel = ariaLabelledBy && ariaLabelledBy.trim().split(/\s+/).length > 1;
          const isHiddenLabel = !this.isVisible(element);
          if (!isMultiLabel && !isHiddenLabel) {
            throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': label element in widget of type '${type}' is associated with element with id: '${htmlFor}' via htmlFor, but that element also has aria-label or aria-labelledby attribute. Should not duplicate labelling.`);
          }
        }
      } else {
        const referencedElement = document.querySelector(`[aria-labelledby~="${element.id}"]`);
        if (!referencedElement) {
          throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': label element in widget of type '${type}' is not associated with any element via htmlFor or aria-labelledby. Should this element really be a label? If it just represent static text then try converting it into a <span> element instead.`);
        }
      }
    }
  }
  // TODO: there are some elements on which aria-controls only added
  // when the relevant element exist in DOM. Need to handle that case as well.
  checkAriaControls(type, element) {
    const controlledElementId = element.getAttribute("aria-controls") || "";
    if (controlledElementId.trim() !== "") {
      const referencedElement = document.getElementById(controlledElementId);
      if (!referencedElement) {
        throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': element is widget of type '${type}' has aria-control attribute but mentioned element does not exist in DOM. Only add this attribute when mentioned element exist in DOM.`);
      }
    }
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i];
      if (this.shouldCheckChild(child)) {
        this.checkAriaControls(type, child);
      }
    }
  }
  checkFrameOnlyDecorativeImages(type, element) {
    if (!element.classList.contains("ui-frame-container") || !element.classList.contains("ui-fieldset")) {
      return;
    }
    const content = element.querySelector(".ui-expander-content");
    if (!content)
      return;
    const decorativeImages = content.querySelectorAll("img.ui-decorative-image");
    if (decorativeImages.length === 0)
      return;
    if (content.querySelector(JSDialog.FocusableSelector))
      return;
    const formControlTags = JSDialog.GetFormControlTypesInBrowser();
    for (const tag of formControlTags) {
      if (content.querySelector(tag))
        return;
    }
    throw new A11yValidatorException(`In '${this.getDialogTitle(element)}' at '${this.getElementPath(element)}': frame '${type}' contains only decorative images with no accessible content. Remove the frame so its label does not mislead users into expecting meaningful content.`);
  }
  checkInitialFocusNotCloseButton(dialogElement) {
    const active = document.activeElement;
    if (!active || !dialogElement.contains(active))
      return 0;
    if (active.classList.contains("ui-dialog-titlebar-close")) {
      console.error(new A11yValidatorException(`In '${this.getDialogTitle(active)}': initial keyboard focus is on the close (X) button in the titlebar. Focus should be on a control inside the dialog body.`));
      return 1;
    }
    return 0;
  }
  checkVisibleLabelsForFormControls(container) {
    const elements = container.querySelectorAll("input, select");
    const excludedInputTypes = /* @__PURE__ */ new Set([
      "hidden",
      "button",
      "submit",
      "reset",
      "image"
    ]);
    let errorCount = 0;
    elements.forEach((el) => {
      var _a;
      const htmlEl = el;
      if (!this.isVisible(htmlEl))
        return;
      if (el.tagName === "INPUT") {
        const inputType = (_a = el.type) == null ? void 0 : _a.toLowerCase();
        if (excludedInputTypes.has(inputType))
          return;
      }
      const labelEls = [];
      const labelFor = document.querySelector(`label[for="${htmlEl.id}"]`);
      if (labelFor instanceof HTMLElement)
        labelEls.push(labelFor);
      const labelledBy = htmlEl.getAttribute("aria-labelledby");
      if (labelledBy) {
        for (const id of labelledBy.trim().split(/\s+/)) {
          const target = document.getElementById(id);
          if (target)
            labelEls.push(target);
        }
      }
      const hasVisibleLabel = labelEls.some((label) => this.isVisible(label));
      if (!hasVisibleLabel) {
        console.error(new A11yValidatorException(`In sidebar at '${this.getElementPath(htmlEl)}': ${el.tagName.toLowerCase()} element '${htmlEl.id}' is missing a visible label. Sidebar form controls should have a <label> or aria-labelledby association, not just aria-label.`));
        errorCount++;
      }
    });
    return errorCount;
  }
  getAssociatedLabelElements(element) {
    const labelEls = [];
    const labelFor = document.querySelector(`label[for="${element.id}"]`);
    if (labelFor instanceof HTMLElement)
      labelEls.push(labelFor);
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.trim().split(/\s+/)) {
        const target = document.getElementById(id);
        if (target)
          labelEls.push(target);
      }
    }
    return labelEls;
  }
  // A hidden label keeps its association, so the association alone is not enough.
  hasVisibleAssociatedLabel(element) {
    return this.getAssociatedLabelElements(element).some((label) => this.isVisible(label));
  }
  // One caption can serve a row of fields: each carries its own name for a
  // screen reader while the group's caption is what the eye reads.
  groupCaptionIsVisible(element, container) {
    let group = element.closest(_A11yValidator.GroupSelector);
    while (group instanceof HTMLElement && container.contains(group)) {
      const id = group.getAttribute("aria-labelledby");
      const caption = id ? container.querySelector(`[id="${id}"]`) : group.querySelector(":scope > legend");
      if (caption instanceof HTMLElement && this.isVisible(caption))
        return true;
      group = group.parentElement ? group.parentElement.closest(_A11yValidator.GroupSelector) : null;
    }
    return false;
  }
  hasOwnAccessibleName(element) {
    var _a;
    return this.getAssociatedLabelElements(element).length > 0 || !!((_a = element.getAttribute("aria-label")) == null ? void 0 : _a.trim());
  }
  // An aria-label or tooltip leaves a sighted user with no label on screen.
  checkSpinButtonsHaveVisibleLabel(container) {
    const spinButtons = container.querySelectorAll('input[role="spinbutton"]');
    let errorCount = 0;
    spinButtons.forEach((el) => {
      const htmlEl = el;
      if (!this.isVisible(htmlEl))
        return;
      if (this.hasVisibleAssociatedLabel(htmlEl))
        return;
      if (this.hasOwnAccessibleName(htmlEl) && this.groupCaptionIsVisible(htmlEl, container))
        return;
      console.error(new A11yValidatorException(`In '${this.getDialogTitle(htmlEl)}' at '${this.getElementPath(htmlEl)}': spinbutton '${htmlEl.id}' is missing a visible label. A spinbutton needs a visible on-screen <label>, a visible element named by aria-labelledby, or a name of its own inside a group whose caption is visible; an aria-label or tooltip alone is not enough for a sighted user.`));
      errorCount++;
    });
    return errorCount;
  }
  checkDuplicateButtonLabels(container) {
    const buttons = container.querySelectorAll("button[aria-labelledby]");
    const labelMap = /* @__PURE__ */ new Map();
    buttons.forEach((btn) => {
      var _a, _b;
      const labelledBy = (_a = btn.getAttribute("aria-labelledby")) == null ? void 0 : _a.trim();
      if (!labelledBy)
        return;
      if (!this.isVisible(btn))
        return;
      if (!labelMap.has(labelledBy)) {
        labelMap.set(labelledBy, []);
      }
      (_b = labelMap.get(labelledBy)) == null ? void 0 : _b.push(btn);
    });
    let errorCount = 0;
    for (const [labelId, btns] of labelMap) {
      if (btns.length > 1) {
        const ids = btns.map((b) => b.id || "(no id)").join(", ");
        console.error(new A11yValidatorException(`In '${this.getDialogTitle(container)}': buttons [${ids}] share the same aria-labelledby="${labelId}". Each button must have a distinct accessible name to clearly convey its function.`));
        errorCount++;
      }
    }
    return errorCount;
  }
  shouldCheckChild(child) {
    var _a;
    return child instanceof HTMLElement && !((_a = this._directlyValidatedElements) == null ? void 0 : _a.has(child));
  }
  isVisible(element) {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden")
      return false;
    return element.getClientRects().length > 0;
  }
  getDialogTitle(element) {
    var _a;
    const dialog = element.closest(".ui-dialog");
    if (!dialog)
      return "unknown dialog";
    const title = dialog.querySelector("h2.ui-dialog-title");
    return ((_a = title == null ? void 0 : title.textContent) == null ? void 0 : _a.trim()) || "untitled dialog";
  }
  getElementPath(element) {
    const ids = [];
    let current = element;
    const dialog = element.closest(".ui-dialog");
    while (current && current !== dialog) {
      if (current.id) {
        ids.unshift(current.id);
      }
      current = current.parentElement;
    }
    return ids.length > 0 ? ids.join(" > ") : "(no ids in path)";
  }
  validateContainer(dialogElement, extraElement) {
    const widgets = dialogElement.querySelectorAll("[id]");
    let errorCount = 0;
    this._directlyValidatedElements = new Set(Array.from(widgets));
    widgets.forEach((widget) => {
      if (widget instanceof HTMLElement) {
        const widgetType = widget.getAttribute("id") || "unknown";
        try {
          this.checkWidget(widgetType, widget);
        } catch (error) {
          errorCount++;
        }
      }
    });
    if (extraElement && !this._directlyValidatedElements.has(extraElement)) {
      try {
        this.checkWidget("dialog-content", extraElement);
      } catch (error) {
        errorCount++;
      }
    }
    errorCount += this.checkDuplicateButtonLabels(dialogElement);
    this._directlyValidatedElements = null;
    return errorCount;
  }
  validateDialog(dialogElement) {
    const content = dialogElement.querySelector(".ui-dialog-content");
    const errorCount = this.validateContainer(dialogElement, content instanceof HTMLElement ? content : void 0) + this.checkInitialFocusNotCloseButton(dialogElement) + this.checkSpinButtonsHaveVisibleLabel(dialogElement);
    if (errorCount === 0) {
      console.error("A11yValidator: dialog passed all checks");
    } else {
      console.error(`A11yValidator: dialog has ${errorCount} accessibility issues`);
    }
  }
  validateIframeDialog(container) {
    const iframe = container.querySelector("iframe");
    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body)
      return;
    this.validateDialog(iframe.contentDocument.body);
  }
  validateAllOpenDialogs() {
    var _a;
    const jsdialog = (_a = app.map) == null ? void 0 : _a.jsdialog;
    if (!jsdialog || !jsdialog.dialogs) {
      console.error("A11yValidator: no jsdialog manager found");
      return;
    }
    const dialogIds = Object.keys(jsdialog.dialogs);
    if (dialogIds.length === 0) {
      console.error("A11yValidator: no open dialogs to validate");
      return;
    }
    for (const dialogId of dialogIds) {
      const dialogInfo = jsdialog.dialogs[dialogId];
      if (dialogInfo && dialogInfo.container) {
        this.validateDialog(dialogInfo.container);
      }
    }
  }
  validateSidebar() {
    var _a;
    const currentSidebar = (_a = app.map) == null ? void 0 : _a.sidebar;
    if (!currentSidebar) {
      console.error("A11yValidator: no open sidebar to validate");
      return;
    }
    const container = currentSidebar.getContainer();
    Util.ensureValue(container);
    let errorCount = this.validateContainer(container);
    errorCount += this.checkVisibleLabelsForFormControls(container);
    if (errorCount === 0) {
      console.error("A11yValidator: sidebar passed all checks");
    } else {
      console.error(`A11yValidator: sidebar has ${errorCount} accessibility issues`);
    }
  }
  validateNotebookbar() {
    var _a, _b;
    const notebookbar = (_b = (_a = app.map) == null ? void 0 : _a.uiManager) == null ? void 0 : _b.notebookbar;
    if (!notebookbar) {
      console.error("A11yValidator: no notebookbar to validate");
      return;
    }
    let errorCount = this.validateContainer(notebookbar.container);
    errorCount += this.checkTabContainerConsistency(notebookbar);
    errorCount += this.checkOverflowGroupChildIds(notebookbar);
    if (errorCount === 0) {
      console.error("A11yValidator: notebookbar passed all checks");
    } else {
      console.error(`A11yValidator: notebookbar has ${errorCount} accessibility issues`);
    }
  }
  checkTabContainerConsistency(notebookbar) {
    const selectedTab = document.querySelector(".ui-tab.notebookbar.selected");
    if (!selectedTab || !selectedTab.id)
      return 0;
    const tabName = selectedTab.id.split("-")[0];
    const tabs = notebookbar.getTabs();
    const tabDef = tabs == null ? void 0 : tabs.find((t) => t.id === selectedTab.id);
    let errorCount = 0;
    if (tabDef && tabDef.name && tabDef.name !== tabName) {
      console.error(new A11yValidatorException(`Tab '${tabDef.id}' has name '${tabDef.name}' which does not match its id prefix '${tabName}'. The name must match so that accessibility shortcuts are assigned to its buttons.`));
      errorCount++;
    }
    const container = notebookbar.container.querySelector("#" + tabName + "-container");
    if (!container) {
      console.error(new A11yValidatorException(`Selected tab '${selectedTab.id}' has no matching container '#${tabName}-container' in the DOM. Accessibility shortcuts for this tab's buttons will not work.`));
      errorCount++;
    }
    errorCount += this.checkDuplicateShortcuts(selectedTab.id);
    return errorCount;
  }
  collectAllCombinations(node, items, language) {
    if (!node)
      return;
    if (Array.isArray(node)) {
      for (const child of node) {
        this.collectAllCombinations(child, items, language);
      }
      return;
    }
    const isOverflow = node.type === "overflowgroup";
    if (!isOverflow && node.accessibility && node.accessibility.combination) {
      const combo = language && node.accessibility[language] ? node.accessibility[language] : node.accessibility.combination;
      const id = node.id || "unknown";
      items.push({ id, combination: combo });
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.collectAllCombinations(child, items, language);
      }
    }
  }
  checkDuplicateShortcuts(selectedTabId) {
    var _a, _b, _c;
    const notebookbar = (_c = (_b = (_a = window.app) == null ? void 0 : _a.map) == null ? void 0 : _b.uiManager) == null ? void 0 : _c.notebookbar;
    if (!notebookbar)
      return 0;
    const tabs = notebookbar.getTabs();
    const rawDefinitions = notebookbar.getFullJSON();
    if (!tabs || !rawDefinitions)
      return 0;
    let node = rawDefinitions;
    let contextContainer = null;
    while (node.children && Array.isArray(node.children) && node.children[0] && !contextContainer) {
      if (node.children[0].id === "ContextContainer")
        contextContainer = node.children[0];
      else
        node = node.children[0];
    }
    if (!contextContainer)
      return 0;
    const tabName = selectedTabId.split("-")[0];
    let rawContentList = null;
    for (const child of contextContainer.children) {
      if (child.children && child.children[0] && child.children[0].id === tabName + "-container") {
        rawContentList = child.children[0].children;
        break;
      }
    }
    if (!rawContentList)
      return 0;
    const NbaDefs = window.NotebookbarAccessibilityDefinitions;
    const language = NbaDefs ? new NbaDefs().getLanguage() : null;
    const items = [];
    this.collectAllCombinations(rawContentList, items, language);
    let errorCount = 0;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.combination === b.combination) {
          console.error(new A11yValidatorException(`Tab '${selectedTabId}' has duplicate shortcut '${a.combination}' on '${a.id}' and '${b.id}'. Each shortcut within a tab must be unique.`));
          errorCount++;
        } else if (a.combination.startsWith(b.combination)) {
          console.error(new A11yValidatorException(`Tab '${selectedTabId}': shortcut '${b.combination}' on '${b.id}' is a prefix of '${a.combination}' on '${a.id}', making '${a.id}' unreachable.`));
          errorCount++;
        } else if (b.combination.startsWith(a.combination)) {
          console.error(new A11yValidatorException(`Tab '${selectedTabId}': shortcut '${a.combination}' on '${a.id}' is a prefix of '${b.combination}' on '${b.id}', making '${b.id}' unreachable.`));
          errorCount++;
        }
      }
    }
    return errorCount;
  }
  checkOverflowGroupChildIds(notebookbar) {
    const selectedTab = document.querySelector(".ui-tab.notebookbar.selected");
    if (!selectedTab || !selectedTab.id)
      return 0;
    const tabName = selectedTab.id.split("-")[0];
    const containerId = tabName + "-container";
    const fullJSON = notebookbar.getFullJSON();
    const tabJSON = this.findJSONNodeById(fullJSON, containerId);
    if (!tabJSON)
      return 0;
    let errorCount = 0;
    const walk = (node) => {
      if (!node || !node.children || !Array.isArray(node.children))
        return;
      for (const child of node.children) {
        if (child.type === "overflowgroup" && child.id) {
          this.findDuplicateIdInChildren(child.id, child.children, (dupId) => {
            console.error(new A11yValidatorException(`Overflow group '${dupId}' contains a child with the same id. This breaks accessibility shortcut resolution because querySelector matches the parent instead of the child.`));
            errorCount++;
          });
        }
        walk(child);
      }
    };
    walk(tabJSON);
    return errorCount;
  }
  findJSONNodeById(node, id) {
    if (!node)
      return null;
    if (node.id === id)
      return node;
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = this.findJSONNodeById(child, id);
        if (found)
          return found;
      }
    }
    return null;
  }
  findDuplicateIdInChildren(parentId, children, onDuplicate) {
    if (!children || !Array.isArray(children))
      return;
    for (const child of children) {
      if (child.id === parentId) {
        onDuplicate(parentId);
        return;
      }
      if (child.children) {
        this.findDuplicateIdInChildren(parentId, child.children, onDuplicate);
      }
    }
  }
};
_A11yValidator.SPATIAL_RE = /\b(below|above|to the (?:left|right)(?: of)?)\b/gi;
_A11yValidator.CONTENT_NOUNS = /* @__PURE__ */ new Set([
  "row",
  "rows",
  "paragraph",
  "paragraphs",
  "column",
  "columns",
  "cell",
  "cells",
  "page",
  "pages",
  "line",
  "lines",
  "section",
  "sections",
  "heading",
  "headings",
  "sheet",
  "sheets",
  "slide",
  "slides"
]);
_A11yValidator.GroupSelector = 'fieldset, [role="group"][aria-labelledby]';
let A11yValidator = _A11yValidator;
window.app.a11yValidator = new A11yValidator();
window.app.A11yValidatorException = A11yValidatorException;
