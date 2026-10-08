// One focused real-Player smoke: spin, settle, walk, bank, die and hard reset.
import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

const fixture = { v: 1, name: 'Spin bridge smoke', spawn: [-4, .12, 0], killY: -5,
  components: [
    { t: 'platform', p: [-3, -.5, 0], s: [6, 1, 2], edgeGrinding: false },
    { t: 'spinbridge', p: [0, 0, 0], s: [6, .36, 1.2], cycle: .4 },
    { t: 'platform', p: [11, -.5, 0], s: [10, 1, 8], edgeGrinding: false },
    { t: 'clock', p: [13, 0, 3] }, // optional trial stays off the test's walking line
    { t: 'checkpoint', p: [9, 0, 0] }, { t: 'gate', p: [13, 0, 0], yaw: 90 },
    { t: 'zone', p: [4, 0, 0], s: [30, 1, 8], dir: 'E' },
  ] };

await withBlockworksRuntime(async r => {
  const bridge = r.l.spinBridges[0], checkpoint = r.l.checkpoints[0];
  const {solidContact}=await r.server.ssrLoadModule('/src/worldSolids.ts');
  const body=(from,to)=>r.l.worldSolids.cast(new r.THREE.Vector3(...from),new r.THREE.Vector3(...to),
    {low:.2,high:1.2,radius:.2,ignore:surface=>surface.owner?.t!=='spinbridge'},solidContact());
  const probe = new r.THREE.Raycaster(), down = new r.THREE.Vector3(0, -1, 0);
  const floor = () => {
    probe.set(new r.THREE.Vector3(3, 2, 0), down); probe.far = 4;
    return probe.intersectObjects(r.l.groundMeshes, false)[0];
  };
  r.stepFor(12);
  assert.equal(bridge.activated, false); assert.ok(!floor(), 'closed upright bridge created an invisible floor');
  assert.ok(body([-1,.5,0],[1,.5,0]),'closed bridge retains its physical wall');
  r.walkTo([-.8, 0, 0], { label: 'approach actual upright contact', pace: .18 });
  r.tick({ spinHeld: true });
  assert.equal(bridge.activated, true, 'production Player spin did not activate the plank');
  assert.equal(bridge.deployed, false); assert.ok(!floor(), 'moving leaf became a premature floor');
  assert.equal(body([-1,.5,0],[1,.5,0]),false,'the retired wall cannot remain active in shared collision');
  r.stepFor(40);
  assert.equal(bridge.deployed, true); assert.ok(Math.abs(floor().point.y) < .001);
  assert.ok(bridge.wallBox.isEmpty(), 'deployed bridge retained its upright blocker');
  assert.ok(body([3,2,0],[3,-1,0]),'settled leaf is physical to shared collision again');
  r.walkTo([7.8, 0, 0], { label: 'walk the physically settled bridge', pace: .18 });
  r.tick({ spinHeld: true }); r.stepFor(25);
  assert.equal(r.l.runMode,false,'the fixture must stay in normal checkpoint mode');
  assert.equal(checkpoint.active, true); assert.deepEqual(checkpoint.savedSpinBridges, [true]);
  r.walkTo([-5.3, 0, 0], { label: 'return across the latched bridge', pace: .2 });
  r.charge(); r.releaseJump({ moveX: -1 });
  r.until(() => r.p.state === 'dead', { moveX: -1 },
    { label: 'walk off ordinary ground for checkpoint restore', allowDeath: true, maxFrames: 400 });
  r.until(() => r.p.state === 'ride' && r.p.grounded, {},
    { label: 'actual checkpoint respawn', allowDeath: true, maxFrames: 400 });
  assert.equal(bridge.deployed, true); assert.ok(Math.abs(floor().point.y) < .001);
  r.tick({ restartPressed: true }); r.stepFor(2);
  assert.equal(bridge.activated, false); assert.equal(bridge.deployed, false);
  assert.ok(!floor()); assert.ok(!bridge.wallBox.isEmpty());
  assert.ok(body([-1,.5,0],[1,.5,0]),'hard reset restores the closed physical wall');
  console.log(`PASS real spin contact, visible deployment, physical crossing, banked soft restore and closed hard reset (${r.frame} fixed frames).`);
}, { modulePath: '/src/levels/puzzle-trilogy.ts', levelId: 'spinbridge-smoke', source: () => fixture,
  maxFrames: 4000, controlFrame: () => ({ x: 0, z: -1 }) });

await withBlockworksRuntime(r=>{
  const bridge=r.l.spinBridges[0];r.stepFor(12);
  r.jumpTo([5,0,0],{airButtons:{spinHeld:true},arrivalTolerance:1,heightTolerance:.15});
  assert.equal(r.p.isBailing,false);assert.equal(r.p.totalDeaths,0);
  assert.equal(bridge.activated,true);
  assert.ok(r.p.grounded&&r.p.pos.x>3.5,'spin-and-jump reaches permanent receiving ground');
  r.until(()=>bridge.deployed,{}, {maxFrames:100,label:'finish visible timber deployment'});
  console.log('PASS airborne spin opens a returning timber without colliding with its retired blocker.');
},{modulePath:'/src/levels/puzzle-trilogy.ts',levelId:'spinbridge-air',controlFrame:()=>({x:0,z:-1}),
  source:()=>({v:1,name:'Returning timber',spawn:[0,.12,0],killY:-8,components:[
    {t:'phasepad',p:[0,0,0],s:[4.2,.6,5.4],cycle:4.8,amp:.68,phase:0},
    {t:'spinbridge',p:[3,.06,0],s:[6,.34,1.6],yaw:180,cycle:.55},
    {t:'platform',p:[6,-.5,0],s:[6,1,5.4]},
    {t:'clock',p:[7,0,2.2]},
    {t:'gate',p:[8,0,0],yaw:90},{t:'zone',p:[3,0,0],s:[30,10,8],dir:'E'},
  ]})});
