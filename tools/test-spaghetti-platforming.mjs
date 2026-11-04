import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-distinct';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const reports=[];
 for(const jump of r.sourceModule.SPAGHETTI_PLATFORMER_JUMPS){
  const [a,b]=[jump.from,jump.to],len=Math.hypot(b[0]-a[0],b[2]-a[2]),dx=(b[0]-a[0])/len,dz=(b[2]-a[2])/len;
  const fromW=jump.fromWidth??12,fromD=jump.fromDepth??(jump.name.endsWith('jump 1')?20:14),toW=jump.toWidth??12,toD=jump.toDepth??14;
  const lateral=Math.sign(b[0]-a[0])*Math.min(fromW/2-2,toW/2-2,Math.abs(b[0]-a[0])/2);
  const start=[a[0]+lateral,a[1]+.08,a[2]-(fromD/2-.6)],target=[b[0]-lateral,b[1],Math.min(b[2]+toD/2-.8,a[2]-fromD/2-4)];
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(...start),heading:new r.THREE.Vector3(dx,0,dz)});
  r.stepFor(10);r.charge(26);r.releaseJump({...r.steerToward(target),spinHeld:true});
  let peak=r.p.pos.y,air=0;const samples=[];
  for(;air<360&&!r.p.grounded;air++){
   r.tick({...r.steerToward(target),jumpHeld:air===30,spinHeld:true,spinPressed:air%24===0});peak=Math.max(peak,r.p.pos.y);
   if(air%12===0)samples.push(r.snapshot());
  }
  const good=r.p.grounded&&Math.abs(r.p.pos.y-b[1])<.15&&Math.abs(r.p.pos.x-b[0])<toW/2&&Math.abs(r.p.pos.z-b[2])<toD/2;
  reports.push({name:jump.name,good,air,peak,landing:r.p.pos.toArray(),surface:r.p.groundHit?.name,samples:good?undefined:samples});
  console.log(JSON.stringify({...reports.at(-1),samples:undefined}));
 }
 await writeFile(output+'/platformer-jumps.json',JSON.stringify(reports,null,2));
 assert.ok(reports.every(r=>r.good),'Every authored step can be reached with normal foot jump and double-jump input');
},{modulePath:'/src/levels/spaghetti-rails-platforming.ts',source:m=>m.SPAGHETTI_RAILS_PLATFORMING_LEVEL,levelId:'spaghetti-rails-platforming',endlessDeaths:true});
