import * as THREE from 'three';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { PIRATE_PROPS } from './pirate-props.generated';
import { pirateMeshes, SEA, type P } from './pirate-meshes';
import { HARBOUR_SPAWN, HARBOUR_OCEAN, PIRATE_HARBOUR_COMPONENTS } from './pirate-harbour';
import { dressDrownedCrown } from './pirate-art';
import { stageDrownedReveal } from './pirate-reveal';
import { DROWNED_CAMERA } from './pirate-camera';
import { cutPiratePassage } from './pirate-clearance';
import { DROWNED_GROTTO_GROUND } from '../drownedCrownGrotto.generated';
import { DROWNED_VAULT_GROUND } from '../drownedCrownVault.generated';
import { DROWNED_SKYLIGHTS } from '../drownedCrownCanopy.generated';
import { DROWNED_CROWN_BOARD_MODELS } from '../drownedCrownBoards.generated';
import { pirateBoardwalkModule } from './pirate-boardwalk-modules';

const C:CustomComponent[]=PIRATE_HARBOUR_COMPONENTS.map(c=>c.t==='camnode'&&c.cameraView?{...c,grp:12}:c),M=pirateMeshes(C);
const groups:CustomGroup[]=['Smugglers tunnels','Moonpool cavern','The Drowned Crown · hull','Broken upper decks','Flooded cargo hold','Captains quarterdeck','Treasure passage','Port Royal · customs quay','Port Royal · broken cargo jetty','Port Royal · fort sea gate','Camera · movement spine','Camera · framing views'].map((nm,i)=>({id:i+1,nm,editorOnly:true}));
let grp=1;const section=(n:number)=>{grp=n;M.setGroup(n);};
const add=(c:CustomComponent)=>C.push({grp,...c});
function prop(kind:keyof typeof PIRATE_PROPS,p:P,size:number,yaw=0){
 for(const part of PIRATE_PROPS[kind])add({t:'mesh',p,s:[size,size,size],yaw,vertices:part.vertices,indices:part.indices,solid:false,doubleSided:true,color:part.color,tex:'solid',edgeGrinding:false,nm:`Meshy ${kind} · custom low-poly prop`});
}
function ribbonPoint(a:P,b:P,width:number,t:number,across:number,drop=0):P {
 const d=Math.hypot(b[0]-a[0],b[2]-a[2]),rx=-(b[2]-a[2])/d,rz=(b[0]-a[0])/d;
 const envelope=Math.sin(t*Math.PI),seed=a[0]*.11+a[2]*.039;
 const half=width*.5*(1+.075*envelope*Math.sin(t*Math.PI*2+seed));
 const drift=width*.025*envelope*Math.sin(t*Math.PI*1.4+seed);
 return[a[0]+(b[0]-a[0])*t+rx*(across*half+drift),a[1]+(b[1]-a[1])*t+drop,a[2]+(b[2]-a[2])*t+rz*(across*half+drift)];
}
function floor(name:string,a:P,b:P,width:number,color:string=SEA.stone,thickness=.75){
 if(grp===1&&/^(Excavated smugglers trail|Fissure (near|far) bank|Grotto branch)$/.test(name)){
  const narrow=name==='Grotto branch'?4.8:6.2,ts=[0,.22,.5,.78,1];
  add({t:'woodpath',p:a,pts:ts.map(t=>[(b[0]-a[0])*t,(b[2]-a[2])*t,0,(b[1]-a[1])*t]),w:narrow,
   widths:name==='Grotto branch'?[5.5,5.5,4.8,4.8,6]:[7.2,12,6.2,6.2,7.2],s:[narrow,.35,1],curve:'spline',
   structureStyle:'light',scaffold:true,supports:true,rails:false,supportBaseY:-13,supportDepth:9,terrainSupports:false,
   baySpacing:5.5,spacing:.78,plankPalette:'drowned-original-planks',polePalette:'rustic-timber-rope',nm:name});
  return;
 }

 // Stone paths are actual outcrops rooted below the tide, not floating slabs.
 if(color!==SEA.timber)thickness=Math.max(thickness,Math.max(a[1],b[1])+14);
 const d=Math.hypot(b[0]-a[0],b[2]-a[2]),steps=Math.max(3,Math.ceil(d/2.5)),v:number[]=[];
 for(let i=0;i<steps;i++){
  const t0=i/steps,t1=(i+1)/steps,p=(t:number,side:number,y=0)=>ribbonPoint(a,b,width,t,side,y);
  M.quad(v,p(t0,-1),p(t0,1),p(t1,1),p(t1,-1));
  M.quad(v,p(t0,-1,-thickness),p(t1,-1,-thickness),p(t1,1,-thickness),p(t0,1,-thickness));
  M.quad(v,p(t0,1),p(t0,1,-thickness),p(t1,1,-thickness),p(t1,1));
  M.quad(v,p(t1,-1),p(t1,-1,-thickness),p(t0,-1,-thickness),p(t0,-1));
 }
 M.quad(v,ribbonPoint(a,b,width,0,-1),ribbonPoint(a,b,width,0,-1,-thickness),ribbonPoint(a,b,width,0,1,-thickness),ribbonPoint(a,b,width,0,1));
 M.quad(v,ribbonPoint(a,b,width,1,-1),ribbonPoint(a,b,width,1,1),ribbonPoint(a,b,width,1,1,-thickness),ribbonPoint(a,b,width,1,-1,-thickness));
 M.mesh(name,v,color,true);
}
function planks(name:string,a:P,b:P,width:number,_spacing=1.7){
 const base=C.length;floor(name,a,b,width,SEA.timber,.32);
 // The authored outline remains the invisible walkable/grindable surface.
 // Every visible board below is an intact existing Meshy asset.
 for(const c of C.slice(base))c.artProxy=true;
 const d=Math.hypot(b[0]-a[0],b[2]-a[2]);
 const longitudinal=/deck|hold|room|margin|coaming|lip|gangway|hatch|ramp/i.test(name);
 const random=(seed:number)=>{const n=Math.sin(seed*127.1+a[0]*31.7+a[2]*73.3)*43758.5453;return n-Math.floor(n);};
 // Independently sized boards prevent a repeated cross-deck line of end grain.
 // Normal planks stay within about 1.4× the original Meshy length/width ratio.
 const seams=(length:number,seed:number)=>{
  const count=Math.max(1,Math.ceil(length/(3.7+random(seed)*.75)));
  const lengths=Array.from({length:count},(_,i)=>.83+random(seed+i*19.31)*.34);
  const total=lengths.reduce((sum,n)=>sum+n,0),out=[0];
  for(const n of lengths)out.push(out[out.length-1]+n/total*length);
  out[out.length-1]=length;return out;
 };
 const place=(from:P,to:P,boardWidth:number,seed:number,edge=false)=>{
  const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],length=Math.hypot(dx,dy,dz);
  // Original warm Meshy boards use a shallow placement envelope; varied
  // lengths and reversals break up the repeated edges without repainting them.
  const kind=edge&&length<2.05?'crownmeshyplanksplit':'crownmeshyplankchipped';
  const original=DROWNED_CROWN_BOARD_MODELS[kind].size,height=original[1]*boardWidth/original[2]*.5;
  let yaw=Math.atan2(-dz,dx),tilt=Math.atan2(dy,Math.hypot(dx,dz));
  const up=[-Math.cos(yaw)*Math.sin(tilt),Math.cos(tilt),Math.sin(yaw)*Math.sin(tilt)];
  if(random(seed+391)>.5){yaw+=Math.PI;tilt=-tilt;}
  const p=from.map((v,k)=>(v+to[k])*.5-up[k]*(height-.012)) as P;
  // A second existing plank below the joint closes cosmetic cracks without
  // adding a handmade backing sheet or changing the authored hatch openings.
  const below=p.map((v,k)=>v-up[k]*.085) as P;
  add({t:'decor',dkind:kind,p:below,s:[length+.035,height,boardWidth+.22],yaw:yaw*180/Math.PI+180,amp:-tilt*180/Math.PI,
   scenerySolid:false,nm:'Drowned Crown · existing Meshy underplank · '+name});
  add({t:'decor',dkind:kind,p,s:[length,height,boardWidth],yaw:yaw*180/Math.PI,amp:tilt*180/Math.PI,
   scenerySolid:false,nm:'Drowned Crown · existing Meshy deck board · '+name});
 };
 if(longitudinal){
  const columns=Math.ceil(width/.82);
  for(let col=0;col<columns;col++){
   const across=-1+(col+.5)*2/columns,cuts=seams(d,col*53.17+11);
   for(let row=0;row<cuts.length-1;row++){
    const lo=(cuts[row]+.008)/d,hi=(cuts[row+1]-.008)/d,t=(lo+hi)*.5;
    const left=ribbonPoint(a,b,width,t,-1+col*2/columns),right=ribbonPoint(a,b,width,t,-1+(col+1)*2/columns);
    place(ribbonPoint(a,b,width,lo,across),ribbonPoint(a,b,width,hi,across),Math.hypot(right[0]-left[0],right[2]-left[2])+.06,col*71+row*17,col===0||col===columns-1);
   }
  }
 }else{
  const rows=Math.ceil(d/.82);
  for(let row=0;row<rows;row++){
   const t=(row+.5)/rows,cuts=seams(width,row*53.17+37);
   for(let part=0;part<cuts.length-1;part++){
    const left=-1+(cuts[part]+.008)*2/width,right=-1+(cuts[part+1]-.008)*2/width;
    place(ribbonPoint(a,b,width,t,left),ribbonPoint(a,b,width,t,right),d/rows+.06,row*71+part*17,row===0||row===rows-1);
   }
  }
 }
}
function fruit(a:P,b:P,count=5){for(let i=0;i<count;i++){const t=i/(count-1);add({t:'wumpa',p:a.map((v,k)=>v+(b[k]-v)*t+(k===1?.9:0)) as P});}}
function checkpoint(p:P,nm:string){add({t:'checkpoint',p,nm});M.lantern([p[0]+3,p[1],p[2]]);}
function tunnel(a:P,b:P,width=13,height=13,openings:{start?:boolean;leftEnd?:boolean;right?:boolean;endFrame?:boolean}={}){
 const length=Math.hypot(b[0]-a[0],b[2]-a[2]),dx=(b[0]-a[0])/length,dz=(b[2]-a[2])/length,n=Math.ceil(length/4);
 {
  const count=Math.ceil(length/10),yaw=Math.atan2(-dx,-dz)*180/Math.PI;
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;
   for(const side of [-1,1]){
    if(openings.start||(openings.leftEnd&&side<0&&i===count-1)||(openings.right&&side>0))continue;
    add({t:'decor',dkind:(i+(side<0?1:0))%3===0?'trialsv2cavewallb':'trialsv2cavewalla',
    p:[x-dz*side*(width*.5+2.5),Math.min(-14,y-3),z+dx*side*(width*.5+2.5)],s:[length/count+4,y+height-Math.min(-14,y-3),7],yaw:yaw+(side<0?90:-90),
    color:'#aab6ca',scenerySolid:true,nm:'Sculpted mine wall with original atlas'});
   }
   add({t:'decor',dkind:i%2?'trialsv2caveroofb':'trialsv2caveroofa',p:[x,y+height-2.5,z],s:[width+10,6,length/count+4],yaw,
    color:'#a8b6ca',scenerySolid:true,nm:'Sculpted mine ceiling with original atlas'});
  }
 }

 for(let k=0;k<n;k++){
  const v:number[]=[];
  for(let j=0;j<7;j++){
   const pt=(s:number,i:number):P=>{const t=s/n,theta=i*Math.PI/7,flare=1+.075*Math.sin(s*2.3+i*1.7);return[a[0]+(b[0]-a[0])*t-dz*Math.cos(theta)*width*.5*flare,a[1]+(b[1]-a[1])*t+Math.sin(theta)*height*flare-.9,a[2]+(b[2]-a[2])*t+dx*Math.cos(theta)*width*.5*flare];};
   M.quad(v,pt(k,j),pt(k+1,j),pt(k+1,j+1),pt(k,j+1));
  }

  if((openings.endFrame?k===n-1:k%(grp===1?4:3)===0)&&!openings.start){const t=(k+.5)/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;
   if(grp===1)add({t:'decor',dkind:'crowncrashoakarch',p:[x,y-4,z],s:[width*.97,17,2.1],yaw:Math.atan2(-dx,-dz)*180/Math.PI,nm:'Salvaged oak mine arch'});
   else{
    M.beam('Old mine brace',[x-dz*width*.45,y,z+dx*width*.45],[x-dz*width*.45,y+8,z+dx*width*.45],.25);
    M.beam('Old mine brace',[x+dz*width*.45,y,z-dx*width*.45],[x+dz*width*.45,y+8,z-dx*width*.45],.25);
    M.beam('Mine lintel',[x-dz*width*.45,y+8,z+dx*width*.45],[x+dz*width*.45,y+8,z-dx*width*.45],.27);
   }
   M.lantern([x-dz*(width*.5-1),y+1,z+dx*(width*.5-1)]);
  }
 }
}
// Canonical assembly coordinates. The playable ship is staged separately by stageDrownedReveal.
export const PIRATE_ROUTE:P[]=[[-48,0,48],[-48,0,20],[-34,-3,-8],[-36,-6,-38],[-48,-6,-58],[-20,-6,-75],[0,8,-106],[0,8,-124],[-8,8,-134],[-8,-4,-162],[-8,-4,-181],[0,-4,-192],[8,-4,-204],[8,8,-237],[0,8,-246],[30,10,-269],[32,10,-288],[32,10,-320]];
export const PIRATE_WRECK_ID='drowned-crown';
// Main route is fully grounded apart from two deliberately small charged hops.
// Optional rigging, side vaults and quarterdeck rewards broaden the exploration.
section(1);
tunnel([-48,-3,74],PIRATE_ROUTE[0],13,13);
for(let i=1;i<6;i++){const a=PIRATE_ROUTE[i-1],b=PIRATE_ROUTE[i];
 if(i===5){
  fruit(a,[-48,-6,-74],4);fruit([-46,-6,-75],b,5);continue;
 }
 if(i===3){floor('Fissure near bank',a,[-34.8,-4.2,-20],12);floor('Fissure far bank',[-35.03,-4.55,-23.5],b,12);}
 else floor('Excavated smugglers trail',a,b,12);
 if(i<5)tunnel(a,b,13,13,i===3?{leftEnd:true}:{});fruit(a,b,4);}
