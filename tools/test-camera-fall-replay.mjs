import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import {makeInput} from './jungle-cup-harness.mjs';
import { legacyCrateDimensionsPlugin } from './legacy-crate-envelope.mjs';
const replay = JSON.parse(await readFile(new URL('./fixtures/slipstream-camera/replay.json', import.meta.url), 'utf8'));
await withBlockworksRuntime(async r => {
  const { Replayer } = await r.server.ssrLoadModule('/src/replay.ts');
  const { CameraFallHold } = await r.server.ssrLoadModule('/src/cameraRig.ts');
  const replayer = new Replayer(), oldHold = new CameraFallHold(), fixedHold = new CameraFallHold(), input = {};
  // Death/recovery timing evolves independently of camera holding. Check the
  // actual final 40 airborne frames before each death, not old wall-clock offsets.
  const fatal = [], recent = [];
  const flights=[];let flight=null,lastGroundY=r.p.pos.y;
  let deaths = 0;
  const trajectory = createHash('sha256');
  replayer.begin(replay);
  try {
    for (let f = 0; f < replay.frames; f++) {
      replayer.feed(input, r.p.camDir); r.tick(input);
      const old = oldHold.shouldHold(r.p, r.l.killY);
      const state = JSON.stringify([r.p.pos.toArray(), r.p.speed, r.p.vVel, r.p.state, r.p.grounded]);
      const fixed = fixedHold.shouldHold(r.p, r.l.killY, () => r.p.cameraLandingAhead(r.l));
      assert.equal(JSON.stringify([r.p.pos.toArray(), r.p.speed, r.p.vVel, r.p.state, r.p.grounded]), state, 'camera query changed movement');
      trajectory.update(state);
      if(r.p.state==='air'){
        flight??={start:f,departureY:lastGroundY,old:0,fixed:0};
        flight.old+=+old;flight.fixed+=+fixed;
      }else if(flight){
        flights.push({...flight,end:f,landed:r.p.grounded,y:r.p.pos.y,state:r.p.state});flight=null;
      }
      if(r.p.grounded)lastGroundY=r.p.pos.y;
      if (r.p.totalDeaths > deaths) {
        const fall = recent.slice(-40);
        fatal.push({ frame: f, frames: fall.length, missed: fall.filter(row => !row.held).length });
        assert.ok(fall.every(row => row.state === 'air'), 'fatal window did not exercise a real fall');
        deaths = r.p.totalDeaths;
      }
      recent.push({ held: fixed, state: r.p.state });
      if (recent.length > 40) recent.shift();
    }
  } finally { replayer.end(); }
  // This historical recording no longer reaches the same shelves at the same
  // frames under the current controller. Test actual lower landings and fatal
  // flights, then reproduce the old false-freeze trigger in controlled drops.
  const recovered=flights.filter(x=>x.landed&&x.y<x.departureY-.3);
  assert.ok(recovered.length>0&&recovered.every(x=>x.fixed===0),'successful lower catches must stay live');
  assert.ok(fatal.every(x => x.frames === 40 && x.missed === 0), 'real fatal falls lost their hold');
  assert.ok(fatal.length>=4,'recording did not cover at least four deep fatal falls');
  const report = { frames: replay.frames, recovered, fatal, deaths: r.p.totalDeaths, trajectory: trajectory.digest('hex'),lowerCatches:[] };
  for(const yaw of [0,Math.PI/2,.65]){
    const heading=new r.THREE.Vector3(0,0,-1).applyAxisAngle(new r.THREE.Vector3(0,1,0),yaw);
    const centre=heading.clone().multiplyScalar(6);centre.y=3.5;
    const l=new r.Level(r.scene,{id:'lower-catch',name:'Lower catch',data:{v:1,name:'Lower catch',spawn:[0,10,0],killY:-20,
      components:[{t:'platform',p:centre.toArray(),s:[4,1,4],yaw,edgeGrinding:false},{t:'gate',p:[50,4,50]}]}});
    try{
      l.update(0);r.scene.updateMatrixWorld(true);
      const p=r.p;p.respawn(l,true,true,{position:new r.THREE.Vector3(0,10,0),heading});
      p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.airGrav='board';p.floatAir=false;
      p.vVel=-10;p.speed=p.lastPlanar=20;p.lastVelX=heading.x*20;p.lastVelZ=heading.z*20;
      p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.commitRenderStep(l);
      const legacy=new CameraFallHold(),current=new CameraFallHold();
      legacy.shouldHold(p,l.killY);current.shouldHold(p,l.killY,()=>p.cameraLandingAhead(l));
      let oldFrames=0,heldFrames=0,frames=0;
      while(!p.grounded&&frames<120){
        p.step(r.dt,makeInput(),l);l.update(r.dt);p.commitRenderStep(l);frames++;
        const state=JSON.stringify([p.pos.toArray(),p.speed,p.vVel,p.state,p.grounded]);
        oldFrames+=+legacy.shouldHold(p,l.killY);
        heldFrames+=+current.shouldHold(p,l.killY,()=>p.cameraLandingAhead(l));
        assert.equal(JSON.stringify([p.pos.toArray(),p.speed,p.vVel,p.state,p.grounded]),state);
      }
      const result={yaw,frames,oldFrames,heldFrames,landed:p.grounded,y:p.pos.y};report.lowerCatches.push(result);
      assert.ok(oldFrames>0,`controlled drop missed the false-freeze trigger: ${JSON.stringify(result)}`);
      assert.ok(p.grounded&&Math.abs(p.pos.y-4)<.02&&heldFrames===0,`lower catch was frozen or missed: ${JSON.stringify(result)}`);
    }finally{l.dispose();}
  }
  await writeFile(`${tmpdir()}/slipstream-fall-replay.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}, { vitePlugins: [legacyCrateDimensionsPlugin()], modulePath: '/tools/fixtures/slipstream-camera/original-course.ts', source: m => m.SLIPSTREAM_2_LEVEL,
  levelId: 'slipstream-2', endlessDeaths: true, maxFrames: 9000 });
