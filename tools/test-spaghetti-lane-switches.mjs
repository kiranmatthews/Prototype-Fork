import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';

const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/lane-switches';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');
 const runs=r.sourceModule.SPAGHETTI_RUNS,receivers=runs.map((run,i)=>run.jumpEntry?i:-1).filter(i=>i>=0);
 const tuning=JSON.stringify(r.TUNING),results=[];
 const selected=process.env.SPAGHETTI_RECEIVERS?.split(',').map(Number);
 for(const receiver of receivers.filter(receiver=>!selected||selected.includes(receiver)))for(const [fromLane,toLane]of [[0,1],[1,0],[1,2],[2,1]]){
  race.start('time-trial',270327);race.phase='running';
  const source=r.l.rails[(receiver-1)*3+fromLane],target=r.l.rails[receiver*3+toLane];
  const at=Math.max(0,source.totalLength-28),point=source.pointAt(at),heading=source.tangentAt(at).setY(0).normalize();
  point.y+=r.CONST.railRideHeight;r.p.resetRacePosition(r.l,point,heading);
  r.p.state='air';r.p.grounded=false;r.p.vVel=0;r.p.speed=28;
  let caught=false,launched=false,releaseFrame=-1,previous={},outcome=null,frames=0;
  for(;frames<300;frames++){
   const p=r.p,input={moveY:1,moveX:0,grindHeld:true,jumpHeld:!launched};
   if(p.state==='grind'&&p.grindRail===source){
    caught=true;const left=source.totalLength-p.grindT;
    input.moveX=left<7?Math.sign(toLane-fromLane):Math.max(-1,Math.min(1,-p.balance*3-p.balanceVel*.45));
    if(left<7)input.moveY=0; // full sideways intent; the rail carries forward speed
    if(left<4){input.jumpHeld=false;input.grindHeld=false;releaseFrame=frames;}
   }
   if(releaseFrame>=0&&p.state==='air'){
    launched=true;input.jumpHeld=false;
    const under=target.closest(p.pos).point;
    // Catch only after crossing over the selected strand. An immediate
    // press can legitimately catch the old lane first on uphill receivers.
    input.grindHeld=frames>releaseFrame+2&&Math.hypot(under.x-p.pos.x,under.z-p.pos.z)<1.45;
   }
   const sample=normalizeGameInput(input,previous);previous={...sample};
   r.scene.updateMatrixWorld(true);race.step(r.dt,sample);r.l.update(r.dt);p.commitRenderStep(r.l);race.commitRenderStep();
   if(launched&&p.state==='grind'){
    outcome={caughtRail:r.l.rails.indexOf(p.grindRail),passed:p.grindRail===target,position:p.pos.toArray()};break;
   }
   if(p.state==='dead'||p.pos.y<point.y-12)break;
  }
  const result={receiver,fromLane:fromLane-1,toLane:toLane-1,caughtSource:caught,launched,frames,
   ...(outcome??{passed:false,position:r.p.pos.toArray(),state:r.p.state})};
  results.push(result);if(!result.passed)console.log(JSON.stringify(result));
  if(results.length%4===0)console.log(JSON.stringify({completed:results.length,passed:results.filter(c=>c.passed).length}));
 }
 const report={at:new Date().toISOString(),cases:results.length,passed:results.filter(c=>c.passed).length,tuningUnchanged:tuning===JSON.stringify(r.TUNING),results};
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined}));
 assert.equal(report.tuningUnchanged,true);assert.ok(results.every(c=>c.passed),'Each required gap supports an adjacent-strand transfer in both directions');
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
