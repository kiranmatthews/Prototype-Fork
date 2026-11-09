import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {withSkateRuntime,makeInput} from '../jungle-cup-harness.mjs';
const bundle=await build({entryPoints:['src/levels/desert-canyon.ts'],bundle:true,format:'esm',platform:'node',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const data=m.DESERT_CANYON_LEVEL,fromVista=process.argv.includes('--vista-only');
const plants=JSON.parse(await readFile('public/desert-canyon/plants/manifest.json','utf8'));
const plantKinds=new Set(['canyonsaguaro','canyonpricklypear','canyonbarrel','canyondrygrass','canyondryweed']);
const planting=data.components.filter(c=>c.t==='decor'&&[30,31,61].includes(c.grp)&&c.dkind!=='deserttalus');
assert.ok(planting.length>1800,'The cactus habitat must extend throughout the course');
assert.ok(planting.every(c=>plantKinds.has(c.dkind)),'No tree, leafy shrub or previous green grass may remain in the canyon planting');
for(const kind of plantKinds)assert.ok(planting.some(c=>c.dkind===kind),`Missing desert species ${kind}`);
for(const asset of plants.assets){
  const bytes=await readFile('public/desert-canyon/plants/'+asset.file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,`Changed native sculpt ${asset.id}`);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString().trim());
  const primitives=json.meshes.flatMap(mesh=>mesh.primitives);
  const triangles=primitives.reduce((n,p)=>n+json.accessors[p.indices].count/3,0);
  assert.equal(triangles,asset.triangles);assert.ok(triangles<=12000,`Excessive plant budget ${asset.id}`);
  assert.ok(primitives.every(p=>p.attributes.NORMAL!==undefined),'Plant sculpt lost its authored normals');
  assert.ok(primitives.every(p=>p.attributes.COLOR_0!==undefined)||(json.materials[0].pbrMetallicRoughness?.baseColorTexture&&primitives.every(p=>p.attributes.TEXCOORD_0!==undefined)),'Plant sculpt lost its authored colour');
  assert.equal(json.materials.length,1,'Native instancing needs one shared plant material');
}
// Check full horizontal silhouettes against the riding corridor at overlapping
// elevations. Large cartoon arms must not conceal the usable road width.
const routeSamples=[];
for(let s=0;s<m.DESERT_LENGTH;s+=3)routeSamples.push({p:m.desertPoint(s),width:m.desertWidth(s)});
let plantClearance=Infinity;
for(const plant of planting){
  const radius=Math.hypot(plant.s[0],plant.s[2])*.5;
  for(const sample of routeSamples){
    if(plant.p[1]>sample.p[1]+2||plant.p[1]+plant.s[1]<sample.p[1]-1)continue;
    const clearance=Math.hypot(plant.p[0]-sample.p[0],plant.p[2]-sample.p[2])-radius-sample.width*.5;
    plantClearance=Math.min(plantClearance,clearance);
    assert.ok(clearance>=0,`${plant.dkind} intrudes into the riding corridor`);
  }
}
console.log(JSON.stringify({desertPlantInstances:planting.length,minimumPlantClearance:plantClearance,species:plants.assets.map(a=>({id:a.id,triangles:a.triangles})),allPreviousTreesAndShrubsReplaced:true}));
if(process.argv.includes('--plants-only'))process.exit(0);
assert.deepEqual(data.desertHeat,[],'Heat bands have been removed');
const vistaLength=m.DESERT_LENGTH-m.DESERT_VISTA_START;
assert.ok(vistaLength>1700,'The exposed rim must add a substantial chapter after the old finish');
assert.ok(m.desertPoint(m.DESERT_VISTA_START)[1]-m.desertPoint(m.DESERT_LENGTH)[1]>330,'The new chapter must keep descending');
let vistaProbes=0;
for(let s=m.DESERT_VISTA_START+250;s<m.DESERT_LENGTH-120;s+=80){
  const p=m.desertPoint(s),right=m.desertPoint(s,700),lip=m.desertPoint(s,75),left=m.desertPoint(s,-70);
  assert.ok(p[1]-m.desertGround(right[0],right[2])>200,`Missing vast right-hand drop at ${s}`);
  assert.ok(p[1]-m.desertGround(lip[0],lip[2])>30,`Right slope does not expose the valley at ${s}`);
  assert.ok(m.desertGround(left[0],left[2])-p[1]>10,`Missing uphill sandstone face at ${s}`);
  vistaProbes++;
}

await withSkateRuntime(async({level,player:p,THREE,server,step})=>{
  const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
  assert.ok(normalizeCustomLevelData(data),'Canyon must pass the editor/import contract');
  await level.jungleAssets.ready();
  level.root.updateMatrixWorld(true);level.prepareWorldSolids();
  assert.ok(level.groundMeshes.some(mesh=>mesh.userData.worldSolidProxy),'Native landscape assets must supply exact physical ground');
  assert.equal(data.components.filter(c=>c.t==='gate').length,1);
  assert.ok(m.DESERT_LENGTH>3300,'Expanded descent must be substantially longer than the original 1,392 m');
  assert.ok(m.DESERT_CANYON_START>650&&m.DESERT_LENGTH-m.DESERT_CANYON_END>1200,'Both ends must gain meaningful distance');
  assert.equal(data.components.filter(c=>c.t==='woodpath').length,3,'Opening takeoff, landing and lower bridge must use actual timber decks');
  const lowerDrop=m.desertPoint(m.DESERT_CANYON_END)[1]-m.desertPoint(m.DESERT_LENGTH)[1];
  const finalDrop=m.desertPoint(m.DESERT_LENGTH-300)[1]-m.desertPoint(m.DESERT_LENGTH)[1];
  assert.ok(lowerDrop>380&&finalDrop>50,'The lower canyon and final approach must remain a substantial descent');
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
  const launchS=fromVista?m.DESERT_VISTA_START+20:6;
  const launch=new THREE.Vector3(...m.desertPoint(launchS));launch.y+=.4;
  p.respawn(level,true,false,{position:launch,heading:new THREE.Vector3(...m.desertPoint(launchS+2)).sub(launch).setY(0).normalize()});
  let progress=launchS,wasJumping=false,routeFrames=0,lastProgress=launchS,stuck=0;
  const airborneGaps=new Set();
  for(;routeFrames<60000&&p.state!=='finished';routeFrames++){
    let best=Infinity,at=progress;
    for(let s=Math.max(0,progress-10);s<Math.min(m.DESERT_LENGTH,progress+25);s++){
      const q=m.desertPoint(s),d=(q[0]-p.pos.x)**2+(q[2]-p.pos.z)**2;if(d<best){best=d;at=s;}
    }
    progress=at;const jumping=m.DESERT_GAPS.some(g=>at>g.chargeFrom&&at<g.releaseAt);
    step(makeInput({...steer(at+12,.8),jumpHeld:jumping,jumpPressed:jumping&&!wasJumping,jumpReleased:!jumping&&wasJumping,grabHeld:p.speed>(at>m.DESERT_CANYON_START+95?12:20)&&at>90}));wasJumping=jumping;
    for(const gap of m.DESERT_GAPS)if(at>gap.from&&at<gap.to&&!p.grounded)airborneGaps.add(gap.name);
    assert.ok(!['dead','gameover'].includes(p.state),`Descent death at ${at}: ${p.pos.toArray()}`);
    stuck=Math.abs(progress-lastProgress)<1?stuck+1:0;lastProgress=progress;
    assert.ok(stuck<300,`Pilot stalled: ${JSON.stringify({progress,position:p.pos.toArray(),freeSkate:p.freeSkate,speed:p.speed,input:steer(at+6),basis:p.raceInputBasis(level),axis:p.axisF.toArray(),bailing:p.isBailing,ground:p.groundHit?.name})}`);
    if(at>60&&at<100)assert.ok(p.state!=='hang'&&!p.isBailing,'Boardwalk jump must clear the landing without a ledge catch or bail');
    if(routeFrames%1200===0)console.log(JSON.stringify({routeFrames,progress,position:p.pos.toArray(),state:p.state}));
  }
  assert.equal(p.state,'finished',`Continuous descent stalled at ${progress}: ${p.pos.toArray()}`);
  assert.equal(airborneGaps.size,fromVista?0:m.DESERT_GAPS.length,'Both opening jumps must be crossed airborne in a full run');
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
  const vistaCheckpoint=level.checkpoints[15];
  p.respawn(level,true,false,{position:vistaCheckpoint.spawnPos.clone().add(new THREE.Vector3(0,.2,0)),heading:new THREE.Vector3(0,0,-1)});
  step(makeInput({spinPressed:true,spinHeld:true}));assert.ok(vistaCheckpoint.active,'The valley checkpoint must bank normally');
  // Cross a real road edge with native controls. No teleport/recovery shortcut
  // may masquerade as successful support on the visible shoulder.
  const shoulderS=m.DESERT_CHECKPOINTS[15]+25,shoulderStart=new THREE.Vector3(...m.desertPoint(shoulderS));shoulderStart.y+=.4;
  p.respawn(level,false,false,{position:shoulderStart,heading:new THREE.Vector3(0,0,-1)});
  for(let i=0;i<40;i++)step(makeInput());
  const shoulderTarget=m.desertPoint(shoulderS,12);let shoulderDistance=Infinity;
  for(let i=0;i<420;i++){
    const dx=shoulderTarget[0]-p.pos.x,dz=shoulderTarget[2]-p.pos.z,d=Math.hypot(dx,dz)||1,cf=p.raceInputBasis(level);
    shoulderDistance=Math.min(shoulderDistance,d);
    if(d<1.5)break;
    step(makeInput({moveX:(-dx*cf.z+dz*cf.x)/d*.7,moveY:(dx*cf.x+dz*cf.z)/d*.7}));
    assert.ok(!['dead','gameover'].includes(p.state),'Crossing the worn trail shoulder must not kill the rider');
    assert.ok(Math.hypot(p.pos.x-shoulderStart.x,p.pos.z-shoulderStart.z)<45,'Shoulder contact must not warp to a checkpoint');
  }
  assert.ok(shoulderDistance<1.5,`Visible shoulder must be freely reachable: ${shoulderDistance}`);
  // The user now wants the right-hand valley descent to be fatal. The
  // supported shoulder and the post-finish yellow-gem side remain reachable.
  const cliff=m.desertPoint(m.DESERT_CHECKPOINTS[15],120);
  p.respawn(level,false,false,{position:new THREE.Vector3(cliff[0],cliff[1]+2,cliff[2]),heading:new THREE.Vector3(0,0,-1)});
  p.state='air';p.grounded=false;p.vVel=-1;
  let landingFrames=0;
  for(;landingFrames<240&&p.state!=='dead';landingFrames++)step(makeInput());
  assert.equal(p.state,'dead','Descending the right-hand valley slope must kill the rider');
  p.respawn(level);for(let i=0;i<60;i++)step(makeInput());
  assert.ok(p.grounded&&p.pos.distanceTo(vistaCheckpoint.spawnPos)<1,`Valley death returns to the banked rim checkpoint: ${p.pos.toArray()} vs ${vistaCheckpoint.spawnPos.toArray()}`);
  const materialApi=await server.ssrLoadModule('/src/desertMaterials.ts');
  const a=materialApi.createDesertMaterial('sandstone'),b=materialApi.createDesertMaterial('trail'),sa={...THREE.ShaderLib.standard,uniforms:{}},sb={...THREE.ShaderLib.standard,uniforms:{}};
  a.onBeforeCompile(sa);b.onBeforeCompile(sb);assert.equal(sa.uniforms.desertColour.value,sb.uniforms.desertColour.value);
  let releases=0;sa.uniforms.desertColour.value.addEventListener('dispose',()=>releases++);
  a.dispose();b.dispose();assert.equal(releases,0,'Live course retains the shared texture');
  level.dispose();assert.equal(releases,1,'Last material owner releases texture exactly once');
  console.log(JSON.stringify({supportProbes:probes,fromVista,vistaProbes,vistaLength,freerideShoulder:true,valleyDeath:true,landingFrames,checkpoints:m.DESERT_CHECKPOINTS.length,routeFrames,finishFrames,checkpointBankAndPitRecovery:true,routeMetres:m.DESERT_LENGTH,upperExtension:m.DESERT_CANYON_START,lowerExtension:m.DESERT_LENGTH-m.DESERT_CANYON_END,lowerDrop,final300mDrop:finalDrop,airborneGaps:[...airborneGaps],materials:'shared mineral texture owners verified'}));
},{levelEntry:{id:'bryce-canyon',name:data.name,data},prepareRuntime(){
  globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
  globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
  const nativeFetch=globalThis.fetch;
  globalThis.self=globalThis;navigator.userAgent='Headless canyon validation';
  const NativeRequest=globalThis.Request;
  globalThis.Request=class extends NativeRequest{constructor(input,init){super(typeof input==='string'?new URL(input,'http://headless.invalid'):input,init);}};
  // Exercise the production GLTF loader, asset transforms and surface binding
  // against real native terrain files. Unrelated art remains headless.
  globalThis.fetch=async input=>{
    const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);
    const path=new URL(typeof input==='string'?input:input.url,'http://headless.invalid').pathname;
    return path.startsWith('/desert-canyon/')&&path.endsWith('.glb')?new Response(await readFile(new URL('../../public'+path,import.meta.url))):new Response('',{status:404});
  };
}});
const manifest=JSON.parse(await readFile(new URL('../../public/desert-canyon/manifest.json',import.meta.url),'utf8'));
assert.ok(manifest.models.every(r=>r.triangles<=30000));
console.log('Bryce terrain, checkpoints, finish and native rock budgets pass');

const vistaManifest=JSON.parse(await readFile(new URL('../../public/desert-canyon/vista/manifest.json',import.meta.url),'utf8'));
for(const model of vistaManifest.models){
  const bytes=await readFile(new URL('../../public/desert-canyon/vista/'+model.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256,model.file+' native geometry hash');
  assert.ok(model.triangles<=28000&&model.vertices>0,'Spatial cells retain bounded native geometry');
}
console.log(`Verified ${vistaManifest.models.length} complete native vista cells against their authored hashes`);
