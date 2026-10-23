// Four deliberate ollies, from a supported upper-deck start through the
// display and car jump, then off the fountain's rear ledge onto its ramp.
// Only controller samples follow the initial fixture placement.
export const mallFountainRoutes = [-9465, -9450, -9440].map(release => ({
  name: `Fountain route, car release ${release}`,
  start: [-11900, 717, 370], releases: [-11175, -10650, release, -8390],
}));

export function createMallFountainPilot(fixture) {
  let releaseIndex = 0, cooldown = 0;
  const e = {name: fixture.name, releases: fixture.releases, frames: 0, bail: false,
    maxSpeed: 0, groundedRollout: 0, fountainFrames: 0, jumps: [], trace: [], done: false, reached: false};
  return {e, sample(p, source) {
    let held = true;
    if (cooldown > 0) { held = false; cooldown--; }
    else if (releaseIndex < fixture.releases.length && source[0] > fixture.releases[releaseIndex]) {
      held = false; cooldown = 2; releaseIndex++;
      e.jumps.push({frame: e.frames, source, state: p.state, charge: p.chargeTimer});
    }
    return {moveY: 1, jumpHeld: held};
  }, observe(p, source) {
    e.frames++; e.maxSpeed = Math.max(e.maxSpeed, p.speed); e.bail ||= p.isBailing;
    if (source[0] > -8950 && source[0] < -8300 && source[1] > 550 && source[1] < 800) e.fountainFrames++;
    if (source[0] > -6650 && p.grounded && p.state === 'ride') e.groundedRollout++;
    else e.groundedRollout = 0;
    if (e.frames % 3 === 0 || e.bail) e.trace.push({frame: e.frames, source, speed: p.speed, vVel: p.vVel,
      state: p.state, ground: p.groundHit?.name});
    e.reached = e.groundedRollout >= 30;
    if (e.bail || ['dead', 'gameover'].includes(p.state) || e.reached || e.frames >= 1600) {
      e.end = source; e.state = p.state; e.done = true;
    }
  }};
}