// A supported salvage pier turns into a working landing before the wreck.
// Narrow spans and generous corners replace the empty stone apron.
// Four intact Meshy sections turn around the lookout; the existing low proxy
// closes the corner joint beneath the sampled original-mesh walking surfaces.
add({t:'woodpath',p:[-48,-6.7,-56],pts:[[0,0,0,0],[0,-20,0,0],[14,-20,0,0],[28,-19,0,0]],
 w:6.4,widths:[6.4,7,7,7],s:[6.4,.35,1],curve:'spline',artProxy:true,
 structureStyle:'beach',scaffold:false,supports:false,rails:false,
 plankPalette:'drowned-original-planks',nm:'Moonpool salvage landing · buried corner support'});
for(const [a,b,w] of [
 [[-48,-6,-56],[-48,-6,-66],6.8],
 [[-48,-6,-66],[-48,-6,-76],7.2],
 [[-48,-6,-76],[-34,-6,-76],7.2],
 [[-34,-6,-76],[-20,-6,-75],7.2],
] as [P,P,number][])for(const c of pirateBoardwalkModule('Moonpool salvage landing',b,a,w))add(c);
// Tidal fissure is a real missing floor: both banks meet the existing trail.
// Side passage offers a raised crystal grotto and rejoins before the ship.
export const PIRATE_GROTTO_ROUTE:P[]=[[-36,-6,-38],[-41,-6,-38.45],[-58,-4,-40]];
for(let i=1;i<PIRATE_GROTTO_ROUTE.length;i++){
 floor('Grotto branch',PIRATE_GROTTO_ROUTE[i-1],PIRATE_GROTTO_ROUTE[i],7);
 tunnel(PIRATE_GROTTO_ROUTE[i-1],PIRATE_GROTTO_ROUTE[i],9,12,{start:true});
}
C.push(DROWNED_GROTTO_GROUND);tunnel([-58,-4,-40],[-58,-4,-54],16,15,{endFrame:true});
add({t:'wall',p:[-58,-4,-54.5],s:[16,14,1],color:SEA.stone,tex:'stone',nm:'Crystal grotto · closed limestone back wall'});
for(const x of [-61.5,-54.5]){M.beam('Grotto lantern stake',[x,-4,-49.6],[x,-1.1,-49.6],.14);M.lantern([x,-2.8,-49.25]);}
add({t:'crate',p:[-58,-4,-50],kind:'life',nm:'Lost expedition cache'});
// Faceted quartz grows in unequal clusters; explicit face normals keep
// the mineral planes crisp under the existing lantern lighting.
const quartz=(p:P,height:number,radius:number,seed:number)=>{
 const v:number[]=[],colors:number[]=[],normals:number[]=[],palette=['#559fa7','#80ccd0','#316c82','#234657','#bbe0db','#447f91'];
 const point=(ring:number,j:number):P=>{
  const a=j*Math.PI/3+seed,h=[0,.16,.76,1][ring]*height,r=[.58,.88,.67,0][ring]*radius;
  return[p[0]+Math.cos(a)*r+h*.09*Math.sin(seed),p[1]+h,p[2]+Math.sin(a)*r+h*.07*Math.cos(seed)];
 };
 const face=(a:P,b:P,c:P,k:number)=>{
  const n=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a))).normalize();
  const color=new THREE.Color(palette[(k+Math.floor(seed*3))%palette.length]);
  for(const q of [a,b,c]){v.push(...q);normals.push(...n.toArray());colors.push(...color.toArray());}
 };
 for(let j=0;j<6;j++){
  for(let ring=0;ring<2;ring++){const a=point(ring,j),b=point(ring,(j+1)%6),c=point(ring+1,(j+1)%6),d=point(ring+1,j);face(a,b,c,j);face(a,c,d,j);}
  face(point(2,j),point(2,(j+1)%6),point(3,j),j);
 }
 add({t:'mesh',p:[0,0,0],vertices:v,indices:Array.from({length:v.length/3},(_,i)=>i),normals,colors,color:'#ffffff',tex:'solid',solid:false,doubleSided:true,nm:'Turquoise crystal cluster'});
};
for(let i=0;i<10;i++){
 const x=-58+(i%2?5:-5),z=-43-Math.floor(i/2)*2,seed=i*.73;
 quartz([x,-4,z],1.55+(i%3)*.36,.62,seed);
 quartz([x-.42,-4,z+.27],.68+(i%2)*.2,.29,seed+.8);
 quartz([x+.32,-4,z-.22],.91,.32,seed+1.7);
}

