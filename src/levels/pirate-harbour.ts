import * as THREE from 'three';
import type { CustomComponent, CustomOceanData } from '../level';
import { DROWNED_CROWN_MODELS } from '../drownedCrownAssets.generated';
import { DROWNED_CROWN_EXCELLENCE_MODELS } from '../drownedCrownExcellence.generated';
import { DROWNED_HERO_HEADLAND_POSITION, DROWNED_HERO_HEADLAND_ANCHORS } from '../drownedCrownHeadland.generated';
import { pirateMeshes, type P } from './pirate-meshes';

const C:CustomComponent[]=[],M=pirateMeshes(C);
let grp=8;
const add=(c:CustomComponent)=>C.push({grp,...c});
const section=(n:number)=>{grp=n;M.setGroup(n);};
const sea=-10;
export const HARBOUR_SPAWN:P=[-72,-5.88,205];
export const HARBOUR_ROUTE:P[]=[[-72,-6,210],[-71.5,-6,193],[-69.2,-6,181],[-58,-6,165],[-59.4,-6,144],[-57,-6,139],[-59,-6,127],[-43,-5.5,112],[-43,-5.5,91],[-48,-3,74],[-48,-1.4,60],[-48,0,48]];
export const HARBOUR_OCEAN:CustomOceanData={geometryVersion:2,look:'pirate-harbour',shoreGeometry:'ground',p:[-18,sea,-362],length:370,yaw:-90,seaward:1,width:1020,overlap:8,
 longitudinalSegments:120,lateralSegments:100,sourceCoordinates:'three',extendTails:true,horizonMode:'shoreline',horizonOffset:418};

function model(kind:keyof typeof DROWNED_CROWN_MODELS,p:P,scale=1,yaw=0){
 const spec=DROWNED_CROWN_MODELS[kind];add({t:'decor',dkind:kind,p,s:spec.size.map(n=>n*scale) as P,yaw,nm:spec.label});
}
function boardwalk(nm:string,points:P[],widths:number[],rails=false){
 const p=points[0];add({t:'woodpath',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),w:widths[0],widths,
 s:[widths[0],.35,1],curve:'spline',structureStyle:'beach',scaffold:true,supports:true,rails,
 supportBaseY:-12.3,supportDepth:6.3,terrainSupports:false,baySpacing:4.8,spacing:.74,
 plankPalette:'drowned-original-planks',polePalette:'rustic-timber-rope',tex:'crown-timber',color:'#cebb9c',nm});
}
function fruit(a:P,b:P,count=4){for(let i=0;i<count;i++){const t=i/(count-1);add({t:'wumpa',p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+.9,a[2]+(b[2]-a[2])*t]});}}
function mesh(name:string,g:THREE.BufferGeometry,tex:string,tint:string,solid=false){
 if(tex==='crown-limestone')tex='solid';
 const geometry=g.index?g.toNonIndexed():g,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv:number[]=[];
 for(let i=0;i<p.count;i++){
  const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
  uv.push((nx>nz&&nx>ny?p.getZ(i):p.getX(i))/4.3,(ny>nx&&ny>nz?p.getZ(i):p.getY(i))/4.3);
 }
 // Weld equal position/normal/UV corners before saving editor data. Small
 // rope rings and chamfered stones must not duplicate every triangle vertex.
 for(let start=0;start<p.count;start+=3996){
  const count=Math.min(3996,p.count-start),vertices:number[]=[],normals:number[]=[],texcoords:number[]=[],indices:number[]=[],lookup=new Map<string,number>();
  for(let i=start;i<start+count;i++){
   const values=[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv[i*2],uv[i*2+1]].map(v=>Math.round(v*10000)/10000),key=values.join(',');
   let index=lookup.get(key);if(index===undefined){index=vertices.length/3;vertices.push(...values.slice(0,3));normals.push(...values.slice(3,6));texcoords.push(...values.slice(6));lookup.set(key,index);}indices.push(index);
  }
  add({t:'mesh',p:[0,0,0],vertices,normals,uvs:texcoords,indices,tex,color:tint,solid,...(solid?{solidSides:true}:{}),scenerySolid:solid,doubleSided:true,nm:name});
 }
 geometry.dispose();if(geometry!==g)g.dispose();
}
function chamferedStone(p:P,size:P,yaw:number,tint:string){
 const bevel=.09,shape=new THREE.Shape(),w=size[0],h=size[1],d=size[2];
 shape.moveTo(-w/2+bevel,-h/2+bevel);shape.lineTo(w/2-bevel,-h/2+bevel);shape.lineTo(w/2-bevel,h/2-bevel);shape.lineTo(-w/2+bevel,h/2-bevel);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.1,d-bevel*2),steps:1,bevelEnabled:true,bevelSegments:1,bevelThickness:bevel,bevelSize:bevel,curveSegments:1});
 g.translate(0,0,-d/2+bevel);g.rotateY(yaw);g.translate(...p);mesh('Harbour · worn curved quay stones',g,'crown-limestone',tint);
}
function beam(name:string,a:P,b:P,r:number,tex='crown-timber',color='#d8c6a4'){
 const d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.CylinderGeometry(r*.86,r,d.length(),9);
 g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.map((v,i)=>(v+b[i])/2) as P);mesh(name,g,tex,color);
}
function rope(name:string,a:P,b:P,sag:number,r=.045){
 let before=a;
 for(let i=1;i<=8;i++){const t=i/8,after=a.map((v,j)=>v+(b[j]-v)*t-(j===1?Math.sin(t*Math.PI)*sag:0)) as P;beam(name,before,after,r,'solid','#a59877');before=after;}
}
function lampPost(x:number,y:number,z:number,lean=0){
 beam('Harbour · rooted mooring timber',[x,sea-1.5,z],[x+lean,y+1.35,z+.06],.28);
 for(let i=0;i<3;i++){
  const g=new THREE.TorusGeometry(.29,.058,5,12);g.rotateX(Math.PI/2);g.translate(x+lean*.8,y+.65+i*.115,z);
  mesh('Harbour · rope collars',g,'solid','#b7a685');
 }
 model('crownbrasslantern',[x+lean,y+1.4,z+.06],.4,75);
}

