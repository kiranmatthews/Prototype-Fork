import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const out='art/carlisle-shipyard/coastal-banks';await mkdir(out,{recursive:true});
const bundle=await build({stdin:{contents:`export {CARLISLE_COASTAL_BANKS,coastalWaterProfile,fitCoastalBank,coastalShoreRibbon} from './src/carlisleCoastalBanks';export {carlislePoint} from './src/levels/carlisle-tidal-relay';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const {CARLISLE_COASTAL_BANKS:plan,coastalWaterProfile,fitCoastalBank,coastalShoreRibbon,carlislePoint}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const seaVertices=[];for(let i=0;i<=210;i++){const p=carlislePoint(-500+i*25,-8);seaVertices.push(-4400,p[1],p[2],4400,p[1],p[2]);}
const sea=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(seaVertices,3)),water=coastalWaterProfile(sea);
for(let i=0;i<sea.attributes.position.count;i++)assert.ok(Math.abs(water(sea.attributes.position.getZ(i)).height-sea.attributes.position.getY(i))<1e-8);
const provenance=JSON.parse(await readFile('public/props/carlisle-coast/provenance.json','utf8'));
const report={banks:0,sourceTriangles:0,placedTriangles:0,shoreSegments:0,verticesChecked:0,maxReliefError:0,minCenterlineClearance:Infinity,perBank:[]};
const route=Array.from({length:901},(_,i)=>new THREE.Vector3(...carlislePoint(-250+i*5,0)));
for(const asset of provenance.assets){
 const file=await readFile(asset.file);assert.equal(createHash('sha256').update(file).digest('hex'),asset.sha256);
 const jl=file.readUInt32LE(12),gltf=JSON.parse(file.subarray(20,20+jl)),binary=file.subarray(jl+28),primitive=gltf.meshes[0].primitives[0];
 const accessor=i=>{const a=gltf.accessors[i],v=gltf.bufferViews[a.bufferView],Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],offset=(v.byteOffset??0)+(a.byteOffset??0),raw=binary.subarray(offset,offset+a.count*n*Type.BYTES_PER_ELEMENT);assert.ok(!v.byteStride,'update parser for interleaved source');return new THREE.BufferAttribute(new Type(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),n);};
 const source=new THREE.BufferGeometry();for(const [key,i]of Object.entries(primitive.attributes))source.setAttribute({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TANGENT:'tangent'}[key],accessor(i));source.setIndex(accessor(primitive.indices));source.computeBoundingBox();
 const bounds=source.boundingBox,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());report.sourceTriangles+=source.index.count/3;
 assert.equal(source.index.count/3,asset.meshes[0].triangles);
 for(const spec of plan.filter(p=>p.kind===asset.id)){
  const at=new THREE.Vector3(...carlislePoint(spec.station,0,spec.offset)),toward=new THREE.Vector3(...carlislePoint(spec.station,0,spec.offset+1)).sub(at),scale=spec.width/Math.max(size.x,size.z);
  const transform=new THREE.Matrix4().compose(new THREE.Vector3(at.x,-bounds.min.y*scale-spec.submerge,at.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(toward.x,toward.z)+spec.turn),new THREE.Vector3(scale,scale,scale)).multiply(new THREE.Matrix4().makeTranslation(-center.x,0,-center.z));
  const {geometry,relativeHeight}=fitCoastalBank(source,transform,water),p=geometry.attributes.position,n=geometry.attributes.normal;
  assert.deepEqual(geometry.index.array,source.index.array,'source triangles were replaced');assert.deepEqual(geometry.attributes.uv.array,source.attributes.uv.array,'source UVs changed');
  let highest=-Infinity,lowest=Infinity,clearance=Infinity;
  for(let i=0;i<p.count;i++){
   const sea=water(p.getZ(i)),relief=p.getY(i)-sea.height,error=Math.abs(relief-(source.attributes.position.getY(i)-bounds.min.y)*scale+spec.submerge);
   assert.ok([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));
   assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);assert.ok(error<.001,'coast relief flattened');
   report.maxReliefError=Math.max(report.maxReliefError,error);highest=Math.max(highest,relief);lowest=Math.min(lowest,relief);
   // Every vertex must remain outside a generous 120m-wide play/camera corridor.
   let a=0,b=route.length-1;while(b-a>1){const mid=(a+b)>>1;if(route[mid].z>p.getZ(i))a=mid;else b=mid;}
   const local=route[Math.abs(route[a].z-p.getZ(i))<Math.abs(route[b].z-p.getZ(i))?a:b];
   clearance=Math.min(clearance,Math.abs(p.getX(i)-local.x));
  }
  assert.ok(highest>24&&lowest<-.5,'coastal bank lacks substantial above/below-water depth');assert.ok(clearance>60,'coast enters play/camera corridor');
  const ribbon=coastalShoreRibbon(geometry,relativeHeight,water),rp=ribbon.attributes.position;
  assert.ok(rp.count>0,'no waterline contour');for(let i=0;i<rp.count;i++)assert.ok(Math.abs(rp.getY(i)-water(rp.getZ(i)).height-.055)<.0001,'shore foam floats above water');
  const segments=ribbon.index.count/6;report.banks++;report.verticesChecked+=p.count;report.placedTriangles+=geometry.index.count/3;report.shoreSegments+=segments;report.minCenterlineClearance=Math.min(report.minCenterlineClearance,clearance);
  report.perBank.push({kind:spec.kind,station:spec.station,triangles:geometry.index.count/3,relief:highest-lowest,minCenterlineClearance:clearance,shoreSegments:segments});geometry.dispose();ribbon.dispose();
 }
 source.dispose();
}
assert.equal(report.banks,32);assert.equal(report.sourceTriangles,100707);report.passed=true;
await writeFile(out+'/geometry-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,perBank:undefined}));
