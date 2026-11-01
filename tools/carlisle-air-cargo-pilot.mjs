// Input-only test driver: fly to a visible lid, wait for its native stomp,
// then steer toward the next lid. It never changes player state or physics.
export function airCargoPilot(encounter, target, { avoid = false, sideDeadzone = .3, held = true } = {}) {
  let launched = false, next = 0, previousVy = 0, warmup = 0, wasHeld = false;
  return observation => {
    const p = observation.at;
    if (observation.spring && observation.vy > 15) launched = true;
    const landing = encounter.landings[next];
    if (launched && landing && previousVy < 0 && observation.vy > 0 &&
      Math.hypot(p[0] - landing.center[0], p[2] - landing.center[2]) < 2.2 && Math.abs(p[1] - landing.top) < 1.1) next++;
    previousVy = observation.vy;
    const aim = !avoid && encounter.landings[next] ? encounter.landings[next].center : target;
    const dx = aim[0] - p[0], dz = aim[2] - p[2];
    const f = dx * observation.forward[0] + dz * observation.forward[2];
    const s = dx * observation.side[0] + dz * observation.side[2];
    const atFinish = avoid || next === encounter.landings.length;
    const down = launched ? held : warmup < 6 || warmup > 6 && held && observation.vy < 0;
    const jumpPressed = down && !wasHeld, jumpReleased = !down && wasHeld;
    wasHeld = down; warmup++;
    return { moveY: launched && Math.abs(f) > (atFinish ? 1.2 : .25) ? Math.sign(f) : 0,
      moveX: launched && Math.abs(s) > (atFinish ? 1.2 : sideDeadzone) ? Math.sign(s) : 0,
      jumpHeld: down, jumpPressed, jumpReleased };
  };
}

export const airCargoObservation = player => ({
  at: player.pos.toArray(), forward: player.axisF.toArray(), side: player.axisL.toArray(),
  spring: player.trampolineAir, vy: player.vVel,
});
