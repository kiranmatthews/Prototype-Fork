import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {RopeBridgePhysics:Bridge}=await server.ssrLoadModule('/src/ropeBridgePhysics.ts');
 const run=(fps)=>{const b=new Bridge(32);b.impact(8,12);for(let i=0;i<fps*6;i++)b.update(1/fps,i<fps*2?[{distance:8,across:0}]:[]);return b;};
 const reference=run(60);
 for(const fps of [30,120,144]){const b=run(fps);for(let i=0;i<b.count;i++)assert.ok(Math.abs(b.y[i]-reference.y[i])<1e-8,`frame-rate dependence ${fps}`);}
 const b=new Bridge(32);b.update(20);assert.equal(b.sample(16).height,0);assert.equal(b.impact(8,1.9),false);assert.ok(b.impact(8,12));assert.equal(b.impact(8,12),false);
 const remote=[];let low=0,high=0;
 for(let i=0;i<600;i++){
  b.update(1/60);const h=b.sample(8).height;low=Math.min(low,h);high=Math.max(high,h);remote.push(b.sample(24).height);
  assert.equal(b.sample(0).height,0);assert.equal(b.sample(32).height,0);assert.ok([...b.y,...b.vy,...b.z,...b.vz].every(Number.isFinite));
 }
 assert.equal(remote[0],0);assert.ok(Math.min(...remote)<-.02,'impulse never propagated to distant boards');assert.ok(low<-.2&&high>.01,'no downward impulse/rebound');
 for(let i=0;i<3000;i++)b.update(1/60);assert.equal(b.awake,false);assert.equal(b.sample(8).height,0);
 const load=new Bridge(32);for(let i=0;i<120;i++)load.update(1/60,[{distance:16,across:0}]);assert.ok(load.sample(16).height<-.1,'rider weight has no effect');
 const hard=new Bridge(32),soft=new Bridge(32);hard.impact(16,19);soft.impact(16,4);assert.ok(Math.abs(hard.vy[8])>Math.abs(soft.vy[8])*5);
 console.log(JSON.stringify({pass:true,fps:[30,60,120,144],downward:low,rebound:high,remote:Math.min(...remote),weightedSag:load.sample(16).height}));
}finally{await server.close();}
