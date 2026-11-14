const _DocEvents = class _DocEvents {
  constructor() {
    this.initiate();
  }
  initiate() {
    this.container = document.getElementById(_DocEvents.documentContainerId);
    if (!this.container)
      console.error("DocEvents initation failed.");
    new ResizeObserver(this.fire.bind(this, "resize")).observe(this.container);
  }
  fire(eventType, details) {
    const newEvent = new CustomEvent(eventType, { detail: details });
    this.container.dispatchEvent(newEvent);
  }
  on(eventType, callback) {
    this.container.addEventListener(eventType, callback);
  }
  off(eventType, callback) {
    this.container.removeEventListener(eventType, callback);
  }
};
_DocEvents.documentContainerId = "document-container";
let DocEvents = _DocEvents;
