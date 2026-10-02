import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const fixture=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const original=GLTFLoader.prototype.loadAsync,warn=console.warn;
console.warn=(...args)=>{if(!args.some(v=>v?.response?.status===404&&v.response.url===''))warn(...args);};
GLTFLoader.prototype.loadAsync=async function(url,...args){
 if(!String(url).endsWith('/nightworks-snot-goblin.glb'))return original.call(this,url,...args);
 const bytes=await readFile(new URL('../public/enemies/nightworks-snot-goblin.glb',import.meta.url));
 return new GLTFLoader().register(()=>({name:'GoblinGeometryWithoutPixels',loadTexture:()=>Promise.resolve(null)}))
  .parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}}),visuals=[];
let profile,saved;
try{
 const {createEnemyVisual}=await server.ssrLoadModule('/src/enemies/runtime.ts');
 const {NIGHTWORKS_GOBLIN_ELASTICITY_PROFILE,enemyElasticPulse}=await server.ssrLoadModule('/src/enemies/elasticity.ts');
 profile=NIGHTWORKS_GOBLIN_ELASTICITY_PROFILE;saved={...profile};const zero=Object.fromEntries(Object.keys(profile).map(k=>[k,0]));
 const a=createEnemyVisual('grunt',{appearance:'nightworks'}),b=createEnemyVisual('grunt',{appearance:'nightworks'});visuals.push(a,b);
 await Promise.all([a.ready,b.ready]);assert.equal(a.diagnostics.status,'ready');assert.equal(a.diagnostics.skinnedMeshes,1);
 assert.equal(a.diagnostics.mappedNodes.head,'Head');assert.equal(a.diagnostics.mappedNodes.hindFootLeft,'LeftFoot');
 assert.notEqual(a.group.getObjectByName('Head'),b.group.getObjectByName('Head'),'each goblin owns its pose');
 const foot=(v,name)=>v.group.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 let error=0,minScale=Infinity,maxScale=-Infinity;
 for(let i=0;i<240;i++){
  const f={state:'patrol',stateTime:i/60,time:i/60,speed:1.8,verticalVelocity:0,grounded:true,alive:true,flung:false,
   gaitPhase:(i%60)/60,plantedFeet:{hindLeft:true,hindRight:true}};
  Object.assign(profile,zero);b.update(1/60,f);Object.assign(profile,saved);a.update(1/60,f);
  for(const name of ['LeftFoot','RightFoot'])error=Math.max(error,foot(a,name).distanceTo(foot(b,name)));
  const s=a.group.getObjectByName('Spine02').scale.y;minScale=Math.min(minScale,s);maxScale=Math.max(maxScale,s);
  assert.deepEqual(a.group.scale.toArray(),[1,1,1]);
 }
 assert.ok(error<1e-5,`elasticity must preserve native planted foot matrices: ${error}`);
 assert.ok(maxScale-minScale>.003,'visible independent torso stretch and compression');
 for(let i=0;i<90;i++)a.update(1/60,{state:'defeated',stateTime:i/60,time:4+i/60,speed:0,verticalVelocity:0,grounded:true,alive:false,flung:false});
 assert.ok(Math.abs(a.group.getObjectByName('Spine02').scale.y-1)<1e-6,'defeat settles to the native float32 rest pose');
 assert.equal(enemyElasticPulse(2,.12),0);
 const {Level}=await server.ssrLoadModule('/src/level.ts'),{Player}=await server.ssrLoadModule('/src/player.ts');
 const {NIGHTWORKS_LEVEL}=await server.ssrLoadModule('/src/levels/nightworks.ts');
 const {NIGHTWORKS_AFTER_HOURS_LEVEL}=await server.ssrLoadModule('/src/levels/nightworks-after-hours.ts');
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let support=0;
 for(const [id,data]of [['dark',NIGHTWORKS_LEVEL],['nightworks-after-hours',NIGHTWORKS_AFTER_HOURS_LEVEL]]){
  const scene=new THREE.Scene(),l=new Level(scene,{id,name:data.name,data});
  try{
   await Promise.all(l.enemies.map(e=>e.visual.ready));scene.updateMatrixWorld(true);
   for(const e of l.enemies){assert.equal(e.visual.diagnostics.appearance,'nightworks');assert.equal(e.visual.diagnostics.status,'ready');
    for(let x=e.x0;x<=e.x1;x+=.15){ray.set(new THREE.Vector3(x,e.baseY+.2,e.cross),down);const h=ray.intersectObjects(l.groundMeshes,false)[0];
     assert.ok(h&&Math.abs(h.point.y-e.baseY)<.05,`${id} goblin patrol needs a stable rock at ${x},${e.cross}`);support++;}
   }
   const p=new Player(scene);p.rawInput={moveX:0,moveY:0,consumeEdges(){}};
   for(const kind of ['grunt','hopper']){
    l.reset(true);l.update(0);const e=l.enemies.find(e=>e.kind===kind);
    p.pos.copy(e.group.position).add(new THREE.Vector3(-.7,0,0));p.prevPos.copy(p.pos);p.state='ride';p.spinTimer=.3;p.invulnTimer=10;
    p.spinBox.copy(e.box);p.playerBox.copy(e.box);p.collide(l);assert.equal(e.alive,false,`${id} ${kind} real spin takedown`);
    l.reset(false);assert.ok(e.alive&&e.group.visible);assert.equal(e.visual.diagnostics.status,'ready');
   }
  }finally{l.dispose();}
 }
 console.log(`PASS real Meshy biped: 240 native walk/deformation frames, ${error.toExponential(2)} m planted-foot error, independent segments, finite defeat, ${support} supported patrol samples and both levels' actual takedown/reset paths.`);
}finally{
 if(profile&&saved)Object.assign(profile,saved);for(const v of visuals)v.dispose();await server.close();GLTFLoader.prototype.loadAsync=original;console.warn=warn;
}
