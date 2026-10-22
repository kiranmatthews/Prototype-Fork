import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createMallPilot} from './mall-pilot.mjs';
const route=process.argv.find(a=>a.startsWith('--route='))?.split('=')[1]??'main';
const secretOllie=!process.argv.includes('--no-secret-ollie'),tag=route+(secretOllie?'':'-no-ollie');
await mkdir('/private/tmp/mall-recreation',{recursive:true});
await withBlockworksRuntime(async r=>{
 const {sourceModule:m,p,l}=r,before=JSON.stringify(r.TUNING),pilot=createMallPilot(m,{route,secretOllie});
 assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
 assert.equal(r.source.components.filter(c=>c.t==='checkpoint').length,5);
 let error=null;
 try{while(p.state!=='finished'){r.tick(pilot.sample(p,l));pilot.observe(p,l);}}catch(e){error=String(e);}
 const report={route,seconds:r.frame*r.dt,state:p.state,deaths:p.totalDeaths,position:p.pos.toArray(),progress:pilot.progress,evidence:pilot.evidence,error,tail:r.trace.slice(-18)};
 await writeFile(`/private/tmp/mall-recreation/${tag}.json`,JSON.stringify(report,null,2));
 await writeFile(`/private/tmp/mall-recreation/${tag}-trace.json`,JSON.stringify(r.trace));
 console.log(JSON.stringify({...report,tail:undefined},null,2));
 assert.equal(error,null);assert.equal(p.state,'finished');assert.equal(p.totalDeaths,0);assert.equal(JSON.stringify(r.TUNING),before);
 assert.ok(pilot.evidence.railNames.some(name=>name.startsWith('Crossrail ')),'The crossrail jump must catch a diagonal rail, not a side ledge');
 // The car approach climbs five metres after its landing. Natural gravity
 // slows that uphill line; it must still carry enough speed into the leap.
 assert.ok(pilot.evidence.minimumMovingSpeed>(['car','escalator'].includes(route)?15:18),'The authored line must carry continuous skating speed');
 if(['upper','car','escalator'].includes(route)){
  assert.ok(pilot.evidence.railNames.includes('Suspended upper light rail'),'Flying Leap must catch an upper suspended rail');
  assert.equal(p.hasCrystal,secretOllie,'The elevated reward requires an ollie from the upper rail');
  assert.equal(!!pilot.evidence.upperTransfer,secretOllie,'The reward line must transfer between the two distinct upper rails');
  if(secretOllie)assert.ok(pilot.evidence.upperTransfer.frames>=10,'The opposite beam must support a sustained grind');
 }
 if(route==='escalator'){
  const climb=r.trace.filter(v=>v.grounded&&v.position[2]<-90&&v.position[2]>-106);
  assert.ok(climb.some(v=>v.position[0]<-8.4&&v.position[1]>16),'The second escalator must be climbed on its own left-hand surface');
 }
 if(route==='upper'){
  const fountain=r.trace.reduce((a,b)=>Math.abs(a.position[2]+66)<Math.abs(b.position[2]+66)?a:b);
  assert.ok(Math.abs(fountain.position[0])<2.5&&fountain.position[1]>17,'The fountain gap must cross the fountain itself');
 }
 if(route==='coffee'){
  assert.ok(pilot.evidence.railNames.includes('Coffee Grind'),'The route must use the coffee rail');
  assert.ok(pilot.evidence.railNames.includes('Suspended lower light rail'),'The lower light beam must be reachable from the stairs');
 }
 if(route==='mezzanine'){
  const jump=pilot.evidence.jumps.find(j=>j.name==='Mezzanine');
  assert.ok(jump,'The upper approach must launch the mezzanine gap');
  const firstLanding=r.trace.find(v=>v.frame>jump.frame+2&&v.grounded);
  assert.ok(firstLanding&&m.mallProject(firstLanding.position[0],firstLanding.position[2],390)>391,
   'The mezzanine jump must clear all 32 stairs before its first landing');
 }
 if(route==='underpass'){
  const inside=r.trace.filter(v=>v.position[2]<m.mallPoint(59)[2]&&v.position[2]>m.mallPoint(67)[2]);
  assert.ok(inside.length>12&&inside.every(v=>v.position[1]<12.2),
   'The entrance aisle must stay below the first island throughout the underpass');
 }
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:15000,controlFrame:r=>r.p.axisF});
