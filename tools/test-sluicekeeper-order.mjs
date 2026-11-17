import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {withBlockworksRuntime} from './blockworks-runner.mjs';import {puzzleControls} from './puzzle-controls.mjs';
const out=process.env.RIPCORD_OUTPUT||'/tmp/ripcord-crate-review';await mkdir(out,{recursive:true});
const results=[];
for(const kind of ['departure-box','middle-stack'])await withBlockworksRuntime(async r=>{
 r.report={actions:[],evidence:[]};const c=puzzleControls(r),life=c.crateNamed('Bell-tower high cache');r.stepFor(20);
 const arrow=c.crateNamed('Kept arrow below the carved bell');
 if(kind==='middle-stack')r.l.breakCrate(arrow,true); // Staged spent-arrow fixture; all rebound/jump inputs below are native.
 if(kind==='departure-box'){
  const hit=c.hit(arrow,'wrong order: consume arrow first');let step;while(!(step=hit.next()).done)r.tick(step.value);assert.ok(!arrow.alive);r.walkTo([23.35,2.4,0],{pace:.3});
 }
 const box=kind==='departure-box'?c.crateNamed('COUNT / bell terrace departure'):c.crateNamed('REWARD / second stair harvest lid');
 const x=box.mesh.position.x,y=box.box.max.y;
 r.charge();r.releaseJump();
 // Use a floor double to approach the stacked support from above.
 if(kind==='middle-stack'){r.until(()=>r.p.vVel<.65,{}, {maxFrames:100,label:'floor jump apex beside stack'});r.tick({jumpHeld:true});r.tick({jumpReleased:true});}
 r.until(()=>r.p.pos.y>y+.12,{}, {maxFrames:100,label:'rise above ordinary support'});
 r.until(()=>!box.alive,()=>r.steerToward([x,y,0]),{maxFrames:180,label:'ordinary crate stomp'});
 assert.ok(r.p.vVel>9,'actual stomp rebound');let highest=r.p.characterBounds.max.y;
 r.until(()=>r.p.vVel<.65,()=>{highest=Math.max(highest,r.p.characterBounds.max.y);return r.steerToward([21,life.box.min.y,0]);},{maxFrames:100,label:'ordinary rebound apex'});
 r.tick({jumpHeld:true});r.tick({jumpReleased:true});
 r.until(()=>r.p.grounded,()=>{highest=Math.max(highest,r.p.characterBounds.max.y);return r.steerToward([21,2.4,0]);},{maxFrames:220,label:'double jump after ordinary rebound'});
 const result={kind,lifeRemains:life.alive,highest,lifeBase:life.box.min.y,deaths:r.p.totalDeaths};assert.ok(life.alive,'ordinary support cannot replace the arrow');
 assert.ok(highest<life.box.min.y,'ordinary rebound silhouette remains below the target, independent of horizontal aim');assert.equal(r.p.totalDeaths,0);
 r.l.reset(true);assert.ok(r.l.crates.every(x=>x.alive));assert.ok(r.l.crates.filter(x=>r.source.components[x.mesh.userData.editorIdx]?.outline).every(x=>x.pending));result.retryRestores=true;results.push(result);console.log(JSON.stringify(result));
},{modulePath:'/src/levels/rumblewater-bonus.ts',levelId:'bonus-rumblewater-run',source:m=>m.RUMBLEWATER_BONUS_LEVEL,controlFrame:()=>({x:0,z:-1}),start:kind==='departure-box'?[19,2.52,0]:[12.25,1.72,0],maxFrames:3000});
await writeFile(out+'/bonus-order.json',JSON.stringify(results,null,2));console.log('PASS conserved arrow dependency and retry restoration.');