for(let i=0;i<22;i++){const z=42-i*3.9,t=Math.min(1,(48-z)/56),x=-48+14*t;M.rock('Tunnel edge rubble',[x+(i%2?5.5:-5.5),-t*3-.1,z],[.5+i%3*.2,.45,.7],i,SEA.pale);}
checkpoint([-48,-6,-68],'01 · Moonpool lookout');
M.barrel([-24,-6,-79]);M.barrel([-25,-6,-77],.8);
M.lantern([-44.9,-6,-70.7]);
section(2);
// A continuous enclosing skin prevents sky leaking between the dressed rock
// masses. Portals are deliberately cut out at the waterfront and vault exit.
const shell:number[]=[];
for(let z=48;z>-352;z-=20)for(let j=0;j<14;j++){
 const pt=(depth:number,k:number):P=>{
  const a=k*Math.PI/14,reach=Math.min(1,(48-depth)/160),h=53+Math.min(1,(48-depth)/180)*57;
  const variation=5*Math.pow(Math.sin((48-depth)/400*Math.PI),2)*Math.pow(Math.sin(a),2)*Math.sin(depth*.055+k*.8);
  return[Math.cos(a)*(Math.cos(a)>0?45+83*reach:66+62*reach),-11+Math.sin(a)*h+variation,depth];
 };
 M.quad(shell,pt(z,j),pt(z-20,j),pt(z-20,j+1),pt(z,j+1));
}
// The enclosure continues below the water so grazing reflected/refraction
// rays cannot see the exterior sky beneath a one-metre stone skirt.
for(let z=48;z>-352;z-=20){
 const right=(depth:number)=>45+83*Math.min(1,(48-depth)/160);
 M.quad(shell,[right(z),-22,z],[right(z-20),-22,z-20],[right(z-20),-11,z-20],[right(z),-11,z]);
 const left=(depth:number)=>-(66+62*Math.min(1,(48-depth)/160));
 M.quad(shell,[left(z),-11,z],[left(z-20),-11,z-20],[left(z-20),-22,z-20],[left(z),-22,z]);
}
M.mesh('Continuous limestone cavern enclosure',shell,'#354f58');
for(const [z,doorX,doorBottom,doorTop] of [[48,-48,-1,12],[-352,32,10,30]]){
 const face:number[]=[];
 const end=z===48?45:128;
 const xs=[...new Set([-128,-108,-90,-72,-54,-36,-18,0,18,36,54,72,90,108,end,doorX-8,doorX+8].filter(x=>x<=end))].sort((a,b)=>a-b);
 const top=(x:number)=>-11+Math.sqrt(Math.max(0,1-(x/(x>0?end:128))**2))*(z===48?53:110);
 for(let i=1;i<xs.length;i++){
  const a=xs[i-1],b=xs[i],door=a>=doorX-8&&b<=doorX+8,base=door?doorTop:-22;
  M.quad(face,[a,base,z],[b,base,z],[b,Math.max(base,top(b)),z],[a,Math.max(base,top(a)),z]);
  if(door)M.quad(face,[a,-22,z],[b,-22,z],[b,doorBottom,z],[a,doorBottom,z]);
 }
 M.mesh('Limestone headland with open portal',face,'#405a61');
}
// A 240 m chamber surrounds the 156 m wreck; all rocks are bespoke faceted meshes.
// The harbour's reflected sea continues below the wreck at the same waterline.
add({t:'pit',p:[0,-10.2,-132],s:[205,1,440],invisible:true,nm:'Cold bottomless moonpool'});
for(let side=-1;side<=1;side+=2)for(let i=0;i<22;i++){
 const z=50-i*19,x=side*(72+Math.sin(i*1.31)*10)+(side<0&&z>-85?-30:0),y=-9;
 if(side>0&&z>-80)continue;
 M.rock('Massive cavern cliff',[x,y+20,z],[18,33+8*Math.sin(i),17],i+side*2,i%3===0?'#52666b':'#344e59');
 M.rock('Cavern hanging stalactite',[x*.72,41,z],[4,13+i%5,5],i+3,SEA.stone);
}
for(let i=0;i<18;i++)M.rock('Moonpool stepping rubble',[-31+Math.sin(i*2)*9,-9,-82-i*8],[4,2.5,5],i,SEA.pale);
for(let i=0;i<14;i++)M.rock('Vaulted cavern ceiling',[Math.sin(i)*25,53,-75-i*17],[45,12,25],i,'#263c48');
// Reuse the shared feathered light-shaft material. Its edges and both ends
// fade smoothly, avoiding the old opaque rectangular strips across the ship.
for(const [x,z] of DROWNED_SKYLIGHTS)for(const yaw of [0,90])
 add({t:'decor',dkind:'treehousetrialssunshaft',p:[x,-8,z],s:[14,74,.02],amp:0,yaw,color:'#a6cde8',nm:'Soft light through the sea-cavern roof'});