section(8);
add({t:'camnode',p:[-63,-3,184],s:[68,30,100],cameraView:true,cameraPosition:[-72,-1,216],cameraTarget:[-67,-4,170],cameraFollowDistance:11,cameraFollowTargetHeight:3,cameraFov:63,radius:8,cameraPresentationOnly:true,nm:'Harbour · compose the fort above the waterfront'});
boardwalk('Customs quay · curved waterfront',[[-72,-6,216],[-72,-6,205],[-71.5,-6,193],[-69.2,-6,181]],[6.4,5.7,5.4,5.8]);
boardwalk('Quayside dogleg',[[-69.2,-6,182],[-64.5,-6,174],[-58,-6,164]],[5.8,5,5.4]);
boardwalk('Cargo jetty · first near bank',[[-58,-6,165],[-57,-6,159],[-57,-6,153]],[5.4,4.8,5.2]);
boardwalk('Cargo jetty · first far bank',[[-57,-6,150.5],[-59.4,-6,144],[-57,-6,134]],[5.2,10.8,5]);
fruit([-72,-6,200],[-71.5,-6,189]);fruit([-69,-6,180],[-59,-6,166]);fruit([-57,-6,155],[-57,-6,146]);
add({t:'crate',p:[-72.4,-6,189],kind:'wood',nm:'Customs dock supplies'});
model('crowncargostack',[-74.2,-6,207],.43,15);model('crowncargostack',[-74.0,-6,198],.34,-20);
for(const [x,y,z] of [[-68.75,-6,211],[-68.4,-6,199],[-66.1,-6,183],[-59.7,-6,162],[-60,-6,142]] as P[])lampPost(x,y,z,.09);

// A crescent of inhabited shore with irregular ends, not a rectangular stage.
const coastKnots:P[]=[[-76.4,-4.7,227],[-75.8,-4.7,216],[-74.75,-4.7,203],[-74.3,-4.7,192],[-72.2,-4.7,181],[-68.2,-4.7,173],[-62.5,-4.7,166],[-66.3,-4.7,152],[-74,-4.7,138],[-84,-4.7,122],[-102,-4.7,117],[-120,-4.7,128],[-132,-4.7,152],[-134,-4.7,183],[-127,-4.7,208],[-109,-4.7,228],[-90,-4.7,233]];
const coast=new THREE.CatmullRomCurve3(coastKnots.map(p=>new THREE.Vector3(...p)),true,'centripetal');
const ring=coast.getSpacedPoints(120).slice(0,-1),outline=ring.map(p=>new THREE.Vector2(p.x,p.z)),faces=THREE.ShapeUtils.triangulateShape(outline,[]);
const top:number[]=[],edge:number[]=[];
const yAt=(x:number,z:number)=>-4.7+Math.sin(x*.21+z*.16)*.045;
for(const ids of faces){const p=ids.map(i=>[ring[i].x,yAt(ring[i].x,ring[i].z),ring[i].z] as P);
 const a=new THREE.Vector3(...p[1]).sub(new THREE.Vector3(...p[0])),b=new THREE.Vector3(...p[2]).sub(new THREE.Vector3(...p[0]));if(a.cross(b).y<0)p.reverse();top.push(...p.flat());}
