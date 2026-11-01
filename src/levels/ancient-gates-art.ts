import type {CustomComponent,CustomLevelData} from '../level';
import {ANCIENT_NATIVE_SIZE,ANCIENT_CLIFF_CROWN} from '../ancientGatesAssetBounds';
import {ANCIENT_GATES_ASSETS} from '../ancientGatesAssets';

type P=[number,number,number];
type Kind=keyof typeof ANCIENT_NATIVE_SIZE;
type Deck={a:number;b:number;y:number;name:string};
const FLOOR=-32;
const random=(n:number)=>{const v=Math.sin(n*12.9898+7.13)*43758.5453;return v-Math.floor(v);};
const STONE=['#fff3dd','#f9e7cd','#efe4cd','#f2e9ce'];
const dimensions=(kind:Kind,height:number):P=>ANCIENT_NATIVE_SIZE[kind].map(v=>v*height/ANCIENT_NATIVE_SIZE[kind][1]) as P;

export const ANCIENT_GATES_ATMOSPHERE:CustomLevelData['atmosphere']={
 backdrop:'fog',fogEnabled:true,fogNear:48,fogFar:185,fogColor:'#477e79',
 ambientSky:'#c1e2da',ambientGround:'#997047',ambientIntensity:1.16,
 sunColor:'#ffe1a6',sunIntensity:2.05,sunDirection:[-.48,.8,.35],
 fillColor:'#9ac9dc',fillIntensity:.72,shadowStrength:.78,drawDistance:340,
};
export const ANCIENT_HOARD_ATMOSPHERE:CustomLevelData['atmosphere']={
 backdrop:'fog',fogEnabled:true,fogNear:35,fogFar:110,fogColor:'#254d50',
 ambientSky:'#aed9ca',ambientGround:'#967347',ambientIntensity:1.14,
 sunColor:'#ffdaa3',sunIntensity:1.7,sunDirection:[-.35,.8,.48],
 fillColor:'#70bec0',fillIntensity:.65,shadowStrength:.7,drawDistance:240,
};

