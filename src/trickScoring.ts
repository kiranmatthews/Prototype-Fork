/** THUG's five-step repetition curve; counts include this combo and earlier
 * landed combos in the run. World rewards never enter the trick history. */
export const TRICK_REPEAT_FACTORS = [1,.75,.5,.25,.1] as const;
export function trickRepeatFactor(uses:number):number {
  return TRICK_REPEAT_FACTORS[Math.min(TRICK_REPEAT_FACTORS.length-1,Math.max(0,Math.floor(uses)))];
}
export interface HeldTrickScore {
  raw:number;
  paid:number;
  factor:number;
  power:number;
  seconds:number;
}
/** Long holds continue earning, with a gradual rate reduction after 2s.
 * This prototype balance choice favors moving between tricks over camping. */
export function extendHeldTrick(score:HeldTrickScore,pointsPerSecond:number,seconds:number):number {
  const start=score.seconds,end=start+Math.max(0,seconds);
  const integrated=(time:number)=>time<=2?time:2+6*Math.log1p((time-2)/6);
  score.seconds=end;
  score.raw+=Math.max(0,pointsPerSecond)*(integrated(end)-integrated(start));
  const next=Math.round(score.raw*score.factor)*score.power,delta=next-score.paid;
  score.paid=next;
  return delta;
}
