import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
import {normalizeGameInput} from './blockworks-runner.mjs';

await withSkateRuntime(async({THREE,server,Level,Player,CONST,TUNING})=>{
 const tuning=JSON.stringify(TUNING),dt=CONST.fixedStep,fixtures=[],results=[];
 const create=(kind='ice')=>{
  const surface=(p,s,ice)=>({t:'platform',p,s,...(ice?{slip:true,iceGrip:.12}:{}),edgeGrinding:false});
  const components=kind==='ice'||kind==='dry'?[surface([0,-.5,0],[400,1,400],kind==='ice')]:
   [surface([0,-.5,97],[400,1,200],kind==='ice-to-dry'),surface([0,-.5,-103],[400,1,200],kind==='dry-to-ice')];
  const level=new Level(new THREE.Scene(),{id:'slide-carry',name:'Slide carry',data:{v:1,name:'Slide carry',spawn:[0,.02,0],killY:-30,
   components:[...components,{t:'gate',p:[100,0,-150]}]}});
  level.root.updateMatrixWorld(true);const p=new Player(level.scene);p.enterLevel('slide-carry');p.respawn(level,true);
  const f={p,level,previous:{}};fixtures.push(f);return f;
 };
 const tick=(f,sample={})=>{
  const input=normalizeGameInput(sample,f.previous);f.previous={...input};f.p.step(dt,input,f.level);f.level.update(dt);f.p.commitRenderStep(f.level);
 };
 const hold=(f,n,input={})=>{for(let i=0;i<n;i++)tick(f,input);};
 const slide=(f,dir,held=false)=>{
  hold(f,25,dir);const start=f.p.pos.clone();tick(f,{...dir,grabHeld:true});assert.ok(f.p.slideTimer>0,'Circle did not start a slide');
  let frames=1;while(f.p.slideTimer>0&&frames<120){tick(f,held?{grabHeld:true}:{});frames++;}
  assert.equal(f.p.slideTimer,0,'slide did not end');return {start,frames,distance:f.p.pos.distanceTo(start)};
 };
 try{
  for(let i=0;i<8;i++)for(const held of [false,true]){
   const angle=i*Math.PI/4,dir={moveX:Math.sin(angle),moveY:Math.cos(angle)},f=create(),{p}=f;
   const ended=slide(f,dir,held),velocity=p.walkVelocity.clone(),exitSpeed=velocity.length(),at=p.pos.clone();
   assert.ok(exitSpeed>20&&exitSpeed<TUNING.slideSpeed,`ice discarded exit speed: ${exitSpeed}`);
   assert.equal(p.freeSkate,false,'slide mounted a board');assert.equal(p.crawling,false,'held Circle planted a crawl');
   tick(f,held?{grabHeld:true}:{});
   assert.ok(p.pos.distanceTo(at)>exitSpeed*dt*.94,'handoff inserted a stop frame');
   assert.ok(p.walkVelocity.dot(velocity)>0,'handoff lost its world direction');
   let recover=0;for(let frame=0;frame<60;frame++){
    tick(f,held?{grabHeld:true}:{});recover=Math.max(recover,p.slideRecoverT);
    assert.equal(p.freeSkate,false);assert.equal(p.crawling,false);
   }
   assert.equal(recover,0,'get-up recovery stopped the ice coast');assert.ok(p.walkVelocity.length()>10);
   results.push({direction:i,held,slideFrames:ended.frames,exitSpeed,coastDistance:p.pos.distanceTo(at),speedAfterSecond:p.walkVelocity.length()});
   p.respawn(f.level,true);assert.equal(p.iceSlideCarry,false);assert.equal(p.walkVelocity.length(),0);
  }
  for(const kind of ['dry','ice-to-dry','dry-to-ice']){
   const f=create(kind),ended=slide(f,{moveY:1});
   if(kind==='dry-to-ice')assert.ok(f.p.walkVelocity.length()>TUNING.walkSpeed,'entering ice failed to release the stop');
   else{
    assert.ok(Math.abs(ended.distance-TUNING.slideDistance)<1e-5,`${kind}: dry slide distance changed: ${ended.distance}`);
    assert.equal(f.p.walkVelocity.length(),0);assert.equal(f.p.iceSlideCarry,false);
    let recover=0;for(let i=0;i<25;i++){tick(f);recover=Math.max(recover,f.p.slideRecoverT);}
    assert.ok(recover>0,'dry slide lost its recovery');
   }
   results.push({kind,slideFrames:ended.frames,distance:ended.distance,exitSpeed:f.p.walkVelocity.length()});
  }
  const jumping=create();slide(jumping,{moveX:1});hold(jumping,3,{jumpHeld:true});tick(jumping,{jumpReleased:true});
  assert.equal(jumping.p.state,'air');assert.equal(jumping.p.lastJumpType,'Slide Jump');assert.equal(jumping.p.freeSkate,false);
  tick(jumping);assert.equal(jumping.p.iceSlideCarry,false,'jump retained a stale carry owner');
  const mounting=create();slide(mounting,{moveY:1});hold(mounting,14);hold(mounting,100,{moveY:1,jumpHeld:true});
  assert.equal(mounting.p.freeSkate,true,'ice coast blocked a deliberate board commitment');assert.equal(mounting.p.iceSlideCarry,false);
  assert.equal(JSON.stringify(TUNING),tuning);
  await writeFile('/private/tmp/ice-slide-carry-results.json',JSON.stringify(results,null,2));
  console.log('PASS eight-direction ice slide exits, held/released Circle, continuous coast, dry distance/recovery, surface crossings, jump/board ownership and reset');
  console.log(JSON.stringify(results));

  if(process.argv[2]){
   const replay=JSON.parse(await readFile(process.argv[2],'utf8')),{Replayer}=await server.ssrLoadModule('/src/replay.ts');
   const {SKY_BRIDGE_LEVEL}=await server.ssrLoadModule('/src/levels/sky-bridge.ts'),replayer=new Replayer();replayer.begin(replay);
   const l=new Level(new THREE.Scene(),{id:'sky',name:'Sky Bridge',data:SKY_BRIDGE_LEVEL}),p=new Player(l.scene),input={};
   p.enterLevel('sky');p.endlessDeaths=replay.endlessDeaths===true;p.respawn(l,true);let slides=0,iceSlides=0,iceFrames=0;
   try{for(let frame=0;frame<replay.frames;frame++){
    replayer.feed(input,p.camDir);const before=p.slideTimer;p.step(dt,input,l);l.update(dt);p.commitRenderStep(l);
    if(p.grounded&&p.groundHit?.slippy)iceFrames++;
    if(before<=0&&p.slideTimer>0){slides++;if(p.groundHit?.slippy)iceSlides++;}
   }}finally{replayer.end();l.dispose();}
   console.log('Supplied replay:',JSON.stringify({frames:replay.frames,slides,iceSlides,iceFrames,deaths:p.totalDeaths}));
  }
 }finally{for(const f of fixtures)f.level.dispose();}
});
