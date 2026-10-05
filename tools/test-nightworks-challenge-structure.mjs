import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { withAfterHoursRuntime } from './nightworks-runner.mjs';

const finitePoint = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const inputKeys = ['moveX', 'moveY', 'jumpHeld', 'grindHeld', 'spinHeld', 'grabHeld', 'transferHeld', 'jumpReleased'];
const contactsByKind = {
  aim: ['platform', 'ramp'], 'moving-landings': ['mover'], carve: ['vertramp'], phase: ['phasepad'],
  'rail-transfer': ['rail'], weave: ['ramp'], uphill: ['platform', 'ramp'], finale: ['phasepad', 'rail'],
};
const ownComponents = (stage, components) => components.filter(c => c.grp === stage.grp);
const sourceIndex = object => object?.userData.editorIdx;
const unique = values => [...new Set(values)];
const positivePhaseTime = (angle, phase, speed) => ((angle - phase) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) / speed;

/** Full-journey contract for production-controller or browser recordings.
 * Contacts must come from the live runtime; waypoint or milestone counters do
 * not prove an obstacle was played. This contains no duration benchmark.
 * A trace records every fixed tick's frame, position, state, grounded,
 * boardRolling (or freeSkate), bailing, deaths, normalized input, and actual
 * source indices as supportComponent / railComponent. report.chapters provides
 * ordered id/firstFrame/lastFrame spans through that same continuous trace.
 */
