import type {CustomComponent, CustomGroup} from '../level';
import type {WaterfallLanding, WaterfallPoint} from './waterfall-climb';
import {CUSTARD_ASSETS} from '../custardAssets';
import {CARLISLE_ASSETS} from '../carlisleAssets';

type P=WaterfallPoint;
const assets={...CUSTARD_ASSETS,...CARLISLE_ASSETS};
type Prop=keyof typeof assets;
const stone='#c9d4bd',cliff='#779b8c',water='#4dafa5';
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

/** Source-owned, non-colliding scenery. The measured greybox stays authoritative. */
function kit(C:CustomComponent[]){
 const mesh=(nm:string,p:P,vertices:number[],indices:number[],uvs:number[],tex:string,color:string,
  grp=100,extra:Partial<CustomComponent>={})=>C.push({t:'mesh',p,vertices,indices,uvs,tex,color,
   solid:false,scenerySolid:false,edgeGrinding:false,castShadow:false,grp,nm,...extra});
 const prop=(dkind:Prop,p:P,width:number,yaw=0,nm='Rooted waterfall vegetation',color='#eef5dc')=>{
  const size=assets[dkind].size,k=width/size[0];
  C.push({t:'decor',dkind,p,s:size.map(v=>v*k) as P,yaw,solid:false,scenerySolid:false,castShadow:false,color,grp:102,nm});
 };
 const box=(nm:string,p:P,s:P,tex='waterfall-basalt',color=stone,grp=100)=>{
  const [x,y,z]=s.map(v=>v/2),v:number[]=[],i:number[]=[],uv:number[]=[];
  const faces=[[[x,-y,-z],[x,y,-z],[x,y,z],[x,-y,z]], [[-x,-y,z],[-x,y,z],[-x,y,-z],[-x,-y,-z]],
   [[-x,y,-z],[-x,y,z],[x,y,z],[x,y,-z]], [[-x,-y,z],[-x,-y,-z],[x,-y,-z],[x,-y,z]],
   [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]], [[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]]];
  for(const f of faces){const a=v.length/3;for(const q of f)v.push(...q);i.push(a,a+1,a+2,a,a+2,a+3);
   const aLen=Math.hypot(...f[1].map((n,k)=>n-f[0][k]))/4,bLen=Math.hypot(...f[3].map((n,k)=>n-f[0][k]))/4;
   uv.push(0,0,aLen,0,aLen,bLen,0,bLen);}
  mesh(nm,p,v,i,uv,tex,color,grp);
 };
 const pillar=(nm:string,p:P,w:number,d:number,h:number,seed:number,color=cliff)=>{
  const v:number[]=[],ix:number[]=[],uv:number[]=[],rings=5,n=10;
  for(let row=0;row<rings;row++)for(let j=0;j<=n;j++){
   const a=(j%n)/n*Math.PI*2,rough=.86+.15*hash(seed*17+j%n),f=row===0?.88:row===1?1:row===rings-1?.78:1.02;
   v.push(Math.cos(a)*w*.5*rough*f,-h*row/(rings-1),Math.sin(a)*d*.5*rough*f);uv.push(j/n*w/4,row*h/(rings-1)/4);
   if(row&&j<n){const k=(row-1)*(n+1)+j,b=row*(n+1)+j;ix.push(k,k+1,b,k+1,b+1,b);}
  }
  const top=v.length/3;v.push(0,0,0);uv.push(.5,.5);const bottom=v.length/3;v.push(0,-h,0);uv.push(.5,.5);
  for(let j=0;j<n;j++){ix.push(top,j+1,j);const k=(rings-1)*(n+1)+j;ix.push(bottom,k,k+1);}
  mesh(nm,p,v,ix,uv,'waterfall-basalt',color,100,{flatShading:true});
 };
 const sheet=(nm:string,p:P,w:number,d:number,tex='custard-water',color=water)=>mesh(nm,p,
  [-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2],[0,2,1,0,3,2],
  [0,0,w/7,0,w/7,d/7,0,d/7],tex,color,101,{doubleSided:true,opacity:.91,...tex==='custard-water'?{materialStyle:'jungle-stream' as const}:{}});
 const foam=(nm:string,p:P,rx:number,rz:number)=>{
  const v:number[]=[],ix:number[]=[],uv:number[]=[];
  for(let i=0;i<=48;i++)for(let j=0;j<3;j++){
   const a=i/48*Math.PI*2,r=1+j*.075+.025*Math.sin(a*7);
   v.push(Math.cos(a)*rx*r,0,Math.sin(a)*rz*r);uv.push(i/48,j/2);
   if(i&&j<2){const k=(i-1)*3+j,b=i*3+j;ix.push(k,k+1,b,k+1,b+1,b);}
  }
  mesh(nm,p,v,ix,uv,'custard-foam','#e4f5d8',101,{doubleSided:true,opacity:.72});
 };
 const cascade=(nm:string,p:P,width:number,height:number,seed:number)=>{
  const v:number[]=[],ix:number[]=[],uv:number[]=[],rows=26,cols=24;
  // Turn over a rounded lip, fall vertically, then flare into a plunge pool.
  for(let row=0;row<=rows;row++){
   const t=row/rows,y=height*(1-t),crest=Math.max(0,1-t*12),toe=Math.max(0,(t-.85)/.15);
   for(let j=0;j<=cols;j++){
    const u=j/cols,side=(u-.5)*2,spread=1+toe*.14;
    v.push(side*width*.5*spread+.35*Math.sin(row*.7+seed)*(side*side),y,
     -crest*5+toe*9+.42*Math.sin(u*12+seed)+.2*Math.sin(row*.8+u*14));
    uv.push(u*width/9+.022*Math.sin(y*.5+u*7),t*height/13+.5);
    if(row&&j<cols){const a=(row-1)*(cols+1)+j,b=row*(cols+1)+j;ix.push(a,b,a+1,a+1,b,b+1);}
   }
  }
  mesh(nm,p,v,ix,uv,'custard-cascade',seed%2?'#8ed1ce':'#a9dbd4',101,{doubleSided:true});
 };
 const wheel=(x:number,y:number,z:number,r:number,seed:number)=>{
  const v:number[]=[],ix:number[]=[],uv:number[]=[],n=36;
  for(let k=0;k<=n;k++)for(let j=0;j<4;j++){
   const a=k/n*Math.PI*2+seed,rad=r*(j===0||j===3?1:.78),zz=j<2?-.32:.32;
   v.push(Math.cos(a)*rad,Math.sin(a)*rad,zz);uv.push(k/n*r,j%2*.3);
   if(k){const b=(k-1)*4+j,q=k*4+j,next=(j+1)%4;ix.push(b,(k-1)*4+next,q,q,(k-1)*4+next,k*4+next);}
  }
  mesh('Carved sluice wheel',[x,y,z],v,ix,uv,'waterfall-timber','#e8cf91',103,{doubleSided:true});
  for(let a=0;a<6;a++){
   const q=a/6*Math.PI*2+seed,dx=Math.cos(q)*r*.75,dy=Math.sin(q)*r*.75;
   const span=Math.hypot(dx,dy),nx=-dy/span*.15,ny=dx/span*.15;
   mesh('Sluice wheel spoke',[x,y,z],[nx,ny,.08,-nx,-ny,.08,dx-nx,dy-ny,.08,dx+nx,dy+ny,.08],
    [0,1,2,0,2,3],[0,0,0,.1,span/3,.1,span/3,0],'waterfall-timber','#d5b77e',103,{doubleSided:true});
  }
  box('Stone wheel spindle',[x,y,z+.1],[.72,.72,1.5],'waterfall-basalt','#b8d0ba',103);
 };
 return {mesh,prop,box,pillar,sheet,foam,cascade,wheel};
}

