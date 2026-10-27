/** Small, distance-based help, shared by human and AI racers. No position-based
 * braking of the leader, no last-place multiplier and no effect in time trials. */
export function rallyChasePace(gap:number):number {
  const t=Math.max(0,Math.min(1,((Number.isFinite(gap)?gap:0)-35)/115));
  return .04*t*t*(3-2*t);
}