for(let i=0;i<ring.length;i++){
 const a=ring[i],b=ring[(i+1)%ring.length],pa:P=[a.x,-4.75,a.z],pb:P=[b.x,-4.75,b.z],qa:P=[-104+(a.x+104)*1.045,-14,a.z],qb:P=[-104+(b.x+104)*1.045,-14,b.z];
 edge.push(...pa,...qa,...qb,...pa,...qb,...pb);
}
for(const [name,v,tex,tint] of [['Harbour · crescent customs shore',top,'solid','#b5a584'],['Harbour · eroded quay foundation',edge,'crown-limestone','#b6b9a7']] as [string,number[],string,string][]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();mesh(name,g,tex,tint,true);}
// Stone courses follow the curved tidal edge; each coping stone is chamfered.
const waterfront=new THREE.CatmullRomCurve3(coastKnots.slice(0,10).map(p=>new THREE.Vector3(...p)),false,'centripetal');
const count=Math.ceil(waterfront.getLength()/1.72);
for(let i=0;i<=count;i++){
 const t=i/count,p=waterfront.getPointAt(t),d=waterfront.getTangentAt(t),yaw=Math.atan2(d.x,d.z),shade=i%3===0?'#dfd7bb':i%3===1?'#c2c2ac':'#d1c9ae';
 chamferedStone([p.x,yAt(p.x,p.z)+.05,p.z],[.85,.35,1.68],yaw,shade);
 for(let row=0;row<2;row++){
  const q=waterfront.getPointAt(Math.min(1,(i+(row%2)*.45)/count));
  chamferedStone([q.x,-5.18-row*.61,q.z],[.62,.6,1.65],yaw,'#bdbba5');
 }
}
// Human-scale warehouses turn with the shore. Back rows make an inhabited town.
for(const [x,z,scale,yaw] of [[-84.3,214,.7,88],[-89.5,195,.69,101],[-81.6,175,.64,128],[-101,217,.77,12],[-108,191,.8,78],[-98,165,.77,114],[-113,150,.64,40]] as [number,number,number,number][])
 model('crownwarehouse',[x,-4.68,z],scale,yaw);
for(const [x,z,scale,yaw] of [[-78.3,205,.64,240],[-78.5,184,.68,100],[-72,169,.52,45],[-97,211,.68,30],[-111,178,.75,130],[-89,135,.66,70],[-119,204,.71,10]] as [number,number,number,number][])
 model('crowntropicalpalm',[x,-4.64,z],scale,yaw);
for(const [x,z,yaw] of [[-77.8,211,20],[-81.5,190,55],[-76,179,-10],[-92,199,50]] as [number,number,number][])
 model('crowncargostack',[x,-4.62,z],.39,yaw);
// Potted greenery breaks the paving at roots and shaded doorways.
for(const [x,z] of [[-79.6,205],[-81.5,213],[-86,190],[-78,178],[-100,210],[-110,177]])
 add({t:'decor',dkind:'baypot',p:[x,-4.67,z],s:[1.1,1.02,1],yaw:x*13,nm:'Harbour · planted doorway'});

// Three working storefronts: cloth shade, grounded posts and cargo kept
// together on the quay, leaving the boardwalk's travel corridor open.
for(const [x,z,w,d,yaw,tint] of [[-79,206,7.2,4.8,0,'#d99a82'],[-83,187,6.8,4.4,-11,'#cead71'],[-76,169,6.4,4.2,21,'#cb8e79']] as [number,number,number,number,number,string][]){
 const y=-.2,a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const at=(u:number,v:number,h:number):P=>[x+c*u+s*v,h,z-s*u+c*v];
 add({t:'decor',dkind:'trialsv2awning',p:[x,y,z],s:[w,1,d],yaw,color:tint,scenerySolid:false,nm:'Harbour · shaded customs loading bay'});
 const front=[at(w*.48,-d*.43,-4.75),at(w*.48,d*.43,-4.75)];
 for(const p of front)beam('Harbour · awning post',p,[p[0],.7,p[2]],.16,'solid','#906741');
 beam('Harbour · awning front bearer',[front[0][0],.65,front[0][2]],[front[1][0],.65,front[1][2]],.13,'solid','#aa7e4f');
 model('crowncargostack',at(.6,.2,-4.74),.68,yaw+12);
 model('crowncargostack',at(-1.6,-d*.5-1.0,-4.74),.37,yaw-24);
 const lamp=at(w*.48,-d*.32,-1.2);
 model('crownbrasslantern',lamp,.44,yaw+90);
 rope('Harbour · hanging lamp cord',[lamp[0],.65,lamp[2]],[lamp[0],-.5,lamp[2]],0,.028);
 add({t:'torch',p:lamp,rise:.28,w:.22,nm:'Harbour · shaded storefront lantern'});
}

