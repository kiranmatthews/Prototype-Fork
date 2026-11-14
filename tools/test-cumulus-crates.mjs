import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
import {collectCumulusFlightLife} from './skystream-bonus-pilot.mjs';
const out=process.env.SKYSTREAM_BONUS_OUTPUT??'/tmp/skystream-bonus-review';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,source,THREE}=r,report={footprintProbes:0,maxFloorError:0},c=puzzleControls(r);
 if(process.env.CUMULUS_BASELINE){const before=JSON.parse(await readFile(process.env.CUMULUS_BASELINE,'utf8'));assert.deepEqual(JSON.parse(JSON.stringify({...source,components:source.components.filter(c=>c.t!=='crate')})),{...before,components:before.components.filter(c=>c.t!=='crate')});report.nonCratesAndSettingsExact=true;}
 if(process.env.SKYSTREAM_BASELINE){const before=JSON.parse(await readFile(process.env.SKYSTREAM_BASELINE,'utf8')),current=(await r.server.ssrLoadModule('/src/levels/skystream.ts')).SKYSTREAM_LEVEL;assert.deepEqual(JSON.parse(JSON.stringify(current)),before);report.mainEntireSourceExact=true;}
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const box of l.crates){const data=source.components[box.mesh.userData.editorIdx];if(!data.nm?.startsWith('Cumulus delivery /'))continue;
  const base=source.components.filter(c=>c.t==='crate'&&c.nm?.split(' / ')[1]===data.nm.split(' / ')[1]).reduce((y,c)=>Math.min(y,c.p[1]),Infinity);if(data.p[1]!==base)continue;
  for(const dx of [-.556,.556])for(const dz of [-.556,.556]){ray.set(box.mesh.position.clone().setY(base+2).add(new THREE.Vector3(dx,0,dz)),down);ray.far=4;const hit=l.raycastGround(ray)[0];assert.ok(hit);const error=Math.abs(hit.point.y-box.box.min.y);report.maxFloorError=Math.max(report.maxFloorError,error);report.footprintProbes++;assert.ok(error<.001);}
 }
 assert.equal(report.footprintProbes,56);
 const run=g=>{let next=g.next();while(!next.done){r.tick(next.value);next=g.next();}return next.value;};
 const reset=()=>{p.respawn(l,true,false,{position:new THREE.Vector3(56.65,180.82,0),heading:new THREE.Vector3(1,0,0)});r.report={actions:[],evidence:[]};r.stepFor(25);};
 reset();run(c.hop([61.2,180,0],'ordinary clear below the life'));
 const reward=c.crateNamed('Cumulus final-flight life');assert.ok(reward.alive);report.ordinaryJump={lifeAlive:true,position:p.pos.toArray(),deaths:p.totalDeaths};
 reset();run(collectCumulusFlightLife(r));assert.ok(!reward.alive);assert.equal(p.totalDeaths,0);report.rewardJump={lifeAlive:false,position:p.pos.toArray(),credit:p.cratesBroken};
 reset();run(c.until(()=>p.state==='dead',()=>c.steer([58.7,180.7,0]),{label:'walk off the last cloud',limit:300,allowDeath:true}));report.missedJump={state:p.state};
 reset();assert.ok(l.crates.every(b=>b.alive));assert.equal(p.cratesBroken,0);report.retry={physical:l.crates.length,allAlive:true,credit:0};
 await writeFile(out+'/layout-and-risk.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/skystream-bonus.ts',source:m=>m.SKYSTREAM_BONUS_LEVEL,levelId:'bonus-skystream',controlFrame:()=>({x:0,z:-1}),maxFrames:2400});
