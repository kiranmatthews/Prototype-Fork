import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';

const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const nativeFetch=globalThis.fetch;
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.fetch=async input=>{
  const url=typeof input==='string'?input:input.url;
  if(url.startsWith('blob:'))return nativeFetch(input);
  const match=url.match(/\/jungle-kit\/((?:(?:modular|editor)\/)?[\w-]+\.glb)$/);
  return match?new Response(await readFile(new URL('../public/jungle-kit/'+match[1],import.meta.url))):new Response('',{status:404});
};
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try {
  const {Level,normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {CONST}=await server.ssrLoadModule('/src/tuning.ts');
  const {junglePathHalfWidth}=await server.ssrLoadModule('/src/levels/jungle-ruins-bounds.ts');
  const scene=new THREE.Scene(),level=new Level(scene,{id:'jungle',name:'Jungle Ruins'});
  await level.prepareJungleAssets();level.root.updateMatrixWorld(true);
  const data=level.captureData(),perimeter=data.components.find(c=>c.containment);
  assert.ok(perimeter?.closed && perimeter.invisible);
  assert.ok(normalizeCustomLevelData(data),'boundary survives the shared-file validator');
  const copy=new Level(new THREE.Scene(),{id:'jungle-copy',name:'Copy',data:JSON.parse(JSON.stringify(data))});
  assert.deepEqual(copy.containmentWalls.map(b=>b.toArray?.()??[b.min.toArray(),b.max.toArray()]),
    level.containmentWalls.map(b=>[b.min.toArray(),b.max.toArray()]));
  copy.dispose();
  let cliffs=0,trees=0;const textures=new Set();
  level.root.traverse(o=>{
    if(!o.isMesh)return;
    if(o.userData.jungleAsset==='junglecliff'){
      cliffs+=o.count??1;assert.ok((o.geometry.index?.count??o.geometry.attributes.position.count)/3<=80);
      assert.ok(!o.castShadow && !o.receiveShadow);
    }
    if(o.userData.jungleAsset==='junglebackdrop'){
      trees+=o.count??1;assert.ok(o.geometry.index.count/3<600);assert.ok(!o.castShadow);
    }
    if(o.material.map)textures.add(o.material.map);
  });
  assert.ok(cliffs>60&&trees>30,'large continuous background layer');
  assert.ok(level.containmentWalls.length>300,'continuous sides and both end caps');

  // Isolate accidental boundary escapes from deliberately authored hazards.
  for(const e of level.enemies)e.alive=false;
  for(const c of level.crates)c.alive=false;
  for(const c of level.checkpoints)c.active=true;
  level.finishGlow.makeEmpty();
  for(const m of level.groundMeshes)m.userData.finishPad=false;
  const player=new Player(scene),input={moveX:0,moveY:0,consumeEdges(){}};
  for(const k of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferPressed'])input[k]=false;
  player.rawInput=input;player.lives=500;
  const ray=new THREE.Raycaster();
  const floor=(x,z)=>{ray.set(new THREE.Vector3(x,55,z),new THREE.Vector3(0,-1,0));return ray.intersectObjects(level.groundMeshes,false)[0]?.point.y;};
  const lane=z=>level.lanePts.reduce((a,b)=>Math.abs(b.z-z)<Math.abs(a.z-z)?b:a);
  let probes=0;
  function probe(z,side,forward=0,air=0,fast=false){
    const center=lane(z).x,half=junglePathHalfWidth(z),x=center+side*(half-1.2);
    const y=floor(x,z);assert.ok(Number.isFinite(y),'probe starts over real ground at '+z);
    player.pos.set(x,y+.03,z);player.settle(level);
    player.pos.y+=air;player.prevPos.copy(player.pos);player.vVel=0;
    player.grounded=air===0;player.state=air?'air':'ride';
    player.freeSkate=fast;player.skateOn=fast;player.airFromSkate=fast&&air>0;player.speed=fast?30:0;
    player.axisF.set(side*.707,0,forward?-.707*forward:-.707);
    player.axisL.set(-player.axisF.z,0,player.axisF.x);
    player.walkVelocity.set(0,0,0);player.laneCursor.s=-1;
    input.moveX=side;input.moveY=forward;
    const lives=player.lives;
    for(let i=0;i<210;i++){
      level.clearProjectiles();level.update(CONST.fixedStep);player.step(CONST.fixedStep,input,level);
      assert.equal(player.lives,lives,`boundary escape at ${z}/${side}/${forward}/${air}: ${player.pos.toArray()}`);
      assert.notEqual(player.state,'dead',`boundary escape at ${z}/${side}: ${player.pos.toArray()}`);
    }
    assert.ok(Number.isFinite(floor(player.pos.x,player.pos.z)),`unsupported boundary landing at ${z}/${side}: ${player.pos.toArray()}`);
    probes++;
  }
  for(const z of [4,-22,-52,-74,-120,-150,-254,-277,-308,-326,-390,-417,-453,-468,-510,-540,-590,-633,-681,-705])
    for(const side of [-1,1]){probe(z,side);probe(z,side,0,7);}
  for(const side of [-1,1])for(const air of [0,8]){
    probe(12,side,-1,air);probe(-712,side,1,air);
    probe(-442,side,1,air);probe(-675,side,1,air);
    probe(12,side,-1,air,true);probe(-712,side,1,air,true);
    probe(-442,side,1,air,true);probe(-675,side,1,air,true);
  }
  console.log(`PASS Jungle enclosure: ${cliffs} low-poly cliff placements, ${trees} far-mesh canopies, ${probes} real-Player side/air/corner/end probes, closed perimeter and capture/rebuild.`);
  level.dispose();
} finally {await server.close();}
