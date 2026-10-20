import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {treehouseSurfaceCases} from './treehouse-surface-cases.mjs';

const reports=[];
await withBlockworksRuntime(async r=>{
  const {p,l,THREE}=r;
  assert.equal(r.source.startWarpPad,false,'Treehouse has its own supported balcony arrival');
  assert.ok(r.source.spawn[1]>8,'start on the treehouse balcony');
  assert.equal(l.startWarpPosition,null,'no automatic arrival pad');
  assert.equal(l.root.getObjectByName('level start warp pad'),undefined);
  const opening=r.source.components.find(c=>c.nm==='Camera-aligned timber halfpipe');
  assert.equal(opening.vkind,'half');
  const view=r.source.components.find(c=>c.nm?.startsWith('Original opening framing'));
  assert.equal(view.yaw??0,opening.yaw??0,'camera and halfpipe share the approach axis');
  assert.equal(view.cameraPosition[0],view.cameraTarget[0]);
  const route=r.source.components.filter(c=>c.t==='camnode'&&!c.cameraView);
  assert.deepEqual(route[0].p,r.source.spawn);
  assert.deepEqual(route.slice(1,5).map(c=>c.p[1]),[8.4,5.6,2.8,.12]);
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  assert.equal(normalizeCustomLevelData(l.captureData())?.startWarpPad,false,'arrival opt-out survives editor capture/import');
  const {treehouseTrialPoint}=await r.server.ssrLoadModule('/src/levels/treehouse-trials-continuity.ts');
  const cases=treehouseSurfaceCases(r.source,treehouseTrialPoint);
  for(const c of cases){
    const from=new THREE.Vector3(...c.start),to=new THREE.Vector3(...c.target),heading=to.clone().sub(from).setY(0).normalize();
    p.respawn(l,true,false,{position:from,heading});r.stepFor(2);
    let below=false,bailed=false,minY=p.pos.y,maxY=p.pos.y,furthest=0;const trace=[];
    for(let i=0;i<(c.maxFrames??300);i++){
      r.tick({...r.worldDirectionInput(heading,c.board?1:.6),jumpHeld:c.board});
      minY=Math.min(minY,p.pos.y);maxY=Math.max(maxY,p.pos.y);furthest=Math.max(furthest,p.pos.clone().sub(from).dot(heading));
      below ||= p.pos.y<c.floor;bailed ||= p.isBailing||p.totalDeaths>0;
      if(i%6===0||below||bailed)trace.push({...r.snapshot(),vert:p.groundHit?.vert,impact:p.worldImpactDiagnostics??null});
      if(below||bailed||(!c.pipe&&p.pos.clone().sub(to).dot(heading)>.5))break;
      if(c.pipe&&p.pos.y>c.crest+.2)break;
    }
    const reached=c.pipe?maxY>c.approachHeight:p.pos.clone().sub(to).dot(heading)>.5;
    const result={name:c.name,below,bailed,minY,maxY,furthest,reached,position:p.pos.toArray(),trace};reports.push(result);
    console.log(JSON.stringify({...result,trace:undefined}));
  }
  // The restored native path must still enforce the authored perimeter.
  // Probe the river and cavern sides, on foot and from an airborne board.
  let boundaries=0;
  for(const [center,y,z,half]of [[35,-14.65,-366,8.2],[57,-7.2,-531,9]])for(const side of [-1,1])for(const air of [0,5]){
    const x=center+side*(half-1.2),ray=new THREE.Raycaster(new THREE.Vector3(x,y+3,z),new THREE.Vector3(0,-1,0),0,7);
    const ground=ray.intersectObjects(l.groundMeshes,false)[0];assert.ok(ground,'boundary fixture has native ground');
    p.respawn(l,true,false,{position:new THREE.Vector3(x,ground.point.y+.03+air,z),heading:new THREE.Vector3(side,0,0)});
    if(air){p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=12;}
    for(let i=0;i<180;i++){
      r.tick({...r.worldDirectionInput([side,0,0],.8),jumpHeld:!!air});
      assert.ok(side*(p.pos.x-center)<half,'the restored native player must remain inside the Treehouse boundary');
      assert.equal(p.totalDeaths,0,'boundary probes must remain recoverable');
    }
    boundaries++;
  }
  console.log(`PASS ${boundaries} Treehouse river/cavern walking and airborne boundary probes.`);
},{modulePath:'/src/levels/treehouse-trail.ts',levelId:'treehouse-trail',source:m=>m.TREEHOUSE_TRAIL_LEVEL,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile(process.env.TREEHOUSE_SURFACE_REPORT??join(tmpdir(),'treehouse-surface-restoration.json'),JSON.stringify(reports,null,2));
assert.ok(reports.every(r=>!r.below&&!r.bailed),'walking and skating must retain supported ground');
assert.ok(reports.every(r=>r.reached),'cross the river and cavern pipe; climb both opening halfpipe transitions');
