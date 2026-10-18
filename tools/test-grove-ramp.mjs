import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const code=await transform(await readFile('src/levels/jungle-minefield.ts','utf8'),{loader:'ts',format:'esm'});
const m=await import('data:text/javascript;base64,'+Buffer.from(code.code).toString('base64')),f=m.GROVE_FIELDS[6];
const cases=[
 {name:'left edge',x:-4.5,pass:true},
 {name:'centre',x:0,pass:true},
 {name:'right edge',x:4.5,pass:true},
 {name:'early jump',x:0,release:16,pass:false},
 {name:'short run-up',x:0,runUp:17,pass:false},
 {name:'no jump',x:0,noJump:true,pass:false},
],reports=[];
await mkdir('/private/tmp/grove-ramp',{recursive:true});
for(const c of cases){
 const report={name:c.name,expectedClear:c.pass};
 try{await withBlockworksRuntime(async r=>{
  r.stepFor(25);const p=r.p,release=f.start-(c.release??2);
  r.until(()=>-p.pos.z>release,{moveY:1,jumpHeld:true},{maxFrames:600,label:'ordinary acceleration to ramp'});
  report.takeoff=r.snapshot();
  if(!c.noJump)r.releaseJump({moveY:1});
  r.until(()=>p.state==='dead'||p.grounded&&-p.pos.z>f.end,{moveY:1,...(c.noJump?{jumpHeld:true}:{})},{maxFrames:300,allowDeath:true,label:'jump outcome'});
  report.outcome=r.snapshot();report.detonated=r.l.minefields.fields.filter(s=>s.detonated).map(s=>s.data.id);
  assert.equal(p.state!=='dead',c.pass);
  if(c.pass){
   assert.ok(report.takeoff.speed>r.TUNING.maxSpeed*.95,'reach ordinary top speed before jumping');
   assert.ok(Math.max(...r.trace.map(t=>Math.abs(t.speed)))<=r.TUNING.maxSpeed+.05,'no speed boost');
   assert.deepEqual(report.detonated,[]);
  }else assert.deepEqual(report.detonated,[7]);
  report.pass=true;
 },{modulePath:'/src/levels/jungle-minefield.ts',source:m=>m.JUNGLE_MINEFIELD_LEVEL,levelId:'jungle-minefield',start:[c.x,.1,c.runUp?-f.start+c.runUp:-f.clueAt-2],maxFrames:1200});
 }catch(e){report.pass=false;report.error=String(e);process.exitCode=1;}
 reports.push(report);console.log(JSON.stringify(report));
}
await writeFile('/private/tmp/grove-ramp/review.json',JSON.stringify(reports,null,2));
