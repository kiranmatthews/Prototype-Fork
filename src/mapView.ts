import * as THREE from 'three';
import type { CampaignMapDirection } from './campaign';

/** The camera sits offshore and faces the island, following the coastal route. */
export function islandViewAngle(position: THREE.Vector3, centre: THREE.Vector3): number {
  return Math.atan2(position.x-centre.x,position.z-centre.z);
}
export function lerpOrbitAngle(from: number, to: number, t: number): number {
  return from + Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;
}
/** Unique screen-facing slots, stable at the stop while the camera settles. */
export function mapViewDirections(angle:number, exits: {key:string;delta:THREE.Vector3}[]): Partial<Record<CampaignMapDirection,string>> {
  const right=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
  const away=new THREE.Vector3(-Math.sin(angle),0,-Math.cos(angle));
  const axes={left:[-1,0],right:[1,0],up:[0,1],down:[0,-1]} as const;
  const choices=Object.keys(axes) as CampaignMapDirection[];
  const headings=exits.map(exit=>new THREE.Vector2(exit.delta.dot(right),exit.delta.dot(away)*.7+exit.delta.y*.7).normalize());
  let best=-Infinity,result:Partial<Record<CampaignMapDirection,string>>={};
  const assign=(i:number,used:CampaignMapDirection[],score:number)=>{
    if(i===exits.length){if(score>best){best=score;result=Object.fromEntries(used.map((d,j)=>[d,exits[j].key]));}return;}
    for(const d of choices)if(!used.includes(d))assign(i+1,[...used,d],score+headings[i].dot(new THREE.Vector2(...axes[d])));
  };
  assign(0,[],0);return result;
}
