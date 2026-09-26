import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const authored=await server.ssrLoadModule('/src/levels/codex-lab.ts');await server.close();
const specs=authored.CODEX_LAB_LEVEL.components.filter(c=>c.t==='enemy');
const evidence=[];
await withBlockworksRuntime(r=>{
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);let probes=0,maxError=0;
 for(let i=0;i<900;i++){
  r.l.update(r.dt);if(i%6)continue;
  for(const e of r.l.enemies)for(const dx of [-.45,0,.45])for(const dz of [-.45,0,.45]){
   ray.set(new r.THREE.Vector3(e.group.position.x+dx,e.baseY+2,e.group.position.z+dz),down);ray.far=4;
   const hit=ray.intersectObjects(r.l.groundMeshes,false)[0];assert.ok(hit,`${e.kind} left its curved support`);
   const error=Math.abs(hit.point.y-e.baseY);maxError=Math.max(maxError,error);
   assert.ok(error<.08,`${e.kind} patrol height differs by ${error}`);probes++;
  }
 }
 evidence.push({name:'supported curved-road patrols',probes,maxError});
});
for(const kind of ['grunt','spiker']){
 const index=specs.findIndex(c=>c.foe===kind),c=specs[index];assert.ok(c);
 for(const attack of [false,true])await withBlockworksRuntime(r=>{
  const e=r.l.enemies[index];let frames=0;
  while(frames++<240&&e.alive&&r.p.state!=='dead'){
   const close=r.p.pos.distanceTo(e.group.position)<2.1;
   r.tick({...r.steerToward(e.group.position),spinHeld:attack&&close});
  }
  if(attack){assert.ok(!e.alive&&!r.p.isBailing&&r.p.state!=='dead',`${kind} spin line failed`);}
  else {assert.equal(r.p.state,'dead',`${kind} unarmed contact must remain dangerous`);assert.ok(e.alive);}
  evidence.push({name:`${kind} ${attack?'spin choice':'unarmed contact'}`,frames,position:r.p.pos.toArray()});
 },{start:[c.p[0],c.p[1]+.05,c.p[2]+2.6]});
}
const ti=specs.map(c=>c.foe).lastIndexOf('turtle'),t=specs[ti];
await withBlockworksRuntime(r=>{
 const e=r.l.enemies[ti];r.charge();r.releaseJump(r.steerToward(e.group.position));
 r.until(()=>!e.alive,()=>r.steerToward(e.group.position),{maxFrames:150,label:'stomp inside-line turtle'});
 r.until(()=>r.p.grounded,()=>r.steerToward(authored.routePoint(1830,6)),{maxFrames:180,label:'land after turtle rebound'});
 assert.ok(!r.p.isBailing&&r.p.totalDeaths===0&&r.p.grounded);
 evidence.push({name:'turtle stomp and safe continuation',position:r.p.pos.toArray(),frames:r.frame});
},{start:[t.p[0],t.p[1]+.05,t.p[2]+3.4]});
console.log(JSON.stringify({evidence},null,2));
console.log('PASS curved-road patrol support, legible attack choices and turtle rebound landing');