section(9);
boardwalk('Cargo jetty · second far bank',[[-59,-6,131],[-59,-6,127],[-50,-5.8,120],[-43,-5.5,112]],[5,5.8,4.4,5]);
boardwalk('Fort wharf · third near bank',[[-43,-5.5,113],[-42.7,-5.5,108],[-43,-5.5,103]],[5,4.5,4.9]);
boardwalk('Fort wharf · third far bank',[[-43,-5.5,100],[-43,-5.5,94],[-43,-5.5,89]],[4.9,5.5,5.2]);
add({t:'checkpoint',p:[-55.5,-6,138],nm:'Harbour · cargo jetty'});
fruit([-57,-6,136],[-59,-6,127]);fruit([-43,-5.5,105],[-43,-5.5,96]);
boardwalk('Optional salvage balance beam',[[-59,-6,146],[-64,-5.2,133],[-61.7,-6,126.5]],[1.6,1.45,1.6]);
add({t:'rail',p:[-63.4,-4.92,134],len:15,yaw:15,nm:'Salvaged spar grind'});
// A cargo crane founded on irregular coastal masonry alongside the landing.
add({t:'decor',dkind:'crowncavernbuttress',p:[-65,-12,142],s:[7.2,6.2,7.2],yaw:73,nm:'Harbour · eroded crane rock footing'});
beam('Harbour · crane upright',[-65,-10.5,142],[-65,5.8,142],.4);
beam('Harbour · crane cantilever',[-66,4.8,142],[-50,4.1,143],.31);
beam('Harbour · crane angled brace',[-65,-1.4,142],[-57,4.5,142.5],.25);
rope('Harbour · crane stays',[-65,5.8,142],[-50,4.1,143],.3,.06);
rope('Harbour · hanging tackle',[-50,4.1,143],[-50,-3.2,143],0,.065);
model('crowncargostack',[-50,-4.3,143],.47,20);
model('crowncargostack',[-62.3,-6,144],.58,12);
for(const [x,y,z] of [[-60,-6,150.5],[-54.5,-6,134],[-59.7,-6,131],[-45.8,-5.5,103],[-40.3,-5.5,100]] as P[])lampPost(x,y,z,-.05);
model('crowncargolighter',[-49.5,-10.7,198],.87,-13);model('crowncargolighter',[-19,-10.4,135],.85,20);
rope('Harbour · lighter bow mooring',[-50,-8.3,190],[-67,-5,193],.9,.055);
rope('Harbour · lighter stern mooring',[-51.8,-8.3,205],[-69,-5,211],.7,.055);

section(10);
boardwalk('Fort wall boardwalk',[[-43,-5.5,90],[-46,-4.3,82],[-48,-3,74],[-48,-1.4,60],[-48,0,47]],[5.2,4.6,4.3,5.3,5.8],true);
add({t:'checkpoint',p:[-48,-1.4,60],nm:'Harbour · smugglers sea gate'});
fruit([-48,-2.8,72],[-48,-.3,51]);lampPost(-51.2,-1.4,59);
// Near rock shoulders carry a genuinely open gate. The hero headland sits
// behind this close, independently collidable entrance when it is available.
for(const [x,yaw] of [[-59,62],[-37,-62]]){
 add({t:'decor',dkind:'crowncavernbuttress',p:[x,-14,72],s:[15,25.3,10],yaw,nm:'Harbour · eroded sea-gate shoulder'});
}
add({t:'decor',dkind:'crownheroheadland',p:[...DROWNED_HERO_HEADLAND_POSITION],s:[...DROWNED_CROWN_EXCELLENCE_MODELS.crownheroheadland.size],nm:'Harbour · carved limestone promontory'});
for(const [i,p] of DROWNED_HERO_HEADLAND_ANCHORS.entries()){
 if(i<2)model('crownfortbastion',[...p],i===0?1.05:1,i===0?18:-12);
 else model('crowntropicalpalm',[...p],.34+(i%3)*.04,i*63);
}
beam('Harbour · sea gate oak lintel',[-54,7,73],[-42,7,73],.36);
for(const x of [-54,-42])beam('Harbour · sea gate brace',[x,-3,73],[x,7,73],.28);
add({t:'pit',p:[-20,-10.2,166],s:[340,1,230],invisible:true,nm:'Harbour deep water'});
// The far waterfront occupies actual distance; its irregular alpha edge is
// backed by the same sea horizon, not used as a foreground scenery wall.
add({t:'decor',dkind:'crownharbourmatte',p:[-178,-30.13,139],s:[265,88.33,.02],yaw:72,nm:'Port Royal distant waterfront'});
add({t:'decor',dkind:'crownharbourmatte',p:[65,-34.31,350],s:[320,106.67,.02],yaw:180,nm:'Harbour far shore'});
export const PIRATE_HARBOUR_COMPONENTS=C;
