import type { CustomComponent, CustomLevelData } from '../level';

type Point = [number, number, number];

// The shipped lane followed individual checkpoints and side-to-side walks
// across the hull. Keep the exact fingerprint for existing editor snapshots.
export const LEGACY_DROWNED_CAMERA: readonly Point[] = [
 [-72,-6,210],[-71.5,-6,193],[-69.2,-6,181],[-58,-6,165],[-59.4,-6,144],[-57,-6,139],[-59,-6,127],[-43,-5.5,112],[-43,-5.5,91],[-48,-3,74],[-48,-1.4,60],[-48,0,48],
 [-48,0,20],[-34,-3,-8],[-36,-6,-38],[-48,-6,-58],[-48,-6,-75],[-20,-6,-75],
 [0,8,-106],[0,8,-124],[-8,8,-134],[-8,-4,-162],[-8,-4,-181],[0,-4,-192],[8,-4,-204],[8,8,-237],[0,8,-246],[30,10,-269],[32,10,-288],[32,10,-320],
];

/** One ordered course lane. Ship decks share their longitudinal heading;
 * walking around a mast or toward a checkpoint must not turn the controls. */
export const DROWNED_CAMERA: readonly Point[] = [
 ...LEGACY_DROWNED_CAMERA.slice(0,18),
 [0,8,-106],[0,8,-124],[0,8,-134],[0,-4,-162],[0,-4,-181],[0,-4,-192],
 [0,-4,-204],[0,8,-237],[0,8,-246],[30,10,-269],[32,10,-288],[32,10,-320],
];

const samePoint = (a: readonly number[] | undefined, b: readonly number[]) =>
 !!a && a.length === b.length && a.every((value, i) => Math.abs(value-b[i]) < 1e-6);
const LEGACY_VIEWS = [
 {p:[0,18,-100],s:[20,16,19],yaw:180,cameraPosition:[3,18,-114],cameraTarget:[0,15.5,-97]},
 {p:[-58,-3,-46],s:[17,13,23],yaw:0,cameraPosition:[-58,0,-38.5],cameraTarget:[-58,-2,-47]},
 {p:[32,14,-307],s:[26,14,49],yaw:0,cameraPosition:[32,16,-270],cameraTarget:[32,17,-295]},
];

/** Upgrade only the exact shipped path. Preserve hand-authored paths, geometry,
 * groups, locks and unrelated edits; reopening an upgraded file is a no-op. */
export function migrateDrownedCamera(data: CustomLevelData): void {
 const nodes=data.components.filter(c=>c.t==='camnode'&&!c.cameraView);
 if(nodes.length!==LEGACY_DROWNED_CAMERA.length || nodes.some((c,i)=>
  !samePoint(c.p,LEGACY_DROWNED_CAMERA[i]) || (c.radius??0)!==5))return;
 const replacement:CustomComponent[]=DROWNED_CAMERA.map((p,i)=>({...nodes[i],p:[...p],radius:5}));
 // In the original file every node, including the distant ship nodes,
 // belonged to the tunnel folder. Moving that room moved the entire lane.
 // Repair this shipped organization, but retain custom camera grouping.
 if(nodes.every(c=>c.grp===1&&c.nm==='Authored treasure trail camera')&&
  data.groups?.some(g=>g.id===1&&g.nm==='Smugglers tunnels'&&g.editorOnly)){
  const existing=data.groups.find(g=>g.nm==='Camera · movement spine'&&g.editorOnly);
  const id=existing?.id??Math.max(0,...data.groups.map(g=>g.id))+1;
  if(!existing)data.groups.push({id,nm:'Camera · movement spine',editorOnly:true});
  replacement.forEach(c=>c.grp=id);
 }
 let inserted=false;
 data.components=data.components.flatMap(c=>{
  if(c.t==='camnode'&&!c.cameraView){if(inserted)return [];inserted=true;return replacement;}
  if(c.t==='camnode'&&c.cameraView&&c.cameraPresentationOnly===undefined&&LEGACY_VIEWS.some(v=>
   samePoint(c.p,v.p)&&samePoint(c.s,v.s)&&(c.yaw??0)===v.yaw&&
   samePoint(c.cameraPosition,v.cameraPosition)&&samePoint(c.cameraTarget,v.cameraTarget)))
   return [{...c,cameraPresentationOnly:true}];
  return [c];
 });
}
