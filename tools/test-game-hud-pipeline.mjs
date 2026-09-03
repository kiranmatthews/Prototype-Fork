import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path) => readFile(`${root}${path}`, "utf8");

const surface = await text("src/gameHudSurface.ts");
for (const contract of [
  "class GameHudSurface",
  "new THREE.CanvasTexture",
  "THREE.SRGBColorSpace",
  "transparent: true",
  "toneMapped: false",
  "renderer.autoClear = false",
  "renderer.setRenderTarget(previousTarget",
  "paintBonus",
  "paintCounters",
  "paintScoreAndClock",
  "paintSpecial",
  "paintResults",
  "paintTrick",
  "paintBalance",
  "paintMessage",
  "paintDeath",
]) {
  assert.ok(surface.includes(contract), `game HUD surface missing ${contract}`);
}
assert.doesNotMatch(
  surface,
  /html2canvas|foreignObject|XMLSerializer/,
  "game HUD must stay on the synchronous native Canvas2D path",
);

for (const handle of [
  "crateCurrent?: HTMLElement",
  "crateTotal?: HTMLElement",
  "bonusTitle?: HTMLElement",
]) {
  assert.ok(surface.includes(handle), `game HUD element contract missing ${handle}`);
}
assert.match(
  surface,
  /interface GameHudCrateState[\s\S]*?total\?: string \| number/,
  "explicit crate state must carry a separately-rendered total",
);

const counterPainter = surface.match(
  /private paintCounters\(([\s\S]*?)\n  private paintScoreAndClock/,
)?.[1] ?? "";
assert.match(counterPainter, /resolveCrateCounter\(/);
assert.match(counterPainter, /const counterSize = 90 \* sy/);
assert.match(counterPainter, /const totalSize = 50 \* sy/);
assert.match(counterPainter, /formatCrateTotal\(crates\.total\)/);
assert.doesNotMatch(
  surface,
  /private paintRelic\(/,
  "unearned relic silhouettes must not be painted into the native HUD",
);

const specialPainter = surface.match(
  /private paintSpecial\(([\s\S]*?)\n  \/\*\*\n   \* Blend the last Canvas2D frame/,
)?.[1] ?? "";
assert.match(
  specialPainter,
  /this\.rect\(this\.elements\.lifeFace, layout\)/,
  "SPECIAL must be anchored to the measured life portrait",
);
assert.match(specialPainter, /ctx\.arc\(cx, cy, radius/);
assert.doesNotMatch(specialPainter, /specialLabel|specialControls/);
assert.doesNotMatch(specialPainter, /drawRooInRect|drawPlainText/);
assert.match(
  counterPainter,
  /Boolean\(this\.elements\.lifeFace\?\.closest\("\.hud-deathcount"\)\)/,
  "nested life ring must preserve pre-CRT endless-deaths styling",
);

const bonusPainter = surface.match(
  /private paintBonus\(([\s\S]*?)\n  private paintSpecial/,
)?.[1] ?? "";
assert.match(bonusPainter, /this\.elements\.bonusTitle/);
assert.match(bonusPainter, /readRooHudText\(title\) \|\| "BONUS"/);

const ui = await text("src/ui.ts");
for (const contract of [
  'div("game-hud-layer")',
  '"precrt-composited"',
  "new GameHudSurface",
  "drawGameHud(",
  "gameHudDiagnostics",
]) {
  assert.ok(ui.includes(contract), `UI game-HUD contract missing ${contract}`);
}
for (const contract of [
  'div("hud-counter hud-crate-row")',
  'div("hud-box-current")',
  'div("hud-box-total")',
  'div("hud-counter hud-life-row")',
  'div("hud-bonus-title")',
  'ghost.style.display = earned ? "" : "none"',
  'this.gameHudLayer.classList.toggle("hud-bonus", bonus)',
]) {
  assert.ok(ui.includes(contract), `new HUD hierarchy missing ${contract}`);
}
for (const retired of [
  "SPECIAL_CONTROL_HELP",
  "SPECIAL READY",
  "hud-special-label",
  "hud-special-controls",
]) {
  assert.equal(ui.includes(retired), false, `retired persistent HUD copy remains: ${retired}`);
}
assert.match(
  ui,
  /document\.body\.appendChild\(this\.replayBadge\);[\s\S]{0,100}document\.body\.appendChild\(this\.recBadge\);/,
  "capture badges must remain sharp outside the gameplay HUD root",
);

const main = await text("src/main.ts");
assert.match(main, /cratesBroken: player\.cratesBroken/);
assert.match(main, /cratesTotal: level\.totalCrates/);
assert.match(main, /inventoryHeld: input\.inventoryHeld/);
assert.match(main, /bonusMode: level\.hudMode === "bonus"/);
assert.match(main, /fruitCollectionRevision: player\.fruitCollectionRevision/);
const player = await text("src/player.ts");
assert.match(
  player,
  /private collectFruit\(\): void \{\s*this\.fruitCollectionRevision\+\+;/,
  "every fruit collection must trigger the transient HUD, including rollovers",
);
assert.match(main, /ui\.setLevel\(entry\.id, level\.hudMode, player\.fruitCollectionRevision\);/);
assert.match(main, /ui\.setHUD\(currentHudState\(\), 0\);/);
assert.match(
  main,
  /player\.drawFlyingFruit\(context\.renderer,[\s\S]{0,220}ui\.drawIcons\(context\.renderer,[\s\S]{0,220}ui\.drawGameHud\(context\.renderer/,
  "pre-CRT overlay order must be fruit -> 3D icons -> 2D gameplay HUD",
);
assert.match(
  main,
  /if \(paused\)[\s\S]{0,180}renderGameplayScene\(dt\)/,
  "paused gameplay must retain the composited PAUSED HUD",
);
assert.ok(
  (main.match(/ui\.setGameHudComposited\(false\)/g) ?? []).length >= 3,
  "direct/editor/studio paths must restore the sharp DOM fallback",
);

console.log(
  "Validated gameplay HUD ownership, split box hierarchy, radial SPECIAL, bonus title, earned-only relics, and pre-CRT ordering.",
);
