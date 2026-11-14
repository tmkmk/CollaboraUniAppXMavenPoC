const _ShapeHandleAnchorSubSection = class _ShapeHandleAnchorSubSection extends HTMLObjectSection {
  // CSS pixels.
  constructor(parentHandlerSection, sectionName, size, documentPosition, ownInfo) {
    super(sectionName, size[0], size[1], documentPosition, "anchor-marker");
    this.sectionProperties.parentHandlerSection = parentHandlerSection;
    this.sectionProperties.ownInfo = ownInfo;
  }
  onMouseEnter() {
    this.backgroundColor = "grey";
    this.context.canvas.style.cursor = "url(" + app.LOUtil.getURL("images/cursors/grab.svg") + ") 12 12, grab";
    this.containerObject.requestReDraw();
  }
  onMouseLeave() {
    this.backgroundColor = null;
    this.containerObject.requestReDraw();
  }
  tableMouseUp(point, e) {
    const parameters = {
      "TransformPosX": {
        "type": "long",
        "value": Math.round((point.pX + this.position[0]) * app.pixelsToTwips)
      },
      "TransformPosY": {
        "type": "long",
        "value": Math.round((point.pY + this.position[1]) * app.pixelsToTwips)
      }
    };
    app.map.sendUnoCommand(".uno:TransformDialog", parameters);
  }
  shapeMouseUp(point, e) {
    const parameters = {
      ...ShapeHandlesSection.handleParameters(this.sectionProperties.ownInfo),
      "NewPosX": {
        "type": "long",
        "value": Math.round((point.pX + this.position[0]) * app.pixelsToTwips)
      },
      "NewPosY": {
        "type": "long",
        "value": Math.round((point.pY + this.position[1]) * app.pixelsToTwips)
      }
    };
    app.map.sendUnoCommand(".uno:MoveShapeHandle", parameters);
  }
  onMouseUp(point, e) {
    if (this.containerObject.isDraggingSomething()) {
      if (this.sectionProperties.parentHandlerSection) {
        this.shapeMouseUp(point, e);
      } else {
        this.tableMouseUp(point, e);
      }
      this.sectionProperties.parentHandlerSection.hideSVG();
    }
  }
  onMouseMove(point, dragDistance, e) {
    if (this.containerObject.isDraggingSomething()) {
      let svg;
      let initialPosition;
      if (this.sectionProperties.parentHandlerSection) {
        this.sectionProperties.parentHandlerSection.showSVG();
        svg = this.sectionProperties.parentHandlerSection.sectionProperties.svg;
        initialPosition = this.sectionProperties.parentHandlerSection.sectionProperties.svgPosition;
      } else {
        svg = document.getElementById("canvas-container").querySelector("svg");
        svg.style.display = "";
        if (!this.sectionProperties.initialPosition) {
          this.sectionProperties.initialPosition = [parseFloat(svg.style.left.replace("px", "")) * app.dpiScale, parseFloat(svg.style.top.replace("px", "")) * app.dpiScale];
        }
        initialPosition = this.sectionProperties.initialPosition;
      }
      svg.style.left = (dragDistance[0] + initialPosition[0]) / app.dpiScale + "px";
      svg.style.top = (dragDistance[1] + initialPosition[1]) / app.dpiScale + "px";
    }
  }
};
_ShapeHandleAnchorSubSection.tableAnchorIconSize = [20, 20];
let ShapeHandleAnchorSubSection = _ShapeHandleAnchorSubSection;
