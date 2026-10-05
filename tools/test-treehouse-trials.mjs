import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import * as THREE from 'three';
import { createServer } from 'vite';
import { makeInput } from './jungle-cup-harness.mjs';

// The source meshes and native player contacts are tested without WebGL.
const fixture = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
globalThis.fetch = async () => new Response('', { status: 404 });
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/GLB|failed|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/GLB|failed|procedural skateboard/i.test(String(a[0]))) error(...a); };
let level;
try {
  const { Level, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { TREEHOUSE_TRAIL_LEVEL: data, TREEHOUSE_TRIALS_STATIONS: stations } = await server.ssrLoadModule('/src/levels/treehouse-trail.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { CONST } = await server.ssrLoadModule('/src/tuning.ts');
  assert.ok(normalizeCustomLevelData(structuredClone(data)), 'all source-owned components normalize');
  assert.equal(data.components.filter(c => c.t === 'gate').length, 1);
  assert.ok(!data.components.some(c => c.t === 'enemy' || c.t === 'crate'), 'placement is deferred');
  assert.ok(data.killY < -24, 'kill plane stays beneath descent and all visible beds');
  const scene = new THREE.Scene();
  level = new Level(scene, { id: 'treehouse-trail', name: data.name, data });
  level.update(0); scene.updateMatrixWorld(true);
  const player = new Player(scene), neutral = makeInput();
  player.rawInput = neutral; player.respawn(level, true); player.endlessDeaths = true;
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const ground = (x, z, fromY = 60) => {
    ray.set(new THREE.Vector3(x, fromY, z), down); ray.far = 100;
    return ray.intersectObjects(level.groundMeshes, false)[0];
  };
  const reset = p => {
    player.respawn(level, true, true, { position: new THREE.Vector3(...p), heading: new THREE.Vector3(0, 0, -1) });
    player.camDir.set(0, 0, -1); player.rawInput = neutral;
  };
  const step = input => {
    player.camDir.set(0,0,-1); player.rawInput = input;
    level.update(CONST.fixedStep); player.step(CONST.fixedStep, input, level); input.consumeEdges();
    assert.ok(player.pos.toArray().every(Number.isFinite), 'native contact remains finite');
  };
  const spawn = ground(data.spawn[0], data.spawn[2]);
  assert.ok(spawn && Math.abs(spawn.point.y - (data.spawn[1] - .15)) < .08, 'balcony spawn support');
  let probes = 1;
  const continuous = [
    [-16,-42,0], [-50,-67,-5.1], [-75,-94,-9], [-102,-145,-13], [-151,-228,-14],
    [-240,-252,-14], [-252,-284,-14], [-284,-296,-7.2], [-342,-350,-7.2], [-374,-414,-7.2],
  ];
  for (const [near, far] of continuous) for (let z = near + .01; z >= far; z -= .4) {
    for (const x of [33,35,37]) {
      const hit = ground(x,z);
      assert.ok(hit, `authored supported ground at ${x}/${z.toFixed(1)}`);
      assert.ok(hit.point.y > data.killY + 10, 'supported course is well above kill plane'); probes++;
    }
  }
  for (const [z, expected] of [[-28,0],[-42,-3],[-46,-2.2],[-50,-5.1],[-67,-6.7],[-71,-5.9],[-75,-9],[-94,-10.6],[-98,-9.8],[-102,-13],[-112,-14],[-252,-14],[-284,-7.2]]) {
    assert.ok(Math.abs(ground(35,z).point.y - expected) < .06, `exact path seam ${z}`); probes++;
  }
  const launches = data.components.filter(c=>c.nm?.startsWith('Full-width downhill launch'));
  assert.equal(launches.length,3);
  for(const c of launches)assert.ok(c.w>=12,'launch spans the complete playable width');
  for(const [lip, land] of [[-46,-50],[-71,-75],[-98,-102]]) {
    assert.ok(ground(35,land).point.y < ground(35,lip).point.y - 2.5,'landing visibly lower than takeoff');
    assert.ok(ground(35,(lip+land)/2).point.y < ground(35,land).point.y - .7,'pit has an exposed shallow bed');
  }
  const groundRail = data.components.find(c=>c.nm?.startsWith('First rail'));
  const gapRail = data.components.find(c=>c.nm?.startsWith('Second rail'));
  assert.ok(ground(35,groundRail.p[2]).point.y > -14.1,'lesson rail sits over normal ground');
  assert.ok(ground(35,gapRail.p[2]).point.y < -17,'second rail crosses an actual gap');
  assert.ok(gapRail.p[2]+gapRail.len/2>-145 && gapRail.p[2]-gapRail.len/2<-151,'rail endpoints reach both ground ledges');
  const shallowBed = ground(35,-234).point.y;
  assert.ok(shallowBed>-14.7,'river stays shallow under the stones');
  const stones = data.components.filter(c=>c.nm?.startsWith('Oversized flat river stepping stone'));
  assert.equal(stones.length,3);
  for(const stone of stones){assert.ok(Math.abs(ground(stone.p[0],stone.p[2]).point.y-(stone.p[1]+stone.s[1]/2))<.04);probes++;}
  const half=data.components.find(c=>c.nm==='Long sunlit cavern timber halfpipe');
  assert.ok(half && half.len>=40 && half.arcSteps>=24,'long smooth cavern halfpipe');
  for(const z of [-297,-308,-319,-330,-341])for(const x of [0,-3.3,3.3,-5.8,5.8]){
    const hit=ground(35+x,z);assert.ok(hit&&hit.point.y>=half.p[1]-.03,'supported halfpipe cross-section');probes++;
  }
  assert.equal(data.components.filter(c=>c.t==='rope').length,1,'one unmistakable rope crossing');
  const rope=data.components.find(c=>c.t==='rope');
  assert.ok(rope.amp<=.15 && rope.len>=12,'the bridge rope reads taut');
  for(const z of [-355,-369])assert.ok(Math.abs(ground(35,z).point.y+7.2)<.04,'abutment deck support');
  assert.ok(ground(35,-362).point.y<-11.8,'no alternate deck fills broken span');
  assert.ok(stations.coastalSettlement[2]>stations.hutCorridor[2],'coastal beat precedes the enclosed huts');

  // Launch all three dirt ramps with a normal moving charge and release.
  // Lower landings must be reachable without changing the movement constants.
  for (const [lip, land] of [[-46,-50],[-71,-75],[-98,-102]]) {
    const startZ=lip+8, startY=ground(35,startZ).point.y;
    reset([35,startY,startZ]);const walk=makeInput({moveY:1});let ticks=0;
    while(player.pos.z>lip+4.5&&ticks++<180)step(walk);
    const charge=makeInput({moveY:1,jumpHeld:true,jumpPressed:true});
    while(player.pos.z>lip+1.1&&ticks++<360)step(charge);
    step(makeInput({moveY:1,jumpReleased:true}));
    assert.equal(player.state,'air',`native jump leaves launch at ${lip}`);
    while(player.pos.z>land-3&&ticks++<600){step(walk);assert.notEqual(player.state,'dead',`jump clears the pit at ${lip}`);}
    assert.ok(player.pos.z<=land-3,`native jump reaches lower landing at ${land}`);
    for(let i=0;i<30;i++)step(neutral);
    assert.ok(player.grounded,`native ramp jump settles on dirt at ${land}`);
    assert.equal(player.totalDeaths,0,`ramp jump requires no reset at ${lip}`);
  }

  // Native walking verifies bevelled rock risers and the halfpipe's open ends.
  for(const [start,target,label] of [
    [[35,-14,-251],[35,-7.2,-286],'rough cave climb'],
    [[35,-7.2,-294],[35,-7.2,-344],'long halfpipe walk through'],
  ]) {
    reset(start);const input=makeInput({moveY:1});let ticks=0;
    while(player.pos.z>target[2]+.5 && ticks++<1800){step(input);assert.notEqual(player.state,'dead',`${label} stays supported`);}
    assert.ok(player.pos.z<=target[2]+.5,`${label} traverses with native movement: ${player.pos.toArray()}`);
    assert.ok(Math.abs(player.pos.y-target[1])<.15,`${label} reaches its exact landing height`);
  }

  // Both rails and the rope are caught with held grind and released onto their
  // authored landing ledges. No rail-specific movement or teleport is used.
  for(const [component, label] of [[groundRail,'ground rail'],[gapRail,'gap rail'],[rope,'broken bridge rope']]) {
    const rail=component.t==='rope'?level.ropes[0].rail:level.grindRails.find(r=>Math.abs(r.pointAt(r.totalLength/2).z-component.p[2])<.1);
    assert.ok(rail,`${label} has the native grind line`);
    const a=rail.pointAt(.1), b=rail.pointAt(rail.totalLength-.1), forwardStart=a.z>b.z?a:b;
    reset(forwardStart.toArray());
    player.pos.y+=.2;player.prevPos.copy(player.pos);player.state='air';player.grounded=false;player.vVel=-1;
    player.speed=8;player.axisF.set(0,0,-1);player.axisL.set(-1,0,0);player.lastVelX=0;player.lastVelZ=-8;
    const input=makeInput({moveY:1,grindHeld:true,grindPressed:true});step(input);
    assert.equal(player.state,'grind',`${label} catches with normal grind input`);
    let ticks=0;while(player.state==='grind'&&ticks++<1200)step(input);
    assert.notEqual(player.state,'grind',`${label} exits its rail`);
    for(let i=0;i<70;i++)step(makeInput({moveY:.25}));
    assert.ok(player.grounded,`${label} returns to supported landing ground: ${player.pos.toArray()}`);
    assert.equal(player.totalDeaths,0,`${label} does not require a hidden respawn`);
  }

  // Banking and respawning use the native checkpoint crate and spawn.
  const cp=level.checkpoints[0], center=cp.box.getCenter(new THREE.Vector3());
  reset([center.x,cp.spawnPos.y,center.z+.7]);
  const spin=makeInput({spinPressed:true});
  for(let i=0;i<60&&!cp.active;i++)step(spin);
  assert.ok(cp.active,'native spin banks the downhill checkpoint');
  player.pos.x+=4;player.respawn(level);
  assert.ok(player.pos.distanceTo(cp.spawnPos)<.15 && player.grounded,'soft respawn returns to supported checkpoint');

  // A real fall into a descent pit triggers the existing death/reset path.
  reset([35,-4,-48]);player.state='air';player.grounded=false;player.vVel=-1;
  const before=player.totalDeaths;
  for(let i=0;i<180 && player.totalDeaths===before;i++)step(neutral);
  assert.equal(player.totalDeaths,before+1,'visible pit bed triggers native reset');
  reset([35,-7.2,-399]);const finish=makeInput({moveY:1});
  for(let i=0;i<180 && player.state!=='finished';i++)step(finish);
  assert.equal(player.state,'finished','reachable finish uses the native gate');
  console.log(`PASS Treehouse Trials: ${probes} support/height probes, 3 lower full-width landings and visible beds, coastal/hut scene order, safe shallow river stones, 3 native ramp jumps, natural rock climb and long halfpipe through native movement, ground/gap/rope catches and supported exits, checkpoint bank/respawn, pit death/reset, reachable finish.`);
} finally {
  level?.dispose();await server.close();console.warn=warn;console.error=error;
}
