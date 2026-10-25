import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
  const {p,l,THREE,source}=r;
  const api=await r.server.ssrLoadModule('/src/level.ts');
  if(!api.normalizeCustomLevelData(source)){
    const base={v:1,name:'Probe',spawn:[0,1,0],killY:-16,components:[{t:'gate',p:[0,0,10]}]};
    console.log('invalid components',source.components.filter(c=>!api.normalizeCustomLevelData({...base,components:[...base.components,c]})));
    for(const [k,v]of Object.entries(source))if(k!=='components'&&!api.normalizeCustomLevelData({...base,[k]:v}))console.log('invalid property',k,v);
  }
  assert.ok(api.normalizeCustomLevelData(source),'profile survives validation');
  assert.deepEqual(l.captureData().caveCollapse,source.caveCollapse,'capture retains the seeded profile');
  const c=l.caveCollapse;
  for(const patch of [{speed:NaN},{path:[[0,0,0],[0,0,0]]},{seed:1.2},{spacing:.1},{warning:0},{extra:true}])assert.equal(api.normalizeCustomLevelData({...source,caveCollapse:{...source.caveCollapse,...patch}}),null);
  // Waiting is safe indefinitely; merely being near the side entrance never triggers.
  for(let i=0;i<60;i++)r.tick({});
  assert.equal(c.phase,'waiting');assert.ok(p.grounded);
  console.log('PASS: validation, capture, supported waiting spawn');
  const route=[];
  const runUntil=(test,input,limit=3000)=>{for(let i=0;i<limit&&!test();i++){r.tick(input());if(p.state==='dead'||p.isBailing)throw Error('pilot failed '+JSON.stringify(r.snapshot()));}assert.ok(test(),'pilot timeout '+JSON.stringify(r.snapshot()));};
  // Genuine device samples only. The camera keeps right/down in a stable screen frame.
  runUntil(()=>p.pos.x>-50,()=>({moveX:1}));
  r.stepFor(15,{moveX:1,jumpHeld:true});r.tick({moveX:1});
  runUntil(()=>p.pos.x>-8,()=>({moveX:1}));route.push(r.snapshot());console.log('route',JSON.stringify(r.snapshot()));
  // Follow the broad clearing to its central checkpoint, then turn toward +Z.
  runUntil(()=>p.pos.x>-1.8,()=>({moveX:1}));r.stepFor(30,{});
  // Down runs toward the lens without a control flip in the clearing.
  runUntil(()=>p.pos.z>24,()=>({moveY:-1,spinHeld:p.pos.z>3&&p.pos.z<9}));
  assert.ok(l.checkpoints[0].active,'spin activates the clearing checkpoint');route.push(r.snapshot());console.log('route',JSON.stringify(r.snapshot()));
  for(const [a,b]of r.sourceModule.CAVE_GAPS){
    runUntil(()=>p.pos.z>a-3.5,()=>({moveY:-1}));
    r.stepFor(15,{moveY:-1,jumpHeld:true});r.tick({moveY:-1});
    runUntil(()=>p.pos.z>b+5&&p.grounded,()=>({moveY:-1}));route.push(r.snapshot());console.log('route',JSON.stringify(r.snapshot()));
  }
  runUntil(()=>p.state==='finished',()=>({moveY:-1}),1800);route.push(r.snapshot());console.log('route',JSON.stringify(r.snapshot()));
  assert.equal(p.totalDeaths,0);assert.equal(c.phase,'escaped');assert.ok(c.collapsed>15);
  console.log(JSON.stringify({route,collapsed:c.collapsed,rocks:c.rocks.length,seconds:r.frame*r.dt}));
  // Checkpoint retry clears every collider and seeded fragment transform.
  p.respawn(l,false);r.stepFor(5,{});assert.equal(c.phase,'waiting');assert.ok(p.grounded);assert.ok(c.rocks.every(r=>r.box.isEmpty()));
  const retry=l.currentSpawn.toArray();assert.deepEqual(retry,l.checkpoints[0].spawnPos.toArray(),'clearing checkpoint is earned');
  // Enter and stop: the chase must actually reach and crush the runner.
  runUntil(()=>p.pos.z>28,()=>({moveY:-1}));
  for(let i=0;i<900&&p.state!=='dead';i++)r.tick({});
  assert.equal(p.state,'dead','collapse catches an idle runner');
  for(let i=0;i<300&&p.state==='dead';i++)r.tick({});
  assert.ok(p.grounded);assert.equal(c.phase,'waiting');
  // Native pit failure returns to the earned checkpoint.
  p.respawn(l,false,false,{position:new THREE.Vector3(0,1,78),heading:new THREE.Vector3(0,0,1)});
  let died=false;for(let i=0;i<300;i++){r.tick({});died||=p.state==='dead';if(died&&p.state!=='dead'&&p.grounded)break;}
  assert.ok(died);assert.ok(p.grounded);assert.ok(p.pos.distanceTo(l.currentSpawn)<3);
  console.log('PASS: complete input-only route, catch, checkpoint retry, pit recovery, capture and validation');
},{modulePath:'/src/levels/cave-collapse.ts',source:m=>m.CAVE_COLLAPSE_LEVEL,levelId:'cave-collapse',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,endlessDeaths:true,maxFrames:16000});