planks('Salvaged boarding gangway',PIRATE_ROUTE[5],PIRATE_ROUTE[6],7,1.6);
for(const side of [-1,1])M.rope('Gangway hand rope',[-20+side*3.5,-4.9,-75],[side*3.5,9.1,-106],.5,.09);
section(3);
const rings=[[-92,7],[-103,15],[-120,19],[-142,20],[-155,19],[-176,18],[-197,17],[-222,13],[-244,5],[-252,0]];
for(let k=1;k<rings.length;k++){
 if(k===5)continue;
 const [za,wa]=rings[k-1],[zb,wb]=rings[k],steps=Math.max(2,Math.ceil((za-zb)/8));
 const shape=(y:number)=>.28+.72*Math.pow((y+9)/20.4,.6);
 const p=(t:number,side:number,y:number,offset=0):P=>[side*((wa+(wb-wa)*t)*shape(y)+offset),y,za+(zb-za)*t];
 for(const side of [-1,1]){
  for(let band=0;band<12;band++){
   if(side===-1&&(k===6||k===7)&&band>=2&&band<=5)continue;
   const v:number[]=[],y0=-9+band*1.7,y1=y0+1.67;
   for(let i=0;i<steps;i++){
    const a=i/steps,b=(i+1)/steps;
    M.quad(v,p(a,side,y0),p(b,side,y0),p(b,side,y1),p(a,side,y1));
    M.quad(v,p(a,side,y1),p(b,side,y1),p(b,side,y1,-.18),p(a,side,y1,-.18));
   }
   M.mesh('Hand-shaped broken galleon hull planking',v,band%2?'#69422f':'#805238');
  }
  for(const y of [5.2,10.7]){
   const v:number[]=[];
   for(let i=0;i<steps;i++){
    const a=i/steps,b=(i+1)/steps;
    M.quad(v,p(a,side,y-.13,.25),p(b,side,y-.13,.25),p(b,side,y+.13,.25),p(a,side,y+.13,.25));
    M.quad(v,p(a,side,y+.13,.25),p(b,side,y+.13,.25),p(b,side,y+.13),p(a,side,y+.13));
   }
   M.mesh('Blackened hull wale',v,SEA.dark);
  }
 }
}
// Splintered ribs expose the cross section at the catastrophic midship break.
for(const z of [-154,-177])for(let i=0;i<11;i++){
 const theta=i*Math.PI/10;M.beam('Exposed ship rib',[Math.cos(theta)*5,-9,z],[Math.cos(theta)*19,11-Math.sin(theta)*15,z+(i%2?2:-2)],.46,SEA.honey);
}
for(let z=-105;z>-243;z-=9)for(const side of [-1,1]){
 const k=Math.max(1,rings.findIndex((q,i)=>i>0&&z>=q[0])),a=rings[k-1],b=rings[k],t=(z-a[0])/(b[0]-a[0]),w=a[1]+(b[1]-a[1])*t;
 const points=[-8,-5,0,5,10.8].map(y=>new THREE.Vector3(side*(w*(.28+.72*Math.pow((y+9)/20.4,.6))-.36),y,z));
 M.geometry('Hull oak frame',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),8,.28,5,false),[0,0,0],[1,1,1],SEA.dark);
}
// Bowsprit and gilded prow: strong silhouette across the moonlit water.
M.beam('Long broken bowsprit',[0,10,-239],[0,17,-277],.8,SEA.timber,8);
M.rope('Bowsprit stay',[-9,10,-220],[0,17,-274],3,.12);M.rope('Bowsprit stay',[9,10,-220],[0,17,-274],3,.12);
M.rock('Carved golden sea serpent figurehead',[0,11,-253],[2,3,4],4,SEA.brass);
section(4);
// Deck pieces leave true open hatches over the descent and ascent ramps.
// The boarding ramp reaches the deck at -106. Keep the shattered stern open
// before that seam so the approach never passes through an overhead floor.
planks('Afterdeck',[0,8,-106],[0,8,-132],29);
planks('Shattered stern port margin',[-13,8,-95],[-13,8,-106],3);
planks('Shattered stern starboard margin',[9,8,-95],[9,8,-106],11);
planks('Port hatch coaming',[-16,8,-132],[-16,8,-155],5);
planks('Starboard main deck',[6,8,-132],[6,8,-154],24);
planks('Forward main deck',[0,8,-177],[0,8,-204],31);
planks('Forecastle port deck',[-7,8,-204],[-7,8,-237],17);
planks('Forecastle starboard lip',[14,8,-204],[14,8,-227],3);
planks('Bow hatch receiving deck',[4,8,-237],[4,8,-241],18);
planks('Narrow bow deck',[0,8,-241],[0,8,-248],10);
// A daring high shortcut uses a narrow fallen mast over the shattered hull.
planks('Fallen mast balance crossing',[5,8,-153],[5,8,-179],2.4,.85);
M.beam('Fallen mast splinter', [4,8,-157],[12,10,-169],.45,SEA.honey);
add({t:'rail',p:[5,8.35,-166],len:29,yaw:0,nm:'Fallen mast grind shortcut'});
for(const z of [-114,-194,-230]){
 const h=z===-194?51:z===-114?42:34;
 M.beam('Towering galleon mast',[0,8,z],[z===-194?-4:1,h,z-3],.78,SEA.timber,8);
 M.beam('Massive horizontal yard',[-17,h-8,z-2],[17,h-8,z-2],.42,SEA.honey);
 for(const side of [-1,1]){M.rope('Standing rigging',[side*14,9,z+9],[0,h-2,z-2],.65,.09);
  M.rope('Lower shroud',[side*14,9,z-8],[0,h-10,z-2],.4,.085);}
 // Ragged multi-panel sail with physically missing lower triangles.
 const v:number[]=[];
 for(let col=0;col<8;col++)for(let row=0;row<4;row++){
  if(row===3&&(col===0||col===3||col===6))continue;
  const pt=(x:number,y:number):P=>[-15+x*3.75,h-8-y*3.8+(y===4?(x%3)*1.1:0),z-2+Math.sin(x*Math.PI/8)*2.8+Math.sin(y*.8)];
  M.quad(v,pt(col,row),pt(col+1,row),pt(col+1,row+1),pt(col,row+1));
 }
 M.mesh('Torn ivory sail · missing cloth panels',v,SEA.sail);
 M.box('Crows nest basket',[0,h-13,z-1],[4.4,1.1,4.4],SEA.dark);
 for(const side of [-1,1])M.beam('Nest railing',[side*2,h-12,z-3],[side*2,h-12,z+1],.13,SEA.honey);
 add({t:'wall',p:[0,8,z],s:[1.4,h-8,1.4],invisible:true,nm:'Solid mast core'});
}
// Rail posts, gunports, coils and abandoned cargo make the deck read at human scale.
for(let z=-101;z>-238;z-=6){
 if(z<-152&&z>-179)continue;
 const w=z>-151?14.7:z>-214?15.5:11;
 for(const side of [-1,1]){
  M.beam('Broken bulwark post',[side*w,8,z],[side*w,10.3+(z%3)*.2,z],.19,SEA.honey);
  if(z%4)M.beam('Bulwark rail',[side*w,10.1,z],[side*w,10.1,z-4.8],.14,SEA.honey);
  const port:number[]=[],at=(y:number,dz:number):P=>{
   const zz=z+dz,k=Math.max(1,rings.findIndex((q,i)=>i>0&&zz>=q[0])),a=rings[k-1],b=rings[k],t=THREE.MathUtils.clamp((zz-a[0])/(b[0]-a[0]),0,1);
   const radius=(a[1]+(b[1]-a[1])*t)*(.28+.72*Math.pow((y+9)/20.4,.6));return[side*(radius+.045),y,zz];
  };
  M.quad(port,at(2.65,1.15),at(2.65,-1.15),at(4.35,-1.15),at(4.35,1.15));M.mesh('Black square gunport',port,SEA.dark);
 }
}
for(const p of [[-10,8,-120],[10,8,-124],[12,8,-187],[-11,8,-204],[-9,8,-220]] as P[]){M.barrel(p);M.barrel([p[0]+1.8,p[1],p[2]-1.3],.82);}
for(const p of [[11,8,-116],[-11,8,-127],[-10,8,-190],[11,8,-199]] as P[]){
 prop('cannon',p,3.4,p[0]>0?-90:90);
 add({t:'wall',p,s:[2.8,1.8,2.8],invisible:true,nm:'Solid cannon carriage'});
}
for(const p of [[4,8,-120],[-4,8,-144],[10,8,-189],[-6,8,-211]] as P[])M.lantern(p);
fruit([4,8,-109],[4,8,-127],6);
// Broad afterdeck footing gives the optional ledger room a deliberate jump
// entrance without placing its stone beneath the sloping hatch's overhang.
add({t:'bonusplatform',p:[-6,8,-121],to:[-3.5,8.1,-124],nm:'Afterdeck ledger bonus'});
checkpoint([-6,8,-129],'02 · The broken galleon');
// Suspended rope swing and grindable port rope reward leaving the central trail.
add({t:'rope',p:[-12,13,-165],len:31,yaw:0,amp:2,nm:'Port rigging treasure shortcut'});
add({t:'pendulum',p:[5,25,-167],len:16,amp:.62,speed:1.15,nm:'Swinging anchor over the high shortcut'});
add({t:'ropeswing',p:[-4,32,-163],len:17,amp:.35,speed:0,yaw:0,nm:'Loose mainmast halyard'});
section(5);
planks('Splintered hatch descent',[-8,8,-132],[-8,-4,-162],7,1.5);
planks('Keel bridge through wreck',[-8,-4,-162],[-8,-4,-181],6,1.2);
planks('Flooded lower cargo hold',[0,-4,-177],[0,-4,-209],24);
planks('Rising escape through bow hatch',[8,-4,-204],[8,8,-237],7,1.5);
// High deck is the ceiling; rib vaults are open and tall enough for the camera.
for(let z=-182;z>-208;z-=6){
 M.beam('Cargo hold deck beam',[-15,7,z],[15,7,z],.45,SEA.dark);
 for(const x of [-13,13]){M.beam('Cargo hold rib',[x,-4,z],[x,7,z],.34,SEA.timber);M.lantern([x,-2,z]);}
}
for(const p of [[-12,-4,-180],[-10,-4,-202],[12,-4,-187],[11,-4,-201]] as P[]){
 M.barrel(p,1.2);M.barrel([p[0]+1.4,p[1],p[2]+1.6]);
 M.box('Cargo chest',[p[0],p[1]+.75,p[2]-2],[2.2,1.5,1.5],SEA.timber);
}
add({t:'crate',p:[-4,-4,-185],kind:'wood',nm:'Salvage cargo'});
add({t:'crate',p:[3,-4,-195],kind:'mystery',nm:'Old smugglers provisions'});
add({t:'crate',p:[-9.5,-4,-195],kind:'mask',nm:'Hold guardian cache'});
add({t:'enemy',p:[-4,-4,-199],foe:'grunt',range:3,speed:.9,nm:'Hold scavenger'});
checkpoint([3,-4,-201],'03 · Below the waterline');
fruit([-8,-4,-165],[-8,-4,-180],4);fruit([1,-4,-184],[1,-4,-198],5);
// A side alcove holds the optional route crystal behind small stepping lids.
planks('Secret powder room landing',[-22,-4,-190],[-22,-4,-206],8);
planks('Powder room crosswalk',[-10.5,-4,-198],[-24,-4,-198],3);
add({t:'crystal',p:[-23,-3,-202],nm:'The Drowned Crown jewel'});
for(let i=0;i<4;i++)M.barrel([-24+i*1.7,-4,-205]);
M.lantern([-25,-3,-193]);
for(const z of [-193,-203])M.beam('Powder cache bearing post',[-25,-9,z],[-25,-4.2,z],.23,SEA.dark);
section(6);
planks('Quarterdeck stair ramp',[10,8,-126],[10,14,-104],6);
planks('Captains raised quarterdeck',[-3,14,-95],[-3,14,-108],16);
planks('Quarterdeck ramp receiving deck',[7,14,-95],[7,14,-104],10);
for(const z of [-108,-104])M.beam('Quarterdeck stair coaming post',[5,14,z],[5,15,z],.13,SEA.dark);
M.beam('Quarterdeck stair handrail',[5,15,-108],[5,15,-104],.11,SEA.honey);
// Tumblehome sides and a gently vaulted roof give the sterncastle a
// nautical silhouette. The open fore end keeps the stair entry clear.
const cabinSide=(side:number,y:number,z:number):P=>{
 const h=(y-14)/7.25,t=(z+104)/11;
 return[side*(9.2-.95*h+.18*Math.sin(t*Math.PI)),y,z+.18*Math.sin(h*Math.PI)];
};
for(const side of [-1,1])for(let row=0;row<14;row++){
 const y=14+row*.515,v:number[]=[];
 for(let i=0;i<4;i++){const za=-104+i*2.75,zb=za+2.75;M.quad(v,cabinSide(side,y,za),cabinSide(side,y,zb),cabinSide(side,y+.49,zb),cabinSide(side,y+.49,za));}
 M.mesh('Curved cabin side planking',v,row%2?SEA.timber:SEA.honey);
}
for(const side of [-1,1])M.beam('Cabin curved eave frame',[side*8.35,21.45,-104],[side*8.35,21.45,-93],.32,SEA.dark);
const transom:number[]=[];
for(let i=0;i<12;i++){
 const x0=-9+i*1.5,x1=x0+1.5,top=(x:number)=>21.1+1.5*(1-Math.pow(x/9,2));
 M.quad(transom,[x0,14,-93],[x1,14,-93],[x1,top(x1),-93],[x0,top(x0),-93]);
}
M.mesh('Curved captain transom backing',transom,SEA.timber);
for(const x of [-9,9])M.beam('Quarterdeck bearing strut',[x,8,-105],[x,14,-98],.45,SEA.dark);
const cabinRoof:number[]=[];
for(let i=0;i<20;i++)for(let j=0;j<4;j++){
 const pt=(col:number,row:number):P=>{
  const u=-1+col/10,z=-108+row*4.1;
  return[u*10.2,21+1.75*Math.cos(u*Math.PI/2)+.09*Math.sin(col*1.7),z+.28*Math.sin(col*.7)];
 };
 M.quad(cabinRoof,pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1));
}
M.mesh('Curved weathered cabin roof',cabinRoof,SEA.dark);
for(const side of [-1,1])for(const z of [-102,-96])M.beam('Gallery carved corbel',[side*8.6,14.2,z],[side*9.7,16,z],.19,SEA.honey);
for(const x of [-6,-3,0,3,6]){
 M.box('Golden stern window',[x,17.5,-92.6],[1.8,2.7,.12],SEA.brass);
 M.box('Stern window mullion',[x,17.5,-92.5],[.12,2.7,.14],SEA.dark);
}
M.box('Captains chart table',[0,15,-99],[5,.3,2.8],SEA.honey);
for(const x of [-2.1,2.1])for(const z of [-100,-98])M.beam('Chart table carved leg',[x,14,z],[x*.95,14.88,z],.13,SEA.dark);
M.beam('Chart table lower stretcher',[-2.1,14.26,-99],[2.1,14.26,-99],.1,SEA.dark);
M.box('Unrolled parchment',[0,15.2,-99],[3.8,.04,2.1],SEA.sail);
M.beam('Ships wheel pedestal',[-4,14,-107],[-4,16,-107],.2,SEA.dark);
for(let i=0;i<8;i++){const a=i*Math.PI/4;M.beam('Helm wheel spoke',[-4,16.5,-107],[-4+Math.cos(a)*1.4,16.5+Math.sin(a)*1.4,-107],.1,SEA.brass);}
add({t:'crate',p:[5,14,-98],kind:'life',nm:'Captains private stash'});
M.lantern([-7,15,-96]);M.lantern([7,15,-96]);
section(7);
planks('Bow escape landing',[0,8,-241],[6,8.4,-252],10);
planks('Rope bridge near bank',[6,8.4,-252],[16,9.05,-260],5.2,.9);
planks('Rope bridge far bank',[18.7,9.3,-262.2],[30,10,-271],5.2,.9);
const bridgeLength=Math.hypot(24,19),bridgeRight:[number,number]=[19/bridgeLength,24/bridgeLength];
for(const side of [-1,1]){
 const dx=bridgeRight[0]*side*2.85,dz=bridgeRight[1]*side*2.85;
 M.rope('Long escape bridge cable',[6+dx,10.1,-252+dz],[30+dx,11.7,-271+dz],.35,.12);
 for(const [x,y,z] of [[6,8.4,-252],[30,10,-271]])M.beam('Bridge anchoring post',[x+dx,y-.25,z+dz],[x+dx,y+2.1,z+dz],.25);
}
for(const [x,y,z] of [[6,8.4,-252],[30,10,-271]])M.beam('Bridge bearing crossbeam',[x-bridgeRight[0]*3.25,y-.35,z-bridgeRight[1]*3.25],[x+bridgeRight[0]*3.25,y-.35,z+bridgeRight[1]*3.25],.32,SEA.dark);
add({t:'woodpath',p:[30,10,-269],pts:[[0,0,0,0],[2,-19,0,0]],w:8,widths:[7.8,10],s:[8,.35,1],curve:'spline',structureStyle:'beach',scaffold:false,supports:false,rails:true,
 supportBaseY:-14,supportDepth:26,terrainSupports:false,baySpacing:5.5,spacing:.78,plankPalette:'drowned-original-planks',polePalette:'rustic-timber-rope',nm:'Timber landing at the treasure cavern'});
