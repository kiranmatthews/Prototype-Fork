import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { pathToFileURL } from 'node:url';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

/** Continue an existing live run from the foundry checkpoint or ferry bank. */
export function runMachinery(ctx) {
  const {p,l,THREE,sourceModule:m,stepFor,charge,until,releaseJump,steerToward,TUNING}=ctx;
  const begin=ctx.frame,deathsBefore=p.totalDeaths,entryStation=20-p.pos.z;
  const timeOrigin=l.time-ctx.frame*ctx.dt,before=JSON.stringify(TUNING),[ferry,lift]=l.movers;
  assert.ok(ferry&&lift,'source machinery missing');
  const station=()=>20-p.pos.z;
  const top=platform=>platform.mesh.position.y+platform.mesh.geometry.parameters.height/2;
  const ferryStation=()=>20-ferry.mesh.position.z;
  const phaseWait=(predicate,name)=>until(predicate,{jumpHeld:true},{maxFrames:600,label:name});
  const walkTo=(target,opts={})=>{
    const tolerance=opts.tolerance??.12;
    until(()=>ctx.distanceTo(target)<tolerance,()=>{
      assert.ok(p.grounded,opts.label+' lost supported walking');
      const distance=ctx.distanceTo(target),pace=.15+.65*Math.max(0,Math.min(1,(distance-.6)/2.4));
      return steerToward(target,{pace,tolerance});
    },{maxFrames:opts.maxFrames??1800,label:opts.label});
    stepFor(opts.settleFrames??18);
    assert.ok(p.grounded&&!p.isBailing&&ctx.distanceTo(target)<(opts.arrivalTolerance??.25),
      opts.label+' did not stop on its intended support');
  };
  const hop=(target,id,label)=>{
    releaseJump(steerToward(target));assert.equal(p.state,'air',label+' must launch');
    until(()=>p.grounded,()=>steerToward(target),{maxFrames:120,label});
    assert.equal(p.groundHit?.moverId??null,id,label+' wrong support');
    assert.ok(ctx.distanceTo(target)<1.4,label+' missed intended landing area: '+JSON.stringify(ctx.snapshot()));
    return {time:+l.time.toFixed(2),position:p.pos.toArray().map(n=>+n.toFixed(2))};
  };

  // Carry the full journey's live state from the foundry. The left approach
  // passes beside the optional high rail. Releasing charge is an ordinary
  // ollie onto the broad apron; braking begins before the ferry edge.
  let approach=null;
  if(station()<1332) {
    ctx.skateAlong(s=>m.routePoint(s,8.4,-2.4),{to:1305,progress:station,lookAhead:10,
      maxFrames:1200,label:'charge and carve from foundry toward machinery'});
    if(ctx.lastInput.jumpHeld) {
      // The takeoff heading already follows the apron. Neutral stick in this
      // short ollie prevents a held ground carve becoming a THPS air spin.
      releaseJump({});
      until(()=>p.grounded,{},
        {maxFrames:180,label:'release approach charge on the freight apron'});
    }
    until(()=>!p.freeSkate&&Math.abs(p.speed)<.1,()=>({...steerToward(m.routePoint(station()+14,8.4,-2.4)),grabHeld:true}),
      {maxFrames:240,label:'brake before the ferry boarding edge'});
    stepFor(45);
    assert.ok(p.grounded&&station()<1334,'machinery approach must stop before its boarding edge: '+JSON.stringify(ctx.snapshot()));
    approach=ctx.snapshot();
  }
  walkTo([ferry.mesh.position.x,8.4,20-1338.5],{tolerance:.12,arrivalTolerance:.22,label:'walk to ferry boarding edge'});
  charge();phaseWait(()=>ferryStation()<1346&&ferry.lastDelta.z>0,'wait for returning freight deck');
  const ferryBoard=hop(()=>[ferry.mesh.position.x,top(ferry),ferry.mesh.position.z+1],0,'board returning ferry');
  walkTo(()=>[ferry.mesh.position.x,top(ferry),ferry.mesh.position.z-2.6],
    {tolerance:.15,arrivalTolerance:.3,settleFrames:30,label:'cross the moving freight deck'});
  charge();phaseWait(()=>ferryStation()>1365,'ride ferry to far dock');
  const ferryExit=hop(m.routePoint(1371,8.4,-2.5),null,'leave ferry onto receiving bend');
  stepFor(25);
  walkTo(m.routePoint(1404,8.4),{tolerance:.12,arrivalTolerance:.25,maxFrames:1200,label:'walk curved link to lift'});
  charge();phaseWait(()=>top(lift)<9&&lift.lastDelta.y<0,'wait for descending lift');
  const liftBoard=hop(()=>[lift.mesh.position.x,top(lift),lift.mesh.position.z+2.3],1,'board low loading lift');
  walkTo(()=>[lift.mesh.position.x,top(lift),lift.mesh.position.z-2.6],
    {tolerance:.15,arrivalTolerance:.3,settleFrames:30,label:'cross the rising lift'});
  charge();phaseWait(()=>top(lift)>12.9,'ride lift to upper roof');
  const liftExit=hop(m.routePoint(1416,13.2),null,'leave lift onto upper roof');
  assert.ok(Math.abs(p.pos.y-13.2)<.08,'upper roof height');

  // Compare real planted-player movement with the authored moving surface.
  // Player.step consumes the previous Level.update delta, hence the two-tick
  // offset. This works at arbitrary inherited world times without installing
  // a callback or replacing any runner/controller method.
  const frames=ctx.trace.slice(begin),carried=new Map();let carryError=0;
  for(let i=1;i<frames.length;i++) {
    const current=frames[i],previous=frames[i-1],id=current.mover;
    if(id===null||id!==previous.mover||!current.grounded||!previous.grounded||Math.abs(previous.speed)>=.01||
      current.input.moveX||current.input.moveY||current.input.jumpReleased)continue;
    const platform=l.movers[id],t1=timeOrigin+(current.frame-2)*ctx.dt,t0=timeOrigin+(current.frame-3)*ctx.dt;
    const expected=platform.axisV.clone().multiplyScalar((Math.sin(t1*platform.speed+platform.phase)-Math.sin(t0*platform.speed+platform.phase))*platform.amp);
    const actual=new THREE.Vector3(...current.position).sub(new THREE.Vector3(...previous.position));
    carryError=Math.max(carryError,actual.distanceTo(expected));carried.set(id,(carried.get(id)??0)+1);
  }
  assert.ok((carried.get(0)??0)>10&&(carried.get(1)??0)>10,'both machines must carry a planted rider');
  assert.ok(carryError<.005,`moving support drifts from the rider: ${carryError}`);
  assert.equal(p.totalDeaths,deathsBefore);assert.equal(JSON.stringify(TUNING),before);
  return {test:'continuous freight and lift traversal',entryStation,exitStation:station(),
    approachStop:approach?{station:20-approach.position[2],speed:approach.speed}:null,
    ferryBoard,ferryExit,liftBoard,liftExit,carriedFrames:Object.fromEntries(carried),maximumCarryError:carryError,
    frames:ctx.frame-begin,seconds:(ctx.frame-begin)*ctx.dt};
}

export async function runMachineryChecks() {
  const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
  let authored;try{authored=await server.ssrLoadModule('/src/levels/codex-lab.ts');}finally{await server.close();}
  const evidence=[],failures=[];
  for(const initialWait of [0,2.1,4.6]) {
    try {
      const result=await withBlockworksRuntime(ctx=>{ctx.stepFor(Math.round(initialWait/ctx.dt));return runMachinery(ctx);},
        {start:authored.routePoint(1333,8.42)});
      evidence.push({initialWait,...result});
    }catch(error){failures.push({initialWait,error:error.message});}
  }
  try {
    evidence.push(await withBlockworksRuntime(runMachinery,{start:authored.routePoint(1280,8.42,2.4)}));
  }catch(error){failures.push({entry:'foundry checkpoint',error:error.message});}
  console.log(JSON.stringify({evidence,failures},null,2));
  assert.equal(failures.length,0,failures.map(f=>JSON.stringify(f)).join('\n'));
  console.log('PASS continuous foundry approach, freight boarding/carry/exit and loading lift at three natural arrival phases');
  return evidence;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runMachineryChecks();
