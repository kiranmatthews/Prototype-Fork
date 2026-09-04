import assert from "node:assert/strict";
import { createServer } from "vite";

class MemoryStorage {
  values = new Map();
  writes = 0;

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.writes++;
    this.values.set(key, String(value));
  }
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const profileApi = await server.ssrLoadModule(
    "/src/gameFlowVortexProfiles.ts",
  );
  const studioApi = await server.ssrLoadModule(
    "/src/fieldStudioPresets.ts",
  );
  const { FIELD_SWIRL_PRESETS } = await server.ssrLoadModule(
    "/src/swirlfield.ts",
  );

  assert.deepEqual(profileApi.GAME_FLOW_VORTEX_CONTEXTS, [
    "menu",
    "warp",
    "gameover",
  ]);
  for (const context of profileApi.GAME_FLOW_VORTEX_CONTEXTS) {
    const profile = profileApi.GAME_FLOW_VORTEX_PROFILES[context];
    assert.equal(profile.seed, 37);
    assert.deepEqual(profile.preset, FIELD_SWIRL_PRESETS.vortex);
    assert.ok(Object.isFrozen(profile));
    assert.ok(Object.isFrozen(profile.preset));
    assert.ok((profile.preset.rings ?? 0) <= 14);
    assert.ok((profile.preset.segs ?? 0) <= 48);
  }
  assert.notStrictEqual(
    profileApi.GAME_FLOW_VORTEX_PROFILES.menu.preset,
    profileApi.GAME_FLOW_VORTEX_PROFILES.warp.preset,
  );
  assert.notStrictEqual(
    profileApi.GAME_FLOW_VORTEX_PROFILES.warp.preset,
    profileApi.GAME_FLOW_VORTEX_PROFILES.gameover.preset,
  );
  const clone = profileApi.cloneGameFlowVortexProfile("menu");
  clone.preset.spin = 2.5;
  clone.seed = 99;
  assert.notEqual(profileApi.GAME_FLOW_VORTEX_PROFILES.menu.preset.spin, 2.5);
  assert.equal(profileApi.GAME_FLOW_VORTEX_PROFILES.menu.seed, 37);

  const defaults = studioApi.createDefaultFieldStudioState();
  assert.equal(defaults.selectedContext, "menu");
  assert.deepEqual(Object.keys(defaults.drafts), [
    "scratch",
    "menu",
    "warp",
    "gameover",
  ]);
  assert.equal(defaults.drafts.scratch.sourcePreset, "vortex");
  for (const context of profileApi.GAME_FLOW_VORTEX_CONTEXTS)
    assert.equal(defaults.drafts[context].sourcePreset, "authored");

  // Editing and reseeding one context cannot bleed into another context or
  // the source-owned runtime profiles.
  const originalWarpSpin = defaults.drafts.warp.preset.spin;
  const originalGameOverSeed = defaults.drafts.gameover.seed;
  defaults.drafts.menu.preset.spin = 1.75;
  defaults.drafts.menu.seed = 73;
  assert.equal(defaults.drafts.warp.preset.spin, originalWarpSpin);
  assert.equal(defaults.drafts.gameover.seed, originalGameOverSeed);
  assert.notEqual(profileApi.GAME_FLOW_VORTEX_PROFILES.menu.preset.spin, 1.75);

  const storage = new MemoryStorage();
  defaults.selectedContext = "warp";
  assert.equal(studioApi.saveFieldStudioState(defaults, storage), true);
  const restored = studioApi.loadFieldStudioState(storage);
  assert.equal(restored.selectedContext, "warp");
  assert.equal(restored.drafts.menu.preset.spin, 1.75);
  assert.equal(restored.drafts.menu.seed, 73);
  assert.equal(restored.drafts.warp.preset.spin, originalWarpSpin);

  // Reset operates on only the active draft and respects its chosen template.
  const untouchedMenuSpin = restored.drafts.menu.preset.spin;
  restored.drafts.gameover.sourcePreset = "fieldHalo";
  restored.drafts.gameover.preset.spin = 2.9;
  studioApi.resetFieldStudioContext(restored, "gameover");
  assert.deepEqual(restored.drafts.gameover.preset, FIELD_SWIRL_PRESETS.fieldHalo);
  assert.equal(restored.drafts.menu.preset.spin, untouchedMenuSpin);

  const exported = studioApi.gameFlowProfilesFromStudio(restored);
  assert.deepEqual(Object.keys(exported), ["menu", "warp", "gameover"]);
  assert.equal("scratch" in exported, false);
  exported.menu.preset.spin = -2.5;
  assert.equal(restored.drafts.menu.preset.spin, untouchedMenuSpin);

  // The old one-preset lab migrates into Scratch only. Loading is read-only;
  // the v2 key appears only after an actual lab edit/save.
  const legacyStorage = new MemoryStorage();
  legacyStorage.values.set(
    "fieldStudioV1",
    JSON.stringify({
      name: "old field!",
      preset: { ...FIELD_SWIRL_PRESETS.fieldEddy, spin: 0.81 },
    }),
  );
  const migrated = studioApi.loadFieldStudioState(legacyStorage);
  assert.equal(migrated.drafts.scratch.name, "oldfield");
  assert.equal(migrated.drafts.scratch.preset.spin, 0.81);
  assert.deepEqual(
    migrated.drafts.menu.preset,
    profileApi.GAME_FLOW_VORTEX_PROFILES.menu.preset,
  );
  assert.equal(legacyStorage.writes, 0);

  const corruptStorage = new MemoryStorage();
  corruptStorage.values.set(
    studioApi.FIELD_STUDIO_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      selectedContext: "not-a-context",
      drafts: {
        menu: {
          name: "bad",
          sourcePreset: "missing",
          seed: Number.NaN,
          preset: { radius: "huge", rings: 14, segs: 24 },
        },
      },
    }),
  );
  const recovered = studioApi.loadFieldStudioState(corruptStorage);
  assert.equal(recovered.selectedContext, "menu");
  assert.equal(recovered.drafts.menu.sourcePreset, "authored");
  assert.deepEqual(
    recovered.drafts.menu.preset,
    profileApi.GAME_FLOW_VORTEX_PROFILES.menu.preset,
  );
  assert.equal(corruptStorage.writes, 0);
} finally {
  await server.close();
}

console.log(
  "Validated independent Menu, Warp/Loading and Game Over Gouraud drafts and profiles.",
);
