import type { CustomComponent } from '../level';
import { DROWNED_CROWN_ASSETS } from '../drownedCrownAssets';

type Point=[number,number,number];
type Asset=keyof typeof DROWNED_CROWN_ASSETS;

/** Canonical local coordinates; the interior assembler applies its set offset. */
export const PIRATE_INTERIOR_SCENERY:CustomComponent[]=[];
const usedScales=new Map<Asset,Set<number>>();

/** Every visible module retains its provider proportions and original material. */
function module(kind:Asset,p:Point,scale:number,yaw:number,name:string,roll=0):void {
 const native=DROWNED_CROWN_ASSETS[kind].size;
 if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid interior scenery scale');
 const size=native.map(v=>v*scale) as Point;
 PIRATE_INTERIOR_SCENERY.push({t:'decor',dkind:kind,p,s:size,yaw,amp:roll,
  scenerySolid:false,grp:5,nm:`Skate hold · ${name} · original Meshy ${scale}×`});
 let scales=usedScales.get(kind);if(!scales){scales=new Set();usedScales.set(kind,scales);}scales.add(scale);
}

// Plain structural backing seals the gaps in the broken Meshy hull panels.
// This is an untextured enclosure, never newly authored visible floorboards.
const backing=(p:Point,s:Point,name:string,color='#493329')=>PIRATE_INTERIOR_SCENERY.push({
 t:'wall',p,s,tex:'solid',color,grp:5,nm:`Skate hold · ${name}`,
});
for(const side of [-1,1])backing([side*77.8,-12,-244],[4,80,310],'closed warm hull backing');
for(const z of [-97,-391]){
 // The escape bridge reaches the treasury at X32, off the bowl centreline.
 const passageX=z<-200?32:0;
 for(const [left,right] of [[-80,passageX-12.5],[passageX+12.5,80]])
  backing([(left+right)/2,-12,z],[right-left,80,4],'closed end wall beside the passage');
 backing([passageX,36,z],[25,32,4],'high lintel above the open passage');
}
// A closed dark roof behind the existing canopy eliminates unintended sky
// leaks. The lowest backing face is Y65, clear of every jump and catwalk.
backing([0,65,-244],[160,4,310],'dark closed ceiling backing','#252322');

// A 148 m wide hull hall surrounds the 100 m bowl and its clear rim apron.
// Three staggered bands of intact panels dress the solid shell. Quiet backing
// between bands avoids the former five-storey grid of floating broken panels.
const wallX=74,panelScale=2,bayStep=22.5;
const wallRows=[-7.5,17.9,43.3];
for(const side of [-1,1]){
 for(let row=0;row<wallRows.length;row++){
  const stagger=row%2?bayStep*.5:0,count=row%2?12:13;
  for(let bay=0;bay<count;bay++){
   module('crownhullpanel',[side*wallX,wallRows[row],-112-stagger-bay*bayStep],panelScale,-side*90,'layered inner hull wall');
  }
 }
 // Whole oak arches sit against the walls, well outside all ride/camera space.
 // Their broad red framing identifies individual balcony bays at a distance.
 for(const z of [-127,-175,-223,-271,-319,-367]){
  module('crowncrashoakarch',[side*70,15.9,z],1.65,-side*90,'red oak wall bay');
 }
}

// End-wall dressing preserves the 25 m central passage up to the Y36 lintel.
// The captain's gallery is the deliberate high entry landmark.
for(const [z,yaw] of [[-99,180],[-389,0]]){
 const panelXs=z<-200?[-70.5,-47.5,-24.5,-1.5,56.5,70.5]:[-70.5,-47.5,-24.5,24.5,47.5,70.5];
 for(const x of panelXs)for(const y of wallRows){
  module('crownhullpanel',[x,y,z],panelScale,yaw,'end wall beside the open passage');
 }
 for(const x of [-49,49]){
  module('crownshipribs',[x,29,z+(z>-200?-5:5)],1.15,yaw,'high end-wall hull framing');
 }
}
module('crowncrashsterngallery',[0,17,-105],2,180,'captain’s red and gold gallery');

// The existing closed cave canopy gives the impossible interior a dark roof.
// Its lowest point is above 56 m; the entire bowl and both elevated routes stay open.
module('crowncrashcanopy',[0,56,-242],1.05,0,'collapsed ship cavern roof');
for(const z of [-124,-172,-220,-268,-316,-364]){
 // Original 2.6 m beams at uniform 4× become 10.4 m timbers. Repeating these
 // across the ceiling avoids a single stretched 150 m piece of wood.
 for(let i=0;i<15;i++){
  module('crownmeshybeamhewn',[-76+i*10.2,58,z],4,0,'overhead transverse oak timber',-90);
 }
}

// Low rock shoulders remain beyond the timber walls and never enter the bowl.
for(const side of [-1,1])for(const z of [-112,-376]){
 module('crowncrashcavernrock',[side*88,-10,z],1,side*90,'rock outside the broken hull corners');
}

// Cargo and guns use only the outer 4 m of the Y16 apron. Keep the X±50
// coping, the central floor, and the X±10 entry/exit corridor free of props.
for(const side of [-1,1]){
 for(const [z,scale,yaw] of [[-184,.8,8],[-236,.85,-10],[-282,.75,12]]){
  module('crowncargostack',[side*56,16,z],scale,side*yaw,'cargo beside the upper balcony');
 }
 for(const z of [-207,-261]){
  module('crownnavalcannon',[side*56,16,z],.8,side*90,'secured balcony cannon');
 }
 for(const z of [-174,-198,-222,-246,-270,-294]){
  module('crownmeshybeamhewn',[side*56,16,z],1.2,0,'balcony lantern post');
  module('crownbrasslantern',[side*55.55,17.3,z+.1],.8,-side*90,'balcony route lantern');
  PIRATE_INTERIOR_SCENERY.push({t:'torch',p:[side*55.15,18,z+.1],rise:.45,w:.2,
   grp:5,nm:'Skate hold · warm upper-balcony lantern light'});
 }
}

/** Auditable scale ratios: each size component is nativeSize × one scalar. */
export const PIRATE_INTERIOR_SCENERY_RATIOS=Object.fromEntries(
 [...usedScales].map(([kind,scales])=>[kind,{nativeSize:[...DROWNED_CROWN_ASSETS[kind].size],uniformScales:[...scales]}]),
);
