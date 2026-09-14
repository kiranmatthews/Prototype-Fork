import type { GrabTrickKind } from './skateTricks';

/** Rider-local authoring: +Z toes, +Y up; side values mirror with stance.
 * Separate pelvis/torso and deck frames are essential to the named tweaks. */
export const SKATE_GRAB_TWEAKS = {
  melon: {boardPitch:.10,boardRoll:-.18,boardYaw:0,boardForward:.18,boardLift:.38,
    hipForward:-.40,hipUp:.58,bodyPitch:0,bodyBank:.10,waistPitch:.50,waistTwist:0,waistBank:.35,spinePitch:0,
    kneeForward:.85,kneeDown:.15,kneeSide:0,upperLeg:1,lowerLeg:1,upperArm:1.35,lowerArm:1.40},
  method: {boardPitch:-.18,boardRoll:-1.18,boardYaw:.12,boardForward:-.55,boardLift:.88,
    hipForward:.65,hipUp:-.18,bodyPitch:.15,bodyBank:-.60,waistPitch:-.15,waistTwist:0,waistBank:.10,spinePitch:-.18,
    kneeForward:.45,kneeDown:.85,kneeSide:0,upperLeg:1.15,lowerLeg:1.45,upperArm:1.45,lowerArm:1.45},
  stalefish: {boardPitch:-.30,boardRoll:-.35,boardYaw:-.12,boardForward:.05,boardLift:.38,
    hipForward:-.48,hipUp:.62,bodyPitch:0,bodyBank:-.24,waistPitch:.50,waistTwist:.60,waistBank:-.35,spinePitch:0,
    kneeForward:.75,kneeDown:.20,kneeSide:0,upperLeg:1.04,lowerLeg:1.05,upperArm:1.60,lowerArm:1.65},
  japan: {boardPitch:-.35,boardRoll:-1.38,boardYaw:-.18,boardForward:-.50,boardLift:.78,
    hipForward:.55,hipUp:-.05,bodyPitch:0,bodyBank:.28,waistPitch:.32,waistTwist:-.30,waistBank:.10,spinePitch:.10,
    kneeForward:.65,kneeDown:.85,kneeSide:.35,upperLeg:1.12,lowerLeg:1.45,upperArm:1.45,lowerArm:1.50},
} as const;
export type SkateGrabTweakKind = keyof typeof SKATE_GRAB_TWEAKS;
export function skateGrabTweak(kind:GrabTrickKind) {
  return kind in SKATE_GRAB_TWEAKS?SKATE_GRAB_TWEAKS[kind as SkateGrabTweakKind]:null;
}
