import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
// Each case makes one initial placement, then uses ordinary device samples.
// No position, velocity, tuning, enemy or crate state changes during traversal.
const out=process.env.LEVEL_POLISH_TRACES??join(tmpdir(),'level-polish-pilots');await mkdir(out,{recursive:true});
let entries,m;
await withBlockworksRuntime(async({server})=>{
 const {BUILTIN_LEVELS}=await server.ssrLoadModule('/src/level.ts');
 const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
 entries=new Map([...BUILTIN_LEVELS,...pack.levels].map(e=>[e.id,e]));
 m=await server.ssrLoadModule('/src/levels/codex-lab.ts');
});
const cases=[
 {name:'blockworks-entry-rail',id:'codex-lab',start:m.routePoint(112,1.55,-4.4),run:r=>ride(r,'Outside arc over the first gap')},
 {name:'blockworks-lift-bypass',id:'codex-lab',start:m.routePoint(1320,8.55,0),run:r=>ride(r,'Machinery high line · rising S grind')},
 {name:'coastal-stair-bypass',id:'coastal-street-run',start:[-2.3,7.12,-1391],run:r=>ride(r,'street rail 8')},
 {name:'coastal-final-rail',id:'coastal-street-run',start:[2.3,7.12,-2849],run:r=>ride(r,'street rail 14')},
 {name:'sky-recovery-hop',id:'sky',start:[0,.12,-37.4],run:r=>{
   r.stepFor(20);const cp=r.l.checkpoints[0];
   r.until(()=>cp.active,(_r,i)=>({moveY:.25,spinHeld:i%30<2}),{maxFrames:180,label:'bank widened recovery deck'});
   r.walkTo([0,0,-40.5],{pace:.22,arrivalTolerance:.3});
   r.jumpTo([0,0,-44.5],{airButtons:{spinHeld:true},arrivalTolerance:2,heightTolerance:.2});
   assert.equal(r.p.totalDeaths,0);assert.ok(r.p.grounded);return{checkpoint:true,landing:r.p.pos.toArray()};
 }},
 {name:'sky-loaded-rope',id:'sky',start:[1.8,.12,-83],run:r=>{
   r.stepFor(20);r.charge();r.releaseJump({moveY:.5});
   r.until(()=>r.p.pos.y>1.65,{moveY:.5},{maxFrames:60,label:'jump clear of the deck edge'});
   r.until(()=>r.p.state==='grind',{moveY:.6,grindHeld:true},{maxFrames:90,label:'catch sky rope from recovery deck'});
   assert.ok(r.l.ropes.some(rope=>rope.rail===r.p.grindRail),'catch the actual rope');
   r.until(()=>r.p.pos.z<-94,()=>balance(r),{maxFrames:400});assert.equal(r.p.state,'grind');assert.equal(r.p.totalDeaths,0);
   return{position:r.p.pos.toArray(),state:r.p.state};
 }},
 {name:'switchyard-reward-finish',id:'switchyard',start:[212,4.12,0],run:r=>{
   r.stepFor(20);const reward=r.l.crates.find(c=>Math.abs(c.mesh.position.x-221)<.01);
   r.until(()=>!reward.alive,(_r,i)=>({moveX:.5,spinHeld:i%26<2}),{maxFrames:400,label:'defeat spiker and claim mastery reward'});
   assert.notEqual(r.p.state,'finished','finish stole the reward');
   r.until(()=>r.p.state==='finished',{moveX:.5},{maxFrames:300,label:'finish after reward'});
   assert.equal(r.p.totalDeaths,0);return{reward:true,state:r.p.state};
 }},
 {name:'flats-bank-fall-respawn',id:'flats',start:[22,90.12,-265],run:r=>{
   r.stepFor(20);const cp=r.l.checkpoints[1];
   r.until(()=>cp.active,(_r,i)=>({...r.steerToward(cp.spawnPos,{pace:.35}),spinHeld:i%26<2}),{maxFrames:240,label:'bank pipe yard'});
   r.until(()=>r.p.totalDeaths>0,()=>r.steerToward([55,90,-235]),{maxFrames:1500,allowDeath:true,label:'fall off the open runway shoulder'});
   r.until(()=>r.p.grounded&&!r.p.isBailing&&!['dead','gameover'].includes(r.p.state),{},{maxFrames:600,allowDeath:true,label:'recover banked checkpoint'});
   assert.equal(r.p.totalDeaths,1);assert.ok(r.p.pos.distanceTo(cp.spawnPos)<1);return{checkpoint:true,deaths:1,respawn:r.p.pos.toArray()};
 }},
];
function balance(r){return{moveX:Math.max(-1,Math.min(1,-r.p.balance*8-r.p.balanceVel*.8)),grindHeld:true};}
function ride(r,name){
 const component=r.source.components.find(c=>c.nm===name);assert.ok(component,name);
 const rail=r.l.rails.find(rail=>rail.object.userData.editorIdx===r.source.components.indexOf(component));assert.ok(rail,name);
 r.stepFor(20);assert.ok(r.p.grounded,'supported approach');
 r.until(()=>r.p.state==='grind',()=>({...r.steerToward(rail.pointAt(5)),grindHeld:true}),{maxFrames:120,label:'board '+name});
 assert.equal(r.p.grindRail,rail,'caught a different rail');
 r.until(()=>r.p.grindT>rail.totalLength-2,()=>balance(r),{maxFrames:3600,label:'ride '+name});
 assert.equal(r.p.grindRail,rail);assert.equal(r.p.totalDeaths,0);
 const end=r.snapshot();return{length:rail.totalLength,end};
}
const reports=[];
for(const c of cases){
 if(process.env.POLISH_CASE&&!c.name.includes(process.env.POLISH_CASE))continue;
 try{await withBlockworksRuntime(async r=>{
  try{const result=c.run(r);const report={pass:true,name:c.name,id:c.id,start:c.start,frames:r.frame,result,inputs:r.trace.map(s=>s.input),end:r.snapshot()};
   await writeFile(`${out}/${c.name}.json`,JSON.stringify(report));reports.push({...report,inputs:undefined});console.log(JSON.stringify({name:c.name,pass:true,frames:r.frame,result}));}
  catch(e){await writeFile(`${out}/${c.name}-failure.json`,JSON.stringify({error:String(e),trace:r.trace},null,2));throw e;}
 },{source:()=>entries.get(c.id).data,levelId:c.id,start:c.start,endlessDeaths:true,
  controlFrame:r=>r.p.courseInputDirection(r.l)??{x:0,z:-1}});}
 catch(e){reports.push({name:c.name,pass:false,error:String(e)});console.log(JSON.stringify(reports.at(-1)));}
}
await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));
assert.ok(reports.every(r=>r.pass),'Placement input pilots failed');
