import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/island-entries';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');const cases=[];
 // Travel zones are XZ-only: no loop on another storey may accidentally
 // inherit a deck's fixed camera. Sample the actual native geometry and
 // production camera navigation, including each transition off the decks.
 const camera={deckSamples:0,railSamples:0,supportedEndSamples:0,maxHandoffDegrees:0,minimumRailAlignment:1};
 for(const dock of r.sourceModule.SPAGHETTI_DOCKS)for(const x of [-.48,0,.48])for(const z of [-.48,0,.48]){
  const at=r.l.cameraDirAt(dock.p[0]+x*dock.width,dock.p[1],dock.p[2]+z*dock.depth,{s:-1})??{x:0,z:-1};
  assert.ok(Math.abs(at.x)<1e-6&&at.z<-.999,'A decision platform must not select a branch for the player');camera.deckSamples++;
 }
 for(const path of r.l.railChoices.paths){
  const cursor={s:-1};
  for(const {rail} of path.rails)for(let t=0;t<=rail.totalLength;t+=2){
   const p=rail.pointAt(t),zone=r.l.zoneAt(p.x,p.z),tangent=rail.tangentAt(t),direction=r.l.cameraDirAt(p.x,p.y+.12,p.z,cursor);
   camera.railSamples++;
   if(zone){
    const dock=r.sourceModule.SPAGHETTI_DOCKS.find(d=>Math.abs(p.x-d.p[0])<=d.width/2&&Math.abs(p.z-d.p[2])<=d.depth/2);
    // Corner rounding starts just before some platform rims. These short
    // supported leads are valid; a loop above/below a deck is not.
    assert.ok(dock&&p.y-dock.p[1]>.4&&p.y-dock.p[1]<1.5&&Math.min(t,rail.totalLength-t)<30,'Only supported rail ends may enter a deck camera volume');
    const turn=Math.acos(-tangent.z/Math.hypot(tangent.x,tangent.z))*180/Math.PI;
    camera.maxHandoffDegrees=Math.max(camera.maxHandoffDegrees,turn);camera.supportedEndSamples++;
   }else{
    assert.ok(direction,'Curving rails beyond the platform retain a camera lane');
    const alignment=(direction.x*tangent.x+direction.z*tangent.z)/Math.hypot(tangent.x,tangent.z);
    camera.minimumRailAlignment=Math.min(camera.minimumRailAlignment,alignment);
   }
  }
 }
 assert.ok(camera.maxHandoffDegrees<35,'The fixed deck view hands off on a forward lead, before a loop');
 assert.ok(camera.minimumRailAlignment>.9,'All curved rail cameras remain aligned with the caught thread');
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
 await writeFile(out+'/report.json',JSON.stringify({scope:'All seven deck camera fields, native rail camera handoffs and eight starting-island entries with ordinary production controls and balance; not whole-course traversal evidence.',camera,cases},null,2));console.log(JSON.stringify({camera}));assert.ok(cases.every(c=>c.passed&&c.falls===0));
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
