import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=process.cwd(),{build}=createRequire(root+'/package.json')('esbuild');
const b=await build({stdin:{contents:"export * from './src/golf-cart/flameTactics';export {RALLY_CART_PACE} from './src/golf-cart/balance';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false});
const {sideFlameContact,CART_FLAMES,RALLY_CART_PACE}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const speeds=[0,18,33,RALLY_CART_PACE.topSpeed,RALLY_CART_PACE.speedLimit];let scenarios=0,predictedContacts=0,sampledSweeps=0,minimumSamples=Infinity;
for(let i=0;i<16;i++)for(const sourceSpeed of speeds)for(const targetSpeed of speeds)for(const direction of [-1,1])for(const side of [-4,4])for(const along of [-8,8]){
 const yaw=i*Math.PI/8,sin=Math.sin(yaw),cos=Math.cos(yaw);
 const source={x:10,y:4,z:20,vx:-sin*sourceSpeed,vy:0,vz:-cos*sourceSpeed,yaw};
 const target={x:10+cos*side+sin*along,y:4,z:20-sin*side+cos*along,vx:-sin*targetSpeed*direction,vy:0,vz:-cos*targetSpeed*direction};
 const relative=sourceSpeed-targetSpeed*direction,approaches=along*relative<0,entry=approaches?(Math.abs(along)-2.1)/Math.abs(relative):Infinity;
 const expected=entry<=CART_FLAMES.prediction?entry:null,actual=sideFlameContact(source,target,CART_FLAMES.prediction);
 assert.equal(actual===null,expected===null);if(expected!==null)assert.ok(Math.abs(actual-expected)<1e-10);
 assert.equal(sideFlameContact(source,{...target,y:7.1},CART_FLAMES.prediction),null,'A kart above the jet is not hit');
 if(expected!==null){
  predictedContacts++;
  // Advance both physical bodies independently. A full-speed pass through
  // the jet must be sampled even with the least convenient frame phase.
  for(const hz of [60,120])for(const phase of [0,.25,.5,.75,.99]){
   let hits=0;
   for(let frame=0;frame<Math.ceil((entry+.15)*hz);frame++){
    const t=(frame+phase)/hz;
    const moved=(v)=>({...v,x:v.x+v.vx*t,y:v.y+v.vy*t,z:v.z+v.vz*t});
    if(sideFlameContact(moved(source),moved(target))!==null)hits++;
   }
   assert.ok(hits>0,`Missed ${sourceSpeed}/${direction*targetSpeed} m/s pass at ${hz} Hz phase ${phase}`);minimumSamples=Math.min(minimumSamples,hits);sampledSweeps++;
  }
 }
 scenarios++;
}
const sourceSha256={};for(const path of ['src/golf-cart/flameTactics.ts','src/golf-cart/balance.ts'])sourceSha256[path]=createHash('sha256').update(await readFile(path)).digest('hex');
const report={passed:true,sourceSha256,pace:RALLY_CART_PACE,scenarios,predictedContacts,sampledSweeps,minimumSamples,heightsRejected:true,orientations:16,rates:[60,120],framePhases:[0,.25,.5,.75,.99]};
await writeFile(process.env.CART_FLAME_SPEED_REPORT??'/private/tmp/cart-flame-speed-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
