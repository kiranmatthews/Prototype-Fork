import type { CustomComponent } from "../level";
import { jungleCoveWidth } from "./jungle-shore";

export const JUNGLE_BOUNDARY_BOTTOM = -18;
export const JUNGLE_BOUNDARY_TOP = 64;
export const JUNGLE_BOUNDARY_THICKNESS = 2.4;
export const JUNGLE_BOUNDARY_CLEARANCE = 0.35;

// Width changes are explicit corners; only the two open cuts taper.
export const JUNGLE_BOUNDARY_SECTIONS = [
  [15.55, -34, 7, 7], [-34, -39.5, 7, 6], [-39.5, -300, 6, 6],
  [-300, -444, 8, 8], [-444, -486, 7, 7], [-486, -492.5, 7, 6],
  [-492.5, -676, 6, 6], [-676, -716.05, 7, 7],
] as const;

export function junglePathHalfWidth(z: number): number {
  for (const [near, far, start, end] of JUNGLE_BOUNDARY_SECTIONS) {
    if (z <= near && z > far) return start + (end-start)*(near-z)/(near-far);
  }
  return 7;
}

/** One closed, editor-owned perimeter with joined sides, width steps and end caps. */
export function jungleContainment(gx: (z: number) => number, group: number): CustomComponent {
  const left: [number,number,number][] = [], right: [number,number,number][] = [];
  for (const [near, far, start, end] of JUNGLE_BOUNDARY_SECTIONS) {
    const count=Math.max(1,Math.ceil((near-far)/4));
    for(let i=0;i<=count;i++) {
      const t=i/count,z=near+(far-near)*t;
      const half=start+(end-start)*t+JUNGLE_BOUNDARY_CLEARANCE+JUNGLE_BOUNDARY_THICKNESS/2;
      left.push([gx(z)-half,z,0]);right.push([gx(z)+half,z,0]);
    }
  }
  const cove: [number,number,number][] = [];
  for (const z of [25,42,62,96]) cove.push([gx(14)+jungleCoveWidth(z)+1.55,z,0]);
  for (const z of [96,62,42,25]) cove.push([gx(14)-jungleCoveWidth(z)-1.55,z,0]);
  return {t:"wallpath",p:[0,JUNGLE_BOUNDARY_BOTTOM,0],pts:[...left,...right.reverse(),...cove],
    w:JUNGLE_BOUNDARY_THICKNESS,rise:JUNGLE_BOUNDARY_TOP-JUNGLE_BOUNDARY_BOTTOM,
    collisionHeight:JUNGLE_BOUNDARY_TOP-JUNGLE_BOUNDARY_BOTTOM,closed:true,curve:"corner",
    invisible:true,containment:true,edgeGrinding:false,tex:"solid",grp:group,nm:"Jungle perimeter"};
}
