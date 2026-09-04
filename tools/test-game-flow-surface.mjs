import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [surface, flow, main] = await Promise.all([
  readFile(`${root}src/gameFlowSurface.ts`, "utf8"),
  readFile(`${root}src/gameFlowUI.ts`, "utf8"),
  readFile(`${root}src/main.ts`, "utf8"),
]);

assert.equal(
  (surface.match(/document\.createElement\("canvas"\)/g) ?? []).length,
  1,
  "GameFlowSurface must reuse exactly one Canvas2D surface",
);
assert.equal(
  (surface.match(/new THREE\.CanvasTexture\(/g) ?? []).length,
  1,
  "GameFlowSurface must reuse exactly one CanvasTexture",
);
assert.equal(
  (surface.match(/new THREE\.PlaneGeometry\(2, 2\)/g) ?? []).length,
  1,
  "GameFlowSurface must reuse exactly one fullscreen quad",
);
assert.doesNotMatch(
  surface,
  /<foreignObject|html2canvas\s*\(|\.toDataURL\s*\(|\.drawWindow\s*\(/i,
  "game-flow presentation must be explicitly painted, not DOM-screenshotted",
);
assert.match(
  surface,
  /if \(this\.dirty \|\| resized\) this\.paint\(/,
  "unchanged screens must reuse their cached canvas texture",
);
assert.match(
  surface,
  /resources\.texture\.dispose\(\);[\s\S]{0,120}resources\.canvas\.width = 1;[\s\S]{0,80}resources\.canvas\.height = 1;/,
  "inactive gameplay must release GPU storage and collapse the menu canvas",
);
const handoffRequest =
  flow.match(/setPreCrtComposited\(composited: boolean\): void \{[\s\S]*?\n  \}/)?.[0] ?? "";
assert.match(
  handoffRequest,
  /this\.preCrtHandoffPending = true/,
  "requesting GameFlow composition must stage an atomic handoff",
);
assert.doesNotMatch(
  handoffRequest,
  /classList\.(?:add|toggle)\([^)]*precrt-composited/,
  "the semantic DOM must remain visible until the cached surface draws",
);
assert.match(
  flow,
  /drawPreCrt\([\s\S]{0,500}this\.gameFlowSurface\.drawPreCrt[\s\S]{0,500}classList\.add\("precrt-composited"\)/,
  "a successful cached draw must atomically commit pre-CRT ownership",
);
assert.match(
  flow,
  /\.game-shell\.precrt-composited \.game-shell-panel \{ opacity: 0; \}/,
  "compositing must hide only the visual panel",
);
assert.match(
  flow,
  /\.game-shell \{[\s\S]{0,180}pointer-events: none/,
  "the full-screen semantic shell must not shield developer chrome",
);
assert.match(
  flow,
  /\.game-menu-button \{[^}]*pointer-events: auto/,
  "real semantic buttons must remain pointer hit targets",
);
assert.match(
  flow,
  /\.game-shell\.precrt-composited \.game-menu-button:focus-visible \{ outline: none; \}/,
  "native focus chrome must not leak sharply above the shader-rendered selection",
);
assert.match(
  flow,
  /private syncSelection\(focusSelected = true\): void \{[\s\S]{0,900}this\.invalidatePreCrt\(\);/,
  "keyboard/gamepad/pointer selection changes must invalidate the mirror",
);
assert.match(
  flow,
  /this\.thumbnailCaptured = true;[\s\S]{0,220}this\.invalidatePreCrt\(\);/,
  "the first pause thumbnail must request one corrected cached frame",
);
assert.match(
  main,
  /!gameFlow\.needsPauseThumbnail[\s\S]{0,220}composited \? drawGameFlowPreCrt : undefined/,
  "the clean pause thumbnail must be captured before the menu is composited",
);
assert.match(
  flow,
  /hide\(\): void \{[\s\S]{0,500}this\.gameFlowSurface\.deactivate\(\);/,
  "hiding GameFlow must release its full-size presentation storage",
);

for (const screen of [
  "save-load",
  "confirm-save",
  "confirm-load",
  "confirm-quit-main",
]) {
  assert.ok(
    surface.includes(`| "${screen}"`),
    `${screen} is missing from the pre-CRT surface screen union`,
  );
}
assert.match(surface, /"\.game-save-status"/);
assert.match(surface, /"\.game-operation-status"/);

for (const callback of [
  "onSaveGame",
  "onAutosaveChange",
  "onQuitToMain",
]) {
  assert.match(
    flow,
    new RegExp(`${callback}:`),
    `${callback} callback is missing from GameFlowUI`,
  );
}

const pauseFlow =
  flow.match(/private renderPause\(\): void \{[\s\S]*?\n  \}\n\n  private renderOptions/)?.[0] ?? "";
assert.ok(pauseFlow, "pause renderer could not be inspected");
const resumeAt = pauseFlow.indexOf('this.button("RESUME"');
const saveLoadAt = pauseFlow.indexOf('this.button("SAVE / LOAD"');
const optionsAt = pauseFlow.indexOf('this.button("OPTIONS"');
const quitMainAt = pauseFlow.indexOf('this.button("QUIT TO MAIN MENU"');
assert.ok(
  resumeAt >= 0 &&
    resumeAt < saveLoadAt &&
    saveLoadAt < optionsAt &&
    optionsAt < quitMainAt,
  "warp pause visual and keyboard/gamepad creation order must agree",
);
assert.match(
  pauseFlow,
  /else \{[\s\S]{0,180}this\.button\("OPTIONS"[\s\S]{0,180}this\.button\("RESTART"[\s\S]{0,180}this\.button\("QUIT LEVEL"/,
  "non-warp pause order must remain unchanged",
);

const saveLoadFlow =
  flow.match(/private renderSaveLoad\(\): void \{[\s\S]*?\n  \}\n\n  private renderConfirmSave/)?.[0] ?? "";
assert.ok(saveLoadFlow, "save/load submenu could not be inspected");
assert.match(saveLoadFlow, /this\.campaign\.activeSlot/);
assert.match(saveLoadFlow, /this\.campaign\.dirty/);
const saveAt = saveLoadFlow.indexOf('this.button("SAVE GAME"');
const loadAt = saveLoadFlow.indexOf('this.button("LOAD GAME"');
const autosaveAt = saveLoadFlow.indexOf('"AUTOSAVE"');
const backAt = saveLoadFlow.indexOf('this.button("BACK"');
assert.ok(
  saveAt >= 0 && saveAt < loadAt && loadAt < autosaveAt && autosaveAt < backAt,
  "Save Game, Load Game, Autosave, Back order drifted",
);

for (const [method, action] of [
  ["renderConfirmSave", "SAVE GAME"],
  ["renderConfirmLoad", "LOAD GAME"],
  ["renderConfirmQuitMain", "SAVE & QUIT"],
]) {
  const body =
    flow.match(
      new RegExp(`private ${method}\\(\\): void \\{[\\s\\S]*?\\n  \\}\\n\\n  private`),
    )?.[0] ?? "";
  assert.ok(body, `${method} could not be inspected`);
  assert.ok(
    body.indexOf('"CANCEL"') >= 0 &&
      body.indexOf('"CANCEL"') < body.indexOf(`"${action}"`),
    `${method} must create Cancel before its destructive action`,
  );
}
assert.match(
  flow,
  /this\.screen === "load-slots" && this\.slotOrigin === "launch"/,
  "only launch-origin load slots may own the title vortex",
);
assert.match(
  flow,
  /this\.screen = this\.slotOrigin === "warp" \? "save-load" : "launch"/,
  "Back/P must preserve the slot screen's launch-versus-warp origin",
);
const quitFlow =
  flow.match(/private renderConfirmQuitMain\(\): void \{[\s\S]*?\n  \}\n\n  private attemptQuitToMain/)?.[0] ?? "";
assert.ok(
  quitFlow.includes("this.campaign.dirty") &&
    quitFlow.includes('"SAVE & QUIT"') &&
    quitFlow.includes('"QUIT WITHOUT SAVING"'),
  "Quit Main must always offer both save and explicit discard paths",
);

for (const wiring of [
  "onSaveGame: saveCampaignFromWarp",
  "onAutosaveChange: setCampaignAutosave",
  "onQuitToMain: quitCampaignToMain",
])
  assert.ok(main.includes(wiring), `main is missing ${wiring}`);
assert.match(
  main,
  /function saveCampaignFromWarp\(\): boolean \{[\s\S]{0,260}current\.id !== "warproom"[\s\S]{0,220}campaign\.saveActive\(\)\.ok/,
  "manual saves must be restricted to the Warp Room and report write success",
);
assert.match(
  main,
  /campaign\.load\(slot, \{ discardDirty: true \}\)/,
  "confirmed Warp loads must explicitly discard the previous working copy",
);
const quitHost =
  main.match(/function quitCampaignToMain\([\s\S]*?\n\}/)?.[0] ?? "";
assert.match(quitHost, /saveFirst && !saveCampaignFromWarp\(\)/);
assert.match(quitHost, /campaign\.closeActive\(\{ discardDirty: !saveFirst \}\)/);
assert.match(quitHost, /gameFlow\.showLaunch\(\)/);

console.log(
  "Validated cached GameFlow mirroring, semantic controls, and safe Warp Room save UX.",
);
