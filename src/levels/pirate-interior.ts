import type { CustomComponent } from '../level';
import { pirateUniformBoardwalkModule } from './pirate-boardwalk-modules';
import type { P } from './pirate-meshes';

/** Merchant wreck blockout. All points are local to the covered boarding set.
 * Broad landing -> readable threat -> takeoff, then a different silhouette.
 * Gaps are measured edge-to-edge, never from platform centres. */
const C: CustomComponent[] = [];
const add = (c: CustomComponent) => C.push(c);
const grey = '#afb9c0', rest = '#d0d5d6', raised = '#8b9ca9';
function block(nm: string, p: P, w: number, d: number, h = 2.4, color = grey,
  pts?: CustomComponent['pts']) {
  add({ t: 'platform', p: [p[0], p[1] - h / 2, p[2]], s: [w, h, d],
    ...(pts ? { pts } : {}), tex: 'checker', color, grp: 4, nm: 'Wreck challenge · ' + nm });
}
function chamfer(w: number, d: number, cut = .7): CustomComponent['pts'] {
  return [[-w/2+cut,d/2],[w/2-cut,d/2],[w/2,d/2-cut],[w/2,-d/2+cut],
    [w/2-cut,-d/2],[-w/2+cut,-d/2],[-w/2,-d/2+cut],[-w/2,d/2-cut]];
}
function fruit(a: P, b: P, count = 4, arc = 0) {
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    add({ t: 'wumpa', p: [a[0]+(b[0]-a[0])*t,
      a[1]+(b[1]-a[1])*t+.9+Math.sin(t*Math.PI)*arc, a[2]+(b[2]-a[2])*t], grp: 4 });
  }
}
function enemy(nm: string, p: P, foe: NonNullable<CustomComponent['foe']>, range: number, speed: number) {
  add({ t: 'enemy', p, foe, range, speed, grp: 5, nm: 'Wreck encounter · ' + nm });
}
function checkpoint(p: P, nm: string) {
  add({ t: 'checkpoint', p, grp: 4, nm: 'Wreck refuge · ' + nm });
}
function crate(p: P, kind: CustomComponent['kind'] = 'wood') {
  add({ t: 'crate', p, kind, grp: 4, nm: 'Wreck cargo reward' });
}
function boardwalk(nm: string, p: P, yaw = 0) {
  C.push(...pirateUniformBoardwalkModule('Wreck boardwalk · ' + nm, p, 1.1, yaw)
    .map(c => ({ ...c, grp: 4 })));
}

// 1. A safe arrival presents the whole zigzag. The three cargo islands grow
// taller, alternate their landing side, and separate each enemy from touchdown.
block('boarding room', [0,8,-122], 12,28,3,rest, chamfer(12,28,1.2));
checkpoint([4,8,-129], '01 · boarding room');
block('port clipped cargo', [-3,8.7,-142], 5.8,6,3,grey,chamfer(5.8,6));
block('starboard combat pallet', [2,9.3,-152.5], 6.8,8,3.6,grey,chamfer(6.8,8,.9));
block('port turtle elbow', [-2.5,9.9,-164], 6,7,4.2,grey,
  [[-3,3.5],[3,3.5],[3,-.4],[1.3,-.4],[1.3,-3.5],[-3,-3.5]]);
enemy('crab beyond the first landing', [2.3,9.3,-154.7], 'grunt', 1.45,1.15);
enemy('turtle guards the right of the elbow', [-.6,9.9,-163.6], 'turtle', .45,.65);
block('first lookout', [0,9.9,-176.5], 10,10,3.5,rest,chamfer(10,10,1));
checkpoint([2.8,9.9,-177], '02 · broken gangways');
fruit([2,8,-132],[-3,8.7,-141],5,1.2);
fruit([-2.6,8.7,-144],[.2,9.3,-150],4,1);
fruit([.4,9.3,-156],[-3.8,9.9,-162],4,1);
fruit([-3.8,9.9,-166.3],[-1.8,9.9,-173],4,1);
crate([-3.5,9.9,-178], 'mystery');

// 2. Complete opening-boardwalk models, uniformly scaled. Small lateral
// offsets expose the next landing; their unequal gap widths create a rhythm.
boardwalk('near jetty', [0,9.9,-187.5]);
boardwalk('offset middle jetty', [-1.3,10.5,-203.1],180);
boardwalk('far jetty', [1.3,10.5,-218.8]);
enemy('single crab on the far gangway', [1.3,10.5,-221.4], 'grunt', .55,.85);
fruit([0,9.9,-185],[0,9.9,-192],4);
fruit([-.3,9.9,-193],[-1.3,10.5,-198.8],4,1.2);
fruit([-1.3,10.5,-207.3],[1.3,10.5,-214.3],4,1.2);
block('crane observation dock', [1,10.5,-233], 10,10,3.6,rest,chamfer(10,10,1));
checkpoint([3.7,10.5,-233], '03 · swinging freight');
fruit([1.3,10.5,-223],[.5,10.5,-230],4,1);
crate([-2.5,10.5,-234], 'mask');

