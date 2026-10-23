import { Box3, Vector3 } from 'three';
import { schoolSourcePoint, SCHOOL_SOURCE_SCALE } from '../src/levels/school-source';

/** Measure the rendered rider and board, excluding hidden helper geometry.
 * The actor's complete bodyGroup contains non-rendered helpers below its feet,
 * so its unfiltered bounding box is not a useful scale reference. */
function visibleBounds(root: any) {
  const box = new Box3(), point = new Vector3();
  let meshes = 0, vertices = 0;
  root.traverseVisible((mesh: any) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some((m: any) => m?.visible !== false && m?.opacity !== 0)) return;
    const used = mesh.geometry.index ? new Set<number>(mesh.geometry.index.array as Iterable<number>) : null;
    for (const index of used ?? Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => i)) {
      mesh.getVertexPosition(index, point); point.applyMatrix4(mesh.matrixWorld); box.expandByPoint(point); vertices++;
    }
    meshes++;
  });
  if (box.isEmpty()) throw Error('No visible skater geometry');
  return { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new Vector3()).toArray(), meshes, vertices };
}

export function runSchoolScaleMeasurement(game: any) {
  const p = game.player, level = game.getLevel(), input = game.input;
  const oldStep = p.step, oldPoll = input.pollGamepad, update = input.update.bind(input);
  const batching = p.characterRenderBatchDiagnostics?.enabled;
  // Supported A/B render switch: source meshes and their batched draws are
  // identical, but the unbatched meshes have unambiguous visible bounds.
  p.setCharacterRenderBatching(false);
  const report: any = { running: true, failure: null, sourceScale: SCHOOL_SOURCE_SCALE, frames: 0, stage: '', poses: [], tuningBefore: JSON.stringify(game.TUNING) };
  const modes = ['idle', 'coast', 'crouch']; let mode = 0, frame = 0, record: any;
  const finish = (failure: string | null) => {
    p.step = oldStep; input.pollGamepad = oldPoll;
    if (batching !== undefined) p.setCharacterRenderBatching(batching);
    report.running = false; report.failure = failure; p.speed = 0;
    report.tuningUnchanged = report.tuningBefore === JSON.stringify(game.TUNING); delete report.tuningBefore;
  };
  const next = () => {
    if (mode === modes.length) { finish(null); return; }
    frame = 0; report.stage = modes[mode]; record = { mode: modes[mode], samples: [] }; report.poses.push(record);
    p.respawn(level, true, true, { position: new Vector3(...schoolSourcePoint(-15000, 1630, 14500)), heading: new Vector3(0, 0, -1) });
    p.axisF.set(0, 0, -1); p.axisL.set(-1, 0, 0); p.freeSkate = true; p.speed = 0;
    p.groundHit = p.queryGround(level); if (!p.groundHit) throw Error('Missing scale-check floor');
    p.pos.y = p.groundHit.y; p.prevPos.copy(p.pos); p.grounded = true; p.rideNormal.copy(p.groundHit.normal);
  };
  input.pollGamepad = () => ({ id: 'School scale measurement', index: 0, connected: true, mapping: 'standard',
    axes: [0, modes[mode] === 'idle' ? 0 : -1, 0, 0],
    buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: i === 0 && modes[mode] === 'crouch', touched: false, value: i === 0 && modes[mode] === 'crouch' ? 1 : 0 })),
  });
  p.step = (dt: number, controls: any, current: any) => {
    try {
      update(); oldStep.call(p, dt, controls, current); frame++; report.frames++;
      if (p.isBailing || !p.grounded) throw Error('Scale sample left supported ground');
      if (frame >= 60 && frame % 6 === 0) {
        p.group.updateMatrixWorld(true);
        const rider = visibleBounds(p.riderG), board = visibleBounds(p.boardG);
        record.samples.push({ frame, rider, board, boardToHead: rider.max[1] - board.min[1], speed: p.speed, state: p.state });
      }
      if (frame === 120) { mode++; next(); }
    } catch (error) { finish(String(error)); }
  };
  try { next(); } catch (error) { finish(String(error)); }
  return report;
}
