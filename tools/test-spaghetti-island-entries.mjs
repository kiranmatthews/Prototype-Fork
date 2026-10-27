import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/island-entries';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');const cases=[];
 for(let choice=0;choice<8;choice++){
  race.start('time-trial',270327);const trace=[];let passed=false;
  for(let frame=0;frame<1200;frame++){
   const input=race.phase==='running'?race.drive(0,false,choice):{};
   r.scene.updateMatrixWorld(true);race.step(r.dt,input);r.l.update(r.dt);r.p.commitRenderStep(r.l);race.commitRenderStep();
   if(frame%8===0)trace.push({frame,time:race.elapsed,p:r.p.pos.toArray(),state:r.p.state,rail:r.p.grindRail?.object.userData.sourceName,t:r.p.grindT,balance:r.p.balance,speed:r.p.speed,input:{x:input.moveX,y:input.moveY,grind:input.grindHeld}});
   if(r.p.state==='grind'&&r.p.grindRail?.object.userData.sourceName===r.sourceModule.SPAGHETTI_PATHS[choice].runs[0].name&&r.p.grindT>110){passed=true;break;}
   if(race.riders[0].falls)break;
  }
  const row={choice,passed,falls:race.riders[0].falls,trace};cases.push(row);console.log(JSON.stringify({...row,trace:trace.slice(-3)}));
 }
 await writeFile(out+'/report.json',JSON.stringify({scope:'All eight starting-island entries, ordinary production controls and balance; not whole-course evidence.',cases},null,2));assert.ok(cases.every(c=>c.passed&&c.falls===0));
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
