import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runAmbushDock} from './ambush-pilot.mjs';
const report=[];
await withBlockworksRuntime(r=>{
 const {p,l,THREE}=r;
 const stage=q=>{p.respawn(l,true,false,{position:new THREE.Vector3(...q),heading:new THREE.Vector3(0,0,-1)});r.stepFor(20);assert.ok(p.grounded);};
 const land=(q,label)=>{
  r.until(()=>p.grounded,()=>({...r.steerToward(q),jumpHeld:p.state==='hang'}),{maxFrames:300,label});
  assert.ok(Math.abs(p.pos.y-q[1])<.3,label+' height '+p.pos.toArray());assert.ok(r.distanceTo(q)<2,label+' distance '+p.pos.toArray());assert.equal(p.totalDeaths,0);report.push({label,landing:p.pos.toArray(),deaths:p.totalDeaths});
 };
 const double=(q,label,charged=false)=>{
  if(!charged)r.charge();r.releaseJump(r.steerToward(q));
  r.until(()=>p.vVel<.65||p.state==='hang',()=>r.steerToward(q),{maxFrames:100,label:label+' apex'});
  r.tick({...r.steerToward(q),jumpHeld:true});r.tick({...r.steerToward(q),jumpReleased:true});land(q,label);
 };
 stage([4,-5,-187]);
 for(const q of [[4,-3.3,-192],[4,-1.1,-199],[4,1.1,-206],[4,3.3,-212]])double(q,'unassisted stair '+q[2]);
 stage([26,-18.9,-1720]);r.until(()=>p.pos.x>=31.3,{moveX:1},{maxFrames:180,label:'side-scroll run-up'});r.charge(26,{moveX:1});double([46,-17.5,-1720],'unassisted side-scroll transfer',true);
 stage([116,-15.9,-1720]);double([122.5,-11.5,-1720],'unassisted upper side-scroll ledge');
 stage([146.5,-25.9,-2089.8]);report.push({label:'dock arrow gap',...runInputPilot(r,runAmbushDock).result});
 for(const suffix of [10,11]){
  const name='04 Channel harvests / cargo '+suffix,boxes=l.crates.filter(b=>r.source.components[b.mesh.userData.editorIdx]?.nm.startsWith(name));
  const base=boxes[0];stage([base.mesh.position.x,base.box.min.y+.1,base.mesh.position.z+22]);let contactSpeed=0;
  r.until(()=>boxes.every(b=>!b.alive),()=>{if(boxes.every(b=>b.alive))contactSpeed=p.speed;return {moveY:1,jumpHeld:true};},{maxFrames:600,label:'charged channel formation '+suffix});
  assert.equal(p.totalDeaths,0);assert.ok(p.freeSkate&&!p.isBailing);assert.ok(contactSpeed>=12.5);report.push({label:'charged channel formation '+suffix,count:boxes.length,contactSpeed,deaths:p.totalDeaths});
 }
},{modulePath:'/src/levels/carlisle-coast.ts',source:m=>m.CARLISLE_COAST_LEVEL,levelId:'test',controlFrame:()=>({x:0,z:-1}),maxFrames:8000});
await writeFile(process.env.AMBUSH_ACCESS_OUTPUT||'/tmp/ambush-crate-access.json',JSON.stringify(report,null,2)+'\n');console.log('PASS access',JSON.stringify(report));