function workshop(){
 const out:CustomComponent[]=[];
 // The kit loader normalizes each axis independently. Restore the measured
 // GLB dimensions here, then apply one scalar: no squeezed or stretched props.
 const prop=(kind:Kind,p:P,height:number,nm:string,color='#ffffff',yaw=0)=>{
  const s=dimensions(kind,height).map(v=>Math.round(v*1e6)/1e6) as P;
  const c:CustomComponent={t:'decor',dkind:kind,p:p.map(v=>Math.round(v*1000)/1000||0) as P,s,...(color==='#ffffff'?{}:{color}),...(yaw?{yaw}:{}),solid:false,scenerySolid:false,grp:90,nm};
  out.push(c);return c;
 };
 const widthProp=(kind:Kind,p:P,width:number,nm:string,color='#ffffff',yaw=0)=>
  prop(kind,p,width*ANCIENT_NATIVE_SIZE[kind][1]/ANCIENT_NATIVE_SIZE[kind][0],nm,color,yaw);
 const torch=(x:number,y:number,z:number,scale=.85)=>out.push({t:'torch',p:[x,y,z],rise:2.3,w:scale,grp:90,nm:'Grounded gatekeeper brazier'});
 const pier=(x:number,bottom:number,top:number,z:number,width=4.2,nm='Load-bearing tiki pier')=>{
  const ratio=ANCIENT_NATIVE_SIZE.ancienttikipier;
  const maxH=Math.min(10,width*ratio[1]/Math.max(ratio[0],ratio[2]));
  const count=Math.max(1,Math.ceil((top-bottom)/maxH));
  // Capitals and feet have a small mortar overlap, including the deck bearing.
  const h=(top-bottom)/(1+.97*(count-1));
  for(let i=0;i<count;i++)prop('ancienttikipier',[x,bottom+i*h*.97,z],h,`${nm} · tier ${i+1}`);
 };
 const gateway=(x:number,y:number,z:number,h:number,nm:string)=>{
  const s=dimensions('ancienttikigate',h);
  for(const side of [-1,1])for(const depth of [-.31,0,.31])
   pier(x+side*s[0]*.35,FLOOR,y+.15,z+depth*s[2],Math.min(4.4,s[0]*.24),`${nm} foundation`);
  prop('ancienttikigate',[x,y,z],h,nm);
 };
 const banks=(start:number,end:number,bonus=false)=>{
  const matte=bonus?'ancientgatehoard':'ancientgatevalley',native=ANCIENT_GATES_ASSETS[matte].size;
  const height=bonus?160:260,width=height*native[0]/native[1],step=width*.76;
  // Add depth behind the complete existing 3D scene. Image proportions stay
  // native; overlapping soft edges prevent a rectangular panorama boundary.
  for(let x=start,i=0;x<end+step;x+=step,i++)out.push({t:'decor',dkind:matte,
   p:[x,bonus?-100:-175,(bonus?-112:-210)-i%2*.2],s:[width,height,.02],
   solid:false,scenerySolid:false,grp:90,nm:'Distant painted jungle panorama'});
  for(let x=start,i=0;x<end;x+=32,i++){
   const h=bonus?32+random(i)*8:39+random(i)*14,z=bonus?-25:-34-random(i+2)*9;
   const rock=prop('ancientcanyonrock',[x,FLOOR-7,z],h,'Rooted sandstone canyon buttress','#ffffff',0);
   // Measured vertical intersection with the native rock, not its bounding-box
   // crown. The trunk's roots overlap that surface slightly to avoid air gaps.
   const rootY=rock.p[1]+h*ANCIENT_CLIFF_CROWN-2.5;
   prop('treehousemossrock',[x,rootY-2.4,z],4,'Embedded root-bearing moss plinth','#d6dfbb',0);
   prop(i%2?'trialsv2treeb':'trialsv2treea',[x,rootY,z],bonus?13+random(i+5)*3:17+random(i+5)*6,
    'Native-proportion Meshy tree rooted in canyon rock',i%2?'#e7efcb':'#d7ebcf',random(i+1)*360);
   if(i%2===0)prop('ancienttropicalplant',[x+.5,rootY-.15,z+1],3.5,'Rock-crown rooted tropical planting','#ffffff',i*37);
  }
  for(let x=start+38,i=0;x<end;x+=112,i++){
   prop('ancienttikishrine',[x,FLOOR-12,bonus?-52:-78],bonus?51:64+random(i+20)*15,
    'Grounded distant tiki shrine','#e6efdf',i%2?-12:9);
   if(!bonus)prop('ancientcanyonrock',[x+32,FLOOR-23,-110],75+random(i+30)*18,
    'Three-dimensional far canyon ridge','#b9d5c0',i%2?165:15);
  }
 };
 const deckDress=(d:Deck,index:number,wood=false,underpass=false,depthCenter=0)=>{
  const span=d.b-d.a,n=Math.ceil(span/3.2),tile=span/n;
  for(let k=0;k<n;k++){
   const x=d.a+(k+.5)*tile;
   for(const side of [-.5,.5])widthProp('stonepaver',[x,d.y-tile*.14+.08,depthCenter+side*tile],tile,
    `${d.name} paving`,STONE[(index+k)%4],index%2?180:0);
  }
  const fasciaCount=Math.ceil(span/4.2),step=span/fasciaCount;
  for(let k=0;k<fasciaCount;k++){
   const x=d.a+(k+.5)*step,kind=wood?'trialsv2beam':'stonecornice';
   const h=step*ANCIENT_NATIVE_SIZE[kind][1]/ANCIENT_NATIVE_SIZE[kind][0];
   widthProp(kind,[x,d.y-h-.12,depthCenter+2.85],step,`${d.name} fascia`,wood?'#efd1a1':STONE[(index+k)%4]);
   for(const side of [-1,1]){
    if(depthCenter!==0||(d.a===-24&&x<-10)||(side===-1&&x>1119&&x<1137))continue;
    widthProp('trialsv2beam',[x,d.y-.12,side*1.18],step,`${d.name} coping`,'#e8d4a5');
   }
  }
  const supports=Math.max(1,Math.ceil(span/10));
  for(let k=0;k<supports;k++){
   const x=d.a+(k+.5)*span/supports;
   pier(x,FLOOR,d.y-1.05,underpass?-5.4:depthCenter,Math.min(4.2,span/supports-.3),`${d.name} foundation`);
   if(underpass)widthProp('trialsv2beam',[x,d.y-1.25,-2.7],7,`${d.name} supported gallery cantilever`,'#e4bc88',90);
  }
  for(let x=d.a+3.2,j=0;x<d.b-2.5;x+=10,j++){
   prop('ancienttropicalplant',[x,d.y-.12,depthCenter-2.65],1.45,
    `${d.name} planting`,'#ffffff',j%2?12:-10);
   if((index+j)%3===0)prop('treehousemossrock',[x+1.6,d.y-.1,depthCenter-2.6],.62,
    `${d.name} moss stone`,'#dfe6bf',random(x)*360);
  }
 };
 return {out,prop,widthProp,pier,gateway,torch,banks,deckDress};
}

