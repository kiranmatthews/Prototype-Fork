import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop = () => {};' + harness.slice(
  harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held'),
) + '\ninstallHeadlessDom();');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
const fixtures = [], evidence = [];
try {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const { CODEX_LAB_LEVEL: source, BLOCKWORKS_SECTIONS: sections } = await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const originalTuning = JSON.stringify(TUNING), dt = CONST.fixedStep;

  // Apply one rigid rotation to source-owned components. Movers are world-axis
  // boxes, so their dimensions and signed travel axis also rotate explicitly.
  const localData = (index, spawn) => {
    const s = sections[index], yaw = s.yaw * Math.PI / 180;
    const transform = (x,z) => [Math.cos(yaw)*x-Math.sin(yaw)*z, Math.sin(yaw)*x+Math.cos(yaw)*z];
    const components = source.components.filter(c => c.grp === 10+index && !['camnode','zone','gate'].includes(c.t)).map(c => {
      const d = structuredClone(c), [x,z] = transform(c.p[0]-s.start[0], c.p[2]-s.start[2]);
      d.p = [x,c.p[1],z];
      if(d.yaw!==undefined)d.yaw=(d.yaw-s.yaw+360)%360;
      if(['mover','pit'].includes(d.t) && s.yaw%180!==0)d.s=[d.s[2],d.s[1],d.s[0]];
      if(d.t==='mover' && d.axis!=='y') {
        const [ax,az]=transform(d.axis==='x'?1:0,d.axis==='x'?0:1);
        d.axis=Math.abs(ax)>.5?'x':'z';
        d.travelSign=(d.travelSign??1)*Math.sign(Math.abs(ax)>.5?ax:az);
      }
      if(d.pts)d.pts=d.pts.map(p=>{const [px,pz]=transform(p[0],p[1]);return [px,pz,...p.slice(2)];});
      return d;
    });
    components.push({t:'gate',p:[500,0,-500]});
    return {...source,name:`${s.name} mover traversal`,spawn,components};
  };
  const create = (index, spawn, initialTime) => {
    const data=localData(index,spawn),scene=new THREE.Scene();
    const level=new Level(scene,{id:'blockworks-mover-check',name:data.name,data});
    level.update(initialTime);level.update(0);scene.updateMatrixWorld(true);
    const player=new Player(scene);player.enterLevel('blockworks-mover-check');player.endlessDeaths=true;
    player.rawInput=makeInput();player.respawn(level,true);
    const carriedFrames=new Map(),launches=[];
    let maximumCarryError=0;
    const tick=overrides=>{
      const id=player.groundHit?.moverId;
      const planted=player.grounded && player.state==='ride' && id!==undefined &&
        player.walkVelocity.length()<.01 && Math.abs(player.speed)<.01 &&
        !overrides.moveX && !overrides.moveY && !overrides.jumpReleased;
      const before=player.pos.clone(),delta=id!==undefined?level.moverDelta(id).clone():null;
      player.step(dt,makeInput(overrides),level);
      if(planted && player.grounded && player.groundHit?.moverId===id) {
        maximumCarryError=Math.max(maximumCarryError,player.pos.clone().sub(before).distanceTo(delta));
        carriedFrames.set(id,(carriedFrames.get(id)??0)+1);
      }
      level.update(dt);
      assert.ok(!player.isBailing && !['dead','gameover'].includes(player.state),`mover run failed at ${player.pos.toArray()} (${player.state})`);
    };
    const f={data,level,player,tick,carriedFrames,launches,get maximumCarryError(){return maximumCarryError;}};
    fixtures.push(f);return f;
  };
  const status=f=>({time:+f.level.time.toFixed(3),position:f.player.pos.toArray().map(v=>+v.toFixed(3)),mover:f.player.groundHit?.moverId??null});
  const top=m=>m.mesh.position.y+m.mesh.geometry.parameters.height/2;
  const waitFor=(f,predicate,label)=>{
    for(let frame=0;frame<900 && !predicate();frame++)f.tick({});
    assert.ok(predicate(),`no safe phase reached for ${label}`);
  };
  const hopTo=(f,v,expectedMover,expectedY)=>{
    const {player:p,tick}=f;
    assert.ok(p.grounded,'jump begins without support');
    for(let frame=0;frame<26;frame++)tick({jumpHeld:true,jumpPressed:frame===0});
    tick({jumpReleased:true});
    assert.equal(p.state,'air','charged input failed to launch');
    assert.ok(Math.abs(p.vVel-TUNING.jumpVelocity)<1e-8,'mover changed the authored jump impulse');
    f.launches.push(p.vVel);
    for(let frame=0;frame<120 && p.state==='air';frame++)tick({moveY:Math.abs(v+p.pos.z)>.08?Math.sign(v+p.pos.z):0});
    assert.ok(p.grounded && p.state==='ride',`missed target v${v}: ${JSON.stringify(status(f))}`);
    assert.equal(p.groundHit?.moverId??null,expectedMover,`landed on wrong support at v${v}`);
    if(expectedY!==undefined)assert.ok(Math.abs(p.pos.y-expectedY)<.04,`incorrect arrival deck height ${p.pos.y}`);
    assert.ok(Math.abs(-p.pos.z-v)<.15,`missed intended landing centre v${v}`);
    return status(f);
  };
  const walkTo=(f,target)=>{
    const {player:p,tick}=f;
    for(let frame=0;frame<600 && Math.abs(target()+p.pos.z)>.1;frame++) {
      tick({moveY:Math.sign(target()+p.pos.z)*.2});
      assert.ok(p.grounded,'walking lost moving-platform support');
    }
    for(let frame=0;frame<30;frame++)tick({});
    assert.ok(Math.abs(target()+p.pos.z)<.15,'could not position on moving platform');
  };

  for(const initialTime of [0,1.8,5.2]) {
    const f=create(8,[0,.02,-33.3],initialTime),{level:l,player:p}=f;
    assert.equal(l.movers.length,2,'two-lift source section missing one of its movers');
    const [a,b]=l.movers;
    for(const m of [a,b]) {
      assert.equal(m.amp,2.4);assert.equal(m.speed,.7);assert.equal(m.axisV.y,1);
      assert.equal(m.mesh.geometry.parameters.width,6);assert.equal(m.mesh.geometry.parameters.depth,6);
    }
    assert.ok(Math.abs(Math.cos(a.phase-b.phase)+1)<1e-8,'lifts are not in opposite phases');
    waitFor(f,()=>top(a)<.18,'lower boarding');
    const boardA=hopTo(f,38.5,0);
    walkTo(f,()=>42.6);
    waitFor(f,()=>top(a)>4.7 && top(b)<4.9,'lift-to-lift transfer');
    const boardB=hopTo(f,47.5,1);
    walkTo(f,()=>51.4);
    waitFor(f,()=>top(b)>9.5,'upper landing');
    const exit=hopTo(f,55.8,null,9.6);
    assert.ok((f.carriedFrames.get(0)??0)>20 && (f.carriedFrames.get(1)??0)>20,'did not ride both lifts');
    assert.ok(f.maximumCarryError<.002,`lift carry drift ${f.maximumCarryError}`);
    assert.equal(f.launches.length,3);
    evidence.push({challenge:'counterphase lifts',initialTime,boardA,boardB,exit,
      carriedFrames:Object.fromEntries(f.carriedFrames),maximumCarryError:f.maximumCarryError});
  }

  for(const initialTime of [0,2.4,7.5]) {
    const f=create(11,[0,7.22,-149.4],initialTime),{level:l,player:p}=f;
    assert.equal(l.movers.length,1,'gallery ferry source component missing');
    const ferry=l.movers[0];
    assert.equal(ferry.amp,9);assert.equal(ferry.speed,.65);
    assert.equal(ferry.axisV.z,-1,'westbound ferry axis/sign was not preserved');
    assert.equal(ferry.mesh.geometry.parameters.width,6);assert.equal(ferry.mesh.geometry.parameters.depth,8);
    waitFor(f,()=>-ferry.mesh.position.z<155.08,'ferry departure');
    const boarded=hopTo(f,155,0);
    // Walk relative to the moving deck, keeping the ordinary platform carry.
    walkTo(f,()=>-ferry.mesh.position.z+3.2);
    waitFor(f,()=>-ferry.mesh.position.z>172.8,'ferry arrival');
    const departurePosition=p.pos.clone();
    const exit=hopTo(f,178.8,null,7.2);
    assert.ok(-departurePosition.z>175.8,'jump bypassed the ferry ride');
    assert.ok((f.carriedFrames.get(0)??0)>20,'ferry never carried the rider');
    assert.ok(f.maximumCarryError<.002,`ferry carry drift ${f.maximumCarryError}`);
    evidence.push({challenge:'gallery ferry',initialTime,boarded,exit,
      carriedFrames:Object.fromEntries(f.carriedFrames),maximumCarryError:f.maximumCarryError});
  }
  assert.equal(JSON.stringify(TUNING),originalTuning,'mover tests changed movement tuning');
  console.log(JSON.stringify({evidence},null,2));
  console.log('PASS continuous source-authored lift boarding, carry, counterphase transfer, upper exit and ferry traversal at six entry times');
} finally {
  for(const f of fixtures)f.level.dispose();
  await server.close();console.warn=warn;console.error=error;
}