// 3. Two different ferries: first align sideways; then follow longitudinal
// motion. Fixed islands on either side let the player stop and read the cycle.
add({t:'mover',p:[0,10.5,-244.5],s:[4.8,.7,4.8],axis:'x',amp:3,speed:.7,phase:0,
  color:'#879fb1',tex:'checker',grp:5,nm:'Wreck ferry · crosswise cargo sling'});
block('crane elbow landing', [4,11,-254], 8,9,3.5,grey,chamfer(8,9));
enemy('turtle leaves the left lane open', [6.1,11,-255], 'turtle', .45,.7);
add({t:'mover',p:[4,11,-265],s:[4.8,.7,4.8],axis:'z',amp:2,speed:.75,phase:1.3,
  color:'#879fb1',tex:'checker',grp:5,nm:'Wreck ferry · fore-and-aft cargo sling'});
block('hold sorting island', [-1,11.8,-276], 10,10,4,rest,chamfer(10,10,1));
checkpoint([1.8,11.8,-276], '04 · loose cargo');
fruit([.2,10.5,-236],[0,10.5,-243.5],4,1.2);
fruit([2.5,11,-253],[3,11,-258],3);
fruit([3,11,-269],[-1,11.8,-273],4,1);

// Optional raised loop: clearly visible crystal, tighter landings, a safe
// return onto the same refuge. The bonus entrance lives on its own side dock.
block('secret first step', [-8,12.8,-273.5], 3.4,3.8,3,raised,chamfer(3.4,3.8,.4));
block('secret crown perch', [-13.5,13.8,-278], 4.8,6.5,5,raised,chamfer(4.8,6.5,.6));
block('secret return step', [-8,12.8,-282.5], 3.4,3.8,3,raised,chamfer(3.4,3.8,.4));
add({t:'crystal',p:[-13.5,14.8,-279],grp:6,nm:'Wreck cargo · high-value consignment'});
fruit([-5,11.8,-273],[-8,12.8,-273.5],3,.6);
crate([-13.5,13.8,-276], 'life');
block('captains ledger side dock', [9.5,11.8,-277], 5.5,7,3,rest,chamfer(5.5,7));
add({t:'bonusplatform',p:[9.5,11.8,-278],to:[9.5,11.95,-274.5],grp:6,nm:'Wreck cargo · the captain’s ledger bonus'});

// 4. A four-beat collapsing staircase. Empty landing pads isolate the timing
// challenge; there is no enemy forcing a blind collision on a falling surface.
for (const [i,x,y,z,w] of [[0,-2,12.2,-285.5,4.6],[1,2,12.6,-293,4.4],
  [2,-2,13,-300.5,4.2],[3,1,13.4,-308,4.4]]) {
  add({t:'crumble',p:[x,y,z],s:[w,.8,4.8],shake:1.45,speed:24,
    tex:'checker',color:'#c1afa0',grp:5,nm:`Wreck collapse · loose pallet ${i+1}`});
  fruit([x,y,z+1.1],[x,y,z-.9],2);
}
block('last safe muster', [0,13.4,-318], 10,9,4.5,rest,chamfer(10,9,1));
checkpoint([2.7,13.4,-318], '05 · the broken stern');
crate([-3.1,13.4,-319], 'mask');

// 5. Recombine the opening dogleg with rising, clipped silhouettes and
// different enemies. Each enemy occupies the far half of a substantial pad.
block('stern port battlement', [-4,14.4,-330], 6.5,7.5,5,grey,chamfer(6.5,7.5,.9));
enemy('stern crab beyond touchdown', [-4,14.4,-332.2], 'grunt',1.3,1.3);
block('stern cross-deck', [2.5,15.2,-340.7], 7.4,7.4,5.5,grey,
  [[-3.7,3.7],[1.7,3.7],[3.7,1.7],[3.7,-3.7],[-3.7,-3.7]]);
