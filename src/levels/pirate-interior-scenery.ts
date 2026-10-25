import type { CustomComponent } from '../level';

/** Deliberately quiet greybox hull. The opening's wooden boardwalk is the
 * only detailed kit inside the blockout; silhouettes and negative space lead. */
export const PIRATE_INTERIOR_SCENERY: CustomComponent[] = [];
const C = PIRATE_INTERIOR_SCENERY;
const wall = (nm: string, p: [number,number,number], s: [number,number,number], color = '#4d5d69') =>
  C.push({t:'wall',p,s,tex:'solid',color,grp:5,nm:'Wreck blockout · '+nm});

// A cutaway hull, open overhead for a clear view of every landing. Close
// background ribs suggest cargo bays without putting false floors under gaps.
for (const side of [-1,1]) {
  wall('low hull side',[side*23,-5,-355.5],[3,10,509]);
  for (let i=0;i<14;i++) {
    const z=-126-i*36,top=20+Math.min(i,8)*.8;
    wall('bulkhead rib',[side*(i===4?24:21),-5,z],[1.1,top+5,2.2],'#627583');
    wall('recessed cargo silhouette',[side*27,-5,z-8],[6,13+(i%3)*3,13],'#3d4b56');
  }
}
// Cargo cranes flank (never cover) the ferries. Their thin beams establish
// the motion axes, and leave more than a full charged jump above the decks.
for (const z of [-244.5,-265,-454,-548.5]) {
  const top=z<-400?33:24;
  for (const x of [-11,11]) wall('cargo crane upright',[x,-5,z],[1,top+6,1],'#71818b');
  wall('cargo crane crossbeam',[0,top,z],[23,1,1],'#71818b');
}
// Small grey cargo stacks ground the arrival and the resting islands.
for (const [x,y,z] of [[-4.3,8,-115],[5.5,8,-118],[-4,9.9,-175],
  [4.8,10.5,-231],[-4.8,11.8,-278],[4.1,13.4,-316],[4.6,16,-361],
  [-4.2,18.4,-417],[4.1,20.4,-467],[-4,19.4,-516],[4,17.2,-561]]) {
  wall('stowed cargo',[x,y,z],[1.25,1.7,1.5],'#88939a');
}
// Broadside scenery sits behind the single shallow playable lane. It stops
// short of the existing detailed escape bridge, translated as one intact set.
wall('broadside rear hull',[70,-5,-630],[146,32,2]);
for(const x of [10,38,66,94,122]){
  wall('broadside rib',[x,-5,-628],[1.1,35,1.3],'#627583');
  wall('broadside recessed freight',[x+7,-5,-633],[8,17,5],'#3d4b56');
}
wall('broadside hoist beam',[58,32,-618],[1,1,22],'#71818b');
wall('broadside hoist mast',[58,-5,-627],[1.2,38,1.2],'#71818b');
