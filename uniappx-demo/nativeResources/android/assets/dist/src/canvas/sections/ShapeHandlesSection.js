const _HelperLineStyles = class _HelperLineStyles {
  static addListener() {
    app.map.on("darkmodechanged", function() {
      this.gridSolidStyle = null;
      this.gridDashedStyle = null;
      this.smartGuidesStyle = null;
    }.bind(this));
    this.darkModeListenerAdded = true;
  }
  static initiate() {
    if (!this.darkModeListenerAdded)
      this.addListener();
    const tempElement = document.createElement("div");
    tempElement.style.display = "none";
    document.body.appendChild(tempElement);
    tempElement.style.color = "var(--color-grid-helper-line-solid)";
    let computedStyle = window.getComputedStyle(tempElement);
    this.gridSolidStyle = computedStyle.color;
    tempElement.style.color = "var(--color-grid-helper-line-dashed)";
    computedStyle = window.getComputedStyle(tempElement);
    this.gridDashedStyle = computedStyle.color;
    tempElement.style.color = "var(--color-smart-guides-helper-line)";
    computedStyle = window.getComputedStyle(tempElement);
    this.smartGuidesStyle = computedStyle.color;
    tempElement.remove();
  }
};
_HelperLineStyles.gridSolidStyle = null;
_HelperLineStyles.gridDashedStyle = null;
_HelperLineStyles.smartGuidesStyle = null;
_HelperLineStyles.darkModeListenerAdded = false;
let HelperLineStyles = _HelperLineStyles;
class ShapeHandlesSection extends CanvasSectionObject {
  /// How wide and how high a handle is drawn, in core pixels.
  static handleSize() {
    return HandleLook.widthOf("framing");
  }
  /// How wide a point that a connector can be tied to is drawn, in core pixels.
  static gluePointSize() {
    return HandleLook.widthOf("tiePoint");
  }
  /// What every handle of the selection is, in the order they are drawn.
  handleInfos() {
    return this.sectionProperties.handles.map((handle) => handle.info);
  }
  constructor(info) {
    super(app.CSections.ShapeHandlesSection.name);
    this.processingOrder = app.CSections.ShapeHandlesSection.processingOrder;
    this.drawingOrder = app.CSections.ShapeHandlesSection.drawingOrder;
    this.zIndex = app.CSections.ShapeHandlesSection.zIndex;
    this.documentObject = true;
    this.showSection = false;
    this.sectionProperties.info = null;
    this.sectionProperties.handles = [];
    this.sectionProperties.subSections = [];
    this.sectionProperties.activeHandleIndex = null;
    this.sectionProperties.handleWidth = ShapeHandlesSection.handleSize();
    this.sectionProperties.handleHeight = ShapeHandlesSection.handleSize();
    this.sectionProperties.anchorWidth = 20 * app.dpiScale;
    this.sectionProperties.anchorHeight = 20 * app.dpiScale;
    this.sectionProperties.rotationHandleWidth = 24 * app.dpiScale;
    this.sectionProperties.rotationHandleHeight = 24 * app.dpiScale;
    this.sectionProperties.gluePointRadius = ShapeHandlesSection.gluePointSize();
    this.sectionProperties.subSectionPrefix = "shape-handle-";
    this.sectionProperties.svg = null;
    this.sectionProperties.pictureRectangle = null;
    this.sectionProperties.hasVideo = false;
    this.sectionProperties.shapeRectangleProperties = [];
    this.sectionProperties.scalingHandlesPerObject = [];
    this.sectionProperties.selectedObjectCount = 0;
    this.sectionProperties.inPlaceResizeRectangle = null;
    this.sectionProperties.lastDragDistance = [0, 0];
    this.sectionProperties.snap = new SelectionSnap();
    this.sectionProperties.mathObjectBorderColor = "red";
    this.sectionProperties.lastTapTime = 0;
    this.sectionProperties.clickTimer = null;
    this.sectionProperties.viewedRectangleOnMouseDown = new cool.SimpleRectangle(0, 0, 0, 0);
    this.sectionProperties.initialPosition = this.position.slice();
    this.sectionProperties.positionOnMouseDown = new cool.SimplePoint(0, 0);
    this.sectionProperties.shapeDragPreviewPolygons = null;
    this.sectionProperties.shapeDragPreviewFills = null;
    this.sectionProperties.shapeDragPreviewRequestTime = null;
    this.sectionProperties.queuedShapeDragPreview = null;
    this.refreshInfo(info);
    if (HelperLineStyles.gridDashedStyle === null)
      HelperLineStyles.initiate();
  }
  /*
      How many objects the selection holds, taken from the highest place any handle reports.
      It is zero when core sends no places, which keeps the single-object sub section names.
  */
  getSelectedObjectCount() {
    var _a, _b;
    const kinds = (_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.handles) == null ? void 0 : _b.kinds;
    if (!kinds)
      return 0;
    let highest = -1;
    for (const group of Object.values(kinds)) {
      if (!group)
        continue;
      for (const handles of Object.values(group)) {
        if (!Array.isArray(handles))
          continue;
        for (const handle of handles) {
          const objectIndex = parseInt(handle.objectIndex);
          if (objectIndex > highest)
            highest = objectIndex;
        }
      }
    }
    return highest + 1;
  }
  refreshInfo(info) {
    var _a;
    this.sectionProperties.info = info;
    this.convertToTileTwipsIfNeeded();
    this.sectionProperties.selectedObjectCount = this.getSelectedObjectCount();
    this.getHandles();
    this.updateSize();
    if (((_a = GraphicSelection == null ? void 0 : GraphicSelection.extraInfo) == null ? void 0 : _a.isMathObject) === true) {
      this.borderColor = this.sectionProperties.mathObjectBorderColor;
    } else {
      this.addSubSections();
      this.sectionProperties.shapeRectangleProperties = this.getShapeRectangleProperties();
      this.calculateInitialAnglesOfShapeHandlers();
      this.borderColor = null;
    }
  }
  convertToTileTwipsIfNeeded() {
    var _a, _b, _c;
    if (app.map._docLayer._docType !== "spreadsheet" || !app.map._docLayer.sheetGeometry)
      return;
    const kinds = (_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.handles) == null ? void 0 : _b.kinds;
    if (!kinds)
      return;
    if (this.sectionProperties.info.handlesInTileTwips)
      return;
    this.sectionProperties.info.handlesInTileTwips = true;
    const offset = GraphicSelection.tileTwipsOffset;
    const normalize = (entry) => {
      entry.point.x = Math.abs(parseInt(entry.point.x)) + offset[0];
      entry.point.y = parseInt(entry.point.y) + offset[1];
    };
    for (const group of Object.values(kinds)) {
      if (!group)
        continue;
      for (const handles of Object.values(group)) {
        if (!Array.isArray(handles))
          continue;
        for (const handle of handles) {
          handle.point.x = Math.abs(parseInt(handle.point.x)) + offset[0];
          handle.point.y = parseInt(handle.point.y) + offset[1];
        }
      }
    }
    if (Array.isArray((_c = kinds.custom) == null ? void 0 : _c["22"])) {
      for (const entry of kinds.custom["22"])
        normalize(entry);
    }
  }
  /*
      Fills in each scaling handle's distance and angle to the center of its own object.
      Passing shapeRecProps overrides the stored geometry of the object named by objectNumber,
      so a drag moves that object's handles and leaves the others where they are.
  */
  calculateInitialAnglesOfShapeHandlers(shapeRecProps, objectNumber = 0) {
    const xSign = app.map._docLayer.isCalcRTL() ? 1 : -1;
    for (const subSection of this.sectionProperties.subSections) {
      const ownInfo = subSection.sectionProperties.ownInfo;
      const ownObjectNumber = ownInfo.objectNumber ?? 0;
      const props = shapeRecProps && ownObjectNumber === objectNumber ? shapeRecProps : this.sectionProperties.shapeRectangleProperties[ownObjectNumber];
      if (!props)
        continue;
      const halfWidth = props.width * 0.5;
      const halfHeight = props.height * 0.5;
      const halfDiagonal = Math.pow(Math.pow(halfWidth, 2) + Math.pow(halfHeight, 2), 0.5);
      switch (ownInfo.kind) {
        case "1":
          subSection.sectionProperties.distanceToCenter = halfDiagonal;
          subSection.sectionProperties.initialAngle = Math.atan2(halfHeight, xSign * halfWidth);
          break;
        case "2":
          subSection.sectionProperties.distanceToCenter = halfHeight;
          subSection.sectionProperties.initialAngle = Math.atan2(halfHeight, 0);
          break;
        case "3":
          subSection.sectionProperties.distanceToCenter = halfDiagonal;
          subSection.sectionProperties.initialAngle = Math.atan2(halfHeight, -xSign * halfWidth);
          break;
        case "4":
          subSection.sectionProperties.distanceToCenter = halfWidth;
          subSection.sectionProperties.initialAngle = Math.atan2(0, xSign * halfWidth);
          break;
        case "5":
          subSection.sectionProperties.distanceToCenter = halfWidth;
          subSection.sectionProperties.initialAngle = Math.atan2(0, -xSign * halfWidth);
          break;
        case "6":
          subSection.sectionProperties.distanceToCenter = halfDiagonal;
          subSection.sectionProperties.initialAngle = Math.atan2(-halfHeight, xSign * halfWidth);
          break;
        case "7":
          subSection.sectionProperties.distanceToCenter = halfHeight;
          subSection.sectionProperties.initialAngle = Math.atan2(-halfHeight, 0);
          break;
        case "8":
          subSection.sectionProperties.distanceToCenter = halfDiagonal;
          subSection.sectionProperties.initialAngle = Math.atan2(-halfHeight, -xSign * halfWidth);
          break;
      }
    }
  }
  /*
      Core sends the scaling handles as one list per kind, each holding an entry for every
      selected object. This turns them round into one entry per object, keyed by kind, and
      leaves out an object that did not send all eight.
  */
  getScalingHandlesPerObject() {
    var _a, _b, _c;
    const rectangle = (_c = (_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.handles) == null ? void 0 : _b.kinds) == null ? void 0 : _c.rectangle;
    if (!rectangle)
      return [];
    const kinds = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const perObject = /* @__PURE__ */ new Map();
    for (const kind of kinds) {
      if (!Array.isArray(rectangle[kind]))
        continue;
      for (const handle of rectangle[kind]) {
        const objectIndex = parseInt(handle.objectIndex);
        if (!perObject.has(objectIndex))
          perObject.set(objectIndex, {});
        perObject.get(objectIndex)[kind] = handle;
      }
    }
    const objectIndices = Array.from(perObject.keys()).sort((a, b) => a - b);
    return objectIndices.map((objectIndex) => perObject.get(objectIndex)).filter((handles) => kinds.every((kind) => handles[kind] !== void 0));
  }
  getShapeWidth(handles, twips = true) {
    const middleLeft = new cool.SimplePoint(parseInt(handles["4"].point.x), parseInt(handles["4"].point.y));
    const middleRight = new cool.SimplePoint(parseInt(handles["5"].point.x), parseInt(handles["5"].point.y));
    if (twips)
      return Math.abs(middleLeft.distanceTo(middleRight.toArray()));
    else
      return Math.abs(middleLeft.pDistanceTo(middleRight.pToArray()));
  }
  getShapeHeight(handles, twips = true) {
    const topMiddle = new cool.SimplePoint(parseInt(handles["2"].point.x), parseInt(handles["2"].point.y));
    const bottomMiddle = new cool.SimplePoint(parseInt(handles["7"].point.x), parseInt(handles["7"].point.y));
    if (twips)
      return Math.abs(topMiddle.distanceTo(bottomMiddle.toArray()));
    else
      return Math.abs(topMiddle.pDistanceTo(bottomMiddle.pToArray()));
  }
  /*
      This is also sent from the core side.
  */
  getShapeAngleRadians(handles) {
    const topMiddle = new cool.SimplePoint(parseInt(handles["2"].point.x), parseInt(handles["2"].point.y));
    const center = this.getShapeCenter(handles);
    const radians = Math.atan2(center.y - topMiddle.y, topMiddle.x - center.x);
    return radians - Math.PI * 0.5;
  }
  getShapeCenter(handles) {
    const topLeft = new cool.SimplePoint(parseInt(handles["1"].point.x), parseInt(handles["1"].point.y));
    const bottomRight = new cool.SimplePoint(parseInt(handles["8"].point.x), parseInt(handles["8"].point.y));
    return new cool.SimplePoint((topLeft.x + bottomRight.x) * 0.5, (topLeft.y + bottomRight.y) * 0.5);
  }
  /*
      Selection rectangle is different from the object's inner rectangle.
      Handlers are positioned based on object's inner rectangle (~borders). So we need to get the object's inner rectangle and its rotation angle.
      The result holds one entry per selected object, in the same order as
      scalingHandlesPerObject. The objectNumber on a handle is the position of its object in
      that order.
  */
  getShapeRectangleProperties() {
    return this.sectionProperties.scalingHandlesPerObject.map((handles) => {
      return {
        angleRadian: this.getShapeAngleRadians(handles),
        center: this.getShapeCenter(handles),
        height: this.getShapeHeight(handles, false),
        width: this.getShapeWidth(handles, false)
      };
    });
  }
  getScalingHandles(perObject, halfWidth, halfHeight) {
    for (let objectNumber = 0; objectNumber < perObject.length; objectNumber++) {
      const handles = perObject[objectNumber];
      for (const kind of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
        const handle = handles[kind];
        handle.objectNumber = objectNumber;
        this.sectionProperties.handles.push({
          info: handle,
          point: new cool.SimplePoint(handle.point.x - halfWidth, handle.point.y - halfHeight)
        });
      }
    }
  }
  getAnchorHandle(halfWidth, halfHeight) {
    var _a, _b, _c;
    if ((_c = (_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.handles) == null ? void 0 : _b.kinds) == null ? void 0 : _c.anchor) {
      const anchor = this.sectionProperties.info.handles.kinds.anchor["16"][0];
      this.sectionProperties.handles.push({ info: anchor, point: new cool.SimplePoint(anchor.point.x - halfWidth, anchor.point.y - halfHeight) });
    }
  }
  getRotationInfo() {
    var _a, _b, _c;
    if (!((_c = (_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.handles) == null ? void 0 : _b.kinds) == null ? void 0 : _c.rectangle))
      return;
    let coreAngle = GraphicSelection.selectionAngle;
    if (this.sectionProperties.svg)
      coreAngle = this.sectionProperties.svg.innerHTML.includes('class="Group"') ? 0 : coreAngle;
    if (coreAngle !== void 0 && coreAngle !== null) {
      coreAngle = coreAngle / 100;
      coreAngle = coreAngle * Math.PI / 180;
      while (coreAngle > Math.PI * 2)
        coreAngle -= Math.PI * 2;
      while (coreAngle < 0)
        coreAngle += Math.PI * 2;
    } else
      coreAngle = null;
    const result = {
      kind: "ShapeRotationHandle",
      coreAngle
    };
    return result;
  }
  // Core sends no position for the single-object rotation handle. It sits above the shape's
  // top edge and turns with the shape.
  getRotationHandlePosition(rotationInfo, handles) {
    const topMiddle = handles["2"];
    const centerX = parseInt(topMiddle.point.x) * app.twipsToPixels - this.position[0];
    const centerY = parseInt(topMiddle.point.y) * app.twipsToPixels - this.position[1];
    const diff = 30 * app.dpiScale;
    let y = centerY - diff * Math.sin(rotationInfo.coreAngle + Math.PI * 0.5);
    let x = centerX + diff * Math.cos(rotationInfo.coreAngle + Math.PI * 0.5);
    x -= this.sectionProperties.rotationHandleWidth * 0.5;
    y -= this.sectionProperties.rotationHandleHeight * 0.5;
    return new cool.SimplePoint((this.position[0] + x) * app.pixelsToTwips, (this.position[1] + y) * app.pixelsToTwips);
  }
  getRotationHandle(perObject) {
    var _a, _b, _c, _d, _e;
    if (((_a = GraphicSelection.extraInfo) == null ? void 0 : _a.isRotatable) === false || this.sectionProperties.hasVideo)
      return;
    const perObjectHandles = (_e = (_d = (_c = (_b = this.sectionProperties.info) == null ? void 0 : _b.handles) == null ? void 0 : _c.kinds) == null ? void 0 : _d.rotate) == null ? void 0 : _e["24"];
    if (Array.isArray(perObjectHandles) && perObjectHandles.length > 0) {
      const halfWidth = app.pixelsToTwips * (this.sectionProperties.rotationHandleWidth * 0.5);
      const halfHeight = app.pixelsToTwips * (this.sectionProperties.rotationHandleHeight * 0.5);
      for (const handle of perObjectHandles) {
        handle.kind = "ShapeRotationHandle";
        this.sectionProperties.handles.push({
          info: handle,
          point: new cool.SimplePoint(handle.point.x - halfWidth, handle.point.y - halfHeight)
        });
      }
      return;
    }
    if (perObject.length > 0) {
      const rotationInfo = this.getRotationInfo();
      const rotationHandlePosition = this.getRotationHandlePosition(rotationInfo, perObject[0]);
      rotationInfo.initialPosition = rotationHandlePosition.clone();
      this.sectionProperties.handles.push({ info: rotationInfo, point: rotationHandlePosition });
    }
  }
  getCustomHandles(halfWidth, halfHeight) {
    var _a, _b, _c;
    if ((_c = (_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.handles) == null ? void 0 : _b.kinds) == null ? void 0 : _c.custom) {
      const customHandleList = this.sectionProperties.info.handles.kinds.custom["22"];
      if (customHandleList && customHandleList.length > 0) {
        for (let i = 0; i < customHandleList.length; i++) {
          const customHandler = customHandleList[i];
          this.sectionProperties.handles.push({ info: customHandler, point: new cool.SimplePoint(customHandler.point.x - halfWidth, customHandler.point.y - halfHeight) });
        }
      }
    }
  }
  getPolyHandles(halfWidth, halfHeight) {
    var _a, _b, _c;
    if ((_c = (_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.handles) == null ? void 0 : _b.kinds) == null ? void 0 : _c.poly) {
      if (Array.isArray(this.sectionProperties.info.handles.kinds.poly["9"])) {
        const polyArray = this.sectionProperties.info.handles.kinds.poly["9"];
        for (let i = 0; i < polyArray.length; i++) {
          const poly = polyArray[i];
          this.sectionProperties.handles.push({ info: poly, point: new cool.SimplePoint(poly.point.x - halfWidth, poly.point.y - halfHeight) });
        }
      }
    }
  }
  getGluePoints() {
    var _a, _b;
    if ((_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.GluePoints) == null ? void 0 : _b.shapes) {
      if (Array.isArray(this.sectionProperties.info.GluePoints.shapes)) {
        const shapeArray = this.sectionProperties.info.GluePoints.shapes;
        for (let i = 0; i < shapeArray.length; i++) {
          const shape = shapeArray[i];
          shape.kind = "GluePoint";
          const glueArray = shape.gluepoints;
          for (let j = 0; j < glueArray.length; j++) {
            const info = Object.assign({}, shape);
            info.id = String(i) + String(j);
            this.sectionProperties.handles.push({ info, point: new cool.SimplePoint(glueArray[j].point.x, glueArray[j].point.y) });
          }
        }
      }
    }
  }
  getDiagram(perObject, halfWidth, halfHeight) {
    if (this.isDiagram() && perObject.length > 0) {
      const scaleFactor = 3;
      halfWidth *= scaleFactor;
      halfHeight *= scaleFactor;
      const handles = perObject[0];
      const topLeft = handles["1"];
      const width = this.getShapeWidth(handles, true) + 2 * halfWidth;
      const height = this.getShapeHeight(handles, true) + 2 * halfHeight;
      const info = {
        kind: "DiagramHandle",
        size: new cool.SimplePoint(width, height),
        halfWidth,
        halfHeight
      };
      this.sectionProperties.handles.push({
        info,
        point: new cool.SimplePoint(topLeft.point.x - info.halfWidth, topLeft.point.y - info.halfHeight)
      });
    }
  }
  // Get the handle positions and other information from the info that core side sent us.
  getHandles() {
    this.sectionProperties.handles = [];
    const halfWidth = app.pixelsToTwips * (this.sectionProperties.handleWidth * 0.5);
    const halfHeight = app.pixelsToTwips * (this.sectionProperties.handleHeight * 0.5);
    const perObject = this.getScalingHandlesPerObject();
    this.sectionProperties.scalingHandlesPerObject = perObject;
    this.getDiagram(perObject, halfWidth, halfHeight);
    this.getScalingHandles(perObject, halfWidth, halfHeight);
    this.getAnchorHandle(halfWidth, halfHeight);
    this.getRotationHandle(perObject);
    this.getCustomHandles(halfWidth, halfHeight);
    this.getPolyHandles(halfWidth, halfHeight);
    this.getGluePoints();
  }
  // Update this section's size according to handle coordinates.
  updateSize() {
    this.size = [0, 0];
    if (GraphicSelection.hasActiveSelection())
      this.size = [GraphicSelection.rectangle.pWidth, GraphicSelection.rectangle.pHeight];
    this.boundingRectangle = cool.SimpleRectangle.fromCorePixels([...this.position, ...this.size]);
    if (this.sectionProperties.svg)
      this.adjustSVGProperties();
  }
  isSVGVisible() {
    if (this.sectionProperties.svg)
      return this.sectionProperties.svg.style.display === "";
    else
      return false;
  }
  isDiagram() {
    var _a;
    if (((_a = GraphicSelection == null ? void 0 : GraphicSelection.extraInfo) == null ? void 0 : _a.isDiagram) === true)
      return true;
    else
      return false;
  }
  removeSVG() {
    if (this.sectionProperties.svg)
      this.sectionProperties.svg.remove();
    this.sectionProperties.pictureRectangle = null;
  }
  static addVideoSupportHandlers(videos) {
    if (!videos)
      return;
    for (var i = 0; i < videos.length; i++) {
      var video = videos[i];
      var sources = video.getElementsByTagName("source");
      video.addEventListener("playing", function() {
        window.setTimeout(function() {
          if (video.webkitDecodedFrameCount === 0 && video.webkitAudioDecodedByteCount === 0) {
            ShapeHandlesSection.showUnsupportedMediaWarning();
          }
        }, 1e3);
      });
      video.addEventListener("error", function() {
        ShapeHandlesSection.showUnsupportedMediaWarning();
      });
      if (sources.length) {
        sources[0].addEventListener("error", function(error) {
          ShapeHandlesSection.showUnsupportedMediaWarning();
        });
      }
    }
  }
  static showUnsupportedMediaWarning() {
    var videoWarning = _("Document contains unsupported media");
    window.L.Map.THIS.uiManager.showSnackbar(videoWarning);
  }
  addEmbeddedVideo(svgString) {
    this.sectionProperties.hasVideo = true;
    this.setSVG(svgString);
    this.sectionProperties.svg.style.opacity = 0.5;
    this.sectionProperties.svg.remove();
    document.getElementById("canvas-container").appendChild(this.sectionProperties.svg);
    this.sectionProperties.svg.style.zIndex = 11;
    if (!app.map.isEditMode()) {
      this.sectionProperties.svg.style.opacity = 1;
      this.sectionProperties.svg.style.pointerEvents = "";
      this.hideSubSections();
    }
    if (!this.sectionProperties.svg.innerHTML.includes("foreignObject")) {
      console.error("Failed to parse svg for embedded video");
      return;
    }
    var videoContainer = this.sectionProperties.svg;
    var videos = this.sectionProperties.svg.getElementsByTagName("video");
    ShapeHandlesSection.addVideoSupportHandlers(videos);
  }
  removeTagFromHTML(data, startString, endString) {
    let startIndex = data.indexOf(startString);
    let endIndex = data.indexOf(endString, startIndex + 1);
    while (startIndex !== -1 && endIndex !== -1) {
      const toRemove = data.substring(startIndex, endIndex + endString.length);
      data = data.replace(toRemove, "");
      startIndex = data.indexOf(startString);
      endIndex = data.indexOf(endString, startIndex + 1);
    }
    return data;
  }
  getTagFromHTML(data, startString, endString) {
    const startIndex = data.indexOf(startString);
    const endIndex = data.indexOf(endString, startIndex + 1);
    if (startIndex !== -1 && endIndex !== -1) {
      const pickedData = data.substring(startIndex, endIndex + endString.length);
      return pickedData;
    } else {
      return "";
    }
  }
  setSVG(data) {
    this.removeSVG();
    data = this.removeTagFromHTML(data, ' style="', '"');
    this.sectionProperties.svg = document.createElement("svg");
    this.sectionProperties.svg.style.pointerEvents = "none";
    document.getElementById("canvas-container").appendChild(this.sectionProperties.svg);
    this.sectionProperties.svg.innerHTML = app.LOUtil.sanitize(data, "svg");
    this.sectionProperties.svg.style.position = "absolute";
    this.sectionProperties.svg.children[0].style.width = this.sectionProperties.svg.children[0].style.height = "auto";
    this.sectionProperties.svg.children[0].style.transformOrigin = "center";
    this.sectionProperties.svg.children[0].setAttribute("preserveAspectRatio", "none");
    this.adjustSVGProperties();
  }
  showSVG() {
    if (RenderManager.drawsFromObjects())
      return;
    if (this.sectionProperties.svg)
      this.sectionProperties.svg.style.display = "";
  }
  hideSVG() {
    if (this.sectionProperties.svg && !this.sectionProperties.hasVideo)
      this.sectionProperties.svg.style.display = "none";
  }
  onSectionShowStatusChange() {
    for (let i = 0; i < this.sectionProperties.subSections.length; i++)
      this.sectionProperties.subSections[i].setShowSection(this.showSection);
    if (!this.showSection)
      this.hideSVG();
  }
  /*
      Name of the sub section that draws the given handle. An id counts within one object, so
      a selection of several takes core's handle index, which is unique across the whole of
      it, and a single object keeps the id.
  */
  getSubSectionName(info) {
    if (info.kind === "DiagramHandle")
      return this.sectionProperties.subSectionPrefix + "diagram";
    if (this.sectionProperties.selectedObjectCount > 1 && info.index !== void 0)
      return this.sectionProperties.subSectionPrefix + "index" + info.index;
    if (info.kind === "ShapeRotationHandle")
      return this.sectionProperties.subSectionPrefix + "rotation";
    return this.sectionProperties.subSectionPrefix + info.id;
  }
  /*
      The sub section already drawing the named handle, as long as it is of the wanted class.
      A name comes back for a handle of another class when the handle list changes, point
      handles taking the place of scaling handles for one, so it is dropped and built again.
  */
  getReusableSubSection(subSectionName, wantedClass) {
    const subSection = app.sectionContainer.getSectionWithName(subSectionName);
    if (!subSection)
      return null;
    if (subSection.constructor === wantedClass)
      return subSection;
    this.containerObject.removeSection(subSectionName);
    this.sectionProperties.subSections = this.sectionProperties.subSections.filter((candidate) => candidate.name !== subSectionName);
    return null;
  }
  checkAnchorSubSection(handle) {
    const subSectionName = this.getSubSectionName(handle.info);
    let newSubSection = this.getReusableSubSection(subSectionName, ShapeHandleAnchorSubSection);
    if (!newSubSection) {
      newSubSection = new ShapeHandleAnchorSubSection(this, subSectionName, [this.sectionProperties.anchorWidth / app.dpiScale, this.sectionProperties.anchorHeight / app.dpiScale], handle.point.clone(), handle.info);
      return newSubSection;
    } else {
      newSubSection.sectionProperties.ownInfo = handle.info;
      newSubSection.setPosition(handle.point.pX, handle.point.pY);
      return null;
    }
  }
  checkScalingSubSection(handle) {
    const subSectionName = this.getSubSectionName(handle.info);
    let newSubSection = this.getReusableSubSection(subSectionName, ShapeHandleScalingSubSection);
    if (!newSubSection) {
      newSubSection = new ShapeHandleScalingSubSection(this, subSectionName, [this.sectionProperties.handleWidth, this.sectionProperties.handleHeight], handle.point.clone(), handle.info, GraphicSelection.extraInfo.isCropMode);
      return newSubSection;
    } else {
      newSubSection.sectionProperties.ownInfo = handle.info;
      newSubSection.setPosition(handle.point.pX, handle.point.pY);
      if (GraphicSelection.extraInfo.isCropMode && !newSubSection.sectionProperties.cropModeEnabled) {
        newSubSection.sectionProperties.cropModeEnabled = GraphicSelection.extraInfo.isCropMode;
      }
      return null;
    }
  }
  checkRotationSubSection(handle) {
    const subSectionName = this.getSubSectionName(handle.info);
    let newSubSection = this.getReusableSubSection(subSectionName, app.definitions.shapeHandleRotationSubSection);
    if (!newSubSection) {
      newSubSection = new app.definitions.shapeHandleRotationSubSection(this, subSectionName, [this.sectionProperties.rotationHandleWidth, this.sectionProperties.rotationHandleHeight], handle.point.clone(), handle.info);
      return newSubSection;
    } else {
      newSubSection.sectionProperties.ownInfo = handle.info;
      newSubSection.setPosition(handle.point.pX, handle.point.pY);
      return null;
    }
  }
  checkDiagramSubSection(handle) {
    const subSectionName = this.getSubSectionName(handle.info);
    let newSubSection = this.getReusableSubSection(subSectionName, app.definitions.shapeHandleDiagramSubSection);
    if (!newSubSection) {
      newSubSection = new app.definitions.shapeHandleDiagramSubSection(this, subSectionName, [handle.info.size.pX, handle.info.size.pY], new cool.SimplePoint(handle.point.x, handle.point.y), handle.info);
      return newSubSection;
    } else {
      newSubSection.sectionProperties.ownInfo = handle.info;
      newSubSection.setPosition(handle.point.pX, handle.point.pY);
      newSubSection.setSize(handle.info.size.pX, handle.info.size.pY);
      if (GraphicSelection.diagramButton)
        GraphicSelection.diagramButton.forceNextReposition();
      return null;
    }
  }
  checkCustomSubSection(handle) {
    const subSectionName = this.getSubSectionName(handle.info);
    let newSubSection = this.getReusableSubSection(subSectionName, app.definitions.shapeHandleCustomSubSection);
    if (!newSubSection) {
      newSubSection = new app.definitions.shapeHandleCustomSubSection(this, subSectionName, [this.sectionProperties.handleWidth, this.sectionProperties.handleHeight], handle.point.clone(), handle.info);
      return newSubSection;
    } else {
      newSubSection.sectionProperties.ownInfo = handle.info;
      newSubSection.setPosition(handle.point.pX, handle.point.pY);
      return null;
    }
  }
  checkPolySubSection(handle) {
    const subSectionName = this.getSubSectionName(handle.info);
    let newSubSection = this.getReusableSubSection(subSectionName, app.definitions.shapeHandlePolySubSection);
    if (!newSubSection) {
      newSubSection = new app.definitions.shapeHandlePolySubSection(this, subSectionName, [this.sectionProperties.handleWidth, this.sectionProperties.handleHeight], handle.point.clone(), handle.info);
      return newSubSection;
    } else {
      newSubSection.sectionProperties.ownInfo = handle.info;
      newSubSection.setPosition(handle.point.pX, handle.point.pY);
      return null;
    }
  }
  checkGluePointSubSection(handle) {
    const subSectionName = this.getSubSectionName(handle.info);
    let newSubSection = this.getReusableSubSection(subSectionName, app.definitions.shapeHandleGluePointSubSection);
    if (!newSubSection) {
      newSubSection = new app.definitions.shapeHandleGluePointSubSection(this, subSectionName, [this.sectionProperties.gluePointRadius, this.sectionProperties.gluePointRadius], handle.point.clone(), handle.info);
      return newSubSection;
    } else {
      newSubSection.sectionProperties.ownInfo = handle.info;
      newSubSection.setPosition(handle.point.pX, handle.point.pY);
      return null;
    }
  }
  /*
      Whether a handle of that kind gets a section of its own. A view that draws from objects
      draws the handles that frame and shape the selection in one section of its own, which
      knows them as a list, and draws the band round a group or a diagram there as well, so only
      the anchor is left here. Cropping an image is done with the whole set of handles here, so
      while it runs they are all made as they always were.
  */
  handleGetsItsOwnSection(kind) {
    var _a;
    if (!RenderManager.drawsFromObjects())
      return true;
    if ((_a = GraphicSelection.extraInfo) == null ? void 0 : _a.isCropMode)
      return true;
    return kind === "16";
  }
  /*
      A sub section whose name no handle carries any more is left from the selection before,
      and would go on drawing a handle that is not there. Losing an object leaves one behind,
      and so does dropping to a single object, which puts the names back.
  */
  removeStaleSubSections(currentNames) {
    const remaining = [];
    for (const subSection of this.sectionProperties.subSections) {
      if (currentNames.has(subSection.name))
        remaining.push(subSection);
      else
        this.containerObject.removeSection(subSection.name);
    }
    this.sectionProperties.subSections = remaining;
  }
  addSubSections() {
    const currentNames = /* @__PURE__ */ new Set();
    for (let i = 0; i < this.sectionProperties.handles.length; i++) {
      if (!this.handleGetsItsOwnSection(this.sectionProperties.handles[i].info.kind))
        continue;
      currentNames.add(this.getSubSectionName(this.sectionProperties.handles[i].info));
      let newSubSection = null;
      if (this.sectionProperties.handles[i].info.kind === "16")
        newSubSection = this.checkAnchorSubSection(this.sectionProperties.handles[i]);
      else if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(this.sectionProperties.handles[i].info.kind))
        newSubSection = this.checkScalingSubSection(this.sectionProperties.handles[i]);
      else if (this.sectionProperties.handles[i].info.kind === "ShapeRotationHandle")
        newSubSection = this.checkRotationSubSection(this.sectionProperties.handles[i]);
      else if (this.sectionProperties.handles[i].info.kind === "DiagramHandle")
        newSubSection = this.checkDiagramSubSection(this.sectionProperties.handles[i]);
      else if (["11", "22"].includes(this.sectionProperties.handles[i].info.kind))
        newSubSection = this.checkCustomSubSection(this.sectionProperties.handles[i]);
      else if (this.sectionProperties.handles[i].info.kind === "9")
        newSubSection = this.checkPolySubSection(this.sectionProperties.handles[i]);
      else if (this.sectionProperties.handles[i].info.kind === "GluePoint")
        newSubSection = this.checkGluePointSubSection(this.sectionProperties.handles[i]);
      if (newSubSection) {
        this.containerObject.addSection(newSubSection);
        this.sectionProperties.subSections.push(newSubSection);
      }
    }
    this.removeStaleSubSections(currentNames);
  }
  onMouseEnter() {
    var _a;
    this.context.canvas.style.cursor = ((_a = GraphicSelection.extraInfo) == null ? void 0 : _a.isDraggable) === false ? "not-allowed" : "move";
  }
  /// Where the upper left corner of the selection lands, in core pixels, on the axis given.
  adjustSnapTransformCoordinate(x, y) {
    const corner = this.sectionProperties.snap.corner(x, y);
    return x !== null ? corner[0] : corner[1];
  }
  sendTransformCommand(point) {
    const corner = this.sectionProperties.snap.corner(this.sectionProperties.lastDragDistance[0] + this.position[0], this.sectionProperties.lastDragDistance[1] + this.position[1]);
    let x = corner[0];
    const y = corner[1];
    if (GraphicSelection.inPlaceActive) {
      GraphicSelection.sendInPlaceArea(cool.SimpleRectangle.fromCorePixels([
        x,
        y,
        this.size[0],
        this.size[1]
      ]), true);
      app.map._docLayer.requestNewFiledBasedViewTiles();
      this.sectionProperties.lastDragDistance = [0, 0];
      return;
    }
    const docLayer = app.map._docLayer;
    if (docLayer.isCalcRTL())
      x = -this.size[0] + this.sectionProperties.lastDragDistance[0] - this.position[0];
    let xTwips = Math.round(x * app.pixelsToTwips);
    let yTwips = Math.round(y * app.pixelsToTwips);
    const verticalOffset = docLayer.getFiledBasedViewVerticalOffset();
    if (verticalOffset) {
      yTwips -= verticalOffset;
    }
    if (docLayer._docType === "spreadsheet" && GraphicSelection.inPlaceArea) {
      const sign = xTwips < 0 ? -1 : 1;
      xTwips = sign * (Math.abs(xTwips) - GraphicSelection.inPlaceTileOffset[0]);
      yTwips -= GraphicSelection.inPlaceTileOffset[1];
    } else if (docLayer._docType === "spreadsheet" && docLayer.sheetGeometry) {
      const sign = xTwips < 0 ? -1 : 1;
      const printTwips = docLayer.sheetGeometry.getPrintTwipsPointFromTile(new cool.Point(Math.abs(xTwips), yTwips));
      xTwips = sign * Math.round(printTwips.x);
      yTwips = Math.round(printTwips.y);
    }
    const parameters = {
      "TransformPosX": {
        "type": "long",
        "value": xTwips
      },
      "TransformPosY": {
        "type": "long",
        "value": yTwips
      }
    };
    app.map.sendUnoCommand(".uno:TransformDialog", parameters);
    docLayer.requestNewFiledBasedViewTiles();
    this.sectionProperties.lastDragDistance = [0, 0];
  }
  /*
      Whether a resize drag previews with the outlines core reports instead of the scaled
      selection SVG. Core resizes each object about its own corner, which one scale of the
      whole SVG cannot show, while a single object is a plain scale of itself.
  */
  usesCoreDragPreview() {
    return this.sectionProperties.selectedObjectCount > 1;
  }
  /*
      Ask core for the geometry the shape would get if the dragged handle
      was dropped at the given position. Core answers with a
      shapedragpreview message. At most one request is in flight, newer
      positions replace the queued one until the answer arrives.
  */
  requestShapeDragPreview(handleInfo, point) {
    const requestTime = this.sectionProperties.shapeDragPreviewRequestTime;
    if (requestTime !== null && Date.now() - requestTime < 250) {
      this.sectionProperties.queuedShapeDragPreview = {
        handleInfo,
        point
      };
      return;
    }
    this.sendShapeDragPreviewRequest(handleInfo, point);
  }
  /*
      How a handle is named to the engine: by what it is, where the client worked the handles out
      for itself, and otherwise by the place the engine gave it in its own list.
  */
  static handleParameters(handleInfo) {
    if (handleInfo == null ? void 0 : handleInfo.name)
      return { HandleName: { type: "string", value: String(handleInfo.name) } };
    const number = (handleInfo == null ? void 0 : handleInfo.index) ?? (handleInfo == null ? void 0 : handleInfo.id);
    return { HandleNum: { type: "long", value: number } };
  }
  /*
      The handle of the given kind on the same object as the handle a drag started on. Keeping
      the ratio commits the drag on another corner, and core looks a handle up in the list it
      keeps for the whole selection, so the place in that list is what it is told.
  */
  committedScalingHandle(ownInfo, committedKind) {
    var _a, _b, _c, _d;
    const siblings = (_d = (_c = (_b = (_a = this.sectionProperties.info) == null ? void 0 : _a.handles) == null ? void 0 : _b.kinds) == null ? void 0 : _c.rectangle) == null ? void 0 : _d[committedKind];
    if (Array.isArray(siblings)) {
      const sibling = siblings.find((handle) => handle.objectIndex === ownInfo.objectIndex);
      if (sibling)
        return sibling;
    }
    return ownInfo;
  }
  sendShapeDragPreviewRequest(handleInfo, point) {
    this.sectionProperties.shapeDragPreviewRequestTime = Date.now();
    this.sectionProperties.queuedShapeDragPreview = null;
    const parameters = {
      ...ShapeHandlesSection.handleParameters(handleInfo),
      NewPosX: { type: "long", value: Math.round(point.x) },
      NewPosY: { type: "long", value: Math.round(point.y) },
      Preview: { type: "boolean", value: true }
    };
    app.map.sendUnoCommand(".uno:MoveShapeHandle", parameters);
  }
  onShapeDragPreview(preview) {
    this.sectionProperties.shapeDragPreviewRequestTime = null;
    if (!this.containerObject.isDraggingSomething()) {
      this.clearShapeDragPreview();
      return;
    }
    const polygons = [];
    if (Array.isArray(preview == null ? void 0 : preview.polygons)) {
      for (const polygonText of preview.polygons) {
        const points = [];
        for (const pointText of String(polygonText).split(" ")) {
          const coordinates = pointText.split(",");
          if (coordinates.length !== 2)
            continue;
          points.push([
            parseInt(coordinates[0]) * app.twipsToPixels,
            parseInt(coordinates[1]) * app.twipsToPixels
          ]);
        }
        if (points.length > 1)
          polygons.push(points);
      }
    }
    this.sectionProperties.shapeDragPreviewPolygons = polygons.length > 0 ? polygons : null;
    this.sectionProperties.shapeDragPreviewFills = Array.isArray(preview == null ? void 0 : preview.fills) ? preview.fills.map(String) : null;
    this.containerObject.requestReDraw();
    const queued = this.sectionProperties.queuedShapeDragPreview;
    if (queued)
      this.sendShapeDragPreviewRequest(queued.handleInfo, queued.point);
  }
  /*
      The drag is off, so what was shown of it goes: the copy of the shape that followed the
      mouse, the outline the engine answered with, and the lines it was snapping to. The shape
      itself never moved, the engine breaks its own drag on the same key.
  */
  /// Forgets what the last look for a snap found, so the lines that marked it are gone.
  forgetTheSnap() {
    this.sectionProperties.snap.forget();
  }
  /// Where the last look for a snap landed, in core pixels, null on an axis that found none.
  snappedAt() {
    return this.sectionProperties.snap.at();
  }
  onDragCancel() {
    this.sectionProperties.lastDragDistance = [0, 0];
    this.forgetTheSnap();
    this.hideSVG();
    this.clearShapeDragPreview();
  }
  clearShapeDragPreview() {
    this.sectionProperties.shapeDragPreviewPolygons = null;
    this.sectionProperties.shapeDragPreviewFills = null;
    this.sectionProperties.shapeDragPreviewRequestTime = null;
    this.sectionProperties.queuedShapeDragPreview = null;
    this.containerObject.requestReDraw();
  }
  drawShapeDragPreview() {
    const polygons = this.sectionProperties.shapeDragPreviewPolygons;
    if (!polygons)
      return;
    const fills = this.sectionProperties.shapeDragPreviewFills;
    this.context.save();
    this.context.strokeStyle = app.map.uiManager.isBackgroundDark() ? "white" : "black";
    this.context.lineWidth = app.dpiScale;
    for (let i = 0; i < polygons.length; i++) {
      const points = polygons[i];
      this.context.beginPath();
      this.context.moveTo(points[0][0] - this.position[0], points[0][1] - this.position[1]);
      for (let j = 1; j < points.length; j++)
        this.context.lineTo(points[j][0] - this.position[0], points[j][1] - this.position[1]);
      const fill = fills ? fills[i] : null;
      if (fill) {
        this.context.fillStyle = "#" + fill + "80";
        this.context.fill();
      }
      this.context.stroke();
    }
    this.context.restore();
  }
  onMouseDown(point, e) {
    Util.ensureValue(app.activeDocument);
    this.sectionProperties.viewedRectangleOnMouseDown = app.activeDocument.activeLayout.viewedRectangle.clone();
    this.sectionProperties.initialPosition = this.position.slice();
    this.sectionProperties.positionOnMouseDown = point.clone();
    this.sectionProperties.positionOnMouseDown.pX += this.position[0];
    this.sectionProperties.positionOnMouseDown.pY += this.position[1];
  }
  onMouseUp(point, e) {
    var _a;
    if (this.sectionProperties.svg)
      this.sectionProperties.svg.style.opacity = 1;
    this.hideSVG();
    if (this.containerObject.isDraggingSomething()) {
      app.map.fire("scrollvelocity", { vx: 0, vy: 0 });
      if (RenderManager.drawsFromObjects() && ((_a = GraphicSelection.extraInfo) == null ? void 0 : _a.isCropMode) !== true)
        return;
      point.x += app.activeDocument.activeLayout.viewedRectangle.x1 - this.sectionProperties.viewedRectangleOnMouseDown.x1;
      point.y += app.activeDocument.activeLayout.viewedRectangle.y1 - this.sectionProperties.viewedRectangleOnMouseDown.y1;
      this.sendTransformCommand(point);
    }
  }
  /// Looks for what the drag could line up with, and marks it.
  checkHelperLinesAndSnapPoints(size, position, dragDistance) {
    this.sectionProperties.snap.look(size, position, dragDistance);
    this.containerObject.requestReDraw();
  }
  // The picture sits this far from the top left corner of this section, in canvas pixels. The
  // section covers the frame of the object and the picture covers the drawing itself, so the
  // two move apart once the object is turned.
  getPictureOffset() {
    const rectangle = this.sectionProperties.pictureRectangle;
    if (!rectangle || !GraphicSelection.hasActiveSelection())
      return [0, 0];
    return [
      rectangle.pX1 - GraphicSelection.rectangle.pX1,
      rectangle.pY1 - GraphicSelection.rectangle.pY1
    ];
  }
  constrainDragToSheetArea(dragDistance) {
    if (app.map.getDocType() === "spreadsheet") {
      const calcGridSection = app.sectionContainer.getSectionWithName(app.CSections.CalcGrid.name);
      const rowHeaderSection = app.sectionContainer.getSectionWithName(app.CSections.RowHeader.name);
      const columnHeaderSection = app.sectionContainer.getSectionWithName(app.CSections.ColumnHeader.name);
      if (calcGridSection && rowHeaderSection && columnHeaderSection) {
        dragDistance[0] = Math.max(calcGridSection.myTopLeft[0] - this.myTopLeft[0] - columnHeaderSection.getHeaderInfo().getDocVisStart(), dragDistance[0]);
        dragDistance[1] = Math.max(calcGridSection.myTopLeft[1] - this.myTopLeft[1] - rowHeaderSection.getHeaderInfo().getDocVisStart(), dragDistance[1]);
        if (this.sectionProperties.svg) {
          const pictureOffset = this.getPictureOffset();
          const cropLeft = Math.max(calcGridSection.myTopLeft[0] - this.myTopLeft[0] - pictureOffset[0] - dragDistance[0], 0) / app.dpiScale;
          const cropTop = Math.max(calcGridSection.myTopLeft[1] - this.myTopLeft[1] - pictureOffset[1] - dragDistance[1], 0) / app.dpiScale;
          this.sectionProperties.svg.style.clipPath = `inset(${cropTop}px 0px 0px ${cropLeft}px)`;
        }
      }
    }
  }
  onMouseMove(position, dragDistance) {
    var _a, _b;
    let canDrag = (GraphicSelection.inPlaceActive || !app.file.textCursor.visible) && ((_a = GraphicSelection.extraInfo) == null ? void 0 : _a.isDraggable) !== false;
    if (canDrag && app.map.getDocType() === "presentation") {
      const deleteRowsState = app.map.stateChangeHandler.getItemValue(".uno:DeleteRows");
      canDrag = deleteRowsState ? deleteRowsState === "disabled" : true;
    }
    if (RenderManager.drawsFromObjects() && ((_b = GraphicSelection.extraInfo) == null ? void 0 : _b.isCropMode) !== true)
      return;
    if (this.containerObject.isDraggingSomething() && canDrag) {
      this.constrainDragToSheetArea(dragDistance);
      if (!app.activeDocument.activeLayout.viewedRectangle.equals(this.sectionProperties.viewedRectangleOnMouseDown.toArray())) {
        const diff = new cool.SimplePoint(app.activeDocument.activeLayout.viewedRectangle.x1 - this.sectionProperties.viewedRectangleOnMouseDown.x1, app.activeDocument.activeLayout.viewedRectangle.y1 - this.sectionProperties.viewedRectangleOnMouseDown.y1);
        this.setPosition(this.sectionProperties.initialPosition[0] + diff.pX, this.sectionProperties.initialPosition[1] + diff.pY);
      }
      if (this.sectionProperties.svg) {
        const addition = app.map._docLayer.isCalcRTL() ? -this.size[0] : 0;
        const pictureOffset = this.getPictureOffset();
        this.sectionProperties.svg.style.left = String((this.myTopLeft[0] + pictureOffset[0] + dragDistance[0] + addition) / app.dpiScale) + "px";
        this.sectionProperties.svg.style.top = String((this.myTopLeft[1] + pictureOffset[1] + dragDistance[1]) / app.dpiScale) + "px";
        this.sectionProperties.svg.style.opacity = 0.5;
      }
      this.sectionProperties.lastDragDistance = [dragDistance[0], dragDistance[1]];
      this.checkHelperLinesAndSnapPoints(this.size, this.position, dragDistance);
      this.showSVG();
      if (!this.containerObject.isMouseInside()) {
        position.pX += this.myTopLeft[0];
        position.pY += this.myTopLeft[1];
        app.map.fire("handleautoscroll", { pos: { x: position.cX, y: position.cY }, map: app.map });
      } else
        app.map.fire("scrollvelocity", { vx: 0, vy: 0 });
    }
  }
  getViewBox(svg) {
    let viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      viewBox = viewBox.split(" ");
      for (let i = 0; i < viewBox.length; i++)
        viewBox[i] = parseInt(viewBox[i]);
    } else
      viewBox = null;
    return viewBox;
  }
  // The picture names the part of the document it covers in its viewBox, in 1/100 mm, and this
  // gives that part in twips. The selection rectangle holds the frame of the object instead,
  // and that frame grows once the object is turned. The answer is null for a sheet that runs
  // right to left, because the selection arrives mirrored there and the viewBox does not.
  getPictureRectangle(viewBox) {
    if (!viewBox || viewBox.length !== 4 || viewBox[2] <= 0 || viewBox[3] <= 0)
      return null;
    if (app.map._docLayer.isCalcRTL())
      return null;
    const twipsPerUnit = 1440 / 2540;
    const rectangle = new cool.SimpleRectangle(viewBox[0] * twipsPerUnit, viewBox[1] * twipsPerUnit, viewBox[2] * twipsPerUnit, viewBox[3] * twipsPerUnit, GraphicSelection.rectangle.part, GraphicSelection.rectangle.mode);
    rectangle.moveBy(GraphicSelection.tileTwipsOffset);
    return rectangle;
  }
  // This gives the point the picture turns about, ready for the transform-origin style. Core
  // turns the object about the middle of the selection, and the middle of the picture element
  // is a different point, because that element is taller than the drawing it holds.
  getPictureRotationOrigin() {
    const rectangle = GraphicSelection.rectangle;
    const center = rectangle.center;
    const centerPoint = new cool.SimplePoint(center[0], center[1], rectangle.part, rectangle.mode);
    const left = parseFloat(this.sectionProperties.svg.style.left);
    const top = parseFloat(this.sectionProperties.svg.style.top);
    return centerPoint.vX / app.dpiScale - left + "px " + (centerPoint.vY / app.dpiScale - top) + "px";
  }
  adjustSVGProperties() {
    if (this.sectionProperties.svg && this.sectionProperties.svg.style.display === "" && GraphicSelection.hasActiveSelection()) {
      const viewBox = this.getViewBox(this.sectionProperties.svg.children[0]);
      const isImage = this.sectionProperties.svg.querySelectorAll(".Graphic").length > 0;
      this.sectionProperties.pictureRectangle = isImage ? null : this.getPictureRectangle(viewBox);
      const rectangle = this.sectionProperties.pictureRectangle ?? GraphicSelection.rectangle;
      const widthText = rectangle.cWidth + "px";
      const heightText = rectangle.cHeight + "px";
      const clientRect = this.sectionProperties.svg.children[0].getBoundingClientRect();
      if (viewBox && !isImage && clientRect.width > 0 && clientRect.height > 0) {
        this.sectionProperties.svg.children[0].style.width = widthText;
        this.sectionProperties.svg.children[0].style.height = heightText;
      } else {
        this.sectionProperties.svg.style.width = widthText;
        this.sectionProperties.svg.style.height = heightText;
        if (isImage) {
          this.sectionProperties.svg.children[0].style.width = widthText;
          this.sectionProperties.svg.children[0].style.height = heightText;
        }
      }
      this.updateSVGPosition();
    }
    this.hideSVG();
  }
  // Shared positioning logic used by both adjustSVGProperties (initial
  // placement) and onNewDocumentTopLeft (viewport change update).
  updateSVGPosition() {
    if (!this.sectionProperties.svg || !GraphicSelection.hasActiveSelection())
      return;
    const rectangle = this.sectionProperties.pictureRectangle ?? GraphicSelection.rectangle;
    const left = rectangle.v1X;
    const top = rectangle.v1Y;
    this.sectionProperties.svg.style.left = Math.round(left / app.dpiScale) + "px";
    this.sectionProperties.svg.style.top = Math.round(top / app.dpiScale) + "px";
    this.sectionProperties.svgPosition = [left, top];
  }
  onNewDocumentTopLeft() {
    if (this.sectionProperties.svgPosition) {
      this.updateSVGPosition();
    }
  }
  drawSelectionFrame() {
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.beginPath();
    this.context.strokeStyle = app.map.uiManager.isBackgroundDark() ? "white" : "black";
    this.context.setLineDash([3, 3]);
    const draggedFromHere = this.containerObject.targetSection === this.name || this.containerObject.targetSection === app.CSections.PreviewEdit.name;
    if (this.containerObject.isDraggingSomething() && draggedFromHere) {
      const rectangle = this.boundingRectangle.clone();
      rectangle.pX1 += app.calc.isRTL() ? -this.sectionProperties.lastDragDistance[0] : this.sectionProperties.lastDragDistance[0];
      rectangle.pY1 += this.sectionProperties.lastDragDistance[1];
      this.drawViewRectangle(rectangle);
    } else if (this.containerObject.isDraggingSomething() && this.sectionProperties.inPlaceResizeRectangle)
      this.drawViewRectangle(this.sectionProperties.inPlaceResizeRectangle);
    else
      this.drawViewRectangle(this.boundingRectangle);
    this.context.setLineDash([]);
    this.context.closePath();
    this.context.restore();
  }
  onDraw() {
    if (!RenderManager.drawsFromObjects())
      this.drawSelectionFrame();
    this.drawShapeDragPreview();
    if (!this.showSection || !this.isVisible)
      this.hideSVG();
    else
      this.sectionProperties.snap.draw(this);
  }
  /*
      Shows what a scaling drag would do to the shape, by taking the picture of it to the size
      and the place the drag leads to. One picture stands for the whole selection, so it
      follows the object the drag works on. Does nothing while there is no picture to take.
  */
  scalePreviewTo(shapeRecProps, objectNumber = 0) {
    var _a;
    const svg = this.sectionProperties.svg;
    if (!svg)
      return;
    const shape = this.sectionProperties.shapeRectangleProperties[objectNumber];
    if (!shape)
      return;
    let scaleX = shapeRecProps.width / shape.width;
    let scaleY = shapeRecProps.height / shape.height;
    if (((_a = GraphicSelection.extraInfo) == null ? void 0 : _a.typeString) === "ole2") {
      scaleX = Math.abs(scaleX);
      scaleY = Math.abs(scaleY);
    }
    const diffX = (shapeRecProps.center.pX - shape.center.pX) / app.dpiScale;
    const diffY = (shapeRecProps.center.pY - shape.center.pY) / app.dpiScale;
    svg.children[0].style.transform = "translate(" + Math.round(diffX) + "px, " + Math.round(diffY) + "px)rotate(" + -shapeRecProps.angleRadian + "rad) scale(" + scaleX + ", " + scaleY + ") rotate(" + shapeRecProps.angleRadian + "rad)";
    this.showSVG();
  }
  removeSubSections() {
    this.removeSVG();
    for (let i = 0; i < this.sectionProperties.subSections.length; i++) {
      this.containerObject.removeSection(this.sectionProperties.subSections[i].name);
    }
  }
  onContextMenu(point, e) {
    MouseControl.contextMenuFrom(this, point, e);
  }
  hideSubSections() {
    for (let i = 0; i < this.sectionProperties.subSections.length; i++)
      this.sectionProperties.subSections[i].setShowSection(false);
  }
  onClick(point, e) {
    point.pX += this.position[0];
    point.pY += this.position[1];
    var modifier = MouseControl.readModifier(e);
    const clickX = point.x;
    const clickY = point.y;
    if (this.sectionProperties.clickTimer) {
      app.timerRegistry.clearTimeout(this.sectionProperties.clickTimer);
      this.sectionProperties.clickTimer = null;
    }
    this.sectionProperties.clickTimer = app.timerRegistry.setTimeout("shapeClickTimer", () => {
      app.map._docLayer._postMouseEvent("buttondown", clickX, clickY, 1, 1, modifier);
      app.map._docLayer._postMouseEvent("buttonup", clickX, clickY, 1, 1, modifier);
      this.sectionProperties.clickTimer = null;
    }, 250);
    if (e.pointerType === "touch") {
      if (this.sectionProperties.lastTapTime && Date.now() - this.sectionProperties.lastTapTime < 250) {
        point.pX -= this.position[0];
        point.pY -= this.position[1];
        this.onDoubleClick(point, e);
      }
      this.sectionProperties.lastTapTime = Date.now();
    }
    if (this.sectionProperties.hasVideo && this.sectionProperties.svg) {
      const videoObject = this.sectionProperties.svg.querySelector("video");
      if (videoObject) {
        this.sectionProperties.svg.style.opacity = 1;
        this.sectionProperties.svg.style.pointerEvents = "";
        this.hideSubSections();
      }
    }
  }
  onDoubleClick(point, e) {
    if (this.sectionProperties.clickTimer) {
      app.timerRegistry.clearTimeout(this.sectionProperties.clickTimer);
      this.sectionProperties.clickTimer = null;
    }
    if (app.map._docLayer.isCalcRTL()) {
      point.pX = -point.pX + this.position[0];
    } else {
      point.pX += this.position[0];
    }
    point.pY += this.position[1];
    app.map._docLayer._postMouseEvent("buttondown", point.x, point.y, 2, 1, 0);
    app.map._docLayer._postMouseEvent("buttonup", point.x, point.y, 2, 1, 0);
  }
}
app.definitions.shapeHandlesSection = ShapeHandlesSection;
