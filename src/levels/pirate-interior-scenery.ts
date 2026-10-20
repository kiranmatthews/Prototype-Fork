import type { CustomComponent } from '../level';
import { DROWNED_CROWN_ASSETS } from '../drownedCrownAssets';
import { DROWNED_CANOPY_POSITION, DROWNED_SKYLIGHTS } from '../drownedCrownCanopy.generated';
import { cutPirateRoofOpening } from './pirate-clearance';

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

// Repeat complete timbers with a uniform scale. Their ends meet; no axis is
// stretched to cover the unusually large hold.
function timber(a:Point,b:Point,maxScale:number,name:string):void {
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],run=Math.hypot(dx,dz),length=Math.hypot(run,dy);
 const native=DROWNED_CROWN_ASSETS.crownmeshybeamhewn.size;
 const count=Math.max(1,Math.ceil(length/(native[1]*maxScale))),scale=length/count/native[1];
 for(let i=0;i<count;i++)module('crownmeshybeamhewn',
  [a[0]+dx*i/count,a[1]+dy*i/count,a[2]+dz*i/count],scale,
  Math.atan2(-dz,dx)*180/Math.PI,name,-Math.atan2(run,dy)*180/Math.PI);
}

// Solid backing sits behind a continuous timber skin. It closes the natural
// holes in the salvaged panels without becoming the room's dominant surface.
const backing=(p:Point,s:Point,name:string,color='#32251f')=>PIRATE_INTERIOR_SCENERY.push({
 t:'wall',p,s,tex:'solid',color,grp:5,nm:`Skate hold · ${name}`,
});
for(const side of [-1,1])backing([side*77.8,-12,-244],[4,68,310],'closed warm hull backing');
for(const z of [-97,-391]){
 const rear=z<-200,passageX=rear?32:0,floorY=rear?18:8,lintelY=rear?33:25;
 for(const [left,right] of [[-80,passageX-12.5],[passageX+12.5,80]])
  backing([(left+right)/2,-12,z],[right-left,68,4],'closed end wall beside the passage');
 backing([passageX,-12,z],[25,floorY+11.5,4],'solid sill below the passage');
 backing([passageX,lintelY,z],[25,56-lintelY,4],'high lintel above the open passage');
}
// Keep the original ceiling collision while the visible backing has skylights.
PIRATE_INTERIOR_SCENERY.push({t:'wall',p:[0,56,-244],s:[160,4,310],
 invisible:true,tex:'solid',color:'#202a31',grp:5,nm:'Skate hold · dark closed ceiling backing'});

// Overlapping, staggered courses read as one ship wall. The old separated
// horizontal bands exposed twelve-metre strips of untextured backing.
const wallX=75.5,panelScale=2,bayStep=22.5;
const wallRows=[-12,.5,13,25.5,38];
for(const side of [-1,1]){
 for(let row=0;row<wallRows.length;row++){
  const stagger=row%2?bayStep*.5:0;
  for(let bay=0;bay<14;bay++){
   module('crownhullpanel',[side*wallX,wallRows[row],-99-stagger-bay*bayStep],panelScale,-side*90,'continuous overlapping hull planking');
  }
 }
 // Large sculpted arches support the roof at each balcony bay. Their inner
 // face remains outside X69, clear of the X64 catwalk and every skate surface.
 for(const z of [-127,-175,-223,-271,-319,-367])
  module('crowncrashoakarch',[side*74,15.9,z],2.8,-side*90,'connected red oak gallery framing');
 for(const y of [13.8,26,42.5])
  timber([side*73.8,y,-98],[side*73.8,y,-390],4,'continuous hull stringer');
}

// Each doorway gets a complete oak frame and a real sill. The treasury exit
// is off centre at X32; no panel or beam crosses its playable opening.
for(const [z,yaw] of [[-99,180],[-389,0]]){
 const rear=z<-200,passageX=rear?32:0,floorY=rear?18:8;
 for(const [left,right] of [[-80,passageX-12.5],[passageX+12.5,80]]){
  const count=Math.ceil((right-left)/23);
  for(let i=0;i<count;i++){
   const x=left+12+(right-left-24)*i/(count-1);
   for(const y of wallRows)module('crownhullpanel',[x,y,z],panelScale,yaw,'planked bulkhead beside the framed passage');
  }
  for(const y of [13.8,26,42.5])timber([left,y,z+(rear?2:-2)],[right,y,z+(rear?2:-2)],4,'bulkhead stringer');
 }
 // Fill the sill and lintel with complete panels scaled uniformly. The
 // smaller courses fit below/above the opening instead of cutting a panel.
 for(const y of rear?[-12,.5]:[-12])module('crownhullpanel',[passageX,y,z],2,yaw,'closed timber beneath the passage');
 for(const x of rear?[-8,0,8]:[-6,6])module('crownhullpanel',[passageX+x,rear?13:1.2,z],rear?.65:1,yaw,'short sill planking beneath the passage');
 for(const y of rear?[38]:[25.5,38])module('crownhullpanel',[passageX,y,z],2,yaw,'closed timber above the passage');
 if(rear)for(const x of [-8.5,0,8.5])module('crownhullpanel',[passageX+x,33,z],.75,yaw,'short lintel planking above the passage');
 module('crowncrashoakarch',[passageX,floorY-.1,z+(rear?1.2:-1.2)],1.8,yaw,'royal oak passage frame');
}
module('crowncrashsterngallery',[0,25,-105],2,180,'captain’s red and gold gallery above the entrance');

