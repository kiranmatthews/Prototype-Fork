import type {CustomComponent, CustomGroup} from '../level';
import type {WaterfallLanding, WaterfallPoint} from './waterfall-climb';
import {CUSTARD_ASSETS} from '../custardAssets';
import {CARLISLE_ASSETS} from '../carlisleAssets';

type P=WaterfallPoint;
const assets={...CUSTARD_ASSETS,...CARLISLE_ASSETS};
type Prop=keyof typeof assets;
const stone='#eee7c9',cliff='#779b8c',water='#4dafa5';
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
     -crest*5+toe*9+.85*Math.sin(u*12+seed)+.35*Math.sin(row*.8+u*14));
    uv.push(u*width/9+.07*Math.sin(y*.23+u*7)+.025*Math.sin(y*.68+u*17),t*height/13+.5);
    if(row&&j<cols){const a=(row-1)*(cols+1)+j,b=row*(cols+1)+j;ix.push(a,b,a+1,a+1,b,b+1);}
   }
  }
  mesh(nm,p,v,ix,uv,'waterfall-cascade',seed%2?'#c4e5d4':'#dcf1de',101,{doubleSided:true});
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
 const arch=(nm:string,x:number,y:number,z:number,rx:number,ry:number,depth=3)=>{
  const v:number[]=[],ix:number[]=[],uv:number[]=[],n=28,t=1.6;
  for(let k=0;k<=n;k++)for(let j=0;j<4;j++){
   const angle=k/n*Math.PI,inside=j===1||j===2;
   v.push(Math.cos(angle)*(rx-(inside?t:0)),Math.sin(angle)*(ry-(inside?t:0)),j<2?depth/2:-depth/2);uv.push(k/n*rx/3,j%2*.5);
   if(k){const a=(k-1)*4+j,b=k*4+j,next=(j+1)%4;ix.push(a,(k-1)*4+next,b,b,(k-1)*4+next,k*4+next);}
  }
  for(const k of [0,n]){const b=k*4;ix.push(b,b+1,b+2,b,b+2,b+3);}
  mesh(nm,[x,y,z],v,ix,uv,'waterfall-basalt','#b2c3a5',100,{flatShading:true,doubleSided:true});
 };
 const buttress=(nm:string,p:P,w:number,d:number,rearZ:number,drop=16)=>{
  const [x,y,z]=p,front=z+d*.23,back=Math.min(z-d*.6-3,rearZ),fw=w*.42,bw=w*.60;
  const v=[-fw,-1.65,front-z,fw,-1.65,front-z,-bw,-2.2,back-z,bw,-2.2,back-z,
    -fw*.72,-3.6,front-z-.7,fw*.72,-3.6,front-z-.7,-bw*.85,-drop,back-z,bw*.85,-drop,back-z];
  const vertices:number[]=[],indices:number[]=[],uv:number[]=[];
  const faces=[[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]];
  for(const face of faces){
   const points=face.map(i=>v.slice(i*3,i*3+3)),ab=points[1].map((n,i)=>n-points[0][i]),ac=points[2].map((n,i)=>n-points[0][i]);
   const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],dropAxis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),axes=[0,1,2].filter(i=>i!==dropAxis),base=vertices.length/3;
   for(const p of points){vertices.push(...p);uv.push(p[axes[0]]/5,p[axes[1]]/5);}indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  mesh(nm,[x,y,z],vertices,indices,uv,'waterfall-basalt','#a8bb9f',100,{flatShading:true});
 };
 return {mesh,prop,box,pillar,sheet,foam,cascade,wheel,arch,buttress};
}

