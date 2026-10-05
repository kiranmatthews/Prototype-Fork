import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
const levels = [];
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
const angle = (a, b) => Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)) * 180 / Math.PI;
try {
  const { Level, newLaneCursor } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');

  const ts = (await import('typescript')).default;
  const dependencies = { THREE, newLaneCursor, Level };
  for(const name of ['tuning','cameraRig','loopCamera','cameraHeroFraming','cameraViews','cameraLook','cameraSpeedEffect','boss/camera','skateChaseCamera'])
    Object.assign(dependencies, await server.ssrLoadModule('/src/'+name+'.ts'));
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const begin=main.indexOf('const camTarget = new THREE.Vector3();');
  const end=main.indexOf('\ncamera.position\n  .copy(player.renderPosition)',begin);
  assert.ok(begin>=0&&end>begin,'production camera extraction points changed');
  const code = ts.transpileModule(main.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const makeRig=new Function('deps',`
    const {THREE,TUNING,newLaneCursor,cameraRigFraming,setCameraRigAim,CourseCameraHeading,fitCameraRigHorizontal,LoopCameraFraming,CameraHeroFraming,cameraViewAt,cameraViewDirection,CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,level,player,camera}=deps;
    const current={id:'slip'},worldMapController=null,oceanOverview=false,oceanReview=false,BOULDER_FOV=27,input={lookX:0,lookY:0};
    ${code}
    return {step:updateCamera,heading:camControlDir,cursor:cameraLaneCursor};`);
  const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  const entry=pack.levels.find(entry=>entry.id==='slip');
  const level=new Level(new THREE.Scene(),entry);levels.push(level);
  const pts=level.lanePts,arc=level.laneArc;
  const pointAt=s=>{let i=arc.findIndex(v=>v>s)-1;i=Math.max(0,i<0?pts.length-2:i);const a=pts[i],b=pts[i+1],t=(s-arc[i])/(arc[i+1]-arc[i]);return new THREE.Vector3(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);};

  let samples=0,legacyOutside=0,maximumAheadX=0,maximumHeroX=0,maximumInputError=0;
  const evidence=[];
  const finish=arc.at(-1)-15;
  for(const hz of [30,60])for(const aspect of [16/9,9/16])for(const speed of [9,23,48]){
    const player={renderPosition:pointAt(0),renderSnapVersion:1,grounded:true,speed,cameraSkateSpeed:speed,groundBelowY:0,swimming:false,balanceMeter:null};
    const camera=new THREE.PerspectiveCamera(dependencies.TUNING.camFov,aspect,.1,1800);
    const oldCamera=camera.clone();
    const rig=makeRig({...dependencies,level,player,camera}),oldRig=makeRig({...dependencies,level,player,camera:oldCamera});
    let outside=0,maxAhead=0,maxHero=0,maxInput=0;
    for(let s=0;s<finish;s+=speed/hz){
      player.renderPosition.copy(pointAt(s));player.groundBelowY=player.renderPosition.y;
      level.cameraLookAhead=undefined;oldRig.step(1/hz);oldCamera.updateMatrixWorld(true);
      level.cameraLookAhead=15;rig.step(1/hz);camera.updateMatrixWorld(true);
      const ahead=pointAt(s+15).project(camera),oldAhead=pointAt(s+15).project(oldCamera);
      if(Math.abs(oldAhead.x)>1)outside++;
      const error=angle(rig.heading,oldRig.heading);maxInput=Math.max(maxInput,error);
      assert.ok(error<.000001,'look-ahead changed the canonical input/replay direction');
      assert.ok(Math.abs(ahead.x)<1 && Math.abs(ahead.y)<1,JSON.stringify({reason:'upcoming course leaves the shot',hz,aspect,speed,s,ahead:ahead.toArray()}));
      assert.equal(camera.fov,oldCamera.fov,'anticipation changed the lens');
      assert.equal(camera.position.y,oldCamera.position.y,'anticipation changed vertical jump framing');
      const direction=camera.getWorldDirection(new THREE.Vector3()),oldDirection=oldCamera.getWorldDirection(new THREE.Vector3());
      assert.ok(Math.abs(direction.y-oldDirection.y)<1e-12,'anticipation changed pitch');
      // Horizontal rider envelope: preserve the shared vertical follow unchanged.
      for(const x of [-.7,.7])for(const y of [0,2.8])for(const z of [-.7,.7]){
        const hero=player.renderPosition.clone().add(new THREE.Vector3(x,y,z)).project(camera);
        maxHero=Math.max(maxHero,Math.abs(hero.x));
        assert.ok(Math.abs(hero.x)<1,JSON.stringify({hz,aspect,speed,s,hero:hero.toArray(),eye:camera.position.toArray()}));
      }
      maxAhead=Math.max(maxAhead,Math.abs(ahead.x));samples++;
    }
    legacyOutside+=outside;maximumAheadX=Math.max(maximumAheadX,maxAhead);maximumHeroX=Math.max(maximumHeroX,maxHero);maximumInputError=Math.max(maximumInputError,maxInput);
    evidence.push({hz,aspect,speed,oldOffscreenFrames:outside,maxHeroX:maxHero});
  }
  assert.ok(legacyOutside>0,'fixture does not reproduce the previous off-track view');
  const cursor=newLaneCursor(),target=new THREE.Vector3();
  assert.equal(level.cameraLanePointAhead(cursor,15,target),null);
  for(const side of [-5,0,5])for(const height of [0,8,20]){
    cursor.s=-1;
    for(let s=0;s<finish;s+=3){
      const p=pointAt(s),dir=level.cameraDirAt(...p.toArray(),cursor);
      p.x-=dir.z*side;p.z+=dir.x*side;p.y+=height;
      level.cameraDirAt(...p.toArray(),cursor);
      const before=cursor.s;
      const ahead=level.cameraLanePointAhead(cursor,15,target);
      assert.equal(cursor.s,before,'presentation sampling advanced the gameplay cursor');
      assert.ok(ahead.distanceTo(pointAt(before+15))<1e-6,'look-ahead selected a different corkscrew branch');
    }
  }
  cursor.s=0;
  assert.ok(level.cameraLanePointAhead(cursor,-15,target).distanceTo(pointAt(0))<1e-6);
  cursor.s=arc.at(-1);
  assert.ok(level.cameraLanePointAhead(cursor,15,target).distanceTo(pointAt(arc.at(-1)))<1e-6);

  // Real controller: charged final approach, release at the lip, and supported landing.
  level.root.updateMatrixWorld(true);
  const p=new Player(level.scene);p.enterLevel('slip');
  const start=pts.find(p=>p.z<-650);
  p.respawn(level,true,false,{position:new THREE.Vector3(start.x,start.y+.06,start.z)});
  const camera=new THREE.PerspectiveCamera(dependencies.TUNING.camFov,9/16,.1,1800);
  const rig=makeRig({...dependencies,level,player:p,camera});
  let released=false,air=false,landed=false,frame=0;
  for(;frame<1200&&!landed;frame++){
    const release=!released&&p.pos.z<=-735;
    let moveX=0,moveY=1;
    if(landed){
      const f=level.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,p.laneCursor);
      const dx=-p.pos.x,dz=level.finishZ-p.pos.z,n=Math.hypot(dx,dz);
      moveX=(dx*-f.z+dz*f.x)/n;moveY=(dx*f.x+dz*f.z)/n;
    }
    const input=makeInput({moveX,moveY,jumpHeld:!released&&!release,jumpPressed:frame===0,jumpReleased:release});
    if(release)released=true;
    p.step(1/60,input,level);level.update(1/60);p.commitRenderStep(level);rig.step(1/60);
    assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),JSON.stringify({frame,state:p.state,pos:p.pos.toArray(),speed:p.speed,bailing:p.isBailing,released}));
    if(released&&!p.grounded)air=true;
    if(air&&p.grounded&&p.pos.z<-756)landed=true;
  }
  assert.ok(landed,'charged final jump did not land');
  p.group.removeFromParent();
  console.log(JSON.stringify({samples,legacyOutside,maximumAheadX,maximumHeroX,maximumInputError,finalFrames:frame,finalPosition:p.pos.toArray(),evidence},null,2));
  console.log('PASS production Slipstream camera keeps the next bend visible and rider horizontally framed at foot/skate/perfect-grind speeds in portrait/landscape, with unchanged input/pitch/lens and a real finale jump/landing');
}finally{for(const level of levels)level.dispose();await server.close();console.warn=warn;console.error=error;}
