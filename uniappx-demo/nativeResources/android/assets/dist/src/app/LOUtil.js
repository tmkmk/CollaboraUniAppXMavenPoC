if (window.ThisIsAMobileApp && DOMPurify.isSupported) {
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "src" && data.attrValue.startsWith("cool:")) {
      data.forceKeepAttr = true;
    }
  });
}
const _LOUtil = class _LOUtil {
  // Open the file picker for one of the hidden file-input elements. In the
  // desktop apps the bare command goes to the engine, which asks the app for
  // a file through the requestfilepicker callback and then runs the command
  // on the picked file directly. Everywhere else a click on the input element
  // opens the browser's picker, and the picked file is uploaded through an
  // insertfile message.
  static openFilePicker(inputId) {
    if (window.mode.isCODesktop()) {
      app.map.sendUnoCommand(_LOUtil.filePickerCommands[inputId]);
      return;
    }
    const input = document.getElementById(inputId);
    if (input)
      input.click();
    else
      console.error('openFilePicker: no input element "' + inputId + '"');
  }
  // Whether the integration offers a file chooser of its own, which is the
  // way a file other than the open document can be picked at all. wopi is
  // the CheckFileInfo property set of the document.
  static hostOffersFileChooser(wopi) {
    return !!wopi && !!(wopi.EnableInsertRemoteFile || wopi.EnableRemoteSlideImport);
  }
  static onRemoveHTMLElement(element, onDetachCallback) {
    const observer = new MutationObserver(function() {
      function isDetached(el) {
        return !el.closest("html");
      }
      if (isDetached(element)) {
        onDetachCallback();
        observer.disconnect();
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true
    });
  }
  static startSpinner(spinnerCanvas, spinnerSpeed) {
    spinnerCanvas.width = 50;
    spinnerCanvas.height = 50;
    const context = spinnerCanvas.getContext("2d");
    context.lineWidth = 8;
    context.strokeStyle = "grey";
    const x = spinnerCanvas.width / 2;
    const y = spinnerCanvas.height / 2;
    const radius = y - context.lineWidth / 2;
    const spinnerInterval = setInterval(function() {
      context.clearRect(0, 0, x * 2, y * 2);
      context.translate(x, y);
      context.rotate(spinnerSpeed * Math.PI / 180);
      context.translate(-x, -y);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 1.3);
      context.stroke();
    }, 30);
    return spinnerInterval;
  }
  static getViewIdColor(viewId) {
    const color = _LOUtil.darkColors[(viewId + 1) % _LOUtil.darkColors.length];
    return color[2] | color[1] << 8 | color[0] << 16;
  }
  static rgbToHex(color) {
    return "#" + ("000000" + color.toString(16)).slice(-6);
  }
  static stringToBounds(bounds) {
    const numbers = bounds.match(/-?\d+/g);
    const topLeft = cool.Point.toPoint(parseInt(numbers[0]), parseInt(numbers[1]));
    const bottomRight = topLeft.add(cool.Point.toPoint(parseInt(numbers[2]), parseInt(numbers[3])));
    return cool.Bounds.toBounds(topLeft, bottomRight);
  }
  static stringToRectangles(strRect) {
    const matches = strRect.match(/-?\d+/g);
    const rectangles = [];
    if (matches !== null) {
      for (let itMatch = 0; itMatch < matches.length; itMatch += 4) {
        const topLeft = cool.Point.toPoint(parseInt(matches[itMatch]), parseInt(matches[itMatch + 1]));
        const size = cool.Point.toPoint(parseInt(matches[itMatch + 2]), parseInt(matches[itMatch + 3]));
        const topRight = topLeft.add(cool.Point.toPoint(size.x, 0));
        const bottomLeft = topLeft.add(cool.Point.toPoint(0, size.y));
        const bottomRight = topLeft.add(size);
        rectangles.push([bottomLeft, bottomRight, topLeft, topRight]);
      }
    }
    return rectangles;
  }
  static getUILanguageCode() {
    const lang = String.locale || "";
    return lang.split("-")[0].split("_")[0].toLowerCase();
  }
  // Helper function to strip '.svg' suffix and 'lc_' prefix.
  static stripName(name) {
    var strippedName = name.replace(/\.svg$/, "");
    if (strippedName.startsWith("lc_")) {
      strippedName = strippedName.substring(3);
    }
    return strippedName;
  }
  static isDarkModeItem(name) {
    const strippedName = _LOUtil.stripName(name);
    return _LOUtil.onlydarkModeItems.includes(strippedName);
  }
  static isCommonForAllMode(name) {
    const strippedName = _LOUtil.stripName(name);
    return _LOUtil.commonItems.includes(strippedName);
  }
  /// unwind things to get a good absolute URL.
  static getURL(path) {
    var _a, _b;
    if (path === "")
      return "";
    const customWindow = window;
    const images = (_a = customWindow.codaRemotePage) == null ? void 0 : _a.images;
    if (images) {
      const relativePath = path.startsWith("/") ? path.substring(1) : path;
      if (images[relativePath])
        return images[relativePath];
    }
    const base = (_b = customWindow.codaRemotePage) == null ? void 0 : _b.base;
    if (base) {
      const relativePath = path.startsWith("/") ? path.substring(1) : path;
      const baseUrl = new URL(base, location.href);
      return new URL(relativePath, baseUrl).href;
    }
    if (customWindow.host === "" && customWindow.serviceRoot === "") {
      if (path.startsWith("/"))
        return path.substring(1);
      return path;
    }
    let url = customWindow.makeHttpUrl("/browser/" + customWindow.versionPath);
    if (path.substr(0, 1) !== "/")
      url += "/";
    url += path;
    return url;
  }
  // Forced colours cannot reach the colours inside an <img>, so an SVG icon
  // publishes a URL for the stylesheet to use as a mask. A light icon draws
  // its line work over a light fill and masks as a solid block, the dark one
  // is line work alone, so the dark one is the mask whenever it exists.
  static publishIconURL(element, url) {
    var _a;
    if (!url || !url.endsWith(".svg"))
      return;
    const lightURL = _LOUtil.lightIconURL(url);
    _LOUtil.setIconMaskURL(element, lightURL);
    element.classList.add("icon-maskable");
    _LOUtil.followForcedColors();
    if (!((_a = window.matchMedia) == null ? void 0 : _a.call(window, "(forced-colors: active)").matches))
      return;
    const darkURL = _LOUtil.darkIconURL(lightURL);
    const probe = new Image();
    probe.addEventListener("load", function() {
      if (element.style.getPropertyValue("--icon-url").includes(lightURL))
        _LOUtil.setIconMaskURL(element, darkURL);
    });
    probe.src = darkURL;
  }
  static lightIconURL(url) {
    return url.replace(/(^|\/)images\/dark\//, "$1images/");
  }
  static darkIconURL(lightURL) {
    return lightURL.replace(/(^|\/)images\//, "$1images/dark/");
  }
  static setIconMaskURL(element, url) {
    element.style.setProperty("--icon-url", 'url("' + url + '")');
  }
  // Forced colours can be switched on after the icons are published, so
  // every icon is published again then to pick up its dark mask.
  static followForcedColors() {
    if (_LOUtil.followingForcedColors || !window.matchMedia)
      return;
    _LOUtil.followingForcedColors = true;
    window.matchMedia("(forced-colors: active)").addEventListener("change", _LOUtil.onForcedColorsChange);
  }
  static onForcedColorsChange(event) {
    if (!event.matches)
      return;
    document.querySelectorAll("img.icon-maskable").forEach(function(element) {
      _LOUtil.publishIconURL(element, element.src);
    });
  }
  static showIcon(element, name, imageIsLayoutCritical) {
    const url = _LOUtil.getImageURL(name);
    if (element instanceof HTMLImageElement) {
      element.src = url;
      _LOUtil.publishIconURL(element, url);
      _LOUtil.checkIfImageExists(element, imageIsLayoutCritical);
    } else {
      element.style.backgroundImage = 'url("' + url + '")';
    }
  }
  // Visible icons change at once. The other icons change in batches, one task for each batch.
  static refreshThemedIcons(iconSet) {
    const themeChange = ++iconSet.themeChanges;
    const visibleIcons = [];
    const hiddenIcons = [];
    for (const icon of iconSet.icons) {
      const element = icon.element.deref();
      if (!element)
        iconSet.icons.delete(icon);
      else if (element.checkVisibility())
        visibleIcons.push([element, icon]);
      else
        hiddenIcons.push(icon);
    }
    for (const [element, icon] of visibleIcons)
      _LOUtil.showIcon(element, icon.name, icon.imageIsLayoutCritical);
    let next = 0;
    const showHiddenIcons = () => {
      if (themeChange !== iconSet.themeChanges)
        return;
      const end = Math.min(next + _LOUtil.hiddenIconBatchSize, hiddenIcons.length);
      for (; next < end; next++) {
        const icon = hiddenIcons[next];
        const element = icon.element.deref();
        if (element)
          _LOUtil.showIcon(element, icon.name, icon.imageIsLayoutCritical);
      }
      if (next < hiddenIcons.length)
        setTimeout(showHiddenIcons, 0);
    };
    if (hiddenIcons.length)
      setTimeout(showHiddenIcons, 0);
  }
  static setImage(element, name, map, imageIsLayoutCritical) {
    _LOUtil.showIcon(element, name, imageIsLayoutCritical);
    let iconSet = _LOUtil.themedIconSets.get(map);
    if (!iconSet) {
      const newSet = {
        icons: /* @__PURE__ */ new Set(),
        byElement: /* @__PURE__ */ new WeakMap(),
        themeChanges: 0
      };
      map.on("themechanged", () => _LOUtil.refreshThemedIcons(newSet));
      _LOUtil.themedIconSets.set(map, newSet);
      iconSet = newSet;
    }
    const known = iconSet.byElement.get(element);
    if (known) {
      known.name = name;
      known.imageIsLayoutCritical = imageIsLayoutCritical;
      return;
    }
    const icon = { element: new WeakRef(element), name, imageIsLayoutCritical };
    iconSet.icons.add(icon);
    iconSet.byElement.set(element, icon);
    _LOUtil.themedIconCleanup.register(element, { icons: iconSet.icons, icon });
  }
  static setUserImage(img, map, viewId) {
    const defaultImage = _LOUtil.getImageURL("user.svg");
    const viewInfo = map._viewInfo[viewId];
    if (viewInfo !== void 0 && viewInfo.userextrainfo !== void 0 && viewInfo.userextrainfo.avatar !== void 0) {
      img.src = viewInfo.userextrainfo.avatar;
      img.addEventListener("error", function() {
        img.src = defaultImage;
        _LOUtil.checkIfImageExists(img, true);
      }, { once: true });
      return;
    }
    img.src = defaultImage;
    _LOUtil.checkIfImageExists(img, true);
  }
  static getImageURL(imgName) {
    var _a;
    let defaultImageURL = _LOUtil.getURL("images/" + imgName);
    if (_LOUtil.isCommonForAllMode(imgName)) {
      return defaultImageURL;
    }
    const lang = _LOUtil.getUILanguageCode();
    const hasLocalized = lang && ((_a = _LOUtil.localizedIcons[lang]) == null ? void 0 : _a.includes(imgName));
    const iconLang = _LOUtil.localeIconAlias[lang] || lang;
    if (window.prefs.getBoolean("darkTheme")) {
      if (hasLocalized)
        return _LOUtil.getURL("images/dark/" + iconLang + "/" + imgName);
      return _LOUtil.getURL("images/dark/" + imgName);
    }
    if (hasLocalized)
      return _LOUtil.getURL("images/" + iconLang + "/" + imgName);
    const dummyEmptyImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    defaultImageURL = _LOUtil.isDarkModeItem(imgName) ? dummyEmptyImg : defaultImageURL;
    return defaultImageURL;
  }
  static getIconNameOfCommand(name, noCommad) {
    if (!name)
      return "";
    var alreadyClean = noCommad;
    var cleanName = name;
    if (name.startsWith("lc_") || name.startsWith("sc_")) {
      cleanName = _LOUtil.stripName(name.substring(3));
      if (cleanName.indexOf("%") >= 0) {
        try {
          cleanName = decodeURIComponent(cleanName);
        } catch (e) {
        }
        alreadyClean = false;
      }
    }
    if (!alreadyClean || alreadyClean !== true) {
      var prefixLength = ".uno:".length;
      if (cleanName.substr(0, prefixLength) == ".uno:")
        cleanName = cleanName.substr(prefixLength);
      cleanName = encodeURIComponent(cleanName).replace(/%/g, "");
      cleanName = cleanName.toLowerCase();
    }
    if (/^\d+$/.test(cleanName) || /^sr\d+$/.test(cleanName) || /^sc\d+$/.test(cleanName) || /^submenu\d+$/.test(cleanName))
      return "";
    if (cleanName.startsWith("overflow-button-"))
      return "";
    if (cleanName.startsWith("sc_"))
      cleanName = cleanName.substring(3);
    var iconURLAliases = {
      // lc_closemobile.svg is generated when loading in NB mode then
      // switch to compact mode: 1st hidden element in the top toolbar
      closemobile: "closedocmobile",
      "sidebardeck.shapesdeck": "basicshapes",
      "file-saveas": "saveas",
      savegraphic: "saveas",
      videobackground: "insertmultimedia",
      insertvideobackground: "insertmultimedia",
      saveimagetowopi: "saveasremote",
      "home-search": "recsearch",
      searchdialog3finitialfocusreplace3abool3dtrue: "searchreplace",
      "addmb-menu": "ok",
      closetablet: "view",
      defineprintarea: "menuprintranges",
      deleteprintarea: "delete",
      sheetrighttoleft: "pararighttoleft",
      duplicatesheet: "duplicatepage",
      alignleft: "leftpara",
      alignright: "rightpara",
      alignhorizontalcenter: "centerpara",
      alignblock: "justifypara",
      formatsparklinemenu: "insertsparkline",
      formatungroup: "ungroup",
      insertdatecontentcontrol: "datefield",
      editheaderandfooter: "headerandfooter",
      insertfooter: "insertpagefooter",
      exportas: "saveas",
      insertheaderfooter: "headerandfooter",
      previoustrackedchange: "prevrecord",
      fieldtransparency: "linetransparency",
      lb_glow_transparency: "linetransparency",
      settransparency: "linetransparency",
      field_transparency: "linetransparency",
      selectionlanugagedefault: "updateall",
      connectortoolbox: "connectorlines",
      conditionalformatdialog: "conditionalformatmenu",
      groupoutlinemenu: "group",
      paperwidth: "pagewidth",
      charspacing: "spacing",
      fontworkcharacterspacingfloater: "spacing",
      tablesort: "datasort",
      spellcheckignoreall: "spelling",
      spellonline: "autospellcheck-on",
      autoformatapply: "autoformat",
      autoformatredlineapply: "trackchanges",
      deleterowbreak: "delbreakmenu",
      alignmentpropertypanel: "alignvcenter",
      cellvertcenter: "alignvcenter",
      charbackcolor: "backcolor",
      insertrowsafter: "insertrowsmenu",
      insertobjectchart: "drawchart",
      textpropertypanel: "sidebartextpanel",
      textbodyparastyle: "parastyle",
      spacepara15: "linespacing",
      orientationdegrees: "rotation",
      clearoutline: "delete",
      docsign: "editdoc",
      editmenu: "editdoc",
      drawtext: "text",
      inserttextbox: "text",
      accepttrackedchanges: "acceptchanges",
      accepttrackedchange: "acceptchanges",
      chartlinepanel: "linestyle",
      linepropertypanel: "linestyle",
      xlinestyle: "linestyle",
      listspropertypanel: "outlinebullet",
      shadowpropertypanel: "shadowed",
      incrementlevel: "outlineleft",
      menurowheight: "rowheight",
      menumargins: "pagemargin",
      menuorientation: "orientation",
      menupagesizescalc: "pagesize",
      menupagesizeswriter: "pagesize",
      setoptimalrowheight: "rowheight",
      cellverttop: "aligntop",
      scalignmentpropertypanel: "aligntop",
      hyperlinkdialog: "inserthyperlink",
      remotelink: "inserthyperlink",
      remoteaicontent: "sdrespageobjs",
      openhyperlinkoncursor: "inserthyperlink",
      pageformatdialog: "pagedialog",
      backgroundcolor: "fillcolor",
      settabbgcolor: "fillcolor",
      cellappearancepropertypanel: "fillcolor",
      formatarea: "fillcolor",
      glowcolor: "fillcolor",
      sccellappearancepropertypanel: "fillcolor",
      insertcolumnsafter: "insertcolumnsmenu",
      insertnonbreakingspace: "formattingmark",
      insertcurrentdate: "datefield",
      insertdatefieldfix: "datefield",
      insertdatefield: "datefield",
      setparagraphlanguagemenu: "spelldialog",
      spellingandgrammardialog: "spelldialog",
      styleapply3fstyle3astring3ddefault26familyname3astring3dcellstyles: "fontcolor",
      fontworkgalleryfloater: "fontworkpropertypanel",
      insertfieldctrl: "insertfield",
      pagenumberwizard: "insertpagenumberfield",
      entirerow: "fromrow",
      insertcheckboxcontentcontrol: "checkbox",
      cellvertbottom: "alignbottom",
      insertcurrenttime: "inserttimefield",
      inserttimefieldfix: "inserttimefield",
      cancelformula: "cancel",
      resetattributes: "setdefault",
      tabledialog: "tablemenu",
      insertindexesentry: "insertmultiindex",
      paperheight: "pageheight",
      masterslidespanel: "masterslide",
      slidemasterpage: "masterslide",
      tabledeletemenu: "deletetable",
      insertcalctable: "inserttable",
      removecalctable: "deletetable",
      tabletotalrow: "autosum",
      renamecalctable: "renametable",
      handleduplicaterecords: "removeduplicates",
      summarizewithpivot: "datadatapilotrun",
      calculatedfieldrun: "functiondialog",
      databasesettings: "tabledesign",
      tracechangemode: "trackchanges",
      showchanges: "showtrackedchanges",
      commentchange: "editannotation",
      deleteallannotation: "deleteallnotes",
      tableeditpanel: "tabledesign",
      tableautofitmenu: "columnwidth",
      menucolumnwidth: "columnwidth",
      hyphenation: "hyphenate",
      validatedialogsa11y: "validation",
      validatesidebara11y: "validation",
      objectbackone: "behindobject",
      deleteannotation: "deletenote",
      areapropertypanel: "chartareapanel",
      "downloadas-png": "insertgraphic",
      decrementlevel: "outlineright",
      acceptformula: "ok",
      insertannotation: "shownote",
      // the engine's generic info icon, shown beside a grammar message
      info_16: "about",
      insertcomment: "shownote",
      objecttitledescription: "shownote",
      namegroup: "shownote",
      incrementindent: "leftindent",
      outlineup: "moveup",
      charttypepanel: "diagramtype",
      arrangeframemenu: "arrangemenu",
      bringtofront: "arrangemenu",
      scnumberformatpropertypanel: "numberformatincdecimals",
      graphicpropertypanel: "graphicdialog",
      rotateflipmenu: "rotateleft",
      outlinedown: "movedown",
      nexttrackedchange: "nextrecord",
      toggleorientation: "orientation",
      configuredialog: "sidebar",
      modifypage: "sidebar",
      parapropertypanel: "paragraphdialog",
      tablecellbackgroundcolor: "fillcolor",
      zoteroArtwork: "zoteroThesis",
      zoteroAudioRecording: "zoteroThesis",
      zoteroBill: "zoteroThesis",
      zoteroBlogPost: "zoteroThesis",
      zoteroBookSection: "zoteroBook",
      zoteroCase: "zoteroThesis",
      zoteroConferencePaper: "zoteroThesis",
      zoteroDictionaryEntry: "zoteroThesis",
      zoteroDocument: "zoteroThesis",
      zoteroEmail: "zoteroThesis",
      zoteroEncyclopediaArticle: "zoteroThesis",
      zoteroFilm: "zoteroThesis",
      zoteroForumPost: "zoteroThesis",
      zoteroHearing: "zoteroThesis",
      zoteroInstantMessage: "zoteroThesis",
      zoteroInterview: "zoteroThesis",
      zoteroLetter: "zoteroThesis",
      zoteroMagazineArticle: "zoteroThesis",
      zoteroWebpage: "zoteroThesis",
      zoteroaddeditcitation: "insertauthoritiesentry",
      zoteroaddnote: "addcitationnote",
      zoterorefresh: "updateall",
      zoterounlink: "unlinkcitation",
      zoteroaddeditbibliography: "addeditbibliography",
      zoteroeditbibliography: "addeditbibliography",
      zoterosetdocprefs: "formproperties",
      "sidebardeck.propertydeck": "sidebar",
      // Fix issue #6145 by adding aliases for the PDF and EPUB icons
      // The fix for issues #6103 and #6104 changes the name of these
      // icons so map the new names to the old names.
      "downloadas-pdf": "exportpdf",
      "downloadas-direct-pdf": "exportdirectpdf",
      "downloadas-epub": "exportepub",
      languagestatusmenu: "languagemenu",
      cancelsearch: "cancel",
      printoptions: "print",
      togglesheetgrid: "show",
      toggleprintgrid: "printgrid",
      exportdirectpdf: "exportpdf",
      textcolumnspropertypanel: "entirecolumn",
      "sidebardeck.stylelistdeck": "editstyle",
      assignlayout3fwhatlayout3along3d20: "layout00",
      assignlayout3fwhatlayout3along3d0: "layout01",
      assignlayout3fwhatlayout3along3d1: "layout02",
      assignlayout3fwhatlayout3along3d3: "layout03",
      assignlayout3fwhatlayout3along3d19: "layout04",
      assignlayout3fwhatlayout3along3d32: "layout05",
      assignlayout3fwhatlayout3along3d15: "layout06",
      assignlayout3fwhatlayout3along3d12: "layout07",
      assignlayout3fwhatlayout3along3d16: "layout08",
      assignlayout3fwhatlayout3along3d14: "layout09",
      assignlayout3fwhatlayout3along3d18: "layout10",
      assignlayout3fwhatlayout3along3d34: "layout11",
      assignlayout3fwhatlayout3along3d27: "layout12",
      assignlayout3fwhatlayout3along3d28: "layout13",
      assignlayout3fwhatlayout3along3d29: "layout02",
      assignlayout3fwhatlayout3along3d30: "layout03",
      insertpage3fwhatlayout3along3d20: "layout00",
      insertpage3fwhatlayout3along3d0: "layout01",
      insertpage3fwhatlayout3along3d1: "layout02",
      insertpage3fwhatlayout3along3d3: "layout03",
      insertpage3fwhatlayout3along3d19: "layout04",
      insertpage3fwhatlayout3along3d32: "layout05",
      insertpage3fwhatlayout3along3d15: "layout06",
      insertpage3fwhatlayout3along3d12: "layout07",
      insertpage3fwhatlayout3along3d16: "layout08",
      insertpage3fwhatlayout3along3d14: "layout09",
      insertpage3fwhatlayout3along3d18: "layout10",
      insertpage3fwhatlayout3along3d34: "layout11",
      insertpage3fwhatlayout3along3d27: "layout12",
      insertpage3fwhatlayout3along3d28: "layout13",
      insertpage3fwhatlayout3along3d29: "layout02",
      insertpage3fwhatlayout3along3d30: "layout03",
      graphicfilterinvert: "graphicfilterinvert",
      graphicfilterpopart: "graphicfilterpopart",
      graphicfilterremovenoise: "graphicfilterremovenoise",
      graphicfiltersharpen: "graphicfiltersharpen",
      graphicfiltersobel: "graphicfiltersobel",
      effects: "pictureeffectsmenu",
      showmultiplepages: "multipageview",
      showtwopages: "multipageview",
      fitwidthzoom: "pagewidth",
      open: "formularesfapopen",
      "exportas-pdf": "exportpdf",
      "exportas-epub": "exportepub",
      "exportas-md": "downloadas-md",
      "fullscreen-drawing": "presentation",
      endnotedialog: "footnotedialog",
      updateallindexes: "insertmultiindex",
      formatframemenu: "framedialog",
      // Navigator content type toolbars. The engine gives the buttons that
      // repeat across those toolbars a per content type suffix to keep the
      // item idents unique, so they arrive here as separate names.
      "objecttitledescription-frames": "shownote",
      "objecttitledescription-images": "shownote",
      "objecttitledescription-oleobjects": "shownote",
      "objecttitledescription-drawingobjects": "shownote",
      "framedialog-more": "framedialog",
      editbookmark: "insertbookmark",
      fielddialog: "insertfield",
      updatefields3funlocksoftfixed3abool3d1: "updateall",
      navelement: "navigator",
      switchtoedit: "edit"
    };
    if (iconURLAliases[cleanName]) {
      cleanName = iconURLAliases[cleanName];
    }
    return "lc_" + cleanName + ".svg";
  }
  // Resolve an icon file name that the engine sent us, e.g. a toolbar item
  // whose .ui icon-name is 'cmd/sc_insertfooter.png' arrives here as
  // 'lc_insertfooter.svg'. Those are icon theme link names, so they have to
  // go through the same alias table as the uno commands to end up at an icon
  // we actually ship. Returns an empty string when there is nothing to
  // request, in which case the caller should use the base64 fallback the
  // engine sends alongside the icon name.
  static getIconNameOfIcon(iconFileName) {
    if (!iconFileName)
      return "";
    if (!iconFileName.startsWith("lc_") && !iconFileName.startsWith("sc_"))
      return iconFileName;
    return _LOUtil.getIconNameOfCommand(iconFileName, true);
  }
  static checkIfImageExists(imageElement, imageIsLayoutCritical) {
    const hasFallback = _LOUtil.imagesWithFallback.has(imageElement);
    _LOUtil.imagesWithFallback.set(imageElement, !!imageIsLayoutCritical);
    if (hasFallback)
      return;
    imageElement.addEventListener("error", function(e) {
      if (e.loUtilProcessed) {
        return;
      }
      if (imageElement.src && imageElement.src.includes("/images/branding/dark/")) {
        imageElement.src = imageElement.src.replace("/images/branding/dark/", "/images/dark/");
        e.loUtilProcessed = true;
        return;
      }
      if (imageElement.src && (imageElement.src.includes("/images/dark/") || imageElement.src.includes("/images/branding/"))) {
        imageElement.src = imageElement.src.replace("/images/dark/", "/images/");
        imageElement.src = imageElement.src.replace("/images/branding/", "/images/");
        e.loUtilProcessed = true;
        return;
      }
      if (_LOUtil.imagesWithFallback.get(imageElement)) {
        imageElement.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        e.loUtilProcessed = true;
        return;
      }
      imageElement.style.display = "none";
      e.loUtilProcessed = true;
    });
  }
  /// oldFileName = Example.odt, suffix = new
  /// returns: Example_new.odt
  static generateNewFileName(oldFileName, suffix) {
    const idx = oldFileName.lastIndexOf(".");
    if (idx == -1) {
      return oldFileName + suffix;
    }
    return oldFileName.substring(0, idx) + suffix + oldFileName.substring(idx);
  }
  static existsIconForCommand(command, docType) {
    const commandName = command.startsWith(".uno:") ? command.substring(".uno:".length) : command;
    const res = !_LOUtil.commandWithoutIcon.find(function(el) {
      return el.startsWith(commandName);
    });
    if (commandName.indexOf("?") !== -1) {
      if (commandName.indexOf("SpellCheckIgnore") !== -1 || commandName.indexOf("SpellCheckIgnoreAll") !== -1)
        return true;
      if ((docType === "spreadsheet" || docType === "presentation") && commandName.indexOf("LanguageStatus") !== -1)
        return true;
      if (commandName === "LanguageStatus?Language:string=Current_LANGUAGE_NONE" || commandName === "LanguageStatus?Language:string=Current_RESET_LANGUAGES" || commandName === "LanguageStatus?Language:string=Paragraph_LANGUAGE_NONE" || commandName === "LanguageStatus?Language:string=Paragraph_RESET_LANGUAGES")
        return true;
      return false;
    }
    return res;
  }
  /// Searching in JSON trees for data with a given field.
  static findItemWithAttributeRecursive(node, idName, idValue) {
    let found = null;
    if (node[idName] === idValue)
      return node;
    if (node.children) {
      for (var i = 0; !found && i < node.children.length; i++)
        found = _LOUtil.findItemWithAttributeRecursive(node.children[i], idName, idValue);
    }
    return found;
  }
  /// Searching in JSON trees for an identifier and return the index in parent.
  static findIndexInParentByAttribute(node, idName, idValue) {
    if (node.children) {
      for (var i = 0; i < node.children.length; i++)
        if (node.children[i][idName] === idValue)
          return i;
    }
    return -1;
  }
  static _doRectanglesIntersect(rectangle1, rectangle2) {
    if (Math.abs(rectangle1[0] + rectangle1[2] * 0.5 - (rectangle2[0] + rectangle2[2] * 0.5)) < 0.5 * (rectangle1[2] + rectangle2[2])) {
      if (Math.abs(rectangle1[1] + rectangle1[3] * 0.5 - (rectangle2[1] + rectangle2[3] * 0.5)) < 0.5 * (rectangle1[3] + rectangle2[3]))
        return true;
      else
        return false;
    } else
      return false;
  }
  // Returns the intersecting area of 2 rectangles. Rectangle format: (x, y, w, h). Return format is the same or null.
  static _getIntersectionRectangle(rectangle1, rectangle2) {
    if (this._doRectanglesIntersect(rectangle1, rectangle2)) {
      var x = rectangle1[0] > rectangle2[0] ? rectangle1[0] : rectangle2[0];
      var y = rectangle1[1] > rectangle2[1] ? rectangle1[1] : rectangle2[1];
      var w = rectangle1[0] + rectangle1[2] < rectangle2[0] + rectangle2[2] ? rectangle1[0] + rectangle1[2] - x : rectangle2[0] + rectangle2[2] - x;
      var h = rectangle1[1] + rectangle1[3] < rectangle2[1] + rectangle2[3] ? rectangle1[1] + rectangle1[3] - y : rectangle2[1] + rectangle2[3] - y;
      return [x, y, w, h];
    } else
      return null;
  }
  static getFileExtension(map) {
    const filename = map["wopi"].BaseFileName;
    const idx = filename.lastIndexOf(".");
    if (idx == -1) {
      return "";
    }
    return filename.substring(idx + 1);
  }
  static isFileODF(map) {
    var ext = _LOUtil.getFileExtension(map);
    return ext === "odt" || ext === "ods" || ext === "odp" || ext === "odg" || ext === "fodt" || ext === "fods" || ext === "fodp" || ext === "fodg";
  }
  // The Options dialog needs somewhere to read and write the settings it
  // shows. The apps carry their own store, reached through the native
  // bridge; in the browser it takes an integration that hands us a settings
  // endpoint, and plenty of integrations do not implement one. The apps
  // have to be answered before wopiSettingBaseUrl is consulted: they load
  // cool.html off disk with its placeholders unsubstituted, so the value
  // there is the literal "%WOPI_SETTING_BASE_URL%" and means nothing.
  // Without a persistable preference store the settings handler is not even
  // installed on the map, so map.settings would be undefined.
  static canOpenSettings() {
    if (!window.prefs.canPersist)
      return false;
    if (window.ThisIsAMobileApp)
      return true;
    return !!window.wopiSettingBaseUrl;
  }
  // Offer the AI assistant only when the user can get an answer out of it:
  // either a provider is configured already - centrally in coolwsd.xml, or
  // in the user's own settings - or they can still reach the Options dialog
  // to configure one. A guest can do neither.
  static isAIAssistantAvailable(map) {
    const wopi = map["wopi"];
    if (wopi.IsAnonymousUser)
      return false;
    if (map.isAIConfigured)
      return true;
    return !wopi.DisableAISettings && _LOUtil.canOpenSettings();
  }
  static containsDOMRect(viewRect, rect) {
    return rect.top >= viewRect.top && rect.right <= viewRect.right && rect.bottom <= viewRect.bottom && rect.left >= viewRect.left;
  }
  static sanitize(html, profile = "html") {
    if (DOMPurify.isSupported) {
      if (profile === "svg") {
        return DOMPurify.sanitize(html, {
          // Enable both SVG and HTML profiles to support HTML content inside foreignObject
          USE_PROFILES: { svg: true, svgFilters: true, html: true },
          ADD_TAGS: ["foreignObject"],
          // Allow ODF namespaced attributes used by LibreOffice SVG export.
          // See: core/filter/source/svg/svgexport.cxx for the full list.
          ADD_ATTR: [
            "ooo:background-visibility",
            "ooo:date-time-field",
            "ooo:date-time-format",
            "ooo:date-time-visibility",
            "ooo:display-name",
            "ooo:footer-field",
            "ooo:footer-visibility",
            "ooo:has-custom-background",
            "ooo:has-transition",
            "ooo:header-field",
            "ooo:id-list",
            "ooo:master",
            "ooo:master-objects-visibility",
            "ooo:name",
            "ooo:number-of-slides",
            "ooo:numbering-type",
            "ooo:page-number-visibility",
            "ooo:page-numbering-type",
            "ooo:slide",
            "ooo:slide-duration",
            "ooo:start-slide-number",
            "ooo:text-adjust",
            "ooo:use-positioned-chars"
          ],
          // Allow HTML content inside foreignObject (for embedded video)
          // See: https://github.com/cure53/DOMPurify/issues/1002
          HTML_INTEGRATION_POINTS: { foreignobject: true }
        });
      }
      return DOMPurify.sanitize(html, { USE_PROFILES: { [profile]: true } });
    }
    return "";
  }
  // Paste handler for contenteditable fields that only store plain text
  // (comments): drop the source formatting right away, otherwise the
  // pasted text looks formatted until the field is saved and its markup
  // is dropped. insertText keeps the undo stack and fires 'input', which
  // the mention handling relies on.
  static onPastePlainText(ev) {
    if (!ev.clipboardData)
      return;
    ev.preventDefault();
    const text = ev.clipboardData.getData("text/plain");
    if (text)
      document.execCommand("insertText", false, text);
  }
  // Turns arbitrary text into an HTML-safe string with no markup at all, unlike
  // sanitize above, which still lets safe markup (bold, links, ...) through.
  // Uses the browser's own serializer rather than a hand-written substitution:
  // setting textContent escapes the text as a text node, and reading innerHTML
  // back out gives that same text as HTML source.
  static escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  // Mirror data-cooltip onto aria-label so the accessible name
  // matches the visible tooltip, even when branding overrides
  // data-cooltip after load (e.g. to "Collabora Online"). When
  // branding also sets an href, target="_blank" takes effect and
  // the link opens a new tab, so announce that to screen readers.
  static syncDocumentLogoAriaLabel(docLogo) {
    const syncAriaLabel = () => {
      const cooltip = docLogo.getAttribute("data-cooltip");
      let label;
      if (cooltip) {
        label = docLogo.getAttribute("href") ? _("{0} website, opens in new tab").replace("{0}", cooltip) : cooltip;
      } else {
        label = _("file type icon");
      }
      docLogo.setAttribute("aria-label", label);
    };
    syncAriaLabel();
    new MutationObserver(syncAriaLabel).observe(docLogo, {
      attributes: true,
      attributeFilter: ["data-cooltip", "href"]
    });
  }
  /**!
   * Turn the file type icon into a control that opens the templates
   * of the running application, which the backstage view filters down
   * to the type of the open document. The icon is an anchor without an
   * href, which the browser neither focuses nor activates from the
   * keyboard, so the role, the tab stop and the Enter and Space keys
   * are all set up here.
   */
  static openTemplatesFromDocumentLogo(docLogo, map) {
    docLogo.setAttribute("role", "button");
    docLogo.setAttribute("tabindex", "0");
    const openTemplates = () => {
      if (map && map.backstageView)
        map.backstageView.show("new");
    };
    docLogo.addEventListener("click", openTemplates);
    docLogo.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ")
        return;
      event.preventDefault();
      openTemplates();
    });
  }
  static getDocumentLogoClass(docType) {
    let iconClass;
    let iconTooltip;
    if (docType === "text") {
      iconClass = "writer-icon-img";
      iconTooltip = "Writer";
    } else if (docType === "spreadsheet") {
      iconClass = "calc-icon-img";
      iconTooltip = "Calc";
    } else if (docType === "presentation") {
      iconClass = "impress-icon-img";
      iconTooltip = "Impress";
    } else if (docType === "drawing") {
      iconClass = "draw-icon-img";
      iconTooltip = "Draw";
    }
    return [iconClass, iconTooltip];
  }
};
_LOUtil.darkColors = [
  [145, 110, 0],
  [17, 106, 222],
  [7, 137, 7],
  [184, 50, 212],
  [220, 44, 72],
  [0, 127, 118],
  [109, 122, 37],
  [99, 115, 152],
  [193, 81, 0]
];
_LOUtil.graphicMimeFilter = [
  // bitmaps (well-defined)
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  // vector graphics (canonical MIME)
  "image/svg+xml",
  "image/x-emf",
  "image/x-wmf",
  // PDF as image
  "application/pdf",
  // extensions for everything else (or as fallback)
  // file pickers don't recognize them by MIME type
  // Windows file picker doesn't recognize vector images by MIME type
  ".svg",
  ".svgz",
  ".emf",
  ".emz",
  ".wmf",
  ".wmz",
  ".eps",
  ".dxf",
  ".pct",
  ".pcx",
  ".pcd",
  ".psd",
  ".tga",
  ".ras",
  ".svm",
  ".met",
  ".pbm",
  ".pgm",
  ".ppm",
  ".xbm",
  ".xpm"
];
_LOUtil.mediaMimeFilter = [
  "video/mp2t",
  "video/mp4",
  "video/mpeg",
  "video/ogg",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-ms-wmv",
  "video/x-msvideo",
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav"
];
_LOUtil.documentMimeFilter = [
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/rtf"
];
_LOUtil.presentationMimeFilter = [
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.presentation-template",
  "application/vnd.oasis.opendocument.presentation-flat-xml",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/vnd.openxmlformats-officedocument.presentationml.template",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-powerpoint.presentation.macroEnabled.12"
];
_LOUtil.filePickerCommands = {
  insertgraphic: ".uno:InsertGraphic",
  insertmultimedia: ".uno:InsertAVMedia",
  selectbackground: ".uno:SelectBackground",
  videobackground: ".uno:InsertVideoBackground",
  comparedocuments: ".uno:CompareDocuments"
};
_LOUtil.longPressTime = 550;
_LOUtil.localeIconAlias = {
  da: "de"
};
_LOUtil.localizedIcons = {
  ar: ["lc_chapternumberingdialog.svg", "lc_linenumberingdialog.svg"],
  da: ["lc_bold.svg", "lc_italic.svg"],
  de: [
    "lc_bold.svg",
    "lc_italic.svg",
    "lc_numberformatdecdecimals.svg",
    "lc_numberformatdecimal.svg",
    "lc_numberformatincdecimals.svg",
    "lc_numberformatthousands.svg"
  ],
  es: [
    "lc_bold.svg",
    "lc_italic.svg",
    "lc_underline.svg",
    "lc_underlinedouble.svg"
  ],
  fr: ["lc_bold.svg"],
  hu: ["lc_italic.svg", "lc_underline.svg", "lc_underlinedouble.svg"],
  it: ["lc_italic.svg"],
  km: [
    "lc_bold.svg",
    "lc_italic.svg",
    "lc_underline.svg",
    "lc_underlinedouble.svg"
  ],
  ko: [
    "lc_bold.svg",
    "lc_charfontname.svg",
    "lc_color.svg",
    "lc_datasort.svg",
    "lc_editstyle.svg",
    "lc_fontdialog.svg",
    "lc_grow.svg",
    "lc_italic.svg",
    "lc_overline.svg",
    "lc_shadowed.svg",
    "lc_shrink.svg",
    "lc_sortascending.svg",
    "lc_sortdescending.svg",
    "lc_strikeout.svg",
    "lc_stylenewbyexample.svg",
    "lc_styleupdatebyexample.svg",
    "lc_text.svg",
    "lc_underline.svg",
    "lc_underlinedouble.svg",
    "lc_verticaltext.svg"
  ],
  nl: ["lc_bold.svg", "lc_underline.svg", "lc_underlinedouble.svg"],
  pl: ["lc_underline.svg", "lc_underlinedouble.svg"],
  ru: ["lc_bold.svg", "lc_underline.svg", "lc_underlinedouble.svg"],
  sl: ["lc_bold.svg", "lc_italic.svg"],
  tr: ["lc_italic.svg"]
};
_LOUtil.onlydarkModeItems = ["invertbackground"];
_LOUtil.commonItems = [
  "serverauditok",
  "serverauditerror",
  "compact_customanimation",
  "slideshow-exit",
  "slideshow-slideNext",
  "slideshow-slidePrevious"
];
_LOUtil.followingForcedColors = false;
_LOUtil.themedIconSets = /* @__PURE__ */ new WeakMap();
_LOUtil.themedIconCleanup = new FinalizationRegistry((entry) => entry.icons.delete(entry.icon));
_LOUtil.imagesWithFallback = /* @__PURE__ */ new WeakMap();
_LOUtil.hiddenIconBatchSize = 20;
_LOUtil.commandWithoutIcon = [
  "InsertPageHeader",
  "InsertPageFooter",
  "FLD_COL_NUMBER",
  "MTR_FLD_COL_SPACING",
  "rows",
  "cols",
  "None"
];
_LOUtil.Rectangle = cool.Rectangle;
_LOUtil.createRectangle = cool.createRectangle;
let LOUtil = _LOUtil;
app.LOUtil = LOUtil;