/** Only scenery changes. Authored collision, gaps, checkpoints and timings stay source-owned. */
export function dressAncientGates(source:CustomComponent[],decks:readonly Deck[]):CustomComponent[]{
 const {out,prop,widthProp,pier,gateway,torch,banks,deckDress}=workshop();
 const woodGroups=new Set([1,4,7,9]);
 for(const c of source){
  if(['spinbridge','mover','crumble','phasepad','ramp'].includes(c.t))c.dkind='trialsv2plank';
  if(c.t==='mesh'&&c.outline)c.dkind='stonepaver';
  if(['platform','ramp','mesh'].includes(c.t)){
   c.tex=woodGroups.has(c.grp??0)?'treehouse-timber':'crown-limestone';
   c.color=woodGroups.has(c.grp??0)?'#e6bf86':'#e5c797';
  }else if(c.t==='mover'||c.t==='spinbridge'||c.t==='crumble'){
   c.tex='bridge-timber';c.color=c.t==='crumble'?'#e8b16a':'#d7ac71';
  }else if(c.t==='crusher'){c.dkind='ancientcanyonrock';c.tex='crown-limestone';c.color='#ffffff';}
  else if(c.t==='pit')c.invisible=true;
 }
 decks.forEach((d,i)=>deckDress(d,i,woodGroups.has(source.find(c=>c.t==='platform'&&c.nm===d.name)?.grp??0)));
 // The optional side entrance has its own slab and structural bearing.
 deckDress({a:1119,b:1137,y:8,name:'Reliquary alcove'},0,false,false,-3.7);
 banks(-45,1480);
 for(const [x,y,z,h,name] of [
  [-17,-3,-18,14,'Root gatehouse'],[153,-1,-24,23,'Split timber gate'],
  [285,0,-19,24,'Mossback spiral portal'],[626,-7,-19,27,'Broken aqueduct near arch'],
  [679,-10,-22,30,'Broken aqueduct far arch'],[862,-1,-20,26,'Lantern fire-mouth portal'],
  [1083,-5,-20,26,'Sunken broken gateway'],[1128,3,-23,23,'Gatekeeper reliquary entrance'],
  [1160,-6,-22,26,'Sunken ferry watergate'],[1235,5,-25,31,'Crown ascent shrine gate'],
  [1376,8,-24,24,'The final Ancient Gate'],
 ] as const)gateway(x,y,z,h,name);
 // Native moving assemblies own their fitted winch frames and chains.
 for(const c of source.filter(c=>c.t==='pendulum')){
  pier(c.p[0],FLOOR,c.p[1]-.2,-5.5,2.4,'Wind-bell anchor tower');
  widthProp('trialsv2beam',[c.p[0],c.p[1]-.3,-2.7],7,'Supported wind-bell hanger','#e2bc8c',90);
 }
 for(const c of source.filter(c=>c.t==='ramp')){
  const yaw=(c.yaw??0)*Math.PI/180;
  for(const t of [0,.5,1]){
   const z=(.5-t)*(c.len??10);
   pier(c.p[0]+Math.sin(yaw)*z,FLOOR,c.p[1]+t*(c.rise??4)-.45,c.p[2]+Math.cos(yaw)*z,2.8,'Aqueduct kicker bearing');
  }
 }
 for(const c of source.filter(c=>c.t==='spinbridge'))pier(c.p[0],FLOOR,c.p[1]-.25,0,2.8,'Timber gate hinge foundation');
 for(const x of [0,105,221,343,456,589,709,835,945,1055,1181,1286,1365]){
  const d=decks.find(d=>x>=d.a&&x<=d.b);if(d)torch(x,d.y,-2.5);
 }
 prop('ancienttikishrine',[1410,FLOOR,-53],78,'Sanctuary beyond the final gate');
 return out;
}

export function dressAncientHoard(source:CustomComponent[]):CustomComponent[]{
 const {out,prop,gateway,torch,banks,deckDress}=workshop();
 for(const c of source){if(c.t==='mesh'){if(c.outline)c.dkind='stonepaver';c.tex='crown-limestone';c.color=c.outline?'#b6d8b2':'#d6c592';}else if(c.t==='pit')c.invisible=true;}
 const decks=source.filter(c=>c.t==='mesh'&&!c.outline&&c.s).map(c=>({a:c.p[0]-c.s![0]/2,b:c.p[0]+c.s![0]/2,y:c.p[1]+c.s![1]/2,name:c.nm??'Hoard gallery'}));
 decks.forEach((d,i)=>deckDress(d,i,false,d.y>2));
 banks(-35,280,true);
 for(const [x,y,h] of [[-8,-3,21],[91,-2,23],[143,-3,24],[197,-2,25]])gateway(x,y,-19,h,'Gatekeeper reliquary portal');
 for(const x of [-8,22,45,86,98,138,152,183,195])torch(x,0,-2.6);
 prop('ancienttikishrine',[201,FLOOR,-49],62,'Gatekeeper treasury shrine');
 return out;
}
