import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

const fixture={v:1,name:'Puzzle blast accounting',spawn:[-2.6,.02,0],killY:-20,groups:[],components:[
  {t:'platform',p:[0,-.5,0],s:[30,1,8]},
  {t:'zone',p:[0,0,0],s:[30,1,8],dir:'E'},
  {t:'crate',p:[0,0,0],kind:'tnt'},
  {t:'crate',p:[2,0,0],kind:'metal'},
  {t:'crate',p:[2.9,0,0],kind:'wood'},
  {t:'gate',p:[12,0,0],yaw:90},
]};
await withBlockworksRuntime(r=>{
  const [tnt,metal,wood]=r.l.crates;
  r.stepFor(20);r.charge();r.releaseJump();
  r.until(()=>tnt.fuse!==undefined,()=>r.steerToward([0,0,0]),{maxFrames:120,label:'stomp primes a real TNT fuse'});
  assert.ok(tnt.alive&&tnt.fuse>2.7,'stomp detonated TNT rather than starting its fuse');
  r.until(()=>r.p.pos.x>5, {moveX:1},{maxFrames:120,label:'retreat from the explosive radius'});
  r.until(()=>!tnt.alive,{}, {maxFrames:200,label:'wait for the three-second fuse'});
  r.stepFor(50);
  assert.ok(metal.alive,'blast broke ordinary steel');
  assert.equal(wood.alive,false,'blast failed to clear breakable neighbor');
  assert.equal(r.p.cratesBroken,2,'intact steel contributed phantom/repeated box rewards');
  assert.equal(r.l.totalCrates,2,'fixture tally should include only TNT and wood');
  assert.ok(r.p.grounded&&r.p.state==='ride'&&!r.p.isBailing,'safe retreat was not supported');
  console.log(JSON.stringify({fuseSeconds:3,cratesBroken:r.p.cratesBroken,metalAlive:metal.alive,
    woodAlive:wood.alive,position:r.p.pos.toArray(),frames:r.frame}));
},{source:()=>fixture,levelId:'puzzle-blast-regression'});
console.log('PASS TNT input-only fuse and retreat, breakable blast reward, and intact steel excluded from tally');

const flingFixture={...fixture,name:'Puzzle enemy fling accounting',components:[
  {t:'platform',p:[0,-.5,0],s:[30,1,8]},
  {t:'zone',p:[0,0,0],s:[30,1,8],dir:'E'},
  {t:'enemy',p:[0,0,0],foe:'grunt',range:0,speed:0},
  {t:'crate',p:[2,0,0],kind:'metal'},
  {t:'crate',p:[2.9,0,0],kind:'wood'},
  {t:'gate',p:[12,0,0],yaw:90},
]};
await withBlockworksRuntime(r=>{
  const enemy=r.l.enemies[0],[metal,wood]=r.l.crates;
  r.stepFor(20);
  r.until(()=>!enemy.alive,()=>({...r.steerToward(enemy.group.position),
    spinHeld:r.p.pos.distanceTo(enemy.group.position)<2.2}),{maxFrames:100,label:'spin the real enemy into the crate row'});
  r.stepFor(120);
  assert.ok(metal.alive,'flung enemy broke ordinary steel');
  assert.equal(wood.alive,false,'flung enemy did not clear the breakable neighbor');
  assert.equal(r.p.cratesBroken,1,'flung enemy awarded repeated phantom steel boxes');
  assert.equal(r.l.totalCrates,1);
  assert.ok(!r.p.isBailing&&r.p.state==='ride','spin choice did not leave the player alive');
  console.log(JSON.stringify({flungEnemyAlive:enemy.alive,metalAlive:metal.alive,woodAlive:wood.alive,cratesBroken:r.p.cratesBroken,frames:r.frame}));
},{source:()=>flingFixture,levelId:'puzzle-fling-regression'});
console.log('PASS input-only enemy spin/fling clears wood and never counts intact steel');

const gemFixture={v:1,name:'One-line bonus completion payout',hudMode:'bonus',spawn:[-4,.12,0],killY:-12,groups:[],components:[
  {t:'platform',p:[4,-.5,0],s:[20,1,5.4]},
  ...[-.83,.83].map(z=>({t:'wall',p:[4,-14,z],s:[30,44,.6],invisible:true})),
  {t:'crate',p:[0,0,0],kind:'wood'},
  {t:'gate',p:[8,0,0],yaw:90},
]};
await withBlockworksRuntime(r=>{
  const crate=r.l.crates[0];r.stepFor(20);
  r.until(()=>!crate.alive,()=>({moveX:1,spinHeld:Math.abs(r.p.pos.x)<1.8}),
    {maxFrames:120,label:'clear the actual last bonus box'});
  r.until(()=>r.p.gemEarned,{moveX:1},{maxFrames:150,label:'collect the gem on the narrow supported approach'});
  assert.notEqual(r.p.state,'finished','the finish interrupted the all-box prize');
  assert.equal(r.l.gemPickup.collected,true,'the actual world gem was not collected');
  const pickup=r.p.pos.toArray();
  r.until(()=>r.p.state==='finished',{moveX:1},{maxFrames:150,label:'finish after collecting the real box gem'});
  assert.ok(!r.p.isBailing&&Math.abs(pickup[2])<.3);
  console.log(JSON.stringify({allBoxes:r.p.cratesBroken,gemEarned:r.p.gemEarned,pickup,finished:r.p.state,frames:r.frame}));
},{source:()=>gemFixture,levelId:'puzzle-gem-regression'});
console.log('PASS real last-box award and gem contact before finish inside one-line bonus containment');
