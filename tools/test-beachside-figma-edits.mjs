import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';

const edits=JSON.parse(await readFile(new URL('./fixtures/beachside-figma-edits.json',import.meta.url),'utf8'));
const dom=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
new Function('noop',dom.slice(dom.indexOf('function installHeadlessDom()'),dom.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn,error=console.error;
console.warn=(...a)=>{if(!/failed|already non-indexed/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
let level;
const near=(a,b,e,label)=>assert.ok(Math.abs(a-b)<=e,`${label}: ${a} != ${b}`);
const worldNode=(c,i)=>[c.p[0]+c.pts[i][0],c.p[1]+c.pts[i][3],c.p[2]+c.pts[i][1]];
try {
  const {Level}=await server.ssrLoadModule('/src/level.ts');
  const {BEACHFRONT_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/beachfront-run.ts');
  const paths=source.components.filter(c=>c.t==='woodpath');
  assert.equal(paths.length,7);
  for(let i=0;i<paths.length;i++){
    const c=paths[i],before=edits.originalBoardwalks[i],edit=edits.boardwalks.find(e=>e.sequence===i+1);
    const [[a,b,tx],[d,e,tz]]=edit?.matrixXZ??[[1,0,0],[0,1,0]];
    assert.equal(c.pts.length,before.pts.length);assert.deepEqual(c.widths,before.widths);
    assert.equal(c.seed,before.seed);assert.equal(c.scaffold,true);assert.equal(c.supports,true);assert.equal(c.rails,true);
    for(let j=0;j<c.pts.length;j++){
      const p=worldNode(before,j),q=worldNode(c,j);
      near(q[0],-(a*p[0]+b*p[2]+tx),.002,`boardwalk ${i+1} knot ${j} X`);
      near(q[2],d*p[0]+e*p[2]+tz,.002,`boardwalk ${i+1} knot ${j} Z`);
      if(j>=4&&j<=11)near(q[1],p[1],.011,`boardwalk ${i+1} deck height`);
    }
  }
  const crates=source.components.filter(c=>c.t==='crate');assert.equal(crates.length,16);
  for(let i=0;i<crates.length;i++){
    const id='K'+String(i+1).padStart(4,'0'),edit=edits.crates.find(e=>e.id===id);
    const target=edit?.targetXZ??[edits.originalCrates[i].p[0],edits.originalCrates[i].p[2]];
    near(crates[i].p[0],-target[0],.001,id+' X');near(crates[i].p[2],target[1],.001,id+' Z');
    assert.equal(crates[i].kind,edits.originalCrates[i].kind);
  }
  level=new Level(new THREE.Scene(),{id:'beachfront',name:'Beachside Run'});
  level.root.updateMatrixWorld(true);
  const ocean=level.water.group.getObjectByName('Unity curved shoreline ocean ribbon');
  assert.ok(ocean,'live shoreline ribbon');
  const oceanP=ocean.geometry.attributes.position,oceanI=ocean.geometry.index;
  const a=new THREE.Vector3().fromBufferAttribute(oceanP,oceanI.getX(0));
  const b=new THREE.Vector3().fromBufferAttribute(oceanP,oceanI.getX(1));
  const c=new THREE.Vector3().fromBufferAttribute(oceanP,oceanI.getX(2));
  assert.ok(b.sub(a).cross(c.sub(a)).y>0,'mirrored shoreline must face upward under back-face culling');
  assert.ok(level.capturedOceanSpec.shore.every(p=>p[2]>0),'sea points to course right');
  const {beachfrontPointAtDistance,beachfrontFrameAtDistance}=await server.ssrLoadModule('/src/beachfrontCourse.ts');
  for(const station of [20,200,400,700]){
    const p=beachfrontPointAtDistance(station,8.42),lane=beachfrontFrameAtDistance(station);
    assert.ok(-p[0] < -lane.x,'cliff lies on course left');
    assert.ok(level.walls.some(box=>box.containsPoint(new THREE.Vector3(-p[0],2,p[2]))),'mirrored cliff collision');
  }
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const floor=(x,z,meshes=level.groundMeshes)=>{ray.set(new THREE.Vector3(x,40,z),down);ray.far=80;const hits=ray.intersectObjects(meshes,false);assert.ok(hits.length,`No floor at ${x},${z}`);return hits[0].point.y;};
  const sand=level.groundMeshes.filter(m=>!m.userData.woodPathComp&&!m.userData.warpPad);
  for(let i=0;i<paths.length;i++)for(const j of [0,15]){
    const [x,y,z]=worldNode(paths[i],j);near(y-floor(x,z,sand),.18,.035,`boardwalk ${i+1} sand access ${j}`);
  }
  assert.equal(level.crates.length,16);
  for(let i=0;i<level.crates.length;i++){
    const c=level.crates[i],p=crates[i].p;
    near(c.box.getCenter(new THREE.Vector3()).x,p[0],.001,`live crate ${i+1} X`);
    near(c.box.getCenter(new THREE.Vector3()).z,p[2],.001,`live crate ${i+1} Z`);
    near(c.box.min.y,floor(p[0],p[2]),.085,`live crate ${i+1} floor`);
  }
  const fruit=source.components.filter(c=>c.t==='wumpa');
  assert.equal(fruit.length,84);assert.equal(level.pickups.length,84);
  for(let i=0;i<fruit.length;i++){
    const p=level.pickups[i].mesh.position;
    near(p.x,-edits.originalFruit[i][0],.001,`fruit ${i+1} mirrored X`);
    near(p.z,edits.originalFruit[i][2],.001,`fruit ${i+1} unchanged Z`);
    near(p.y-floor(p.x,p.z),.92,.04,`fruit ${i+1} floor clearance`);
  }
  const actualMarkers={START:level.spawnPos,FINISH:new THREE.Vector3(level.gateSpec.x,level.gateSpec.y,level.gateSpec.z),CRYSTAL:level.crystalPickup.group.position};
  for(const edit of edits.markers){const p=actualMarkers[edit.id];near(p.x,-edit.targetXZ[0],.001,edit.id+' X');near(p.z,edit.targetXZ[1],.001,edit.id+' Z');}
  near(level.spawnPos.y-floor(level.spawnPos.x,level.spawnPos.z),.14,.035,'supported spawn');
  const gate=actualMarkers.FINISH;assert.ok(level.finishBox.containsPoint(new THREE.Vector3(gate.x,gate.y+1,gate.z)),'new finish trigger');
  assert.ok(!level.finishBox.containsPoint(new THREE.Vector3(2.581,1,-699.567)),'old finish no longer triggers');
  const crystal=actualMarkers.CRYSTAL;assert.ok(crystal.y-floor(crystal.x,crystal.z)>1.7,'crystal clears new deck');
  const decks=level.groundMeshes.filter(m=>m.userData.woodPathComp);assert.equal(decks.length,7);let samples=0;
  for(const mesh of decks){const p=mesh.geometry.attributes.position;for(let i=4;i<p.count;i+=32){const q=new THREE.Vector3().fromBufferAttribute(p,i).add(new THREE.Vector3().fromBufferAttribute(p,i+1)).multiplyScalar(.5);near(floor(q.x,q.z),q.y,.05,'continuous supported deck');samples++;}}
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {CONST}=await server.ssrLoadModule('/src/tuning.ts');
  const player=new Player(level.scene);
  const input={moveX:0,moveY:0,consumeEdges(){}};
  for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','transferPressed','restartPressed'])input[key]=false;
  player.rawInput=input;player.endlessDeaths=true;player.respawn(level,true);
  for(let i=0;i<30;i++)player.step(CONST.fixedStep,input,level);
  assert.equal(player.grounded,true,'real Player supported at the moved/mirrored spawn');
  for(let checkpoint=0;checkpoint<4;checkpoint++){
    assert.equal(player.warpCheckpoint(level,1),true);
    for(let i=0;i<30;i++)player.step(CONST.fixedStep,input,level);
    assert.equal(player.grounded,true,`checkpoint ${checkpoint+1} landing`);
    assert.equal(level.checkpoints[checkpoint].active,true);
  }
  const checkpointSpawn=level.currentSpawn.clone();
  player.pos.y=level.killY-2;player.step(CONST.fixedStep,input,level);
  assert.equal(player.state,'dead','fall beneath the course is lethal');
  for(let i=0;i<600&&player.state==='dead';i++)player.step(CONST.fixedStep,input,level);
  assert.notEqual(player.state,'dead','pit death respawns');
  near(player.pos.x,checkpointSpawn.x,.03,'respawn checkpoint X');
  near(player.pos.z,checkpointSpawn.z,.03,'respawn checkpoint Z');
  let finished=false;player.onFinish=()=>{finished=true;};
  player.respawn(level,true,true);
  player.pos.set(gate.x,floor(gate.x,gate.z)+.1,gate.z);
  player.settle(level);
  for(let i=0;i<60&&!finished;i++)player.step(CONST.fixedStep,input,level);
  assert.equal(finished,true,'landing on the moved/mirrored finish pad completes the level');
  console.log(JSON.stringify({pass:true,playerLifecycle:true,boardwalks:7,movedBoardwalks:edits.boardwalks.length,movedCrates:edits.crates.length,markers:actualMarkers,deckSamples:samples,crateFloors:level.crates.map(c=>c.box.min.y)},null,2));
} finally {level?.dispose();console.warn=warn;console.error=error;await server.close();}
