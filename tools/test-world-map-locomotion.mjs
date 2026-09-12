import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
runInThisContext('const noop=()=>{};'+harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nconst held'))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn,error=console.error;
const asset=v=>/GLB|failed|skateboard trucks|spin model/.test(String(v??''));
console.warn=(...a)=>{if(!asset(a[0]))warn(...a);};console.error=(...a)=>{if(!asset(a[0]))error(...a);};
try{
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {Level,findLevel}=await server.ssrLoadModule('/src/level.ts');
  const {WorldMapController}=await server.ssrLoadModule('/src/worldMapController.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const replay=JSON.parse(await readFile(new URL('./fixtures/world-map-skid-inputs.json',import.meta.url),'utf8'));
  const scene=new THREE.Scene(),level=new Level(scene,findLevel(replay.level)),p=new Player(scene);
  p.enterLevel(replay.level);p.respawn(level,true);
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const input={moveX:0,moveY:0,mapDirectionX:0,mapDirectionY:0,consumeEdges(){}};
  // The normal Input object is shared/mutated each poll after returning from
  // gameplay. The map owns movement; these taps only select destinations.
  p.rawInput=input;
  const campaign={recommendedMapLevelKey:()=> 'jungle',levelUnlocked:()=>true,setMapFocus(){},levelProgress:()=>null};
  const map=new WorldMapController(campaign,p,{onSelection(){},onEnterLevel(){},onOpenSection(){}});
  map.activate(level,'jungle');
  const forbidden=[],visited=new Set();let moving=0;
  for(let frame=0;frame<replay.frames;frame++){
    const pulse=replay.pulses.find(s=>frame>=s.start&&frame<s.end);
    input.moveX=pulse?.x??0;input.moveY=pulse?.y??0;
    map.step(1/60,input);level.update(1/60);
    if(map.moving)moving++;
    visited.add(map.selectedKey);
    if(runtime.activeClipId==='player.run-stop')forbidden.push(frame);
  }
  for(let frame=0;frame<120;frame++){input.moveX=input.moveY=0;map.step(1/60,input);}
  assert.ok(moving>200&&visited.size>1,'recorded map taps did not exercise navigation');
  console.log({moving,visited:[...visited],skidFrames:forbidden.length,firstSkid:forbidden[0],finalClip:runtime.activeClipId});
  assert.equal(forbidden.length,0,'map navigation entered the gameplay skid pose');
  assert.equal(runtime.activeClipId,'player.idle','map did not settle to Idle');
  // A scripted boardslide already owns its mounting/landing hops; it must
  // not enter gameplay Land or Skid when the map returns to walking/idle.
  map.activate(level,'slipstream');assert.ok(map.travelTo('codex-switchback'));
  let boardslide=0;
  for(let f=0;f<500;f++){
    map.step(1/60,input);level.update(1/60);
    if(p.animationClipHint==='player.grind')boardslide++;
    assert.equal(runtime.diagnostics.transientClipId,null,'map inherited a gameplay one-shot');
  }
  assert.ok(boardslide>20);assert.equal(runtime.activeClipId,'player.idle');
  map.deactivate();
  const flat=new Level(scene,{id:'map-reentry-test',name:'Map reentry',data:{v:1,name:'Map reentry',spawn:[0,.02,0],killY:-20,
    components:[{t:'platform',p:[0,-.5,0],s:[100,1,100]},{t:'gate',p:[0,0,-45]}]}});
  const startGameplaySkid=()=>{
    p.enterLevel('map-reentry-test');p.respawn(flat,true);input.moveX=0;input.moveY=1;
    for(let f=0;f<140;f++){p.step(1/60,input,flat);flat.update(1/60);}
    input.moveY=0;p.step(1/60,input,flat);
    assert.equal(runtime.activeClipId,'player.run-stop','ordinary gameplay lost its skid');
  };
  startGameplaySkid();
  map.activate(level,'jungle');
  assert.equal(p.animationIntent.presentation,'world-map');
  assert.equal(runtime.activeClipId,'player.idle','entry carried an active skid into the map');
  assert.equal(runtime.diagnostics.transitionBlendWeight,null,'entry kept a frozen outgoing skid pose');
  for(let f=0;f<300;f++){map.step(1/60,input);assert.equal(runtime.activeClipId,'player.idle');}
  map.deactivate();assert.equal(p.animationIntent.presentation,'gameplay');
  startGameplaySkid();
  for(let f=0;f<70;f++){p.step(1/60,input,flat);flat.update(1/60);}
  assert.equal(runtime.activeClipId,'player.idle');
  runtime.dispose();flat.dispose();level.dispose();
  console.log('PASS recorded map taps, boardslide endings, active-skid entry, idle hold and restored gameplay skids');
}finally{await server.close();console.warn=warn;console.error=error;}
