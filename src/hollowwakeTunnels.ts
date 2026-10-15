import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {createJungleAssetScope,type Template} from './jungleAssets';
import type {CustomComponent} from './level';

type Node={p:THREE.Vector3;r:number;d?:THREE.Vector3};
type Bore={c:CustomComponent;nodes:Node[];box:THREE.Box3;group:THREE.Group;near?:THREE.Mesh;far?:THREE.Mesh;floor?:THREE.Mesh};
type Lamp={p:THREE.Vector3;color:THREE.Color;power:number;range:number;target?:THREE.Vector3};
const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const TAU=Math.PI*2;
function nodes(c:CustomComponent):Node[]{return(c.pts??[]).map((p,i)=>({p:new THREE.Vector3(c.p[0]+p[0],c.p[1]+(p[3]??0),c.p[2]+p[1]),r:c.widths?.[i]??c.radius??13,d:p[4]===undefined?undefined:new THREE.Vector3(-Math.sin(p[4]*Math.PI/180),0,-Math.cos(p[4]*Math.PI/180))}));}
function sample(path:Node[],t:number){const n=clamp(t,0,1)*(path.length-1),i=Math.min(path.length-2,Math.floor(n)),f=n-i,a=path[i],b=path[i+1];return{p:a.p.clone().lerp(b.p,f),r:mix(a.r,b.r,f),d:a.d&&b.d?a.d.clone().lerp(b.d,f).normalize():b.p.clone().sub(a.p).setY(0).normalize()};}
function distanceToBore(p:THREE.Vector3,b:Bore):number{
 let best=Infinity;
 for(let i=1;i<b.nodes.length;i++){
  const a=b.nodes[i-1],z=b.nodes[i],dx=z.p.x-a.p.x,dz=z.p.z-a.p.z,n=dx*dx+dz*dz;
  const f=clamp(((p.x-a.p.x)*dx+(p.z-a.p.z)*dz)/Math.max(n,1e-10),0,1),r=mix(a.r,z.r,f),x=mix(a.p.x,z.p.x,f),y=mix(a.p.y,z.p.y,f)+r,zz=mix(a.p.z,z.p.z,f);
  best=Math.min(best,Math.hypot(p.x-x,p.z-zz,p.y-y)-r);
 }
 const first=b.nodes[0],last=b.nodes[b.nodes.length-1],start=first.d??b.nodes[1].p.clone().sub(first.p).setY(0).normalize(),end=last.d??last.p.clone().sub(b.nodes[b.nodes.length-2].p).setY(0).normalize();
 // Finite end-cap distances are essential: Infinity-to-inside interpolation
 // produces NaN vertices where neighbouring branch modules begin/end.
 return Math.max(best,-((p.x-first.p.x)*start.x+(p.z-first.p.z)*start.z),(p.x-last.p.x)*end.x+(p.z-last.p.z)*end.z);
}
/** Cut the generated mesh, interpolating its ORIGINAL UVs at each cut. */
type Vertex={p:THREE.Vector3;uv:THREE.Vector2};
function cut(poly:Vertex[],distance:(v:Vertex)=>number):Vertex[]{
 const out:Vertex[]=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b),inside=da>=0;
  if(inside)out.push(a);
  if(inside!==(db>=0)){const f=da/(da-db);out.push({p:a.p.clone().lerp(b.p,f),uv:a.uv.clone().lerp(b.uv,f)});}
 }return out;
}
function geometry(polygons:Vertex[][]):THREE.BufferGeometry{
 const p:number[]=[],uv:number[]=[];
 for(const poly of polygons)for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]]){p.push(v.p.x,v.p.y,v.p.z);uv.push(v.uv.x,v.uv.y);}
 if(!p.every(Number.isFinite)||!uv.every(Number.isFinite))throw Error('Non-finite fitted Hollowwake surface');
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
/** Fit the delivered Meshy bore to a circular clearance envelope. This retains
 * its rock faces and painted UVs; it is not a generated tube with a tiled skin.
 * Ray measurements compensate the source's taper before bending it to a route. */
