import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';
import { type Point, COUNTRY_CLUB_HOLES as holes, COUNTRY_CLUB_LENGTH as length,
  COUNTRY_CLUB_GAPS as gaps, COUNTRY_CLUB_PONDS as ponds, COUNTRY_CLUB_PADS as pads,
  COUNTRY_CLUB_ENCOUNTERS as encounters, COUNTRY_CLUB_SLALOM as bunkers,
  COUNTRY_CLUB_WATER_RAILS as waterRails, COUNTRY_CLUB_RIDGE as ridge,
  COUNTRY_CLUB_BOUNDS as bounds, COUNTRY_CLUB_SAND_SPEED,
  countryClubPoint as point, countryClubFrame as frame, countryClubWidth as width,
  countryClubGroundHeight as ground, countryClubBunkerAt as bunkerAt,
  countryClubRacingOffset as racingOffset, countryClubRailPoint as railPoint,
} from './country-club-layout';
export * from './country-club-layout';

const C:CustomComponent[]=[],round=(v:number)=>Math.round(v*1000)/1000;
const pal={fairway:'#87998c',green:'#a8bda0',sand:'#b6b09e',bunker:'#d4cbb5',edge:'#e8e8db',water:'#64888c',dark:'#46574e',stone:'#8a918a'};
function mesh(name:string,v:number[],indices:number[],color:string,solid=true,grp=1,extra:Partial<CustomComponent>={}){
  if(!indices.length)return;
  C.push({t:'mesh',p:[0,0,0],vertices:v.map(round),indices,tex:'solid',color,solid,vert:false,grp,nm:name,
    ...(solid?{}:{edgeGrinding:false}),...extra});
}
function box(name:string,p:Point,s:Point,color=pal.stone,yaw=0,grp=9){C.push({t:'platform',p:p.map(round) as Point,s,color,tex:'solid',yaw,grp,nm:name});}
function surfaceMesh(name:string,v:number[],indices:number[],colors:number[],solid=true,grp=1,extra:Partial<CustomComponent>={}){
  // Each triangle partition stores only its own vertices.
  const map=new Map<number,number>(),vv:number[]=[],cc:number[]=[],ii:number[]=[];
  for(const old of indices){if(!map.has(old)){map.set(old,map.size);vv.push(...v.slice(old*3,old*3+3));cc.push(...colors.slice(old*3,old*3+3));}ii.push(map.get(old)!);}
  mesh(name,vv,ii,'#ffffff',solid,grp,{colors:cc.map(round),...extra});
}
const colorBase=new THREE.Color(pal.fairway),colorGreen=new THREE.Color(pal.green),colorSand=new THREE.Color(pal.bunker);
function greenBlend(s:number,u:number){
  let best=0;
  for(const h of holes){
    const x=(s-h.green)/h.greenLength;
    let shift=h.side*3,span=h.greenWidth*.40,exponent=2;
    if(h.shape==='kidney'||h.shape==='comma')shift+=h.side*4*Math.sin(x*1.6);
    if(h.shape==='crescent')shift+=h.side*(3-6*x*x);
    if(h.shape==='fan'||h.shape==='pear')span*=1+.27*x;
    if(h.shape==='diamond')exponent=1.25;
    if(h.shape==='square'||h.shape==='terrace')exponent=4;
    if(h.shape==='hourglass'||h.shape==='double')span*=.65+.55*Math.abs(Math.sin(x*2));
    if(h.shape==='split')shift+=4*Math.sin(x*3);
    if(h.shape==='ribbon'||h.shape==='spindle')span*=.7;
    if(h.shape==='crown')span*=.87+.13*Math.cos(x*7);
    const d=Math.abs(x)**exponent+Math.abs((u-shift)/span)**exponent;
    best=Math.max(best,THREE.MathUtils.smoothstep(1-d,-.08,.1));
  }
  return best;
}
const step=8,tile=96,heights=new Map<string,number>();
const cachedGround=(x:number,z:number)=>{const k=`${x}:${z}`;if(!heights.has(k))heights.set(k,ground(x,z));return heights.get(k)!;};
for(let x=bounds.minX;x<bounds.maxX;x+=tile)for(let z=bounds.minZ;z<bounds.maxZ;z+=tile){
  const spanX=Math.min(bounds.maxX,x+tile)-x,spanZ=Math.min(bounds.maxZ,z+tile)-z,nx=Math.ceil(spanX/step),nz=Math.ceil(spanZ/step),v:number[]=[],ind:number[]=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const xx=x+i*spanX/nx,zz=z+j*spanZ/nz;v.push(xx,cachedGround(xx,zz),zz);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,c=a+nx+1;ind.push(a,c,a+1,a+1,c,c+1);}
  mesh('Landscape / rolling deep sand',v,ind,pal.sand,true,10,{groundSpeedLimit:COUNTRY_CLUB_SAND_SPEED,edgeGrinding:false});
}
function road(a:number,b:number){
  const columns=Array.from({length:17},(_,i)=>i/8-1);
  for(let from=a;from<b-.001;from+=54){
    const to=Math.min(b,from+54),count=Math.ceil((to-from)/2),v:number[]=[],colors:number[]=[],fast:number[]=[],sand:number[]=[];
    for(let i=0;i<=count;i++){
      const s=from+(to-from)*i/count;
      for(const c of columns){const u=c*width(s)/2;v.push(...point(s,u));const col=colorBase.clone().lerp(colorGreen,greenBlend(s,u));colors.push(col.r,col.g,col.b);}
      if(i)for(let j=0;j<columns.length-1;j++){
        const n=(i-1)*columns.length+j,k=n+columns.length,mid=from+(to-from)*(i-.5)/count,u=(columns[j]+columns[j+1])*width(mid)/4;
        (bunkerAt(mid,u)?sand:fast).push(n,n+1,k,k,n+1,k+1);
      }
    }
    surfaceMesh('Fairway / sculpted racing surface',v,fast,colors);
    surfaceMesh('Bunker / kidney-shaped soft sand',v,sand,Array.from({length:v.length},(_,i)=>[colorSand.r,colorSand.g,colorSand.b][i%3]),true,2,{groundSpeedLimit:COUNTRY_CLUB_SAND_SPEED,edgeGrinding:false});
    const sides:number[]=[],si:number[]=[];
    for(const side of [-1,1])for(let i=0;i<=count;i++){
      const s=from+(to-from)*i/count,p=point(s,side*width(s)/2),n=sides.length/3;
      sides.push(...p,p[0],p[1]-.9,p[2]);if(i)si.push(n-2,n-1,n,n,n-1,n+1);
    }
    mesh('Fairway / closed shoulder fascia',sides,si,pal.stone,false,1,{doubleSided:true});
  }
}
const spans=[0,...gaps.flatMap(g=>[g.a,g.b]),length];
for(let i=0;i<spans.length-1;i+=2)road(spans[i],spans[i+1]);
for(const g of gaps)for(const s of [g.a,g.b]){
  const p=point(s,-width(s)/2),q=point(s,width(s)/2);
  mesh(`Hole ${g.hole} / closed bridge end`,[...p,...q,q[0],q[1]-.9,q[2],p[0],p[1]-.9,p[2]],[0,1,2,0,2,3],pal.stone,false,4,{doubleSided:true});
}
// Match the actual terrain triangles at the shore, not just the height function.
function terrainHeight(x:number,z:number){
  const bx=bounds.minX+Math.floor((x-bounds.minX)/tile)*tile,bz=bounds.minZ+Math.floor((z-bounds.minZ)/tile)*tile;
  const wx=Math.min(tile,bounds.maxX-bx),wz=Math.min(tile,bounds.maxZ-bz),dx=wx/Math.ceil(wx/step),dz=wz/Math.ceil(wz/step);
  const ix=Math.floor((x-bx)/dx),iz=Math.floor((z-bz)/dz),x0=bx+ix*dx,z0=bz+iz*dz,u=(x-x0)/dx,v=(z-z0)/dz;
  const a=cachedGround(x0,z0),b=cachedGround(x0+dx,z0),c=cachedGround(x0,z0+dz),d=cachedGround(x0+dx,z0+dz);
  return u+v<=1?a*(1-u-v)+b*u+c*v:b*(1-v)+c*(1-u)+d*(u+v-1);
}
// Regular cells avoid the long fan triangles that opened visible seams when the
// existing water shader tessellated and displaced them. Clip only shore cells.
for(const p of ponds){
  const spacing=3.5,spanX=Math.abs(p.r[0])*p.rx+Math.abs(p.f[0])*p.rz,spanZ=Math.abs(p.r[2])*p.rx+Math.abs(p.f[2])*p.rz;
  const minX=Math.floor((p.x-spanX*1.3)/spacing)*spacing,minZ=Math.floor((p.z-spanZ*1.3)/spacing)*spacing;
  const nx=Math.ceil(spanX*2.6/spacing),nz=Math.ceil(spanZ*2.6/spacing);
  const samples=new Map<string,{x:number;z:number;d:number}>();
  const sample=(i:number,j:number)=>{
    const key=`${i}:${j}`;if(!samples.has(key)){
      const x=minX+i*spacing,z=minZ+j*spacing,dx=x-p.x,dz=z-p.z;
      const radius=Math.hypot((dx*p.r[0]+dz*p.r[2])/p.rx,(dx*p.f[0]+dz*p.f[2])/p.rz);
      samples.set(key,{x,z,d:radius<1.16?p.y+.08-terrainHeight(x,z):-1});
    }return samples.get(key)!;
  };
  {
    const vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
      const a=sample(i,j),b=sample(i+1,j),c=sample(i,j+1),d=sample(i+1,j+1);
      for(const triangle of [[a,c,b],[b,c,d]]){
        const polygon:{x:number;z:number;d:number}[]=[];
        for(let k=0;k<3;k++){
          const v=triangle[k],w=triangle[(k+1)%3];if(v.d>=0)polygon.push(v);
          if((v.d>=0)!==(w.d>=0)){const t=v.d/(v.d-w.d);polygon.push({x:v.x+(w.x-v.x)*t,z:v.z+(w.z-v.z)*t,d:0});}
        }
        if(polygon.length<3)continue;
        const base=vertices.length/3;for(const v of polygon)vertices.push(v.x,p.y,v.z);
        for(let k=1;k<polygon.length-1;k++)indices.push(base,base+k,base+k+1);
      }
    }
    mesh(`Hole ${p.hole} / bank-fitted water`,vertices,indices,pal.water,false,4,{materialStyle:'water',swimDepth:7,opacity:.9});
  }
}
function rail(name:string,points:Point[],grp=5){const p=points[0];C.push({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),grp,nm:name});}
for(const r of waterRails){
  const count=Math.ceil((r.end-r.start)/3),points=Array.from({length:count+1},(_,i)=>railPoint(r,r.start+(r.end-r.start)*i/count));
  rail(`Hole ${r.hole} / curved water bypass`,points);
  for(const t of [.22,.5,.78]){const p=railPoint(r,r.start+(r.end-r.start)*t),bottom=Math.min(ground(p[0],p[2])-.25,p[1]-1),top=p[1]-.3;box(`Hole ${r.hole} / rail pier`,[p[0],(top+bottom)/2,p[2]],[.6,top-bottom,.6],pal.stone,0,5);}
}
const ridgeSpec={...ridge,side:-1,offset:8};
rail('Hole 15 / inside ridge grind',Array.from({length:42},(_,i)=>railPoint(ridgeSpec,ridge.start+(ridge.end-ridge.start)*i/41)));
C.push({t:'crystal',p:railPoint(ridgeSpec,(ridge.start+ridge.end)/2).map((v,i)=>v+(i===1?.85:0)) as Point,grp:5,nm:'Hole 15 / ridge crystal'});
// Geometry numerals keep this greybox editable without an engine text system.
const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001010010010','111101111101111','111101111001111'];
function numberPanel(n:number,s:number,u:number,base:number,flag=false){
  const p=point(s,u),f=frame(s),h=flag?3.9:3.4,w=flag?2.7:3.2;
  const postHeight=flag?h:h-1.35;
  box(`Hole ${n} / ${flag?'flag':'tee sign'} post`,[p[0]+f.f[0]*.15,base+postHeight/2,p[2]+f.f[2]*.15],[.16,postHeight,.16],pal.dark,0,9);
  const centre:Point=[p[0]+f.r[0]*(flag?w/2:0),base+h-.5,p[2]+f.r[2]*(flag?w/2:0)];
  box(`Hole ${n} / numbered ${flag?'flag':'tee'} panel`,centre,[w,1.9,.12],pal.edge,f.yaw,9);
  const str=String(n).padStart(2,'0'),pixel=.26,total=7*pixel,v:number[]=[],ind:number[]=[];
  for(let d=0;d<2;d++)for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(digits[+str[d]][y*3+x]==='1'){
    const l=(d*4+x)*pixel-total/2,b=(2.5-y-1)*pixel,idx=v.length/3;
    for(const [xx,yy] of [[l,b],[l+pixel*.86,b],[l,b+pixel*.86],[l+pixel*.86,b+pixel*.86]])v.push(centre[0]+f.r[0]*xx-f.f[0]*.068,centre[1]+yy,centre[2]+f.r[2]*xx-f.f[2]*.068);
    ind.push(idx,idx+1,idx+2,idx+2,idx+1,idx+3);
  }
  mesh(`Hole ${n} / visible numeral ${str} ${flag?'green':'tee'}`,v,ind,pal.dark,false,9,{doubleSided:true});
}
for(const h of holes){
  const u=-h.side*(width(h.a+11)/2-2),tee=point(h.a+11,u);numberPanel(h.n,h.a+11,u,tee[1]);
  const fu=h.side*(width(h.green)*.33),flag=point(h.green,fu);numberPanel(h.n,h.green,fu,flag[1],true);
  const v:number[]=[flag[0],flag[1]+.035,flag[2]],ind:number[]=[];
  for(let k=0;k<=20;k++){const a=k/20*Math.PI*2,q=point(h.green+Math.sin(a)*.42,fu+Math.cos(a)*.42,.035);v.push(...q);if(k)ind.push(0,k,k+1);}
  mesh(`Hole ${h.n} / putting cup`,v,ind,pal.dark,false,9);
  C.push({t:'checkpoint',p:point(h.tee),grp:9,nm:`Hole ${h.n} / tee checkpoint`});
}
for(const p of pads)C.push({t:'speedpad',p:point(p.s,0,.025),s:[7,.18,4],yaw:frame(p.s).yaw,speed:p.speed,cycle:2.2,grp:6,nm:`Racing line / ${p.speed} m/s approach boost`});
function curvedWall(name:string,a:number,b:number,u:number,rise:number,w=1.2){
  const points=Array.from({length:13},(_,i)=>point(a+(b-a)*i/12,u,-.2)),p=points[0];
  C.push({t:'wallpath',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),w,rise,curve:'spline',color:pal.stone,tex:'solid',grp:7,nm:name});
}
function pillar(name:string,s:number,u:number,radius:number,height:number){
  const p=point(s,u),pts=Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return [Math.cos(a)*radius,Math.sin(a)*radius,0] as [number,number,number];});
  const bottom=Math.min(p[1]-.5,...pts.map(q=>ground(p[0]+q[0],p[2]+q[1])-.25));
  C.push({t:'wallpath',p:[p[0],bottom,p[2]],pts,closed:true,w:.5,rise:p[1]+height-bottom,curve:'corner',color:pal.stone,tex:'solid',grp:7,nm:name});
  const v:number[]=[p[0],p[1]+height,p[2]],ii:number[]=[];
  for(let i=0;i<=12;i++){const a=i/12*Math.PI*2;v.push(p[0]+Math.cos(a)*(radius-.25),p[1]+height,p[2]+Math.sin(a)*(radius-.25));if(i)ii.push(0,i+1,i);}
  mesh(name+' / inset top',v,ii,pal.stone,true,7);
}
// Differing silhouettes, broad passing lines, and clear water landing zones.
curvedWall('Hole 1 / sweeping clubhouse boundary',77,112,14,1.1);
for(const [i,o] of bunkers.entries())curvedWall(`Bunker ${i+1} / outer crescent rim`,o.s-11,o.s+12,o.side*(width(o.s)/2+2),.6,.9);
for(const u of [-11,11])pillar('Hole 4 / gatehouse column',558,u,1.25,7);
box('Hole 4 / high gatehouse lintel',point(558,0,7),[24,1.1,2.3],pal.edge,frame(558).yaw,7);
curvedWall('Hole 5 / horseshoe inner bank',706,780,-13,1.3,1.8);
for(let i=0;i<5;i++)pillar('Hole 7 / orchard trunk proxy',1070+i*23,(i%2?1:-1)*13,1,5+(i%3)*.7);
for(const u of [-12,12])pillar('Hole 8 / raised terrace marker',1320,u,.8,3);
curvedWall('Hole 9 / roller garden border',1400,1465,14,.8);
curvedWall('Hole 11 / high-bank outer coping',1758,1838,-15,1.3,1.1);
curvedWall('Hole 12 / first sweeping chicane',1928,1965,14,1.2);
curvedWall('Hole 12 / outgoing chicane',1985,2025,-14,1.2);
pillar('Hole 13 / split-route island',2120,0,2.1,1.3);
curvedWall('Hole 15 / ridge outside retaining wall',2445,2530,15,1.6,1.2);
for(const [s,u] of [[2605,10],[2640,-11],[2705,10]]){
  const p=point(s,u);box('Hole 16 / parked cart proxy',[p[0],p[1]+1,p[2]],[3.6,2,5.4],pal.dark,frame(s).yaw,7);
  box('Hole 16 / cart roof',[p[0],p[1]+2.1,p[2]],[4,.22,4.2],pal.edge,frame(s).yaw,7);
}
for(const s of [2935,2975,3010])for(const u of [-16,16])pillar('Hole 18 / home-stretch colonnade',s,u,.65,5);
for(const e of encounters){const f=frame(e.s);C.push({t:'enemy',p:point(e.s,e.u),foe:e.foe,range:1.6,speed:2.2,yaw:Math.abs(f.f[0])>.7?90:0,grp:8,nm:`Hole ${holes.find(h=>e.s>=h.a&&e.s<h.b)!.n} / replaceable ${e.foe} patrol`});}
const house=point(22,50),cornerYs=[-1,1].flatMap(x=>[-1,1].map(z=>ground(house[0]+x*18,house[2]+z*15))),floor=Math.max(...cornerYs)+.3,bottom=Math.min(...cornerYs)-1;
box('Clubhouse / seated foundation',[house[0],(floor+bottom)/2,house[2]],[36,floor-bottom,30],pal.stone);
box('Clubhouse / main mass',[house[0],floor+4,house[2]],[28,8,18],pal.fairway);
box('Clubhouse / roof',[house[0],floor+8.4,house[2]],[32,.8,22],pal.edge);
for(let i=0;i<3;i++)box('Clubhouse / forecourt steps',[house[0]-19-i*1.5,floor-.4-i*.5,house[2]],[1.6,.8,16],pal.stone);
for(let s=18;s<length-20;s+=22){
  if(gaps.some(g=>s>g.a-7&&s<g.b+8))continue;
  const u=s>2080&&s<2160?-5.2*Math.exp(-(((s-2120)/25)**4)):racingOffset(s);
  mesh('Racing line / forward chevron',[point(s+2,u,.045),point(s-1.3,u-1.1,.045),point(s-1.3,u+1.1,.045)].flat(),[0,1,2],pal.edge,false,9);
}
for(const g of gaps)for(let d=1;d<=3;d++){
  const s=g.a-d*2,w=width(s)/2-1;
  mesh(`Hole ${g.hole} / jump countdown`,[point(s-.16,-w,.045),point(s-.16,w,.045),point(s+.16,-w,.045),point(s+.16,w,.045)].flat(),[0,1,2,2,1,3],pal.edge,false,9);
}
for(const h of holes)for(const u of [-7,7]){
  if(gaps.some(g=>Math.abs(g.b-(h.green+8))<24))continue;
  C.push({t:'crate',kind:'wood',p:point(h.green+8,u),grp:9,nm:`Hole ${h.n} / optional green box`});
}
for(let s=18;s<length-20;s+=14){
  if(gaps.some(g=>s>g.a-2&&s<g.b+2))continue;
  const u=s>2080&&s<2160?-5.2*Math.exp(-(((s-2120)/25)**4)):racingOffset(s);
  C.push({t:'wumpa',p:point(s,u,1.1),grp:9,nm:'Racing line / route fruit'});
}
for(let s=0;s<length;s+=8)C.push({t:'camnode',p:point(s),radius:0,grp:9});
C.push({t:'camnode',p:point(length),radius:0,grp:9});
C.push({t:'clock',p:point(12,2),grp:9,nm:'First tee / time-trial clock'});
C.push({t:'gate',p:point(length-14),yaw:frame(length-14).yaw,grp:9,nm:'Hole 18 / finish'});
export const COUNTRY_CLUB_LEVEL:CustomLevelData={
  v:1,name:'Country Club Circuit',spawn:point(7,0,.1),startWarpPad:false,killY:-42,
  sky:'day',cameraLookAhead:11,cameraAirLift:.6,cameraRig:{camDist:10,camHeight:6,camPitch:18,camFov:60},
  atmosphere:{fogEnabled:true,fogNear:150,fogFar:480,fogColor:'#b9c2bc',ambientSky:'#d9dfd8',ambientGround:'#757b70',backdrop:'fog',drawDistance:520},
  components:C,groups:[
    {id:1,nm:'01 / eighteen sculpted fairways and greens',editorOnly:true},{id:2,nm:'02 / rounded deep-sand bunkers',editorOnly:true},
    {id:4,nm:'04 / banked ponds and jumping decks',editorOnly:true},{id:5,nm:'05 / curved bypass rails',editorOnly:true},
    {id:6,nm:'06 / approach speed pads',editorOnly:true},{id:7,nm:'07 / composed course obstacles',editorOnly:true},
    {id:8,nm:'08 / replaceable enemy placeholders',editorOnly:true},{id:9,nm:'09 / numbered tees, flags and normal level flow',editorOnly:true},
    {id:10,nm:'10 / continuous soft-sand landscape',editorOnly:true},
  ],
};
