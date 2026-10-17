import type { CustomComponent } from '../level';
import { DROWNED_CROWN_BOARD_MODELS } from '../drownedCrownBoards.generated';
import { DROWNED_CROWN_MODELS } from '../drownedCrownAssets.generated';
import { PIRATE_BILGE_BOWL_COMPONENTS } from './pirate-bilge-bowl';
import { pirateUniformBoardwalkModule, PIRATE_BOARDWALK_USABLE_LENGTH } from './pirate-boardwalk-modules';
import type { P } from './pirate-meshes';

/** A fresh, enormous skate hold. Coordinates are local to the concealed set. */
const C:CustomComponent[]=[];
const add=(c:CustomComponent)=>C.push(c);
const prop=(kind:keyof typeof DROWNED_CROWN_MODELS,p:P,scale=1,yaw=0)=>add({t:'decor',dkind:kind,p,
 s:DROWNED_CROWN_MODELS[kind].size.map(n=>n*scale) as P,yaw,scenerySolid:false,grp:5,nm:'Skate hold · '+DROWNED_CROWN_MODELS[kind].label});
const board=DROWNED_CROWN_BOARD_MODELS.crownmeshyplankchipped;
// Only the invisible support surface is authored here. Every visible plank
// is the existing complete Meshy model, with one uniform scale on all axes.
function deck(nm:string,x:number,y:number,z:number,width:number,depth:number,grp=4){
 const columns=Math.max(1,Math.round(width/board.size[2])),scale=width/(columns*board.size[2]);
 const length=board.size[0]*scale,rows=Math.max(1,Math.round(depth/length)),actualDepth=rows*length;
 add({t:'platform',p:[x,y-.2,z],s:[width,.4,actualDepth],artProxy:true,grp,nm});
 for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){
  add({t:'decor',dkind:'crownmeshyplankchipped',p:[x-width/2+(col+.5)*board.size[2]*scale,y-board.size[1]*scale,z-actualDepth/2+(row+.5)*length],
   s:board.size.map(v=>v*scale) as P,yaw:(row+col)%2?90:270,scenerySolid:false,grp,nm:'Original-proportion Meshy plank · '+nm});
 }
 return actualDepth;
}
function timberRamp(nm:string,a:P,b:P,width=12,grp=4){
 const dx=b[0]-a[0],dz=b[2]-a[2],dy=b[1]-a[1],run=Math.hypot(dx,dz),length=Math.hypot(run,dy),yaw=Math.atan2(-dz,dx),tilt=Math.atan2(dy,run);
 const side:P=[-dz/run,0,dx/run],up:P=[-Math.cos(yaw)*Math.sin(tilt),Math.cos(tilt),Math.sin(yaw)*Math.sin(tilt)];
 const vertices=[...a.map((v,i)=>v-side[i]*width/2),...a.map((v,i)=>v+side[i]*width/2),...b.map((v,i)=>v+side[i]*width/2),...b.map((v,i)=>v-side[i]*width/2)];
 add({t:'mesh',p:[0,0,0],vertices,indices:[0,1,2,0,2,3],solid:true,doubleSided:true,artProxy:true,grp,nm});
 const cols=Math.round(width/board.size[2]),scale=width/(cols*board.size[2]),rows=Math.ceil(length/(board.size[0]*scale));
 for(let col=0;col<cols;col++)for(let row=0;row<rows;row++){
  const t=(row+.5)/rows,cross=-width/2+(col+.5)*width/cols;
  const p=a.map((v,i)=>v+(b[i]-v)*t+side[i]*cross-up[i]*board.size[1]*scale) as P;
  add({t:'decor',dkind:'crownmeshyplankchipped',p,s:board.size.map(v=>v*scale) as P,yaw:yaw*180/Math.PI,amp:tilt*180/Math.PI,
   scenerySolid:false,grp,nm:'Original-proportion Meshy plank · '+nm});
 }
}
const fruit=(a:P,b:P,n=7)=>{for(let i=0;i<n;i++){const t=i/(n-1);add({t:'wumpa',p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+1,a[2]+(b[2]-a[2])*t],grp:4});}};
const lamp=(p:P,scale=1)=>{prop('crownbrasslantern',p,scale);add({t:'torch',p:[p[0],p[1]+.4,p[2]],rise:.4,w:.3,grp:5,nm:'Skate hold · mounted lantern glow'});};

// The entry is a proper room, with a generous line into the first overlook.
deck('Ship interior · boarding gallery',0,8,-122,27.36,35);
timberRamp('Ship interior · climb to the bowl overlook',[0,8,-139],[0,16,-153],12);
deck('Ship interior · upper fore gallery',0,16,-157.5,136,8.75);
add({t:'checkpoint',p:[4,8,-129],grp:4,nm:'Skate hold · the giant bilge'});
fruit([4,8,-116],[1,8,-135],5);fruit([0,9,-142],[0,16,-165],7);
for(const side of [-1,1]){
 prop('crowncargostack',[side*10,8,-111],1.25,side*16);
 prop('crownnavalcannon',[side*11,8,-132],1,side>0?-90:90);
 lamp([side*10,10,-125],1.1);
}

