import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {withSkateRuntime,makeInput} from '../jungle-cup-harness.mjs';
const bundle=await build({entryPoints:['src/levels/desert-canyon.ts'],bundle:true,format:'esm',platform:'node',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const data=m.DESERT_CANYON_LEVEL;
await withSkateRuntime(async({level,player:p,THREE,server,step})=>{
  const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
  assert.ok(normalizeCustomLevelData(data),'Canyon must pass the editor/import contract');
  assert.equal(data.components.filter(c=>c.t==='gate').length,1);
  assert.ok(m.DESERT_LENGTH>3300,'Expanded descent must be substantially longer than the original 1,392 m');
  assert.ok(m.DESERT_CANYON_START>650&&m.DESERT_LENGTH-m.DESERT_CANYON_END>1200,'Both ends must gain meaningful distance');
  assert.equal(data.components.filter(c=>c.t==='woodpath').length,3,'Opening takeoff, landing and lower bridge must use actual timber decks');
  console.log('Canyon runtime constructed; probing authored support');
  const trail=level.groundMeshes.filter(o=>data.components[o.userData.editorIdx]?.grp===1).map(mesh=>({mesh,bounds:new THREE.Box3().setFromObject(mesh)}));
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let probes=0;
  for(let s=2;s<m.DESERT_LENGTH-2;s+=2){
    if(m.DESERT_GAPS.some(g=>s>g.from-3&&s<g.to+4))continue;
    for(const u of [-m.desertWidth(s)*.36,0,m.desertWidth(s)*.36]){
      const q=m.desertPoint(s,u);ray.set(new THREE.Vector3(q[0],q[1]+2,q[2]),down);ray.far=4;
      const nearby=trail.filter(({bounds:b})=>q[0]>=b.min.x-.01&&q[0]<=b.max.x+.01&&q[2]>=b.min.z-.01&&q[2]<=b.max.z+.01).map(o=>o.mesh);
      const hit=ray.intersectObjects(nearby,false)[0];assert.ok(hit,`Trail support missing at ${s}, ${u}`);
      assert.ok(Math.abs(hit.point.y-q[1])<.3,`Broken trail seam at ${s}, ${u}`);probes++;
    }
  }
  p.competitionMode=false;
  for(const s of m.DESERT_CHECKPOINTS){
    const q=new THREE.Vector3(...m.desertPoint(s,2.7)),heading=new THREE.Vector3(...m.desertPoint(s+2,2.7)).sub(q).setY(0).normalize();q.y+=.4;
    p.respawn(level,true,false,{position:q,heading});
    for(let i=0;i<60;i++)step(makeInput());
    assert.ok(p.grounded&&!p.isBailing&&!['dead','gameover'].includes(p.state),`Unsupported checkpoint ${s}`);
  }
  const steer=(s,pace=1)=>{
    const q=m.desertPoint(s),dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,d=Math.hypot(dx,dz)||1;
    const cf=p.raceInputBasis(level);
    return {moveX:(-dx*cf.z+dz*cf.x)/d*pace,moveY:(dx*cf.x+dz*cf.z)/d*pace};
  };
  const launch=new THREE.Vector3(...m.desertPoint(6));launch.y+=.4;
  p.respawn(level,true,false,{position:launch,heading:new THREE.Vector3(...m.desertPoint(8)).sub(launch).setY(0).normalize()});
  let progress=6,wasJumping=false,routeFrames=0,lastProgress=6,stuck=0;
  const airborneGaps=new Set();
  for(;routeFrames<42000&&p.state!=='finished';routeFrames++){
    let best=Infinity,at=progress;
    for(let s=Math.max(0,progress-10);s<Math.min(m.DESERT_LENGTH,progress+25);s++){
      const q=m.desertPoint(s),d=(q[0]-p.pos.x)**2+(q[2]-p.pos.z)**2;if(d<best){best=d;at=s;}
    }
    progress=at;const jumping=m.DESERT_GAPS.some(g=>at>g.chargeFrom&&at<g.releaseAt);
    step(makeInput({...steer(at+12,.8),jumpHeld:jumping,jumpPressed:jumping&&!wasJumping,jumpReleased:!jumping&&wasJumping,grabHeld:p.speed>(at>m.DESERT_CANYON_START+95&&at<m.DESERT_CANYON_START+900?12:20)&&at>90}));wasJumping=jumping;
    for(const gap of m.DESERT_GAPS)if(at>gap.from&&at<gap.to&&!p.grounded)airborneGaps.add(gap.name);
    assert.ok(!['dead','gameover'].includes(p.state),`Descent death at ${at}: ${p.pos.toArray()}`);
    stuck=Math.abs(progress-lastProgress)<1?stuck+1:0;lastProgress=progress;
    assert.ok(stuck<300,`Pilot stalled: ${JSON.stringify({progress,position:p.pos.toArray(),freeSkate:p.freeSkate,speed:p.speed,input:steer(at+6),basis:p.raceInputBasis(level),axis:p.axisF.toArray(),bailing:p.isBailing,ground:p.groundHit?.name})}`);
    if(at>60&&at<100)assert.ok(p.state!=='hang'&&!p.isBailing,'Boardwalk jump must clear the landing without a ledge catch or bail');
    if(routeFrames%1200===0)console.log(JSON.stringify({routeFrames,progress,position:p.pos.toArray(),state:p.state}));
  }
  assert.equal(p.state,'finished',`Continuous descent stalled at ${progress}: ${p.pos.toArray()}`);
  assert.equal(airborneGaps.size,m.DESERT_GAPS.length,'Both opening jumps must be crossed airborne');
  const end=m.DESERT_LENGTH-35,start=new THREE.Vector3(...m.desertPoint(end));start.y+=.3;
  p.respawn(level,true,false,{position:start,heading:new THREE.Vector3(...m.desertPoint(end+2)).sub(start).setY(0).normalize()});
  let finishFrames=0;for(;finishFrames<900&&p.state!=='finished';finishFrames++)step(makeInput(steer(m.DESERT_LENGTH-5)));
  assert.equal(p.state,'finished','Finish gate must be reachable with normal controls');
  const checkpoint=level.checkpoints[1];
  p.respawn(level,true,false,{position:checkpoint.spawnPos.clone().add(new THREE.Vector3(0,.2,0)),heading:new THREE.Vector3(0,0,-1)});
  step(makeInput({spinPressed:true,spinHeld:true}));
  assert.ok(checkpoint.active,'A normal spin must bank the checkpoint crate');
  const pit=m.desertPoint((m.DESERT_GAPS[0].from+m.DESERT_GAPS[0].to)/2);p.pos.set(pit[0],pit[1]-12,pit[2]);p.state='air';p.grounded=false;p.vVel=-1;
  for(let i=0;i<8&&p.state!=='dead';i++)step(makeInput());
  assert.equal(p.state,'dead','Opening pit must trigger native death');
  p.respawn(level);for(let i=0;i<60;i++)step(makeInput());
  assert.ok(p.grounded&&Math.hypot(p.pos.x-checkpoint.spawnPos.x,p.pos.z-checkpoint.spawnPos.z)<1,'Death must recover to the banked checkpoint');
  const materialApi=await server.ssrLoadModule('/src/desertMaterials.ts');
  const a=materialApi.createDesertMaterial('sandstone'),b=materialApi.createDesertMaterial('trail'),sa={...THREE.ShaderLib.standard,uniforms:{}},sb={...THREE.ShaderLib.standard,uniforms:{}};
  a.onBeforeCompile(sa);b.onBeforeCompile(sb);assert.equal(sa.uniforms.desertColour.value,sb.uniforms.desertColour.value);
  let releases=0;sa.uniforms.desertColour.value.addEventListener('dispose',()=>releases++);
  a.dispose();b.dispose();assert.equal(releases,0,'Live course retains the shared texture');
  level.dispose();assert.equal(releases,1,'Last material owner releases texture exactly once');
  console.log(JSON.stringify({supportProbes:probes,checkpoints:m.DESERT_CHECKPOINTS.length,routeFrames,finishFrames,checkpointBankAndPitRecovery:true,routeMetres:m.DESERT_LENGTH,upperExtension:m.DESERT_CANYON_START,lowerExtension:m.DESERT_LENGTH-m.DESERT_CANYON_END,airborneGaps:[...airborneGaps],materials:'shared mineral texture owners verified'}));
},{levelEntry:{id:'bryce-canyon',name:data.name,data}});
const manifest=JSON.parse(await readFile(new URL('../../public/desert-canyon/manifest.json',import.meta.url),'utf8'));
assert.ok(manifest.models.every(r=>r.triangles<=30000));
console.log('Bryce terrain, checkpoints, finish and native rock budgets pass');
