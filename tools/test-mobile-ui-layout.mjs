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
const worldMapUi = await text("src/worldMapUI.ts");
const gameFlow = await text("src/gameFlowUI.ts");
const gameFlowSurface = await text("src/gameFlowSurface.ts");
const gameInterface = await text("src/gameInterfaceSurface.ts");
assert.match(worldMapUi, /this\.enterButton\.textContent = "Play"/);
assert.doesNotMatch(worldMapUi, /this\.enterButton\.innerHTML/);
assert.match(gameInterface, /this\.box\(ctx,enter\);\s*this\.text\(ctx,enter\)/, "Play must be text in the filtered interface too");
const menuLayout = await text("src/game-menu-layout.css");
assert.match(gameFlow, /private backToMapOrPause\(\): void \{\s*if \(this\.mapDirect\) \{\s*this\.callbacks\.onResume\(\)/,
  "map-menu Back must resume the map without performing a pending quit/save action");
assert.match(gameFlow, /menuHint\('BACK', \['back'\], back\)/, "level selection must expose the shared Back prompt/action");
assert.match(gameFlow, /style\.textContent \+= (?:MENU_THEME_CSS \+ )?menuLayoutStyle/, "the shared TV-safe sizing policy must follow legacy artwork styles");
assert.match(menuLayout, /\.game-shell-panel, body\.tc-on \.game-shell-panel\.game-map-menu-panel \{[^}]*overflow:hidden/s,
  "touch map utilities must retain fixed screen regions rather than whole-menu scrolling");
assert.match(menuLayout, /\.game-scroll-segment \{[^}]*min-height:0[^}]*overflow:auto/s,
  "long content may scroll only inside its bounded segment");
assert.match(menuLayout, /\.game-menu-hints \{[^}]*position:absolute[^}]*bottom:3vh/s,
  "control hints must remain in their fixed bottom region");
