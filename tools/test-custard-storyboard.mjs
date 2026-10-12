import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={bonus:null,water:[],hang:[]};
await withBlockworksRuntime(async r=>{
 const {CUSTARD_BONUS_LEVEL:data}=r.sourceModule;
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(data),'rebuilt bonus must round-trip through editor validation');
 assert.equal(r.l.crates.length,18);assert.equal(data.components.filter(c=>c.t==='gate').length,1);
 r.p.bonusMode=true;let hold=0,jumps=0;
 for(let frame=0;frame<6000&&r.p.state!=='finished';frame++){
  const x=r.p.pos.x,targets=r.l.crates.filter(c=>c.alive&&!c.pending).sort((a,b)=>Math.abs(a.box.min.x-x)-Math.abs(b.box.min.x-x));
  const target=targets[0],delta=(target?(target.box.min.x+target.box.max.x)/2:50)-x;
  const direction=Math.abs(delta)>.75?Math.sign(delta):0;
  const edge=direction>0?((x>.2&&x<2)||(x>18.7&&x<20)):direction<0?((x>4&&x<5.8)||(x>22&&x<23.8)):false;
  const high=target&&Math.abs(delta)<1.3&&target.box.min.y>r.p.pos.y+.7;
  const start=r.p.grounded&&(edge||high)&&hold===0;
  if(start){hold=8;jumps++;}
  r.tick({moveX:direction,jumpHeld:hold>1,jumpPressed:start,jumpReleased:hold===1,
    spinHeld:frame%22<10,spinPressed:frame%22===0});
  if(hold>0)hold--;
  assert.notEqual(r.p.state,'dead',`bonus pilot died at ${r.p.pos.toArray()}`);
 }
 assert.equal(r.p.state,'finished','normal-input pilot must reach the actual return gate');
 assert.equal(r.p.cratesBroken,18,'normal-input pilot must collect every original reward');
 report.bonus={jumps,boxes:r.p.cratesBroken,position:r.p.pos.toArray()};
},{modulePath:'/src/levels/custard-bonus.ts',source:m=>m.CUSTARD_BONUS_LEVEL,levelId:'bonus-custard-creek'});

await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,p=r.p,l=r.l;
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(m.CUSTARD_CREEK_LEVEL),'parent must round-trip');
 assert.ok(m.CUSTARD_CREEK_BANK_END<m.CUSTARD_CREEK_FALL_CREST,'walkable bank must end before the waterfall lip');
 for(const s of [m.CUSTARD_CREEK_BANK_END+1,m.CUSTARD_CREEK_FALL_CREST,m.CUSTARD_CREEK_FALL_CREST+8]){
  const q=m.custardPoint(s,-5.8),ray=new r.THREE.Raycaster(new r.THREE.Vector3(...q),new r.THREE.Vector3(0,-1,0),0,2);
  assert.equal(ray.intersectObjects(l.groundMeshes,false).length,0,`walkable finish extends over the waterfall at ${s}`);
 }
 for(const s of [60,420,920,1600,2060,2395]){
  const q=m.custardPoint(s,m.custardHeight(s)+1,14);
  p.respawn(l,true,false,{position:new r.THREE.Vector3(...q)});p.endlessDeaths=true;
  const baseline=p.totalDeaths,water=l.lethalWaterSurfaceAt(q[0],q[2]);assert.ok(water!==null);
  let entered=false,lowest=Infinity,splash=false,returned=false;
  for(let f=0;f<300;f++){
   r.tick({});
   if(p.drowningY!==null){entered=true;lowest=Math.min(lowest,p.pos.y);splash||=p.swimEffects.group.children.some(c=>c.visible);}
   if(entered&&p.state==='ride'&&p.grounded){returned=true;break;}
  }
  assert.ok(entered&&splash&&returned,`water ${s}: splash/sink/return missing`);
  assert.equal(p.totalDeaths,baseline+1,'water entry must charge only one death');
  assert.ok(lowest>=water-2.73&&lowest<water-2.2,`unbounded or invisible immersion ${lowest}/${water}`);
  report.water.push({s,water,lowest,returned});
 }
 console.log(JSON.stringify(report,null,2));
},{modulePath:'/src/levels/custard-creek.ts',source:m=>m.CUSTARD_CREEK_LEVEL,levelId:'custard-creek',endlessDeaths:true,maxFrames:9000});
