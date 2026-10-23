import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// Run the actual School roof descent with each policy. Only the initial
// fixture differs; approach, flight and rollout use the ordinary device path.
await withSkateRuntime(async({server,THREE,Player,Level,scene,CONST,TUNING})=>{
  const m=await server.ssrLoadModule('/src/levels/school-source.ts');
  const {schoolSourceTrials,schoolSourceGamepad}=await server.ssrLoadModule('/tools/school-source-lines.ts');
  const {Input}=await server.ssrLoadModule('/src/input.ts');
  const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
  const {hugeDropBail:unused,...base}=m.SCHOOL_SOURCE_LEVEL;
  const before=JSON.stringify(TUNING),results=[];
  for(const option of [undefined,true,false]){
    const data={...base,...(option===undefined?{}:{hugeDropBail:option})};
    const normalized=normalizeCustomLevelData(data);assert.ok(normalized);assert.equal(normalized.hugeDropBail,option);
    const level=new Level(scene,{id:'school-landing-policy',name:data.name,data});scene.updateMatrixWorld(true);
    const p=new Player(scene);p.endlessDeaths=true;p.rawInput=makeInput();
    assert.equal(level.hugeDropBail,option!==false);
    const captured=normalizeCustomLevelData(level.captureData());assert.ok(captured);assert.equal(captured.hugeDropBail!==false,option!==false);
    const input=new Input(true);let sample={};input.pollGamepad=()=>schoolSourceGamepad(sample);
    const place=(original,heading,speed=0)=>{
      const position=new THREE.Vector3(...m.schoolSourcePoint(...original));
      p.respawn(level,true,true,{position,heading:new THREE.Vector3(...heading)});
      p.axisF.set(...heading).normalize();p.axisL.set(heading[2],0,-heading[0]);p.freeSkate=true;p.speed=speed;
      p.groundHit=p.queryGround(level);assert.ok(p.groundHit);
      p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);
    };
    const trial=schoolSourceTrials(p,level,place).find(t=>t.name==='Original roof drop into lower courtyard');assert.ok(trial);
    const result={option:option??'default',heightPenaltyTriggered:false,bail:false,contact:null,completed:false,frames:0,trace:[]};
    const original=p.beginHugeDropLandingBail;
    p.beginHugeDropLandingBail=function(...args){const triggered=original.apply(this,args);result.heightPenaltyTriggered||=triggered;return triggered;};
    try{
      trial.init();let airborne=false;
      for(let i=0;i<trial.limit;i++){
        sample=trial.sample(i);input.update();
        p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
        result.frames++;
        result.trace.push({frame:i,position:p.pos.toArray(),speed:p.speed,vertical:p.vVel,state:p.state,grounded:p.grounded});
        airborne||=!p.grounded;
        if(airborne&&!result.contact&&(p.grounded||p.isBailing))result.contact={frame:i,position:p.pos.toArray(),state:p.state};
        if(p.isBailing){result.bail=true;break;}
        if(trial.observe(i+1)){result.completed=true;break;}
      }
      assert.ok(result.contact);assert.equal(result.heightPenaltyTriggered,option!==false);
      assert.equal(result.bail,option!==false);assert.equal(result.completed,option===false);
      if(option===false){assert.equal(result.contact.state,'ride');assert.ok(trial.result.drop.metres>30);assert.equal(trial.result.drop.rolloutFrames,30);}
      result.drop=trial.result.drop;
      if(option===false){
        p.rawInput=makeInput();p.respawn(level,true,false,{position:new THREE.Vector3(1000,level.killY+.5,1000),heading:new THREE.Vector3(0,0,-1)});
        p.state='air';p.grounded=false;p.vVel=-12;p.speed=0;p.airFromSkate=true;
        let died=false,recovered=false,recoveryFrames=0;
        for(;recoveryFrames<480;recoveryFrames++){
          p.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);
          died||=p.state==='dead';
          assert.notEqual(p.state,'gameover');
          if(died&&p.grounded&&p.state==='ride'){assert.ok(p.queryGround(level));recovered=true;break;}
        }
        assert.ok(died&&recovered,'Source kill plane must still respawn onto supported ground');
        result.pitRecovery={died,recovered,frames:recoveryFrames+1,end:p.pos.toArray()};
      }
      results.push(result);
    }finally{p.beginHugeDropLandingBail=original;level.dispose();}
  }
  assert.deepEqual(results[0].trace,results[1].trace,'Explicit true preserves default contact behaviour');
  const contact=results[0].contact.frame;
  assert.equal(results[2].contact.frame,contact);
  assert.deepEqual(results[0].trace.slice(0,contact),results[2].trace.slice(0,contact),'Policy leaves every approach/flight frame unchanged');
  assert.equal(normalizeCustomLevelData({...base,hugeDropBail:1}),null);
  assert.equal(JSON.stringify(TUNING),before);
  const report={tuningUnchanged:true,approachAndFlightExact:true,comparedFrames:contact,invalidFlagRejected:true,results:results.map(({trace,...r})=>r)};
  await writeFile(process.env.SCHOOL_LANDING_REPORT||'/private/tmp/school-miami-review/reference-landing-policy.json',JSON.stringify(report,null,2));
  console.log(`PASS source roof landing: ${contact} identical pre-contact frames, default/true bail, false lands and rolls out.`);
});
