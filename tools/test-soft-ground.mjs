import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const reports=[];
const fixture=(tag=true)=>({v:1,name:'Soft ground verification',spawn:[0,2.1,42],startWarpPad:false,killY:-20,components:[
 {t:'platform',p:[0,1,30],s:[18,2,60],tex:'solid',nm:'ordinary approach'},
 {t:'platform',p:[0,1,-40],s:[120,2,80],tex:'sand',nm:'soft field',...(tag?{groundSpeedLimit:2.4,edgeGrinding:false}:{})},
 {t:'platform',p:[0,1,-126],s:[18,2,92],tex:'solid',nm:'ordinary exit'},
 {t:'gate',p:[0,2,-160]},{t:'camnode',p:[0,2,45]},{t:'camnode',p:[0,2,-172]},
]});
for(const tag of [true,false])await withBlockworksRuntime(async r=>{
 const {p,l}=r,initial=JSON.stringify(r.TUNING),soft=[],exit=[];let entered=-1,entry=null;
 while(p.pos.z>-115){
  r.tick({moveY:1,jumpHeld:true});
  assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state));
  if(p.grounded&&p.pos.z<-.1&&p.pos.z>-79.5){
   assert.equal(p.groundHit?.groundSpeedLimit,tag?2.4:undefined);
   if(entered<0){entered=r.frame;entry=r.snapshot();}
   if(r.frame>entered+35)soft.push(Math.abs(p.speed));
  }
  if(p.pos.z<-90)exit.push(Math.abs(p.speed));
  assert.ok(r.frame<4500);
 }
 assert.ok(soft.length>80);
 if(tag){assert.ok(Math.max(...soft)<=2.401);assert.ok(entry.speed>20);}
 else assert.ok(Math.min(...soft)>20,'paint alone slowed the board');
 assert.ok(Math.max(...exit)>22,'dry ground did not restore native skating');
 assert.equal(JSON.stringify(r.TUNING),initial);
 const api=await r.server.ssrLoadModule('/src/level.ts');
 const data=l.captureData();assert.equal(data.components[1].groundSpeedLimit,tag?2.4:undefined);
 const roundtrip=api.normalizeCustomLevelData(JSON.parse(JSON.stringify(data)));assert.ok(roundtrip);
 assert.equal(roundtrip.components[1].groundSpeedLimit,tag?2.4:undefined);
 for(const invalid of [-1,0,.1,13,Infinity,'2.4']){
  const d=fixture();d.components[1].groundSpeedLimit=invalid;assert.equal(api.normalizeCustomLevelData(d),null);
 }
 reports.push({mode:tag?'deep sand':'paint-only control',seconds:r.frame*r.dt,entrySpeed:entry.speed,settledSpeedRange:[Math.min(...soft),Math.max(...soft)],exitSpeed:Math.max(...exit)});
},{modulePath:'/src/levels/country-club.ts',source:()=>fixture(tag),levelId:'soft-ground-fixture',maxFrames:5000});
for(const input of [{moveY:1},{moveX:1},{moveX:.707,moveY:.707}])await withBlockworksRuntime(r=>{
 const {p}=r;for(let i=0;i<240;i++)r.tick(input);
 const distance=Math.hypot(p.pos.x,p.pos.z+40);
 assert.ok(distance>7&&distance<10.2,`walking escaped soft-ground pace: ${distance}`);
 reports.push({mode:'on-foot soft ground',input,distanceInFourSeconds:distance});
},{modulePath:'/src/levels/country-club.ts',source:()=>fixture(),levelId:'soft-ground-fixture',start:[0,2.1,-40]});
await writeFile(`${tmpdir()}/country-club-soft-ground.json`,JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));
