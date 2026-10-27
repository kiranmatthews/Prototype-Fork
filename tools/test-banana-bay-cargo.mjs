import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {withBananaBay} from './banana-bay-runtime.mjs';

const out=process.env.BANANA_BAY_OUTPUT||resolve('docs/banana-bay/evidence');await mkdir(out,{recursive:true});
await withBananaBay(async r=>{
  const {p,l,THREE,source}=r,results=[];
  const spec=part=>source.components.find(c=>c.t==='crate'&&c.nm?.includes(part));
  const crate=c=>l.crates.find(b=>Math.hypot(b.mesh.position.x-c.p[0],b.mesh.position.z-c.p[2])<.03&&Math.abs(b.box.min.y-c.p[1])<.03);
  const distance=q=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);
  const steer=q=>{
    const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz);if(n<.03)return {};
    const f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1},m=Math.hypot(f.x,f.z)||1,v=Math.min(1,n/.65);
    return {moveX:(dx*-f.z+dz*f.x)/m/n*v,moveY:(dx*f.x+dz*f.z)/m/n*v};
  };
  const step=(n,s={})=>{for(let i=0;i<n;i++)r.tick(typeof s==='function'?s(i):s);};
  const until=(fn,s,label,limit=300)=>{
    for(let i=0;i<limit&&!fn();i++){
      r.tick(typeof s==='function'?s(i):s);
      assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),`${label}: ${JSON.stringify(r.snapshot())}`);
    }
    assert.ok(fn(),`${label} timeout: ${JSON.stringify(r.snapshot())}`);
  };
  const place=q=>{
    // Each case starts independently. From this point onward, only ordinary
    // movement/jump/spin inputs change the player and crate states.
    p.respawn(l,true,false,{position:new THREE.Vector3(q[0],q[1]+.08,q[2]),heading:new THREE.Vector3(0,0,-1)});
    step(20);assert.ok(p.grounded,'isolated cargo start is supported');
  };
  try{
    const arrowSpec=spec('preserve the arrow'),rewardSpec=spec('high parcel before');
    assert.ok(arrowSpec&&rewardSpec);
    const launch=arrowSpec.p,side=[launch[0],launch[1],launch[2]+2.3];place(side);
    const arrow=crate(arrowSpec),reward=crate(rewardSpec);assert.ok(arrow&&reward);
    const deaths=p.totalDeaths,start=r.frame;
    step(26,{jumpHeld:true});r.tick({jumpReleased:true});
    until(()=>p.vVel>15&&p.pos.y<arrow.box.max.y+.2,()=>({...steer(launch),jumpHeld:true}),'arrow contact',140);
    until(()=>!reward.alive||p.vVel<.65,{jumpHeld:true},'high parcel ascent',100);
    if(reward.alive){
      r.tick({});r.tick({jumpHeld:true});r.tick({jumpReleased:true});
      until(()=>!reward.alive,{},'high parcel double-jump head bump',100);
    }
    assert.ok(arrow.alive,'launcher preserved until high parcel is collected');
    until(()=>p.grounded,()=>steer(side),'return beside intact launcher',180);
    until(()=>!arrow.alive,i=>({...steer(launch),spinHeld:p.spinning||i%27===0}),'launcher collected last',120);
    assert.equal(p.totalDeaths,deaths);
    results.push({case:'high parcel before launcher',frames:r.frame-start,rewardCollected:!reward.alive,launcherCollected:!arrow.alive,deaths:p.totalDeaths-deaths});

    const tntSpec=spec('Fuse store / stomp cargo then retreat to the clear lane / tier 1');
    const capSpec=spec('Fuse store / stomp cargo then retreat to the clear lane / tier 2');
    const refugeSpec=spec('safe refuge reward');assert.ok(tntSpec&&capSpec&&refugeSpec);
    const q=tntSpec.p;place(r.route.bayCoastPoint(242,0,q[1]));
    const tnt=crate(tntSpec),cap=crate(capSpec),refuge=crate(refugeSpec),beforeDeaths=p.totalDeaths,tntStart=r.frame;
    step(26,{jumpHeld:true});r.tick({jumpReleased:true});
    until(()=>tnt.fuse!==undefined,()=>steer(q),'stomp the wood cap and light TNT',220);
    assert.equal(cap.alive,false,'wood cap was collected before retreat');
    until(()=>distance(refugeSpec.p)<1.5,()=>steer(refugeSpec.p),'reach the clear cargo refuge',180);
    until(()=>!refuge.alive,i=>({...steer(refugeSpec.p),spinHeld:p.spinning||i%27===0}),'collect the refuge reward',120);
    until(()=>!tnt.alive,{},'TNT detonates while player is safe',240);
    assert.equal(p.totalDeaths,beforeDeaths);assert.ok(!p.isBailing&&p.grounded);
    results.push({case:'TNT cap then clear refuge',frames:r.frame-tntStart,capCollected:!cap.alive,tntCleared:!tnt.alive,refugeReward:!refuge.alive,position:p.pos.toArray(),deaths:p.totalDeaths-beforeDeaths});
    console.log('PASS',JSON.stringify(results));
  }finally{
    await writeFile(out+'/cargo.json',JSON.stringify({results,end:r.snapshot(),trace:r.trace},null,2));
  }
});