enemy('stern hopper on the far right', [4.1,15.2,-342.3], 'hopper',.55,1.1);
block('high keystone', [-2,16,-351.1], 5.8,6.5,6,grey,chamfer(5.8,6.5,1));
block('midships muster', [0,16,-362.6], 12,12,6,rest,chamfer(12,12,1));
fruit([-2,13.4,-321],[-4.7,14.4,-328],4,1.1);
fruit([-2.2,14.4,-332],[.3,15.2,-339],4,1.1);
fruit([.2,15.2,-343],[-2,16,-349],4,1);
fruit([-2,16,-353],[0,16,-360],4,1);
checkpoint([2.7,16,-363], '06 · interlocking cargo');

// 6. The second half changes the rhythm rather than stretching the first.
// Long tongues and hooked corners trade depth for lateral landing decisions.
block('port cargo hook',[-4.5,16.8,-376],7,8,5,grey,
  [[-3.5,4],[3.5,4],[3.5,.5],[1,.5],[1,-4],[-3.5,-4]]);
block('starboard cargo tongue',[3,17.6,-387],9,10,6,grey,
  [[-4.5,5],[2.5,5],[4.5,3],[4.5,-5],[-1.5,-5],[-1.5,-.5],[-4.5,-.5]]);
enemy('crab at the end of the cargo tongue',[5,17.6,-389],'grunt',1.1,1.1);
block('long port comb',[-3,18.4,-403],6,15,6,grey,chamfer(6,15,1));
block('stamp works refuge',[0,18.4,-418],11,10,6,rest,chamfer(11,10,1));
checkpoint([3,18.4,-418],'07 · stamping machinery');
fruit([-2,16,-367],[-5.4,16.8,-373],4,1);
fruit([-5.4,16.8,-378],[-.5,17.6,-384],4,1.2);
fruit([2,17.6,-390.5],[-2,18.4,-397],4,1.2);
fruit([-3,18.4,-409],[0,18.4,-414.4],4,1);

// 7. Broad pads offer two deliberate solutions: time the stamping head or
// take the exposed outside shoulder. The following lift requires a read.
block('split stamp bed',[0,18.4,-431],10,8,6,grey,chamfer(10,8,.6));
add({t:'crusher',p:[-2.7,18.4,-431],s:[3.4,4,3.2],cycle:3.6,phase:0,grp:5,nm:'Wreck machinery · port stamping head'});
enemy('turtle on the stamp bed shoulder',[3,18.4,-433.2],'turtle',.45,.6);
block('reversed stamp bed',[0,19.1,-443],9,8,6,grey,chamfer(9,8,.7));
add({t:'crusher',p:[2.4,19.1,-443],s:[3.4,4,3.2],cycle:3.6,phase:1.8,grp:5,nm:'Wreck machinery · starboard stamping head'});
add({t:'mover',p:[0,19.1,-454],s:[5.5,.8,6],axis:'y',amp:2,speed:.65,phase:0,
  tex:'checker',color:'#879fb1',grp:5,nm:'Wreck elevator · freight hoist'});
block('upper sorting gallery',[0,20.4,-469],10,14,7,rest,chamfer(10,14,1));
checkpoint([3,20.4,-469],'08 · split cargo shelves');
fruit([1.1,18.4,-421.5],[.4,18.4,-428.3],4,1);
fruit([.4,18.4,-433.6],[-2.5,19.1,-440.5],4,1);
fruit([-2.5,19.1,-445.6],[0,19.1,-452.5],4,1);
fruit([0,20.4,-456],[0,20.4,-463.6],4,1);

// 8. A visible fork, a narrow high diamond, then an offset descent. Both
// shelves rejoin before the checkpoint; no camera can hide an ambush here.
block('port shelf',[-5,21.2,-481],5.5,7,6,raised,chamfer(5.5,7,.7));
block('starboard shelf',[5,21.2,-481],5.5,7,6,raised,chamfer(5.5,7,.7));
crate([-5.7,21.2,-482.2],'mystery');
enemy('turtle on the alternate high shelf',[5.5,21.2,-482],'turtle',.45,.7);
block('high cargo diamond',[0,22,-492],7.5,8,8,grey,chamfer(7.5,8,1.6));
enemy('hopper beyond the diamond landing',[1.8,22,-493.6],'hopper',.45,1);
block('descending starboard shelf',[4,20.8,-503.5],6,8.5,7,grey,chamfer(6,8.5,.8));
block('balance works refuge',[0,19.4,-516.5],10,10,7,rest,chamfer(10,10,1));
checkpoint([2.7,19.4,-516.5],'09 · balancing cargo');
fruit([-2,20.4,-472.4],[-5,21.2,-478.7],4,1.1);
fruit([2,20.4,-472.4],[4.1,21.2,-478.7],4,1.1);
fruit([-4,21.2,-483.3],[-1.5,22,-490.4],4,1);
fruit([4,21.2,-483.3],[1,22,-490.4],4,1);
fruit([.2,22,-495.4],[3,20.8,-502.3],4,1);
fruit([3,20.8,-506.5],[1,19.4,-513],4,1);