// Lowering the visible roof connects the giant room to its framing while
// preserving at least fifteen metres of clearance above catwalk jump height.
const canopyScale=1.05,canopyBase:Point=[0,44.5,-242];
module('crowncrashcanopy',canopyBase,canopyScale,0,'blue cavern roof above the ship timbers');
// The loader centres a model in X/Z and anchors its bottom at Y=0. Transform
// the original cutouts with that same uniform fit instead of guessing their
// positions in the relocated hold. Its own sculpted edges frame the daylight.
const skylights=DROWNED_SKYLIGHTS.map(([x,z])=>[
 canopyBase[0]+(x-DROWNED_CANOPY_POSITION[0])*canopyScale,
 canopyBase[2]+(z-DROWNED_CANOPY_POSITION[2])*canopyScale,
] as [number,number]);
let ceiling:CustomComponent={t:'mesh',p:[0,0,0],
 vertices:[-80,56,-399,80,56,-399,80,56,-89,-80,56,-89],indices:[0,1,2,0,2,3],
 solid:false,doubleSided:true,tex:'solid',color:'#202a31',grp:5,
 nm:'Skate hold · dark ceiling around the daylight openings'};
// A slight margin hides the backing behind the native 31×28 m roof cutouts.
// Clipping also handles the east opening meeting the room's outer boundary.
for(const [x,z] of skylights)ceiling=cutPirateRoofOpening(ceiling,x,z,33,30);
PIRATE_INTERIOR_SCENERY.push(ceiling);
for(let i=0;i<skylights.length;i++){
 const [x,z]=skylights[i],base=i===0?.15:16.15;
 // Existing feathered cards fade above the floor/apron. They add no lights,
 // textures or collision, and stay clear of the fruit trail and roof beams.
 for(const [dx,dz,width,color] of [[0,0,12,'#a5dcff'],[-3,2,3.2,'#c2eaff'],[3,-2,2.4,'#8acfff']] as [number,number,number,string][])
  for(const yaw of [0,90])PIRATE_INTERIOR_SCENERY.push({
   t:'decor',dkind:'treehousetrialssunshaft',p:[x+dx,base,z+dz],s:[width,56-base,.02],amp:0,yaw,color,
   scenerySolid:false,grp:5,nm:'Skate hold · cool feathered daylight rays',
  });
}
for(const z of [-127,-175,-223,-271,-319,-367])
 timber([-75,43,z],[75,43,z],5,'heavy transverse roof beam');

// Salvaged royal sails break up the tall, repeating hull bays. The complete
// local canvas texture spans each square sail once; shallow folds give it body
// without new assets or per-frame work. Upper corners meet the existing Y42.5
// stringer. Side sails stay beyond X70, outside both the catwalk and its jumps.
function royalSail(p:Point,yaw:number,color:string,name:string):void {
 const width=18,height=18,columns=12,rows=12;
 const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
  const u=col/columns,v=row/rows,across=Math.sin(Math.PI*u);
  const sag=.65*across*(.4+.6*v);
  const fold=Math.sin(Math.PI*v)*(.9*across+.4*Math.sin(Math.PI*4*u));
  vertices.push((u-.5)*width,-v*height-sag,fold);
  uvs.push(u,1-v);
 }
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;
  indices.push(a,c,b,b,c,d);
 }
 PIRATE_INTERIOR_SCENERY.push({t:'mesh',p,yaw,vertices,indices,uvs,
  solid:false,doubleSided:true,tex:'crown-canvas',color,grp:5,
  nm:`Skate hold · salvaged royal sail · ${name}`});
}
for(const side of [-1,1])for(const z of [-199,-295])
 royalSail([side*73.1,42.5,z],-side*90,z===-199?'#b98174':'#e3cfaa',
  `${side<0?'port':'starboard'} ${z===-199?'forward':'aft'} bay`);
// Frame the off-centre treasury doorway without covering its arch or opening.
royalSail([-29,42.5,-386.5],0,'#e3cfaa','rear port bulkhead');
royalSail([60,42.5,-386.5],0,'#b98174','rear starboard bulkhead');

// These lanterns are mounted beside the upper route, so the existing bounded
// light pool actually reaches the timber and player instead of floating far away.
for(const side of [-1,1])for(const z of [-151,-199,-247,-295,-343]){
 module('crownbrasslantern',[side*70.7,28,z],1.7,-side*90,'upper gallery lantern');
 PIRATE_INTERIOR_SCENERY.push({t:'torch',p:[side*69.9,29.1,z],rise:0,w:.25,
  grp:5,nm:'Skate hold · upper gallery lantern light'});
}

// Whole oak timbers carry the long return ramp into the rear gallery.
// Keep the riding width clear and sink every support below the bilge water.
for(const side of [-1,1]){
 timber([side*6.75,-.35,-300],[side*6.75,15.65,-364],2,'return ramp edge beam');
 for(const z of [-313,-331,-349])
  timber([side*6.75,-8,z],[side*6.75,(-z-300)*.25-.35,z],2,'return ramp rooted support');
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
