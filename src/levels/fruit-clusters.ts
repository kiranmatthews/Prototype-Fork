import type { CustomComponent } from '../level';

type Point = [number,number,number];
/** Open handful, with enough air between crowns to read individual rewards.
 * Each member remains one ordinary wumpa: editor capture, magnet, checkpoints,
 * trial hiding and scoring all use the existing pickup lifecycle. */
export const LOOSE_FRUIT_OFFSETS: readonly Point[] = [
  [-.82,1.05,.22],[0,1.16,.08],[.86,1.04,-.12],
  [-.49,1.19,-.72],[.48,1.29,-.94],[.02,1.06,-1.62],
];
export function looseFruitCluster(
  ground: (side:number,forward:number)=>Point,
  name: string,
  grp: number,
): CustomComponent[] {
  return LOOSE_FRUIT_OFFSETS.map(([side,lift,forward],i)=>{
    const p=ground(side,forward);
    return {t:'wumpa',p:[p[0],p[1]+lift,p[2]],grp,nm:`Loose fruit / ${name} / ${i+1}`};
  });
}

/** Flat, generous stretches outside the authored jumps and enemy encounters. */
export const JUNGLE_FRUIT_CLEARINGS = [2,-57,-273,-585] as const;
export function jungleFruitClusters(x:(z:number)=>number,y:(z:number)=>number):CustomComponent[] {
  return JUNGLE_FRUIT_CLEARINGS.flatMap((z,i)=>looseFruitCluster(
    (side,forward)=>[x(z+forward)+side,y(z+forward),z+forward],
    ['Arrival clearing','Undergrowth rest','Ravine bank','Homeward clearing'][i],291));
}
