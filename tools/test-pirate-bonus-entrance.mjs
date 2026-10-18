import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {pirateCatwalkJourney} from './drowned-crown/catwalk-pilot.mjs';
const pack=JSON.parse(await readFile(process.env.PIRATE_CATWALK_LEVELS??new URL('../public/levels.json',import.meta.url),'utf8'));
const published=pack.levels.find(entry=>entry.id==='drowned-crown').data;
const out=process.env.PIRATE_CATWALK_REPORT??join(tmpdir(),'pirate-catwalk-evidence.json');
const report={cases:[]};
for(const side of [-1,1]){
 let entries=0;
 await withBlockworksRuntime(async r=>{
  assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(r.source)),published),'Current source and release snapshot must match');
  // Probe production Player contact normals against independent world-space
  // triangle cross products before starting either input-only journey.
  if(side<0){
   report.normals=[];const saved=r.p.pos.clone(),previous=r.p.prevPos.clone();
   try{
    for(const [x,y,z] of [...[936,1064].flatMap(x=>[-208,-220,-244,-252,-255,-259].map(z=>[x,27,z])),
      [-71.5,-5,193],[-69.2,-5,181],[-57,-5,140],[-43,-4,112]]){
     r.p.pos.set(x,y,z);r.p.prevPos.copy(r.p.pos);
     const contact=r.p.queryGround(r.l);
     assert.ok(contact?.name.includes('sampled Meshy deck support'),'Normal probe must touch a measured boardwalk');
     const ray=new r.THREE.Raycaster(r.p.pos.clone().add(new r.THREE.Vector3(0,2.5,0)),new r.THREE.Vector3(0,-1,0));
     const hit=ray.intersectObject(contact.mesh,false)[0],positions=hit.object.geometry.attributes.position;
     const at=i=>new r.THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(hit.object.matrixWorld);
     const a=at(hit.face.a),b=at(hit.face.b),c=at(hit.face.c),actual=b.sub(a).cross(c.sub(a)).normalize();
     const error=contact.normal.angleTo(actual)*180/Math.PI;
     report.normals.push({x,z,surface:contact.name,reported:contact.normal.toArray(),actual:actual.toArray(),errorDegrees:error});
     assert.ok(error<.0001,`Boardwalk contact normal differs from its physical triangles by ${error} degrees`);
    }
   }finally{r.p.pos.copy(saved);r.p.prevPos.copy(previous);}
  }
  const tuning=JSON.stringify(r.TUNING),row={side,stage:'approach',evidence:[]};report.cases.push(row);
  const bail=r.p.bail.bind(r.p);r.p.bail=(...args)=>{row.bail={args,position:r.p.pos.toArray(),stack:new Error().stack};return bail(...args);};
  const run=afterBonus=>{
   const pilot=pirateCatwalkJourney({p:r.p,l:r.l,side,report:row,afterBonus});let next=pilot.next();
   while(!next.done){r.tick(next.value);next=pilot.next();}return next.value;
  };
  try{
   const start=r.p.captureRunState();row.first=run(false);
   if(side<0){
    assert.equal(entries,1,'One deliberate bonus landing');assert.equal(r.l.bonusPlatformAt(r.p.pos),true);
    assert.deepEqual(r.l.bonusReturnPoint().toArray(),[936,26.2,-223]);
    const state=r.p.captureRunState();
    row.bonusLanding=r.p.pos.toArray();
    // Exercise the actual suspended parent restoration contract. Browser
    // coverage separately enters the child and returns through a real failure.
    r.p.resumeSuspendedLevel(r.l,r.l.bonusReturnPoint(),state);
    row.result=run(true);assert.equal(entries,1,'Walking beside the stone must not reopen the bonus');
   }else{row.result=row.first;assert.equal(entries,0);assert.equal(r.p.hasCrystal,true);}
   row.frames=r.frame;row.entries=entries;row.parentDeathsUnchanged=r.p.totalDeaths===start.totalDeaths;
   assert.equal(row.parentDeathsUnchanged,true);assert.equal(JSON.stringify(r.TUNING),tuning);
   console.log(JSON.stringify({side,frames:row.frames,entries,deaths:r.p.totalDeaths,crystal:r.p.hasCrystal,position:r.p.pos.toArray()}));
  }catch(error){row.failure=String(error);row.trace=r.trace.slice(-80);throw error;}
 },{modulePath:'/src/levels/pirate-wreck.ts',source:m=>process.env.PIRATE_CATWALK_LEVELS?published:m.PIRATE_WRECK_LEVEL,levelId:'drowned-crown',start:[1004,8.1,-124],heading:[0,0,-1],maxFrames:24000,
  onTick:(row,r)=>{if(r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))entries++;}
 }).finally(()=>writeFile(out,JSON.stringify(report,null,2)+'\n'));
}
console.log('PASS current port/starboard gallery traversal, deliberate bonus entry/return, crystal and broken catwalks.');
