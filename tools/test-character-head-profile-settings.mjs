import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));

async function loadSettingsModule() {
  const source = await readFile(resolve(root, 'src/character/settings.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'settings.ts',
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    values,
  };
}

const {
    CHARACTER_HAND_REST_REVISION,
    CHARACTER_HEAD_PROFILE_IDS,
    CHARACTER_HEAD_PROFILE_KEYS,
    CHARACTER_PROPORTION_CONTROLS,
    CHARACTER_PROPORTION_DEFAULTS_REVISION,
    CHARACTER_PROPORTION_STORAGE_KEY,
    CharacterProportionSettings,
    DEFAULT_CHARACTER_HEAD_PROFILES,
    DEFAULT_CHARACTER_PROPORTIONS,
    IDENTITY_CHARACTER_PROPORTIONS,
    clampCharacterProportions,
} = await loadSettingsModule();

  // Skull is the only head. BoolieRoo's 'roo' profile went with BoolieRoo; the per-head profile
  // envelope stays, so a browser that saved under it still loads and another head can be added.
  assert.deepEqual(CHARACTER_HEAD_PROFILE_IDS, ['skull']);
  assert.deepEqual(CHARACTER_HEAD_PROFILE_KEYS, [
    'headSize',
    'headWidth',
    'headDepth',
    'neckLength',
    'headForwardOffset',
    'headRestPitch',
  ]);
  assert.deepEqual(
    CHARACTER_PROPORTION_CONTROLS.find(({ key }) => key === 'headRestPitch'),
    {
      key: 'headRestPitch',
      label: 'Neutral head tilt (°)',
      section: 'Head & torso',
      min: -60,
      max: 60,
      step: 1,
    },
  );
  assert.equal(clampCharacterProportions({ headRestPitch: -999 }).headRestPitch, -60);
  assert.equal(clampCharacterProportions({ headRestPitch: 999 }).headRestPitch, 60);
  assert.equal(clampCharacterProportions({ headRestPitch: NaN }).headRestPitch, 0);

  assert.equal(Object.isFrozen(DEFAULT_CHARACTER_HEAD_PROFILES), true);
  assert.equal(Object.isFrozen(DEFAULT_CHARACTER_HEAD_PROFILES.skull), true);
  assert.deepEqual(Object.keys(DEFAULT_CHARACTER_HEAD_PROFILES), ['skull'],
    'the removed BoolieRoo profile must not come back as an authored default');
  assert.deepEqual(DEFAULT_CHARACTER_HEAD_PROFILES.skull, {
    headSize: DEFAULT_CHARACTER_PROPORTIONS.headSize,
    headWidth: DEFAULT_CHARACTER_PROPORTIONS.headWidth,
    headDepth: DEFAULT_CHARACTER_PROPORTIONS.headDepth,
    neckLength: DEFAULT_CHARACTER_PROPORTIONS.neckLength,
    headForwardOffset: DEFAULT_CHARACTER_PROPORTIONS.headForwardOffset,
    headRestPitch: DEFAULT_CHARACTER_PROPORTIONS.headRestPitch,
  }, 'the skull profile is the source-owned silhouette');
  assert.throws(
    () => { DEFAULT_CHARACTER_HEAD_PROFILES.skull.headRestPitch = -12; },
    TypeError,
  );

  const storage = memoryStorage();
  const settings = new CharacterProportionSettings(storage);
  assert.equal(settings.activeHeadProfile, 'skull');
  assert.deepEqual(settings.headProfiles, DEFAULT_CHARACTER_HEAD_PROFILES);
  assert.notEqual(settings.headProfiles.skull, DEFAULT_CHARACTER_HEAD_PROFILES.skull,
    'live defaults must be cloned from the immutable authored snapshots');

  let notifications = 0;
  settings.subscribe(() => notifications++);
  settings.patch({
    headSize: 1.8,
    headWidth: 1.1,
    headDepth: 0.9,
    neckLength: -0.35,
    headForwardOffset: 0.12,
    headRestPitch: 18,
    torsoWidth: 1.27,
  });
  assert.equal(notifications, 1);
  assert.deepEqual(settings.getHeadProfile('skull'), {
    headSize: 1.8,
    headWidth: 1.1,
    headDepth: 0.9,
    neckLength: -0.35,
    headForwardOffset: 0.12,
    headRestPitch: 18,
  }, 'head edits must land in the active profile');
  settings.setActiveHeadProfile('skull');
  assert.equal(notifications, 1, 'selecting the active profile is a no-op');
  settings.patch({ shoulderWidth: 1.18 });
  assert.equal(notifications, 2);
  assert.equal(settings.getHeadProfile('skull').headRestPitch, 18,
    'a body edit must leave the head profile alone');

  const persisted = JSON.parse(
    storage.values.get(CHARACTER_PROPORTION_STORAGE_KEY),
  );
  assert.equal(persisted.version, 1,
    'head profiles extend the compatible v1 envelope');
  assert.equal('activeHeadProfile' in persisted, false,
    'Player head style remains the sole persisted profile selector');
  assert.equal(persisted.settings.headRestPitch, 18,
    'flat settings must continue to describe the active profile');
  assert.deepEqual(Object.keys(persisted.headProfiles), ['skull']);
  assert.equal(persisted.headProfiles.skull.headRestPitch, 18);

  const reloaded = new CharacterProportionSettings(storage);
  assert.equal(reloaded.activeHeadProfile, 'skull');
  assert.equal(reloaded.value.headRestPitch, 18);
  assert.equal(reloaded.value.shoulderWidth, 1.18);
  assert.deepEqual(reloaded.headProfiles, settings.headProfiles);

  // A browser that last ran a build with BoolieRoo selected: the flat settings describe the head
  // that no longer exists, and the envelope carries its profile beside the Skull's. He comes back
  // as the Skull he had tuned, with his body as he left it, and the retired profile is not kept.
  const retiredRoo = {
    headSize: 1.32,
    headWidth: 1.18,
    headDepth: 1.31,
    neckLength: 0.25,
    headForwardOffset: -0.08,
    headRestPitch: -14,
  };
  const tunedSkull = {
    headSize: 1.8,
    headWidth: 1.1,
    headDepth: 0.9,
    neckLength: -0.35,
    headForwardOffset: 0.12,
    headRestPitch: 18,
  };
  const retiredStorage = memoryStorage({
    [CHARACTER_PROPORTION_STORAGE_KEY]: JSON.stringify({
      version: 1,
      handRestRevision: CHARACTER_HAND_REST_REVISION,
      defaultsRevision: CHARACTER_PROPORTION_DEFAULTS_REVISION,
      defaults: DEFAULT_CHARACTER_PROPORTIONS,
      settings: { ...DEFAULT_CHARACTER_PROPORTIONS, ...retiredRoo, torsoWidth: 1.27 },
      headProfiles: { skull: tunedSkull, roo: retiredRoo },
    }),
  });
  const retired = new CharacterProportionSettings(retiredStorage);
  assert.equal(retired.activeHeadProfile, 'skull');
  assert.deepEqual(Object.keys(retired.headProfiles), ['skull'],
    'a stored profile for a removed head must not be revived');
  assert.deepEqual(retired.headProfiles.skull, tunedSkull);
  assert.deepEqual(retired.value, { ...DEFAULT_CHARACTER_PROPORTIONS, ...tunedSkull, torsoWidth: 1.27 },
    'a removed head\'s flat values must give way to the stored Skull profile, body settings kept');
  assert.throws(() => retired.setActiveHeadProfile('roo'), /Unknown character head profile/);
  assert.throws(() => retired.getHeadProfile('roo'), /Unknown character head profile/);
  retired.patch({ hipWidth: 1.08 });
  const resaved = JSON.parse(retiredStorage.values.get(CHARACTER_PROPORTION_STORAGE_KEY));
  assert.deepEqual(Object.keys(resaved.headProfiles), ['skull'],
    'the next save must drop the removed head\'s profile');
  assert.equal(resaved.settings.headRestPitch, 18);
  assert.equal(resaved.settings.hipWidth, 1.08);

  const {
    headRestPitch: _legacyHeadRestPitch,
    ...legacyIdentity
  } = IDENTITY_CHARACTER_PROPORTIONS;
  const legacyStorage = memoryStorage({
    [CHARACTER_PROPORTION_STORAGE_KEY]: JSON.stringify({
      version: 1,
      settings: {
        ...legacyIdentity,
        headSize: 1.44,
        headWidth: 1.16,
        headDepth: 0.92,
        neckLength: -0.2,
        headForwardOffset: 0.09,
      },
    }),
  });
  const legacy = new CharacterProportionSettings(legacyStorage);
  assert.equal(legacy.activeHeadProfile, 'skull');
  assert.deepEqual(legacy.headProfiles.skull, {
    headSize: 1.44,
    headWidth: 1.16,
    headDepth: 0.92,
    neckLength: -0.2,
    headForwardOffset: 0.09,
    headRestPitch: 0,
  }, 'legacy shared head values must seed the profile');
  assert.equal(legacy.value.torsoWidth, DEFAULT_CHARACTER_PROPORTIONS.torsoWidth,
    'existing defaults migration must still apply to legacy body settings');
  assert.equal(legacy.value.wristRestPitch, DEFAULT_CHARACTER_PROPORTIONS.wristRestPitch,
    'existing hand-rest migration must still apply');

  const revision3Defaults = {
    ...DEFAULT_CHARACTER_PROPORTIONS,
    headSize: 1.4,
    headRestPitch: 0,
  };
  const revision3 = (skull) => new CharacterProportionSettings(memoryStorage({
    [CHARACTER_PROPORTION_STORAGE_KEY]: JSON.stringify({
      version: 1,
      handRestRevision: CHARACTER_HAND_REST_REVISION,
      defaultsRevision: 3,
      defaults: revision3Defaults,
      settings: { ...revision3Defaults, ...skull },
      headProfiles: {
        skull: {
          headSize: 1.4,
          headWidth: revision3Defaults.headWidth,
          headDepth: revision3Defaults.headDepth,
          neckLength: revision3Defaults.neckLength,
          headForwardOffset: revision3Defaults.headForwardOffset,
          headRestPitch: revision3Defaults.headRestPitch,
          ...skull,
        },
      },
    }),
  }));
  assert.equal(revision3({}).headProfiles.skull.headSize,
    DEFAULT_CHARACTER_PROPORTIONS.headSize,
    'an untouched stored profile follows authored-default migrations');
  const revision3Edited = revision3({ headSize: 1.26, headRestPitch: -9 });
  assert.equal(revision3Edited.headProfiles.skull.headSize, 1.26,
    'a deliberately edited stored profile survives authored-default migrations');
  assert.equal(revision3Edited.headProfiles.skull.headRestPitch, -9);
  assert.equal(revision3Edited.value.headSize, 1.26);

  const legacyImport = new CharacterProportionSettings(memoryStorage());
  legacyImport.patch({ headRestPitch: -22 });
  legacyImport.importJson(JSON.stringify({
    version: 1,
    handRestRevision: CHARACTER_HAND_REST_REVISION,
    settings: {
      ...DEFAULT_CHARACTER_PROPORTIONS,
      headSize: 1.21,
      neckLength: 0.4,
      headForwardOffset: -0.11,
      headRestPitch: 7,
      hipWidth: 1.08,
    },
  }));
  assert.equal(legacyImport.activeHeadProfile, 'skull');
  assert.equal(legacyImport.headProfiles.skull.headSize, 1.21,
    'a flat import must seed the profile');
  assert.equal(legacyImport.value.headRestPitch, 7);
  assert.equal(legacyImport.value.hipWidth, 1.08);

  const exported = settings.serialize(false);
  const imported = new CharacterProportionSettings(memoryStorage());
  imported.importJson(exported);
  assert.equal(imported.activeHeadProfile, 'skull');
  assert.deepEqual(imported.headProfiles, settings.headProfiles,
    'profile-aware JSON must retain the profile');
  assert.deepEqual(imported.value, settings.value);

  // JSON copied out of a build that still had BoolieRoo imports the same way a stored one loads.
  const retiredImport = new CharacterProportionSettings(memoryStorage());
  retiredImport.importJson(JSON.stringify({
    version: 1,
    handRestRevision: CHARACTER_HAND_REST_REVISION,
    defaultsRevision: CHARACTER_PROPORTION_DEFAULTS_REVISION,
    settings: { ...DEFAULT_CHARACTER_PROPORTIONS, ...retiredRoo, torsoWidth: 1.27 },
    headProfiles: { skull: tunedSkull, roo: retiredRoo },
  }));
  assert.deepEqual(Object.keys(retiredImport.headProfiles), ['skull']);
  assert.deepEqual(retiredImport.value, { ...DEFAULT_CHARACTER_PROPORTIONS, ...tunedSkull, torsoWidth: 1.27 });

  imported.reset();
  assert.deepEqual(imported.headProfiles, DEFAULT_CHARACTER_HEAD_PROFILES);
  assert.notEqual(imported.headProfiles.skull, DEFAULT_CHARACTER_HEAD_PROFILES.skull,
    'reset must clone rather than expose an authored profile object');
  assert.deepEqual(imported.value, DEFAULT_CHARACTER_PROPORTIONS);

  const replacement = new CharacterProportionSettings(memoryStorage());
  replacement.replace({
    ...DEFAULT_CHARACTER_PROPORTIONS,
    headRestPitch: 11,
    headForwardOffset: 0.2,
  });
  assert.equal(replacement.headProfiles.skull.headRestPitch, 11,
    'the legacy flat replace API must seed the profile');
  assert.equal(replacement.headProfiles.skull.headForwardOffset, 0.2);
  assert.equal(replacement.value.headRestPitch, 11);

  for (const unknown of ['alternate', 'roo', 'cargo']) {
    assert.throws(
      () => replacement.setActiveHeadProfile(unknown),
      /Unknown character head profile/,
    );
    assert.throws(
      () => replacement.getHeadProfile(unknown),
      /Unknown character head profile/,
    );
  }

  assert.equal(CHARACTER_PROPORTION_DEFAULTS_REVISION, 6,
    'Chrome-authored defaults advance the existing v1 migration revision');
console.log('PASS character head profile settings, persistence, and legacy migration');