C.push(...PIRATE_BILGE_BOWL_COMPONENTS.map(c=>({...c,grp:5})));
add({t:'pit',p:[0,-10.2,-245],s:[180,1,330],invisible:true,grp:5,nm:'Skate hold · deep water below the galleries'});
add({t:'checkpoint',p:[0,0,-263],grp:5,nm:'Skate hold · the north sluice'});
fruit([0,0,-204],[0,0,-260],11);
// Optional wall lines advertise the bowl without putting props in its runout.
for(const side of [-1,1]){
 for(const z of [-205,-220,-235,-250])add({t:'wumpa',p:[side*47,13,z],grp:5,nm:'Bilge bowl · high carve line'});
 for(const z of [-195,-230,-265])lamp([side*57,18.2,z],1.25);
}

// Two complete original-proportion Meshy catwalk routes overlook the bowl.
// Each has a deliberate jump or a grind line, plus a supported return ramp.
const moduleScale=1.5,moduleLength=PIRATE_BOARDWALK_USABLE_LENGTH*moduleScale;
for(const side of [-1,1]){
 const x=side*64;
 timberRamp('Ship interior · climb to the '+(side<0?'port':'starboard')+' gallery',[x,16,-160],[x,26,-179],6);
 for(let i=0;i<7;i++){
  const z=-187-i*(moduleLength-.18)-(i>=4?2.4:0);
  C.push(...pirateUniformBoardwalkModule('Skate hold · '+(side<0?'port':'starboard')+' catwalk '+(i+1),[x,26,z],moduleScale,side<0?0:180).map(c=>({...c,grp:6})));
 }
 const gapZ=-187-3.5*(moduleLength-.18)-1.2;
 add({t:'rail',p:[x+side*1.6,27.05,gapZ],len:9,yaw:0,invisible:true,grp:6,nm:'Skate hold · rigging grind across the broken catwalk'});
 const railScale=9/(4*2.6);
 for(let j=0;j<4;j++)add({t:'decor',dkind:'crownmeshybeamhewn',p:[x+side*1.6,27.05,gapZ+4.5-j*2.25],s:DROWNED_CROWN_BOARD_MODELS.crownmeshybeamhewn.size.map(n=>n*railScale) as P,yaw:90,amp:-90,scenerySolid:false,grp:6,nm:'Original-proportion Meshy timber · rigging grind'});
 fruit([x,26,-186],[x,26,-229],8);fruit([x,26,-253],[x,26,-287],6);
 deck('Ship interior · rear catwalk landing',x,26,-302,7.6,8.75,6);
 timberRamp('Ship interior · return from the upper gallery',[x,26,-305],[x,16,-329],7.6,6);
 deck('Ship interior · rear gallery connection',side*34,16,-333,68,8.75,6);
 prop('crowncargostack',[x+side*2.7,26,-302],1.1,side*23);
}
add({t:'crystal',p:[64,27,-231],grp:6,nm:'Skate hold · starboard rigging jewel'});
add({t:'bonusplatform',p:[-64,26,-230],to:[-64,26.2,-223],grp:6,nm:'Skate hold · the captain’s ledger bonus'});
for(const side of [-1,1])for(const z of [-205,-265])add({t:'crate',p:[side*64,26,z],kind:z===-205?'mystery':'wood',grp:6,nm:'Rigging stores'});

// The low-skill exit returns to the gallery independently of bowl wall tricks.
// Meet the ramp at its crest; an earlier slab edge blocks the final ascent.
deck('Ship interior · return-ramp landing',0,16,-372.5,24,17.5,6);
fruit([0,0,-280],[0,0,-299],4);fruit([0,1,-304],[0,16,-365],10);
for(const side of [-1,1]){
 prop('crowncargostack',[side*9,16,-368],1.2,side*24);lamp([side*10,18,-366],1.25);
}
// Keep movement direction stable across the open room. Native skate surfaces
// provide their existing vert camera; framing volumes never change controls.
for(const z of [-65,-85,-112,-165,-230,-295,-365])add({t:'camnode',p:[0,z>-145?8:16,z],radius:5,grp:11,nm:'New ship interior · longitudinal movement spine'});
add({t:'camnode',p:[0,16,-164],s:[42,24,25],cameraView:true,cameraPresentationOnly:true,grp:12,
 cameraPosition:[0,24,-145],cameraTarget:[0,6,-200],cameraFollowDistance:16,cameraFollowTargetHeight:3,cameraFov:68,radius:3,nm:'Skate hold · reveal the giant bilge bowl'});
export const PIRATE_INTERIOR_COMPONENTS=C;
export const PIRATE_INTERIOR_ROUTE:P[]=[[4,8,-112],[4,8,-129],[0,8,-138],[0,16,-161],[0,16,-169],[0,0,-204],[0,0,-263],[0,0,-299],[0,16,-365]];
