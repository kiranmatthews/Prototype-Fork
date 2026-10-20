import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const source={v:1,name:'Carlisle structural collision proof',spawn:[0,.15,28],killY:-20,components:[
 {t:'platform',p:[0,-.5,-10],s:[24,1,100],edgeGrinding:false},
 {t:'decor',dkind:'coastv2buttress',p:[0,-4,-8],s:[14,12.975,14],solid:true,nm:'Measured sandstone impact face'},
 {t:'gate',p:[0,0,-50]},
]};
await withBlockworksRuntime(r=>{
 let collided=false,maxSpeed=0,minZ=Infinity;
 for(let i=0;i<900;i++){
  r.tick({moveY:1,jumpHeld:true});maxSpeed=Math.max(maxSpeed,Math.abs(r.p.speed));minZ=Math.min(minZ,r.p.pos.z);
  if(r.p.isBailing){collided=true;break;}
 }
 assert.ok(collided,`real movement hits the sandstone and rebounds; speed ${maxSpeed}, position ${r.p.pos.toArray()}`);
 assert.ok(r.p.speed<0,'the standard wall impact rebounds away from the rock');
 assert.equal(r.p.totalDeaths,0,'solid side impact does not fall through or kill');
 assert.ok(minZ>-5,'the body never crosses through the front cliff face');
 console.log(JSON.stringify({pass:true,maxSpeed,impact:r.p.pos.toArray(),rebound:r.p.speed,state:r.p.state}));
},{modulePath:'/src/levels/carlisle-coast.ts',source:()=>source,levelId:'carlisle-contact-proof',heading:[0,0,-1],maxFrames:1000});
