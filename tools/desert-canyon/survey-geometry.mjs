import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {MeshoptDecoder} from 'meshoptimizer';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {relative} from 'node:path';
await MeshoptDecoder.ready;

const bundled=await build({stdin:{contents:"export * from './src/levels/desert-canyon';export * from './src/levels/desert-vista';export * from './src/desertAssets';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const data=m.DESERT_CANYON_LEVEL,templates=new Map();
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
const terrain=[],occluders=[],rocks=[],rims=[],roots=[];
function mesh(geometry,c){
  geometry.boundsTree??=new MeshBVH(geometry,{indirect:true});
  const object=new THREE.Mesh(geometry,material);object.raycast=acceleratedRaycast;
  object.position.fromArray(c.p);object.rotation.y=(c.yaw??0)*Math.PI/180;
  if(c.t==='decor')object.scale.fromArray(c.s);
  object.updateMatrixWorld(true);object.userData.bounds=new THREE.Box3().setFromObject(object);
  object.name=c.nm??c.dkind??'terrain';return object;
}
async function nativeGeometry(file){
  if(templates.has(file))return templates.get(file);
  const bytes=await readFile(new URL('../../public/jungle-kit/'+file+'.glb',import.meta.url));
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());
  const bin=bytes.subarray(28+length),parts=[],decoded=new Map();
  function accessor(index){
    const a=json.accessors[index],v=json.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const type={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];
    const compressed=v.extensions?.EXT_meshopt_compression;
    if(compressed&&!decoded.has(a.bufferView)){
      const output=Buffer.alloc(compressed.count*compressed.byteStride);
      MeshoptDecoder.decodeGltfBuffer(output,compressed.count,compressed.byteStride,
        bin.subarray(compressed.byteOffset,compressed.byteOffset+compressed.byteLength),compressed.mode,compressed.filter);
      decoded.set(a.bufferView,output);
    }
    const buffer=compressed?decoded.get(a.bufferView):bin;
    const start=(compressed?0:v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??width*type[0],values=[];
    for(let i=0;i<a.count;i++)for(let j=0;j<width;j++)values.push(buffer[type[1]](start+i*stride+j*type[0]));
    return values;
  }
  function visit(index,parent){
    const n=json.nodes[index],local=n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(n.translation??[0,0,0]),new THREE.Quaternion().fromArray(n.rotation??[0,0,0,1]),new THREE.Vector3().fromArray(n.scale??[1,1,1]));
    const world=parent.clone().multiply(local);
    if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){
      const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(accessor(p.attributes.POSITION),3));
      g.setIndex(p.indices===undefined?Array.from({length:g.attributes.position.count},(_,i)=>i):accessor(p.indices));
      g.applyMatrix4(world);parts.push(g);
    }
    for(const child of n.children??[])visit(child,world);
  }
  for(const n of json.scenes[json.scene??0].nodes)visit(n,new THREE.Matrix4());
  const geometry=mergeGeometries(parts);for(const g of parts)g.dispose();
  geometry.computeBoundingBox();const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(1/size.x,1/size.y,1/size.z);
  templates.set(file,geometry);return geometry;
}
for(const c of data.components){
  if(c.t==='mesh'&&c.grp===2){
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(c.vertices,3));geometry.setIndex(c.indices);
    const object=mesh(geometry,c);terrain.push(object);occluders.push(object);
  }else if(c.t==='decor'&&c.dkind.startsWith('desert')){
    const spec=m.DESERT_ASSETS[c.dkind],geometry=await nativeGeometry(spec.file),object=mesh(geometry,c);
    if(spec.groundSurface&&object.userData.bounds.max.y-object.userData.bounds.min.y>1){
      // The baked gravel and sculpted fins share the catalogue; use only actual
      // landscape cells for independent foundation/support measurements.
      if(c.dkind.startsWith('desertvista')&&spec.label.includes('native terrain')){
        const positions=geometry.attributes.position;
        const topArea=object.userData.bounds.max.x-object.userData.bounds.min.x;
        if(topArea>=90&&c.scenerySolid)terrain.push(object);
      }
    }
    if(c.castShadow!==false)occluders.push(object);
    if(c.dkind.startsWith('deserthoodoo'))rocks.push({c,object});
    if(c.dkind==='desertsurveyrim')rims.push({c,object});
    if(spec.label.includes('amphitheatre roots'))roots.push(object);
  }
}
const ray=new THREE.Raycaster();ray.firstHitOnly=true;
function hits(objects,origin,direction,far){
  ray.set(origin,direction);ray.near=.01;ray.far=far;
  return ray.intersectObjects(objects.filter(o=>ray.ray.intersectsBox(o.userData.bounds)),false);
}
const down=new THREE.Vector3(0,-1,0);
const rimEdges=[];
for(const {c,object} of rims){
  const edges=new Map(),indices=object.geometry.index.array;
  for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){
    const a=indices[i+k],b=indices[i+(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
    const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});
  }
  let exposed=0,maxGap=-Infinity,covered=0;const points=object.geometry.attributes.position;
  for(const edge of edges.values())if(edge.count===1){
    const p=new THREE.Vector3().fromBufferAttribute(points,edge.a).applyMatrix4(object.matrixWorld);
    const hit=hits(terrain,new THREE.Vector3(p.x,p.y+500,p.z),down,2000)[0];
    const gap=hit?p.y-hit.point.y:Infinity;maxGap=Math.max(maxGap,gap);
    if(gap>0){
      exposed++;
      const b=new THREE.Vector3().fromBufferAttribute(points,edge.b).applyMatrix4(object.matrixWorld),mid=p.clone().lerp(b,.5);
      const ground=hits(terrain,new THREE.Vector3(mid.x,mid.y+500,mid.z),down,2000)[0];
      if(ground&&ground.point.y>=mid.y){covered++;continue;}
      const across=new THREE.Vector3(b.z-p.z,0,p.x-b.x).normalize();mid.y=(mid.y+(ground?.point.y??mid.y-2))*.5;
      if(hits(roots,mid.clone().addScaledVector(across,.2),across.clone().negate(),.5).length)covered++;
    }
  }
  rimEdges.push({name:c.nm,originalOpenEdges:exposed,maxOriginalGap:maxGap,covered,unclosed:exposed-covered});
}
let foundationProbes=0,maxExposedBase=-Infinity;const exposed=[];
for(const {c,object} of rocks){
  const points=object.geometry.attributes.position;let worst=-Infinity;
  for(let i=0;i<points.count;i++)if(points.getY(i)<.012){
    const p=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(object.matrixWorld);
    const hit=hits(terrain,new THREE.Vector3(p.x,p.y+500,p.z),down,1200)[0];
    if(!hit)throw Error('Missing land beneath '+c.nm+' at '+p.toArray());
    worst=Math.max(worst,p.y-hit.point.y);foundationProbes++;
  }
  maxExposedBase=Math.max(maxExposedBase,worst);if(worst>.05)exposed.push({name:c.nm,p:c.p,gap:worst});
}
let sculptedFormations=0,sculptedBaseProbes=0,highestSculptedBase=-Infinity;
const baked=m.buildVista({start:m.DESERT_VISTA_START,length:m.DESERT_LENGTH,point:m.desertPoint,yaw:m.desertYaw,
  profile:m.elevationAtZ,ground:m.desertGround,width:m.desertWidth,bakeTerrain:true});
