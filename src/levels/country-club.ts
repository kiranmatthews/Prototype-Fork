import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';
import { type Point, COUNTRY_CLUB_HOLES as holes, COUNTRY_CLUB_LENGTH as length,
  COUNTRY_CLUB_GAPS as gaps, COUNTRY_CLUB_PONDS as ponds, COUNTRY_CLUB_PADS as pads,
  COUNTRY_CLUB_ENCOUNTERS as encounters,
  COUNTRY_CLUB_WATER_RAILS as waterRails, COUNTRY_CLUB_RIDGE as ridge,
  COUNTRY_CLUB_BOUNDS as bounds, COUNTRY_CLUB_SAND_SPEED,
  countryClubPoint as point, countryClubFrame as frame, countryClubWidth as width,
  countryClubGroundHeight as ground, countryClubBunkerAt as bunkerAt,
  countryClubRacingOffset as racingOffset, countryClubRailPoint as railPoint,
  COUNTRY_CLUB_CHECKPOINTS as checkpoints, COUNTRY_CLUB_CORNERS as corners, countryClubNearestRoad as nearestRoad,
} from './country-club-layout';
export * from './country-club-layout';
import {countryClubGreenDistance,countryClubGolfField,estatePoint} from './country-club-estate';

const C:CustomComponent[]=[],round=(v:number)=>Math.round(v*1000)/1000;
const pal={fairway:'#b7b39d',green:'#a9bf85',sand:'#6c7c55',bunker:'#d4cbb5',edge:'#e8e8db',water:'#64888c',dark:'#46574e',stone:'#8a918a'};
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
const step=8,tile=96,heights=new Map<string,number>();
const cachedGround=(x:number,z:number)=>{const k=`${x}:${z}`;if(!heights.has(k))heights.set(k,ground(x,z));return heights.get(k)!;};
// One continuous turf skin owns every fairway, collar, green and bunker. Refine
// colour detail locally while retaining the same height planes at cell borders.
for(let x=bounds.minX;x<bounds.maxX;x+=tile)for(let z=bounds.minZ;z<bounds.maxZ;z+=tile){
  const spanX=Math.min(bounds.maxX,x+tile)-x,spanZ=Math.min(bounds.maxZ,z+tile)-z,nx=Math.ceil(spanX/step),nz=Math.ceil(spanZ/step),dx=spanX/nx,dz=spanZ/nz,v:number[]=[],ind:number[]=[],colors:number[]=[],ids=new Map<string,number>();
  const vertex=(xx:number,zz:number)=>{const k=`${xx.toFixed(6)}:${zz.toFixed(6)}`;if(!ids.has(k)){ids.set(k,v.length/3);v.push(xx,cachedGround(xx,zz),zz);const c=countryClubGolfField(xx,zz).color;colors.push(c.r,c.g,c.b);}return ids.get(k)!;};
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const xx=x+i*dx,zz=z+j*dz,sub=Math.max(countryClubGolfField(xx+dx/2,zz+dz/2).detail,...[[0,0],[dx,0],[0,dz],[dx,dz]].map(([a,b])=>countryClubGolfField(xx+a,zz+b).detail));
    for(let b=0;b<sub;b++)for(let a=0;a<sub;a++){
      const p=vertex(xx+a*dx/sub,zz+b*dz/sub),q=vertex(xx+(a+1)*dx/sub,zz+b*dz/sub),r=vertex(xx+a*dx/sub,zz+(b+1)*dz/sub),s=vertex(xx+(a+1)*dx/sub,zz+(b+1)*dz/sub);
      ind.push(p,r,q,q,r,s);
    }
  }
  mesh('Estate / continuous landscaped turf',v,ind,'#ffffff',true,10,{colors:colors.map(round),groundSpeedLimit:COUNTRY_CLUB_SAND_SPEED,edgeGrinding:false});
}
function road(a:number,b:number){
  const columns=Array.from({length:7},(_,i)=>i/3-1);
  for(let from=a;from<b-.001;from+=54){
    const to=Math.min(b,from+54),count=Math.ceil((to-from)/2),v:number[]=[],colors:number[]=[],fast:number[]=[],sand:number[]=[];
    for(let i=0;i<=count;i++){
      const s=from+(to-from)*i/count;
      for(const c of columns){const u=c*width(s)/2;v.push(...point(s,u));const pos=point(s,u),inGreen=holes.some(h=>countryClubGreenDistance(h,pos[0],pos[2])<1.1);const col=inGreen?colorGreen:colorBase;colors.push(col.r,col.g,col.b);}
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
    if(ponds.some(p=>(from+to)/2>p.s-p.rz-18&&(from+to)/2<p.s+p.rz+18))mesh('Water crossing / closed deck fascia',sides,si,pal.stone,false,1,{doubleSided:true});
    else for(const side of [-1,1]){
      const v:number[]=[],ii:number[]=[],cc:number[]=[],steps=Math.ceil((to-from)/8);
      for(let i=0;i<=steps;i++){
        const s=from+(to-from)*i/steps,a=point(s,side*width(s)/2),b=point(s,side*(width(s)/2+2.5));b[1]=ground(b[0],b[2]);v.push(...a,...b);
        const c=countryClubGolfField(b[0],b[2]).color;cc.push(colorBase.r,colorBase.g,colorBase.b,c.r,c.g,c.b);
        if(i){const n=i*2;ii.push(n-2,n-1,n,n,n-1,n+1);}
      }
      mesh('Cart path / graded turf shoulder',v,ii,'#ffffff',true,10,{colors:cc,groundSpeedLimit:COUNTRY_CLUB_SAND_SPEED,edgeGrinding:false,doubleSided:true});
    }

  }
}
const spans=[0,...gaps.flatMap(g=>[g.a,g.b]),length];
for(let i=0;i<spans.length-1;i+=2)road(spans[i],spans[i+1]);
for(const g of gaps)for(const s of [g.a,g.b]){
  const p=point(s,-width(s)/2),q=point(s,width(s)/2);
  mesh(`Water crossing ${g.hole} / closed bridge end`,[...p,...q,q[0],q[1]-.9,q[2],p[0],p[1]-.9,p[2]],[0,1,2,0,2,3],pal.stone,false,4,{doubleSided:true});
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
    mesh(`Water crossing ${p.hole} / bank-fitted water`,vertices,indices,pal.water,false,4,{materialStyle:'water',swimDepth:7,opacity:.9});
  }
}
function rail(name:string,points:Point[],grp=5){const p=points[0];C.push({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),grp,nm:name});}
for(const r of waterRails){
  const count=Math.ceil((r.end-r.start)/3),points=Array.from({length:count+1},(_,i)=>railPoint(r,r.start+(r.end-r.start)*i/count));
  rail(`Water crossing ${r.hole} / curved water bypass`,points);
  for(const t of [.22,.5,.78]){const p=railPoint(r,r.start+(r.end-r.start)*t),bottom=Math.min(ground(p[0],p[2])-.25,p[1]-1),top=p[1]-.3;box(`Water crossing ${r.hole} / rail pier`,[p[0],(top+bottom)/2,p[2]],[.6,top-bottom,.6],pal.stone,0,5);}
}
const ridgeSpec={...ridge,side:-1,offset:8};
rail('Southern ridge / inside grind',Array.from({length:42},(_,i)=>railPoint(ridgeSpec,ridge.start+(ridge.end-ridge.start)*i/41)));
C.push({t:'crystal',p:railPoint(ridgeSpec,(ridge.start+ridge.end)/2).map((v,i)=>v+(i===1?.85:0)) as Point,grp:5,nm:'Southern ridge / crystal'});
// Each unnumbered tee uses two modest markers. Only the cups carry flags.
for(const h of holes){
  const tf=new THREE.Vector2(h.path[1][0]-h.tee[0],h.path[1][1]-h.tee[1]).normalize(),tr=new THREE.Vector2(-tf.y,tf.x);
  for(const u of [-3.8,3.8]){const x=h.tee[0]+tr.x*u,z=h.tee[1]+tr.y*u;box(`Golf ${h.n} / tee marker`,[x,ground(x,z)+.18,z],[.55,.3,.55],pal.edge,0,11);}
}
const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001010010010','111101111101111','111101111001111'];
for(const h of holes){
  const x=h.cup[0],z=h.cup[1],base=ground(x,z)+.008,pole=3.25,flagW=1.65,flagH=1.0;
  box(`Golf ${h.n} / cup flagpole`,[x,base+pole/2,z],[.07,pole,.07],pal.edge,0,9);
  // Face each number toward the nearby racing path, even for distant greens.
  const near=nearestRoad(x,z),road=point(near.s),dx=road[0]-x,dz=road[2]-z,n=Math.hypot(dx,dz)||1,fx=dx/n,fz=dz/n,rx=fz,rz=-fx;
  const cx=x+rx*flagW/2,cz=z+rz*flagW/2,cy=base+pole-.45,quad:number[]=[];
  for(const [u,y]of [[-flagW/2,-flagH/2],[flagW/2,-flagH/2],[-flagW/2,flagH/2],[flagW/2,flagH/2]])quad.push(cx+rx*u,cy+y,cz+rz*u);
  mesh(`Golf ${h.n} / numbered cup flag`,quad,[0,1,2,2,1,3],pal.edge,false,9,{doubleSided:true});
  const str=String(h.n).padStart(2,'0'),pixel=.16,total=7*pixel,v:number[]=[],ii:number[]=[];
  for(const face of [-1,1])for(let d=0;d<2;d++)for(let j=0;j<5;j++)for(let i=0;i<3;i++)if(digits[+str[d]][j*3+i]==='1'){
    const l=(d*4+i)*pixel-total/2,b=(1.5-j)*pixel,k=v.length/3;
    for(const [u,y]of [[l,b],[l+pixel*.9,b],[l,b+pixel*.9],[l+pixel*.9,b+pixel*.9]])v.push(cx+rx*u*face+fx*.015*face,cy+y,cz+rz*u*face+fz*.015*face);
    ii.push(k,k+1,k+2,k+2,k+1,k+3);
  }
  mesh(`Golf ${h.n} / visible cup number ${str}`,v,ii,pal.dark,false,9,{doubleSided:true});
  const cup:number[]=[x,base+.004,z],ind:number[]=[];
  for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;cup.push(x+Math.cos(a)*.22,base+.004,z+Math.sin(a)*.22);if(i)ind.push(0,i+1,i);}
  mesh(`Golf ${h.n} / cup`,cup,ind,'#243226',false,9);
}
for(const [i,s]of checkpoints.entries())C.push({t:'checkpoint',p:point(s),grp:9,nm:`Race checkpoint ${i+1}`});
for(const p of pads)C.push({t:'speedpad',p:point(p.s,0,.025),s:[7,.18,4],yaw:frame(p.s).yaw,speed:p.speed,cycle:2.2,grp:6,nm:`Racing line / ${p.speed} m/s approach boost`});
function curvedWall(name:string,a:number,b:number,u:number,rise:number,w=1.2){
  const points=Array.from({length:13},(_,i)=>point(a+(b-a)*i/12,u,-.2)),p=points[0];
  C.push({t:'wallpath',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),w,rise,curve:'spline',color:pal.stone,tex:'solid',grp:7,nm:name});
}
// Low apex walls and direction chevrons mark the sharp turns without flags.
for(const [i,c]of corners.entries()){
  const s=(c.entry+c.exit)/2,f0=frame(c.entry).f,f1=frame(c.exit).f,side=Math.sign(f0[0]*f1[2]-f0[2]*f1[0]);
  curvedWall(`Race corner ${i+1} / low apex wall`,c.entry-10,c.exit+10,side*(width(s)/2+1.5),.7,1);
}
for(const e of encounters){const f=frame(e.s);C.push({t:'enemy',p:point(e.s,e.u),foe:e.foe,range:1.6,speed:2.2,yaw:Math.abs(f.f[0])>.7?90:0,grp:8,nm:`Race / replaceable ${e.foe} patrol`});}
const houseXZ=estatePoint(-155,35),house:Point=[houseXZ[0],ground(...houseXZ),houseXZ[1]],cornerYs=[-1,1].flatMap(x=>[-1,1].map(z=>ground(house[0]+x*27,house[2]+6+z*29))),floor=Math.max(...cornerYs)+.3,bottom=Math.min(...cornerYs)-1;
box('Clubhouse / seated foundation',[house[0],(floor+bottom)/2,house[2]+6],[54,floor-bottom,58],pal.stone);
box('Clubhouse / central pavilion',[house[0],floor+3.5,house[2]],[26,7,20],'#9a9b87');
box('Clubhouse / low west wing',[house[0]-18,floor+2.3,house[2]+3],[14,4.6,22],'#9a9b87');
box('Clubhouse / low east wing',[house[0]+18,floor+2.3,house[2]+3],[14,4.6,22],'#9a9b87');
box('Clubhouse / central roof',[house[0],floor+7.4,house[2]],[30,.8,24],pal.dark);
for(const side of [-1,1])box('Clubhouse / wing roof',[house[0]+side*18,floor+4.9,house[2]+3],[16,.6,24],pal.dark);
for(let i=0;i<5;i++){const x=house[0]-15+i*7,z=house[2]+24,y=floor;box('Clubhouse / cart parking bay',[x,y+.12,z],[5,.22,8],pal.stone);box('Clubhouse / parked cart',[x,y+1.23,z],[2.5,2,3.5],pal.edge);}
const driveZ=house[2]+45,driveBase=ground(house[0],driveZ+10)+.05;
C.push({t:'ramp',p:[house[0],driveBase,driveZ],len:20,w:10,rise:Math.max(.1,floor-driveBase),color:pal.stone,tex:'solid',grp:7,nm:'Clubhouse / forecourt approach'});
// Broadleaf groves separate neighbouring holes. Reject placements on play surfaces.
for(const h of holes)for(let i=0;i<7;i++){
  const t=(i+1)/8,k=Math.min(h.path.length-2,Math.floor(t*(h.path.length-1))),a=h.path[k],b=h.path[k+1],u=t*(h.path.length-1)-k,dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz),side=i%2?1:-1;
  const x=a[0]+dx*u-dz/n*side*(h.width*.7+12),z=a[1]+dz*u+dx/n*side*(h.width*.7+12),near=nearestRoad(x,z);
  if(countryClubGolfField(x,z).fairway||holes.some(g=>Math.hypot(x-g.tee[0],z-g.tee[1])<12)||near.distance<width(near.s)/2+11||holes.some(g=>countryClubGreenDistance(g,x,z)<1.7)||ponds.some(p=>Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)<1.4))continue;
  const y=ground(x,z),height=6+(h.n+i)%4;
  C.push({t:'decor',dkind:'tree',p:[x,y,z],w:1.25,rise:height,vr:(h.n+i)%8,tn:0,grp:12,nm:'Estate / broadleaf grove'});
}
for(let s=18;s<length-20;s+=22){
  if(gaps.some(g=>s>g.a-7&&s<g.b+8))continue;
  const u=racingOffset(s);
  mesh('Racing line / forward chevron',[point(s+2,u,.045),point(s-1.3,u-1.1,.045),point(s-1.3,u+1.1,.045)].flat(),[0,1,2],pal.edge,false,9);
}
for(const g of gaps)for(let d=1;d<=3;d++){
  const s=g.a-d*2,w=width(s)/2-1;
  mesh(`Water crossing ${g.hole} / jump countdown`,[point(s-.16,-w,.045),point(s-.16,w,.045),point(s+.16,-w,.045),point(s+.16,w,.045)].flat(),[0,1,2,2,1,3],pal.edge,false,9);
}
for(const s of checkpoints.slice(1,-1))for(const u of [-6,6])C.push({t:'crate',kind:'wood',p:point(s+28,u),grp:9,nm:'Race / optional supplies'});
for(let s=18;s<length-20;s+=14){
  if(gaps.some(g=>s>g.a-2&&s<g.b+2))continue;
  const u=racingOffset(s);
  C.push({t:'wumpa',p:point(s,u,1.1),grp:9,nm:'Racing line / route fruit'});
}
for(let s=0;s<length;s+=8)C.push({t:'camnode',p:point(s),radius:0,grp:9});
C.push({t:'camnode',p:point(length),radius:0,grp:9});
C.push({t:'clock',p:point(12,2),grp:9,nm:'Race start / time-trial clock'});
C.push({t:'gate',p:point(length-14),yaw:frame(length-14).yaw,grp:9,nm:'Country Club / race finish'});
export const COUNTRY_CLUB_LEVEL:CustomLevelData={
  v:1,name:'Country Club Circuit',spawn:point(7,0,.1),startWarpPad:false,killY:-42,
  sky:'day',cameraLookAhead:11,cameraAirLift:.6,cameraRig:{camDist:10,camHeight:6,camPitch:18,camFov:60},
  atmosphere:{fogEnabled:true,fogNear:150,fogFar:480,fogColor:'#b9c2bc',ambientSky:'#d9dfd8',ambientGround:'#757b70',backdrop:'fog',drawDistance:520},
  components:C,groups:[
    {id:1,nm:'01 / compacted cart paths and racing crossings',editorOnly:true},{id:2,nm:'02 / rounded deep-sand bunkers',editorOnly:true},
    {id:4,nm:'04 / banked ponds and jumping decks',editorOnly:true},{id:5,nm:'05 / curved bypass rails',editorOnly:true},
    {id:6,nm:'06 / approach speed pads',editorOnly:true},{id:7,nm:'07 / composed course obstacles',editorOnly:true},
    {id:8,nm:'08 / replaceable enemy placeholders',editorOnly:true},{id:9,nm:'09 / eighteen numbered cup flags and race flow',editorOnly:true},
    {id:10,nm:'10 / continuous rough landscape',editorOnly:true},
    {id:11,nm:'11 / independent golf fairways, greens and tees',editorOnly:true},{id:12,nm:'12 / estate groves',editorOnly:true},
  ],
};