function measuredBore(source:THREE.BufferGeometry):Vertex[][]{
 const g=source.clone();(g as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree=new MeshBVH(g);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,material);mesh.raycast=acceleratedRaycast;
 mesh.updateMatrixWorld(true);const ray=new THREE.Raycaster(),angles=96,rows=49,profile=new Float32Array(angles*rows);
 for(let j=0;j<rows;j++)for(let i=0;i<angles;i++){
  const a=i*TAU/angles;ray.set(new THREE.Vector3(0,.5,-.34+.68*j/(rows-1)),new THREE.Vector3(Math.sin(a),-Math.cos(a),0));ray.far=1;
  const h=ray.intersectObject(mesh,false)[0];profile[j*angles+i]=h?.distance??.28;
 }
 const inner=(z:number,a:number)=>{
  const row=clamp((z+.34)/.68*(rows-1),0,rows-1.0001),j=Math.floor(row),col=((a/TAU+1)%1)*angles,i=Math.floor(col),f=col-i;
  return mix(mix(profile[j*angles+i],profile[j*angles+(i+1)%angles],f),mix(profile[(j+1)*angles+i],profile[(j+1)*angles+(i+1)%angles],f),row-j);
 };
 const position=source.getAttribute('position'),uv=source.getAttribute('uv'),index=source.index,polygons:Vertex[][]=[];
 for(let j=0;j<(index?.count??position.count);j+=3){
  let poly=[0,1,2].map(n=>{const i=index?index.getX(j+n):j+n;return{p:new THREE.Vector3().fromBufferAttribute(position,i),uv:new THREE.Vector2(uv.getX(i),uv.getY(i))};});
  poly=cut(cut(poly,v=>v.p.z+.32),v=>.32-v.p.z);
  if(poly.length<3)continue;
  for(const v of poly){
   const x=v.p.x,y=v.p.y-.5,a=Math.atan2(x,-y),rho=Math.hypot(x,y),base=inner(v.p.z,a),delta=rho-base;
   // Inner rock relief remains outward of the physical riding surface.
   const relief=delta<.04?.016+delta*.35:.03+(delta-.04)*1.9;
   const seam=THREE.MathUtils.smoothstep(.32-Math.abs(v.p.z),0,.035);
   const radius=1+relief*seam;v.p.set(Math.sin(a)*radius,-Math.cos(a)*radius,(.32-v.p.z)/.64);
  }
  polygons.push(poly);
 }
 g.dispose();material.dispose();return polygons;
}
/** Bend the original Merchant Wreck floor sculpture into the riding arc.
 * Tessellation only refines its existing faces and interpolates authored UVs. */
