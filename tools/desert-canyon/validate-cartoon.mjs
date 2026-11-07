import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {relative} from 'node:path';
import {build} from 'esbuild';
import {withSkateRuntime,makeInput} from '../jungle-cup-harness.mjs';
const base=process.argv[2]??'4927c3bb';
const evidenceDir=process.argv[3]??'docs/desert-canyon/dusty-road';
async function source(historical=false){
  const bundled=await build({entryPoints:['src/levels/desert-canyon.ts'],bundle:true,platform:'node',format:'esm',write:false,
    plugins:historical?[{name:'published-layout',setup(b){b.onLoad({filter:/src\/(levels\/desert-(canyon|vista)|desertVistaCatalog)\.ts$/},args=>({contents:execFileSync('git',['show',`${base}:${relative(process.cwd(),args.path)}`],{encoding:'utf8',maxBuffer:8e6}),loader:'ts'}));}}]:[]});
  return import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
}
const previous=await source(true),current=await source(),data=current.DESERT_CANYON_LEVEL;
const protectedLayout=d=>({spawn:d.spawn,killY:d.killY,sky:d.sky,atmosphere:d.atmosphere,cameraRig:d.cameraRig,
  components:d.components.filter(c=>[1,2,20,21,30,31,50,51,61].includes(c.grp)&&!['colouredgem','bonusplatform'].includes(c.t)).map(({nm,...c})=>c)});
assert.deepEqual(protectedLayout(data),protectedLayout(previous.DESERT_CANYON_LEVEL),'Route, terrain, planting, lighting, sky and checkpoint layout must be unchanged');
assert.ok(!data.components.some(c=>/course flag|flag pole|direction board|chevron/i.test(c.nm??'')),'Flags and road signs must be absent');
const oldManifest=JSON.parse(execFileSync('git',['show',`${base}:public/desert-canyon/vista/manifest.json`],{encoding:'utf8'}));
const native=JSON.parse(await readFile('public/desert-canyon/vista/manifest.json','utf8'));
for(let i=0;i<native.models.length;i++)assert.equal(native.models[i].sha256,oldManifest.models[i].sha256,'Landscape cell changed '+i);
const rocks=JSON.parse(await readFile('public/desert-canyon/manifest.json','utf8'));
assert.ok(rocks.models.every(m=>m.triangles<=30000));
const replay=JSON.parse(await readFile(evidenceDir+'/replay-endpoint.json','utf8'));
assert.equal(replay.sourceRef,base);assert.equal(replay.restoredWarps,17);assert.equal(replay.last.grounded,true);
assert.ok(Math.hypot(...replay.last.position.map((v,i)=>v-current.DESERT_YELLOW_GEM[i]))<.0001);
assert.ok(current.DESERT_YELLOW_GEM[2]<current.desertPoint(current.DESERT_LENGTH)[2]);
assert.equal(data.name,'Dusty Road');
assert.equal(data.components.filter(c=>c.t==='bonusplatform').length,1);
assert.deepEqual(data.components.find(c=>c.t==='bonusplatform').p,current.DESERT_BONUS_ENTRANCE);
let result={protectedLayout:true,unchangedGroundCells:native.models.length,skyAndLightingUnchanged:true,flagsAndSignsAbsent:true,
  yellowGemPosition:current.DESERT_YELLOW_GEM,replaySha256:replay.replaySha256};
