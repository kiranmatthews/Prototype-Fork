import * as THREE from 'three';
import type {CustomComponent,CustomLevelData} from '../level';
import type {RaceKnot,RacePoint} from '../race/types';
import type {UnityOceanParams} from '../unityOcean';
import {RaceCourse} from '../race/course';
import {WATERSLIDE_ASSETS} from '../waterslideAssets';
import tunnelProfiles from './slipstream-tunnel-profiles.json';
import supportExclusions from './slipstream-support-exclusions.json';

// Intervals measured against the course's other legs and its actual jump gaps.
export const WATERPARK_TUNNELS = [[180,400],[680,890],[1210,1365],[1870,2050],[2320,2460],[3140,3310],[3500,3700]] as const;
// Corroded upper panels only. The original floor and lower riding walls stay intact.
export const WATERPARK_SKYLIGHTS=WATERPARK_TUNNELS.flatMap(([a,b],tunnel)=>
 Array.from({length:Math.floor((b-a-25)/52)},(_,i)=>({tunnel,s:a+25+i*52,length:18+(i%2)*6,angle:Math.PI*(i%2?.42:.58),arc:Math.PI*.22})));
export const waterparkRoofOpening=(s:number,angle:number,tunnel:number)=>WATERPARK_SKYLIGHTS.some(g=>{
 if(g.tunnel!==tunnel||angle<.1*Math.PI||angle>.9*Math.PI)return false;
 const x=(s-g.s)/(g.length/2),y=(angle-g.angle)/g.arc;
 return x*x+y*y<1+.14*Math.sin(s*1.3+angle*21);
});
const V=(p:RacePoint)=>new THREE.Vector3(...p);
const round=(x:number)=>Math.round(x*10000)/10000;
const tuple=(p:THREE.Vector3)=>p.toArray().map(round) as RacePoint;
const noise=(n:number)=>{const v=Math.sin(n*17.13+12.7)*43123.19;return v-Math.floor(v);};
const up=new THREE.Vector3(0,1,0);

// The high descent looks across a deep lagoon. Keep the established wave
// motion, but soften crest tint and reflection distortion at this scale.
export const WATERPARK_ISLAND_OCEAN_LOOK:Partial<UnityOceanParams>={
 deep:{r:.018,g:.28,b:.34,a:1},shallow:{r:.08,g:.62,b:.55,a:.7},
 peak:{r:.28,g:.58,b:.55,a:.13},normalStrength:1.05,
 reflectionStrength:.32,reflectionFresnel:8,reflectionDistortion:.6,
 causticsStrength:.4,depthDistance:2.5,foamStrength:.48,intersectionWidth:.85,
};

export const WATERPARK_ISLAND_LOOK:Pick<CustomLevelData,'sky'|'ocean'|'atmosphere'|'cameraRig'|'keepPlayFog'>={
 sky:'waterslide-island',keepPlayFog:true,
 cameraRig:{camDist:6.4,camHeight:6.3,camPitch:21,camFov:54},
 // Keep the detailed lagoon's fading edges inside the camera range. The
 // existing surrounding horizon supplies the sea beyond this coastal basin.
 ocean:{p:[-900,128,-2700],length:1800,width:1800,seaward:1,geometryVersion:2,sourceCoordinates:'three',look:'waterpark-island',horizonMode:'surround',shoreGeometry:'ground',longitudinalSegments:180,lateralSegments:96},
 atmosphere:{fogEnabled:true,fogNear:120,fogFar:620,fogColor:'#9bc9cc',ambientSky:'#b9dbdf',ambientGround:'#73704b',ambientIntensity:.72,sunColor:'#ffe3ad',sunIntensity:2.65,sunDirection:[-.42,.82,.38],fillColor:'#8fcbd4',fillIntensity:.26,shadowStrength:.9,drawDistance:2000,backdrop:'painted sky',fallbackRidges:false},
};

