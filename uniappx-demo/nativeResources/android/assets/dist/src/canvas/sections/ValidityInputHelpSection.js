const _ValidityInputHelpSection = class _ValidityInputHelpSection extends HTMLObjectSection {
  static showValidityInputHelp(textMsg, documentPosition) {
    let message = textMsg.replace("validityinputhelp: ", "");
    message = JSON.parse(message);
    const section = new _ValidityInputHelpSection(_ValidityInputHelpSection.sectionName, null, null, documentPosition, _ValidityInputHelpSection.className, true);
    app.sectionContainer.addSection(section);
    const objectDiv = section.getHTMLObject();
    const title = document.createElement("h4");
    title.textContent = message.title;
    objectDiv.appendChild(title);
    const content = document.createElement("p");
    content.textContent = message.content;
    objectDiv.appendChild(content);
    const renderedSize = objectDiv.getBoundingClientRect();
    section.size = [renderedSize.width * app.dpiScale, renderedSize.height * app.dpiScale];
  }
  static removeValidityInputHelp() {
    if (app.sectionContainer.doesSectionExist(_ValidityInputHelpSection.sectionName))
      app.sectionContainer.removeSection(_ValidityInputHelpSection.sectionName);
  }
  constructor(sectionName, objectWidth, objectHeight, documentPosition, extraClass = "", showSection = true) {
    super(sectionName, objectWidth, objectHeight, documentPosition, extraClass, showSection);
  }
};
_ValidityInputHelpSection.sectionName = "Validity Input Help";
_ValidityInputHelpSection.className = "input-help";
let ValidityInputHelpSection = _ValidityInputHelpSection;
app.definitions.validityInputHelpSection = ValidityInputHelpSection;
