/** A readable landing, then an accelerating upward warp. Presentation only. */
export const BONUS_LANDING_HOLD = 0.65;
export const BONUS_WARP_RISE = 0.5;
export const BONUS_ALIGNMENT_START=.10;
export const BONUS_ALIGNMENT_DURATION=.36;

/** A short automatic hop followed by a planted settle within the landing beat. */
export function bonusAlignmentPose(elapsed:number,distance:number,heightDifference:number,reducedMotion=false){
  const needed=distance>.22||Math.abs(heightDifference)>.08;
  const phase=Math.max(0,Math.min(1,(elapsed-BONUS_ALIGNMENT_START)/BONUS_ALIGNMENT_DURATION));
  const height=needed&&!reducedMotion?Math.min(.82,.24+distance*.14+Math.max(0,heightDifference)*.7):0;
  const progress=needed?phase*phase*(3-2*phase):Math.max(0,Math.min(1,elapsed/.3));
  const airborne=height>0&&phase>0&&phase<1;
  return {needed,phase,progress,airborne,
    offsetY:height*Math.sin(Math.PI*phase),
    verticalVelocity:airborne?height*Math.PI/BONUS_ALIGNMENT_DURATION*Math.cos(Math.PI*phase):0,
    launchVelocity:height*Math.PI/BONUS_ALIGNMENT_DURATION,
    airborneSeconds:phase*BONUS_ALIGNMENT_DURATION};
}
export type BonusAlignmentPose=ReturnType<typeof bonusAlignmentPose>;

export function bonusDeparturePose(elapsed: number, reducedMotion = false) {
  const rise = Math.max(0, Math.min(1, (elapsed - BONUS_LANDING_HOLD) / BONUS_WARP_RISE));
  return {
    phase: elapsed < BONUS_LANDING_HOLD ? 'landing' : 'rising',
    offsetY: reducedMotion ? 0 : 7 * rise * rise * rise,
    complete: elapsed >= BONUS_LANDING_HOLD + (reducedMotion ? 0 : BONUS_WARP_RISE),
  };
}
