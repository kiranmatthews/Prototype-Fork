import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { pathToFileURL } from 'node:url';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

export function runFoundry(r,{exerciseReward=true,verifyRespawn=true}={}) {
  const evidence=[],begin=r.frame,deathsBefore=r.p.totalDeaths;
  const {p,l,THREE,sourceModule:m,jumpTo,until,steerToward,tick,stepFor}=r;
  const f=m.BLOCKWORKS_FOUNDRY,station=()=>20-p.pos.z;
  const keys=Object.fromEntries(Object.entries(f.groups).map(([name,id])=>[name,l.crates.find(c=>c.bang&&c.groupIds?.includes(id))]));
  const metal=id=>l.crates.filter(c=>c.metal&&c.groupIds?.includes(id));
  assert.ok(Object.values(keys).every(Boolean));
  assert.ok(Object.values(f.groups).every(id=>metal(id).every(c=>c.pending)));
  const point=(s,y,u=0)=>m.routePoint(s,y,u);
  const position=()=>p.pos.toArray();
  const walk=(q,label)=>{
    until(()=>r.distanceTo(q)<.12,()=>{
      assert.ok(p.grounded,label+' lost supported walking');
      const distance=r.distanceTo(q),pace=.15+.65*Math.max(0,Math.min(1,(distance-.6)/2.4));
      return steerToward(q,{pace,tolerance:.12});
    },{maxFrames:2400,label});
    stepFor(18);
    assert.ok(p.grounded&&!p.isBailing&&r.distanceTo(q)<.25,label+' did not stop on its intended support');
  };
  const jump=(q,label)=>{
    const launch=position(),begin=r.frame;
    try { jumpTo(q,{heightTolerance:.12,arrivalTolerance:.65,label}); }
    catch(error) { throw new Error(`${label}: launch ${JSON.stringify(launch)}, target ${JSON.stringify(q)}, planar distance ${Math.hypot(q[0]-launch[0],q[2]-launch[2]).toFixed(3)}; ${error.message}; flight ${JSON.stringify(r.trace.slice(begin+26).map(row=>({f:row.frame,y:+row.position[1].toFixed(2),s:+(20-row.position[2]).toFixed(2),speed:+row.speed.toFixed(2),state:row.state,bail:row.bailing})))}`); }
    assert.ok(p.grounded&&p.state==='ride'&&!p.isBailing,label+' must end standing safely');
    evidence.push({action:label,launch:launch.map(n=>+n.toFixed(2)),landing:position().map(n=>+n.toFixed(2))});
  };
  const spinKey=(name,q)=>{
    walk([q[0],q[1],q[2]+1.25],`approach ${name} switch`);
    tick({spinHeld:true});stepFor(18);
    assert.ok(keys[name].bangUsed,`ordinary spin did not activate ${name}`);
    // A used switch remains a solid metal box: walk around it, not through it.
    const side=name==='stairs'?-1.6:1.6;
    walk([q[0]+side,q[1],q[2]+1.25],`sidestep the used ${name} switch`);
    walk([q[0]+side,q[1],q[2]-1.3],`pass the used ${name} switch`);
  };
  const pad=(q,half)=>({q,half});
  const clampToPad=(q,to)=>[Math.max(to.q[0]-to.half+.55,Math.min(to.q[0]+to.half-.55,q[0])),to.q[1],
    Math.max(to.q[2]-to.half+.55,Math.min(to.q[2]+to.half-.55,q[2]))];
  const hopFrom=(from,to,label)=>{
    const coords=[0,2].map(k=>{
      const amin=from.q[k]-from.half+.55,amax=from.q[k]+from.half-.55,bmin=to.q[k]-to.half+.55,bmax=to.q[k]+to.half-.55;
      if(amax<bmin)return[amax,bmin];if(bmax<amin)return[amin,bmax];
      const shared=(Math.max(amin,bmin)+Math.min(amax,bmax))/2;return[shared,shared];
    });
    walk([coords[0][0],from.q[1],coords[1][0]],label+' takeoff edge');
    jump([coords[0][1],to.q[1],coords[1][1]],label);
  };
  const bankEdge=m.BLOCKWORKS_GAPS.find(gap=>gap.kind==='three-switch route puzzle').a;
  const bankPlan=(platform,s,top,halfWidth,fromBank)=>{
    const plans=[];
    for(let u=-halfWidth;u<=halfWidth;u+=.1) {
      const bank=point(s,top,u),lid=clampToPad(bank,platform);
      plans.push({launch:fromBank?bank:lid,target:fromBank?lid:bank,distance:Math.hypot(bank[0]-lid[0],bank[2]-lid[2])});
    }
    plans.sort((a,b)=>a.distance-b.distance);return plans[0];
  };
  const bankHop=(platform,s,top,halfWidth,fromBank,label)=>{
    const plan=bankPlan(platform,s,top,halfWidth,fromBank);
    walk(plan.launch,label+' takeoff edge');jump(plan.target,label);
  };
  const rewardRoofs=metal(f.groups.reward).filter(c=>Math.abs(c.box.max.y-3.6)<.01),remaining=new Set(rewardRoofs),reward=[];
  while(remaining.size) {
    const cells=[remaining.values().next().value];remaining.delete(cells[0]);
    for(let i=0;i<cells.length;i++)for(const c of remaining)
      if(cells[i].box.clone().expandByScalar(.005).intersectsBox(c.box)){cells.push(c);remaining.delete(c);}
    const bounds=new THREE.Box3();for(const c of cells)bounds.union(c.box);
    const centre=bounds.getCenter(new THREE.Vector3());reward.push(pad([centre.x,3.6,centre.z],(bounds.max.x-bounds.min.x)/2));
  }
  reward.sort((a,b)=>b.q[2]-a.q[2]);
  const perch=pad(point(1131,3.6,11),3);
  const stairs=f.stairs.map(step=>pad(point(step.s,step.top,step.u),1.92));
  const tower=pad(f.bridgeKey,3.6);
  const bridge=f.bridge.map(step=>pad(point(step.s,step.top,step.u),1.92));

  // Retire an inherited held charge through its ordinary release/landing,
  // then brake on the broad receiving road before precision foot platforming.
  if(!p.grounded)until(()=>p.grounded,()=>steerToward(point(station()+14,3.6)),{maxFrames:180,label:'finish the inherited foundry arrival'});
  if(r.lastInput.jumpHeld) {
    r.releaseJump({});
    if(!p.grounded)until(()=>p.grounded,{}, {maxFrames:180,label:'release approach charge before the foundry'});
  }
  if(p.freeSkate||Math.abs(p.speed)>.1) {
    until(()=>!p.freeSkate&&Math.abs(p.speed)<.1,()=>({...steerToward(point(station()+14,3.6)),grabHeld:true}),
      {maxFrames:240,label:'brake naturally on the foundry approach'});
    stepFor(45);
  }
  until(()=>station()>=1078,()=>steerToward(point(station()+6,3.6)),{maxFrames:600,label:'walk the actual curved foundry approach'});
  stepFor(30);
  if(exerciseReward) {
  spinKey('reward',f.rewardKey);
  assert.ok(metal(f.groups.reward).every(c=>!c.pending),'right key failed to build reward route');
  assert.ok(metal(f.groups.stairs).every(c=>c.pending)&&metal(f.groups.bridge).every(c=>c.pending),'right key bypassed the main puzzle');
  bankHop(reward[0],bankEdge-.65,3.6,8,true,'reward first pier');
  for(let i=1;i<reward.length;i++)hopFrom(reward[i-1],reward[i],`reward pier ${i+1}`);
  hopFrom(reward.at(-1),perch,'lower reward perch');
  const mask=l.crates.find(c=>c.mask&&Math.hypot(c.mesh.position.x-perch.q[0],c.mesh.position.z-perch.q[2])<.1);
  assert.ok(mask,'lower perch reward is missing');
  const masksBefore=p.masks;
  walk([mask.mesh.position.x,3.6,mask.mesh.position.z+1.25],'claim the optional reward');
  tick({spinHeld:true});stepFor(18);
  assert.ok(!mask.alive&&(p.masks>masksBefore||(masksBefore>=2&&p.uberTimer>0)),
    'the lower branch must award a mask or its normal third-mask power-up');
  assert.ok(keys.bridge.bangUsed!==true&&metal(f.groups.bridge).every(c=>c.pending),'reward perch must not open the main crossing');
  hopFrom(perch,reward.at(-1),'return from reward perch');
  for(let i=reward.length-2;i>=0;i--)hopFrom(reward[i+1],reward[i],`return reward pier ${i+1}`);
  bankHop(reward[0],bankEdge-.65,3.6,8,false,'return to foundry bank');
  assert.ok(p.groundHit?.name!=='crate','reward route must return to permanent ground');
  assert.ok(r.trace.slice(begin).every(row=>!l.bonusPlatformAt(new THREE.Vector3(...row.position))),
    'reward collection and return must not accidentally enter the optional bonus');

  walk(point(1100,3.6),'return across the solid approach');walk(f.approach,'read the upper route from the bank');
  }
  spinKey('stairs',f.stairsKey);
  assert.ok(metal(f.groups.stairs).every(c=>!c.pending)&&metal(f.groups.bridge).every(c=>c.pending),'left key should build only access to the upper key');
  bankHop(stairs[0],bankEdge-.65,3.6,8,true,'upper stair first pier');
  for(let i=1;i<stairs.length;i++)hopFrom(stairs[i-1],stairs[i],`upper stair ${i+1}`);
  hopFrom(stairs.at(-1),tower,'upper switch tower');
  spinKey('bridge',f.bridgeKey);
  const usedNames=exerciseReward?['reward','stairs','bridge']:['stairs','bridge'];
  assert.ok(usedNames.every(name=>keys[name].bangUsed),'chosen switches must have real input hits');
  assert.ok(usedNames.every(name=>metal(f.groups[name]).every(c=>!c.pending)),'constructed terrain must remain available');
  if(!exerciseReward)assert.ok(!keys.reward.bangUsed&&metal(f.groups.reward).every(c=>c.pending),'direct route must leave the optional reward choice untouched');
  hopFrom(tower,bridge[0],'main bridge first pier');
  for(let i=1;i<bridge.length;i++)hopFrom(bridge[i-1],bridge[i],`main bridge pier ${i+1}`);
  const farBank=m.BLOCKWORKS_GAPS.find(gap=>gap.kind==='three-switch route puzzle').b;
  bankHop(bridge.at(-1),farBank+.65,8.4,6,false,'main crossing exit');
  assert.ok(p.groundHit?.name!=='crate','main bridge must reconnect to permanent road');
  assert.equal(p.totalDeaths,deathsBefore,'the puzzle must be completed without a hidden respawn');

  until(()=>station()>=1278,()=>steerToward(point(station()+6,8.4)),{maxFrames:1200,label:'walk the receiving curve to checkpoint'});
  stepFor(30);
  const cp=m.BLOCKWORKS_CHECKPOINTS.find(cp=>cp.s===1280);
  walk([cp.p[0]-1.25,cp.p[1],cp.p[2]],'approach the foundry checkpoint');tick({spinHeld:true});stepFor(18);
  assert.ok(l.activeCheckpoint,'checkpoint was not activated by the player');
  const storedCheckpoint=l.activeCheckpoint;
  assert.ok(storedCheckpoint.spawnPos.distanceTo(new THREE.Vector3(...cp.p))<4,'wrong checkpoint activated');
  const savedMetal=usedNames.flatMap(name=>metal(f.groups[name])).map(c=>({c,position:c.mesh.position.clone()}));
  // Walk beyond the real road edge. Masks may absorb the first basin contact;
  // ordinary death/respawn must eventually restore the checkpoint snapshot.
  if(verifyRespawn) {
  until(()=>p.state==='dead',()=>steerToward(point(1284,8.4,30)),{maxFrames:900,allowDeath:true,label:'fall into the reset basin'});
  until(()=>p.grounded&&p.state==='ride',{}, {maxFrames:600,allowDeath:true,label:'automatic checkpoint respawn'});
  assert.equal(l.activeCheckpoint,storedCheckpoint);
  assert.equal(p.totalDeaths,deathsBefore+1,'persistence proof must contain one real death');
  assert.ok(p.pos.distanceTo(storedCheckpoint.spawnPos)<2,'respawn missed the saved checkpoint');
  for(const {c,position:home} of savedMetal)assert.ok(c.alive&&!c.pending&&c.mesh.position.distanceTo(home)<.001,'checkpoint lost constructed steel');
  assert.ok(usedNames.every(name=>keys[name].bangUsed),'checkpoint lost a used key');
  evidence.push({action:'checkpoint persistence after real fall',deaths:p.totalDeaths,position:position(),builtSteel:savedMetal.length});
  }
  return {test:'input-only foundry choice and crossing',exerciseReward,verifyRespawn,evidence,
    frames:r.frame-begin,seconds:(r.frame-begin)*r.dt,exitStation:station(),deaths:p.totalDeaths-deathsBefore,builtSteel:savedMetal.length};
}

export async function runFoundryChecks() {
  const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
  let authored;try {authored=await server.ssrLoadModule('/src/levels/codex-lab.ts');}finally{await server.close();}
  const evidence=await withBlockworksRuntime(r=>runFoundry(r),{start:authored.routePoint(1040,3.62),maxFrames:30000,endlessDeaths:true});
  console.log(JSON.stringify(evidence,null,2));
  console.log('PASS input-only three-key foundry choice, reward return, upper ascent, curved bridge and checkpoint persistence');
  return evidence;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runFoundryChecks();
