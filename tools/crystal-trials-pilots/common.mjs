import { puzzleControls } from '../puzzle-controls.mjs';

/** Only ordinary controller samples; no position, state, or tuning changes. */
export function trialControls(r, id) {
  const base = puzzleControls(r), { p, l } = r, offset = r.offset ?? [0, 0, 0];
  const at = q => typeof q === 'function' ? () => at(q()) : q.map((v, i) => v + offset[i]);
  const h = { ...base, walk: (q, ...args) => base.walk(at(q), ...args), steer: (q, ...args) => base.steer(at(q), ...args) };
  const { walk, tick, stepFor, check } = h;
  const goal = l.skateCollectathon.tokens.find(t => Number(t.name.split('/')[0]) === id);
  const balance = () => ({ moveY: 1, grindHeld: true, moveX: Math.max(-1, Math.min(1, -p.balance * 5 - p.balanceVel * .7)) });
  function* start() {
    check(goal, 'Trial crystal missing');yield* stepFor(12);
    yield* walk([-2.8, 0, 5], `Bank challenge ${id} checkpoint`);
    yield* tick({ spinHeld: true });yield* stepFor(25);
  }
  function* lowerReturn(z) {
    yield* walk([15, -8, z], 'Join the flat return outside the hazard');
    yield* walk([15, -8, -21], 'Approach the return ramp');
    yield* walk([15, 0, 5], 'Climb the return ramp');
    yield* walk([15, 0, 9], 'Turn onto the approach');
    yield* walk([0, 0, 9], 'Complete the local circuit');
  }
  function finish() {
    check(goal.collected, 'The real crystal was not collected');
    check(l.checkpoints.some(c => c.active && Math.hypot(c.spawnPos.x - (offset[0] - 4), c.spawnPos.z - (offset[2] + 5)) < 2), 'Checkpoint did not bank');
    check(p.totalDeaths === (r.report.expectedDeaths ?? 0), 'Unexpected death');
    return { id, collected: l.skateCollectathon.collected, position: p.pos.toArray(), frames: r.frame };
  }
  return { ...h, p, l, offset, h, goal, balance, lowerReturn, start, finish };
}