for(const c of baked.filter(c=>c.grp===63)){
  sculptedFormations++;
  for(let i=0;i<c.vertices.length;i+=3)if(Math.abs(c.vertices[i+1])<.001){
    const x=c.p[0]+c.vertices[i],y=c.p[1],z=c.p[2]+c.vertices[i+2];
    const hit=hits(terrain,new THREE.Vector3(x,y+500,z),down,1800)[0];assert.ok(hit,'Missing sculpted-fin support');
    highestSculptedBase=Math.max(highestSculptedBase,y-hit.point.y);sculptedBaseProbes++;
  }
}
let rootBaseProbes=0,highestRootBase=-Infinity;
for(const object of roots){
  const p=object.geometry.attributes.position;
  for(let i=0;i<p.count;i++)if(i%4>=2){
    const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld);
    const hit=hits(terrain,point.clone().add(new THREE.Vector3(0,500,0)),down,1800)[0];assert.ok(hit,'Missing amphitheatre root support');
    highestRootBase=Math.max(highestRootBase,point.y-hit.point.y);rootBaseProbes++;
  }
}
const seams=[];let seamProbes=0,missingSeamSupport=0,maxSeamStep=0;
for(const x of [-300,100,300])for(let z=700;z>=-4800;z-=4){
  if(x===100&&z>-2400)continue;
  const at=[-.002,.002].map(dx=>hits(terrain,new THREE.Vector3(x+dx,1000,z),down,2800)[0]?.point.y);
  seamProbes++;if(at.some(y=>y===undefined)){missingSeamSupport++;continue;}
  const step=Math.abs(at[0]-at[1]);maxSeamStep=Math.max(maxSeamStep,step);if(step>.15)seams.push({x,z,step});
}
for(const z of [-2144,-2400,-4000])for(let x=-680;x<2220;x+=4){
  const at=[-.002,.002].map(dz=>hits(terrain,new THREE.Vector3(x,1000,z+dz),down,2800)[0]?.point.y);
  seamProbes++;if(at.some(y=>y===undefined)){missingSeamSupport++;continue;}
  const step=Math.abs(at[0]-at[1]);maxSeamStep=Math.max(maxSeamStep,step);if(step>.15)seams.push({x,z,step});
}
const sunlight=[];
for(const input of [[.5,.085,-.862],[.5,.5,-.862],[.5,.65,-.862],[.5,.8,-.862],[.5,1,-.862],data.atmosphere.sunDirection]){
  const direction=new THREE.Vector3(...input).normalize(),sections=Array.from({length:4},()=>({lit:0,total:0}));
  for(let s=40;s<m.DESERT_LENGTH;s+=16){
    const p=new THREE.Vector3(...m.desertPoint(s));p.y+=.3;
    const section=s<m.DESERT_CANYON_START?0:s<m.DESERT_CANYON_END?1:s<m.DESERT_VISTA_START?2:3;
    sections[section].total++;if(!hits(occluders,p,direction,1800).length)sections[section].lit++;
  }
  const total=sections.reduce((n,x)=>n+x.total,0),lit=sections.reduce((n,x)=>n+x.lit,0);
  sunlight.push({direction:direction.toArray(),lit,total,fraction:lit/total,sections});
}
const oldBundle=await build({entryPoints:['src/levels/desert-canyon.ts'],bundle:true,platform:'node',format:'esm',write:false,
  plugins:[{name:'published-route',setup(b){b.onLoad({filter:/src\/(levels\/desert-(canyon|vista)|desertVistaCatalog)\.ts$/},args=>({contents:execFileSync('git',['show',`ab895907:${relative(process.cwd(),args.path)}`],{encoding:'utf8',maxBuffer:8e6}),loader:'ts'}));}}]});
