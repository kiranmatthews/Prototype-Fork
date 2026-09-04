import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path) => readFile(`${root}${path}`, "utf8");

const touch = await text("src/touch.ts");
const input = await text("src/input.ts");
const main = await text("src/main.ts");
const hud = await text("src/gameHudSurface.ts");
const ui = await text("src/ui.ts");

for (const contract of [
  "--tc-size: clamp(136px, 40dvh, 168px)",
  "--tc-left-edge: max(12px, env(safe-area-inset-left))",
  "--tc-right-edge: max(12px, env(safe-area-inset-right))",
  "--tc-bottom-edge: max(10px, env(safe-area-inset-bottom))",
  "--tc-top-edge: max(8px, env(safe-area-inset-top))",
  "button.className = 'tc-pause'",
  "button.setAttribute('aria-label', 'Pause game')",
  "width: 48px; height: 48px",
  "body.game-shell-modal .tc-pause",
  "body.ed-active .tc-pause",
  "bottom: calc(var(--tc-bottom-edge) + var(--tc-size) + 10px)",
  "body.tc-on.tool-panel-open .tc-zone",
  "body.tc-on.side-panel-left-open .tc-left",
  "body.tc-on.side-panel-right-open .tc-right",
  "body.tc-on .hud-life-row",
  "body.tc-on .hud-life-face-wrap",
  "body.tc-on .hud-special { inset: -6px; width: auto; }",
])
  assert.ok(touch.includes(contract), `touch layout missing ${contract}`);

for (const host of [
  "src/crt-guest/panel.ts",
  "src/render-quality/panel.ts",
  "src/skateboard/panel.ts",
  "src/spin-effects/panel.ts",
  "src/visual-treatment/panel.ts",
]) {
  const source = await text(host);
  assert.match(
    source,
    /launcher\.hidden\s*=\s*(?:[\s\S]{0,100})document\.body\.classList\.contains\("tc-on"\)/,
    `${host} must suppress its direct touch launcher`,
  );
}

assert.match(main, /const TOUCH_PRESENTATION = touchControlsRequested\(\)/);
assert.match(
  main,
  /const wantsPreCrtHud =\s*showHud && !TOUCH_PRESENTATION/,
  "touch must keep the responsive DOM HUD outside the pre-CRT mirror",
);
assert.match(
  main,
  /renderQualitySettings\.enabled &&\s*!TOUCH_PRESENTATION/,
  "touch must bypass fixed-resolution Render targets",
);
assert.match(main, /ui\.setPresentationTools\(\[/);
assert.match(input, /new TouchControls\(\(\) => \{[\s\S]{0,160}this\.pausePressed = true;/);
assert.match(main, /if \(input\.pausePressed\)[\s\S]{0,120}gameFlow\.handlePauseToggle\(\)/);
assert.match(main, /new MutationObserver\(syncToolPanelState\)/);
assert.match(ui, /setPresentationTools\(/);
assert.match(ui, /this\.rightSideWrap\.classList\.add\("collapsed"\)/);
assert.match(ui, /side-panel-\$\{side\}-open/);

assert.match(
  hud,
  /private ensureSize[\s\S]*?this\.texture\.dispose\(\);[\s\S]*?this\.canvas\.width = width;[\s\S]*?this\.canvas\.height = height;[\s\S]*?this\.texture\.needsUpdate = true;/,
  "CanvasTexture GPU storage must be reallocated before a rotated HUD upload",
);
assert.match(hud, /textureReallocations/);

const clamp = (minimum, value, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

function landscapeLayout(width, height, safe = { left: 0, right: 0, bottom: 0 }) {
  const size = clamp(136, height * 0.4, 168);
  const left = Math.max(12, safe.left);
  const right = Math.max(12, safe.right);
  const bottom = Math.max(10, safe.bottom);
  const top = height - bottom - size;
  const pad = { left, top, width: size, height: size };
  const cluster = {
    left: width - right - size,
    top,
    width: size,
    height: size,
  };
  const faceDiameter = size * 0.38;
  const lifeBottomEdge = height - (bottom + size + 10);
  return { size, pad, cluster, faceDiameter, lifeBottomEdge };
}

for (const [width, height, expected] of [
  [844, 390, 156],
  [667, 375, 150],
  [932, 430, 168],
  [1280, 720, 168],
]) {
  const layout = landscapeLayout(width, height);
  assert.equal(layout.size, expected, `${width}×${height} control size`);
  assert.ok(layout.faceDiameter >= 44, `${width}×${height} face target too small`);
  for (const rect of [layout.pad, layout.cluster]) {
    assert.ok(rect.left >= 0 && rect.top >= 0);
    assert.ok(rect.left + rect.width <= width);
    assert.ok(rect.top + rect.height <= height);
  }
  assert.equal(
    layout.pad.top - layout.lifeBottomEdge,
    10,
    `${width}×${height} life-ring/control gap`,
  );
}

assert.deepEqual(landscapeLayout(844, 390).pad, {
  left: 12,
  top: 224,
  width: 156,
  height: 156,
});
assert.deepEqual(landscapeLayout(844, 390).cluster, {
  left: 676,
  top: 224,
  width: 156,
  height: 156,
});
const inset = landscapeLayout(844, 390, {
  left: 47,
  right: 21,
  bottom: 18,
});
assert.equal(inset.pad.left, 47);
assert.equal(inset.cluster.left + inset.cluster.width, 844 - 21);
assert.equal(inset.pad.top + inset.pad.height, 390 - 18);

for (const [height, safeTop, safeLeft] of [[390, 0, 0], [375, 18, 21], [430, 47, 47]]) {
  const top = Math.max(8, safeTop);
  const pause = { left: Math.max(12, safeLeft), top, width: 48, height: 48 };
  assert.ok(pause.left >= 0 && pause.left + pause.width <= 844);
  assert.ok(pause.top >= safeTop && pause.top + pause.height <= height);
}

assert.match(
  await text("src/gameFlowUI.ts"),
  /orientation: landscape[\s\S]{0,500}grid-template-columns: minmax\(0, 1\.35fr\) minmax\(190px, \.65fr\)[\s\S]{0,500}min-height: 44px/,
  "short landscape phones must keep pause actions in the first row",
);

console.log(
  "Validated mobile native-HUD/Render bypass, rotation-safe HUD texture allocation, safe-area touch geometry, life-ring clearance, and coordinated presentation tools.",
);