assert.match(gameFlow, /this\.panel\.addEventListener\("scroll", \(\) => this\.invalidatePreCrt\(\), \{\s*passive: true, capture: true/,
  "nested segment scrolling must invalidate the filtered mirror");
assert.match(gameFlowSurface, /if \(rect\.clip\)[^\n]*ctx\.clip\(\)/,
  "the Canvas mirror must clip content to the same bounded segment");
const secondaryText = await text("src/secondary-text.css");
assert.match(secondaryText, /CCGeekSpeakTweak-Bold-staging\.ttf/);
const secondaryLabel = await text("src/secondaryText.ts");
assert.match(secondaryLabel, /step = steps; step >= 0; step--/, "extrusion must sweep all the way to the face");
assert.match(secondaryLabel, /Math\.ceil\(Math\.hypot\(s.shadowX, s.shadowY\) \* 2\)/, "extrusion samples must overlap");
assert.match(secondaryLabel, /linearGradient/);
assert.match(worldMapUi, /silverSecondaryLabel\(label\)/);
assert.match(worldMapUi, /\.world-map-actions \{[^}]*background: none; border: 0;/, "map hints must not regain a container");
assert.match(worldMapUi, /body\.tc-on \.world-map-actions \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s,
  "portrait touch actions must fit bounded equal-width columns");

for (const contract of [
  "--tc-size: min(clamp(144px, 40dvh, 176px)",
  "--tc-left-edge: max(16px, calc(env(safe-area-inset-left) + 8px))",
  "--tc-right-edge: max(16px, calc(env(safe-area-inset-right) + 8px))",
  "--tc-bottom-edge: max(18px, calc(env(safe-area-inset-bottom) + 10px))",
  "--tc-top-edge: max(8px, env(safe-area-inset-top))",
  "button.className = 'tc-pause'",
  "button.setAttribute('aria-label', 'Pause game')",
  "consumeButtonPress(key: BtnDef['key'])",
  "consumeDirectionTap(): [number, number] | null",
  "this.pressedBtn[b.key].add(this.pointerOwners.get(id)!)",
  "this.directionTap = [this.moveX, this.moveY]",
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
  /const wantsPreCrtHud = showHud && wantsPreCrtUi/,
  "touch HUD must share pre-CRT ownership with the other game UI",
);
assert.doesNotMatch(main, /showHud && !TOUCH_PRESENTATION/);
assert.match(
  main,
  /function fixedResolutionActive\(\)[\s\S]{0,500}renderQualitySettings\.enabled &&\s*!LITE_RENDER &&\s*!split2p/,
  "fixed resolution presets must exclude lite and split-screen rendering",
);
assert.doesNotMatch(main, /TOUCH_PRESENTATION \? 1 : renderQualitySettings\.outputMultiplier/,
  "resolution controls must apply the same output scale on every device");
assert.match(main, /const fixedSurface = renderQualitySettings\.enabled && !LITE_RENDER/,
  "split-screen canvas must retain the fixed physical-pixel preset");
assert.match(main, /ui\.setPresentationTools\(\[/);
assert.match(input, /new TouchControls\(\(\) => \{[\s\S]{0,160}this\.pausePressed = true;/);
assert.match(input, /touchJumpPressed = tc\.consumeButtonPress\('x'\)/);
assert.match(input, /const mapDirection = tc\.consumeDirectionTap\(\)/);
assert.match(input, /ArrowRight[^\n]*KeyD[^\n]*mapDirectionX = 1/);
assert.match(input, /ArrowUp[^\n]*KeyW[^\n]*mapDirectionY = 1/);
assert.match(
  worldMapUi,
  /body\.tc-on \.world-map-actions \{[^}]*bottom:max\(16px, env\(safe-area-inset-bottom\)\)/,
  "touch map actions belong at the bottom without a virtual controller gap",
);
assert.match(touch, /body:is\(\.world-map-active,[\s\S]*?:is\(\.tc-zone,\.tc-look,\.tc-pause\) \{ display:none !important; \}/);
assert.match(worldMapUi, /createInputGlyph\(action\)/, "map glyph visibility must use the shared device policy");
assert.match(worldMapUi, /this\.enterButton\.disabled = this\.moving \|\| !unlocked/);
assert.match(worldMapUi, /tap\.canceled/);
assert.doesNotMatch(worldMapUi, /unlockNotice|announceUnlock|NEW PATH OPEN/, "automatic map unlock popups must not return");
assert.doesNotMatch(main, /player\.on(?:Checkpoint|Relic|TrickGateBlocked|ComboGraceLow)\s*=/, "gameplay events must not install stock title popups");
assert.doesNotMatch(main, /"TIME TRIAL!"|"COMBO RUN!"|"COMBO BROKEN"|"COMBO GEM!"|"START A COMBO!"/);
assert.match(main, /player\.onTTStart = \(\) => \{\s*ui\.setTimeTrial\(true\)/);
assert.match(main, /worldMapController\?\.revealUnlocks\(unlockReveal\)/);
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
  const left = Math.max(16, safe.left + 8);
  const right = Math.max(16, safe.right + 8);
  const bottom = Math.max(18, safe.bottom + 10);
  const size = Math.min(clamp(144, height * 0.4, 176), (width - left - right - 16) / 2);
  const top = height - bottom - size;
  const pad = { left, top, width: size, height: size };
  const cluster = {
    left: width - right - size,
    top,
    width: size,
    height: size,
  };
  const faceDiameter = size * 0.38;
  const lifeBottomEdge = height - (bottom + size + 68);
  return { size, pad, cluster, faceDiameter, lifeBottomEdge };
}

for (const [width, height, expected] of [
  [844, 390, 156],
  [667, 375, 150],
  [932, 430, 172],
  [1280, 720, 176],
  [320, 568, 136],
]) {
  const layout = landscapeLayout(width, height);
  assert.equal(layout.size, expected, `${width}×${height} control size`);
  assert.ok(layout.faceDiameter >= 48, `${width}×${height} face target too small`);
  for (const rect of [layout.pad, layout.cluster]) {
    assert.ok(rect.left >= 0 && rect.top >= 0);
    assert.ok(rect.left + rect.width <= width);
    assert.ok(rect.top + rect.height <= height);
  }
  assert.equal(
    layout.pad.top - layout.lifeBottomEdge,
    68,
    `${width}×${height} bonus readout/control gap including 48px triggers`,
  );
}

assert.deepEqual(landscapeLayout(844, 390).pad, {
  left: 16,
  top: 216,
  width: 156,
  height: 156,
});
assert.deepEqual(landscapeLayout(844, 390).cluster, {
  left: 672,
  top: 216,
  width: 156,
  height: 156,
});
const inset = landscapeLayout(844, 390, {
  left: 47,
  right: 21,
  bottom: 18,
});
assert.equal(inset.pad.left, 55);
assert.equal(inset.cluster.left + inset.cluster.width, 844 - 29);
assert.equal(inset.pad.top + inset.pad.height, 390 - 28);

for (const [height, safeTop, safeLeft] of [[390, 0, 0], [375, 18, 21], [430, 47, 47]]) {
  const top = Math.max(8, safeTop);
  const pause = { left: Math.max(12, safeLeft), top, width: 48, height: 48 };
  assert.ok(pause.left >= 0 && pause.left + pause.width <= 844);
  assert.ok(pause.top >= safeTop && pause.top + pause.height <= height);
}

assert.match(menuLayout,
  /\.game-pause-layout \{[^}]*width:100%; height:100%[^}]*grid-template-columns:minmax\(0,1\.2fr\) minmax\(0,\.9fr\)/s,
  "pause must fit its preview, actions and progress within a full-screen composition");
assert.match(menuLayout, /\.game-pause-actions \{[^}]*grid-column:2; grid-row:1\/3/s,
  "pause actions must remain beside the preview, including short landscape screens");

const { createServer } = await import("vite");
const secondaryServer = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const { sanitizeSecondaryText, SECONDARY_TEXT_DEFAULTS, secondaryTextSettings } = await secondaryServer.ssrLoadModule("/src/secondaryTextSettings.ts");
  assert.deepEqual(SECONDARY_TEXT_DEFAULTS, {
    size: 41, weight: -0.5, stroke: 0.5, shadowX: -1.5, shadowY: 1.5,
    gradientAngle: 90, gradientMid: 81,
    top: "#ffffff", upper: "#b6cbd2", middle: "#7e98ae",
    dark: "#667985", lower: "#bcc8d0", bottom: "#e0e6ea",
  }, "menu text defaults must match the user-approved preset");
  assert.deepEqual(sanitizeSecondaryText(null), SECONDARY_TEXT_DEFAULTS);
  const clamped = sanitizeSecondaryText({ size: 999, weight: -99, shadowX: -999, stroke: NaN, top: "url(bad)", dark: "#123456" });
  assert.equal(clamped.size, 56); assert.equal(clamped.weight, -.8); assert.equal(clamped.shadowX, -14);
  assert.equal(clamped.stroke, SECONDARY_TEXT_DEFAULTS.stroke); assert.equal(clamped.top, SECONDARY_TEXT_DEFAULTS.top); assert.equal(clamped.dark, "#123456");
  let notifications = 0;
  const unsubscribe = secondaryTextSettings.subscribe(() => notifications++);
  secondaryTextSettings.update({ weight: 1.2 });
  assert.equal(secondaryTextSettings.value.weight, 1.2);
  secondaryTextSettings.reset();
  assert.deepEqual(secondaryTextSettings.value, SECONDARY_TEXT_DEFAULTS);
  assert.equal(notifications, 2); unsubscribe();
} finally { await secondaryServer.close(); }

console.log(
  "Validated mobile pre-CRT HUD, device-independent resolution controls, rotation-safe texture allocation, safe-area touch geometry and coordinated presentation tools.",
);
