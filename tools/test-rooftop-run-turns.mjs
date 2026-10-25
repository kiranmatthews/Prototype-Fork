import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const replay=JSON.parse(await readFile(new URL('./fixtures/rooftop-run-turns-replay.json',import.meta.url),'utf8'));
const out=process.env.ROOFTOP_TURN_OUTPUT||'/private/tmp/rooftop-turn-replay';await mkdir(out,{recursive:true});
await withSkateRuntime(async({server,THREE,Level,Player,CONST,TUNING})=>{
 const {ROOFTOP_RELAY_LEVEL:data}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const {Replayer,isReplayFile}=await server.ssrLoadModule('/src/replay.ts');
 const animation=await server.ssrLoadModule('/src/animation/index.ts');
 const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
 assert.ok(isReplayFile(replay));
 const level=new Level(new THREE.Scene(),{id:replay.level,name:data.name,data}),p=new Player(level.scene);
 const binding=animation.RigBinding.fromSculptRuntime(p.animationRig.root),runtime=createCharacterAnimationRuntime(p,animation.createPlayerStarterAnimationSuite(binding.definition));
 p.enterLevel(replay.level);p.endlessDeaths=replay.endlessDeaths;p.respawn(level,true);level.scene.updateMatrixWorld(true);
 const replayer=new Replayer(),input=makeInput(),trace=[];replayer.begin(replay);
 try{
  for(let frame=0;frame<replay.frames;frame++){
   assert.ok(replayer.feed(input,p.camDir));p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);p.flushLevelCrateRewards(level);p.commitRenderStep(level);
   const direction=p.axisF.clone().multiplyScalar(input.moveY).addScaledVector(p.axisL,input.moveX).normalize();
   const wanted=Math.atan2(direction.x,direction.z)-Math.PI;
   trace.push({frame,input:[input.moveX,input.moveY],position:p.pos.toArray(),velocity:p.walkVelocity.toArray(),opposed:p.walkVelocity.dot(direction),
    facingError:Math.atan2(Math.sin(p.visualYaw-wanted),Math.cos(p.visualYaw-wanted)),yaw:p.visualYaw,ramp:p.walkRamp,turn:p.walkTurnaround,
    clip:runtime.activeClipId,cadence:p.animationIntent.motion.normalizedSpeed,phase:runtime.diagnostics.timelineTime,
    grounded:p.grounded,state:p.state,board:p.freeSkate,slip:p.groundHit?.slippy,iceWalk:p.groundHit?.iceWalk});
  }
  const turns=[];let prior=0,neutral=0;
  for(let frame=0;frame<replay.frames;frame++){
   const x=replay.mx[frame];
   if(x===0){neutral++;continue;}
   if(prior!==0&&x!==prior){
    let end=frame;while(end<Math.min(frame+50,replay.frames)&&replay.mx[end]===x)end++;
    turns.push({frame,neutral,fourth:trace[frame+3],next:trace.slice(frame,end)});
   }
   prior=x;neutral=0;
  }
  const report={frames:trace.length,turns,trace};await writeFile(out+'/replay.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(turns.map(t=>({frame:t.frame,neutral:t.neutral,turn:t.fourth.turn,ramp:t.fourth.ramp,facingError:t.fourth.facingError,opposed:t.fourth.opposed,clip:t.fourth.clip,cadence:t.fourth.cadence})),null,2));
  if(process.env.ROOFTOP_TURN_RECORD_ONLY)return;
  assert.equal(turns.length,11);
  for(const t of turns){
   assert.ok(t.fourth.grounded&&!t.fourth.board,`frame ${t.frame}: expected supported foot run`);
   assert.ok(Math.abs(t.fourth.facingError)<.001,`frame ${t.frame}: body must face the new direction within four frames after ${t.neutral} neutral frames`);
   assert.ok(t.fourth.opposed<0,`frame ${t.frame}: rain must retain opposite momentum during the pivot`);
   assert.ok(t.next.every(f=>f.clip==='player.run'),`frame ${t.frame}: normal run must continue across the reversal`);
   assert.ok(t.next.every(f=>f.cadence>.5),`frame ${t.frame}: run must not collapse into a slow walk through zero velocity`);
   assert.ok(new Set(t.next.map(f=>f.phase)).size>20,`frame ${t.frame}: run cycle must keep advancing`);
  }
  assert.ok(trace.every(f=>f.grounded&&f.state==='ride'&&!f.board),'The replay must remain an on-foot roof run');
  console.log('PASS recorded wet run reversals, short neutral gaps, four-frame facing, continuous cadence and retained opposite momentum');
 }finally{replayer.end();runtime.dispose();level.dispose();}
},{levelEntry:{id:'empty-turn-harness',name:'Turn harness',data:{v:1,name:'Turn harness',spawn:[0,.1,0],killY:-20,components:[{t:'platform',p:[0,-.5,0],s:[5,1,5]},{t:'gate',p:[0,0,-2]}]}}});
