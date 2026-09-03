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
  "crateRow?: HTMLElement",
  "fruitRow?: HTMLElement",
  "relicRow?: HTMLElement",
  "lifeRow?: HTMLElement",
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
assert.match(
  counterPainter,
  /valueRect\.x\s*\+\s*valueRect\.width\s*\+\s*1\s*\*\s*sy/,
  "native box suffix fallback did not adopt the tighter one-pixel gap",
);
assert.ok(
  (counterPainter.match(/hudRevealOpacity\s*\(/g) ?? []).length >= 3,
  "native crate, fruit and life counters must follow their DOM reveal opacity",
);
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
assert.match(
  specialPainter,
  /hudRevealOpacity\s*\(\s*this\.elements\.lifeRow\s*\)/,
  "radial SPECIAL does not share the life row's reveal transition",
);
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
assert.match(
  bonusPainter,
  /hudRevealOpacity\s*\(\s*title\s*\)/,
  "native BONUS title does not mirror its DOM reveal opacity",
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
for (const contract of [
  'div("hud-box-current")',
  'div("hud-box-total")',
  'ghost.style.display = earned ? "" : "none"',
  'this.gameHudLayer.classList.toggle("hud-bonus", bonus)',
]) {
  assert.ok(ui.includes(contract), `new HUD hierarchy missing ${contract}`);
}
for (const rowClass of [
  "hud-fruit-row",
  "hud-crate-row",
  "hud-relics",
  "hud-life-row",
  "hud-bonus-title",
])
  assert.match(
    ui,
    new RegExp(`div\\(\\"(?=[^\\"]*${rowClass})(?=[^\\"]*hud-reveal)[^\\"]*\\"\\)`),
    `${rowClass} is not wired into the shared reveal transition`,
  );

const fruitAppend = ui.indexOf("tl.appendChild(wumpaRow)");
const crateAppend = ui.indexOf("tl.appendChild(crateRow)");
assert.ok(fruitAppend >= 0, "fruit row is not attached to the collection stack");
assert.ok(crateAppend >= 0, "crate row is not attached to the collection stack");
assert.ok(
  fruitAppend < crateAppend,
  "fruit must precede crates so pickup-only and L2 reveals share one slot",
);

const syncHudVisibility = ui.match(
  /private syncHudVisibility\(\): void \{([\s\S]*?)\n  \}/,
)?.[1] ?? "";
for (const row of [
  "bonusTitleEl",
  "wumpaRowEl",
  "crateRowEl",
  "relicRowEl",
  "livesRowEl",
])
  assert.match(
    syncHudVisibility,
    new RegExp(`setHudReveal\\s*\\(\\s*this\\.${row}\\s*,`),
    `${row} bypasses the shared in/out reveal transition`,
  );
assert.doesNotMatch(
  syncHudVisibility,
  /(?:wumpaRowEl|crateRowEl|relicRowEl|livesRowEl)\.style\.display\s*=/,
  "collection/life rows still hard-cut display instead of transitioning out",
);

const revealHelper = ui.match(
  /\n\s*(?:private\s+)?setHudReveal\s*\([^)]*\)\s*:\s*void\s*\{([\s\S]*?)\n\s*\}/,
)?.[1] ?? "";
assert.match(
  revealHelper,
  /classList\.toggle\(\s*["']hud-reveal-visible["']\s*,\s*visible\s*\)/,
  "HUD reveal helper does not drive the visible transition state",
);
assert.match(
  revealHelper,
  /aria-hidden/,
  "HUD reveal helper does not synchronize its accessibility state",
);
assert.match(
  ui,
  /\.hud-reveal\s*\{[^}]*transition\s*:/,
  "HUD reveal base state has no reversible transition",
);
assert.match(
  ui,
  /\.hud-reveal(?:\.hud-reveal-visible|[\s,]+\.hud-reveal-visible)\s*\{/,
  "HUD reveal visible state is missing",
);

const iconPainter = ui.match(
  /drawIcons\(([\s\S]*?)\n  \}\n\n  \/\*\*\n   \* Where the fruit counter/,
)?.[1] ?? "";
assert.match(
  iconPainter,
  /hudRevealOpacity\s*\(\s*slot\.revealHost\s*\)/,
  "3D HUD icons do not read their owning row's reveal opacity",
);
assert.match(
  iconPainter,
  /if\s*\(\s*revealAlpha\s*<=\s*0\.001\s*\)\s*continue/,
  "3D HUD icons remain drawable after their reveal transition reaches zero",
);
assert.match(
  iconPainter,
  /setIconRevealAlpha\s*\(\s*slot\s*,\s*revealAlpha\s*\)/,
  "3D HUD icon materials do not mirror the row's transition alpha",
);
const iconRevealHelper = ui.match(
  /private setIconRevealAlpha\s*\([^)]*\)[^{]*\{([\s\S]*?)\n  \}\n\n  \/\*\*/,
)?.[1] ?? "";
assert.match(
  iconRevealHelper,
  /material\.opacity\s*=\s*baseOpacity\s*\*\s*alpha/,
  "3D HUD icon fade does not preserve each material's authored opacity",
);

const boxCountCss = ui.match(/\.hud-box-count\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(
  boxCountCss,
  /gap\s*:\s*0(?:px)?\s*;/,
  "box numerator and denominator still have a layout gap",
);
const boxTotalCss = ui.match(/\.hud-box-total\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(
  boxTotalCss,
  /margin-left\s*:\s*(?:-|calc\(\s*-|clamp\(\s*-)/,
  "box denominator does not compensate for Roo's padded numerator edge",
);
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
