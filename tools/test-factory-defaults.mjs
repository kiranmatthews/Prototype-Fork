import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const expected = JSON.parse(await readFile(
  new URL('./fixtures/chrome-factory-defaults.json', import.meta.url), 'utf8',
));
const server = await createServer({
  appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
});
try {
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  // Camera v18 expresses this same captured shot as actual distance + angle.
  const expectedTuning = { ...expected.tuning, camDist: 5.05, camPitch: 25.35 };
  delete expectedTuning.camTilt;
  delete expectedTuning.camOffset;
  assert.deepEqual(TUNING, expectedTuning);
  const { CrtGuestSettings } = await server.ssrLoadModule('/src/crt-guest/settings.ts');
  const crt = new CrtGuestSettings({ storage: null });
  assert.deepEqual(crt.exportPreset(), expected.crt);
  crt.setEnabled(true);
  crt.resetAllDefaults();
  assert.deepEqual(crt.exportPreset(), expected.crt);
  const { VisualTreatmentSettings, VISUAL_TREATMENT_PRESETS } =
    await server.ssrLoadModule('/src/visual-treatment/settings.ts');
  const look = new VisualTreatmentSettings(null);
  assert.deepEqual(look.value, expected.look);
  look.applyPreset(VISUAL_TREATMENT_PRESETS.neutral);
  assert.equal(look.value.bloom.intensity, 0);
  look.reset();
  assert.deepEqual(look.value, expected.look);
  const character = await server.ssrLoadModule('/src/character/settings.ts');
  assert.equal(character.DEFAULT_CHARACTER_HEAD_STYLE, expected.headStyle);
  assert.equal(character.DEFAULT_CHARACTER_TAIL_VISIBLE, expected.tail);
  const proportions = new character.CharacterProportionSettings(null);
  proportions.setActiveHeadProfile('roo');
  assert.deepEqual(proportions.value, expected.character);
  assert.deepEqual(proportions.headProfiles, expected.headProfiles);
  const { characterCollisionHeight, characterDesignHeight } =
    await server.ssrLoadModule('/src/character/collisionDimensions.ts');
  const historicalCalibration = {
    ...expected.character, headSize: 1.55, neckLength: 0,
  };
  assert.equal(characterCollisionHeight(expected.character, 'roo'),
    0.92 * characterDesignHeight(expected.character, 'roo') /
      characterDesignHeight(historicalCalibration, 'skull'),
    'promoting appearance defaults must not recalibrate the captured hitbox');
  proportions.patch({ headSize: 1, shoulderWidth: 1 });
  proportions.reset();
  assert.deepEqual(proportions.value, expected.character);
  proportions.setActiveHeadProfile('skull');
  proportions.reset();
  assert.deepEqual(proportions.getHeadProfile('skull'), expected.headProfiles.skull);
  const { createPlayerStarterClips } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  assert.equal(createPlayerStarterClips().find(c => c.id === 'player.run').playbackSpeed,
    expected.runPlaybackSpeed);
  console.log('Validated captured Chrome factory defaults and Reset paths.');
} finally {
  await server.close();
}
