import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createMallPlanterPilot} from './mall-pilot.mjs';

await mkdir('/private/tmp/mall-recreation',{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source,sourceModule:m}=r;
 const {Rail}=await r.server.ssrLoadModule('/src/rails.ts');
 // A closed path is opt-in. Sharp corners, including the closing seam,
 // still require an ollie, while old open rails retain their run-off ends.
 const square=[new THREE.Vector3(0,0,0),new THREE.Vector3(4,0,0),new THREE.Vector3(4,0,4),new THREE.Vector3(0,0,4)];
 const closed=new Rail(square,false,true),open=new Rail(square,false);
 assert.equal(open.totalLength,12);assert.equal(closed.totalLength,16);
 assert.equal(open.wrapDistance(13),13);
 assert.equal(closed.wrapDistance(17),1);assert.equal(closed.wrapDistance(-1),15);
 for(const [a,b]of [[15.8,16.2],[.2,-.2]]){
  const corner=closed.sharpCornerBetween(a,b,Math.PI/4);
  assert.ok(corner);assert.equal(corner.t,a>1?16:0);
 }
 const reports=[];
 const start=(s,u,y,d)=>{
  p.respawn(l,true,false,{position:new THREE.Vector3(...m.mallPoint(s,u,y)),heading:d});
  p.axisF.copy(d);p.axisL.set(-d.z,0,d.x);
 };
 for(const direction of [-1,1]){
  const circle=l.rails.find(v=>source.components[v.object.userData.editorIdx]?.nm==='Round planter grind');
  assert.ok(circle?.closed);
  start(direction>0?59:64,-.9,17.1,new THREE.Vector3(0,0,-direction));
  const pilot=createMallPlanterPilot(m,{direction}),traceStart=r.trace.length;
  for(let i=0;i<540&&!pilot.done;i++){r.tick(pilot.sample(p,l));pilot.observe(p,l);}
  reports.push(pilot.evidence);
  await writeFile(`/private/tmp/mall-recreation/round-planter-${direction}.json`,JSON.stringify(r.trace.slice(traceStart)));
 }
 for(const side of [-1,1]){
  start(59,side*4.3,17.1,new THREE.Vector3(side*2.7,0,-10).normalize());
  let railNames=[],grindFrames={},bailed=false,landed=false,popFrame=-Infinity;
  const traceStart=r.trace.length;
  let progress=59;
  for(let i=0;i<550;i++){
   progress=m.mallProject(p.pos.x,p.pos.z,progress);
   const grinding=p.state==='grind';
   const name=grinding?source.components[p.grindRail.object.userData.editorIdx]?.nm:'';
   let input={moveX:0,moveY:p.grounded?1:0,jumpHeld:i<45,grindHeld:i>=45&&i-popFrame>10};
   if(name?.startsWith('Rail Combo')){
    const f=p.grindT/p.grindRail.totalLength;
    input.moveX=f<.65?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0;input.moveY=0;
    if(f>=.65){
     const d=p.grindRail.tangentAt(p.grindT),rx=-d.z*side,rz=d.x*side,cam=p.camDir,n=Math.hypot(cam.x,cam.z)||1;
     input.moveX=.55*(rx*-cam.z+rz*cam.x)/n;input.moveY=.55*(rx*cam.x+rz*cam.z)/n;
    }
    input.jumpHeld=f<.8;
    if(!input.jumpHeld&&popFrame===-Infinity)popFrame=i;
   }else if(grinding){
    input.moveX=Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7));input.moveY=1;
   }
   r.tick(input);
   bailed||=p.isBailing;
   if(p.state==='grind'){
    const name=source.components[p.grindRail.object.userData.editorIdx]?.nm;
    if(!railNames.includes(name))railNames.push(name);grindFrames[name]=(grindFrames[name]??0)+1;
   }
   if(p.grounded&&p.pos.y<13.5&&progress>72){landed=true;break;}
   if(bailed||p.state==='dead')break;
  }
  reports.push({name:side<0?'Rail Combo to Coffee':'Rail Combo to Planters',railNames,grindFrames,bailed,landed,end:p.pos.toArray()});
  await writeFile(`/private/tmp/mall-recreation/rail-combo-${side}.json`,JSON.stringify(r.trace.slice(traceStart)));
 }
 p.respawn(l,true);const fast=createMallPlanterPilot(m,{fromSpawn:true}),fastStart=r.trace.length;
 for(let i=0;i<1100&&!fast.done;i++){r.tick(fast.sample(p,l));fast.observe(p,l);}
 reports.push(fast.evidence);
 await writeFile('/private/tmp/mall-recreation/round-planter-fast.json',JSON.stringify(r.trace.slice(fastStart)));
 assert.ok(fast.evidence.laps>2&&fast.evidence.peakSpeed>20&&!fast.evidence.bailed,'The normal entrance approach must support repeated fast laps');
 await writeFile('/private/tmp/mall-recreation/combos.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
 for(const report of reports.slice(0,2))assert.ok(report.caught&&report.seams>=2&&report.laps>2&&!report.bailed,'Both directions must grind two full laps without a seam pop');
 for(const [i,report]of reports.slice(2,4).entries()){
  assert.ok(report.railNames.includes(report.name));
  const target=i===0?'Coffee Grind':'Planter Gap rim';
  assert.ok((report.grindFrames[target]??0)>=10,'Each upper pole must sustain a grind on its source lower combo line');
  assert.ok(!report.bailed&&report.landed);
 }
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:3300,controlFrame:r=>r.p.axisF});
