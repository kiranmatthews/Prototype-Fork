// Independent fixtures complement the continuous input-only journey.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
const early=Number(process.env.WATERFALL_EARLY||0),charge=Number(process.env.WATERFALL_CHARGE||26);
const out='docs/waterfall-climb/runs';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const results=[],route=r.sourceModule.WATERFALL_BEATS,{p,l}=r,c=puzzleControls(r);
 r.report={actions:[],evidence:[]};
 for(const [index,authored]of route.entries()){
  const beat={...authored,from:[...authored.from]},dx=beat.to[0]-beat.from[0],dz=beat.to[2]-beat.from[2],distance=Math.hypot(dx,dz);
  beat.from[0]-=dx/distance*early;beat.from[2]-=dz/distance*early;
  p.respawn(l,true,false,{position:new r.THREE.Vector3(beat.from[0],beat.from[1]+.12,beat.from[2])});
  // Only a preceding timed support is prepared; the tested trigger is always
  // struck by actual player input. Each placement begins a separate fixture.
  for(const b of l.spinBridges){
   const a=(b.component.yaw??0)*Math.PI/180,dx=beat.from[0]-b.component.p[0],dz=beat.from[2]-b.component.p[2];
   const along=dx*Math.cos(a)-dz*Math.sin(a),side=dx*Math.sin(a)+dz*Math.cos(a);
   if(Math.abs(beat.from[1]-b.component.p[1])<.05&&along>=0&&along<=b.component.s[0]&&Math.abs(side)<b.component.s[2]/2){b.trigger(b.hitBox.clone());b.update(b.component.cycle);}
  }
  l.update(0);
  const run=function*(){
   yield* c.stepFor(5);c.check(p.grounded,beat.name+' supported takeoff');
   const jumpSpin=beat.bridge&&l.spinBridges.find(b=>b.component.nm===beat.bridge).component.p[1]>beat.from[1]+.4;
   if(beat.bridge&&!jumpSpin){const b=l.spinBridges.find(b=>b.component.nm===beat.bridge);
    yield* c.tick({spinHeld:true});yield* c.until(()=>b.deployed,{}, {label:beat.name+' spin contact',limit:90});
    if(Math.abs(beat.to[2]-beat.from[2])>8)yield* c.walk([beat.from[0],beat.from[1],b.component.p[2]-b.component.s[0]+.8],beat.name+' timber',{settle:0});
   }
   yield* c.hop(beat.to,beat.name,{chargeFrames:charge,tolerance:early?1.25:.7,...jumpSpin?{airButtons:{spinHeld:true}}:{}});
  };
  try{const pilot=run();let step;while(!(step=pilot.next()).done)r.tick(step.value);results.push({index,name:beat.name,ok:true,landing:p.pos.toArray(),target:beat.to});}
  catch(error){results.push({index,name:beat.name,ok:false,error:error.message,position:p.pos.toArray()});}
  if(index%20===19)console.log('GAPS',index+1,'failed',results.filter(r=>!r.ok).length);
 }
 await writeFile(`${out}/${early?'early-takeoff-margin':'independent-gaps'}.json`,JSON.stringify(results,null,2));
 const failed=results.filter(r=>!r.ok);console.log('INDEPENDENT GAP RESULTS',JSON.stringify({early,charge,total:results.length,passed:results.length-failed.length,failed}));assert.equal(failed.length,0);
},{modulePath:'/src/levels/waterfall-climb.ts',levelId:'waterfall-climb',source:m=>m.WATERFALL_CLIMB_LEVEL,controlFrame:()=>({x:0,z:-1}),maxFrames:80000});