M.beam('Landing diagonal bearing',[26.6,-12,-273],[35.8,9.7,-283],.3,SEA.dark);
M.beam('Landing diagonal bearing',[34.2,-12,-273],[27.2,9.7,-283],.3,SEA.dark);
tunnel([31,10,-280],[32,10,-288],18,17,{start:true});
C.push(DROWNED_VAULT_GROUND);tunnel([32,10,-286],[32,10,-326],27,20);
checkpoint([32,10,-279],'04 · The kings ransom');
prop('skull-gate',[32,20,-288],17);
for(const x of [23,41]){M.rock('Skull portal stone pillar',[x,14,-288],[3,7,3],x,SEA.pale);add({t:'wall',p:[x,10,-288],s:[4,9,4],invisible:true,nm:'Skull arch pillar'});}
// Treasure dais is reachable by a broad shallow ramp and framed by gilded relics.

for(const side of [-1,1])for(let i=0;i<8;i++){
 const p:P=[32+side*(8+i%2*1.8),10.4,-290-i*4];M.rock('Piles of ancient gold',p,[2.6,.7,2.1],i,SEA.gold);
 for(let j=0;j<4;j++)M.rock('Loose treasure gemstones',[p[0]+Math.sin(j)*1.5,11.1,p[2]+Math.cos(j)*1.2],[.32,.4,.3],i+j,j%2?'#39aaa1':'#b14f55');
}
prop('treasure',[26.5,12,-311],3.8,25);
prop('treasure',[39,10,-294],3,200);
prop('treasure',[-22,-4,-204],2.6,-25);
prop('treasure',[4,14,-101],2.4,20);