function surfaceLook(C:CustomComponent[]){
 for(let i=C.length-1;i>=0;i--)if(C[i].t==='mesh'&&C[i].nm?.startsWith('Greybox'))C.splice(i,1);
 for(const c of C){
  if(c.t==='platform'){c.tex='waterfall-basalt';c.color=stone;}
  if(c.t==='crumble'){c.tex='waterfall-basalt';c.color='#d4a777';}
  if(c.t==='spinbridge'){c.tex='waterfall-timber';c.color='#f0dfbf';}
 }
}

export function dressWaterfallClimb(C:CustomComponent[],groups:CustomGroup[],o:{landings:WaterfallLanding[];riverEnd:number;baseY:number;faceZ:number;summitY:number}){
 surfaceLook(C);const a=kit(C),{landings,riverEnd,baseY,faceZ,summitY}=o;
 groups.push({id:100,nm:'Carved basalt gorge and cantilevered ruins',editorOnly:true},
  {id:101,nm:'Living river, waterfall curtains and impact foam',editorOnly:true},
  {id:102,nm:'Existing Meshy willows, ferns and shoreline stones',editorOnly:true},
  {id:103,nm:'Riverkeeper sluice mechanisms',editorOnly:true});
 // Each river chapter owns a continuous lower water reach and natural banks.
 const rivers=C.filter(c=>c.t==='pit'&&c.nm?.endsWith('river contact'));
 const mouthFlare=(z:number)=>70*Math.max(0,Math.min(1,(riverEnd+65-z)/65));
 for(const [chapter,pit]of rivers.entries()){
  const [x,y,z]=pit.p,depth=pit.s![2]+1;
  a.sheet('Upstream river reach '+(chapter+1),[x,y+.18,z],54,depth);
  a.sheet('Submerged basalt riverbed '+(chapter+1),[x,y-1.7,z],58,depth,'waterfall-basalt','#527e6d');
  for(const side of [-1,1]){
   const v:number[]=[],ix:number[]=[],uv:number[]=[],rows=Math.ceil(depth/9);
   for(let row=0;row<=rows;row++)for(let j=0;j<5;j++){
    const q=row/rows,zz=z+depth/2-q*depth,wiggle=1.8*Math.sin(zz*.024+chapter)+.8*Math.sin(zz*.12);
    const xx=side*([14,19,27,40,64][j]+wiggle+mouthFlare(zz)),yy=y+[-.3,2.8,6,9,18][j]+(j?1.1*Math.sin(zz*.035+j):0);
    v.push(xx-x,yy-y,zz-z);uv.push(xx/7,zz/7);
    if(row&&j<4){const k=(row-1)*5+j,b=row*5+j;ix.push(k,b,k+1,k+1,b,b+1);}
   }
   a.mesh('Layered river bank '+chapter+' '+side,[x,y,z],v,ix,uv,'coast-bedrock','#7f9c77',100,{doubleSided:true});
   const rootHeight=(px:number,pz:number)=>{
    for(let k=0;k<ix.length;k+=3){
     const q=ix.slice(k,k+3).map(i=>v.slice(i*3,i*3+3)),[a,b,c]=q,xx=px-x,zz=pz-z;
     const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
     if(Math.abs(den)<1e-9)continue;
     const u=((b[2]-c[2])*(xx-c[0])+(c[0]-b[0])*(zz-c[2]))/den;
     const w=((c[2]-a[2])*(xx-c[0])+(a[0]-c[0])*(zz-c[2]))/den,third=1-u-w;
     if(Math.min(u,w,third)>=-1e-6)return y+u*a[1]+w*b[1]+third*c[1]-.14;
    }
    return y+7;
   };
   for(let station=0;station<depth-12;station+=29){
    const zz=z+depth/2-station-8,seed=chapter*19+station+side*3,treeX=side*(31+hash(seed+3)*10+mouthFlare(zz-4));
    a.prop('custardshoreboulder',[side*(19+hash(seed)*4+mouthFlare(zz)),y+.5,zz],9+hash(seed+1)*5,seed,'Water-worn bank footing','#b6ceb1');
    a.prop('custardwillow',[treeX,rootHeight(treeX,zz-4),zz-4],17+hash(seed+4)*13,seed*3,'Willow roots embedded in the gorge bank');
    a.prop('custardbankshrub',[side*(25+mouthFlare(zz+7)),rootHeight(side*(25+mouthFlare(zz+7)),zz+7),zz+7],6+hash(seed+6)*4,seed*7);
    if(station%58===0)a.prop('custardgorgecliff',[side*(55+mouthFlare(zz-8)),y+7,zz-8],40+hash(seed+8)*13,side*24,'Outer gorge shoulder','#acc5a4');
   }
  }
 }
 for(let i=1;i<rivers.length;i++){
  const low=rivers[i-1],high=rivers[i],rise=high.p[1]-low.p[1];
  if(rise>.5)a.cascade('Rapids joining river reaches '+i,[0,low.p[1]+.18,high.p[2]+high.s![2]/2],48,rise,i+10);
 }
 // Shape only the undersides. The exact flat takeoff rims remain unobscured.
 for(const [i,pad]of landings.entries()){
  if(pad.kind!=='stone')continue;
  const [x,y,z]=pad.p,[w,d]=pad.size,river=pad.section<20;
  if(pad.section===20){a.pillar('Thunder basin foundation',[x,y-1.1,z],w*.98,d*.98,12,800);continue;}
  if(!/turning step 3|return balcony/.test(pad.name))
   a.pillar('Eroded landing underside '+i,[x,y-1.12,z],w*.98,d*.97,river?5.2:3.5+(i%3)*.7,i,river?'#83a282':'#7d9a87');
  if(!river&&pad.section<40)a.box('Stone cantilever into the waterfall face',[x,y-2.2,z-10.5],[Math.min(w*.52,4.5),1.2,21],'waterfall-basalt','#648678');
  if(i%2===0&&d>5){
   a.prop('coastfern',[x+w*.32,y-.09,z-d*.34],river?1.8:1.6,i*31,'Fern rooted in the rear paving seam');
   if(river)a.prop('coastv2grass',[x-w*.42,y-.06,z+d*.2],1.7,i*19,'Low grass at the safe outer rim');
  }
  if(river&&i%4===0)a.foam('Current curling around the stone pier',[x,y-4.77,z],w*.58,Math.min(d*.58,11));
 }
 // The whole face is a vertical composition, not a stack of distant billboards.
 for(let i=0;i<13;i++){
  const x=-108+i*18,shoulder=Math.abs(x)>68,h=summitY+(shoulder?16+9*hash(i+900):-2-2*hash(i+900)),width=25+hash(i+22)*9;
  a.pillar('Full-height basalt cliff column '+i,[x,h,faceZ-44-hash(i+33)*7],width,55,h+18,i+900,'#5d8377');
  a.prop('custardgorgecliff',[x,h-12,faceZ-42],28+hash(i+3)*12,i*19,'Weathered summit crown','#9ab59a');
  a.prop('custardwillow',[x,shoulder?h-.14:summitY+1.86,shoulder?faceZ-45:faceZ-66],18+hash(i+18)*14,i*37,'Trees rooted above the waterfall crown');
 }
 for(const [i,x,w,top]of [[0,-43,40,summitY-1.2],[1,-2,46,summitY-.12],[2,42,39,summitY-2.5]])
  a.cascade('Skywater falling curtain '+(i+1),[x,baseY-5.3,faceZ-11],w,top-baseY+5.3,i);
 a.sheet('Great plunge basin',[0,baseY-5.1,faceZ+16],160,72);
 for(const x of [-42,0,40])a.foam('Skywater thunder impact',[x,baseY-5.04,faceZ],20,10);
 a.prop('custardfallmist',[0,baseY-4,faceZ-8],110,0,'Fine spray rising behind the climbing route','#d4f2e2');
 for(const side of [-1,1])for(let row=0;row<9;row++){
  const y=baseY+row*17.5+10,x=side*(72+4*hash(row+51));
  a.prop('custardboulder',[x,y-5,faceZ-18],12+hash(row)*5,row*23,'Mossy cliff shoulder','#a7c9ae');
  a.prop('custardclifffoliage',[x,y+3,faceZ-20],10+hash(row+5)*5,row*17,'Trailing vegetation on the waterfall shoulders');
 }
 // Warm sluice mechanisms frame the cool water. Nothing is placed in a jump.
 for(const [i,b]of C.filter(c=>c.t==='spinbridge'&&c.p[2]>riverEnd).entries()){
  a.wheel(11.5,b.p[1]+3.3,b.p[2]-4.5,3.6,i*.47);
  a.box('Sluice wheel stone footing',[11.5,b.p[1]-2,b.p[2]-4.5],[4,9,3]);
 }
 a.box('Forest bank behind the river source',[0,summitY-3,faceZ-66],[170,10,18],'coast-bedrock','#8caa7b');
 a.sheet('The river source at the summit',[0,summitY-.15,faceZ-33],150,42);
 a.foam('Quiet source pool rim',[24,summitY-.08,faceZ-30],37,13);
 for(const x of [-55,-25,5,35,78])a.prop('custardshoreboulder',[x,summitY-.8,faceZ-56],13, x*5,'Source pool shoreline rock','#d0d9ad');
 a.pillar('Rooted summit garden',[84,summitY,faceZ-16],21,21,9,707,'#9bb997');
 a.prop('custardwillow',[84,summitY-.2,faceZ-16],22,35,'Summit tree framing the finish');
 for(const x of [54,71]){
  a.pillar('Summit ceremonial column',[x,summitY+8,faceZ-7],2.8,2.8,9,x,'#c2ccb0');
  a.box('Summit carved capital',[x,summitY+8,faceZ-7],[4.4,.8,4.4]);
 }
 a.box('Skywater crown lintel',[62.5,summitY+8.8,faceZ-7],[21,1.2,3.4],'waterfall-basalt','#cbd4b8');
}

