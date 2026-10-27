import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
import {Vector3} from 'three';
const out=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/island-transfers';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');
 const cases=[],support=[],tuning=JSON.stringify(r.TUNING);
 for(const rail of r.l.rails.filter(rail=>rail.object.userData.sourceName))for(const at of [0,rail.totalLength]){const p=rail.pointAt(at),floor=race.course.supportAt(r.l,p,p.clone(),.2,2);support.push({name:rail.object.userData.sourceName,at,height:floor?p.y-floor.y:null});}
 const selected=process.env.SPAGHETTI_GAPS?.split(',').map(Number),speeds=(process.env.SPAGHETTI_SPEEDS??'24,30.5').split(',').map(Number),offsets=(process.env.SPAGHETTI_TIMING??'-2,0,2').split(',').map(Number);
 for(const [index,gap]of r.sourceModule.SPAGHETTI_TRANSFERS.entries()){
  if(selected&&!selected.includes(index))continue;
  const source=r.l.rails.find(rail=>rail.object.userData.sourceName===gap.from),target=r.l.rails.find(rail=>rail.object.userData.sourceName===gap.to);
  for(const speed of speeds)for(const offset of offsets){
   race.start('time-trial',270327);race.phase='running';const at=gap.takeoffT-24,point=source.pointAt(at),heading=source.tangentAt(at).setY(0).normalize();point.y+=r.CONST.railRideHeight;
   r.p.resetRacePosition(r.l,point,heading);r.p.state='air';r.p.grounded=false;r.p.vVel=0;r.p.speed=speed;race.riders[0].progress=r.l.railChoices.project(point,undefined,source,at).s;
   race.riders[0].anchor.fromArray(r.sourceModule.SPAGHETTI_DOCKS[gap.stage].p);race.riders[0].anchor.y+=.1;
   let previous={},caught=false,launched=false,passed=false,launchFrame=0,nearest=Infinity;const trace=[];
   for(let frame=0;frame<300;frame++){
    const on=r.p.state==='grind'&&r.p.grindRail===source;if(on)caught=true;
    const remaining=gap.takeoffT+offset-r.p.grindT,aiming=on&&remaining<2.2,release=aiming&&remaining<=.35;
    let x=on?Math.max(-1,Math.min(1,-r.p.balance*3-r.p.balanceVel*.45)):0,y=1;
    if(aiming){const d=source.tangentAt(r.p.grindT).setY(0).normalize(),right=new Vector3(-d.z,0,d.x),desired=new Vector3(...gap.landing).sub(new Vector3(...gap.takeoff)),side=Math.sign(right.dot(desired)),basis=r.p.raceInputBasis(r.l),bn=Math.hypot(basis.x,basis.z)||1;right.multiplyScalar(side);x=(right.x*-basis.z+right.z*basis.x)/bn;y=(right.x*basis.x+right.z*basis.z)/bn;}
    const sample={moveX:x,moveY:y,jumpHeld:!launched&&!release,grindHeld:!release&&(!launched||frame-launchFrame>3)},input=normalizeGameInput(sample,previous);previous=sample;
    r.scene.updateMatrixWorld(true);race.step(r.dt,input);r.l.update(r.dt);r.p.commitRenderStep(r.l);race.commitRenderStep();
    if(caught&&on&&r.p.state==='air'){launched=true;launchFrame=frame;}
    if(launched){nearest=Math.min(nearest,target.closestDistance(r.p.pos));trace.push({frame,p:r.p.pos.toArray(),state:r.p.state,vertical:r.p.vVel,rail:r.p.grindRail?.object.userData.sourceName});}
    if(launched&&r.p.state==='grind'){passed=r.p.grindRail===target;break;}
    if(r.p.state==='dead'||r.p.pos.y<point.y-20)break;
   }
   const row={index,stage:gap.stage,from:gap.from,to:gap.to,speed,offset,caught,launched,passed,nearest,trace};cases.push(row);if(!passed)console.log(JSON.stringify({...row,trace:trace.slice(-2)}));
  }
 }
 const report={at:new Date().toISOString(),scope:'Fixture entry 24 m before each optional transfer; all catch/charge/side-input/release/landing steps use production movement with unchanged tuning.',cases,support,tuningUnchanged:tuning===JSON.stringify(r.TUNING)};
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({cases:cases.length,passed:cases.filter(c=>c.passed).length,nominal:cases.filter(c=>c.offset===0).map(c=>c.passed)}));
 assert.ok(report.tuningUnchanged);assert.equal(support.length,96);assert.ok(support.every(s=>s.height!==null&&Math.abs(s.height-.84)<.06));assert.ok(cases.filter(c=>c.offset===0).every(c=>c.passed));
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