export function assertAfterHoursMountedEvidence(report, stages, components) {
  const trace = report.trace;
  assert.ok(Array.isArray(trace) && trace.length > 1, 'a full production trace is required');
  assert.ok(Array.isArray(report.chapters), 'actual ordered chapter recordings are required');
  assert.deepEqual(report.chapters.map(c => c.id), stages.map(s => s.id), 'every required chapter is recorded in route order');
  let mounted = false, previousFrame = trace[0].frame - 1;
  for (const f of trace) {
    assert.equal(f.frame, previousFrame + 1, 'record every fixed simulation tick'); previousFrame = f.frame;
    assert.ok(finitePoint(f.position), 'trace positions are finite world coordinates');
    assert.ok(f.input && inputKeys.every(key => key in f.input), 'trace includes complete normalized device samples');
    assert.ok(Number.isFinite(f.input.moveX) && Number.isFinite(f.input.moveY));
    assert.ok(Math.hypot(f.input.moveX, f.input.moveY) <= 1.011, 'device axes stay normalized after replay rounding');
    assert.ok(!f.bailing && !['dead', 'gameover'].includes(f.state), 'accepted journey has no death or bail');
    assert.equal(f.deaths, 0, 'accepted journey starts fresh and stays alive');
    const onBoard = f.boardRolling ?? f.freeSkate;
    assert.equal(typeof onBoard, 'boolean', 'record actual mounted state'); mounted ||= onBoard;
    if (mounted && f.state !== 'finished') assert.ok(onBoard, 'stay mounted after push-off');
    if (Number.isInteger(f.supportComponent)) assert.ok(f.grounded, 'support contacts are recorded only while grounded');
    if (Number.isInteger(f.railComponent)) assert.equal(f.state, 'grind', 'rail contacts are recorded only during real grinds');
  }
  assert.ok(mounted, 'accepted journey actually mounts the board');
  assert.equal(trace.at(-1).state, 'finished', 'full-route evidence ends at the finish gate');
  let previousEnd = trace[0].frame;
  for (const [i, chapter] of report.chapters.entries()) {
    const stage = stages[i];
    assert.ok(Number.isInteger(chapter.firstFrame) && Number.isInteger(chapter.lastFrame));
    assert.ok(chapter.firstFrame >= previousEnd && chapter.lastFrame > chapter.firstFrame, 'chapter spans progress through the full route');
    const samples = trace.filter(f => f.frame >= chapter.firstFrame && f.frame <= chapter.lastFrame);
    assert.ok(samples.length > 1, 'chapter span exists in the continuous trace');
    const contacts = unique(samples.flatMap(f => [f.supportComponent, f.railComponent]).filter(Number.isInteger));
    for (const index of contacts) assert.ok(components[index], 'recorded contacts resolve to current source components');
    const own = contacts.filter(index => components[index].grp === stage.grp);
    const ownGrinds = unique(samples.filter(f => f.state === 'grind').map(f => f.railComponent).filter(Number.isInteger)).filter(index => components[index]?.grp === stage.grp && components[index].t === 'rail');
    for (const type of contactsByKind[stage.kind]) {
      assert.ok(type === 'rail' ? ownGrinds.length > 0 : own.some(index => components[index].t === type), `${chapter.id}: contact the actual ${type} challenge`);
    }
    const distinct = type => own.filter(index => components[index].t === type).length;
    const releases = samples.filter(f => f.input.jumpReleased && f.state === 'air').length;
    if (['aim', 'uphill'].includes(stage.kind)) assert.ok(releases >= 2 && distinct('ramp') >= 2, `${chapter.id}: perform both aimed launches`);
    if (stage.kind === 'moving-landings') {
      const required = components.flatMap((c, index) => c.grp === stage.grp && c.t === 'mover' ? [index] : []);
      assert.ok(required.length >= 3 && required.every(index => own.includes(index)), 'land on every authored delivery mover during the full journey');
    }
    if (stage.kind === 'phase') {
      const stations = unique(own.filter(index => components[index].t === 'phasepad').map(index => components[index].p[2]));
      assert.equal(stations.length, new Set(components.filter(c=>c.grp===stage.grp&&c.t==='phasepad').map(c=>c.p[2])).size, 'cross every phase station on an actual active deck');
    }
    if (stage.kind === 'rail-transfer') {
      const required = components.flatMap((c, index) => c.grp === stage.grp && c.t === 'rail' ? [index] : []);
      assert.ok(required.length >= 2 && required.every(index => ownGrinds.includes(index)) && releases >= 1, 'grind and pop between both actual counterweight ridges');
    }
    if (stage.kind === 'finale') {
      const required = components.flatMap((c, index) => c.grp === stage.grp && ['phasepad', 'rail'].includes(c.t) ? [index] : []);
      assert.ok(required.every(index => components[index].t === 'rail' ? ownGrinds.includes(index) : own.includes(index)), 'finale records actual final phase-deck and moving-ridge contacts');
    }
    if (stage.kind === 'carve') {
      const lateral = samples.slice(1).reduce((distance, f, n) => distance + Math.abs(f.position[0] - samples[n].position[0]), 0);
      const net = Math.abs(samples.at(-1).position[0] - samples[0].position[0]);
      const road = ownComponents(stage, components).find(c => c.t === 'vertramp'), xs = road.pts.map(p => road.p[0] + p[0]);
      assert.ok(lateral > net + (Math.max(...xs) - Math.min(...xs)) * .5, 'carve the reversing road rather than travel its straight chord');
    }
    if (stage.kind === 'weave') {
      for (const obstruction of ownComponents(stage, components).filter(c => c.t === 'platform' && c.nm === 'Workbay quarry obstruction')) {
        const crossing = samples.filter(f => Math.abs(f.position[2] - obstruction.p[2]) < obstruction.s[2] / 2);
        assert.ok(crossing.length, 'record the route through each workbay obstruction');
        assert.ok(crossing.every(f => Math.abs(f.position[0] - obstruction.p[0]) > obstruction.s[0] / 2 || f.position[1] > obstruction.p[1] + obstruction.s[1] / 2 - .15), 'weave around or ollie above each actual quarry stack');
      }
    }
    previousEnd = chapter.lastFrame;
  }
}

