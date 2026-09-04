import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [flow, surface] = await Promise.all([
  readFile(`${root}src/gameFlowUI.ts`, "utf8"),
  readFile(`${root}src/gameFlowSurface.ts`, "utf8"),
]);

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

function blockAfter(source, marker) {
  const markerAt = source.indexOf(marker);
  if (markerAt < 0) return "";
  const openAt = source.indexOf("{", markerAt + marker.length);
  if (openAt < 0) return "";
  let depth = 0;
  let quote = "";
  let lineComment = false;
  let blockComment = false;
  for (let index = openAt; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") {
        index++;
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}" && --depth === 0)
      return source.slice(openAt + 1, index);
  }
  return "";
}

const cssMarker = "style.textContent = `";
const cssStart = flow.indexOf(cssMarker);
const cssEnd = cssStart < 0 ? -1 : flow.indexOf("\n    `;", cssStart);
const css = cssStart < 0 || cssEnd < 0
  ? ""
  : flow
      .slice(cssStart + cssMarker.length, cssEnd)
      .replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [];
for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  rules.push({
    selector: match[1].replace(/\s+/g, " ").trim(),
    body: match[2],
  });
}

const rulesMentioning = (selector) =>
  rules.filter((rule) => rule.selector.includes(selector));
const exactRules = (selector) =>
  rules.filter((rule) =>
    rule.selector
      .split(",")
      .map((part) => part.trim())
      .includes(selector),
  );
const declaration = (body, property) =>
  new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(body)?.[1]?.trim() ?? null;
const stableInCompositedMode = (selector, property) =>
  rules.some(
    (rule) =>
      rule.selector.includes("precrt-composited") &&
      rule.selector.includes(selector) &&
      declaration(rule.body, property) === "none",
  );
const hasNonNoneDeclaration = (selector, property) =>
  exactRules(selector).some((rule) => {
    const value = declaration(rule.body, property);
    return value !== null && value !== "none";
  });

// Cached geometry must not sample scale/rotation transitions at an arbitrary
// in-between frame. DOM fallback may retain flourish only if shader mode has an
// explicit stable override before snapshotGameFlowSurface measures it.
for (const selector of [
  ".game-menu-button.selected",
  ".game-save-slot.selected",
  ".game-menu-button:hover:not(:disabled)",
  ".game-launch-card",
  ".game-pause-preview",
  ".game-pause-actions",
  ".game-results-card",
]) {
  expect(
    !hasNonNoneDeclaration(selector, "transform") ||
      stableInCompositedMode(selector, "transform"),
    `${selector} feeds transform-driven geometry into the cached surface`,
  );
}

for (const selector of [".game-menu-button", ".game-over-mask-fallback"]) {
  expect(
    !hasNonNoneDeclaration(selector, "transition") ||
      stableInCompositedMode(selector, "transition"),
    `${selector} can be cached midway through a CSS transition`,
  );
}
expect(
  !hasNonNoneDeclaration(".game-shell-panel", "transition"),
  "the DOM/pre-CRT visibility handoff must be atomic, not an opacity crossfade",
);

// A stationary pointer must not keep a second row orange after keyboard or
// gamepad selection moves. Hover decoration is valid only on the semantic
// selected row (pointerenter makes that row selected first).
for (const rule of rulesMentioning(":hover")) {
  if (!rule.selector.includes(".game-menu-button")) continue;
  const paintsHighlight =
    declaration(rule.body, "color") !== null ||
    declaration(rule.body, "background") !== null ||
    declaration(rule.body, "filter") !== null;
  expect(
    !paintsHighlight || rule.selector.includes(".selected"),
    "an unselected :hover row can remain visually highlighted after keyboard navigation",
  );
}

