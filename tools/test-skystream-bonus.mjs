import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runSkystreamBonus} from './skystream-bonus-pilot.mjs';
const out=process.env.SKYSTREAM_BONUS_OUTPUT??'/private/tmp/skystream-bonus-review';
await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
  const {p,l,source,sourceModule:m}=r;
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  const {resolveBonusLevel,bonusCrateCount}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
  assert.ok(normalizeCustomLevelData(source));assert.ok(normalizeCustomLevelData(l.captureData()));
  assert.equal(resolveBonusLevel('skystream').name,source.name);
  assert.equal(resolveBonusLevel('secret-5').name,source.name);
  assert.equal(bonusCrateCount('skystream'),18);
  assert.equal(l.skyPreset,'clouds');assert.equal(l.totalCrates,18);
  const shells=[];l.root.traverse(o=>{if(o.userData.cloudPlatformVisual)shells.push(o);});
  assert.equal(shells.length,12);assert.ok(shells.every(o=>!l.groundMeshes.includes(o)));
  const contacts=l.groundMeshes.filter(o=>o.userData.cloudRoad);
  assert.equal(contacts.length,6);assert.ok(contacts.every(o=>!o.visible));
  const ray=new r.THREE.Raycaster();l.root.updateMatrixWorld(true);
  const at=(x,y,z=0)=>{ray.set(new r.THREE.Vector3(x,y+2,z),new r.THREE.Vector3(0,-1,0));ray.far=4;return ray.intersectObjects(contacts,false)[0];};
  for(const island of m.SKYSTREAM_BONUS_ISLANDS){
    for(let x=island.left+.05;x<island.right;x+=.25){
      const hit=at(x,island.top);assert.ok(hit);assert.ok(Math.abs(hit.point.y-island.top)<.001);
    }
  }
  for(let i=0;i<m.SKYSTREAM_BONUS_ISLANDS.length-1;i++){
    const a=m.SKYSTREAM_BONUS_ISLANDS[i],b=m.SKYSTREAM_BONUS_ISLANDS[i+1];
    assert.equal(at((a.right+b.left)/2,a.top),undefined,'Cloud art must not bridge the physical gap');
  }
  const report={stage:'start',actions:[],evidence:[]};
  const ctx={...r,report,islands:m.SKYSTREAM_BONUS_ISLANDS,get frame(){return r.frame;}};
  const pilot=runSkystreamBonus(ctx);
  let next=pilot.next(),error;
  try{while(!next.done){r.tick(next.value);next=pilot.next();}}catch(e){error=String(e);}
  const result={error,result:next.value,report,end:r.snapshot(),densityBytes:shells.reduce((n,m)=>n+m.userData.densityBytes,0)};
  await writeFile(out+'/native.json',JSON.stringify({...result,trace:r.trace}));
  console.log(JSON.stringify(result));assert.equal(error,undefined);assert.equal(p.state,'finished');
  assert.equal(p.cratesBroken,18);assert.equal(p.totalDeaths,0);
  assert.equal(report.evidence.filter(e=>e.action.startsWith('Cloud gap')).length,5);
},{modulePath:'/src/levels/skystream-bonus.ts',source:m=>m.SKYSTREAM_BONUS_LEVEL,levelId:'bonus-skystream',maxFrames:8000,endlessDeaths:true});