await withSkateRuntime(async({level,player:p,THREE,server,step,Level})=>{
  await level.jungleAssets.ready();level.root.updateMatrixWorld(true);level.prepareWorldSolids();
  const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
  const {ColouredGemCollection}=await server.ssrLoadModule('/src/colouredGems.ts');
  assert.ok(normalizeCustomLevelData(data),'Coloured gem must pass the source/editor contract');
  assert.equal(normalizeCustomLevelData({...data,components:[{t:'colouredgem',p:[0,0,0],gemColour:'orange'}]}),null);
  const gem=level.colouredGemPickups[0];assert.equal(level.colouredGemPickups.length,1);
  assert.equal(gem.colour,'yellow');assert.equal(gem.collected,false);
  assert.equal(gem.collectedThisRun,false,'An uncollected gem cannot enter the run HUD');
  const [x,y,z]=current.DESERT_YELLOW_GEM;
  const floor=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,y+50,z),new THREE.Vector3(0,-1,0),0,100).intersectObjects(level.groundMeshes,false)[0]?.point.y;
  const support=floor(x,z);assert.ok(Number.isFinite(support)&&Math.abs(support-y)<.08,`Gem support ${support} versus replay ${y}`);
  p.competitionMode=false;p.enterLevel('bryce-canyon');
  const start=new THREE.Vector3(x-3,floor(x-3,z+5)+.3,z+5);
  p.respawn(level,true,false,{position:start,heading:new THREE.Vector3(0,0,-1)});
  for(let i=0;i<30;i++)step(makeInput());assert.equal(gem.collected,false,'A distant gem must not auto-award');
  let frames=0;for(;frames<240&&!gem.collected;frames++){
    const dx=x-p.pos.x,dz=z-p.pos.z,d=Math.hypot(dx,dz)||1,cf=p.raceInputBasis(level);
    step(makeInput({moveX:(-dx*cf.z+dz*cf.x)/d*.7,moveY:(dx*cf.x+dz*cf.z)/d*.7}));
  }
  assert.ok(gem.collected&&!gem.group.visible,'Walking into the yellow gem must collect it');
  assert.equal(gem.collectedThisRun,true,'A fresh pickup belongs in this visit’s inventory');
  assert.equal(p.hasCrystal,false);assert.equal(p.gemEarned,false);assert.equal(p.comboGemEarned,false);
  assert.equal(level.collectColouredGem(gem),false,'No duplicate reward');
  level.reset(true);assert.ok(gem.collected&&!gem.group.visible,'Hard restart keeps the discovery');
  assert.equal(gem.collectedThisRun,false,'A new run clears carried gems without losing discovery');
  assert.ok(new ColouredGemCollection().has('bryce-canyon','yellow'),'Collection survives storage reload');
  const again=new Level(new THREE.Scene(),{id:'bryce-canyon',name:'Gem reload check',data:{v:1,name:'Gem reload check',spawn:[0,.1,0],killY:-20,
    components:[{t:'platform',p:[0,-.5,0],s:[20,1,20]},{t:'colouredgem',gemColour:'yellow',p:[3,0,0]},{t:'gate',p:[0,0,-8]}]}});
  assert.ok(again.colouredGemPickups[0].collected&&!again.colouredGemPickups[0].group.visible,'New level adopts saved discovery');
  assert.equal(again.colouredGemPickups[0].collectedThisRun,false,'Exiting and returning must not put banked gems back in the HUD');again.dispose();
  const failing=new ColouredGemCollection({getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}});
  assert.equal(failing.collect('test','yellow'),true);assert.equal(failing.collect('test','yellow'),false);
  assert.equal(failing.has('other','yellow'),false,'Discoveries stay keyed to their level');
  result={...result,gemWalkFrames:frames,gemSupported:true,collectedOnce:true,reloadAndResetRetainGem:true,clearAndComboRewardsUnaffected:true};
},{levelEntry:{id:'bryce-canyon',name:data.name,data},prepareRuntime(){
  globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};globalThis.self=globalThis;
  navigator.userAgent='Headless cartoon canyon validation';const NativeRequest=globalThis.Request;
  globalThis.Request=class extends NativeRequest{constructor(input,init){super(typeof input==='string'?new URL(input,'http://headless.invalid'):input,init);}};
  globalThis.fetch=async input=>{
    const path=new URL(typeof input==='string'?input:input.url,'http://headless.invalid').pathname;
    const match=path.match(/\/desert-canyon\/vista\/(terrain-\d+\.glb)$/);
    return match?new Response(await readFile('public/desert-canyon/vista/'+match[1])):new Response('',{status:404});
  };
}});
await writeFile(evidenceDir+'/validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
