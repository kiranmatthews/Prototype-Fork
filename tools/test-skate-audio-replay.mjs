import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

const replay = JSON.parse(await readFile(new URL('./fixtures/treehouse-skate-audio-replay.json', import.meta.url), 'utf8'));
await withBlockworksRuntime(async r => {
  const { Replayer } = await r.server.ssrLoadModule('/src/replay.ts');
  const { sfx } = await r.server.ssrLoadModule('/src/audio.ts');
  const replayer = new Replayer(), input = {}, sounds = [], samples = [], movement = createHash('sha256');
  const originalPlay = sfx.play;
  sfx.play = name => sounds.push({ frame: replayer.frame, name });
  replayer.begin(replay);
  try {
    for (let frame = 1; frame <= replay.frames; frame++) {
      assert.ok(replayer.feed(input, r.p.camDir)); r.tick(input);
      const p = r.p;
      movement.update(JSON.stringify([p.state, p.grounded, p.boardRolling, p.sliding, p.speed, p.vVel, p.pos.y]));
      samples.push({ frame, rolling: p.skateSoundRolling,
        raw: p.state === 'ride' && p.grounded && p.boardRolling && !p.sliding && Math.abs(p.speed) > .3 });
      if (input.jumpReleased && p.state === 'air' && p.vVel > 2)
        assert.equal(p.skateSoundRolling, false, `jump ${frame}: wheels must stop immediately`);
      if (!p.boardRolling || p.sliding || Math.abs(p.speed) <= .3 || p.isBailing)
        assert.equal(p.skateSoundRolling, false, `frame ${frame}: inactive wheels must stay silent`);
    }
    const windows = [[1980, 2022], [3570, 3590]];
    for (const [first, last] of windows) {
      const section = samples.slice(first - 1, last);
      assert.ok(section.filter(s => !s.raw).length >= 5, 'fixture must still exercise contact chatter');
      assert.ok(section.every(s => s.rolling), `wheel loop restarted at contact gaps ${first}-${last}`);
      assert.deepEqual(sounds.filter(s => s.name === 'skateTransition' && s.frame >= first && s.frame <= last), [],
        'tiny ground gaps must not stack landing sounds');
    }
    const landings = sounds.filter(s => s.name === 'skateTransition').map(s => s.frame);
    assert.deepEqual(landings, [682, 778, 819, 3285, 3614], 'real landing sounds must survive');
    assert.equal(movement.digest('hex'), 'a4826d9802d8eaed266f11e47b8961aa3293530a0618f27679e01189fc28b628',
      'audio filtering must preserve the original replay movement');

    // Exercise exits not covered by this recording, including low-speed
    // jumps (coyote is closed), long shallow falls, rails and respawns.
    const getter = Object.getOwnPropertyDescriptor(r.Player.prototype, 'skateSoundRolling').get;
    const contact = Object.getOwnPropertyDescriptor(r.Player.prototype, 'skateSoundContact').get;
    const sample = { state: 'air', grounded: false, freeSkate: true, sliding: false,
      isBailing: false, speed: 12, coyoteTimer: .1, airborneT: 1 / 60, vVel: 0,
      get skateSoundContact() { return contact.call(this); } };
    assert.equal(getter.call(sample), true);
    for (const patch of [{ coyoteTimer: 0 }, { airborneT: .1 }, { vVel: 3 }, { vVel: -3 },
      { state: 'grind' }, { state: 'dead' }, { state: 'hang' }, { freeSkate: false },
      { sliding: true }, { isBailing: true }, { speed: .3 }])
      assert.equal(getter.call({ ...sample, ...patch, get skateSoundContact() { return contact.call(this); } }), false,
        `audio must stop for ${JSON.stringify(patch)}`);
    console.log(`PASS ${replay.frames} replay frames: uninterrupted wheel loops at both contact gaps, 19 false landing sounds removed, five real landings retained, unchanged movement.`);
  } finally { replayer.end(); sfx.play = originalPlay; }
}, { modulePath: '/src/levels/treehouse-trail.ts', source: m => m.TREEHOUSE_TRAIL_LEVEL,
  levelId: 'treehouse-trail', endlessDeaths: true });
