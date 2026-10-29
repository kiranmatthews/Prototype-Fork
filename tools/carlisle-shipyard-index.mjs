import {readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const root=resolve(import.meta.dirname,'..');
const base=resolve(root,'art/carlisle-shipyard');
const props=JSON.parse(await readFile(resolve(root,'docs/carlisle-relay/shipyard-polish/props.json'),'utf8'));
const reviewed=process.argv.find(a=>a.startsWith('--reviewed='))?.slice(11);
const assets=[];
function imageSize(bytes,mime){
  if(mime==='image/png')return{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  if(mime==='image/jpeg')for(let at=2;at<bytes.length;){
    if(bytes[at++]!==255)continue;
    while(bytes[at]===255)at++;
    const marker=bytes[at++];if(marker===0xd9||marker===0xda)break;
    const length=bytes.readUInt16BE(at);
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{width:bytes.readUInt16BE(at+5),height:bytes.readUInt16BE(at+3)};
    at+=length;
  }
  throw new Error('Cannot read texture dimensions');
}
for(const prop of props.assets){
  const file=resolve(base,'models',prop.id,'result.json');
  try{await access(file)}catch{continue}
  const {result}=JSON.parse(await readFile(file,'utf8'));
  assert.equal(result.status,'success');
  const buffer=await readFile(resolve(root,result.model_file));
  assert.equal(buffer.readUInt32LE(0),0x46546c67);assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.readUInt32LE(8),buffer.length);
  const jsonLength=buffer.readUInt32LE(12),gltf=JSON.parse(buffer.subarray(20,20+jsonLength).toString());
  const binaryOffset=20+jsonLength+8;
  const primitives=gltf.meshes.flatMap(mesh=>mesh.primitives);
  let triangles=0;const bounds=new THREE.Box3();
  function inspectNode(index,parent=new THREE.Matrix4()){
    const node=gltf.nodes[index];
    const local=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation??[0,0,0])),new THREE.Quaternion(...(node.rotation??[0,0,0,1])),new THREE.Vector3(...(node.scale??[1,1,1])));
    const world=parent.clone().multiply(local);
    if(node.mesh!==undefined)for(const primitive of gltf.meshes[node.mesh].primitives){
      assert.equal(primitive.mode??4,4);assert.notEqual(primitive.attributes.NORMAL,undefined);assert.notEqual(primitive.attributes.TEXCOORD_0,undefined);
      const accessor=gltf.accessors[primitive.attributes.POSITION];assert.equal(accessor.componentType,5126);assert.equal(accessor.type,'VEC3');
      const view=gltf.bufferViews[accessor.bufferView],start=binaryOffset+(view.byteOffset??0)+(accessor.byteOffset??0),stride=view.byteStride??12;
      for(let i=0;i<accessor.count;i++){const offset=start+i*stride;const point=new THREE.Vector3(buffer.readFloatLE(offset),buffer.readFloatLE(offset+4),buffer.readFloatLE(offset+8));assert(point.toArray().every(Number.isFinite));bounds.expandByPoint(point.applyMatrix4(world));}
      const count=primitive.indices===undefined?accessor.count:gltf.accessors[primitive.indices].count;assert.equal(count%3,0);triangles+=count/3;
    }
    for(const child of node.children??[])inspectNode(child,world);
  }
  for(const node of gltf.scenes[gltf.scene??0].nodes)inspectNode(node);
  assert(triangles>0&&triangles<=prop.faceBudget,`${prop.id}: ${triangles} exceeds ${prop.faceBudget}`);
  for(const material of gltf.materials){assert(material.pbrMetallicRoughness?.baseColorTexture);assert(material.pbrMetallicRoughness?.metallicRoughnessTexture);assert(material.normalTexture)}
  const imageBytes=gltf.images.map(image=>{assert.equal(image.uri,undefined);const view=gltf.bufferViews[image.bufferView];assert(view.byteLength>0);const start=binaryOffset+(view.byteOffset??0);return{mimeType:image.mimeType,bytes:view.byteLength,...imageSize(buffer.subarray(start,start+view.byteLength),image.mimeType)}});
  const reviewPath=resolve(base,'models',prop.id,'review.json');let review={};try{review=JSON.parse(await readFile(reviewPath,'utf8'))}catch{}
  if(reviewed===prop.id){review={...review,previewReviewedAt:new Date().toISOString(),previewVerdict:'Matches the reference and approved navy/orange art direction'};await writeFile(reviewPath,JSON.stringify(review,null,2)+'\n')}
  assets.push({id:prop.id,name:prop.name,model:result.model_file,preview:result.preview,reference:prop.reference,triangles,faceBudget:prop.faceBudget,meshes:gltf.meshes.length,primitives:primitives.length,materials:gltf.materials.length,textures:imageBytes,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()},bytes:buffer.length,taskId:result.task_id,credits:result.credits_consumed,review});
}
const totalCredits=assets.reduce((sum,a)=>sum+a.credits,0);
let billing;try{billing=JSON.parse(await readFile(resolve(base,'billing.json'),'utf8'))}catch{}
await writeFile(resolve(base,'models.json'),JSON.stringify({status:assets.length===props.assets.length?'generated':'generation-in-progress',model:'tripo-p1 / P1-20260311',updatedAt:new Date().toISOString(),totalCredits,assets},null,2)+'\n');
const balanceNote=billing?.billedCredits===totalCredits?`\nRemaining API balance after the batch: **${billing.remainingApiBalance} credits**, frozen: **${billing.frozenCredits}**. Existing API credits used only; no additional API usage purchased and no Max plan credits used.\n`:'';
await writeFile(resolve(base,'CREDIT_LEDGER.md'),'# Carlisle shipyard — Tripo credit ledger\n\nActual billed costs from the official CLI result for each single-step image-to-model task.\n\n| Asset | Step | Task ID | Credits billed | Triangles / budget |\n| --- | --- | --- | ---: | ---: |\n'+assets.map(a=>`| ${a.name} | image_to_model | ${a.taskId} | ${a.credits} | ${a.triangles.toLocaleString()} / ${a.faceBudget.toLocaleString()} |`).join('\n')+`\n\n**Total billed: ${totalCredits} credits.** ${assets.length} of ${props.assets.length} planned assets generated.\n`+balanceNote);
console.log(JSON.stringify({assets:assets.length,totalCredits,latest:assets.at(-1)},null,2));
