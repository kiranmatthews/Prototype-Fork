import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';

// Read the approved near model without decoding or altering its texture maps.
const bytes=await readFile('public/waterslide/planted-cliff.glb');
const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+n)),bin=bytes.subarray(28+n);
const attr=id=>{
 const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3}[a.type];
 const Type={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];
 const start=(v.byteOffset??0)+(a.byteOffset??0),b=bin.subarray(start,start+a.count*width*Type.BYTES_PER_ELEMENT);
 return new THREE.BufferAttribute(new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),width);
};
const node=doc.nodes.find(n=>n.name?.endsWith('LOD0')),primitive=doc.meshes[node.mesh].primitives[0];
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',attr(primitive.attributes.POSITION));geometry.setIndex(attr(primitive.indices));
const transform=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation??[0,0,0])),new THREE.Quaternion(...(node.rotation??[0,0,0,1])),new THREE.Vector3(...(node.scale??[1,1,1])));
geometry.applyMatrix4(transform);geometry.computeBoundingBox();
const bounds=geometry.boundingBox.clone(),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
geometry.translate(-centre.x,-bounds.min.y,-centre.z);geometry.scale(1/size.x,1/size.y,1/size.z);
const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster();
await withBlockworksRuntime(async r=>{
 const {RaceCourse}=await r.server.ssrLoadModule('/src/race/course.ts');
 const {WATERSLIDE_ASSETS}=await r.server.ssrLoadModule('/src/waterslideAssets.ts');
 const course=new RaceCourse(r.source.skateRace.line),samples=Array.from({length:Math.ceil(course.length/4)},(_,i)=>({p:course.sample(i*4),w:course.width(i*4)}));
 const clear=(p,radius,height)=>samples.every(({p:q,w})=>p.y+height<q.y-2||p.y>q.y+10||Math.hypot(p.x-q.x,p.z-q.z)>w/2+radius+2);
 const plants=[],anchors=[];
 const cliffs=r.source.components.filter(c=>c.dkind==='waterslideplantedcliff'&&c.nm==='Tropical forest / waterslideplantedcliff');
 for(const [i,c]of cliffs.entries()){
  if(i%2)continue;
  mesh.position.fromArray(c.p);mesh.rotation.y=(c.yaw??0)*Math.PI/180;mesh.scale.fromArray(WATERSLIDE_ASSETS.waterslideplantedcliff.size).multiplyScalar(c.w??1);mesh.updateMatrixWorld(true);
  let planted=0;
  for(const [j,[x,z]]of [[0,0],[-.18,.15],[.19,-.12]].entries()){
   const p=mesh.localToWorld(new THREE.Vector3(x,1.2,z));ray.set(p,new THREE.Vector3(0,-1,0));ray.far=mesh.scale.y*1.3;
   const hit=ray.intersectObject(mesh,false).find(h=>h.face.normal.y>.5);if(!hit)continue;
   const palm=j===0,scale=palm?.8+(i%3)*.08:1.1;
   if(!clear(hit.point,palm?5.5*scale:1.7,palm?17*scale:1.8))continue;
   const at=hit.point.clone();at.y-=.04;
   plants.push({t:'decor',dkind:palm?'crowntropicalpalm':'sunnyhibiscus',p:at.toArray().map(n=>Math.round(n*10000)/10000),w:scale,yaw:(i*73+j*117)%360,scenerySolid:false,grp:436,nm:palm?'Island garden / cliff-rooted palm':'Island garden / cliff-rooted hibiscus'});
   anchors.push({owner:c.p,position:hit.point.toArray(),normal:hit.face.normal.toArray()});planted++;
  }
 }
 await writeFile('src/levels/slipstream-polish-gardens.json',JSON.stringify(plants)+'\n');
 await writeFile('docs/slipstream-polish/garden-anchors.json',JSON.stringify({method:'Vertical ray onto the unchanged normalized LOD0 planted-cliff triangles, with complete race clearance',count:plants.length,anchors},null,2)+'\n');
 console.log(JSON.stringify({cliffs:cliffs.length,plants:plants.length}));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
geometry.dispose();mesh.material.dispose();
