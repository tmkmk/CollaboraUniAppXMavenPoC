const _VideoBackgroundDialog = class _VideoBackgroundDialog {
  // Each sample is videobackgrounds/<name>.webm, with its thumbnail at
  // images/videobackgrounds/<name>.png.
  static getSamples() {
    return [
      { name: "clouds-day", text: _("Clouds") },
      { name: "clouds-dusk", text: _("Clouds at dusk") },
      { name: "bokeh", text: _("Bokeh") }
    ];
  }
  static show() {
    const uiManager = app.map.uiManager;
    const id = _VideoBackgroundDialog.id;
    const dialogId = uiManager.generateModalId(id);
    const samplesId = id + "-samples";
    const ownId = id + "-own";
    const removeId = id + "-remove";
    const cancelId = id + "-cancel";
    const samples = _VideoBackgroundDialog.getSamples();
    const canRemove = app.map["stateChangeHandler"].getItemValue(".uno:RemoveVideoBackground") !== "disabled";
    const json = uiManager._modalDialogJSON(id, _("Background Video"), true, [
      {
        id: id + "-info",
        type: "fixedtext",
        text: _("The video plays behind every slide that uses the master slide of this slide.")
      },
      {
        id: samplesId,
        type: "iconview",
        singleclickactivate: true,
        textWithIconEnabled: true,
        entries: samples.map((sample, index) => ({
          row: index,
          text: sample.text,
          tooltip: sample.text,
          image: app.LOUtil.getURL("images/videobackgrounds/" + sample.name + ".png"),
          selected: false
        }))
      },
      {
        id: "",
        type: "buttonbox",
        text: "",
        enabled: true,
        vertical: false,
        layoutstyle: "end",
        children: [
          {
            id: removeId,
            type: "pushbutton",
            text: _("Remove Background Video"),
            hidden: !canRemove
          },
          {
            id: ownId,
            type: "pushbutton",
            text: _("Choose Your Own Video...")
          },
          { id: cancelId, type: "pushbutton", text: _("Cancel") }
        ]
      }
    ]);
    uiManager.showModal(json, [
      {
        id: samplesId,
        type: "activate",
        func: (objectType, eventType, object, row) => {
          uiManager.closeModal(dialogId);
          _VideoBackgroundDialog.insertSample(samples[row].name);
        }
      },
      {
        id: ownId,
        func: () => {
          uiManager.closeModal(dialogId);
          app.LOUtil.openFilePicker("videobackground");
        }
      },
      {
        id: removeId,
        func: () => {
          uiManager.closeModal(dialogId);
          app.map.sendUnoCommand(".uno:RemoveVideoBackground");
        }
      }
    ], cancelId);
  }
  // The sample goes in the same way as a video the user picks: the file is sent to the
  // document.
  static async insertSample(name) {
    const fileName = name + ".webm";
    try {
      const response = await fetch(app.LOUtil.getURL("videobackgrounds/" + fileName));
      const isRead = response.ok || response.status === 0 && response.url.startsWith("file:");
      if (!isRead)
        throw new Error(response.statusText);
      const blob = await response.blob();
      app.map.fire("videobackground", {
        file: new File([blob], fileName, { type: "video/webm" })
      });
    } catch (error) {
      window.app.console.error("VideoBackgroundDialog: cannot load " + fileName + ": " + error);
    }
  }
};
_VideoBackgroundDialog.id = "VideoBackgroundDialog";
let VideoBackgroundDialog = _VideoBackgroundDialog;