// 9. Wide moving cargo changes one axis at a time. A fixed diagonal pad
// between the motions provides space to settle, observe and launch again.
add({t:'mover',p:[-3,19.4,-528],s:[5,.8,6],axis:'x',amp:2.2,speed:.85,phase:.7,
  tex:'checker',color:'#879fb1',grp:5,nm:'Wreck balance · transverse pallet'});
block('diagonal balance landing',[3,19.4,-539],7,7,7,grey,
  [[-3.5,3.5],[1.2,3.5],[3.5,1.2],[3.5,-3.5],[-1.2,-3.5],[-3.5,-1.2]]);
add({t:'mover',p:[-1,18.6,-548.5],s:[5,.8,5],axis:'y',amp:1.2,speed:.9,phase:0,
  tex:'checker',color:'#879fb1',grp:5,nm:'Wreck balance · bobbing pallet'});
block('last gangway refuge',[0,17.2,-560],10,10,6,rest,chamfer(10,10,1));
checkpoint([2.8,17.2,-560],'10 · descending gangways');
fruit([-1.5,19.4,-520],[-3,19.4,-526],4,1.2);
fruit([-2,19.4,-530],[1.5,19.4,-537.5],4,1.2);
fruit([2,19.4,-542],[-1,18.6,-549],4,1);
fruit([-1,18.6,-552],[0,17.2,-559],4,1);

// 10. Reprise the native timber at a lower elevation, then stop on a broad
// corner. Entry -112 to this turn at -618 is exactly twice the first brief's
// 253m run; the side-scrolling gallery is additional to those 506 metres.
boardwalk('descending near jetty',[0,17.2,-575.5]);
boardwalk('descending middle jetty',[1.2,17.2,-591.1],180);
boardwalk('descending far jetty',[-1.2,16,-606.5]);
enemy('turtle guards the last jetty departure',[-1.2,16,-608.6],'turtle',.25,.6);
block('turn into the broadside gallery',[0,16,-618],12,12,6,rest,chamfer(12,12,1));
checkpoint([0,16,-619],'11 · broadside stair');
fruit([0,17.2,-564],[0,17.2,-570.4],3,.8);
fruit([0,17.2,-580],[1.2,17.2,-586.5],4,1);
fruit([1.2,17.2,-595.5],[-2.2,16,-602.1],4,1);
fruit([-2.2,16,-610],[0,16,-615],3,.8);

// 11–13. A real side-scrolling section: eastward travel, a stable broadside
// camera, and one shallow depth lane. Climb, ride, drop, then timber gaps.
block('broadside first stair',[12,16.8,-618],6,6,5,grey,chamfer(6,6,.6));
block('broadside second stair',[23,18,-618],7,6,6,grey,chamfer(7,6,.8));
block('broadside combat shelf',[35,18.8,-618],9.5,7,7,grey,
  [[-4.75,3.5],[2.75,3.5],[4.75,1.5],[4.75,-3.5],[-4.75,-3.5]]);
enemy('broadside crab beyond touchdown',[36.6,18.8,-618.4],'grunt',1.05,1.05);
block('broadside hoist refuge',[47,19.6,-618],10,8,7,rest,chamfer(10,8,1));
checkpoint([46,19.6,-616.5],'12 · broadside hoist');
add({t:'mover',p:[58,19.6,-618],s:[6,.8,6],axis:'y',amp:2.5,speed:.65,phase:.7,
  tex:'checker',color:'#879fb1',grp:5,nm:'Wreck broadside · rising cargo lift'});
block('broadside high landing',[70,21,-618],9.5,7,8,raised,chamfer(9.5,7,1));
enemy('broadside hopper guards the far ledge',[72.3,21,-618.7],'hopper',.45,1);
for(const [i,x,y,w] of [[0,82,20.3,6],[1,92,19.5,6]])
  add({t:'crumble',p:[x,y,-618],s:[w,.8,6],shake:1.5,speed:24,
    tex:'checker',color:'#c1afa0',grp:5,nm:`Wreck broadside · dropping stair ${i+1}`});