/** Level data only: the race floor, movement model and jump gaps are unchanged. */
export function dressTropicalWaterpark(C:CustomComponent[],line:RaceKnot[]):void {
 const course=new RaceCourse(line),samples:Array<{s:number;p:THREE.Vector3;width:number}>=[];
 for(let s=0;s<=course.length;s+=8)samples.push({s,p:course.sample(s),width:course.width(s)});
 const add=(c:CustomComponent)=>C.push(c);
 const yawToward=(a:THREE.Vector3,b:THREE.Vector3)=>Math.atan2(b.x-a.x,b.z-a.z)*180/Math.PI;
 const inTunnel=(s:number)=>WATERPARK_TUNNELS.some(([a,b])=>s>a-1&&s<b+1);
 const safeScenery=(p:THREE.Vector3,radius:number,height:number)=>samples.every(a=>p.y+height<a.p.y-3||p.y>a.p.y+14||Math.hypot(a.p.x-p.x,a.p.z-p.z)>a.width/2+radius+4);

 // No broad repeating texture is left in the landscape. Retain the accepted
 // return surfaces invisibly while the sculpted forest floor supplies the view.
 for(const c of C){
  if(c.nm?.startsWith('Waterpark hillside')||c.nm?.startsWith('Waterpark gorge')||c.nm?.startsWith('Waterpark valley'))c.invisible=true;
  if(c.nm==='Weathered fiberglass flanges'){
   c.tex='solid';c.color='#ecdfbb';c.scenerySolid=false;
   // Interior tube collars own the panel rhythm. Remove redundant underlying
   // flange triangles, then weld identical remaining positions losslessly.
   const source=c.vertices!,faces=c.indices!,vertices:number[]=[],indices:number[]=[],ids=new Map<string,number>(),anchor=course.project(V(c.p)).s;
   for(let i=0;i<faces.length;i+=3){
    const center=new THREE.Vector3();for(let k=0;k<3;k++)center.add(new THREE.Vector3(...source.slice(faces[i+k]*3,faces[i+k]*3+3) as RacePoint));center.multiplyScalar(1/3).add(V(c.p));
    if(inTunnel(course.project(center,anchor,180).s))continue;
    for(let k=0;k<3;k++){const point=source.slice(faces[i+k]*3,faces[i+k]*3+3),key=point.join(',');let index=ids.get(key);if(index===undefined){index=vertices.length/3;ids.set(key,index);vertices.push(...point);}indices.push(index);}
   }
   c.vertices=vertices;c.indices=indices;
  }
  if(c.nm?.includes('maintenance apron')||c.nm==='Closed ticket forecourt'){
   c.tex='custard-sandstone';c.color='#fff1dc';
   // These decks share a coplanar strip with the ride. The existing render
   // bias places only the decorative surface behind it, retaining contacts.
   c.depthBias=2;
  }
 }
 for(let i=C.length-1;i>=0;i--)if(C[i].t==='mesh'&&C[i].vertices?.length===0)C.splice(i,1);
 // Long columns previously passed straight through lower coils. A column is
 // retained only when its complete volume stays outside every riding envelope.
 for(let i=C.length-1;i>=0;i--){const c=C[i];
  if(c.dkind==='waterslideflumesupport'&&(course.project(V(c.p)).s>3070||supportExclusions.includes(c.p[0].toFixed(3)+','+c.p[2].toFixed(3)))){C.splice(i,1);continue;}
  if(c.nm!=='Weathered structural column'||!c.s)continue;
  const bottom=c.p[1]-c.s[1]/2,top=c.p[1]+c.s[1]/2;
  if(c.s[1]>72||samples.some(a=>a.p.y>bottom-2&&a.p.y<top+2&&Math.abs(a.p.x-c.p[0])<a.width/2+4&&Math.abs(a.p.z-c.p[2])<a.width/2+4))C.splice(i,1);
 }
 const forestHeight=(x:number,z:number)=>{
  let near=samples[0],best=Infinity,cap=Infinity;
  for(const a of samples){const d=Math.hypot(x-a.p.x,z-a.p.z);if(d<best){near=a;best=d;}if(d<a.width/2+20)cap=Math.min(cap,a.p.y-18);}
  return Math.min(cap,near.p.y-30+Math.min(17,best*.18)+Math.sin(x*.035+z*.013)*4);
 };
 // Non-repeating vertex-coloured terrain, broken into curved, fogged cells.
 for(let z=80;z>-2400;z-=160){
  const p:RacePoint=[0,0,z],vertices:number[]=[],indices:number[]=[],colors:number[]=[];
  const columns=24,rows=10;
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
   const x=-240+i*20,zz=z-j*16,y=forestHeight(x,zz),t=noise(i*13+j*71+z);
   vertices.push(x,y,zz-z);const col=new THREE.Color('#314d35').lerp(new THREE.Color('#697b45'),t*.6);colors.push(col.r,col.g,col.b);
   if(j&&i){const b=j*(columns+1)+i,a=b-(columns+1);indices.push(a-1,a,b-1,b-1,a,b);}
  }
  add({t:'mesh',p,vertices,indices,colors,tex:'solid',solid:true,outOfBounds:true,edgeGrinding:false,doubleSided:true,grp:432,nm:'Tropical forest / sculpted understory floor'});
 }
 // Existing near cliff gardens are retained; the new midground is all 3D.
 for(let s=60;s<3060;s+=74){
  const p=course.sample(s),f=course.tangent(s).setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x);
  for(const side of [-1,1]){
   const groveSize=WATERSLIDE_ASSETS.waterslidetropicalgrove.size,cliffSize=WATERSLIDE_ASSETS.waterslideplantedcliff.size;
   for(const [kind,size,scale,forward] of [
    ['waterslideplantedcliff',cliffSize,1.45+noise(s+side)*.45,0],
    ['waterslidetropicalgrove',groveSize,1.35+noise(s+side+7)*.55,24],
   ] as const){
    const radius=Math.hypot(size[0],size[2])*scale/2;
    const at=p.clone().addScaledVector(right,side*(course.width(s)/2+radius+8)).addScaledVector(f,forward);at.y=forestHeight(at.x,at.z)-3;
    if(safeScenery(at,radius,size[1]*scale))add({t:'decor',dkind:kind,p:tuple(at),w:scale,yaw:yawToward(at,p)+(kind==='waterslideplantedcliff'?90:0),scenerySolid:false,grp:432,nm:'Tropical forest / '+kind});
   }
  }
 }
 const end=course.sample(course.length);

 const profileCache=new Map<number,{left:number;right:number;heights:number[]}>();
 const profileAt=(s:number)=>{
  const cached=profileCache.get(s);if(cached)return cached;
  const owner=tunnelProfiles.find(p=>s>=p.from-.01&&s<=p.to+.01);
  if(!owner)return {left:-course.width(s)/2,right:course.width(s)/2,heights:Array(17).fill(0) as number[]};
  let lo=0,hi=owner.rows.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(owner.rows[m][0]<=s)lo=m;else hi=m;}
  const a=owner.rows[lo],b=owner.rows[hi],t=THREE.MathUtils.clamp((s-a[0])/(b[0]-a[0]||1),0,1),mix=(i:number)=>THREE.MathUtils.lerp(a[i],b[i],t);
  const result={left:mix(1),right:mix(2),heights:Array.from({length:17},(_,i)=>mix(i+3))};profileCache.set(s,result);return result;
 };
 const arcPoint=(s:number,angle:number,thickness=0)=>{
  const p=course.sample(s),f=course.tangent(s),right=new THREE.Vector3(-f.z,0,f.x).normalize(),row=profileAt(s);
  const middle=(row.left+row.right)/2,radius=(row.right-row.left)/2+3,x=middle+Math.cos(angle)*(radius+thickness);
  const t=THREE.MathUtils.clamp((x-row.left)/(row.right-row.left),0,1),u=t*16,i=Math.min(15,Math.floor(u));
  const floor=THREE.MathUtils.lerp(row.heights[i],row.heights[i+1],u-i)-.4;
  const lip=THREE.MathUtils.lerp(row.heights[0],row.heights[16],(Math.cos(angle)+1)/2)-.4;
  const y=Math.sin(angle)>=0?lip+Math.sin(angle)*(12+Math.max(0,radius-11)*.3+thickness):floor-thickness;
  return p.addScaledVector(right,x).addScaledVector(up,y);
 };
 const shell=(start:number,end:number,skin:'inner'|'outer'|'collar'|'inner-band',index:number)=>{
  const origin=course.sample(start),vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[];
  const angular=32,rows=Math.max(1,Math.ceil((end-start)/4)),offset=skin==='outer'?.45:skin==='collar'?.68:skin==='inner-band'?-.08:0;
  const ds=(end-start)/rows,da=Math.PI*2/angular,rimVertices:number[]=[],rimIndices:number[]=[],rimColors:number[]=[];
  const rim=(s0:number,a0:number,s1:number,a1:number)=>{
   const n=rimVertices.length/3;
   for(const [s,a,t]of [[s0,a0,-.035],[s1,a1,-.035],[s0,a0,.48],[s1,a1,.48]]){
    rimVertices.push(...arcPoint(s,a,t).sub(origin).toArray().map(round));
    const c=new THREE.Color('#713d20').lerp(new THREE.Color('#d78b42'),noise(s+a)*.7);rimColors.push(c.r,c.g,c.b);
   }
   rimIndices.push(n,n+1,n+2,n+2,n+1,n+3);
  };
  for(let j=0;j<=rows;j++){
   let arcLength=0,previous:THREE.Vector3|undefined;
   for(let i=0;i<=angular;i++){
    const s=start+(end-start)*j/rows,a=i/angular*Math.PI*2,point=arcPoint(s,a,offset).sub(origin);
    if(previous)arcLength+=point.distanceTo(previous);previous=point;
    vertices.push(...point.toArray().map(round));uvs.push(round(arcLength/5),round((s-WATERPARK_TUNNELS[index][0])/5));
    const shade=skin==='inner'?.9+.1*Math.max(0,-Math.sin(a)):.98;
    const col=new THREE.Color(skin==='collar'||skin==='inner-band'?'#ebdfba':skin==='inner'?'#bdcfbf':'#c2dcd3').multiplyScalar(shade);
    if(waterparkRoofOpening(s,a,index)||waterparkRoofOpening(s-3,a,index)||waterparkRoofOpening(s+3,a,index)||waterparkRoofOpening(s,a-.14,index)||waterparkRoofOpening(s,a+.14,index))col.lerp(new THREE.Color('#9f572a'),.74+noise(s+a)*.2);
    colors.push(col.r,col.g,col.b);
    if(j&&i){
     const midS=s-ds/2,midA=a-da/2;if(waterparkRoofOpening(midS,midA,index))continue;
     const b=j*(angular+1)+i,c=b-(angular+1);if(skin==='inner'||skin==='inner-band')indices.push(c-1,c,b-1,b-1,c,b);else indices.push(c-1,b-1,c,c,b-1,b);
     if(skin==='inner'){
      if(waterparkRoofOpening(midS-ds,midA,index))rim(s-ds,a-da,s-ds,a);
      if(waterparkRoofOpening(midS+ds,midA,index))rim(s,a-da,s,a);
      if(waterparkRoofOpening(midS,midA-da,index))rim(s-ds,a-da,s,a-da);
      if(waterparkRoofOpening(midS,midA+da,index))rim(s-ds,a,s,a);
     }
    }
   }
  }
  if(indices.length)add({t:'mesh',p:tuple(origin),vertices,indices,uvs,colors,tex:skin==='collar'||skin==='inner-band'?'solid':'waterslide-fiberglass',emissive:skin==='inner'?'#173d38':skin==='inner-band'?'#28271d':'#000000',solid:false,scenerySolid:skin==='inner',edgeGrinding:false,doubleSided:false,grp:434,nm:`Enclosed flume ${index+1} / ${skin}`});
  if(rimIndices.length)add({t:'mesh',p:tuple(origin),vertices:rimVertices,indices:rimIndices,colors:rimColors,tex:'solid',solid:false,scenerySolid:false,doubleSided:true,grp:434,nm:`Enclosed flume ${index+1} / corroded broken panel edges`});
 };
 for(const [index,[a,b]] of WATERPARK_TUNNELS.entries()){
  for(let s=a;s<b;s+=36){shell(s,Math.min(b,s+36),'inner',index);shell(s,Math.min(b,s+36),'outer',index);}
  // Compact climbing growth sits against the real liner, above the ride.
  // Reuse the same flowers as the entrances and old aqueduct piers.
  for(let s=a+10;s<b-5;s+=18){
   const side=Math.floor(s/18)%2?1:-1,at=arcPoint(s,side>0?Math.PI*.13:Math.PI*.87,-.09);
   at.y-=2.8;
   add({t:'decor',dkind:'bayvine',p:tuple(at),s:[3.4,5.7,1.6],yaw:yawToward(at,course.sample(s)),scenerySolid:false,grp:436,nm:'Island garden / sheltered flume vine'});
   if(Math.floor(s/18)%3===1){const p=at.clone();p.y+=1.5;
    add({t:'decor',dkind:'sunnyhibiscus',p:tuple(p),w:1.15,yaw:s*1.13,scenerySolid:false,grp:436,nm:'Island garden / upper-wall hibiscus'});
   }
  }
  const sun=new THREE.Vector3(...WATERPARK_ISLAND_LOOK.atmosphere!.sunDirection!).normalize();
  for(const g of WATERPARK_SKYLIGHTS.filter(g=>g.tunnel===index)){
   const top=arcPoint(g.s,g.angle,-.15),length=Math.max(6,(top.y-course.sample(g.s).y-2)/sun.y),base=top.clone().addScaledVector(sun,-length);
   add({t:'decor',dkind:'treehousetrialssunshaft',p:tuple(base),s:[4.5,length,.02],yaw:Math.atan2(sun.z,-sun.x)*180/Math.PI,amp:Math.acos(sun.y)*180/Math.PI,color:'#ffe4ad',scenerySolid:false,castShadow:false,grp:434,nm:`Enclosed flume ${index+1} / daylight through broken panel`});
   const lip=arcPoint(g.s+g.length*.35,g.angle,.42);lip.y-=3.8;
   add({t:'decor',dkind:'bayvine',p:tuple(lip),s:[2.2,4.3,1.1],yaw:g.s,scenerySolid:false,grp:436,nm:'Island garden / skylight trailing vine'});
  }
  for(let s=a;s<=b;s+=24){shell(Math.max(a,s-.25),Math.min(b,s+.25),'collar',index);shell(Math.max(a,s-.18),Math.min(b,s+.18),'inner-band',index);}
  for(const s of [a,b]){
   const f=course.tangent(s).setY(0).normalize();
   const outward=f.clone().multiplyScalar(s===a?-1:1);
   const rightFoot=arcPoint(s,0),leftFoot=arcPoint(s,Math.PI),centre=rightFoot.clone().add(leftFoot).multiplyScalar(.5);
   const radius=rightFoot.clone().sub(leftFoot).setY(0).length()/2;
   add({t:'decor',dkind:'waterparkportal',p:tuple(centre),w:radius*2,
    rise:arcPoint(s,Math.PI/2).y-centre.y,bank:(rightFoot.y-leftFoot.y)/2*(s===a?1:-1),
    yaw:Math.atan2(outward.x,outward.z)*180/Math.PI,seed:s,
    solid:false,scenerySolid:false,edgeGrinding:false,castShadow:true,grp:434,nm:`Enclosed flume ${index+1}`});
   for(const side of [-1,1]){const at=arcPoint(s,side>0?Math.PI*.22:Math.PI*.78,.45);
    if(safeScenery(at,3,6))add({t:'decor',dkind:'waterslidetropicalgrove',p:tuple(at),w:.45,yaw:s*1.13,scenerySolid:false,grp:434,nm:'Tunnel portal / roof-rooted banana leaves'});
    const hanging=at.clone();hanging.y-=4.8;
    add({t:'decor',dkind:'bayvine',p:tuple(hanging),s:[4.7,6.5,1.6],yaw:Math.atan2(outward.x,outward.z)*180/Math.PI,scenerySolid:false,grp:436,nm:'Island garden / three-dimensional portal vines'});
   }
  }
 }
 // A complete mossy volcanic spine occupies the empty centre of the falling
 // coils. Its measured radius stays inside their inner edges; no tiled map.
 const coil=samples.filter(a=>a.s>=3190&&a.s<=3710),cx=(Math.min(...coil.map(a=>a.p.x))+Math.max(...coil.map(a=>a.p.x)))/2,cz=(Math.min(...coil.map(a=>a.p.z))+Math.max(...coil.map(a=>a.p.z)))/2;
 const base=128,top=course.sample(3090).y+20,rv:number[]=[],ri:number[]=[],rc:number[]=[];
 for(let j=0;j<=32;j++)for(let i=0;i<=20;i++){
  const a=i/20*Math.PI*2,y=base+(top-base)*j/32,r=6.2+Math.sin(j*.65+a*3)*.8+Math.cos(a*5+j*.3)*.5;
  rv.push(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r);const color=new THREE.Color('#263f37').lerp(new THREE.Color('#687344'),noise(i+j*31)*.65);rc.push(color.r,color.g,color.b);
  if(i&&j){const b=j*21+i,c=b-21;ri.push(c-1,b-1,c,c,b-1,b);}
 }
 add({t:'mesh',p:[0,0,0],vertices:rv,indices:ri,colors:rc,tex:'solid',solid:true,outOfBounds:true,edgeGrinding:false,doubleSided:true,grp:432,nm:'Tropical gorge / central volcanic spine'});
 // Volumetric planted cliff masses frame the lower coils. The complete
 // footprint is checked against every stacked leg before a piece is placed.
 for(let s=3100;s<3960;s+=82){const p=course.sample(s),f=course.tangent(s).setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x),size=WATERSLIDE_ASSETS.waterslideplantedcliff.size;
  const scale=2.1,radius=Math.hypot(size[0],size[2])*scale/2,rootRadius=radius*1.25;
  for(const side of [-1,1]){const at=p.clone().addScaledVector(right,side*(course.width(s)/2+rootRadius+12));at.y-=size[1]*scale*.7;
   const bottom=at.clone().setY(122);
   if(!safeScenery(bottom,rootRadius,at.y+size[1]*scale-bottom.y))continue;
   add({t:'decor',dkind:'waterslideplantedcliff',p:tuple(at),w:scale,yaw:yawToward(at,p)+90,scenerySolid:false,grp:432,nm:'Tropical gorge / planted volcanic wall'});
   const vertices:number[]=[],indices:number[]=[],colors:number[]=[];
   for(let row=0;row<=4;row++)for(let k=0;k<=12;k++){
    const t=row/4,a=k/12*Math.PI*2,r=radius*(1.25-.25*t)*(1+Math.sin(a*3+row)*.045);
    vertices.push(Math.cos(a)*r,(at.y-bottom.y)*t,Math.sin(a)*r);
    const color=new THREE.Color('#4b6055').lerp(new THREE.Color('#7b896a'),noise(k+row*21+s)*.5);colors.push(color.r,color.g,color.b);
    if(row&&k){const b=row*13+k,c=b-13;indices.push(c-1,b-1,c,c,b-1,b);}
   }
   add({t:'mesh',p:tuple(bottom),vertices,indices,colors,tex:'solid',solid:false,scenerySolid:false,doubleSided:true,grp:432,nm:'Tropical gorge / continuous cliff root'});

  }
 }
 // Small living clusters on the real supported terraces, set outside the line.
 for(const deck of C.filter(c=>c.nm?.includes('maintenance apron')&&c.s)){
  const angle=(deck.yaw??0)*Math.PI/180;
  for(const side of [-1,1]){const p=new THREE.Vector3(side*(deck.s![0]/2-2),deck.s![1]/2,6).applyAxisAngle(up,angle).add(V(deck.p));
   if(safeScenery(p,2,5))add({t:'decor',dkind:'waterslidetropicalgrove',p:tuple(p),w:.38,yaw:(deck.yaw??0)+side*45,scenerySolid:false,grp:432,nm:'Service terrace / tropical regrowth'});
  }
 }
 const start=course.sample(0);
 for(const [x,z,yaw] of [[-23,-23,45],[-22,12,135]])add({t:'decor',dkind:'waterslidetropicalgrove',p:[start.x+x,start.y,start.z+z],w:.55,yaw,scenerySolid:true,grp:432,nm:'Ticket forecourt / planted rock garden'});
 for(const side of [-1,1])add({t:'decor',dkind:'waterslidetropicalgrove',p:[end.x+side*17,end.y,end.z-33],w:.55,yaw:side*45,scenerySolid:true,grp:432,nm:'Finish terrace / planted rock garden'});
 const planted=C.filter(c=>c.dkind==='waterslideplantedcliff'||c.dkind==='waterslidetropicalgrove');
 for(const c of C.filter(c=>c.nm==='Tropical forest / sculpted understory floor')){
  for(let i=0;i<c.vertices!.length;i+=3){const x=c.p[0]+c.vertices![i],z=c.p[2]+c.vertices![i+2];
   for(const plant of planted){const size=WATERSLIDE_ASSETS[plant.dkind as 'waterslideplantedcliff'|'waterslidetropicalgrove'].size,r=Math.hypot(size[0],size[2])*(plant.w??1)/2,d=Math.hypot(x-plant.p[0],z-plant.p[2]);
    if(d<r+44){const t=THREE.MathUtils.smoothstep(d,r+28,r+44),limit=THREE.MathUtils.lerp(plant.p[1]+.08,c.vertices![i+1]+c.p[1],t);c.vertices![i+1]=Math.min(c.vertices![i+1],limit-c.p[1]);}
   }
  }
 }
 // This surface fills the upper forest floor, not the walls of the lower
 // gorge. A planting cut can cross several stacked elevations; stretched
 // connecting faces read as giant paper sheets from the descending coils.
 // Keep those accepted return contacts buried, while the existing rooted
 // volcanic cliffs supply the visible wall. Ground tops are one-sided.
 for(const c of C.filter(c=>c.nm==='Tropical forest / sculpted understory floor')){
  const visible:number[]=[],buried:number[]=[],v=c.vertices!;
  for(let i=0;i<c.indices!.length;i+=3){
   const [a,b,d]=c.indices!.slice(i,i+3).map(k=>new THREE.Vector3(v[k*3],v[k*3+1],v[k*3+2]));
   const n=b.sub(a).cross(d.sub(a));
   (Math.hypot(n.x,n.z)>Math.abs(n.y)*2?buried:visible).push(...c.indices!.slice(i,i+3));
  }
  c.indices=visible;c.doubleSided=false;
  if(buried.length){
   const vertices:number[]=[],indices:number[]=[],ids=new Map<number,number>();
   for(const old of buried){let id=ids.get(old);if(id===undefined){id=vertices.length/3;ids.set(old,id);vertices.push(...v.slice(old*3,old*3+3));}indices.push(id);}
   add({t:'mesh',p:[...c.p],vertices,indices,tex:'solid',solid:true,outOfBounds:true,edgeGrinding:false,doubleSided:true,invisible:true,grp:432,nm:'Tropical forest / buried return surface'});
  }
 }
 // Root every surviving trestle in the finished sculpted terrain, after its
 // planting clearances have been cut. The old lower-course posts ran all the
 // way to sea level; these short footings cannot cross the stacked race legs.
 const terrain=C.filter(c=>c.nm==='Tropical forest / sculpted understory floor');
 const terrainY=(x:number,z:number)=>{
  const cell=terrain.find(c=>z<=c.p[2]&&z>=c.p[2]-160&&x>=-240&&x<=240);
  if(!cell)return null;
  const u=(x+240)/20,v=(cell.p[2]-z)/16,i=Math.min(23,Math.floor(u)),j=Math.min(9,Math.floor(v));
  const a=j*25+i,b=a+1,d=a+25,e=d+1,tx=u-i,tz=v-j,y=(k:number)=>cell.vertices![k*3+1]+cell.p[1];
  return tx+tz<=1?y(a)+(y(b)-y(a))*tx+(y(d)-y(a))*tz:y(e)+(y(d)-y(e))*(1-tx)+(y(b)-y(e))*(1-tz);
 };
 for(const support of C.filter(c=>c.dkind==='waterslideflumesupport')){
  const scale=support.w??1;
  for(const x of [-3.625,3.625])for(const z of [-2.072,2.072]){
   const foot=new THREE.Vector3(x*scale,0,z*scale).applyAxisAngle(up,(support.yaw??0)*Math.PI/180).add(V(support.p));
   const ground=terrainY(foot.x,foot.z);if(ground===null||ground>=foot.y)continue;
   const width=Math.max(1.2,scale*.5),bottom=ground-.3,height=foot.y+.25-bottom;
   if(!safeScenery(foot.clone().setY(bottom),width/2,height))continue;
   for(let i=C.length-1;i>=0;i--)if(C[i].nm==='Weathered structural column'&&Math.hypot(C[i].p[0]-foot.x,C[i].p[2]-foot.z)<.02)C.splice(i,1);
   add({t:'decor',dkind:'block',p:tuple(foot.clone().setY(bottom+height/2)),s:[width,height,width],tex:'metal',color:'#799591',scenerySolid:false,grp:430,nm:'Weathered structural column'});
  }
 }

 // The former cylindrical visual skirts looked like flat walls from the coils.
 // Their replacement is the independently grounded, textured island geology.
 // Keep the earlier terrain-root calculation identical before retiring them.
 for(let i=C.length-1;i>=0;i--)if(C[i].nm==='Tropical gorge / continuous cliff root'||C[i].nm==='Tropical gorge / planted volcanic wall')C.splice(i,1);

}
