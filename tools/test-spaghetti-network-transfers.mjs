import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/network-transfers';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');
 const network=r.l.railChoices,tuning=JSON.stringify(r.TUNING),cases=[],support=[];
 for(const rail of r.l.rails)for(const at of [0,rail.totalLength]){
  const point=rail.pointAt(at),floor=race.course.supportAt(r.l,point,point.clone(),.2,2);
  support.push({rail:rail.object.userData.sourceName,end:at?'end':'start',height:floor?point.y-floor.y:null});
 }
 const selected=process.env.SPAGHETTI_GAPS?.split(',').map(Number),speeds=(process.env.SPAGHETTI_SPEEDS??'24,30.5').split(',').map(Number),offsets=(process.env.SPAGHETTI_TIMING??'-2,0,2').split(',').map(Number);
 for(const [index,gap]of r.sourceModule.SPAGHETTI_TRANSFERS.entries()){
  if(selected&&!selected.includes(index))continue;
  const source=r.l.rails.find(rail=>rail.object.userData.sourceName===gap.from),receiver=r.l.rails.find(rail=>rail.object.userData.sourceName===gap.to);
  for(const speed of speeds)for(const offset of offsets){
   race.start('time-trial',270327);race.phase='running';
   const at=source.totalLength-32,point=source.pointAt(at),heading=source.tangentAt(at).setY(0).normalize();point.y+=r.CONST.railRideHeight;
   r.p.resetRacePosition(r.l,point,heading);r.p.state='air';r.p.grounded=false;r.p.vVel=0;r.p.speed=speed;
   race.riders[0].progress=network.project(point,undefined,source,at).s;
   let previous={},caught=false,launched=false,passed=false,exitSpeed=null,frames=0;
   for(;frames<480;frames++){
    const attached=r.p.state==='grind'&&r.p.grindRail===source;
    if(attached)caught=true;
    const release=attached&&source.totalLength-r.p.grindT<=4+offset;
    const sample={moveX:attached&&!release?Math.max(-1,Math.min(1,-r.p.balance*3-r.p.balanceVel*.45)):0,moveY:1,
     jumpHeld:!launched&&!release,grindHeld:!release};
    const input=normalizeGameInput(sample,previous);previous=sample;
    r.scene.updateMatrixWorld(true);race.step(r.dt,input);r.l.update(r.dt);r.p.commitRenderStep(r.l);race.commitRenderStep();
    if(caught&&attached&&r.p.state==='air'){launched=true;exitSpeed=r.p.speed;}
    if(launched&&r.p.state==='grind'){passed=r.p.grindRail===receiver;break;}
    if(r.p.state==='dead'||r.p.pos.y<point.y-15)break;
   }
   const result={index,from:gap.from,to:gap.to,choice:gap.choice,speed,offset,caught,launched,passed,exitSpeed,frames,state:r.p.state,position:r.p.pos.toArray(),rail:r.p.grindRail?.object.userData.sourceName};
   cases.push(result);if(!passed)console.log(JSON.stringify(result));
  }
  console.log(JSON.stringify({gaps:index+1,cases:cases.length,passed:cases.filter(c=>c.passed).length}));
 }
 const report={at:new Date().toISOString(),scope:'Initial position/speed fixtures; all subsequent catches, jumps, floor collision and landings use production input and physics.',support,cases,tuningUnchanged:tuning===JSON.stringify(r.TUNING)};
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));
 assert.ok(report.tuningUnchanged);assert.ok(support.every(e=>e.height!==null&&Math.abs(e.height-.84)<.05),'Every actual native endpoint has a collision platform 0.9 metres beneath it');
 assert.ok(cases.filter(c=>c.offset===0).every(c=>c.passed),'Every nominal transfer catches its intended native receiver');
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
