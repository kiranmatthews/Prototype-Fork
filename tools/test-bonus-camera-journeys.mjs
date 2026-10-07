import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {withThemedBonusRuntime} from './test-themed-bonus-puzzles.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusJourney} from './themed-bonus-pilot.mjs';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});
const {THEMED_BONUS_COURSES}=await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
const ids=THEMED_BONUS_COURSES.map(c=>c.id);await server.close();
const results=[];
for(const id of ids)await withThemedBonusRuntime(id,async r=>{
 const {CameraViewFraming,cameraViewAt,BONUS_PRESENTATION_VIEW}=await r.server.ssrLoadModule('/src/cameraViews.ts');
 const {CameraPortraitFraming}=await r.server.ssrLoadModule('/src/cameraPortraitFraming.ts');
 const views=[16/9,4/3,390/844].map(aspect=>({aspect,camera:new r.THREE.PerspectiveCamera(49,aspect,.1,400),rig:new CameraViewFraming(),portrait:new CameraPortraitFraming(),snap:-1}));
 const commit=r.p.commitRenderStep.bind(r.p);let samples=0,minHead=1,maxFeet=-1;
 r.p.commitRenderStep=(...args)=>{
  commit(...args);const p=r.p;
  for(const v of views){
   v.portrait.restore(v.camera);v.rig.restore(v.camera);
   v.rig.apply(v.camera,cameraViewAt(r.l.cameraViews,p.pos.x,p.pos.y,p.pos.z)??BONUS_PRESENTATION_VIEW,p.pos,v.snap!==p.renderSnapVersion,
    {groundY:p.groundBelowY!==null&&p.groundBelowY>r.l.killY?p.groundBelowY:null,grounded:p.grounded,dt:1/60});
   v.snap=p.renderSnapVersion;v.portrait.apply(v.camera,v.aspect<1);v.camera.updateMatrixWorld(true);
   const feet=p.pos.clone().project(v.camera),head=p.pos.clone().add(new r.THREE.Vector3(0,2.5,0)).project(v.camera);
   assert.ok(Math.abs(feet.x)<.96&&Math.abs(head.x)<.96,`${id} actor leaves horizontal frame at ${p.pos.toArray()} (${v.aspect})`);
   assert.ok(feet.y>-.92&&head.y<.8,`${id} actor intersects HUD or frame at ${p.pos.toArray()}: ${feet.y},${head.y}`);
   if(v.aspect===16/9){const size=(head.y-feet.y)/2;assert.ok(size>.18&&size<.30,`${id} unreadable hero scale ${size}`);}
   samples++;minHead=Math.min(minHead,head.y);maxFeet=Math.max(maxFeet,feet.y);
  }
 };
 const report=runInputPilot(r,runThemedBonusJourney);
 assert.equal(report.state,'finished');assert.equal(report.deaths,0);assert.equal(report.result.cratesBroken,report.result.totalCrates);
 results.push({id,frames:report.frames,samples,crates:report.result.totalCrates,deaths:report.deaths,minHead,maxFeet});
 console.log(`PASS ${id}: ${samples} framed poses, ${report.result.totalCrates} boxes, real finish`);
});
await writeFile('/private/tmp/bonus-camera-journeys.json',JSON.stringify(results,null,2));
console.log(`PASS ${results.length} complete bonus courses at 16:9, 4:3 and portrait`);
