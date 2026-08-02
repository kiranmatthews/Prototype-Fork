/*
 * roo-text.js
 * Live, resolution-independent Roo display text for a game HUD.
 *
 * One real <text> object holds the glyph geometry; every visible layer
 * (shadow / extrusion / outline / face / bevel / inner rim / gloss) is a
 * <use> that references it, so the coloured letter keeps Roo's exact
 * silhouette at any size.
 *
 * Hardening vs. the original concept: the face / rim / gloss gradients use
 * gradientUnits="userSpaceOnUse" with coordinates set from the measured
 * bounding box in layout(). objectBoundingBox gradients painted through a
 * <use> of <text> are unreliable in Safari/Firefox; userSpaceOnUse is not.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

export const PALETTES = {
  bonus: {
    faceStops: [
      [0.0, "#dcff26"],
      [0.13, "#75ff0a"],
      [0.37, "#18e34f"],
      [0.57, "#06d390"],
      [0.73, "#00b5ee"],
      [1.0, "#2045d9"],
    ],
    rimStops: [
      [0.0, "#f5ff82"],
      [0.28, "#b9ff25"],
      [0.58, "#47f5a1"],
      [0.82, "#37cfff"],
      [1.0, "#6780ff"],
    ],
    outline: "#01030a",
    extrusionNear: "#0873c7",
    extrusionFar: "#00102e",
    bevelHighlight: "#f1ff9a",
    bevelShadow: "#003283",
    shadow: "#000108",
    hardShadow: "#000106",
  },
  counter: {
    faceStops: [
      [0.0, "#fff65c"],
      [0.18, "#ffdc12"],
      [0.43, "#ffa20b"],
      [0.72, "#f35b13"],
      [1.0, "#bd1813"],
    ],
    rimStops: [
      [0.0, "#ffffc4"],
      [0.34, "#fff164"],
      [0.66, "#ffb530"],
      [1.0, "#ff7543"],
    ],
    outline: "#090101",
    extrusionNear: "#df4813",
    extrusionFar: "#4b0807",
    bevelHighlight: "#ffffb5",
    bevelShadow: "#8b1009",
    shadow: "#080000",
    hardShadow: "#030000",
  },
};

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, String(value));
    }
  }
  return element;
}

function useElement(id, attributes = {}) {
  return svgElement("use", { href: `#${id}`, ...attributes });
}

function uniqueId() {
  if (globalThis.crypto?.randomUUID) return `roo-${crypto.randomUUID()}`;
  return `roo-${Math.random().toString(36).slice(2)}`;
}

/* Vertical gradient in user space; coordinates are set later in layout(). */
function createGradient(id, stops) {
  const gradient = svgElement("linearGradient", {
    id,
    gradientUnits: "userSpaceOnUse",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1",
  });
  for (const [offset, color, opacity = 1] of stops) {
    gradient.append(
      svgElement("stop", {
        offset: `${offset * 100}%`,
        "stop-color": color,
        "stop-opacity": opacity,
      }),
    );
  }
  return gradient;
}

function parseHex(hex) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Invalid six-digit colour: ${hex}`);
  }
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function interpolateColour(start, end, amount) {
  const a = parseHex(start);
  const b = parseHex(end);
  const channel = (from, to) =>
    Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(a.r, b.r)}${channel(a.g, b.g)}${channel(a.b, b.b)}`;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Creates live Roo display text inside `host`.
 *
 * @param {HTMLElement} host
 * @param {{
 *   text?: string,
 *   palette?: "bonus" | "counter",
 *   tracking?: number,
 *   extrusionSteps?: number,
 *   depthX?: number,
 *   depthY?: number
 * }} [options]
 * @returns {Promise<{ element: SVGSVGElement, setText(v: string): Promise<void>, destroy(): void }>}
 */
