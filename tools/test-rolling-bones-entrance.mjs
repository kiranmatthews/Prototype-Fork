import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.ROLLING_BONES_OUTPUT??'/tmp/rolling-bones-evidence';await mkdir(out,{recursive:true});
let entries=0;
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m,THREE}=r,point=m.rumblePoint(736,m.rumbleHeight(736)+.12,0);
 p.respawn(l,true,false,{position:new THREE.Vector3(...point),heading:new THREE.Vector3(...m.rumbleTangent(736))});
 l.boulder.course.reset(p.pos);r.stepFor(25);assert.ok(p.grounded);assert.ok(!l.boulder.course.active);assert.equal(entries,0);
 const target=m.rumblePoint(736,m.rumbleHeight(736)+1.05,4);
 r.walkTo(m.rumblePoint(736,m.rumbleHeight(736),1.5),{pace:.3,maxFrames:300,label:'approach the raised bonus stone'});
 r.jumpTo(target,{pace:.7,chargeFrames:26,arrivalTolerance:1.1,heightTolerance:.15,label:'deliberate jump into Moonbone'});
 r.stepFor(10);assert.equal(entries,1);assert.ok(l.bonusPlatformAt(p.pos));
 const entered=p.pos.toArray(),state=p.captureRunState();p.resumeSuspendedLevel(l,l.bonusReturnPoint(),state);r.stepFor(35);
 assert.ok(p.grounded);assert.ok(!l.boulder.course.active);assert.equal(p.totalDeaths,0);assert.equal(entries,1);
 const report={passed:true,entries,entered,returned:p.pos.toArray(),supportedReturn:true,sheltered:true,deaths:0};
 await writeFile(out+'/entrance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/tools/rolling-bones-source.ts',source:m=>m.ROLLING_BONES_LEVEL,levelId:'rolling-bones',maxFrames:1800,
 controlFrame:r=>r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1},
 onTick:(row,r)=>{if(r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))entries++;}});
