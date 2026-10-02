// Shared Node/browser input pilot. Never sets actor position, velocity,
// health, phase, charge, state, invulnerability or tuning.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function* runChiefJourney(context) {
  const { p, l } = context, boss = l.boss;
  let railApproach = false, lastJump = -100, frame = 0, lastHealth = 9;
  const toward = (x, z, pace = 1) => {
    const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < .5) return { moveX: 0, moveY: 0 };
    const scale = Math.min(pace, Math.max(.15, d / 5));
    return { moveX: dx / d * scale, moveY: -dz / d * scale };
  };
  const distance = (x, z) => Math.hypot(p.pos.x - x, p.pos.z - z);
  const jumpNeeded = () => {
    for (const wave of boss.diagnostics.activeWaves) {
      const ahead = Math.hypot(p.pos.x - wave.centre[0], p.pos.z - wave.centre[2]) - wave.radius;
      if (ahead > -.5 && ahead < 3.2 && p.pos.y < 1.4) return true;
    }
    if (boss.state === 'sweep') {
      const a = Math.atan2(p.pos.x, p.pos.z + 28), sweep = -1.3 + boss.stateTime / 1.8 * 2.6;
      return distance(0, -28) > 6 && distance(0, -28) < 21 && a - sweep > -.05 && a - sweep < .38 && p.pos.y < 1.6;
    }
    return false;
  };
  while (frame++ < 14000) {
    if (p.totalDeaths || p.isBailing || ['dead', 'gameover'].includes(p.state))
      throw new Error(`Pilot failed at ${frame}: ${JSON.stringify({ position: p.pos.toArray(), state: p.state, boss: boss.diagnostics })}`);
    if (p.state === 'finished') return { frame, hits: boss.hits, playerHits: boss.playerHits, grindDistance: boss.grindDistance,
      phases: boss.strikes.map(row => row.phase), strikes: boss.strikes, position: p.pos.toArray() };
    let input = {};
    if (boss.health !== lastHealth) { railApproach = false; lastHealth = boss.health; }
    if (boss.defeated) {
      context.stage = 'victory causeway';
      if (p.pos.z > -33 && p.pos.x < 9) input = toward(11, -25);
      else if (p.pos.z > -33) input = toward(11, -34);
      else if (Math.abs(p.pos.x) > 1.2) input = toward(0, -34, .6);
      else input = toward(0, -49, .6);
    } else if (boss.phase === 1) {
      context.stage = `phase 1 · ${boss.state}`;
      if (boss.state === 'waiting' || boss.state === 'intro') {
        input = toward(0, -17.7);
        if (!l.activeCheckpoint && p.pos.z < 8) input.spinPressed = frame % 24 === 0;
      } else if (boss.state === 'slam-tell' || boss.state === 'slam') {
        const side = boss.target.x >= 0 ? -1 : 1;
        input = toward(side * 5.3, -17.5);
      } else if (boss.exposed) {
        input = toward(boss.pearl.x, boss.pearl.z);
        if (distance(boss.pearl.x, boss.pearl.z) < 2.5) input.spinPressed = frame % 20 === 0;
      } else input = toward(0, -17.7, .5);
    } else {
      context.stage = `phase ${boss.phase} · ${boss.charged ? 'opening approach' : 'pearl rail'}`;
      if (p.state === 'grind') {
        input = { moveY: 1, moveX: clamp(-p.balance * 1.9, -.75, .75), grindHeld: true };
      } else if (!boss.charged) {
        if (!railApproach) {
          input = toward(10.8, 4.5);
          if (distance(10.8, 4.5) < 1) railApproach = true;
        } else input = { ...toward(14, -10), grindHeld: true };
      } else {
        input = boss.exposed ? toward(boss.pearl.x, boss.pearl.z, .85) : toward(0,-17.7,.6);
        if (boss.exposed && distance(boss.pearl.x, boss.pearl.z) < 2.5) input.spinPressed = frame % 20 === 0;
      }
    }
    if (p.state !== 'grind' && !boss.defeated && jumpNeeded() && frame - lastJump > 28) {
      input.jumpHeld = true; input.jumpPressed = true; lastJump = frame;
    }
    yield input;
  }
  throw new Error(`Chief pilot timed out: ${JSON.stringify({ position: p.pos.toArray(), state: p.state, boss: boss.diagnostics })}`);
}