function measuredFloor(source:THREE.BufferGeometry):Vertex[][]{
 const p=source.getAttribute('position'),uv=source.getAttribute('uv'),index=source.index,result:Vertex[][]=[];
 const probeGeometry=source.clone();(probeGeometry as THREE.BufferGeometry&{boundsTree:MeshBVH}).boundsTree=new MeshBVH(probeGeometry);const probeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),probe=new THREE.Mesh(probeGeometry,probeMaterial),ray=new THREE.Raycaster();probe.raycast=acceleratedRaycast;probe.updateMatrixWorld(true);
 const split=(tri:Vertex[],depth=0)=>{
  // Uniform subdivision keeps shared edges identical after circular bending.
  // Adaptive per-face splits create T-junction cracks on the curved surface.
  if(depth<3){
   const mid=tri.map((v,i)=>({p:v.p.clone().lerp(tri[(i+1)%3].p,.5),uv:v.uv.clone().lerp(tri[(i+1)%3].uv,.5)}));
   for(const t of [[tri[0],mid[0],mid[2]],[mid[0],tri[1],mid[1]],[mid[2],mid[1],tri[2]],[mid[0],mid[1],mid[2]]])split(t,depth+1);return;
  }
  result.push(tri.map(v=>{const x=v.p.x/.30*.85,z=(.30-v.p.z)/.60,seam=THREE.MathUtils.smoothstep(Math.min(z,1-z),0,.06),r=1+(1-v.p.y)*.02*seam*THREE.MathUtils.smoothstep(.85-Math.abs(x),0,.12);return{p:new THREE.Vector3(x*r,-Math.sqrt(1-x*x)*r,z),uv:v.uv.clone()};}));
 };
 for(let i=0;i<(index?.count??p.count);i+=3){
  let tri=[0,1,2].map(k=>{const n=index?index.getX(i+k):i+k;return{p:new THREE.Vector3().fromBufferAttribute(p,n),uv:new THREE.Vector2(uv.getX(n),uv.getY(n))};});
  const normal=tri[1].p.clone().sub(tri[0].p).cross(tri[2].p.clone().sub(tri[0].p));if(normal.y<=0)continue;
  const centre=tri[0].p.clone().add(tri[1].p).add(tri[2].p).multiplyScalar(1/3);ray.set(new THREE.Vector3(centre.x,2,centre.z),new THREE.Vector3(0,-1,0));const highest=ray.intersectObject(probe,false)[0];if(highest&&highest.point.y>centre.y+.0002)continue;
  for(const distance of [(v:Vertex)=>v.p.x+.30,(v:Vertex)=>.30-v.p.x,(v:Vertex)=>v.p.z+.30,(v:Vertex)=>.30-v.p.z])tri=cut(tri,distance);
  for(let j=1;j<tri.length-1;j++)split([tri[0],tri[j],tri[j+1]]);
 }
 probeGeometry.dispose();probeMaterial.dispose();return result;
}
function fit(source:Vertex[][],b:Bore,others:Bore[],floor=false):THREE.BufferGeometry{
 const rotation=floor?0:((b.c.seed??0)%6)*Math.PI/3,cs=Math.cos(rotation),sn=Math.sin(rotation),polys:Vertex[][]=[];
 const lo=b.c.phase??0,span=(b.c.len??24)/24,hi=lo+span;
 for(const original of source){
  const raw=cut(cut(original,v=>v.p.z-lo),v=>hi-v.p.z);if(raw.length<3)continue;
  let poly=raw.map(v=>{
   const q=sample(b.nodes,(v.p.z-lo)/span),x=v.p.x*cs-v.p.y*sn,y=v.p.x*sn+v.p.y*cs;
   // Flatten only sub-centimetre floor relief onto the seamless collider.
   const rho=Math.hypot(x,y),bottom=clamp((-y/rho-.6)/.3,0,1),scale=rho<1.07?1+(rho-1)*(1-bottom*.8):rho;
   const radial=floor?q.r*(1.002+rho-1):q.r*scale+3.5*THREE.MathUtils.smoothstep(.55+y/rho,0,.45);return{p:new THREE.Vector3(q.p.x-q.d.z*x/rho*radial,q.p.y+q.r+y/rho*radial,q.p.z+q.d.x*x/rho*radial),uv:v.uv.clone()};
  });
  const mid=sample(b.nodes,(raw.reduce((s,v)=>s+v.p.z,0)/raw.length-lo)/span);
  if(!floor)poly=cut(poly,v=>v.p.y-(mid.p.y+mid.r*(1-(b.c.openFloor?.55:.64))));
  if(!floor&&b.c.arc)poly=cut(poly,v=>mid.p.y+mid.r+(mid.r+3.5)*Math.cos(b.c.arc!*Math.PI/360)-v.p.y);
  for(const other of others){if(poly.length<3)break;poly=cut(poly,v=>distanceToBore(v.p,other)+.018);}
  if(poly.length>=3)polys.push(poly);
 }
 const g=geometry(polys),positions=g.getAttribute('position'),normals=g.getAttribute('normal');
 // Clipping duplicates UV vertices. Restore the smooth inward tunnel normals
 // instead of shading every clipped triangle as a separate sharp facet.
 for(let v=0;v<positions.count;v++){
  const p=new THREE.Vector3().fromBufferAttribute(positions,v);let best=Infinity,centre=new THREE.Vector3();
  for(let i=1;i<b.nodes.length;i++){
   const a=b.nodes[i-1],z=b.nodes[i],d=z.p.clone().sub(a.p),f=clamp(((p.x-a.p.x)*d.x+(p.z-a.p.z)*d.z)/(d.x*d.x+d.z*d.z),0,1),q=a.p.clone().lerp(z.p,f),ds=(p.x-q.x)**2+(p.z-q.z)**2;
   if(ds<best){best=ds;centre.copy(q);centre.y+=mix(a.r,z.r,f);}
  }
  centre.sub(p).normalize();normals.setXYZ(v,centre.x,centre.y,centre.z);
 }
 return g;
}
export class HollowwakeTunnels{
 readonly root=new THREE.Group();private scope=createJungleAssetScope();private bores:Bore[]=[];private lamps:Lamp[]=[];
 private lights=Array.from({length:4},()=>new THREE.PointLight(0,0,30,2));private shafts=Array.from({length:2},()=>new THREE.SpotLight(0,0,80,.56,.7,2));private material?:THREE.MeshStandardMaterial;private floorMaterial?:THREE.MeshStandardMaterial;
 private pending?:Promise<void>;private disposed=false;private failures:string[]=[];
 constructor(){this.root.name='Hollowwake generated tunnel interiors';for(const l of this.lights)this.root.add(l);for(const [i,l]of this.shafts.entries()){l.castShadow=i===0;l.shadow.mapSize.set(1024,1024);l.shadow.camera.near=.5;l.shadow.bias=-.00015;l.shadow.normalBias=.04;this.root.add(l,l.target);}}
 add(c:CustomComponent):void{
  const path=nodes(c);if(path.length<2)return;const group=new THREE.Group();group.name=c.nm??'Fitted Meshy bore';group.userData.hollowwakeBore=true;
  const box=new THREE.Box3().setFromPoints(path.map(n=>n.p)).expandByScalar(Math.max(...path.map(n=>n.r))*2);
  this.bores.push({c,nodes:path,box,group});this.root.add(group);
  if(c.arc){const q=sample(path,.5);this.lamps.push({p:q.p.clone().add(new THREE.Vector3(-2,q.r*2.3,0)),target:q.p.clone().addScaledVector(q.d,7),color:new THREE.Color(c.color??'#d5e3ea'),power:2100,range:q.r*6});}
 }
 addGlow(c:CustomComponent):void{const h=(c.s?.[1]??2.1)*(c.w??1);this.lamps.push({p:new THREE.Vector3(...c.p).add(new THREE.Vector3(0,h*.75,0)),color:new THREE.Color('#48bfd0'),power:38,range:18});}
 ready():Promise<void>{return this.pending??=Promise.all([this.scope.load('hollowcavebore'),this.scope.load('crowngrottofloor')]).then(async ([template,floorTemplate])=>{
  if(this.disposed)return;this.material=this.makeMaterial(template);this.floorMaterial=new THREE.MeshStandardMaterial({map:floorTemplate.map,normalMap:floorTemplate.normalMap,normalScale:new THREE.Vector2(.1,.1),roughness:.94,color:'#abb9bf'});this.floorMaterial.userData.jungleAsset=true;
  const near=measuredBore(template.geometry),far=measuredBore(template.lodGeometry??template.geometry),floor=measuredFloor(floorTemplate.geometry);
  let built=0;for(const b of this.bores){if(++built%8===0)await new Promise(resolve=>setTimeout(resolve,0));if(this.disposed)return;const others=b.c.vr?this.bores.filter(o=>o!==b&&o.c.vr&&o.c.vr!==b.c.vr&&b.box.intersectsBox(o.box)):[];
   b.near=new THREE.Mesh(fit(near,b,others),this.material);b.far=new THREE.Mesh(fit(far,b,others),this.material);
   for(const m of [b.near,b.far]){m.receiveShadow=true;m.userData.hollowwakeBore=true;b.group.add(m);}b.far.visible=false;
   if(!b.c.openFloor){b.floor=new THREE.Mesh(fit(floor,b,others,true),this.floorMaterial);b.floor.receiveShadow=true;b.floor.userData.hollowwakeBore=true;b.group.add(b.floor);}
  }
 }).catch(error=>{if(this.disposed)return;this.failures.push(String(error));console.error('Hollowwake tunnel asset failed',error);});}
 private makeMaterial(t:Template){const m=new THREE.MeshStandardMaterial({map:t.map,normalMap:t.normalMap,normalScale:new THREE.Vector2(.12,.12),roughness:.96,metalness:0,color:'#b8c3d2',side:THREE.DoubleSide});m.name='Hollowwake original painted rock atlas';m.userData.jungleAsset=true;return m;}
 setView(p:THREE.Vector3,far=145):void{
  for(const b of this.bores){const distance=b.box.distanceToPoint(p);b.group.visible=distance<far;if(b.near)b.near.visible=distance<48;if(b.far)b.far.visible=distance>=48;}
  const ordered=this.lamps.filter(l=>p.distanceTo(l.p)<l.range+65).sort((a,b)=>a.p.distanceToSquared(p)-b.p.distanceToSquared(p)),nearest=ordered.filter(l=>!l.target),sky=ordered.filter(l=>l.target).filter((l,i,a)=>!a.slice(0,i).some(q=>q.p.distanceTo(l.p)<10));
  this.shafts.forEach((l,i)=>{const a=sky[i];if(a){l.position.copy(a.p);l.target.position.copy(a.target!);l.color.copy(a.color);l.intensity=a.power;l.distance=a.range;}else l.intensity=0;});
  this.lights.forEach((l,i)=>{const a=nearest[i];if(a){l.position.copy(a.p);l.color.copy(a.color);l.intensity=a.power;l.distance=a.range;}else l.intensity=0;});
 }
 get diagnostics(){return{bores:this.bores.length,ready:this.bores.filter(b=>!!b.near).length,visible:this.bores.filter(b=>b.group.visible).length,lamps:this.lamps.length,failures:this.failures};}
 dispose():void{this.disposed=true;this.root.removeFromParent();for(const b of this.bores){b.near?.geometry.dispose();b.far?.geometry.dispose();b.floor?.geometry.dispose();}this.material?.dispose();this.floorMaterial?.dispose();for(const light of this.shafts)light.shadow.dispose();this.scope.dispose();}
}