M.lantern([23,11,-302]);M.lantern([41,11,-302]);
fruit([32,10,-287],[32,12,-308],8);
add({t:'crate',p:[36,12,-310],kind:'multihit',nm:'The last hoard'});
add({t:'gate',p:[32,12,-319],yaw:0,w:12,nm:'Claim the royal treasury'});
// Keep navigation through the ship separate from the camera's course axis.
for(const p of DROWNED_CAMERA)add({t:'camnode',p:[...p],radius:5,grp:11,nm:'Authored treasure trail camera'});
add({t:'camnode',p:[0,18,-100],s:[20,16,19],cameraView:true,cameraPresentationOnly:true,grp:12,yaw:180,cameraPosition:[3,18,-114],cameraTarget:[0,15.5,-97],cameraFollowDistance:6.8,cameraFollowTargetHeight:2,cameraFov:59,radius:2,nm:'Captain cabin · look into the chart room'});
add({t:'camnode',p:[-58,-3,-46],s:[17,13,23],cameraView:true,cameraPresentationOnly:true,grp:12,cameraPosition:[-58,0,-38.5],cameraTarget:[-58,-2,-47],cameraFollowDistance:5.2,cameraFollowTargetHeight:2,cameraFov:67,radius:2,nm:'Crystal grotto · close interior framing'});
add({t:'camnode',p:[-48,-6,-76],s:[22,20,16],cameraView:true,grp:12,cameraPosition:[-60,-1,-61],cameraTarget:[-48,1,-74],cameraFollowDistance:18,cameraFollowTargetHeight:7,cameraFov:66,radius:3,cameraPresentationOnly:true,nm:'Moonpool · reveal the full wreck from the port-side shelf'});
add({t:'camnode',p:[32,14,-307],s:[26,14,49],cameraView:true,cameraPresentationOnly:true,grp:12,cameraPosition:[32,16,-270],cameraTarget:[32,17,-295],cameraFollowDistance:10,cameraFollowTargetHeight:3.5,cameraFov:66,radius:5,nm:'Royal vault · crowned arch framing'});
// Broken structures now have visible load paths into stone, hull ribs or piles.
for(const side of [-1,1]){
 for(const t of [.15,.48,.8]){
  const x=-20+20*t+side*3.2,z=-75-31*t,y=-6+14*t;
  M.beam('Gangway support trestle',[x,-10,z],[x,y-.5,z],.32);
 }
 M.rock('Escape bridge anchored limestone',[30+side*6,6,-272],[6,5,7],side,SEA.stone);
 M.beam('Keel crossing bearing timber',[-8+side*2.7,-8,-164],[-8+side*2.7,-4.6,-176],.32);
}
// The hidden powder cache is a real cave opening beyond the shattered hull.
tunnel([-25,-4,-188],[-25,-4,-208],13,13,{right:true});
export const PIRATE_HATCH_PASSAGES=[
 {a:PIRATE_ROUTE[5],b:PIRATE_ROUTE[6],width:7,height:3.4},
 {a:PIRATE_ROUTE[12],b:PIRATE_ROUTE[13],width:7,height:3.4},
 {a:PIRATE_ROUTE[13],b:PIRATE_ROUTE[14],width:7,height:3.4},
];
export const PIRATE_GROTTO_PASSAGE={a:PIRATE_GROTTO_ROUTE[0],b:PIRATE_GROTTO_ROUTE[1],width:7,height:3.4};
const passageObstacles=new Set(['Hand-shaped broken galleon hull planking','Hull oak frame','Blackened hull wale','Afterdeck',
 'Forecastle port deck','Forecastle starboard lip','Bow hatch receiving deck']);