export async function createRooText(host, options = {}) {
  if (!(host instanceof HTMLElement)) {
    throw new TypeError("createRooText requires a valid host element.");
  }

  const state = {
    text: options.text ?? host.dataset.rooText ?? "BONUS",
    paletteName: options.palette ?? host.dataset.rooPalette ?? "bonus",
    // SVG units relative to a 200-unit font size.
    tracking: options.tracking ?? -2.5,
    extrusionSteps: options.extrusionSteps ?? 14,
    // Multiplied by measured glyph height.
    depthX: options.depthX ?? 0.038,
    depthY: options.depthY ?? 0.078,
  };

  const palette = PALETTES[state.paletteName];
  if (!palette) throw new Error(`Unknown Roo palette: ${state.paletteName}`);

  const id = uniqueId();
  const ids = {
    glyph: `${id}-glyph`,
    glyphClip: `${id}-glyph-clip`,
    faceGradient: `${id}-face`,
    rimGradient: `${id}-rim`,
    glossGradient: `${id}-gloss`,
    shadowFilter: `${id}-shadow`,
    bevelFilter: `${id}-bevel`,
  };

  host.classList.add("roo-text-host");
  host.replaceChildren();

  const svg = svgElement("svg", {
    class: "roo-text-svg",
    role: "img",
    "aria-label": state.text,
    preserveAspectRatio: "xMidYMid meet",
    overflow: "visible",
  });

  const defs = svgElement("defs");

  // The single source glyph. Every visible layer references this geometry.
  const glyph = svgElement("text", {
    id: ids.glyph,
    x: "0",
    y: "0",
    "font-family": "Roo",
    "font-size": "200",
    "font-weight": "400",
    "font-style": "normal",
    "letter-spacing": state.tracking,
    "text-rendering": "geometricPrecision",
  });
  glyph.style.fontKerning = "normal";
  glyph.style.fontSynthesis = "none";
  glyph.style.fontVariantLigatures = "none";
  glyph.style.whiteSpace = "pre";
  glyph.textContent = state.text;
  defs.append(glyph);

  const faceGradient = createGradient(ids.faceGradient, palette.faceStops);
  const rimGradient = createGradient(ids.rimGradient, palette.rimStops);
  const glossGradient = createGradient(ids.glossGradient, [
    [0.0, "#ffffff", 0.62],
    [0.08, "#ffffff", 0.44],
    [0.25, "#eaffc0", 0.2],
    [0.46, "#ffffff", 0.0],
    [1.0, "#ffffff", 0.0],
  ]);
  defs.append(faceGradient, rimGradient, glossGradient);

  // Silhouette used to clip a centred stroke down to its internal half.
  const clipPath = svgElement("clipPath", {
    id: ids.glyphClip,
    clipPathUnits: "userSpaceOnUse",
  });
  clipPath.append(useElement(ids.glyph));
  defs.append(clipPath);

  // Shape-following soft shadow applied to the whole composite.
  const shadowFilter = svgElement("filter", {
    id: ids.shadowFilter,
    filterUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  const shadowBlur = svgElement("feGaussianBlur", {
    in: "SourceAlpha",
    stdDeviation: "4",
    result: "shadow-blur",
  });
  const shadowOffset = svgElement("feOffset", {
    in: "shadow-blur",
    dx: "7",
    dy: "13",
    result: "shadow-offset",
  });
  const shadowColour = svgElement("feFlood", {
    "flood-color": palette.shadow,
    "flood-opacity": "0.9",
    result: "shadow-colour",
  });
  shadowFilter.append(
    shadowBlur,
    shadowOffset,
    shadowColour,
    svgElement("feComposite", {
      in: "shadow-colour",
      in2: "shadow-offset",
      operator: "in",
      result: "soft-shadow",
    }),
  );
  const shadowMerge = svgElement("feMerge");
  shadowMerge.append(
    svgElement("feMergeNode", { in: "soft-shadow" }),
    svgElement("feMergeNode", { in: "SourceGraphic" }),
  );
  shadowFilter.append(shadowMerge);
  defs.append(shadowFilter);

  // Directional bevel: offset the alpha and subtract to expose one edge set.
  const bevelFilter = svgElement("filter", {
    id: ids.bevelFilter,
    filterUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  const bevelHighlightOffset = svgElement("feOffset", {
    in: "SourceAlpha",
    dx: "2",
    dy: "2",
    result: "alpha-down-right",
  });
  bevelFilter.append(
    bevelHighlightOffset,
    svgElement("feComposite", {
      in: "SourceAlpha",
      in2: "alpha-down-right",
      operator: "out",
      result: "highlight-mask",
    }),
  );
  const bevelHighlightBlur = svgElement("feGaussianBlur", {
    in: "highlight-mask",
    stdDeviation: "0.25",
    result: "highlight-soft",
  });
  bevelFilter.append(
    bevelHighlightBlur,
    svgElement("feFlood", {
      "flood-color": palette.bevelHighlight,
      "flood-opacity": "0.76",
      result: "highlight-colour",
    }),
    svgElement("feComposite", {
      in: "highlight-colour",
      in2: "highlight-soft",
      operator: "in",
      result: "bevel-highlight",
    }),
  );
  const bevelShadowOffset = svgElement("feOffset", {
    in: "SourceAlpha",
    dx: "-2",
    dy: "-2",
    result: "alpha-up-left",
  });
  bevelFilter.append(
    bevelShadowOffset,
    svgElement("feComposite", {
      in: "SourceAlpha",
      in2: "alpha-up-left",
      operator: "out",
      result: "bevel-shadow-mask",
    }),
  );
  const bevelShadowBlur = svgElement("feGaussianBlur", {
    in: "bevel-shadow-mask",
    stdDeviation: "0.35",
    result: "bevel-shadow-soft",
  });
  bevelFilter.append(
    bevelShadowBlur,
    svgElement("feFlood", {
      "flood-color": palette.bevelShadow,
      "flood-opacity": "0.72",
      result: "bevel-shadow-colour",
    }),
    svgElement("feComposite", {
      in: "bevel-shadow-colour",
      in2: "bevel-shadow-soft",
      operator: "in",
      result: "bevel-shadow",
    }),
  );
  // Subtle full internal-edge darkening.
  const ambientErode = svgElement("feMorphology", {
    in: "SourceAlpha",
    operator: "erode",
    radius: "1.5",
    result: "ambient-eroded",
  });
  bevelFilter.append(
    ambientErode,
    svgElement("feComposite", {
      in: "SourceAlpha",
      in2: "ambient-eroded",
      operator: "out",
      result: "ambient-ring",
    }),
    svgElement("feFlood", {
      "flood-color": palette.bevelShadow,
      "flood-opacity": "0.12",
      result: "ambient-colour",
    }),
    svgElement("feComposite", {
      in: "ambient-colour",
      in2: "ambient-ring",
      operator: "in",
      result: "ambient-edge",
    }),
  );
  const bevelMerge = svgElement("feMerge");
  bevelMerge.append(
    svgElement("feMergeNode", { in: "SourceGraphic" }),
    svgElement("feMergeNode", { in: "ambient-edge" }),
    svgElement("feMergeNode", { in: "bevel-shadow" }),
    svgElement("feMergeNode", { in: "bevel-highlight" }),
  );
  bevelFilter.append(bevelMerge);
  defs.append(bevelFilter);

  svg.append(defs);

  // All visible layers share one soft shadow via the stage filter.
  const stage = svgElement("g", { filter: `url(#${ids.shadowFilter})` });

  const hardShadow = useElement(ids.glyph, {
    fill: palette.hardShadow,
    stroke: palette.hardShadow,
    "stroke-linejoin": "round",
    opacity: "0.88",
  });
  stage.append(hardShadow);

  const extrusionGroup = svgElement("g");
  const extrusionLayers = [];
  for (let index = state.extrusionSteps; index >= 1; index -= 1) {
    const amount = index / state.extrusionSteps;
    const layer = useElement(ids.glyph, {
      fill: interpolateColour(palette.extrusionNear, palette.extrusionFar, amount),
    });
    extrusionLayers.push({ element: layer, amount });
    extrusionGroup.append(layer);
  }
  stage.append(extrusionGroup);

  // Outer outline sits behind the face; the face covers the inner half of
  // the stroke so the coloured letter keeps Roo's exact silhouette.
  const outline = useElement(ids.glyph, {
    fill: palette.outline,
    stroke: palette.outline,
    "stroke-linejoin": "round",
    "stroke-miterlimit": "2",
  });
  stage.append(outline);

  const face = useElement(ids.glyph, {
    fill: `url(#${ids.faceGradient})`,
    filter: `url(#${ids.bevelFilter})`,
  });
  stage.append(face);

  // Internal-only rim: a centred stroke clipped to the glyph silhouette.
  const innerRim = useElement(ids.glyph, {
    fill: "none",
    stroke: `url(#${ids.rimGradient})`,
    "stroke-linejoin": "round",
    "stroke-miterlimit": "2",
    "clip-path": `url(#${ids.glyphClip})`,
    opacity: "0.96",
  });
  stage.append(innerRim);

  const gloss = useElement(ids.glyph, {
    fill: `url(#${ids.glossGradient})`,
    opacity: "0.36",
    "pointer-events": "none",
  });
  gloss.style.mixBlendMode = "screen";
  stage.append(gloss);

  svg.append(stage);
  host.append(svg);

  async function layout({ firstLayout = false } = {}) {
    // Ensure the specific glyphs are loaded before measuring.
    await document.fonts.load("400 200px Roo", state.text);
    await document.fonts.ready;
    await nextFrame();

    const box = face.getBBox();
    if (
      !Number.isFinite(box.width) ||
      !Number.isFinite(box.height) ||
      box.width <= 0 ||
      box.height <= 0
    ) {
      throw new Error(
        "Roo rendered with an invalid bounding box. Check the font URL and glyph coverage.",
      );
    }

    const height = box.height;

    // Vertical gradients follow the measured glyph band.
    for (const g of [faceGradient, rimGradient, glossGradient]) {
      g.setAttribute("x1", box.x);
      g.setAttribute("x2", box.x);
      g.setAttribute("y1", box.y);
      g.setAttribute("y2", box.y + height);
    }

    // Every effect is proportional to actual glyph height.
    const outlineWidth = height * 0.105;
    const innerRimWidth = height * 0.03;
    const depthX = height * state.depthX;
    const depthY = height * state.depthY;
    const hardShadowX = height * 0.027;
    const hardShadowY = height * 0.039;
    const bevelSize = height * 0.012;
    const bevelBlur = height * 0.0018;
    const ambientSize = height * 0.01;
    const softShadowX = height * 0.045;
    const softShadowY = height * 0.085;
    const softShadowBlur = height * 0.026;

    outline.setAttribute("stroke-width", outlineWidth);
    innerRim.setAttribute("stroke-width", innerRimWidth);

    hardShadow.setAttribute(
      "transform",
      `translate(${depthX + hardShadowX} ${depthY + hardShadowY})`,
    );
    hardShadow.setAttribute("stroke-width", outlineWidth * 1.08);

    for (const { element, amount } of extrusionLayers) {
      element.setAttribute("transform", `translate(${depthX * amount} ${depthY * amount})`);
    }

    bevelHighlightOffset.setAttribute("dx", bevelSize);
    bevelHighlightOffset.setAttribute("dy", bevelSize);
    bevelShadowOffset.setAttribute("dx", -bevelSize);
    bevelShadowOffset.setAttribute("dy", -bevelSize);
    bevelHighlightBlur.setAttribute("stdDeviation", bevelBlur);
    bevelShadowBlur.setAttribute("stdDeviation", bevelBlur * 1.25);
    ambientErode.setAttribute("radius", ambientSize);

    shadowOffset.setAttribute("dx", softShadowX);
    shadowOffset.setAttribute("dy", softShadowY);
    shadowBlur.setAttribute("stdDeviation", softShadowBlur);

    // Filter regions must be large enough that nothing is clipped.
    const leftPadding = height * 0.24;
    const topPadding = height * 0.25;
    const rightPadding = height * 0.28 + depthX + softShadowX + softShadowBlur * 3;
    const bottomPadding = height * 0.3 + depthY + softShadowY + softShadowBlur * 3;

    const viewX = box.x - leftPadding;
    const viewY = box.y - topPadding;
    const viewWidth = box.width + leftPadding + rightPadding;
    const viewHeight = box.height + topPadding + bottomPadding;

    for (const filter of [shadowFilter, bevelFilter]) {
      filter.setAttribute("x", viewX);
      filter.setAttribute("y", viewY);
      filter.setAttribute("width", viewWidth);
      filter.setAttribute("height", viewHeight);
    }

    svg.setAttribute("viewBox", `${viewX} ${viewY} ${viewWidth} ${viewHeight}`);

    if (firstLayout) svg.classList.add("is-ready");
  }

  await layout({ firstLayout: true });

  return {
    element: svg,
    async setText(value) {
      state.text = String(value);
      glyph.textContent = state.text;
      svg.setAttribute("aria-label", state.text);
      await layout();
    },
    destroy() {
      svg.remove();
    },
  };
}
