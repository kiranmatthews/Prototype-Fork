import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const baseline=process.argv.includes('--baseline');
await withBlockworksRuntime(async r=>{
  const {p,l,THREE,source}=r;
  const {treehouseTrialPoint:point}=await r.server.ssrLoadModule('/src/levels/treehouse-trials-continuity.ts');
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const ground=(q,range=3)=>{
    ray.set(new THREE.Vector3(q[0],q[1]+.1,q[2]),down);ray.far=range;
    return l.raycastGround(ray)[0]?.point.y;
  };
  const cases=[];
  for(const [name,from,to] of [['main straight',-120,-140],['village bend into straight',-190,-215]]){
    const start=point([35,-13.94,from]),end=point([35,-14,to]);
    p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading:new THREE.Vector3(0,0,-1)});r.stepFor(12);
    let finishX=null,straightDrift=0,frames=0;
    for(;frames<2200&&p.pos.z>end[2];frames++){
      r.tick({moveY:1});
      if(p.pos.z<point([35,-14,-199])[2]){
        finishX??=p.pos.x;straightDrift=Math.max(straightDrift,Math.abs(p.pos.x-finishX));
      }
    }
    cases.push({name,start,end: p.pos.toArray(),frames,straightDrift,offset:p.pos.x-end[0],deaths:p.totalDeaths});
    if(!baseline){
      assert.ok(p.pos.z<=end[2],`${name}: held forward completes the section`);
      assert.ok(Math.abs(p.pos.x-end[0])<1.25,`${name}: stays in the path centre, offset ${p.pos.x-end[0]}`);
      assert.ok(straightDrift<.025,`${name}: no continuing sideways drift on straight ground`);
      assert.equal(p.totalDeaths,0);assert.ok(p.grounded);
    }
  }
  console.log('FORWARD',JSON.stringify(cases));
  if(baseline)return;
  assert.equal(l.cameraViews.length,0,'framing views do not latch the held-input yaw');
  assert.equal(l.cameraPresentationViews.length,2,'both compositions remain');
  assert.equal(l.zoneAt(-15,0)?.dir,'S','opening retains its established screen-aligned controls');
  assert.equal(l.zoneAt(35,-61),null,'normal trail resumes the course spine after the clearing');
  const plants=source.components.filter(c=>c.nm?.startsWith('Finish understory ·'));
  const gate=source.components.find(c=>c.t==='gate');
  assert.equal(plants.length,16);
  assert.ok(plants.every(c=>c.solid===false&&c.scenerySolid===false&&c.p[2]+c.s[2]/2<gate.p[2]-4&&c.p[2]>-731),
    '3D planting is behind the podium, in front of the grove, and non-solid');
  const crystal=source.components.find(c=>c.t==='crystal'),rope=l.ropes[0].rail;
  assert.ok(rope.closest(new THREE.Vector3(...crystal.p)).distance<.02,'crystal is on the rope');
  const fruit=source.components.filter(c=>c.t==='wumpa'),crates=source.components.filter(c=>c.t==='crate');
  const bunch=fruit.filter(c=>c.nm?.startsWith('Loose fruit / Treehouse'));
  assert.equal(crates.length,27);assert.equal(bunch.length,66);assert.equal(fruit.length-bunch.length,77);
  const errors=[];
  for(const c of fruit){
    if(/jump arc|rope rail/.test(c.nm??''))continue;
    const y=ground(c.p),lift=c.p[1]-(y??-Infinity);
    if(y===undefined||lift<.65||lift>1.75)errors.push({name:c.nm,p:c.p,lift,y});
    if(l.crates.some(box=>box.box.clone().expandByScalar(.35).containsPoint(new THREE.Vector3(...c.p))))
      errors.push({name:c.nm,p:c.p,intersectsCrate:true});
  }
  for(const c of crates){
    const y=ground([c.p[0],c.p[1]+.3,c.p[2]],1),gap=c.p[1]-(y??-Infinity);
    if(y===undefined||gap<-.12||gap>.12)errors.push({name:c.nm,p:c.p,gap,y});
    assert.ok(Math.abs(c.p[2]-gate.p[2])>3,'finish pad remains clear');
  }
  for(let i=0;i<fruit.length;i++)for(let j=i+1;j<fruit.length;j++){
    const distance=new THREE.Vector3(...fruit[i].p).distanceTo(new THREE.Vector3(...fruit[j].p));
    if(distance<.65)errors.push({names:[fruit[i].nm,fruit[j].nm],distance});
  }
  console.log('PLACEMENT',JSON.stringify({fruit:fruit.length,crates:crates.length,errors}));
  assert.deepEqual(errors,[],'fruit is reachable and spaced; crates sit on actual support');
  // Collect the opening handful with real movement, then spin through a pair.
  p.respawn(l,true,false,{position:new THREE.Vector3(1,.06,8),heading:new THREE.Vector3(1,0,0)});
  const before=l.pickups.filter(c=>c.alive).length;
  r.until(()=>p.pos.x>6,()=>r.worldDirectionInput([1,0,0],.7),{maxFrames:500,label:'opening fruit handful'});
  const collected=before-l.pickups.filter(c=>c.alive).length;assert.ok(collected>=4,'loose bunch collects normally');
  p.respawn(l,true,false,{position:new THREE.Vector3(9.7,.06,10.25),heading:new THREE.Vector3(0,0,-1)});
  r.stepFor(3);
  const boxes=l.crates.filter(c=>c.alive).length;
  r.stepFor(24,()=>({...r.worldDirectionInput([0,0,-1]),spinHeld:true}));
  assert.ok(l.crates.filter(c=>c.alive).length<boxes,'native spin breaks the placed crate');
  l.setTimeTrial(true);assert.ok(l.pickups.every(c=>!c.mesh.visible));l.setTimeTrial(false);
  l.reset(false);assert.ok(l.pickups.every(c=>c.alive&&c.mesh.visible),'fruit returns after reset');
  assert.equal(l.captureData().components.filter(c=>c.t==='wumpa').length,fruit.length,'editor retains rewards');
  console.log('PASS Treehouse held-forward alignment, supported rewards, collection, crates and lifecycle.');
},{modulePath:'/src/levels/treehouse-trail.ts',levelId:'treehouse-trail',
  source:m=>baseline?{...m.TREEHOUSE_TRAIL_LEVEL,components:m.TREEHOUSE_TRAIL_LEVEL.components.map(c=>c.cameraView?{...c,cameraPresentationOnly:false}:c)}:m.TREEHOUSE_TRAIL_LEVEL,
  endlessDeaths:true,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
