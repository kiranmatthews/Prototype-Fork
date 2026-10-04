import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createServer} from 'vite';

/** Actual generated surfaces with image decoding omitted in Node. The browser
 * pass separately verifies textures and silhouettes throughout these poses. */
async function measuredAsset(url){
  const file=await readFile(new URL('../public/'+url.replace(/^.*?(ghost-train\/)/,'$1'),import.meta.url));
  const jsonLength=file.readUInt32LE(12),data=JSON.parse(file.subarray(20,20+jsonLength).toString());
  for(const m of data.materials??[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;
    if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
  data.images=[];data.textures=[];data.samplers=[];
  const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
  const tail=file.subarray(20+jsonLength),result=Buffer.alloc(20+padded.length+tail.length);
  result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);
  result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);tail.copy(result,20+padded.length);
  return new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength),'');
}
const original=GLTFLoader.prototype.load;
GLTFLoader.prototype.load=function(url,onLoad,_progress,onError){measuredAsset(url).then(onLoad,onError);};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}}),visuals=[];
const frame={state:'patrol',stateTime:0,time:0,speed:.95,verticalVelocity:0,grounded:true,alive:true,flung:false};
try{
  const {createGhostEnemyVisual}=await server.ssrLoadModule('/src/ghostTrain.ts');
  const a=createGhostEnemyVisual('grunt','ghostknight'),b=createGhostEnemyVisual('grunt','ghostknight');visuals.push(a,b);
  await Promise.all([a.ready,b.ready]);assert.equal(a.diagnostics.status,'ready');assert.ok(a.group.userData.assetReady);
  assert.ok(a.group.userData.ghostTriangles>3000,'real Meshy armour triangles loaded');assert.ok(a.diagnostics.meshes>=10,'independent limb surfaces');
  const stationary=b.group.getObjectByName('ThighL').quaternion.clone(),positions=new Map();let plants=0,maximumError=0;
  for(let i=0;i<360;i++){
    a.group.position.z+=frame.speed/60;a.update(1/60,{...frame,time:i/60});a.group.updateMatrixWorld(true);
    assert.deepEqual(a.group.scale.toArray(),[1,1,1],'animation changed actor scale');
    for(const contact of a.group.userData.ghostFootContacts){
      const name=contact.side<0?'FootL':'FootR',p=a.group.getObjectByName(name).getWorldPosition(new THREE.Vector3());
      if(contact.planted){const expected=new THREE.Vector3(...contact.target);maximumError=Math.max(maximumError,p.distanceTo(expected));plants++;}
      assert.ok(p.y>=-.001,'foot penetrates ground');positions.set(name,p);
    }
  }
  assert.ok(plants>200);assert.ok(maximumError<1e-5,'planted armour feet slide during world motion');
  assert.ok(b.group.getObjectByName('ThighL').quaternion.equals(stationary),'animation changed another instance');
  for(let i=0;i<100;i++)a.update(1/60,{...frame,time:10+i/60,alive:false,flung:true,speed:0});
  for(const name of ['Torso','ThighL','ShinL','ForearmL'])assert.deepEqual(a.group.getObjectByName(name).scale.toArray(),[1,1,1],`${name} defeat did not settle`);
  const settled=a.group.getObjectByName('Head').rotation.toArray();a.update(1,{...frame,time:20,alive:false,speed:0});
  assert.deepEqual(a.group.getObjectByName('Head').rotation.toArray(),settled,'defeated armour keeps oscillating');
  a.reset();assert.deepEqual(a.group.scale.toArray(),[1,1,1]);
  const turkey=createGhostEnemyVisual('hopper','ghostfood'),cake=createGhostEnemyVisual('grunt','ghostcake');visuals.push(turkey,cake);
  await Promise.all([turkey.ready,cake.ready]);for(const v of [turkey,cake]){
    assert.equal(v.diagnostics.status,'ready');v.update(.15,{...frame,state:'crouch',stateTime:.35,time:2,speed:0});
    assert.ok(v.group.getObjectByName('Jaw').rotation.x>0,'animatronic jaw is articulated');assert.deepEqual(v.group.scale.toArray(),[1,1,1]);
  }
  assert.ok(turkey.group.getObjectByName('Torso').scale.y<1,'shared jump anticipation compresses turkey body');
  console.log(JSON.stringify({test:'actual Meshy surfaces, independent articulation, world-space foot planting, finite settles',knightTriangles:a.group.userData.ghostTriangles,regionMeshes:a.diagnostics.meshes,plantedSamples:plants,maximumFootError:maximumError,food:[turkey.group.userData.ghostTriangles,cake.group.userData.ghostTriangles]},null,2));
}finally{for(const v of visuals)v.dispose();GLTFLoader.prototype.load=original;await server.close();}
