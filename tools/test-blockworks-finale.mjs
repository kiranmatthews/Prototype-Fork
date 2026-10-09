import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { skateRoofWedges } from './blockworks-skate-pilot.mjs';

const rounded = n => Math.round(n * 1000) / 1000;

/** Continue the supplied live player from the machinery roof or s1550 to the
 * finish. Normal inputs own every handoff; no placement, reset or state write.
 * Set bankCheckpoint:false only when the caller owns that checkpoint approach.
 * The returned records can be appended to a complete-course evidence log. */
export function runFinale(r, options = {}) {
  const evidence = options.evidence ?? [];
  const { p, l, sourceModule: m } = r;
  const originalTuning = JSON.stringify(r.TUNING), station = () => 20 - p.pos.z;
  const at = (s, y = 0, u = 0) => m.routePoint(s, y, u);
  const follow = (lookAhead = 14, offset = () => 0) => r.steerToward(at(station() + lookAhead, 0, offset(station() + lookAhead)));
  const note = label => evidence.push({ label, station: rounded(station()),
    position: p.pos.toArray().map(rounded), speed: rounded(p.speed), state: p.state, frame: r.frame });
  const brake = label => {
    r.until(() => !p.freeSkate && Math.abs(p.speed) < .08, { grabHeld: true }, { maxFrames: 360, label });
    r.stepFor(45, {});
    assert.ok(p.grounded && !p.isBailing, label + ' ended unsupported');
  };
  const gapJump = (edge, label, { landOffset = () => 0, grabRail = false, spinApproach = () => false } = {}) => {
    r.until(() => station() >= edge - .8, () => ({ ...follow(14, landOffset), jumpHeld: true,
      spinHeld:p.grounded&&spinApproach(station())&&(p.spinning||!r.lastInput.spinHeld) }),
      { maxFrames: 2400, label: label + ' approach' });
    note(label + ' takeoff');
    assert.ok(p.grounded && p.freeSkate && p.speed > 20, label + ' needs an earned skating approach');
    r.releaseJump({ ...follow(14, landOffset), grindHeld: grabRail });
    assert.equal(p.state, 'air', label + ' charged release did not launch');
    r.until(() => p.grounded || (grabRail && p.state === 'grind'),
      () => ({ ...follow(14, landOffset), grindHeld: grabRail }),
      { maxFrames: 180, label: label + ' landing' });
    const landing = m.BLOCKWORKS_GAPS.find(g => g.a === edge).b;
    assert.ok(station() >= landing, label + ' landed before its receiving edge'); note(label + ' landing');
  };

  const initial = m.BLOCKWORKS_CHECKPOINTS.find(cp => cp.s === 1550);
  assert.ok(initial, 'finale checkpoint missing');
  const checkpoint = l.checkpoints.find(cp => Math.abs(cp.spawnPos.z - initial.p[2]) < .1);
  assert.ok(checkpoint, 'live finale checkpoint missing');
  assert.ok(station() >= 1414 && station() < 1570 && p.grounded,
    'finale expects the live machinery receiving roof or checkpoint approach');
  if (options.bankCheckpoint !== false && !checkpoint.active) {
    if (station() < 1544) {
      const offset = s => 3.5 * Math.max(0, Math.min(1, (s - 1528) / 16));
      r.skateAlong(s => at(s, 13.2, offset(s)), { to: 1545, progress: station,
        lookAhead: 10, label: 'carry machinery exit into the finale checkpoint' });
    }
    if (!p.freeSkate && Math.abs(p.speed) < 2) {
      // The standalone starts at the marker; an existing foot context can
      // reach it normally. No checkpoint state is changed outside gameplay.
      r.walkTo(initial.p, { buttons: { spinHeld: true }, label: 'walk and spin finale checkpoint' });
    } else {
      r.until(() => checkpoint.active, () => ({ ...r.steerToward(initial.p),
        jumpHeld: true, spinHeld: true }), { maxFrames: 240, label: 'bank finale checkpoint in motion' });
    }
    assert.ok(checkpoint.active, 'finale checkpoint was not activated through normal input');
  }
  note('Finale checkpoint entry');
  gapJump(1687, 'Downhill ice relay');
  const ice = r.trace.filter(t => { const s = 20 - t.position[2]; return s > 1641 && s < 1663; });
  assert.ok(ice.length > 30 && ice.every(t => t.grounded), 'relay must ride through the ice continuously');
  assert.ok(Math.max(...ice.map(t => t.speed)) > 24, 'relay never earned downhill overspeed');

  // The left lane clears the added east-roof wedge. Spin the grunt, then
  // ease back onto the kicker line
  // before launching into the parapet approach over the next twelve metres.
  const gruntBypass = s => s < 1729 ? -2.2 : -Math.max(0, 2.2 * (1742 - s) / 13);
  const gruntPoint=at(1722,4.8,-1.2),grunt=l.enemies.find(e=>e.kind==='grunt'&&Math.hypot((e.homeX??e.group.position.x)-gruntPoint[0],(e.homeZ??e.group.position.z)-gruntPoint[2])<3);
  assert.ok(grunt,'the relay grunt must exist');
  const enemyBegin = r.frame;
  gapJump(1754, 'Curved kicker', { landOffset: gruntBypass, grabRail: true,
    spinApproach:s=>s>1718&&s<1729 });
  assert.ok(!grunt.alive,'the left-hand route must clear the grunt through gameplay');
  const parapetOffset = s => 4.4 * Math.sin(Math.PI * Math.max(0, Math.min(77, s - 1776)) / 77);
  r.grindUntil(() => station() >= 1856 && p.grounded && p.state === 'ride', {
    approachInput: () => follow(10, parapetOffset), maxFrames: 1500, label: 'relay parapet around the turtle',
  });
  assert.ok(r.trace.slice(enemyBegin).some(t => t.state === 'grind'), 'relay route did not use its parapet');
  note('Roof relay grind exit');

  const checkpointOffset = s => s < 1888 ? 0 : s < 1904 ? 2.7 * (s - 1888) / 16 : s < 1915 ? 2.7 : Math.max(0, 2.7 * (1930 - s) / 15);
  r.until(() => station() >= 1915, () => ({ ...follow(10, checkpointOffset), jumpHeld: true, spinHeld: station() >= 1904 }),
    { maxFrames: 1200, label: 'bank crown checkpoint after the complete relay' });
  assert.ok(l.checkpoints[l.checkpoints.length - 1].active, 'crown checkpoint was skipped');
  note('Crown checkpoint');
  gapJump(2018, 'Crown ice gap');
  brake('dry brake before the crown roofs');
  const climb = m.BLOCKWORKS_CLIMBS.find(c => c.name === 'Crown roof bays');
  const firstRoof = climb?.steps[0];
  assert.ok(firstRoof, 'crown roof metadata missing');
  const [fx, , fz] = m.routeTangent(firstRoof.s);
  const towardRoof = (p.pos.x - firstRoof.point[0]) * fx + (p.pos.z - firstRoof.point[2]) * fz;
  assert.ok(p.grounded && !p.groundHit?.slippy && towardRoof < -firstRoof.depth / 2 && p.pos.y < firstRoof.top,
    'landing must stop on the dry approach or its skate wedge before the first roof face');
  note('Crown dry stop');

  // These roofs now have authored partial-width skate wedges. Follow their
  // real low/high contacts instead of jumping from the old unobstructed apron.
  skateRoofWedges(r, 'Crown roof bays');
  assert.ok(p.grounded && p.freeSkate && Math.abs(p.pos.y - climb.exit[1]) < .15,
    'Crown wedges must deliver the live rider mounted onto the departure roof');
  note('Crown roofs skate exit');
  r.until(() => p.state === 'grind', () => ({ ...follow(7), jumpHeld: true, grindHeld: true }),
    { maxFrames: 900, label: 'catch final crown arc' });
  note('Final grind catch');
  r.grindUntil(() => station() >= 2128 && p.grounded && p.state === 'ride', {
    approachInput: () => follow(10), buttons: { jumpHeld: true }, maxFrames: 900, label: 'finish grind onto the receiving tower',
  });
  note('Final grind landing');
  r.until(() => p.state === 'finished', () => ({ ...r.steerToward(at(2138, 13.2)), jumpHeld: true }),
    { maxFrames: 360, label: 'cross the real finish gate' });
  assert.equal(p.totalDeaths, 0);
  assert.ok(r.trace.every(row => !row.bailing && !['dead', 'gameover'].includes(row.state)), 'run hid a bail or death');
  assert.equal(JSON.stringify(r.TUNING), originalTuning, 'finale altered movement tuning');
  note('Finish gate');

  return evidence;
}