export function dressWaterfallBonus(C:CustomComponent[]){
 surfaceLook(C);const a=kit(C);
 const decks=C.filter(c=>c.t==='platform'&&!c.outline);
 for(const [i,c]of decks.entries()){
  const top=c.p[1]+c.s![1]/2;a.pillar('Spillway island foundation',[c.p[0],top-1.1,0],c.s![0],5.8,9,i+100,'#789a85');
  for(let x=c.p[0]-c.s![0]/2+2;x<c.p[0]+c.s![0]/2;x+=7)a.prop('coastfern',[x,top-.1,-2.6],1.7,x*13,'Fern at the spillway rear seam');
 }
 a.sheet('Hidden spillway millpond',[67,-4.75,-7],210,42);
 a.sheet('Submerged treasury foundations',[67,-6.5,-7],215,43,'waterfall-basalt','#5c7f67');
 a.box('Recessed rear stone wall',[68,4,-17],[205,31,8],'waterfall-basalt','#648878');
 for(let x=-16;x<161;x+=18){
  a.pillar('Ancient spillway buttress',[x,18,-10],4.6,5.8,25,x+20,'#9bb79a');
  a.box('Spillway architrave',[x+8,16,-11],[15,2.1,6],'waterfall-basalt','#a8bea1');
  a.prop('custardclifffoliage',[x+4,15,-12],7.5,x*11,'Trailing ferns rooted above the spillway');
  a.cascade('Water glimpsed through the sluice arch',[x+9,-4.8,-10.8],8.5,18,x);
  a.foam('Sluice plunge foam',[x+9,-4.7,-5],6,3);
 }
 for(const [i,b]of C.filter(c=>c.t==='spinbridge').entries())a.wheel(b.p[0]+3.5,b.p[1]+5.6,-6,3.8,i*.5);
 a.box('High bell stone header',[39,12.8,-7],[8,1.5,4],'waterfall-basalt','#c6d1aa');
 a.prop('custardbankshrub',[146,5.1,-9],8,10,'Treasury garden behind the return gate');
}
