import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

// Exercise authored geometry with the production controller. These are fixed
// launch-state fixtures, not a solver which teleports between landing targets.
const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop = () => {};' + harness.slice(
  harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held'),
) + '\ninstallHeadlessDom();');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
const fixtures = [], failures = [], evidence = [];
function check(name, run) {
  try { const detail = run(); evidence.push({ name, ...(detail ?? {}) }); }
  catch (error) { failures.push(`${name}: ${error.message}`); }
}
try {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { TUNING, CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const { CODEX_LAB_LEVEL: source, BLOCKWORKS_SECTIONS: sections, BLOCKWORKS_CAMERA_ROUTE: route } =
    await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const { CARLISLE_COAST_LEVEL: carlisle } = await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
  const dt = CONST.fixedStep;
  const tuningBefore = JSON.stringify(TUNING);
  const create = data => {
    const scene = new THREE.Scene();
    const level = new Level(scene, { id: 'blockworks-test', name: data.name, data });
    scene.updateMatrixWorld(true);
    const player = new Player(scene);
    player.enterLevel('blockworks-test'); player.endlessDeaths = true;
    player.rawInput = makeInput(); player.respawn(level, true);
    const tick = overrides => {
      const input = makeInput(overrides);
      player.step(dt, input, level); level.update(dt);
    };
    const fixture = { level, player, tick };
    fixtures.push(fixture); return fixture;
  };
  const full = create(source);

  check('Carlisle-sized route and ordered camera spine', () => {
    const length = sections.reduce((total, s) => total + s.length, 0);
    const coastGate = carlisle.components.find(c => c.t === 'gate');
    const coastSpan = Math.hypot(coastGate.p[0] - carlisle.spawn[0], coastGate.p[2] - carlisle.spawn[2]);
    assert.ok(length >= coastSpan * .9 && length <= coastSpan * 1.2, `route ${length}m vs Carlisle ${coastSpan}m`);
    const camera = source.components.filter(c => c.t === 'camnode' && !c.cameraView);
    for (let i = 1; i < camera.length; i++)
      assert.ok(Math.hypot(camera[i].p[0]-camera[i-1].p[0], camera[i].p[2]-camera[i-1].p[2]) <= 7.01,
        `camera gap at node ${i}`);
    assert.ok(route.length > sections.length * 3);
    return { metres: length, carlisleMetres: Math.round(coastSpan), cameraNodes: camera.length };
  });

  check('Spawn and every checkpoint have actual collision support', () => {
    const { player: p, level: l, tick } = full;
    for (const at of [l.spawnPos, ...l.checkpoints.map(cp => cp.spawnPos)]) {
      p.pos.copy(at); p.laneCursor.s = -1; p.settle(l);
      for (let i=0;i<15;i++) tick({});
      assert.ok(p.grounded && p.state === 'ride', `unsupported stop ${at.toArray()} -> ${p.pos.toArray()} ${p.state}`);
      assert.ok(Math.abs(p.pos.y-at.y)<.65, `stop shifted vertically ${at.toArray()} -> ${p.pos.toArray()}`);
    }
    return { supportedStops: l.checkpoints.length + 1 };
  });

  check('Switch groups isolate metal terrain and checkpoints preserve progress', () => {
    const l = full.level;
    l.reset(true);
    const switches = l.crates.filter(c => c.bang);
    assert.equal(switches.length, 5);
    for (const sw of switches) {
      l.reset(true);
      const ids = sw.groupIds;
      const controlled = l.crates.filter(c => c.metal && c.groupIds?.some(id => ids.includes(id)));
      const outside = l.crates.filter(c => c.metal && !controlled.includes(c));
      assert.ok(controlled.length >= 27);
      assert.ok(controlled.every(c => c.pending));
      l.triggerBang(sw);
      assert.ok(controlled.every(c => c.alive && !c.pending));
      assert.ok(outside.every(c => c.pending), 'a key opened another crossing');
      const homes = controlled.map(c => c.mesh.position.clone());
      for(let i=0;i<120;i++) l.update(dt);
      controlled.forEach((c,i) => assert.ok(c.mesh.position.distanceTo(homes[i])<.001, 'materialized pier fell'));
      l.activateCheckpoint(l.checkpoints[1], 0);
      const other = switches.find(c => c !== sw);
      l.triggerBang(other); l.reset(false);
      assert.ok(sw.bangUsed && !other.bangUsed, 'checkpoint did not roll back later key');
      assert.ok(controlled.every(c => !c.pending) && outside.every(c => c.pending));
    }
    l.reset(true);
    return { independentKeys: switches.length };
  });

  // Rigidly rotate source sections to -Z so identical control samples can
  // test north-, east- and westbound authored geometry. No dimensions change.
  const sectionFixtures = new Map();
  const localSection = index => {
    if(sectionFixtures.has(index)) return sectionFixtures.get(index);
    const s=sections[index], a=s.yaw*Math.PI/180, cs=Math.cos(a), sn=Math.sin(a);
    const vector=(x,z)=>[cs*x-sn*z,sn*x+cs*z];
    const local=p=>{const [x,z]=vector(p[0]-s.start[0],p[2]-s.start[2]);return [x,p[1],z];};
    const components=source.components.filter(c=>{
      if(c.grp===10+index)return !['camnode','zone'].includes(c.t);
      const p=local(c.p);return c.grp>=100 && p[2]<=0 && p[2]>=-s.length && Math.abs(p[0])<35;
    }).map(c=>{
      const d=structuredClone(c);d.p=local(c.p);
      if(d.yaw!==undefined)d.yaw=(d.yaw-s.yaw+360)%360;
      if(d.t==='pit' && s.yaw%180!==0)d.s=[d.s[2],d.s[1],d.s[0]];
      if(d.pts)d.pts=d.pts.map(p=>{const [x,z]=vector(p[0],p[1]);return [x,z,...p.slice(2)];});
      return d;
    });
    // Finish is kept far from every traversal probe; the full source gate is
    // tested separately below, including its normal finish-state transition.
    for(let i=components.length-1;i>=0;i--)if(components[i].t==='gate')components.splice(i,1);
    components.push({t:'gate',p:[500,0,-500]});
    const f=create({...source,name:s.name,spawn:[0,s.start[1]+.02,-10],components});
    sectionFixtures.set(index,f);return f;
  };
  const position = (f, x,y,v, board=false,speed=0) => {
    const {player:p,level:l}=f;
    p.pos.set(x,y+.02,-v);p.laneCursor.s=-1;p.settle(l);
    p.groundHit=p.queryGround(l);p.freeSkate=board;p.speed=speed;
    p.walkVelocity.set(0,0,-speed);p.walkRamp=1;
    p.prevPos.copy(p.pos);p.lastPlanar=speed;
  };
  const jump = (f,{x=0,y,v,board=false,speed=9,moveX=0,moveY=1,frames=100,steer}) => {
    position(f,x,y,v,board,speed);
    const p=f.player;
    assert.ok(p.groundHit && Math.abs(p.groundHit.y-y)<.06,
      `unsupported launch ${[x,y,v]}: actual ground ${p.groundHit?.y}`);
    // A charged release starts the arc; every subsequent position, collision,
    // landing or bail comes from the unchanged production movement controller.
    p.charging=true;p.chargeTimer=TUNING.jumpChargeTime;
    f.tick({jumpReleased:true,moveX,moveY});
    assert.equal(p.state,'air','charged release failed to launch');
    const trace=[];
    for(let i=0;i<frames;i++) {
      f.tick(steer?.(i,p) ?? {moveX,moveY});trace.push({x:p.pos.x,y:p.pos.y,v:-p.pos.z,state:p.state,grounded:p.grounded});
      if(p.grounded || ['dead','bail','hang','finished'].includes(p.state))break;
    }
    return {x:p.pos.x,y:p.pos.y,v:-p.pos.z,state:p.state,grounded:p.grounded,bailing:p.isBailing,trace};
  };
  const landing=(result,y,minV,label)=>{
    assert.ok(result.grounded && !result.bailing && result.state==='ride' && result.y>=y-.08 && result.v>=minV,
      `${label}: ${JSON.stringify({...result,trace:result.trace.slice(-3)})}`);
  };

  // Follow several pads without resetting position, velocity, charge, or
  // contact state between hops. Foot-air input stops over the intended lid;
  // the next neutral hold really charges through ordinary input samples.
  const precisionRun=(f,start,targets)=>{
    if(start)position(f,...start);
    const p=f.player,landed=[];
    assert.ok(p.grounded && p.groundHit && Math.abs(p.groundHit.y-p.pos.y)<.06,'precision run starts unsupported');
    for(const [x,y,v]of targets) {
      for(let frame=0;frame<26;frame++)f.tick({jumpHeld:true,jumpPressed:frame===0});
      f.tick({jumpReleased:true});
      assert.equal(p.state,'air','neutral hold/release failed');
      for(let frame=0;frame<100 && p.state==='air';frame++) {
        const dx=x-p.pos.x,dv=v+p.pos.z;
        f.tick({moveX:Math.abs(dx)>.09?Math.sign(dx):0,moveY:Math.abs(dv)>.09?Math.sign(dv):0});
      }
      assert.ok(p.grounded && p.state==='ride' && !p.isBailing && Math.abs(p.pos.y-y)<.08,
        `continuous target ${[x,y,v]} ended ${[p.pos.x,p.pos.y,-p.pos.z,p.state]}`);
      assert.ok(Math.abs(p.pos.x-x)<1.4 && Math.abs(-p.pos.z-v)<1.4,
        `wrong pad at ${[p.pos.x,p.pos.y,-p.pos.z]} for ${[x,y,v]}`);
      landed.push([+p.pos.x.toFixed(2),+p.pos.y.toFixed(2),+(-p.pos.z).toFixed(2)]);
    }
    return landed;
  };
  const walkTo=(f,x,v)=>{
    const p=f.player;
    for(let frame=0;frame<420;frame++) {
      const dx=x-p.pos.x,dv=v+p.pos.z;
      if(Math.abs(dx)<.1 && Math.abs(dv)<.1)break;
      f.tick({moveX:Math.abs(dx)>.09?Math.sign(dx)*.15:0,moveY:Math.abs(dv)>.09?Math.sign(dv)*.15:0});
      assert.ok(p.grounded && !p.isBailing,'lost balcony support while positioning for jump');
    }
    for(let frame=0;frame<30;frame++)f.tick({});
    assert.ok(Math.abs(p.pos.x-x)<.15 && Math.abs(-p.pos.z-v)<.15,
      `walk did not reach launch edge: target ${[x,v]} actual ${[p.pos.x,-p.pos.z]} speed ${p.speed} state ${p.state}`);
  };

  for(const [index,aId,bId,x,base,count,first,island,islandY,bFirst,bCount,exit] of [
    [1,100,101,-6,0,4,46,65,3.84,71,6,102],
    [11,103,104,6,2.4,5,47,71,7.2,77,7,113],
  ]) check(`Continuous two-key scaffold and crossing: section ${index+1}`,()=>{
    const f=localSection(index),l=f.level;
    l.reset(true);
    const key=id=>l.crates.find(c=>c.bang && c.groupIds?.includes(id));
    assert.ok(key(aId)&&key(bId));
    l.triggerBang(key(aId));
    const targets=Array.from({length:count},(_,i)=>[x,base+(i+1)*.96,first+i*4.6]);
    // Leave room around the still-solid B key when landing on its balcony.
    targets.push([x+(x<0?1.25:-1.25),islandY,island]);
    const scaffold=precisionRun(f,[x,base,first-5],targets);
    f.tick({spinHeld:true,spinPressed:true});
    assert.ok(key(bId).bangUsed,'real spin from B balcony did not activate B');
    walkTo(f,f.player.pos.x,bFirst-4.5);
    const bridgeY=index===1?4.8:7.2;
    const piers=Array.from({length:bCount},(_,i)=>[
      x-Math.sign(x)*Math.min(i,3)*2,bridgeY,bFirst+i*5.4,
    ]);
    piers.push([0,bridgeY,exit+1]);
    const bridge=precisionRun(f,null,piers);
    return {scaffoldLandings:scaffold,bridgeLandings:bridge};
  });

  check('Frozen crossing requires its key and supports a continuous six-pier hop line',()=>{
    const f=localSection(7),l=f.level;
    l.reset(true);
    const key=l.crates.find(c=>c.bang);
    const metal=l.crates.filter(c=>c.metal);
    assert.ok(metal.every(c=>c.pending));
    l.triggerBang(key);
    const targets=Array.from({length:6},(_,i)=>[0,.96,117+i*5.55]);
    targets.push([0,0,150]);
    return {landings:precisionRun(f,[0,0,112],targets)};
  });

  check('Charged board ollies climb all four 1.4m calibration shelves',()=>{
    const f=localSection(0),landings=[];
    for(let i=0;i<4;i++) {
      const near=34.5+i*10;
      const result=jump(f,{y:i*1.4,v:near-4.4,board:true,speed:12});
      landing(result,(i+1)*1.4,near,`shelf ${i+1}`);landings.push(+result.v.toFixed(2));
    }
    return {landings};
  });

  for(const [index,edge,gap,x] of [[0,131,11.5,0],[2,145,11.5,3],[10,85,11,0],[12,82,11.5,0]])
    check(`23m/s charged gap: section ${index+1}, ${gap}m`,()=>{
      const result=jump(localSection(index),{x,y:0,v:edge-.65,board:true,speed:23});
      landing(result,0,edge+gap,'flat skate gap');
      return {landingV:+result.v.toFixed(2)};
    });

  // These are the narrowest rising routes: source cube footprints overlap in
  // X, allowing deliberate edge launches without assuming diagonal overspeed.
  for(const [index,centres,count] of [[3,[35,44,53,62,71,80],6],[6,[36,47,58,69],4],[13,[34,45,56],3]])
    check(`2.4m rising cube sequence: section ${index+1}`,()=>{
      const f=localSection(index),landings=[];
      for(let i=0;i<count;i++) {
        const near=centres[i]-3.59;
        // Escarpment alternates across an almost-touching lateral seam;
        // the other two masses have a central strip shared by both stacks.
        const targetX=index===3?(i%2?.65:-.65):0;
        const x=index===3 && i>0?-targetX:targetX;
        const result=jump(f,{x,y:i*2.4,v:index===3 && i===0?26.85:near-4.2,
          ...(index===3 && i>0?{steer:(_frame,p)=>({moveY:1,moveX:Math.abs(p.pos.x-targetX)>.1?Math.sign(targetX-p.pos.x):0})}:{})});
        landing(result,(i+1)*2.4,near,`cube ${i+1}`);landings.push(+result.v.toFixed(2));
      }
      return {landings};
    });

  check('Aqueduct and transfer rails catch with held grind input',()=>{
    const caught=[];
    for(const [index,x,y,v] of [[4,-3,0,24],[5,0,0,37],[10,0,2.4,123],[13,0,7.2,127]]) {
      const f=localSection(index);position(f,x,y,v,true,12);
      for(let i=0;i<10 && f.player.state!=='grind';i++)f.tick({moveY:1,grindHeld:true,grindPressed:i===0});
      assert.equal(f.player.state,'grind',`section ${index+1} rail failed to catch`);
      caught.push(index+1);
    }
    return {sections:caught};
  });

  check('Continuous aqueduct, roof and crown grinds cross their lethal voids',()=>{
    const runs=[];
    for(const [index,x,y,v,end]of [[4,-3,0,24,158],[10,0,2.4,123,167],[13,0,7.2,127,158]]) {
      const f=localSection(index),p=f.player;
      position(f,x,y,v,true,23);
      let grindFrames=0,airFrames=0,maxBalance=0;
      for(let frame=0;frame<720;frame++) {
        const correction=THREE.MathUtils.clamp(-p.balance*5-p.balanceVel*.7,-1,1);
        f.tick({moveY:1,grindHeld:true,grindPressed:frame===0,moveX:p.state==='grind'?correction:0});
        if(p.state==='grind'){grindFrames++;maxBalance=Math.max(maxBalance,Math.abs(p.balance));}
        if(p.state==='air')airFrames++;
        if(p.grounded && -p.pos.z>=end && p.state==='ride')break;
        assert.ok(!p.isBailing && !['dead','gameover'].includes(p.state),`section ${index+1} failed over void`);
      }
      assert.ok(p.grounded && p.state==='ride' && -p.pos.z>=end,`section ${index+1} rail ended ${p.pos.toArray()} ${p.state}`);
      assert.ok(grindFrames>50 && airFrames>0,'crossing did not use rail and natural exit');
      assert.ok(p.speed<35,'disabled perfect-grind boost unexpectedly accelerated the route');
      runs.push({section:index+1,grindSeconds:+(grindFrames/60).toFixed(2),maxBalance:+maxBalance.toFixed(3)});
    }
    return {runs};
  });

  check('Continuous viaduct rail-to-rail charged transfer and landing',()=>{
    const f=localSection(5),p=f.player;
    position(f,0,0,37,true,23);
    let firstRail=null,receiver=false,released=false,airFrames=0;
    for(let frame=0;frame<720;frame++) {
      const v=-p.pos.z,grind=p.state==='grind';
      const correction=THREE.MathUtils.clamp(-p.balance*5-p.balanceVel*.7,-1,1);
      const hold=grind && !released && v>79;
      const release=hold && v>94;
      const receiverRail=firstRail && f.level.rails.find(rail=>rail!==firstRail);
      const targetX=receiverRail?.closest(p.pos).point.x ?? 2;
      f.tick({grindHeld:true,grindPressed:frame===0,moveY:1,
        moveX:grind?correction:(p.state==='air' && Math.abs(p.pos.x-targetX)>.1?Math.sign(targetX-p.pos.x):0),
        jumpHeld:hold&&!release,jumpReleased:release});
      if(p.state==='grind') {
        if(!firstRail)firstRail=p.grindRail;
        else if(p.grindRail!==firstRail)receiver=true;
      }
      if(release)released=true;
      if(p.state==='air')airFrames++;
      if(p.grounded && p.state==='ride' && -p.pos.z>157)break;
      assert.ok(!p.isBailing && !['dead','gameover'].includes(p.state),`transfer failed at ${p.pos.toArray()} ${p.state}`);
    }
    assert.ok(released && receiver && airFrames>8,'did not charge, pop, catch second rail and fly');
    assert.ok(p.grounded && p.state==='ride' && -p.pos.z>157,`no landing ${p.pos.toArray()} ${p.state}`);
    return {landing:[+p.pos.x.toFixed(2),+p.pos.y.toFixed(2),+(-p.pos.z).toFixed(2)],airFrames};
  });

  check('Cathedral alternating cube shoulders are reachable from real support',()=>{
    const f=localSection(8),landings=[];
    for(let i=0;i<6;i++) {
      const near=39+i*12-4.79,y=Math.min(i+1,4)*2.4,oldY=Math.min(i,4)*2.4;
      const targetX=i%2?.65:-.65,x=i>0?-targetX:targetX;
      const result=jump(f,{x,y:oldY,v:near-4.2,
        ...(i>0?{steer:(_frame,p)=>({moveY:1,moveX:Math.abs(p.pos.x-targetX)>.1?Math.sign(targetX-p.pos.x):0})}:{})});
      landing(result,y,near,`cathedral shoulder ${i+1}`);landings.push(+result.v.toFixed(2));
    }
    return {landings};
  });

  for(const [index,centres,depth,count,exitV]of [[3,[35,44,53,62,71,80],7.18,6,85],
    [6,[36,47,58,69,80,91,102,113],7.18,8,121],
    [8,[39,51,63,75,87,99],9.58,6,109],[13,[34,45,56],7.18,3,64]])
    check(`Continuous charged cube climb with real terrace positioning: section ${index+1}`,()=>{
      const f=localSection(index),p=f.player,landings=[];
      const alternate=index===3 || index===8;
      const firstNear=centres[0]-depth/2;
      position(f,alternate?-.65:0,0,index===3?26.85:firstNear-4);
      for(let i=0;i<count;i++) {
        const near=centres[i]-depth/2,targetX=alternate?(i%2?.65:-.65):0;
        if(i>0)walkTo(f,p.pos.x,near-4);
        const top=index===8?Math.min(i+1,4)*2.4:index===6?[2.4,4.8,7.2,9.6,7.2,4.8,7.2,4.8][i]:(i+1)*2.4;
        landings.push(...precisionRun(f,null,[[targetX,top,near+.2]]));
      }
      walkTo(f,p.pos.x,centres[count-1]+depth/2-.24);
      landings.push(...precisionRun(f,null,[[p.pos.x,p.pos.y,exitV+.2]]));
      return {landings};
    });

  check('Actual ramp approaches conserve climb into both kicker gaps',()=>{
    const runs=[];
    for(const [index,start,low,releaseV,landingV,landingY]of [[9,128,0,139,151.5,1.4],[12,123,0,140,153,0]]) {
      const f=localSection(index),p=f.player;
      position(f,0,low,start,true,23);
      let frames=0;
      while(-p.pos.z<releaseV && frames++<180)f.tick({moveY:1,jumpHeld:true,jumpPressed:frames===1});
      const launchY=p.pos.y;
      f.tick({moveY:1,jumpReleased:true});
      assert.equal(p.state,'air','ramp charge did not launch');
      assert.ok(p.vVel>TUNING.ollieVelocity+1,'ramp climb did not contribute to pop');
      let peak=p.pos.y;
      for(let i=0;i<180 && p.state==='air';i++) {f.tick({moveY:1});peak=Math.max(peak,p.pos.y);}
      assert.ok(p.grounded && p.state==='ride' && !p.isBailing && -p.pos.z>=landingV && Math.abs(p.pos.y-landingY)<.1,
        `section ${index+1} kicker failed: ${p.pos.toArray()} ${p.state}`);
      runs.push({section:index+1,rise:+(peak-launchY).toFixed(2),landingV:+(-p.pos.z).toFixed(2)});
    }
    return {runs};
  });

  check('Walking into a puzzle void kills, then respawns at banked key state',()=>{
    const f=localSection(1),l=f.level,p=f.player;
    l.reset(true);
    const a=l.crates.find(c=>c.bang && c.groupIds?.includes(100));
    const b=l.crates.find(c=>c.bang && c.groupIds?.includes(101));
    l.triggerBang(a);
    const cp=l.checkpoints[0];l.activateCheckpoint(cp,0);
    position(f,8,0,41, false,9);
    let sawDeath=false,respawned=false;
    for(let frame=0;frame<360;frame++) {
      f.tick({moveY:sawDeath?0:1});
      if(p.state==='dead')sawDeath=true;
      if(sawDeath && p.state==='ride' && p.grounded && p.pos.distanceTo(cp.spawnPos)<.65){respawned=true;break;}
    }
    assert.ok(sawDeath && respawned,`death/respawn sequence absent: ${p.state} ${p.pos.toArray()}`);
    assert.ok(a.bangUsed && !b.bangUsed,'death changed banked puzzle state');
    return {respawn:p.pos.toArray().map(v=>+v.toFixed(2))};
  });

  check('Vert profiles provide continuous rideable floor, transition and coping',()=>{
    const checked=[];
    for(const [index,v,rise,flat,arc] of [[4,70,3.6,4,90],[9,88,3.2,5,70]]) {
      const f=localSection(index),p=f.player;
      for(const angle of [0,20,40,60,arc-1]) {
        const theta=angle*Math.PI/180;
        const x=flat+rise*Math.sin(theta),y=rise*(1-Math.cos(theta));
        p.pos.set(x,y+.2,-v);const hit=p.queryGround(f.level);
        assert.ok(hit && Math.abs(hit.y-y)<.14,`section ${index+1} profile hole at ${angle}°: ${hit?.y} expected ${y}`);
        assert.ok(hit.vert,`section ${index+1} transition not tagged vert`);
      }
      checked.push(index+1);
    }
    return {sections:checked};
  });

  check('Pumped aqueduct wall launches into a coping grind and its raised exit rail',()=>{
    const f=localSection(4),p=f.player,l=f.level;
    const highRail=l.rails.find(rail=>{
      const first=rail.pointAt(0);
      return Math.abs(first.x-7.6)<.05 && Math.abs(first.y-3.72)<.03;
    });
    assert.ok(highRail,'authored high coping rail missing');
    const attempts=[];
    for(const [startV,angle]of [[82,55],[80,45],[86,65],[75,35],[88,75],[80,65]]) {
      l.reset(true);position(f,0,0,startV,true,23);
      const a=angle*Math.PI/180;
      p.axisF.set(Math.sin(a),0,-Math.cos(a));p.axisL.set(p.axisF.z,0,-p.axisF.x);
      let transition=false,vertAir=false,airFrames=0,coping=false,high=false,released=false,launchY=0,peak=0;
      for(let frame=0;frame<900;frame++) {
        const isGrind=p.state==='grind';
        const release=!released && p.groundHit?.normal.y<.6;
        const control=THREE.MathUtils.clamp(-p.balance*5-p.balanceVel*.7,-1,1);
        f.tick({moveX:isGrind?control:Math.sin(a),moveY:isGrind?1:Math.cos(a),
          jumpHeld:!released && !release,jumpPressed:frame===0,jumpReleased:release,
          grindHeld:vertAir && airFrames>5});
        if(release)released=true;
        if(p.groundHit?.vert && p.groundHit.normal.y<.8)transition=true;
        if(p.vertAir || p.pipeHang){if(!vertAir)launchY=p.pos.y;vertAir=true;airFrames++;peak=Math.max(peak,p.pos.y);}
        if(p.state==='grind'){coping=true;if(p.grindRail===highRail)high=true;}
        if(high && p.grounded && p.state==='ride' && -p.pos.z>156)break;
        if(p.isBailing || ['dead','gameover','finished'].includes(p.state))break;
      }
      const result={startV,angle,transition,vertAir,coping,high,airFrames,vertRise:+(peak-launchY).toFixed(2),
        end:[+p.pos.x.toFixed(2),+p.pos.y.toFixed(2),+(-p.pos.z).toFixed(2),p.state]};
      attempts.push(result);
      if(transition && vertAir && coping && high && p.grounded && p.state==='ride' && -p.pos.z>156)
        return {successfulApproach:result};
    }
    assert.fail(JSON.stringify(attempts));
  });

  check('Ice run-up preserves speed; dry island brakes; second ice launches across its gap',()=>{
    const f=localSection(2),p=f.player;
    position(f,-3,0,40,true,23);
    let minimumIceSpeed=Infinity;
    for(let frame=0;frame<240 && -p.pos.z<94;frame++) {
      f.tick({moveY:1});
      if(-p.pos.z>46 && -p.pos.z<92)minimumIceSpeed=Math.min(minimumIceSpeed,p.speed);
    }
    assert.ok(minimumIceSpeed>21.5,`long ice coast lost speed: ${minimumIceSpeed}`);
    for(let frame=0;frame<180 && p.speed>.1;frame++)f.tick({grabHeld:true,grabPressed:frame===0});
    const brakeV=-p.pos.z;
    assert.ok(p.grounded && brakeV>=94 && brakeV<111 && Math.abs(p.speed)<.15,
      `dry island did not stop the board: ${[p.pos.x,p.pos.y,brakeV,p.speed,p.state]}`);
    for(let frame=0;frame<45;frame++)f.tick({});
    // Aim into the second patch's shared central lane before building speed.
    walkTo(f,0,-p.pos.z);
    let chargedFrames=0;
    while(-p.pos.z<144.3 && chargedFrames++<420)
      f.tick({moveY:1,jumpHeld:true,jumpPressed:chargedFrames===1});
    const takeoffSpeed=p.speed;
    f.tick({moveY:1,jumpReleased:true});
    assert.equal(p.state,'air');
    for(let frame=0;frame<120 && p.state==='air';frame++)f.tick({moveY:1});
    assert.ok(p.grounded && p.state==='ride' && !p.isBailing && -p.pos.z>=156.5,
      `continuous ice gap failed ${p.pos.toArray()} ${p.state} speed ${takeoffSpeed}; brakeV ${brakeV}`);
    return {minimumIceSpeed:+minimumIceSpeed.toFixed(2),brakeV:+brakeV.toFixed(2),takeoffSpeed:+takeoffSpeed.toFixed(2),landingV:+(-p.pos.z).toFixed(2)};
  });

  check('Finish gate changes the real player state',()=>{
    const {player:p,level:l,tick}=full;
    const gate=source.components.find(c=>c.t==='gate');
    p.pos.set(gate.p[0],gate.p[1]+.02,gate.p[2]+2);p.laneCursor.s=-1;p.settle(l);
    for(let i=0;i<60 && p.state!=='finished';i++)tick({moveY:1});
    assert.equal(p.state,'finished');
  });
  assert.equal(JSON.stringify(TUNING),tuningBefore,'level checks changed global movement tuning');
  console.log(JSON.stringify({evidence,failures},null,2));
  assert.equal(failures.length,0,failures.join('\n'));
  console.log('PASS Blockworks authored support, puzzle state, measured jumps, rail catches, vert profiles and finish');
} finally {
  for(const f of fixtures)f.level.dispose();
  await server.close();console.warn=warn;console.error=error;
}