/** Standalone regression retains its single initial checkpoint placement. */
export async function runBlockworksFinaleChecks() {
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  let authored;
  try { authored = await server.ssrLoadModule('/src/levels/codex-lab.ts'); }
  finally { await server.close(); }
  const initial = authored.BLOCKWORKS_CHECKPOINTS.find(cp => cp.s === 1550);
  assert.ok(initial, 'finale checkpoint missing');
  const evidence = [], tracePath = process.env.BLOCKWORKS_FINALE_TRACE ?? '/tmp/blockworks-finale-trace.json';
  let recording, failure;
  try {
    await withBlockworksRuntime(r => {
      recording = { sourceSha256: createHash('sha256').update(JSON.stringify(r.source)).digest('hex'),
        fixedStep: r.dt, tuning: structuredClone(r.TUNING), frames: r.trace, actions: r.actions };
      runFinale(r, { evidence });
    }, { start: [initial.p[0], initial.p[1] + .1, initial.p[2]], maxFrames: 18000 });
  } catch (error) { failure = error; }
  finally { await writeFile(tracePath, JSON.stringify({ evidence, recording, failure: failure?.message }, null, 2)); }
  console.log(JSON.stringify({ evidence, tracePath }, null, 2));
  if (failure) throw failure;
  console.log('PASS continuous checkpoint1550 to finish through relay ice, kicker, parapet, crown roofs and final grind');
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runBlockworksFinaleChecks();
