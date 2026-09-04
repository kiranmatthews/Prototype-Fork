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

  assert.deepEqual(CHARACTER_HEAD_PROFILE_IDS, ['skull', 'roo']);
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
  assert.equal(Object.isFrozen(DEFAULT_CHARACTER_HEAD_PROFILES.roo), true);
  assert.notEqual(DEFAULT_CHARACTER_HEAD_PROFILES.skull,
    DEFAULT_CHARACTER_HEAD_PROFILES.roo,
    'each style owns an independent immutable authored-default snapshot');
  assert.notDeepEqual(DEFAULT_CHARACTER_HEAD_PROFILES.skull,
    DEFAULT_CHARACTER_HEAD_PROFILES.roo,
    'skull and roo preserve their separately tuned head profiles');
  assert.throws(
    () => { DEFAULT_CHARACTER_HEAD_PROFILES.roo.headRestPitch = -12; },
    TypeError,
  );

  const storage = memoryStorage();
  const settings = new CharacterProportionSettings(storage);
  assert.equal(settings.activeHeadProfile, 'skull');
  assert.notDeepEqual(settings.headProfiles.skull, settings.headProfiles.roo,
    'new skull and roo profiles must preserve their distinct authored defaults');
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
  assert.equal(settings.getHeadProfile('skull').headRestPitch, 18);
  assert.equal(settings.getHeadProfile('roo').headRestPitch, -23);

  settings.setActiveHeadProfile('roo');
  assert.equal(notifications, 2);
  assert.equal(settings.value.headSize, DEFAULT_CHARACTER_HEAD_PROFILES.roo.headSize);
  assert.equal(settings.value.headRestPitch, DEFAULT_CHARACTER_HEAD_PROFILES.roo.headRestPitch);
  assert.equal(settings.value.torsoWidth, 1.27,
    'switching heads must not replace shared body settings');
  settings.setActiveHeadProfile('roo');
  assert.equal(notifications, 2, 'selecting the active profile is a no-op');

  settings.patch({
    headSize: 1.32,
    neckLength: 0.25,
    headForwardOffset: -0.08,
    headRestPitch: -14,
    shoulderWidth: 1.18,
  });
  settings.setActiveHeadProfile('skull');
  assert.equal(settings.value.headSize, 1.8);
  assert.equal(settings.value.neckLength, -0.35);
  assert.equal(settings.value.headForwardOffset, 0.12);
  assert.equal(settings.value.headRestPitch, 18);
  assert.equal(settings.value.torsoWidth, 1.27);
  assert.equal(settings.value.shoulderWidth, 1.18);
  settings.setActiveHeadProfile('roo');
  assert.equal(settings.value.headSize, 1.32);
  assert.equal(settings.value.neckLength, 0.25);
  assert.equal(settings.value.headForwardOffset, -0.08);
  assert.equal(settings.value.headRestPitch, -14);
  assert.equal(settings.value.torsoWidth, 1.27);
  assert.equal(settings.value.shoulderWidth, 1.18);

  const persisted = JSON.parse(
    storage.values.get(CHARACTER_PROPORTION_STORAGE_KEY),
  );
  assert.equal(persisted.version, 1,
    'head profiles extend the compatible v1 envelope');
  assert.equal('activeHeadProfile' in persisted, false,
    'Player head style remains the sole persisted profile selector');
  assert.equal(persisted.settings.headRestPitch, -14,
    'flat settings must continue to describe the active profile');
  assert.equal(persisted.headProfiles.skull.headRestPitch, 18);
  assert.equal(persisted.headProfiles.roo.headRestPitch, -14);

  const reloaded = new CharacterProportionSettings(storage);
  assert.equal(reloaded.activeHeadProfile, 'skull');
  assert.equal(reloaded.value.headRestPitch, 18);
  assert.equal(reloaded.value.shoulderWidth, 1.18);
  reloaded.setActiveHeadProfile('roo');
  assert.equal(reloaded.value.headRestPitch, -14);
  assert.equal(reloaded.value.shoulderWidth, 1.18);

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
  assert.deepEqual(legacy.headProfiles.skull, legacy.headProfiles.roo,
    'legacy shared head values must seed both profiles identically');
  assert.deepEqual(legacy.headProfiles.skull, {
    headSize: 1.44,
    headWidth: 1.16,
    headDepth: 0.92,
    neckLength: -0.2,
    headForwardOffset: 0.09,
    headRestPitch: 0,
  });
  assert.equal(legacy.value.torsoWidth, DEFAULT_CHARACTER_PROPORTIONS.torsoWidth,
    'existing defaults migration must still apply to legacy body settings');
  assert.equal(legacy.value.wristRestPitch, DEFAULT_CHARACTER_PROPORTIONS.wristRestPitch,
    'existing hand-rest migration must still apply');

  const revision3Defaults = {
    ...DEFAULT_CHARACTER_PROPORTIONS,
    headSize: 1.4,
    headRestPitch: 0,
  };
  const revision3Profiles = new CharacterProportionSettings(memoryStorage({
    [CHARACTER_PROPORTION_STORAGE_KEY]: JSON.stringify({
      version: 1,
      handRestRevision: CHARACTER_HAND_REST_REVISION,
      defaultsRevision: 3,
      defaults: revision3Defaults,
      settings: revision3Defaults,
      headProfiles: {
        skull: {
          headSize: 1.4,
          headWidth: revision3Defaults.headWidth,
          headDepth: revision3Defaults.headDepth,
          neckLength: revision3Defaults.neckLength,
          headForwardOffset: revision3Defaults.headForwardOffset,
          headRestPitch: revision3Defaults.headRestPitch,
        },
        roo: {
          headSize: 1.26,
          headWidth: revision3Defaults.headWidth,
          headDepth: revision3Defaults.headDepth,
          neckLength: revision3Defaults.neckLength,
          headForwardOffset: revision3Defaults.headForwardOffset,
          headRestPitch: -9,
        },
      },
    }),
  }));
  assert.equal(revision3Profiles.headProfiles.skull.headSize,
    DEFAULT_CHARACTER_PROPORTIONS.headSize,
    'an untouched stored profile follows authored-default migrations');
  assert.equal(revision3Profiles.headProfiles.roo.headSize, 1.26,
    'a deliberately edited stored profile survives authored-default migrations');
  assert.equal(revision3Profiles.headProfiles.roo.headRestPitch, -9);

  const legacyImport = new CharacterProportionSettings(memoryStorage());
  legacyImport.setActiveHeadProfile('roo');
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
  assert.equal(legacyImport.activeHeadProfile, 'roo',
    'a legacy import need not change the currently selected head');
  assert.deepEqual(legacyImport.headProfiles.skull, legacyImport.headProfiles.roo);
  assert.equal(legacyImport.value.headRestPitch, 7);
  assert.equal(legacyImport.value.hipWidth, 1.08);

  const exported = settings.serialize(false);
  const imported = new CharacterProportionSettings(memoryStorage());
  imported.setActiveHeadProfile('roo');
  imported.importJson(exported);
  assert.equal(imported.activeHeadProfile, 'roo');
  assert.deepEqual(imported.headProfiles, settings.headProfiles,
    'profile-aware JSON must retain both profiles');
  assert.deepEqual(imported.value, settings.value);

  imported.reset();
  assert.notDeepEqual(imported.headProfiles.skull, imported.headProfiles.roo);
  assert.deepEqual(imported.headProfiles, DEFAULT_CHARACTER_HEAD_PROFILES);
  assert.notEqual(imported.headProfiles.roo, DEFAULT_CHARACTER_HEAD_PROFILES.roo,
    'reset must clone rather than expose an authored profile object');
  assert.deepEqual(imported.headProfiles.skull, {
    headSize: DEFAULT_CHARACTER_PROPORTIONS.headSize,
    headWidth: DEFAULT_CHARACTER_PROPORTIONS.headWidth,
    headDepth: DEFAULT_CHARACTER_PROPORTIONS.headDepth,
    neckLength: DEFAULT_CHARACTER_PROPORTIONS.neckLength,
    headForwardOffset: DEFAULT_CHARACTER_PROPORTIONS.headForwardOffset,
    headRestPitch: DEFAULT_CHARACTER_PROPORTIONS.headRestPitch,
  });
  assert.deepEqual(imported.value, {
    ...DEFAULT_CHARACTER_PROPORTIONS, ...DEFAULT_CHARACTER_HEAD_PROFILES.roo,
  });

  const replacement = new CharacterProportionSettings(memoryStorage());
  replacement.setActiveHeadProfile('roo');
  replacement.replace({
    ...DEFAULT_CHARACTER_PROPORTIONS,
    headRestPitch: 11,
    headForwardOffset: 0.2,
  });
  assert.deepEqual(replacement.headProfiles.skull, replacement.headProfiles.roo,
    'the legacy flat replace API must seed both profiles');
  assert.equal(replacement.value.headRestPitch, 11);

  assert.throws(
    () => replacement.setActiveHeadProfile('alternate'),
    /Unknown character head profile/,
  );
  assert.throws(
    () => replacement.getHeadProfile('alternate'),
    /Unknown character head profile/,
  );

  assert.equal(CHARACTER_PROPORTION_DEFAULTS_REVISION, 6,
    'Chrome-authored defaults advance the existing v1 migration revision');
console.log('PASS character head profile settings, persistence, and legacy migration');
