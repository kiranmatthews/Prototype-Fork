export function airCargoPilot(encounter, target, { avoid = false, sideDeadzone = .3 } = {}) {
  let launched = false, passed = false, frame = 0;
  const offset = avoid
    ? encounter.nitro ? encounter.rewardSide === 0 ? 1.8 : encounter.rewardSide + Math.sign(encounter.rewardSide) * 3 : -Math.sign(encounter.rewardSide) * 3.5
    : encounter.rewardSide;
  const side = encounter.side;
  const waypoint = encounter.reward.map((v, i) => v + side[i] * (offset - encounter.rewardSide));
  return observation => {
    const p = observation.at;
    if (observation.spring && observation.vy > 15) launched = true;
    const distance = Math.hypot(waypoint[0] - p[0], waypoint[2] - p[2]);
    if (launched && distance < 1.05) passed = true;
    const aim = passed ? target : waypoint;
    const dx = aim[0] - p[0], dz = aim[2] - p[2];
    const f = dx * observation.forward[0] + dz * observation.forward[2];
    const s = dx * observation.side[0] + dz * observation.side[2];
    const spin = !avoid && launched && distance < 2.8;
    return { moveY: launched && Math.abs(f) > (passed ? 1.5 : .3) ? Math.sign(f) : 0,
      moveX: launched && Math.abs(s) > (passed ? 1.5 : sideDeadzone) ? Math.sign(s) : 0,
      jumpHeld: true, spinHeld: spin, spinPressed: spin && frame++ % 24 === 0 };
  };
}

export const airCargoObservation = player => ({
  at: player.pos.toArray(), forward: player.axisF.toArray(), side: player.axisL.toArray(),
  spring: player.trampolineAir, vy: player.vVel,
});
