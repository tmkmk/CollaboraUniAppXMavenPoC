const _MediaPlayerSection = class _MediaPlayerSection extends HTMLObjectSection {
  constructor(description, corner, size) {
    super(_MediaPlayerSection.sectionName, Math.round(size[0] / app.dpiScale), Math.round(size[1] / app.dpiScale), cool.SimplePoint.fromCorePixels([corner[0], corner[1]]), "media-player", true);
    this.url = description.url;
    this.interactable = false;
    const player = h(
      "video",
      { controls: "controls", style: "width: 100%; height: 100%" },
      h("source", { src: description.url, type: description.mimeType }),
      description.srt ? h("track", { src: description.srt, kind: "subtitles" }) : null
    );
    const host = this.getHTMLObject();
    host.appendChild(player);
    host.style.zIndex = "11";
    ShapeHandlesSection.addVideoSupportHandlers([player]);
    if (app.map.isEditMode())
      host.style.opacity = "0.5";
    else
      this.wake();
  }
  /// Shows the player whole and gives it the presses, so its controls can be used.
  wake() {
    const host = this.getHTMLObject();
    host.style.opacity = "1";
    host.style.pointerEvents = "";
  }
  /// Lays the player on the box of the selection as it stands now.
  follow(corner, size) {
    const host = this.getHTMLObject();
    const width = Math.round(size[0] / app.dpiScale);
    const height = Math.round(size[1] / app.dpiScale);
    this.size = [width * app.dpiScale, height * app.dpiScale];
    host.style.width = width + "px";
    host.style.height = height + "px";
    this.setPosition(corner[0], corner[1]);
    this.adjustHTMLObjectPosition();
  }
};
_MediaPlayerSection.sectionName = "media-player";
let MediaPlayerSection = _MediaPlayerSection;
app.definitions.mediaPlayerSection = MediaPlayerSection;