const old=await import('data:text/javascript;base64,'+Buffer.from(oldBundle.outputFiles[0].text).toString('base64'));
const protectedLayout=d=>({spawn:d.spawn,killY:d.killY,sky:d.sky,cameraRig:d.cameraRig,desertHeat:d.desertHeat,
  components:d.components.filter(c=>[1,30,31,50,51,61].includes(c.grp)).map(({nm,...c})=>c)});
assert.deepEqual(protectedLayout(data),protectedLayout(old.DESERT_CANYON_LEVEL),'Route, boardwalks, plants, collectibles, checkpoints and camera layout changed');
const result={protectedLayout:true,terrainObjects:terrain.length,occluders:occluders.length,rimEdges,rockFormations:rocks.length,foundationProbes,maxExposedBase,exposed,
  sculptedFormations,sculptedBaseProbes,highestSculptedBase,rootBaseProbes,highestRootBase,
  seamProbes,missingSeamSupport,maxSeamStep,seams,sunlight};
await mkdir('docs/desert-canyon/geometry',{recursive:true});
await writeFile('docs/desert-canyon/geometry/survey.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,exposed:exposed.slice(0,6),seams:seams.slice(0,6)}));
assert.equal(exposed.length,0,'A hoodoo base remains above the terrain');
assert.ok(sculptedBaseProbes>0&&highestSculptedBase<=0,'A sculpted sandstone base remains above the terrain');
assert.ok(rootBaseProbes>0&&highestRootBase<=0,'An amphitheatre root remains above the terrain');
assert.ok(rimEdges.every(x=>x.unclosed===0),'An amphitheatre still has an open exposed edge');
assert.equal(missingSeamSupport,0,'A terrain seam has no supporting surface');
assert.equal(seams.length,0,'Adjacent terrain regions disagree at their shared border');
assert.ok(sunlight.at(-1).fraction>.7,'Most of the route must receive direct terrain/rock sunlight');
