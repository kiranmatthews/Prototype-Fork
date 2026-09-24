import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import * as THREE from 'three';
import { createServer } from 'vite';
import { makeInput } from './jungle-cup-harness.mjs';

// Keep collision tests independent of WebGL and network asset loading.
const fixture = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
globalThis.fetch = async () => new Response('', { status: 404 });
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const warning = console.warn, error = console.error;
const expectedAssetMessage = a => /GLB|failed|procedural skateboard/i.test(String(a[0]));
console.warn = (...a) => { if (!expectedAssetMessage(a)) warning(...a); };
console.error = (...a) => { if (!expectedAssetMessage(a)) error(...a); };
let level;
try {
  const { Level, normalizeCustomLevelData, newLaneCursor } = await server.ssrLoadModule('/src/level.ts');
  const { TREEHOUSE_TRAIL_LEVEL: data } = await server.ssrLoadModule('/src/levels/treehouse-trail.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const { treehouseReviewRoute, treehouseStairRoute } = await server.ssrLoadModule('/tools/treehouse-trail-review-route.ts');
  assert.ok(normalizeCustomLevelData(structuredClone(data)), 'valid source-owned level data');
  assert.equal(data.components.filter(c => c.t === 'gate').length, 1, 'exactly one finish');
  assert.ok(!data.components.some(c => ['pit','enemy','crusher','pendulum','stone','grindosaurus','angryball'].includes(c.t)), 'beginner trail has no lethal hazards');
  const scene = new THREE.Scene();
  level = new Level(scene, { id: 'treehouse-trail', name: data.name, data });
  level.update(0); scene.updateMatrixWorld(true);
  const player = new Player(scene), neutral = makeInput();
  player.rawInput = neutral; player.respawn(level, true);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const ground = (x, z, y = 100) => {
    ray.set(new THREE.Vector3(x, y, z), down); ray.far = 200;
    return ray.intersectObjects(level.groundMeshes, false)[0];
  };
  const cameraCursor = newLaneCursor(), cameraForward = new THREE.Vector3(0,0,-1);
  const publishCamera = (snap = false) => {
    const forward = level.cameraDirAt(player.pos.x,player.pos.y,player.pos.z,cameraCursor) ?? {x:0,z:-1};
    cameraForward.lerp(new THREE.Vector3(forward.x,0,forward.z),snap?1:Math.min(1,3.5*CONST.fixedStep)).normalize();
    player.camDir.copy(cameraForward);
  };
  const step = input => {
    publishCamera();
    player.rawInput = input; level.update(CONST.fixedStep); player.step(CONST.fixedStep, input, level); input.consumeEdges();
  };
  const reset = (p = level.spawnPos) => {
    player.respawn(level, true, true, { position: p.clone(), heading: new THREE.Vector3(0, 0, -1) });
    player.rawInput = neutral; cameraCursor.s = -1; publishCamera(true);
  };
  const safe = label => {
    assert.ok(player.pos.toArray().every(Number.isFinite), `${label}: finite position`);
    assert.ok(!['dead','gameover'].includes(player.state), `${label}: died at ${player.pos.toArray()}`);
    assert.equal(player.totalDeaths, 0, `${label}: no death or hidden respawn`);
    assert.ok(player.pos.y > level.killY + 2, `${label}: clear of kill floor`);
  };
  const spawnFloor = ground(data.spawn[0], data.spawn[2]);
  for (let i = 0; i < 30; i++) step(neutral);
  assert.ok(spawnFloor && Math.abs(player.pos.y - spawnFloor.point.y) < .08, 'spawn settles on supported trail');
  assert.ok(player.grounded, 'supported spawn');
  assert.ok(level.grindRails.length >= 1, 'beginner grind rail');
  assert.ok(level.ropeSwings.length >= 1 || level.ropes.length >= 1, 'beginner rope');
  const gate = data.components.find(c => c.t === 'gate');
  const route = treehouseReviewRoute(data,0);
  assert.equal(data.components.filter(c=>c.cameraView).length,1,'one composed opening view');
  assert.equal(data.components.filter(c=>c.t==='zone').length,0,'opening uses the view frame without competing zone remaps');
  assert.ok(data.spawn[1]>8,'opening starts on the supported balcony');
  let samples = 0, minGround = Infinity, lowest;
  for (let leg = 1; leg < route.length; leg++) {
    const a = route[leg - 1], b = route[leg], length = a.distanceTo(b);
    const side = new THREE.Vector3(-(b.z-a.z), 0, b.x-a.x).normalize();
    for (let i = 0; i <= Math.ceil(length * 2); i++) for (const offset of (a.x<0&&a.y>.3?[-.7,0,.7]:[-2,-1,0,1,2])) {
      const p = a.clone().lerp(b, i / Math.ceil(length * 2)).addScaledVector(side, offset), hit = ground(p.x, p.z);
      assert.ok(hit, `continuous trail support ${p.x.toFixed(2)}/${p.z.toFixed(2)}`);
      assert.ok(hit.point.y > level.killY + 3, 'safe floor above kill plane');
      if (hit.point.y < minGround) { minGround = hit.point.y; lowest = hit.point.clone(); }
      samples++;
    }
  }
  assert.ok(minGround >= -2.5, 'pit depth stays shallow');
  // A real fall lands safely in the lowest authored dip.
  reset(lowest.clone().add(new THREE.Vector3(0, 4, 0)));
  player.pos.copy(lowest).add(new THREE.Vector3(0, 4, 0)); player.prevPos.copy(player.pos);
  player.state = 'air'; player.grounded = false; player.vVel = -1;
  for (let i = 0; i < 240; i++) { step(neutral); safe('shallow pit landing'); }
  assert.ok(player.grounded && Math.abs(player.pos.y - lowest.y) < .08, 'pit catches fall on its real floor');

  // Keep Right genuinely held through the opening: camera/input state is
  // allowed to persist, exactly as it does for a person using a controller.
  reset(new THREE.Vector3(1,0,9)); const heldRight=makeInput({moveX:1});const startPosition=player.pos.clone();
  for(let i=0;i<180;i++){step(heldRight);safe('held-right opening');}
  assert.ok(player.pos.x>startPosition.x+8,'held Right makes substantial +X progress');
  assert.ok(Math.abs(player.pos.z-startPosition.z)<.2,'held Right remains screen-horizontal');
  const heldRightDistance=player.pos.x-startPosition.x;
  // Releasing at the forward section reseeds the existing input frame; fresh
  // Up then travels into the bush without retaining the opening's right axis.
  const forwardNode=route.find((p,i)=>i>0 && p.z<route[0].z-25);
  assert.ok(forwardNode,'forward corridor after the corner');reset(forwardNode);
  step(neutral);const turnPosition=player.pos.clone();const freshForward=makeInput({moveY:1});
  for(let i=0;i<120;i++){step(freshForward);safe('fresh-forward after turn');}
  assert.ok(player.pos.z<turnPosition.z-5,'fresh forward enters the bush');
  assert.ok(Math.abs(player.pos.x-turnPosition.x)<2,'fresh forward follows the corridor');

  // Navigate each authored leg with real joystick input. A new waypoint is a
  // new steering decision; input release lets the view frame seed naturally.
  reset(); const walk = makeInput(); let ticks = 0, minPlayerY = player.pos.y;
  const targets = treehouseReviewRoute(data).slice(1);
  for (const target of targets) {
    step(neutral);let localTicks = 0;
    while (Math.hypot(target.x-player.pos.x, target.z-player.pos.z) > (player.pos.x<0&&(player.pos.y>.3||target.y>.3)?.25:1.5) && player.state !== 'finished') {
      assert.ok(localTicks++ < 2400, `walking blocked before ${target.toArray()}, player ${player.pos.toArray()}, ${player.state}`);
      const dx=target.x-player.pos.x, dz=target.z-player.pos.z, magnitude=Math.hypot(dx,dz);
      // Intentional steering uses a fresh screen frame, while the independent
      // held-input checks above cover the camera's continuity lock.
      publishCamera();player.viewInput.reset();
      const forward=level.cameraDirAt(player.pos.x,player.pos.y,player.pos.z,cameraCursor)??{x:0,z:-1};
      const pace=player.pos.x<0&&(player.pos.y>.3||target.y>.3)?.65:1;
      walk.moveX=(-dx*forward.z+dz*forward.x)/magnitude*pace;walk.moveY=(dx*forward.x+dz*forward.z)/magnitude*pace;
      walk.spinPressed=ticks%45===0;
      step(walk); safe('whole trail walk'); minPlayerY=Math.min(minPlayerY,player.pos.y); ticks++;
    }
  }
  assert.equal(player.state, 'finished', 'walking through the finish completes the level');

  // Banking a checkpoint through real spin collision survives a soft respawn.
  assert.ok(level.checkpoints.length > 0, 'friendly route checkpoint');
  reset();
  const cp = level.checkpoints[0], center = cp.box.getCenter(new THREE.Vector3());
  player.pos.set(center.x, cp.spawnPos.y, center.z + .7); player.prevPos.copy(player.pos); player.settle(level);
  const spin = makeInput({ spinPressed: true });
  for (let i=0;i<60 && !cp.active;i++) step(spin);
  assert.ok(cp.active, 'spin banks reachable checkpoint');
  player.pos.x += 4; player.respawn(level);
  assert.ok(player.pos.distanceTo(cp.spawnPos)<.2, 'soft respawn restores checkpoint');
  assert.ok(player.grounded, 'checkpoint respawn is supported');

  // Catch and leave the short lesson rail via the normal held grind input.
  reset();
  const rail=level.grindRails[0], entry=rail.pointAt(Math.min(1,rail.totalLength*.15)), tangent=rail.tangentAt(0);
  player.pos.copy(entry).add(new THREE.Vector3(0,.2,0)); player.prevPos.copy(player.pos);
  player.state='air';player.grounded=false;player.vVel=-1;player.speed=7;
  player.axisF.copy(tangent);player.axisL.set(tangent.z,0,-tangent.x);player.lastVelX=tangent.x*7;player.lastVelZ=tangent.z*7;
  const grind=makeInput({grindHeld:true,grindPressed:true});step(grind);
  assert.equal(player.state,'grind','normal grind input catches lesson rail');
  let railTicks=0;
  while(player.state==='grind' && railTicks++<600){step(grind);safe('short rail');}
  assert.notEqual(player.state,'grind','lesson rail has a usable exit');
  for(let i=0;i<180;i++){step(neutral);safe('rail landing');}
  assert.ok(player.grounded,'rail exit lands on safe ground');

  // The visible rope line can be caught, climbed and released onto safe ground.
  for(const rope of level.ropeSwings){
    reset();level.update(0);
    const grip=level.ropePointAt(rope,rope.len-.3,new THREE.Vector3());
    assert.ok(ground(grip.x,grip.z),'rope has floor underneath');
    player.pos.copy(grip).add(new THREE.Vector3(0,-1,0));player.prevPos.copy(player.pos);
    player.state='air';player.grounded=false;player.vVel=-1;player.ropeCoolT=0;
    assert.ok(player.tryRopeGrab(level),'lesson rope is catchable');
    const before=player.ropeD,climb=makeInput({moveY:1});
    for(let i=0;i<30;i++){step(climb);safe('rope climb');}
    assert.ok(player.ropeD<before,'up input climbs rope');
    step(neutral);step(makeInput({jumpHeld:true,jumpPressed:true}));step(makeInput({jumpReleased:true}));
    assert.equal(player.state,'air','jump release leaves rope');
    const dismount=makeInput({moveY:1});
    for(let i=0;i<240;i++){step(dismount);safe('rope landing');}
    assert.ok(player.grounded,`rope release lands safely: ${player.state} at ${player.pos.toArray()}`);
  }
  // The optional clearing halfpipe has a continuous bottom and two curved
  // ride faces; it is entered/exited through its open ends without a jump.
  const half=data.components.find(c=>c.t==='vertramp' && c.vkind==='half');
  assert.ok(half,'clearing halfpipe');
  const [hx,hy,hz]=half.p, radius=half.rise??6, flat=half.w??3, halfLength=(half.len??30)/2;
  const arc=(half.arc??90)*Math.PI/180, lip=flat+radius*Math.sin(arc), lipY=hy+radius*(1-Math.cos(arc));
  const yaw=(half.yaw??0)*Math.PI/180;
  const pipeWorld=(x,y,z)=>new THREE.Vector3(hx+Math.cos(yaw)*x+Math.sin(yaw)*z,y,hz-Math.sin(yaw)*x+Math.cos(yaw)*z);
  const pipeLocal=p=>({x:Math.cos(yaw)*(p.x-hx)-Math.sin(yaw)*(p.z-hz),z:Math.sin(yaw)*(p.x-hx)+Math.cos(yaw)*(p.z-hz)});
  const pipeGround=(x,z)=>{const p=pipeWorld(x,0,z);return ground(p.x,p.z);};
  assert.equal(half.yaw,0,'pipe cross-section is parallel to screen horizontal');
  // Check real authored beam vertices, including their thickness, against the
  // riding envelope. Supports must remain outside both vertical lips.
  for(const beam of data.components.filter(c=>/Halfpipe (scaffold|exterior|lateral)/.test(c.nm??''))){
    for(let i=0;i<beam.vertices.length;i+=3){
      const point=new THREE.Vector3(beam.p[0]+beam.vertices[i],beam.p[1]+beam.vertices[i+1],beam.p[2]+beam.vertices[i+2]);
      assert.ok(Math.abs(pipeLocal(point).x)>lip+.05,`${beam.nm} enters riding surface`);
    }
  }

  assert.ok(radius>=4,'reference halfpipe has tall transitions');
  assert.ok((half.arcSteps??8)>=24,'hero transition has a smooth authored profile');
  assert.ok((half.len??30)<8,'compact halfpipe does not read as a long chute');
  let pipeProbes=0;
  for(const z of [-halfLength+.2,0,halfLength-.2]) {
    assert.ok(Math.abs(pipeGround(0,z).point.y-hy)<.03,'halfpipe flat floor');pipeProbes++;
    for(const side of [-1,1])for(const fraction of [.25,.5,.75,.96]) {
      const angle=arc*fraction,x=side*(flat+radius*Math.sin(angle));
      const expected=hy+radius*(1-Math.cos(angle)),hit=pipeGround(x,z);
      // The campaign mesh uses eight visible arc faces. Near the vertical lip
      // their chord differs from the ideal circle by up to 0.11m in a Y ray.
      assert.ok(hit && Math.abs(hit.point.y-expected)<.13,`halfpipe transition support ${x}/${z}: ${hit?.point.y} versus ${expected}`);pipeProbes++;
    }
    if(half.deck)for(const side of [-1,1]) {
      assert.ok(Math.abs(pipeGround(side*(lip+half.deck*.5),z).point.y-lipY)<.04,'halfpipe deck support');pipeProbes++;
    }
  }
  for(const dir of [-1,1]){
    reset(pipeWorld(0,hy+.1,-dir*(halfLength+2)));
    const walkPipe=makeInput();
    for(let i=0;i<240 && pipeLocal(player.pos).z*dir<halfLength+2;i++){
      const target=pipeWorld(0,hy,dir*(halfLength+2)),dx=target.x-player.pos.x,dz=target.z-player.pos.z,mag=Math.hypot(dx,dz);
      walkPipe.moveX=(dx*player.axisL.x+dz*player.axisL.z)/mag;
      walkPipe.moveY=(dx*player.axisF.x+dz*player.axisF.z)/mag;
      step(walkPipe);safe('halfpipe walk through');
      assert.ok(Math.abs(pipeLocal(player.pos).x)<.15,`halfpipe entry has no sideways obstruction: ${player.pos.toArray()}, frame ${i}, direction ${dir}, state ${player.state}`);
    }
    assert.ok(pipeLocal(player.pos).z*dir>halfLength+1.5,'halfpipe open-end exit');
  }
  const ridePeaks=[];
  for(const side of [-1,1]){
    reset(new THREE.Vector3(hx,hy,hz));
    player.axisF.set(Math.cos(yaw)*side,0,-Math.sin(yaw)*side);player.axisL.set(player.axisF.z,0,-player.axisF.x);player.speed=14;player.freeSkate=true;
    player.groundHit=player.queryGround(level);player.rideNormal.copy(player.groundHit.normal);
    let maximum=hy,returned=false;
    const ride=makeInput({jumpHeld:true,jumpPressed:true});
    for(let i=0;i<420;i++){
      step(ride);safe('halfpipe ride');maximum=Math.max(maximum,player.pos.y);
      if(maximum>hy+1 && player.grounded && player.pos.y<hy+.4)returned=true;
    }
    assert.ok(maximum>hy+1,'real skating reaches transition');
    assert.ok(returned,'halfpipe ride returns to supported lower ground');
    ridePeaks.push(maximum.toFixed(2));
  }
  // Climb the two real flight colliders and all shared landing seams, then
  // descend along the same path. There is no jump or teleport between modules.
  const stairFlights=data.components.filter(c=>c.nm==='Treehouse stair flight support');
  assert.equal(stairFlights.length,3,'three separate stair flights wrap around the trunk');
  let stairProbes=0;
  for(const flight of stairFlights)for(const t of [0,.01,.25,.5,.75,.99,1])for(const x of [-.9,0,.9]){
    const angle=(flight.yaw??0)*Math.PI/180,z=flight.len*(.5-t);
    const hit=ground(flight.p[0]+Math.cos(angle)*x+Math.sin(angle)*z,flight.p[2]-Math.sin(angle)*x+Math.cos(angle)*z);
    assert.ok(hit&&Math.abs(hit.point.y-(flight.p[1]+flight.rise*t))<.04,`stair flight at ${flight.p}/${flight.yaw}, fraction ${t}, cross ${x}: floor ${hit?.point.y}, expected ${flight.p[1]+flight.rise*t}`);stairProbes++;
  }
  for(const deck of data.components.filter(c=>/^Treehouse (landing|balcony|cabin floor) support$/.test(c.nm??''))){
    const top=deck.p[1]+deck.s[1]/2;
    assert.ok(Math.abs(ground(deck.p[0],deck.p[2]).point.y-top)<.04,'separate treehouse deck support');stairProbes++;
  }
  const stairs=treehouseStairRoute(data);
  for(let i=0;i<=40;i++)for(const offset of [-.4,0,.4]) {
    const p=stairs[0].clone().lerp(stairs[1],i/40);p.x+=offset;
    assert.ok(Math.abs(ground(p.x,p.z).point.y-stairs[0].y)<.05,'continuous single ground mesh at stair approach');stairProbes++;
  }
  let stairTicks=0;
  for(const path of [stairs,[...stairs].reverse()]){
    reset(path[0]);
    for(const target of path.slice(1)){
      let localTicks=0;
      while(Math.hypot(target.x-player.pos.x,target.z-player.pos.z)>.35){
        assert.ok(localTicks++<900,`stairs blocked ${player.pos.toArray()} toward ${target.toArray()}`);
        const dx=target.x-player.pos.x,dz=target.z-player.pos.z,mag=Math.hypot(dx,dz);
        step(makeInput({moveX:(dx*player.axisL.x+dz*player.axisL.z)/mag*.65,moveY:(dx*player.axisF.x+dz*player.axisF.z)/mag*.65}));
        safe('treehouse stairs');stairTicks++;
      }
      assert.ok(Math.abs(player.pos.y-target.y)<.22,`stair walk arrives at intended landing height: ${player.pos.toArray()} toward ${target.toArray()}, ${player.state}`);
    }
  }
  const facade=data.components.find(c=>c.nm==='Treehouse cabin facade collision');
  assert.ok(facade,'solid cabin facade');reset(stairs.at(-1));
  for(let i=0;i<100;i++){
    const dx=facade.p[0]-player.pos.x,dz=facade.p[2]-player.pos.z,mag=Math.hypot(dx,dz);
    const forward=level.cameraDirAt(player.pos.x,player.pos.y,player.pos.z,cameraCursor)??{x:0,z:-1};
    player.viewInput.reset();step(makeInput({moveX:(-dx*forward.z+dz*forward.x)/mag,moveY:(dx*forward.x+dz*forward.z)/mag}));safe('cabin facade');
  }
  const fa=(facade.yaw??0)*Math.PI/180;
  const localZ=Math.sin(fa)*(player.pos.x-facade.p[0])+Math.cos(fa)*(player.pos.z-facade.p[2]);
  assert.ok(localZ>facade.s[2]/2+.3,`cabin facade stops entry into visual shell: ${player.pos.toArray()}`);
  console.log(`PASS Treehouse Trail: held Right +${heldRightDistance.toFixed(1)}m, fresh forward after turn; ${samples} support probes, lowest floor ${minGround.toFixed(2)} m; ${(ticks*CONST.fixedStep).toFixed(1)} s real-input walk to finish (lowest feet ${minPlayerY.toFixed(2)} m); shallow pit landing, checkpoint spin/respawn, rail catch/exit and rope climb/release without deaths. Halfpipe: ${pipeProbes} floor/curve/deck probes, both open-end walk exits, both skating transitions and supported returns (peaks ${ridePeaks.join('/')} m). Treehouse: ${stairProbes} flight/deck/seam probes and ${(stairTicks*CONST.fixedStep).toFixed(1)} s real-input stair/landing/balcony climb/descent, with solid cabin facade.`);
} finally {
  level?.dispose(); await server.close(); console.warn=warning;console.error=error;
}