const setComposited = blockAfter(flow, "setPreCrtComposited(");
const drawPreCrt = blockAfter(flow, "drawPreCrt(");
expect(setComposited, "setPreCrtComposited could not be inspected");
expect(drawPreCrt, "drawPreCrt could not be inspected");
expect(
  !/classList\.add\(\s*["']precrt-composited/.test(setComposited) &&
    !/classList\.toggle\(\s*["']precrt-composited["']\s*,\s*composited/.test(
      setComposited,
    ),
  "requesting pre-CRT mode hides the DOM before a surface draw succeeds",
);
const surfaceDrawAt = drawPreCrt.indexOf("this.gameFlowSurface.drawPreCrt");
const visualCommitAt = drawPreCrt.search(
  /classList\.(?:add|toggle)\([^)]*precrt-composited/,
);
expect(
  surfaceDrawAt >= 0 && visualCommitAt > surfaceDrawAt,
  "drawPreCrt must commit transparent DOM only after the cached quad draws",
);
expect(
  /classList\.toggle\(\s*["']precrt-composited["']\s*,\s*\w+\s*\)/.test(
    drawPreCrt,
  ) ||
    /if\s*\(\s*\w+[^)]*\)[\s\S]{0,320}classList\.add\(\s*["']precrt-composited/.test(
      drawPreCrt,
    ),
  "a failed/empty surface draw must atomically retain the visible DOM fallback",
);

const shellPointer = exactRules(".game-shell")
  .map((rule) => declaration(rule.body, "pointer-events"))
  .find(Boolean);
expect(
  shellPointer === "none",
  "the full-screen semantic shell must pass pointer hits through to debug chrome",
);
expect(
  exactRules(".game-menu-button").some(
    (rule) => declaration(rule.body, "pointer-events") === "auto",
  ),
  "real menu buttons must opt back into pointer hit-testing",
);
expect(
  /window\.addEventListener\(\s*["']pointermove["']/.test(flow),
  "the sharp cursor must track on window when the shell itself passes pointers through",
);

const buttonMethod = blockAfter(flow, "private button(");
expect(buttonMethod, "GameFlowUI.button could not be inspected");
expect(
  /addEventListener\(\s*["']pointerenter["']/.test(buttonMethod),
  "pointer hover must still select the semantic menu action",
);
expect(
  /pointerSelectionArmed/.test(buttonMethod) &&
    /this\.pointerSelectionArmed = false/.test(flow) &&
    /window\.addEventListener\(\s*["']pointermove["'][\s\S]{0,900}this\.selectPointerButton/.test(
      flow,
    ),
  "a stationary pointer must not steal the default selection after a submenu render",
);
expect(
  /addEventListener\(\s*["']focus["']/.test(buttonMethod),
  "native/programmatic focus must synchronize the Canvas selection state",
);
expect(
  /precrt-composited[^\n{]*\.game-menu-button:focus-visible\s*\{[^}]*outline\s*:\s*none/.test(
    css,
  ),
  "native focus chrome must stay below the shader-rendered focus indicator",
);

// M reveals developer chrome over game screens. Those body children cannot
// remain inert/aria-hidden, and their elevated layer must stay below the fade
// curtain so transitions retain ownership.
for (const selector of [
  ".side-wrap",
  "[data-crt-guest-panel-host]",
  "[data-render-quality-panel-host]",
  "[data-skateboard-panel-host]",
  "[data-spin-panel-host]",
  "visual-treatment-panel",
  ".ed-panel",
  ".pst",
]) {
  expect(flow.includes(selector), `developer-chrome selector missing: ${selector}`);
}
const claimModal = blockAfter(flow, "private claimModalFocus(");
expect(
  /matches\([^)]*(?:debug|developer)/i.test(claimModal) ||
    /(?:debug|developer)[A-Za-z]*\(child\)/i.test(claimModal),
  "claimModalFocus must exempt visible developer chrome from inert/aria-hidden",
);
const zOf = (selector) => {
  for (const rule of exactRules(selector)) {
    const value = declaration(rule.body, "z-index");
    if (value && /^\d+$/.test(value)) return Number(value);
  }
  return null;
};
const shellZ = zOf(".game-shell");
const curtainZ = zOf(".game-transition-curtain");
const elevatedRule = rules.find(
  (rule) =>
    (rule.selector.includes("game-debug-visible") ||
      (rule.selector.includes("game-shell-modal") &&
        rule.selector.includes("game-debug-hidden"))) &&
    rule.selector.includes(".side-wrap") &&
    declaration(rule.body, "z-index") !== null,
);
const debugZ = elevatedRule
  ? Number.parseInt(declaration(elevatedRule.body, "z-index"), 10)
  : Number.NaN;
expect(
  shellZ !== null && curtainZ !== null &&
    Number.isFinite(debugZ) && debugZ > shellZ && debugZ < curtainZ,
  "visible debug chrome must be above the menu hit plane and below its transition curtain",
);

expect(
  /addEventListener\(\s*["']scroll["'][\s\S]{0,180}invalidatePreCrt/.test(flow),
  "scrolling a modal must invalidate geometry before invisible hit boxes drift from Canvas",
);
expect(
  /new ResizeObserver\([\s\S]{0,180}invalidatePreCrt/.test(flow) &&
    /\.observe\(this\.(?:root|panel)\)/.test(flow),
  "element resize observation must invalidate cached menu geometry",
);
expect(
  /window\.addEventListener\(\s*["']resize["'][\s\S]{0,120}invalidatePreCrt/.test(
    flow,
  ),
  "viewport resize must invalidate cached menu geometry",
);

const captureGameplay = blockAfter(flow, "captureGameplay(");
expect(
  /const targetWidth = 640;[\s\S]{0,80}const targetHeight = 360;/.test(
    captureGameplay,
  ) &&
    /sourceAspect > targetAspect[\s\S]{0,420}context\.drawImage\([\s\S]{0,220}sourceWidth,[\s\S]{0,80}sourceHeight/.test(
      captureGameplay,
    ),
  "pause thumbnail must use a stable 16:9 cover crop instead of resizing or stretching",
);

// A 4K/retina post target must not force a same-sized Canvas2D upload. Keep
// compositing at the requested target size, but cap the raster source.
const rasterCap = surface.match(
  /const\s+[A-Z0-9_]*MAX[A-Z0-9_]*RASTER[A-Z0-9_]*\s*=\s*([\d_]+)/,
);
expect(
  rasterCap && Number(rasterCap[1].replaceAll("_", "")) > 0,
  "GameFlowSurface needs an explicit finite Canvas raster cap",
);
const surfaceDraw = blockAfter(surface, "drawPreCrt(");
expect(
  !/ensureSize\(resources,\s*width,\s*height\)/.test(surfaceDraw) &&
    /(?:raster|canvas|capped|scaled)[A-Za-z]*(?:Width|Size)/i.test(surfaceDraw),
  "drawPreCrt must size Canvas storage from capped raster dimensions",
);

expect(
  /\.game-save-slot:disabled/.test(surface) &&
    /localOpacity\s*>?=\s*0\.99[\s\S]{0,100}opacity\s*\*=\s*cssColorAlpha/.test(
      surface,
    ),
  "slot child text must inherit one disabled opacity without multiplying rgba and element alpha",
);
const paintButton = blockAfter(surface, "private paintButton(");
expect(
  /ctx\.globalAlpha\s*=\s*button\.opacity/.test(paintButton) &&
    !/button\.disabled\s*\?/.test(paintButton),
  "paintButton must consume precomputed opacity instead of multiplying disabled alpha again",
);
expect(
  (() => {
    const disabledRule = exactRules(".game-menu-button:disabled")[0];
    if (!disabledRule) return false;
    const opacity = Number.parseFloat(
      declaration(disabledRule.body, "opacity") ?? "1",
    );
    const color = declaration(disabledRule.body, "color") ?? "";
    const alpha = /rgba?\([^)]*[\s,/](0?\.\d+|\d+%)\s*\)/i.exec(color)?.[1];
    const colorAlpha = alpha
      ? alpha.endsWith("%")
        ? Number.parseFloat(alpha) / 100
        : Number.parseFloat(alpha)
      : 1;
    return Number(opacity < 0.999) + Number(colorAlpha < 0.999) === 1;
  })(),
  "disabled state must use one alpha source (element opacity or color alpha), never both",
);

if (failures.length) {
  throw new Error(
    `GameFlow interaction/layout contract failed (${failures.length}):\n- ${failures.join("\n- ")}`,
  );
}

console.log(
  "Validated stable GameFlow geometry, atomic composition, debug passthrough, and capped Canvas state.",
);