async function main() {
  await withAfterHoursRuntime(async r => {
    const data = r.source.NIGHTWORKS_AFTER_HOURS_LEVEL, stages = r.source.AFTER_HOURS_STAGES;
    const { normalizeCustomLevelData } = await r.server.ssrLoadModule('/src/level.ts');
    assert.ok(normalizeCustomLevelData(structuredClone(data)), 'source course satisfies the shared component contract');
    assert.ok(Array.isArray(stages) && stages.length, 'authored compulsory challenge metadata exists');
    assert.equal(new Set(stages.map(s => s.id)).size, stages.length, 'chapter identities are distinct');
    assert.deepEqual(new Set(stages.map(s => s.kind)), new Set(Object.keys(contactsByKind)), 'mandatory route teaches all authored challenge families');
    const groups = new Map((data.groups ?? []).map(group => [group.id, group]));
    for (const stage of stages) {
      assert.ok(Number.isInteger(stage.grp) && groups.has(stage.grp), 'each chapter resolves to its real component group');
      assert.ok(finitePoint(stage.start) && finitePoint(stage.end), 'chapters have finite approach and exit feet points');
      const types = new Set(ownComponents(stage, data.components).map(c => c.t));
      for (const type of contactsByKind[stage.kind]) assert.ok(types.has(type), `${stage.id}: source includes its real ${type} mechanism`);
    }
    assert.equal(data.components.filter(c => c.t === 'gate').length, 1);
    assert.equal(data.sky, 'night'); assert.ok(r.l.nightworksRocks, 'course retains the floating quarry surfaces');
    assert.ok(data.components.some(c => c.t === 'torch'), 'torch-lit quarry aesthetic remains authored');
    assert.ok(data.killY < Math.min(data.spawn[1], ...stages.map(s => s.start[1])), 'kill plane is below playable geometry');

    const ray = new r.THREE.Raycaster(), down = new r.THREE.Vector3(0, -1, 0);
    const atTime = time => { r.l.time = time; r.l.update(0); r.scene.updateMatrixWorld(true); };
    const floor = (x, z, meshes = r.l.groundMeshes) => {
      ray.set(new r.THREE.Vector3(x, 120, z), down);
      return ray.intersectObjects(meshes, false)[0];
    };
    atTime(0);
    for (const p of [data.spawn, ...stages.flatMap(s => [s.start, s.end, ...(s.checkpoint ? [s.checkpoint] : [])])]) {
      const hit = floor(p[0], p[2], r.l.groundMeshes.filter(mesh => !mesh.userData.finishPad)); assert.ok(hit && Math.abs(hit.point.y - p[1]) < .25, `supported reading/respawn dock at ${p}`);
    }
    const sampleTimes = unique([0, 1.3, 2.6, 3.9, 5.2, 8, 12,
      ...r.l.movers.flatMap(m => [Math.PI / 2, Math.PI * 1.5].map(angle => positivePhaseTime(angle, m.phase, m.speed))),
      ...r.l.movingRails.flatMap(m => [Math.PI / 2, Math.PI * 1.5].map(angle => positivePhaseTime(angle, m.phase, m.speed))),
      ...r.l.phasePads.flatMap(pad => [.001, pad.duty - .001, pad.duty + .001, .999].map(phase => ((phase - pad.phase + 1) % 1) * pad.cycle)),
    ].map(t => Math.round(t * 1e6) / 1e6));
    assert.ok(Array.isArray(r.source.AFTER_HOURS_VOID_CUTS) && r.source.AFTER_HOURS_VOID_CUTS.length, 'authored natural void seams exist');
    for (const cut of r.source.AFTER_HOURS_VOID_CUTS) {
      assert.ok(groups.has(cut.grp) && finitePoint(cut.p) && ['x', 'z'].includes(cut.axis) && cut.halfWidth > 0);
      for (const time of sampleTimes) {
        atTime(time);
        for (let offset = -cut.halfWidth; offset <= cut.halfWidth + 1e-6; offset += .5) {
          const x = cut.p[0] + (cut.axis === 'x' ? offset : 0), z = cut.p[2] + (cut.axis === 'z' ? offset : 0), hit = floor(x, z);
          assert.equal(hit, undefined, `real void across group ${cut.grp} at ${[x, z]}, time ${time}; source ${hit && sourceIndex(hit.object)}`);
        }
      }
    }

    const components = data.components;
    for (const mover of r.l.movers) {
      const index = sourceIndex(mover.mesh), source = components[index];
      assert.ok(['mover', 'rail'].includes(source?.t), 'moving collision proxies resolve to actual moving mechanisms');
      if (source.t !== 'mover') continue;
      assert.ok(source.amp > 0 && source.speed > 0);
      const points = [];
      for (const angle of [Math.PI / 2, Math.PI * 1.5]) {
        atTime(positivePhaseTime(angle, mover.phase, mover.speed)); points.push(mover.mesh.position.clone());
        const hit = floor(mover.mesh.position.x, mover.mesh.position.z);
        assert.equal(hit?.object, mover.mesh, 'the moving visual owns its moving collision top');
      }
      assert.ok(Math.abs(points[0].distanceTo(points[1]) - mover.amp * 2) < 1e-4, 'delivery decks genuinely traverse their authored sweep');
    }
    const freight = stages.find(s => s.kind === 'aim'), freightGaps = r.source.AFTER_HOURS_GAPS.filter(g => g.grp === freight.grp);
    assert.ok(freightGaps.length >= 2 && freightGaps.some(g => g.landing[0] > g.takeoff[0]) && freightGaps.some(g => g.landing[0] < g.takeoff[0]), 'freight launches require opposing lateral aims');
    atTime(0);
    for (const gap of r.source.AFTER_HOURS_GAPS) for (const p of [gap.takeoff, gap.landing]) {
      const hit = floor(p[0], p[2]); assert.ok(hit && Math.abs(hit.point.y - p[1]) < .3, `actual support at taught launch/catch point ${p}`);
    }
    const delivery = ownComponents(stages.find(s => s.kind === 'moving-landings'), components).filter(c => c.t === 'mover');
    assert.ok(new Set(delivery.map(c => c.axis)).has('y') && delivery.filter(c => c.axis === 'x').length >= 2, 'delivery chapter combines opposing lateral catches with an elevation catch');
    const opposing = delivery.filter(c => c.axis === 'x');
    assert.ok(Math.cos(opposing[0].phase - opposing[1].phase) < -.99, 'opposing deliveries cannot be a single aligned road');

    for (const rail of r.l.movingRails) {
      const source = components[sourceIndex(rail.object)]; assert.equal(source?.t, 'rail');
      const samples = [];
      for (const angle of [Math.PI / 2, Math.PI * 1.5]) {
        atTime(positivePhaseTime(angle, rail.phase, rail.speed));
        samples.push({ eye: rail.object.position.clone(), point: rail.rail.pointAt(rail.rail.totalLength / 2).clone() });
      }
      const visibleDelta = samples[0].eye.sub(samples[1].eye), collisionDelta = samples[0].point.sub(samples[1].point);
      assert.ok(visibleDelta.distanceTo(collisionDelta) < 1e-5 && Math.abs(collisionDelta.length() - rail.amp * 2) < 1e-4, 'moving ridge visual and live grind line share the full sweep');
    }
    const ferryRails = ownComponents(stages.find(s => s.kind === 'rail-transfer'), components).filter(c => c.t === 'rail');
    assert.ok(ferryRails.length >= 2 && ferryRails.every(c => Math.abs(c.yaw) === 90 && c.axis === 'z' && c.amp > 0), 'rail chapter is a sideways moving handoff');
    assert.ok(Math.cos(ferryRails[0].phase - ferryRails[1].phase) < -.99, 'handoff ridges move in opposition');

    const phaseChapter = stages.find(s => s.kind === 'phase'), phaseComponents = ownComponents(phaseChapter, components).filter(c => c.t === 'phasepad');
    const rows = unique(phaseComponents.map(c => c.p[2]));
    assert.ok(rows.length > 1, 'phase chapter has a sequence of decisions');
    for (const z of rows) {
      const row = phaseComponents.filter(c => c.p[2] === z);
      assert.ok(row.length >= 2 && Math.cos((row[0].phase - row[1].phase) * Math.PI * 2) < -.99, 'each station provides complementary readable lanes');
    }
    for (const pad of r.l.phasePads) {
      const seen = new Set();
      for (const time of sampleTimes) {
        atTime(time); seen.add(pad.on);
        assert.equal(r.l.groundMeshes.includes(pad.mesh), pad.on, 'ghost phase rocks cannot leave an invisible floor');
      }
      assert.deepEqual(seen, new Set([true, false]), 'every phase deck really switches collision');
    }
    for (const time of sampleTimes) {
      atTime(time);
      for (const z of rows) {
        const pads = r.l.phasePads.filter(p => components[sourceIndex(p.mesh)]?.grp === phaseChapter.grp && Math.abs(p.mesh.position.z - z) < .01);
        assert.ok(pads.some(p => p.on), 'paired phase stations always offer a visible solid choice');
        assert.equal(floor(phaseChapter.start[0], z), undefined, 'the central line between phase teams is genuine void');
      }
    }

    const carve = stages.find(s => s.kind === 'carve'), road = ownComponents(carve, components).find(c => c.t === 'vertramp');
    const knots = road.pts.map(p => [road.p[0] + p[0], road.p[1] + (p[3] ?? 0), road.p[2] + p[1]]);
    const xChanges = knots.slice(1).map((p, i) => p[0] - knots[i][0]);
    assert.ok(xChanges.some(x => x > 0) && xChanges.some(x => x < 0), 'cutbacks reverse their lateral direction');
    assert.ok(ownComponents(carve, components).some(c => c.cameraView && c.yaw === 0), 'the carve road requires rider steering under a stable north view');
    atTime(0);
    for (const p of knots.slice(1, -1)) {
      const view = r.l.cameraDirAt(...p); assert.ok(Math.abs(view.x) < 1e-5 && view.z < -.999, 'cutback camera does not steer the road for the rider');
    }
    const staticGround = r.l.groundMeshes.filter(mesh => !['mover', 'phasepad'].includes(components[sourceIndex(mesh)]?.t));
    assert.ok([.25, .5, .75].some(t => !floor(knots[0][0] + (knots.at(-1)[0] - knots[0][0]) * t, knots[0][2] + (knots.at(-1)[2] - knots[0][2]) * t, staticGround)), 'the cutback chord has no continuous static road');

    const weave = ownComponents(stages.find(s => s.kind === 'weave'), components);
    const stacks = weave.filter(c => c.t === 'platform' && c.nm === 'Workbay quarry obstruction');
    const workbayRoad = weave.find(c => c.t === 'ramp');
    assert.ok(stacks.some(c => c.p[0] < workbayRoad.p[0]) && stacks.some(c => c.p[0] > workbayRoad.p[0]), 'workbay openings alternate across the narrow road');
    assert.ok(weave.some(c => c.t === 'pendulum' && c.amp > 0 && c.speed > 0), 'workbay contains actual swinging counterweights');
    const crown = stages.find(s => s.kind === 'uphill'), ascent = ownComponents(crown, components).filter(c => c.t === 'ramp');
    assert.ok(ascent.length >= 2 && ascent.every(c => c.rise > 0), 'crown has two actual ascents');
    assert.ok(ascent.some(c => c.yaw > 0) && ascent.some(c => c.yaw < 0), 'crown launchbacks aim in opposing lateral directions');
    assert.ok(crown.end[1] > crown.start[1] + ascent[0].rise, 'crown reaches a genuinely higher band');
    for (const gap of r.source.AFTER_HOURS_GAPS.filter(g => g.grp === crown.grp)) assert.ok(gap.landing[1] > gap.takeoff[1], 'crown launches target higher receiving shelves');

    console.log(`PASS After Hours structure: concrete challenge families, supported docks, ${sampleTimes.length} motion phases, natural full-width void seams and live moving/phase collision. Gameplay still requires full production trace and browser review.`);
    if (process.env.AFTER_HOURS_CHALLENGE_TRACE) {
      const report = JSON.parse(await readFile(process.env.AFTER_HOURS_CHALLENGE_TRACE, 'utf8'));
      assertAfterHoursMountedEvidence(report, stages, components);
      console.log('PASS full production trace: complete mounted journey with actual ordered challenge contacts and actions.');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
