/*
 * roo-text.js
 * Live, resolution-independent Roo display text for a game HUD.
 *
 * One real <text> object holds the glyph geometry; every visible layer
 * (soft shadow / gradient face + bevel / lit inner rim / gloss) is a <use>
 * that references it, so the coloured letter keeps Roo's exact silhouette at
 * any size.
 *
 * MODIFIED from the roo-web drop to match this game's reference art: the
 * keyline, the hard offset copy and the layered extrusion are gone, one soft
 * shadow at half strength stands in for all of it, and layout is driven by a
 * fixed cap band instead of each string's own ink box so every readout shares
 * a size and a baseline. Not a clean drop-in target any more.
 *
 * Hardening vs. the original concept: the face / rim / gloss gradients use
 * gradientUnits="userSpaceOnUse" with coordinates set from the measured
 * bounding box in layout(). objectBoundingBox gradients painted through a
 * <use> of <text> are unreliable in Safari/Firefox; userSpaceOnUse is not.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// Tuned against the Crash reference plates: a saturated vertical gradient
// face, ONE soft drop shadow, and a bright inner rim that is opaque along the
// top of each glyph and fades out toward the base. No keyline, no extrusion
// stack, no hard offset copy — the reference has none of those, and stacking
// them under a HUD readout only muddied it.
export const PALETTES = {
  bonus: {
    faceStops: [
      [0.0, "#d8ff4a"],
      [0.16, "#6dfb1e"],
      [0.4, "#12e05a"],
      [0.62, "#06c9a0"],
      [0.8, "#00a8f0"],
      [1.0, "#1436c8"],
    ],
    // third value is stop-opacity: the rim is a lit top edge, not a full
    // outline, so it fades as it comes down the glyph
    rimStops: [
      [0.0, "#f6ffc2", 1],
      [0.26, "#c4ff4a", 0.9],
      [0.55, "#48ffd0", 0.55],
      [0.8, "#5ad2ff", 0.3],
      [1.0, "#7fa8ff", 0.12],
    ],
    bevelHighlight: "#f1ff9a",
    bevelShadow: "#00307d",
    shadow: "#000108",
  },
  counter: {
    faceStops: [
      [0.0, "#fff3a0"],
      [0.18, "#ffd91f"],
      [0.45, "#ff9a08"],
      [0.72, "#f04b12"],
      [1.0, "#a81208"],
    ],
    rimStops: [
      [0.0, "#fffde0", 1],
      [0.28, "#ffef7a", 0.9],
      [0.6, "#ffb63c", 0.5],
      [1.0, "#ff8a45", 0.14],
    ],
    bevelHighlight: "#fffcc8",
    bevelShadow: "#7d1206",
    shadow: "#0a0300",
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

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/* The face's own cap band at font-size 200, measured ONCE from a reference
 * string and shared by every label. Layout keys off this rather than the ink
 * box of whatever string a label happens to be showing, so "0" and "0/23" and
 * "BOARDSLIDE" all render at the same cap height and sit on one baseline. */
let BAND = null;
function measureBand(glyph, probe) {
  if (BAND) return BAND;
  const previous = glyph.textContent;
  glyph.textContent = "HXO0AWM8"; // caps + digits: the tallest ordinary run
  const b = probe.getBBox();
  glyph.textContent = previous;
  if (Number.isFinite(b.height) && b.height > 0) {
    BAND = { top: b.y, height: b.height };
  }
  return BAND ?? { top: -150, height: 150 };
}

/**
 * Creates live Roo display text inside `host`.
 *
 * @param {HTMLElement} host
 * @param {{
 *   text?: string,
 *   palette?: "bonus" | "counter",
 *   tracking?: number
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
    "flood-opacity": "0.45",
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

  // Three layers, and one soft shadow over the lot: gradient face, lit inner
  // rim, gloss. (The keyline, the hard offset copy and the extrusion stack
  // that used to sit under these are gone — see PALETTES.)
  const stage = svgElement("g", { filter: `url(#${ids.shadowFilter})` });

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

    // THE BAND, NOT THE INK. Every effect and the whole viewBox are sized
    // from a FIXED cap band measured once from a reference string, never
    // from this particular string's ink box. Two labels of different content
    // therefore scale identically and share a baseline — sizing off the ink
    // is what gave the HUD its randomly different letter sizes and the big
    // uneven gaps above each readout, because a string with no descender
    // measured shorter and got blown up to fill the same box.
    const band = measureBand(glyph, face);
    const height = band.height;
    const top = band.top;

    // Vertical gradients follow that same fixed band.
    for (const g of [faceGradient, rimGradient, glossGradient]) {
      g.setAttribute("x1", box.x);
      g.setAttribute("x2", box.x);
      g.setAttribute("y1", top);
      g.setAttribute("y2", top + height);
    }

    // Every effect is proportional to the band.
    const innerRimWidth = height * 0.035;
    const bevelSize = height * 0.013;
    const bevelBlur = height * 0.002;
    const ambientSize = height * 0.01;
    const softShadowX = height * 0.04;
    const softShadowY = height * 0.075;
    const softShadowBlur = height * 0.03;

    innerRim.setAttribute("stroke-width", innerRimWidth);

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

    // Padding only has to clear the rim and the one soft shadow now, so the
    // letters fill far more of the box than they used to — the same host
    // height renders noticeably larger type.
    const leftPadding = height * 0.06;
    const topPadding = height * 0.06;
    const rightPadding = height * 0.06 + softShadowX + softShadowBlur * 3;
    const bottomPadding = height * 0.06 + softShadowY + softShadowBlur * 3;

    // Height comes from the fixed band; width still follows the real ink.
    const viewX = box.x - leftPadding;
    const viewY = top - topPadding;
    const viewWidth = box.width + leftPadding + rightPadding;
    const viewHeight = height + topPadding + bottomPadding;

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
