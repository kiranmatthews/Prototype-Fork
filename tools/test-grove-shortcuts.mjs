import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const baseline=process.argv.includes('--baseline'),sweep=process.argv.includes('--sweep'),reports=[];
const jumps=[{name:'quick second jump',kind:'board',delay:24,hold:1},{name:'charged late second jump',kind:'board',delay:12,hold:24}];
const envelope=[{name:'single ollie',kind:'board',delay:0,hold:0},
 ...[1,4,8,12,16,20,24,28,32].flatMap(delay=>[1,6,12,18,24].map(hold=>({name:'second-pop timing sweep',kind:'board',delay,hold}))),
 ...[8,16,24,30,34,38,40].map(delay=>({name:'foot double jump',kind:'foot',delay,hold:1}))];
await mkdir('/private/tmp/grove-shortcuts',{recursive:true});
await withBlockworksRuntime(async r=>{
 const p=r.p,V=r.THREE.Vector3;
 const shortest=Math.min(...r.sourceModule.GROVE_FIELDS.filter(f=>f.id!==7).map(f=>f.end-f.start));
 for(const f of r.sourceModule.GROVE_FIELDS.filter(f=>sweep?f.id===6:f.id!==7)){
  for(const jump of sweep?envelope:jumps){
   p.respawn(r.l,true,false,{position:new V(4.5,.1,-f.start+(jump.kind==='board'?60:.6)),heading:new V(0,0,-1)});r.stepFor(25);
   if(jump.kind==='board')r.until(()=>-p.pos.z>f.start-.6,{moveY:1,jumpHeld:true},{maxFrames:600,label:'top-speed approach'});else r.charge(26);
   const takeoff=r.snapshot();if(jump.kind==='board')assert.ok(takeoff.speed>=22.9);
   r.releaseJump({moveY:1});let air=0;
   while(air<240&&!p.grounded&&p.state!=='dead'){
    air++;r.tick({moveY:1,jumpHeld:air>=jump.delay&&air<jump.delay+jump.hold});
   }
   assert.ok(air<240,'jump must resolve without modifying physics');
   const skipped=-p.pos.z>=f.end&&p.state!=='dead';
   const report={field:f.id,length:f.end-f.start,jump:jump.name,kind:jump.kind,delay:jump.delay,hold:jump.hold,airFrames:air,takeoffSpeed:takeoff.speed,distance:takeoff.position[2]-p.pos.z,landingBeyondStart:-p.pos.z-f.start,skipped,state:p.state};
   reports.push(report);console.log(JSON.stringify(report));
   if(!baseline){
    assert.ok(!skipped&&-p.pos.z<f.end-6,`field ${f.id} can be bypassed or lacks a landing margin`);
    assert.ok(report.distance<shortest-6,'native jump envelope exceeds the shortest ordinary field margin');
   }
  }
 }
},{modulePath:'/src/levels/jungle-minefield.ts',source:m=>m.JUNGLE_MINEFIELD_LEVEL,levelId:'jungle-minefield',maxFrames:40000});
await writeFile(`/private/tmp/grove-shortcuts/${baseline?'baseline':sweep?'envelope':'review'}.json`,JSON.stringify(reports,null,2));
console.log(`${baseline?'BASELINE':'PASS'} ${reports.length} native ${sweep?'jump timing probes':'top-speed shortcut attempts'}; field 7 remains the intentional ramp jump.`);