block('broadside timber refuge',[104,18.6,-618],10,8,7,rest,chamfer(10,8,1));
checkpoint([103,18.6,-616.4],'13 · broadside broken timber');
boardwalk('broadside near jetty',[119,17.5,-618],90);
boardwalk('broadside far jetty',[135,16.6,-618],90);
// The diagonal edge meets the original bow landing's near edge exactly;
// the grey floor must not cover its detailed planks or their gaps.
block('treasury departure deck',[148,16,-618],12,12,6,rest,
  [[-5,6],[5,6],[6,5],[6,-1.2],[-2,-6],[-5,-6],[-6,-5],[-6,5]]);
for(const [a,b] of [
  [[4,16,-618],[10,16.8,-618]],[[14,16.8,-618],[21,18,-618]],
  [[25,18,-618],[32.5,18.8,-617]],[[38,18.8,-617],[43.6,19.6,-618]],
  [[51,19.6,-618],[56.5,19.6,-618]],[[59.6,21,-618],[67,21,-617]],
  [[73.4,21,-617],[80.3,20.3,-618]],[[83.7,20.3,-618],[90.3,19.5,-618]],
  [[93.7,19.5,-618],[101.8,18.6,-618]],[[107.5,18.6,-618],[114,17.5,-618]],
  [[123.5,17.5,-618],[130.4,16.6,-618]],[[139.5,16.6,-618],[145,16,-618]],
] as [P,P][]) fruit(a,b,4,1);
crate([48.5,19.6,-620.2],'mask');
crate([106.7,18.6,-620.2],'mystery');
add({t:'zone',p:[77,20,-618],s:[144,36,18],dir:'E',grp:11,nm:'Wreck broadside · eastward side-scrolling controls'});
// End at X148, before the preserved bridge starts at X151.
add({t:'camnode',p:[71,20,-618],s:[154,36,20],cameraView:true,cameraPresentationOnly:true,
  cameraPosition:[74,25,-594],cameraTarget:[74,20,-618],cameraFollowDistance:18,cameraKeepDistance:true,
  cameraFollowTargetHeight:2,cameraFov:56,radius:5,grp:12,nm:'Wreck broadside · continuous side-view gallery'});

// A shallow, visibly separate death sea makes every missing floor legible.
add({t:'mesh',p:[0,-3,-365],vertices:[-38,0,268,38,0,268,38,0,-267,-38,0,-267],
  indices:[0,1,2,0,2,3],solid:false,doubleSided:true,materialStyle:'water',color:'#234553',
  emissive:'#071c25',grp:5,nm:'Wreck challenge · water beneath the cargo'});
add({t:'pit',p:[0,-3.2,-365],s:[76,1,535],invisible:true,grp:5,nm:'Wreck challenge · bilge death plane'});
add({t:'mesh',p:[87,-3,-618],vertices:[-60,0,18,75,0,18,75,0,-18,-60,0,-18],
  indices:[0,1,2,0,2,3],solid:false,doubleSided:true,materialStyle:'water',color:'#234553',
  emissive:'#071c25',grp:5,nm:'Wreck broadside · water beneath the gallery'});
add({t:'pit',p:[94.5,-3.2,-618],s:[135,1,36],invisible:true,grp:5,nm:'Wreck broadside · death plane'});

// One longitudinal control spine, independent of the zigzags. The higher
// three-quarter presentation exposes platform tops and the next two jumps.
export const PIRATE_INTERIOR_ROUTE: P[] = [[0,8,-112],[0,8,-130],[0,9.9,-177],
  [0,10.5,-233],[0,11.8,-276],[0,13.4,-318],[0,16,-363],[0,18.4,-418],
  [0,20.4,-469],[0,19.4,-516.5],[0,17.2,-560],[0,16,-608],[0,16,-618],
  [20,18,-618],[47,19.6,-618],[72,21,-618],[104,18.6,-618],[148,16,-618]];
for (const p of [[0,8,-85],...PIRATE_INTERIOR_ROUTE] as P[])
  add({t:'camnode',p,radius:5,grp:11,nm:'Wreck challenge · stable forward movement spine'});
// Overlap the forward shots, then hand off to the broadside view at the turn.
for (const [z,y,depth] of [[-148,9,82],[-217,10.5,58],[-269,11.5,48],[-303,13,30],[-344,15,52],
  [-390,18,54],[-446,20,58],[-496,21,50],[-540,19,60],[-585,18,46]])
  add({t:'camnode',p:[0,y,z],s:[48,32,depth+12],cameraView:true,cameraPresentationOnly:true,
    cameraPosition:[0,y+10,z+13],cameraTarget:[0,y,z-3],cameraFollowDistance:17,
    cameraFollowTargetHeight:1.6,cameraFov:56,radius:5,grp:12,
    nm:'Wreck challenge · read the next landing'});
export const PIRATE_INTERIOR_COMPONENTS = C;