for(let i=C.length-1;i>=0;i--){
 const c=C[i];
 const passages=c.nm==='Faceted underground tunnel shell'?[PIRATE_GROTTO_PASSAGE]:
  (passageObstacles.has(c.nm??'')||c.nm?.startsWith('Fitted weathered deck boards'))?PIRATE_HATCH_PASSAGES:null;
 if(!passages)continue;
 let cut=c;for(const passage of passages)cut=cutPiratePassage(cut,passage.a,passage.b,passage.width,passage.height);
 if(cut.indices?.length===0)C.splice(i,1);else C[i]=cut;
}
export const PIRATE_WRECK_LEVEL:CustomLevelData={
 v:1,name:'The Drowned Crown',spawn:HARBOUR_SPAWN,killY:-18,sky:'pirate',ocean:{...HARBOUR_OCEAN,p:[480,-10,-362],length:2600,longitudinalSegments:240},keepPlayFog:true,cameraAirLift:.35,
 jungleDepthFade:false,jungleStyle:'painterly',
 cameraRig:{camDist:9.4,camHeight:4.8,camPitch:18,camFov:59},cameraLookAhead:5,
 medalTimes:{gold:210,silver:285,bronze:390},
 atmosphere:{profile:'drowned-crown',fogEnabled:true,fogNear:85,fogFar:400,fogColor:'#657d83',ambientSky:'#cedbed',ambientGround:'#8d8373',ambientIntensity:.8,sunColor:'#ffdfac',sunIntensity:2.9,sunDirection:[-.4,.54,.74],fillColor:'#b4d8e6',fillIntensity:.4,shadowStrength:.8,drawDistance:600,backdrop:'painted sky',fallbackTop:'#36546d',fallbackBottom:'#d5ac88',fallbackFog:'#657d83',fallbackStars:false,fallbackRidges:false},
 groups,components:stageDrownedReveal(dressDrownedCrown(C)),
};