function surfaceLook(C:CustomComponent[]){
 for(let i=C.length-1;i>=0;i--)if(C[i].t==='mesh'&&C[i].nm?.startsWith('Greybox'))C.splice(i,1);
 for(const c of C){
  if(c.t==='mesh'&&c.solid!==false&&c.tex==='coast-bedrock'){c.tex='waterfall-basalt';c.color='#e3ead3';}
  if(c.t==='mesh'&&c.solid!==false&&c.tex==='wood'){c.tex='waterfall-bark';c.color='#c6d1ba';}
  if(c.t==='platform'){const timber=c.tex==='waterfall-timber';c.tex=timber?'waterfall-timber':'waterfall-basalt';c.color=timber?'#dfc994':stone;}
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
 // Water follows the authored terrain height without creating hidden support.
 const waterProfile=[[24,-1],[-100,-1],[-170,1.5],[-260,5.4],[-474,5.4],[-542,0],[-575,-1],[-612,.4],[-680,2],[-770,6.5],[-790,7.4],[-849,10],[-892,10.5],[-965,13.4],[-1040,10],[-1082,9.7]];
 const riverWater=(z:number)=>{for(let i=1;i<waterProfile.length;i++){const [az,ay]=waterProfile[i-1],[bz,by]=waterProfile[i];if(z>=bz){const t=Math.max(0,Math.min(1,(az-z)/(az-bz)));return ay+(by-ay)*t;}}return waterProfile[waterProfile.length-1][1];};
 // Each river chapter owns one connected, sloping water reach and rooted banks.
 const rivers=C.filter(c=>c.t==='pit'&&c.nm?.endsWith('river contact'));
 const mouthFlare=(z:number)=>70*Math.max(0,Math.min(1,(riverEnd+65-z)/65));
 for(const [chapter,pit]of rivers.entries()){
  const [x,y,z]=pit.p,depth=pit.s![2]+1;
  const waterVertices:number[]=[],waterIndices:number[]=[],waterUV:number[]=[],waterRows=Math.ceil(depth/7);
  for(let row=0;row<=waterRows;row++){const zz=z+depth/2-row/waterRows*depth;for(const xx of [-27,27]){waterVertices.push(xx,riverWater(zz),zz-z);waterUV.push((xx+27)/7,zz/7);}if(row){const k=(row-1)*2;waterIndices.push(k,k+3,k+1,k,k+2,k+3);}}
  a.mesh('Upstream river reach '+(chapter+1),[x,0,z],waterVertices,waterIndices,waterUV,'custard-water','#69bfc2',101,{doubleSided:true,materialStyle:'jungle-stream'});
  a.sheet('Submerged basalt riverbed '+(chapter+1),[x,y-1.7,z],58,depth,'waterfall-basalt','#527e6d');
  for(const side of [-1,1]){
   const v:number[]=[],ix:number[]=[],uv:number[]=[],rows=Math.ceil(depth/9);
   for(let row=0;row<=rows;row++)for(let j=0;j<5;j++){
    const q=row/rows,zz=z+depth/2-q*depth,wiggle=1.8*Math.sin(zz*.024+chapter)+.8*Math.sin(zz*.12);
    const xx=side*([14,19,27,40,64][j]+wiggle+mouthFlare(zz)),yy=riverWater(zz)+[-.3,1.8,3.5,6,13][j]+(j?1.1*Math.sin(zz*.035+j):0);
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
    a.prop('custardshoreboulder',[side*(26+hash(seed)*4+mouthFlare(zz)),riverWater(zz)+.5,zz],9+hash(seed+1)*5,seed,'Water-worn bank footing','#b6ceb1');
    a.prop('custardwillow',[treeX,rootHeight(treeX,zz-4),zz-4],17+hash(seed+4)*13,seed*3,'Willow roots embedded in the gorge bank');
    const reedX=side*(21+mouthFlare(zz+4));a.prop('coastfern',[reedX,rootHeight(reedX,zz+4),zz+4],2.5,seed*9,'Waterline fern rooted above the stream');
    a.prop('custardbankshrub',[side*(25+mouthFlare(zz+7)),rootHeight(side*(25+mouthFlare(zz+7)),zz+7),zz+7],6+hash(seed+6)*4,seed*7);
    if(station%58===0)a.prop('custardgorgecliff',[side*(55+mouthFlare(zz-8)),riverWater(zz-8)+7,zz-8],40+hash(seed+8)*13,side*24,'Outer gorge shoulder','#acc5a4');
   }
  }
 }
 // Shape only the undersides. The exact flat takeoff rims remain unobscured.
 for(const [i,pad]of landings.entries()){
  if(pad.kind!=='stone')continue;
  const [x,y,z]=pad.p,[w,d]=pad.size,river=pad.section<20;
  if(pad.section===20){a.pillar('Thunder basin foundation',[x,y-1.1,z],w*.98,d*.98,12,800);continue;}
  if(river){
   const bottom=Math.min(riverWater(z)-1.6,y-6.4);
   a.pillar('Eroded landing rooted into riverbed '+i,[x,y-1.12,z],w*.98,d*.97,y-1.12-bottom,i,'#83a282');
  }else if(pad.name==='Bell tower landing'){
   // Leave the aqueduct underpass open; this balcony bears on its end corbels.
   for(const side of [-1,1])a.buttress('Bell balcony end corbel',[x+side*(w/2+.2),y,z],2.5,d,faceZ-48,15);
  }else if(pad.name==='Counterweight upper dock')a.buttress('Upper dock right corbel',[x+4.5,y,z],3,d,faceZ-48,15);
  else if(pad.name==='Crown hinge refuge')a.buttress('Crown refuge right corbel',[x+2.7,y,z],2.3,d,faceZ-48,15);
  else a.buttress('Cliff-rooted carved landing '+i,[x,y,z],w,d,faceZ-48,pad.section===24?13:22);
  if(i%2===0&&d>5){
   a.prop('coastfern',[x+w*.32,y-.09,z-d*.34],river?1.8:1.6,i*31,'Fern rooted in the rear paving seam');
   if(river)a.prop('coastv2grass',[x-w*.42,y-.06,z+d*.2],1.7,i*19,'Low grass at the safe outer rim');
  }
  if(river&&i%4===0)a.foam('Current curling around the stone pier',[x,riverWater(z)+.04,z],w*.58,Math.min(d*.58,11));
 }
 // An irregular continuous rock mass anchors every layer; full Meshy strata
 // sit within it rather than forming detached rows of repeated blocks.
 const cliffV:number[]=[],cliffI:number[]=[],cliffUV:number[]=[],cols=68,rows=44;
 for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
  const x=-142+col/cols*284,t=row/rows,shoulder=Math.max(0,(Math.abs(x)-72)/70),top=summitY-1.8+shoulder*(18+8*Math.sin(x*.07)),y=-12+t*(top+12);
  const stream=[[-53,17],[-20,37],[20,13],[51,25]].some(([cx,w])=>Math.abs(x-cx)<w*.5+2);
  const strata=2.6*Math.sin(y*.19+x*.018)+1.5*Math.sin(y*.47+x*.045),grooves=2.8*Math.sin(x*.21)+1.1*Math.sin(x*.53+y*.05);
  const z=faceZ-(stream?56:42)+strata+grooves;
  cliffV.push(x,y,z);cliffUV.push(x/11,y/11);
  if(row&&col<cols){const a=(row-1)*(cols+1)+col,b=row*(cols+1)+col;cliffI.push(a,a+1,b,a+1,b+1,b);}
 }
 a.mesh('Continuous eroded basalt escarpment',[0,0,0],cliffV,cliffI,cliffUV,'waterfall-basalt','#8ca68f',100,{doubleSided:true,flatShading:true});
 for(const [i,x]of [-128,-94,-70,-42,2,32,78,111,137].entries()){
  const shoulder=Math.abs(x)>75,h=summitY+(shoulder?12+12*hash(i+900):-3),width=31+hash(i+22)*12;
  a.pillar('Deep continuous basalt spine '+i,[x,h,faceZ-78],width,58,h+20,i+900,'#779682');
  a.prop('custarderodedcliff',[x,h-10,faceZ-82],32+hash(i+3)*12,i*19,'Eroded summit crown embedded in the cliff','#b5c6b0');
  a.prop('custardwillow',[x,h+.4,faceZ-85],19+hash(i+18)*12,i*37,'Willows rooted on the summit skyline');
 }
 for(const side of [-1,1]){
  a.pillar('Rooted outer gorge buttress',[side*127,summitY+8,faceZ-42],48,64,summitY+22,side+819,'#8ba78f');
  for(let row=0;row<5;row++){
   const y=baseY-14+row*34,x=side*(118+hash(row+51)*8);
   a.prop('custarderodedcliff',[x,y,faceZ-41],64+hash(row)*12,side*(16+row*4),'Overlapping full Meshy weathered cliff shoulders','#b1c2a4');
   a.prop('custardclifffoliage',[x-side*12,y+23,faceZ-26],11+hash(row+5)*7,row*17,'Vegetation rooted in shoulder fissures');
  }
  a.prop('custarderodedcliff',[side*183,baseY-25,faceZ-91],180,side*22,'Distant rooted jungle gorge shoulder','#a6b69e');
  a.prop('custarderodedcliff',[side*180,baseY+37,faceZ-96],163,-side*14,'High overlapping waterfall escarpment','#b5c0a6');
 }
 for(const [i,x,w,top]of [[0,-53,17,summitY-1.2],[1,-20,37,summitY-.12],[2,20,13,summitY-3.5],[3,51,25,summitY-2.1]])
  a.cascade('Skywater falling curtain '+(i+1),[x,baseY-5.3,faceZ-44],w,top-baseY+5.3,i);
 a.sheet('Great plunge basin',[0,baseY-2.3,faceZ-16],180,100);
 for(const x of [-53,-20,20,51])a.foam('Skywater thunder impact',[x,baseY-2.24,faceZ-36],16,9);
 for(const [i,x,y]of [[0,-77,30],[1,-42,67],[2,6,39],[3,32,105],[4,76,87],[5,-75,118],[6,5,133],[7,77,145],[8,-42,151]]){
  a.prop('custardclifffoliage',[x,y,faceZ-39],8.5+hash(i+30)*4.5,i*29,'Greenery rooted in dry basalt fissures');
 }
 // Specific architecture explains each gameplay place; it is deliberately not
 // another stack of interchangeable supports across the whole waterfall.
 a.arch('Western gatehouse open arch',-25.5,20,faceZ-18,15.5,15.5,5);
 a.arch('Eastern gatehouse open arch',7.5,20,faceZ-18,17.5,15.5,5);
 for(const x of [-41,-10,25]){
  a.pillar('Gatehouse carved jamb',[x,35,faceZ-14],3.2,4,25,x+99,'#b3ba91');
  a.box('Gatehouse worn capital',[x,35.4,faceZ-14],[5.8,1,5],'waterfall-basalt','#b9c397');
 }
 a.box('Gatehouse broken lintel',[-6,36.5,faceZ-16],[75,1.8,6],'waterfall-basalt','#b8bd93');
 a.wheel(-12,39.4,faceZ-21,14.5,.3);
 for(const x of [-18.2,-5.8])a.box('Waterwheel lift guide',[x,39.4,faceZ-12],[.6,34,1.1],'waterfall-timber','#a98a58',103);
 a.box('Waterwheel overhead truss',[-12,56.8,faceZ-15],[19,1.4,5],'waterfall-timber','#cfb782',103);
 for(const [x,y,rx]of [[-13,39,14],[15,44,14],[43,51,14]])a.arch('Aqueduct tall load-bearing arch',x,y,faceZ-23,rx,13.2,3.5);
 for(const [x,y]of [[-27,52.2],[1,57.2],[29,64.2],[57,64.2]]){
  a.pillar('Aqueduct foundation pier',[x,y,faceZ-23],4.5,5.5,y-9,x+130,'#a4b38b');
  a.buttress('Aqueduct stone cantilever',[x,y+1,faceZ+5],6,5,faceZ-48,16);
 }
 for(const c of C.filter(c=>c.t==='trampoline')){
  a.wheel(c.p[0],c.p[1]+3.1,c.p[2]-8,2.7,c.p[1]);
  a.box('Bell drum rear bracket',[c.p[0],c.p[1]+.6,c.p[2]-7],[5,.8,4],'waterfall-timber','#d1ad6d',103);
 }
 for(const c of C.filter(c=>c.t==='mover'&&c.axis==='y'&&c.nm?.startsWith('Crown'))){
  for(const side of [-1,1])a.box('Upper counterweight guide',[c.p[0]+side*3.7,c.p[1],c.p[2]-2.5],[.45,(c.amp??4)*2+5,.6],'waterfall-timber','#cdb27d',103);
  a.wheel(c.p[0],c.p[1]+(c.amp??4)+2,c.p[2]-4,1.4,c.p[0]);
 }

 // Warm sluice mechanisms frame the cool water. Nothing is placed in a jump.
 for(const [i,b]of C.filter(c=>c.t==='spinbridge'&&c.p[2]>riverEnd).entries()){
  a.wheel(11.5,b.p[1]+3.3,b.p[2]-4.5,3.6,i*.47);
  a.box('Sluice wheel stone footing',[11.5,b.p[1]-2,b.p[2]-4.5],[4,9,3]);
 }
 a.box('Forest bank behind the river source',[0,summitY-3,faceZ-96],[170,10,18],'coast-bedrock','#8caa7b');
 a.sheet('The river source at the summit',[0,summitY-.15,faceZ-69],150,42);
 a.foam('Quiet source pool rim',[24,summitY-.08,faceZ-69],37,13);
 for(const x of [-55,-25,5,35,78])a.prop('custardshoreboulder',[x,summitY-.8,faceZ-91],13, x*5,'Source pool shoreline rock','#d0d9ad');
 a.buttress('Cliff-rooted summit garden',[84,summitY,faceZ-16],21,21,faceZ-68,25);
 a.pillar('Rooted summit garden',[84,summitY,faceZ-16],21,21,5,707,'#9bb997');
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
 a.sheet('Hidden spillway millpond',[84,-4.75,-7],240,42);
 a.sheet('Submerged treasury foundations',[84,-6.5,-7],245,43,'waterfall-basalt','#5c7f67');
 a.box('Recessed rear stone wall',[84,4,-17],[240,31,8],'waterfall-basalt','#648878');
 for(let x=-16;x<185;x+=18){
  a.pillar('Ancient spillway buttress',[x,18,-10],4.6,5.8,25,x+20,'#9bb79a');
  a.box('Spillway architrave',[x+8,16,-11],[15,2.1,6],'waterfall-basalt','#a8bea1');
  a.prop('custardclifffoliage',[x+4,15,-12],7.5,x*11,'Trailing ferns rooted above the spillway');
  a.cascade('Water glimpsed through the sluice arch',[x+9,-4.8,-10.8],8.5,18,x);
  a.foam('Sluice plunge foam',[x+9,-4.7,-5],6,3);
 }
 for(const [i,b]of C.filter(c=>c.t==='spinbridge').entries())a.wheel(b.p[0]+3.5,b.p[1]+5.6,-6,3.8,i*.5);
 a.box('High bell stone header',[39,12.8,-7],[8,1.5,4],'waterfall-basalt','#c6d1aa');
 a.prop('custardbankshrub',[173,6.5,-9],8,10,'Treasury garden behind the return gate');
}
