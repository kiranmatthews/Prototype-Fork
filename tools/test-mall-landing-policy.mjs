import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {makeInput} from './jungle-cup-harness.mjs';
const base={v:1,name:'Authored large drop',spawn:[0,40.05,20],killY:-200,components:[
 {t:'platform',p:[0,39.5,0],s:[6,1,60],edgeGrinding:false},
 {t:'platform',p:[0,-.5,-50],s:[100,1,200],edgeGrinding:false},
 {t:'gate',p:[35,0,-100]},
]};
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const tuning=JSON.stringify(r.TUNING),results=[];
 for(const option of [undefined,true,false]){
  const data={...base,...(option===undefined?{}:{hugeDropBail:option})};
  const normalized=normalizeCustomLevelData(JSON.parse(JSON.stringify(data)));assert.ok(normalized);assert.equal(normalized.hugeDropBail,option);
  const scene=new r.THREE.Scene(),level=new r.Level(scene,{id:'landing-policy-test',name:data.name,data});level.update(0);scene.updateMatrixWorld(true);
  const p=new r.Player(scene);p.enterLevel('landing-policy-test');p.endlessDeaths=true;p.rawInput=makeInput();p.respawn(level,true,false);
  assert.equal(level.hugeDropBail,option!==false);
  const captured=normalizeCustomLevelData(level.captureData());assert.ok(captured);assert.equal(captured.hugeDropBail!==false,option!==false);
  const result={option:option??'default',bail:false,contact:null,trace:[]};
  try{
   for(let i=0;i<1200;i++){
    const before=p.pos.toArray(),vy=p.vVel;
    p.step(r.dt,makeInput({moveY:1,jumpHeld:true,jumpPressed:i===0}),level);level.update(r.dt);
    result.bail||=p.isBailing;
    if(i%8===0)result.trace.push({frame:i,position:p.pos.toArray(),state:p.state,speed:p.speed});
    if(before[1]<1&&(p.isBailing||p.grounded)){result.contact={frame:i,position:p.pos.toArray(),verticalSpeed:vy,state:p.state,speed:p.speed};break;}
   }
   assert.ok(result.contact);assert.equal(result.bail,option!==false);results.push(result);
  }finally{level.dispose();}
 }
 assert.deepEqual(results[0].trace,results[1].trace,'An explicit default must preserve the previous landing behavior');
 assert.deepEqual(results[0].trace.slice(0,-1),results[2].trace.slice(0,-1),'The option must not change the approach or ballistic trajectory');
 assert.equal(results[2].contact.state,'ride');assert.ok(results[2].contact.speed>10);
 assert.equal(normalizeCustomLevelData({...base,hugeDropBail:1}),null);
 assert.equal(JSON.stringify(r.TUNING),tuning);
 const out={tuningUnchanged:true,results:results.map(({trace,...v})=>v)};
 await writeFile('/private/tmp/mall-recreation/measured/landing-policy.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
},{modulePath:'/src/levels/mall-measured.ts',source:()=>base,levelId:'landing-policy-test',maxFrames:1});
