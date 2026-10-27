/** Small, distance-based help, shared by human and AI racers. No position-based
 * braking of the leader, no last-place multiplier and no effect in time trials. */
export function rallyChasePace(gap:number):number {
  const t=Math.max(0,Math.min(1,((Number.isFinite(gap)?gap:0)-35)/115));
  return .04*t*t*(3-2*t);
}

/** A healthy kart outruns sustained skating and its ordinary item boost.
 * Steering, grip, gravity and the capped crest launch remain independent. */
export const RALLY_CART_PACE=Object.freeze({topSpeed:46,engine:28,speedLimit:54});
