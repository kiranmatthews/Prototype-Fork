import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createSkyBridgePilot} from './sky-bridge-pilot.mjs';
const out=process.env.SKY_EXTENSION_OUTPUT||'/private/tmp/sky-bridge-cloud-extension';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:source,THREE}=r,pilot=createSkyBridgePilot(source);
 const cloudContacts=l.groundMeshes.filter(m=>m.userData.cloudRoad),cloudVisuals=[];
 l.root.traverse(o=>{if(o.userData.cloudPlatformVisual)cloudVisuals.push(o);});
 assert.equal(cloudContacts.length,2);assert.equal(cloudVisuals.length,12);
 assert.ok(cloudContacts.every(m=>!m.visible));
 assert.equal(source.SKY_BRIDGE_LEVEL.spawn[2]-source.SKY_BRIDGE_FINISH[2],488);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const c of source.SKY_BRIDGE_LEVEL.components.filter(c=>c.cloudRoad&&c.solid===false)){
  ray.set(new THREE.Vector3(c.p[0],2,c.p[2]),down);ray.far=10;
  assert.equal(ray.intersectObjects(l.groundMeshes,false).length,0,'Scenery cannot provide hidden support');
 }
 for(const gap of source.SKY_BRIDGE_SKATE_GAPS){ray.set(new THREE.Vector3(0,4,(gap.takeoff+gap.landing)/2),down);ray.far=12;assert.equal(ray.intersectObjects(l.groundMeshes,false).length,0);}
 let error;
 try{
  for(let i=0;i<10000&&p.state!=='finished';i++){
   r.tick(pilot.sample(p,l));pilot.observe(p,l);
   if(p.isBailing||p.totalDeaths||['dead','gameover'].includes(p.state))throw Error('Route failed at '+JSON.stringify(r.snapshot()));
  }
 }catch(e){error=String(e);}
 const report={error,evidence:pilot.evidence,final:r.snapshot()};
 await writeFile(out+'/native.json',JSON.stringify({...report,trace:r.trace}));console.log(JSON.stringify(report));
 assert.equal(error,undefined);assert.equal(p.state,'finished');assert.equal(p.totalDeaths,0);assert.equal(pilot.evidence.bails,0);
 assert.equal(pilot.evidence.ice.length,process.env.SKY_EXTENSION_ONLY?0:3);
 assert.equal(pilot.evidence.falling.length,process.env.SKY_EXTENSION_ONLY?0:7);
 assert.equal(pilot.evidence.checkpoints.length,process.env.SKY_EXTENSION_ONLY?4:7);
 assert.ok(pilot.evidence.grindFrames.every(n=>n>60));assert.equal(pilot.evidence.gaps.length,2);assert.ok(pilot.evidence.gaps.every(g=>g.board));
 const retries=[];
 for(const z of [-237,-309,-377,-433]){
  p.respawn(l,true,false,{position:new THREE.Vector3(0,.1,z),heading:new THREE.Vector3(0,0,-1)});
  const retry=createSkyBridgePilot(source),start=r.frame;
  for(let i=0;i<1800&&p.state!=='finished';i++){
   r.tick(retry.sample(p,l));retry.observe(p,l);assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),JSON.stringify({retry:z,...r.snapshot()}));
  }
  assert.equal(p.state,'finished');retries.push({from:z,frames:r.frame-start,evidence:retry.evidence});
 }
 p.respawn(l,true,false,{position:new THREE.Vector3(0,.1,-433),heading:new THREE.Vector3(0,0,-1)});
 r.stepFor(18,{spinHeld:true});assert.ok(l.checkpoints.at(-1).active);
 r.until(()=>p.pos.x>5.5,{moveX:1},{maxFrames:180,label:'walk to the receiver edge'});
 r.charge(5,{moveX:1});r.releaseJump({moveX:1});
 r.until(()=>p.state==='dead',{moveX:1},{maxFrames:360,allowDeath:true,label:'fall from the last cloud receiver'});
 r.until(()=>p.grounded&&p.state==='ride',{}, {maxFrames:360,allowDeath:true,label:'recover at the earned skyway checkpoint'});
 assert.ok(Math.abs(p.pos.z+433)<2);assert.equal(p.totalDeaths,1);
 await writeFile(out+'/retries.json',JSON.stringify({retries,recovery:r.snapshot()},null,2));
 console.log('PASS complete 488 m course, both grinds/board jumps, four stationary retries and checkpoint fall recovery');
},{modulePath:'/src/levels/sky-bridge.ts',source:m=>m.SKY_BRIDGE_LEVEL,levelId:'sky',endlessDeaths:true,
 start:process.env.SKY_EXTENSION_ONLY?[0,.1,-236]:undefined,controlFrame:()=>({x:0,z:-1})});
