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
  "paintCounters",
  "paintScoreAndClock",
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
assert.match(
  ui,
  /document\.body\.appendChild\(this\.replayBadge\);[\s\S]{0,100}document\.body\.appendChild\(this\.recBadge\);/,
  "capture badges must remain sharp outside the gameplay HUD root",
);

const main = await text("src/main.ts");
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
  "Validated gameplay HUD ownership, native Canvas2D composition and pre-CRT ordering.",
);
