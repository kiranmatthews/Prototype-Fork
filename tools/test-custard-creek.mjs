import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const options={modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL,
  controlFrame:r=>r.p.courseInputDirection(r.l)??r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1}};
const alternatesOnly=process.argv.includes('--alternates-only');
const report=alternatesOnly?JSON.parse(await readFile('/private/tmp/custard-creek-journey.json','utf8')).report:
  {support:0,boxes:0,checkpoints:0,roadMetres:0,journey:null,hops:[],grinds:[],respawn:null};
report.hops=[];report.grinds=[];report.respawn=null;
if(!alternatesOnly)await withBlockworksRuntime(async r=>{
  const m=r.sourceModule,{normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  const {CAMPAIGN_LEVELS,CAMPAIGN_ISLANDS,validateCampaignMapGraph,CampaignStore}=await r.server.ssrLoadModule('/src/campaign.ts');
  assert.ok(normalizeCustomLevelData(structuredClone(r.source)),'native editor import accepts the whole course');
  const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
  assert.deepEqual(pack.levels.find(l=>l.id==='custard-creek')?.data,JSON.parse(JSON.stringify(r.source)));
  assert.deepEqual(validateCampaignMapGraph(),[]);
  assert.equal(CAMPAIGN_LEVELS.at(-1).levelId,'custard-creek','new identity appends after existing saved hub indices');
  const island=CAMPAIGN_ISLANDS.find(i=>i.id==='island-1');
  assert.equal(island.levelKeys[island.levelKeys.indexOf('test-course')+1],'custard-creek');
  const save=new CampaignStore();save.startEphemeral();assert.equal(save.levelUnlocked('custard-creek'),false);
  save.commitClear('test',{});assert.equal(save.levelUnlocked('custard-creek'),true);
  assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
  assert.ok(r.l.laneActive,'ordered camera spine follows the turns');
  r.stepFor(20);assert.ok(r.p.grounded&&!r.p.isBailing,'supported source spawn');
  const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
  const support=(p,tolerance=.035)=>{
    ray.set(new r.THREE.Vector3(p[0],p[1]+.2,p[2]),down);ray.far=.5;
    const hit=ray.intersectObjects(r.l.groundMeshes,false)[0];
    assert.ok(hit&&Math.abs(hit.point.y-p[1])<tolerance,`real support below ${p}: ${hit?.point.y}`);report.support++;
  };
  let previous=m.custardPoint(0),length=0;
  for(let s=0;s<=m.CUSTARD_CREEK_END;s+=2){
    const p=m.custardPoint(s);length+=Math.hypot(...p.map((v,i)=>v-previous[i]));previous=p;
    if(m.CUSTARD_CREEK_GAPS.some(g=>s>=g.a&&s<=g.b))support(m.custardPoint(s,3.9),.1);
    else for(const u of [-5,0,5])support(m.custardPoint(s,u));
    const f=r.l.laneDirAt(...p),t=m.custardTangent(s);
    assert.ok(f&&f.x*t[0]+f.z*t[2]>.995,'camera agrees with the road heading');
  }
  report.roadMetres=+length.toFixed(2);assert.ok(length>2350&&length<2600,'Carlisle-scale journey');
  for(const line of m.CUSTARD_CREEK_BOX_LINES)for(const {component:c,s} of line.boxes){
    support(c.p);assert.ok(['wood','mask','life'].includes(c.kind),'rolling string contains only smashable boxes');
    assert.ok(m.CUSTARD_CREEK_GAPS.every(g=>s<g.a-16||s>g.b+16),'run-up/landing stays clear');report.boxes++;
  }
  for(const cp of m.CUSTARD_CREEK_CHECKPOINTS){support(cp.p);report.checkpoints++;}
  assert.ok(report.boxes>=140,'box strings reach every chapter');
  assert.ok(r.source.killY<m.custardHeight(m.CUSTARD_CREEK_END)-15);
  // One actual production Player: the pilot submits stick/button samples only.
  // Take the continuous outer boardwalks on this run, without any relocations.
  const offset=s=>{
    const cp=m.CUSTARD_CREEK_CHECKPOINTS.find(c=>Math.abs(c.s-s)<14);
    if(cp)return m.custardBoxOffset(s)*Math.max(0,(Math.abs(cp.s-s)-8)/6);
    const gap=m.CUSTARD_CREEK_GAPS.find(g=>s>g.a-30&&s<g.b+30);
    if(gap){const t=Math.min(1,(s-(gap.a-30))/14,((gap.b+30)-s)/14);return 3.9*Math.max(0,t);}
    return m.custardBoxOffset(s);
  };
  r.until(()=>r.p.state==='finished',()=>{
    if(r.frame>120)assert.ok(r.p.boardRolling,'continuous string run retains the mounted board');
    const s=m.custardProgress(r.p.pos),ahead=s+6;
    return {...r.steerToward(m.custardPoint(ahead,offset(ahead))),jumpHeld:true};
  },{maxFrames:22000,label:'Continuous Custard Creek carve from spawn to gate'});
  assert.equal(r.p.totalDeaths,0);assert.ok(r.p.cratesBroken>=report.boxes*.85,'ride smashes most box strings without dismounting');
  assert.equal(r.l.checkpoints.filter(c=>c.active).length,report.checkpoints,`every checkpoint is banked; missing: ${r.l.checkpoints.map((c,i)=>!c.active?i+1:null).filter(Boolean)}`);
  let largestStep=0,distance=0;
  for(let i=1;i<r.trace.length;i++) {const d=Math.hypot(...r.trace[i].position.map((v,j)=>v-r.trace[i-1].position[j]));largestStep=Math.max(largestStep,d);distance+=d;}
  assert.ok(largestStep<1,'continuous run has no teleport-sized steps');
  report.journey={seconds:+(r.frame*r.dt).toFixed(2),distance:+distance.toFixed(2),largestStep,
    broken:r.p.cratesBroken,deaths:r.p.totalDeaths,state:r.p.state,checkpoints:r.l.checkpoints.filter(c=>c.active).length};
  await writeFile('/private/tmp/custard-creek-journey.json',JSON.stringify({report,trace:r.trace}));
  console.log('PASS continuous carving journey',JSON.stringify(report.journey));
},options);

// Each inner hop uses a charged release on the existing movement model. The
// placements are independent initial fixtures, never hidden acceptance warps.
for(const gap of [{a:430,b:435},{a:1124,b:1130},{a:1714,b:1720}]) {
  await withBlockworksRuntime(r=>{
    const m=r.sourceModule;r.stepFor(20);
    const steer=()=>r.steerToward(m.custardPoint(m.custardProgress(r.p.pos)+6));
    r.until(()=>m.custardProgress(r.p.pos)>=gap.a-3,()=>({...steer(),jumpHeld:true}),{maxFrames:600,label:'Creek hop run-up'});
    const before=r.p.speed;r.releaseJump(steer());assert.equal(r.p.state,'air');
    r.until(()=>r.p.grounded,steer,{maxFrames:300,label:'Creek hop landing'});
    const s=m.custardProgress(r.p.pos);assert.ok(s>gap.b);assert.equal(r.p.totalDeaths,0);assert.ok(r.p.boardRolling);
    report.hops.push({a:gap.a,b:gap.b,landing:+s.toFixed(2),launchSpeed:+before.toFixed(2)});
    console.log('PASS creek hop',JSON.stringify(report.hops.at(-1)));
  },{...options,start:undefined,source:m=>({...m.CUSTARD_CREEK_LEVEL,spawn:m.custardPoint(gap.a-28,0,.12)})});
}
await withBlockworksRuntime(r=>{
  const m=r.sourceModule,rail=m.CUSTARD_CREEK_RAILS[0];r.stepFor(20);
  const steer=()=>r.steerToward(m.custardPoint(m.custardProgress(r.p.pos)+6,rail.u));
  r.until(()=>r.p.state==='grind',()=>({...steer(),jumpHeld:true,grindHeld:true}),{maxFrames:600,label:'Optional meander rail catch'});
  const caught=r.p.grindRail;
  r.grindUntil(()=>r.p.grindT>caught.totalLength*.8,{buttons:{jumpHeld:true},maxFrames:600});
  assert.equal(r.p.state,'grind','retain the rail while its curve is ridden');
  report.grinds.push({name:'Meander rail',distance:+r.p.grindT.toFixed(2),deaths:r.p.totalDeaths});assert.equal(r.p.totalDeaths,0);
  console.log('PASS meander grind',JSON.stringify(report.grinds.at(-1)));
},{...options,source:m=>({...m.CUSTARD_CREEK_LEVEL,spawn:m.custardPoint(322,-4.6,.12)})});
// Actual Classic death/life and checkpoint restoration are covered by
// custard-creek-browser.mjs --respawn-only through the live game loop.
await writeFile('/private/tmp/custard-creek-validation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
