// Feedback controls only: no injected speed, attachment or position changes.
export function cargoPilot(bridge, { metal = false } = {}) {
 let started, caught = false, previousJump = false, previousGrind = false;
 return p => {
  started ??= p.time;
  let input = {moveX: 0, moveY: 0, jumpHeld: false, grindHeld: false};
  const x = metal ? bridge.metalX : bridge.woodX;
  if (p.state === 'grind') {
   caught = true;
   const balance = -p.balance * 5 - p.balanceVel * .7;
   input.moveX = Math.abs(balance) > .12 ? Math.sign(balance) : 0;
  } else if (caught) {
   // Native run-off carries its own tangent; wait to touch the receiving dock.
   if (p.grounded) return {done: p.at[2] < bridge.lastZ + .5, caught, input};
  } else {
   const dx = x - p.at[0], dz = bridge.lastZ - p.at[2];
   const side = dx * p.side[0] + dz * p.side[2];
   input.moveX = Math.abs(dx) > .22 ? Math.sign(side) : 0;
   input.moveY = p.time - started < .3 ? 0 : 1;
   input.jumpHeld = p.time - started < .3;
   input.grindHeld = p.time - started >= .3;
  }
  input.jumpPressed = input.jumpHeld && !previousJump;
  input.jumpReleased = !input.jumpHeld && previousJump;
  input.grindPressed = input.grindHeld && !previousGrind;
  previousJump = input.jumpHeld; previousGrind = input.grindHeld;
  return {input, caught};
 };
}
export const cargoObservation = (p, level) => ({at:p.pos.toArray(),time:p.runTime,state:p.state,grounded:p.grounded,
 side:p.axisL.toArray(),balance:p.balance,balanceVel:p.balanceVel,crateRail:!!p.grindRail&&level.isCrateRail(p.grindRail),
 bail:p.isBailing,deaths:p.totalDeaths,vy:p.vVel});
