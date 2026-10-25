import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import * as THREE from 'three';
import {computeBoundsTree,acceleratedRaycast} from 'three-mesh-bvh';
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},logLevel:'error'});
try{
 const {SLIPSTREAM_LEVEL:level}=await server.ssrLoadModule('/src/levels/slipstream.ts');
 const {JUNGLE_ASSETS}=await server.ssrLoadModule('/src/jungleAssets.ts');
 const {RaceCourse}=await server.ssrLoadModule('/src/race/course.ts');
 const course=new RaceCourse(level.skateRace.line),samples=Array.from({length:Math.ceil(course.length/4)},(_,i)=>({p:course.sample(i*4),w:course.width(i*4)}));
 const templates=new Map(),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),plants=[],anchors=[];
 const noise=n=>{const v=Math.sin(n*127.1+81.31)*43758.5453;return v-Math.floor(v);};
 const round=n=>Math.round(n*10000)/10000;
 const clear=(p,r,h)=>samples.every(({p:q,w})=>p.y+h<q.y-3||p.y>q.y+27||Math.hypot(p.x-q.x,p.z-q.z)>w/2+r+5);
 async function template(kind){
  if(templates.has(kind))return templates.get(kind);
  const bytes=await readFile(resolve('public/jungle-kit',JUNGLE_ASSETS[kind].file+'.glb'));
  const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+n)),bin=bytes.subarray(28+n),positions=[],indices=[];
  const read=id=>{
   const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3}[a.type],bytes={5126:4,5123:2,5125:4}[a.componentType],stride=v.byteStride??width*bytes;
   const values=[];for(let i=0;i<a.count;i++)for(let j=0;j<width;j++){
    const at=(v.byteOffset??0)+(a.byteOffset??0)+i*stride+j*bytes;
    values.push(a.componentType===5126?bin.readFloatLE(at):a.componentType===5123?bin.readUInt16LE(at):bin.readUInt32LE(at));
   }return values;
  };
  const world=new Map();function matrix(i){if(world.has(i))return world.get(i);const node=doc.nodes[i],parent=doc.nodes.findIndex(n=>n.children?.includes(i));
   const own=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation??[0,0,0])),new THREE.Quaternion(...(node.rotation??[0,0,0,1])),new THREE.Vector3(...(node.scale??[1,1,1])));
   if(parent>=0)own.premultiply(matrix(parent));world.set(i,own);return own;
  }
  const high=doc.nodes.some(n=>n.mesh!==undefined&&/LOD0$/i.test(n.name??''));
  for(const [i,node]of doc.nodes.entries())if(node.mesh!==undefined&&(high?/LOD0$/i.test(node.name??''):!/LOD[1-9]/i.test(node.name??'')))for(const primitive of doc.meshes[node.mesh].primitives){
   const pos=read(primitive.attributes.POSITION),offset=positions.length/3;
   for(let j=0;j<pos.length;j+=3)positions.push(...new THREE.Vector3(...pos.slice(j,j+3)).applyMatrix4(matrix(i)).toArray());
   indices.push(...(primitive.indices===undefined?Array.from({length:pos.length/3},(_,k)=>k):read(primitive.indices)).map(k=>offset+k));
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeBoundingBox();
  const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(1/size.x,1/size.y,1/size.z);computeBoundsTree.call(geometry);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.raycast=acceleratedRaycast;templates.set(kind,mesh);return mesh;
 }
 const owners=level.components.filter(c=>c.grp===437&&c.t==='decor');
 for(const [i,c]of owners.entries()){
  const mesh=await template(c.dkind);mesh.position.fromArray(c.p);mesh.rotation.y=c.yaw*Math.PI/180;mesh.scale.fromArray(c.s);mesh.updateMatrixWorld(true);
  const lagoon=/lagoon/.test(c.nm??'');
  const count=lagoon&&c.s[0]>180?24:c.s[0]>90?9:c.s[0]<20?4:6;
  for(let j=0;j<count;j++){
   const x=(noise(i*17+j*13)-.5)*.78,z=(noise(i*31+j*7)-.5)*.76;
   const start=mesh.localToWorld(new THREE.Vector3(x,1.05,z));ray.set(start,down);ray.far=c.s[1]*1.1;
   const hit=ray.intersectObject(mesh,false).find(h=>h.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).y>.45);
   if(!hit)continue;
   const kind=j%4===0?'crowntropicalpalm':j%4===1?'custardbankshrub':j%4===2?'jungleleaf':'sunnyhibiscus';
   const scale=kind==='crowntropicalpalm'?(lagoon&&c.s[0]>180?2:c.s[0]>90?1.15:.85)+noise(i)*.35:kind==='custardbankshrub'?.65+noise(i+j)*.4:kind==='jungleleaf'?1.2+noise(i)*.6:1.8;
   const size=JUNGLE_ASSETS[kind].size,radius=Math.hypot(size[0],size[2])*scale/2,at=hit.point.clone();at.y-=.07;
   if(!clear(at,radius,size[1]*scale))continue;
   plants.push({t:'decor',dkind:kind,p:at.toArray().map(round),w:round(scale),yaw:round(noise(i*101+j)*360),scenerySolid:false,castShadow:true,grp:438,nm:'Island midground garden / rooted '+kind});
   anchors.push({owner:c.p,kind,point:hit.point.toArray().map(round),normal:hit.face.normal.toArray()});
  }
 }
 await writeFile('src/levels/slipstream-midground-gardens.json',JSON.stringify(plants)+'\n');
 await writeFile('docs/slipstream-polish/corrective/midground-anchors.json',JSON.stringify({method:'World-space downward rays onto normalized existing LOD0 GLB triangles; all route legs checked',owners:owners.length,plants:plants.length,anchors},null,2)+'\n');
 console.log(JSON.stringify({rocks:owners.length,plants:plants.length,kinds:[...templates.keys()]}));
}finally{await server.close();}
