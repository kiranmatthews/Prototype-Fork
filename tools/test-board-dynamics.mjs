// Production discarded-board trajectories and CPU counters; no rendered/GPU work.
// --source-snapshot=/path --report compares a saved implementation without
// switching the user's checkout. Timings are descriptive, assertions are motion/resource contracts.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
const snapshot = process.argv.find(a => a.startsWith('--source-snapshot='))?.split('=').slice(1).join('=');
const reportOnly = process.argv.includes('--report');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: snapshot ? [{ name: 'board-source-snapshot', enforce: 'pre', async load(id) {
    const rel = path.relative(process.cwd(), id.split('?')[0]);
    if (rel === 'src/skateboard/discarded.ts') return readFile(path.join(snapshot, rel), 'utf8');
  } }] : [] });
const failures = [];
const check = (condition, description) => { if (!condition) failures.push(description); };
try {
  const { WorldSolids } = await server.ssrLoadModule('/src/worldSolids.ts');
  const { DiscardedBoards } = await server.ssrLoadModule('/src/skateboard/discarded.ts');
  const { buildSkateboardDeckGeometry } = await server.ssrLoadModule('/src/skateboard/model.ts');
  const { DEFAULT_SKATEBOARD_SETTINGS: settings } = await server.ssrLoadModule('/src/skateboard/settings.ts');
  const source = new THREE.Group();
  source.userData.gripTop = settings.boardToGroundDistance;
  source.userData.settings = settings;
  const deck = new THREE.Mesh(buildSkateboardDeckGeometry(settings), new THREE.MeshBasicMaterial());
  deck.name = 'Deck_ContinuousRoundedKick'; deck.position.y = settings.boardToGroundDistance; source.add(deck);
  const wheelGeometry = new THREE.CylinderGeometry(.055, .055, .06, 10), wheelMaterial = new THREE.MeshBasicMaterial();
  for (const x of [-.17, .17]) for (const z of [-.3, .3]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(x, .055, z); wheel.rotation.z = Math.PI/2; source.add(wheel);
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(240, 1, 240)); floor.position.y = -.5; floor.updateMatrixWorld(true);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(30, .2, 30)); roof.position.y = 1.4; roof.updateMatrixWorld(true);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(20, .2, 16)); ramp.rotation.x = -.25; ramp.position.set(0, 1.85, 0); ramp.updateMatrixWorld(true);
  const mildRamp = new THREE.Mesh(new THREE.BoxGeometry(60, .2, 60)); mildRamp.rotation.x = -.03; mildRamp.position.y = .9; mildRamp.updateMatrixWorld(true);
  const seamFloor = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 65)); seamFloor.position.set(55, -.5, -26); seamFloor.updateMatrixWorld(true);
  const wall = new THREE.Box3(new THREE.Vector3(-12, 0, -4.2), new THREE.Vector3(12, 4, -4));
  const cases = [
    { name:'wheel coast', position:[0,.008,0], velocity:[0,0,-12], angular:[0,0,0], ground:[floor] },
    { name:'sideways skid', position:[0,.008,0], velocity:[12,0,0], angular:[0,0,0], ground:[floor] },
    { name:'upside-down scrape', position:[0,.5,0], velocity:[0,0,-12], angular:[0,0,0], rotation:[0,0,Math.PI], ground:[floor] },
    { name:'fast tumbling throw', position:[0,1,0], velocity:[3,5,-22], angular:[7,15,5], ground:[floor] },
    { name:'under overhead deck', position:[0,.12,0], velocity:[0,0,-2], angular:[0,0,0], ground:[floor,roof] },
    { name:'ramp to flat', position:[0,3.8,5], velocity:[0,0,-6], angular:[0,0,0], ground:[floor,ramp] },
    { name:'gentle slope rest', position:[0,1.2,0], velocity:[2,0,-1], angular:[1,2,1], ground:[floor,mildRamp] },
    { name:'wall ricochet', position:[0,.8,0], velocity:[0,0,-24], angular:[4,7,2], ground:[floor], walls:[wall] },
    { name:'rotating nose at wall', position:[0,1,1.7], velocity:[0,0,-24], angular:[5,11,3], ground:[floor], walls:[wall] },
    { name:'overlapping nose at wall', position:[0,.8,-3.8], velocity:[0,0,-8], angular:[3,0,1], ground:[floor], walls:[wall] },
    { name:'landing on barrier top', position:[0,6,-4.1], velocity:[0,0,0], angular:[0,0,0], ground:[floor], walls:[wall] },
    { name:'snap fragments', position:[0,2,0], velocity:[2,3,-12], angular:[4,8,3], ground:[floor], random:.05 },
    { name:'folded deck', position:[0,2,0], velocity:[2,3,-12], angular:[4,8,3], ground:[floor], random:.2 },
  ];
  const rows=[];
  function run(spec, dt=1/60, warmup=false) {
    const pile=new DiscardedBoards(()=>spec.random??.9);
    source.position.fromArray(spec.position); source.rotation.set(...(spec.rotation??[0,0,0]));
    const board=pile.spawn(source);board.velocity.fromArray(spec.velocity);board.angular.fromArray(spec.angular);
    const events=[];let age=0,settle=null,lastSpeed=0,maxHeight=board.root.position.y,minZ=0,maxHop=0,lastY=board.root.position.y;
    let maxStoppedSpeed=0,raycasts=0,postSleepRaycasts=0,postSleepMotion=0;
    const world={groundMeshes:spec.ground,walls:spec.walls??[],crumbles:[],killY:-20};
    const solidWalls=[];
    if(spec.useWorldSolids){
      world.worldSolids=new WorldSolids();
      for(const mesh of world.groundMeshes)world.worldSolids.add(mesh);
      for(const bounds of world.walls){
        const size=bounds.getSize(new THREE.Vector3()),mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z));
        bounds.getCenter(mesh.position);mesh.updateMatrixWorld(true);
        world.worldSolids.add(mesh);solidWalls.push(mesh);
      }
    }
    const originals=world.groundMeshes.map(mesh=>mesh.raycast);
    world.groundMeshes.forEach((mesh,i)=>mesh.raycast=function(...args){raycasts++; if(settle!==null)postSleepRaycasts++;return originals[i].apply(this,args);});
    pile.onImpact=(broken,speed)=>events.push({age:+age.toFixed(4),broken,speed});
    const lastPosition=new THREE.Vector3(); const frameMs=[];
    try {
      for(let i=0;i<Math.round(14/dt);i++) {
        age=i*dt;lastSpeed=board.velocity.length();lastPosition.copy(board.root.position);
        const t=performance.now();pile.update(dt,world);frameMs.push(performance.now()-t);
        maxHeight=Math.max(maxHeight,board.root.position.y);minZ=Math.min(minZ,board.root.position.z);
        maxHop=Math.max(maxHop,board.root.position.y-lastY);lastY=board.root.position.y;
        if(settle!==null)postSleepMotion=Math.max(postSleepMotion,lastPosition.distanceTo(board.root.position));
        if(!warmup)check([...board.root.position.toArray(),...board.root.quaternion.toArray(),...board.velocity.toArray()].every(Number.isFinite),`${spec.name}: finite motion`);
        if(pile.diagnostics.active===0&&settle===null){settle=age;maxStoppedSpeed=lastSpeed;}
      }
    }finally{world.groundMeshes.forEach((mesh,i)=>mesh.raycast=originals[i]);}
    const row={name:spec.name,dt,settle,position:board.root.position.toArray(),maxHeight,minZ,maxHop,maxStoppedSpeed,events,raycasts,postSleepRaycasts,postSleepMotion,
      cpuMs:frameMs.reduce((a,b)=>a+b,0),pile:pile.diagnostics};
    pile.dispose();
    world.worldSolids?.dispose();
    for(const mesh of solidWalls){mesh.geometry.dispose();mesh.material.dispose();}
    if(!warmup){
      check(settle!==null&&settle<12,`${spec.name}: settled within 12s`);
      check(row.pile.lost===0,`${spec.name}: settled rather than being culled`);
      check(postSleepRaycasts===0&&postSleepMotion===0,`${spec.name}: sleeping board did no collision/motion work`);
      check(events.length<=10,`${spec.name}: impact sounds bounded`);
      check(events.every((event,i)=>i===0||event.age-events[i-1].age>=.055-1e-4),`${spec.name}: contact sounds rate limited`);
      check(events.every(event=>event.age<(settle??Infinity)),`${spec.name}: no sounds after rest`);
      if(spec.random===undefined)check(maxStoppedSpeed<.25,`${spec.name}: stopped gradually rather than freezing in motion`);
      if(spec.name==='under overhead deck')check(maxHeight<.4,`${spec.name}: did not teleport onto overhead platform`);
      if(spec.walls&&spec.name!=='landing on barrier top')check(minZ> -4.05,`${spec.name}: board did not cross wall`);
      if(spec.name==='wheel coast'||spec.name==='sideways skid')check(events.length===0,`${spec.name}: quiet ground contact`);
      if(spec.name==='landing on barrier top')check(row.position[1]>3.99&&row.position[1]<4.1,`${spec.name}: supported by actual wall top`);
      if(spec.quietStraight){check(events.length===0,'solid floor diagonal has no impact sounds');check(Math.abs(row.position[0]-spec.position[0])<.001,'solid floor diagonal does not deflect a rolling board');check(spec.position[2]-row.position[2]>30,'solid floor seam preserves the rolling distance');}
      if(spec.name==='ramp to flat')check(row.position[2]< -7,`${spec.name}: traversed downhill ramp`);
    }
    return row;
  }
  for(let i=0;i<4;i++)run(cases[3],1/60,true);
  for(const spec of cases)rows.push(run(spec));
  rows.push(run({name:'quiet solid floor diagonal',position:[54.5,.008,-12],velocity:[0,0,-12],angular:[0,0,0],ground:[seamFloor],useWorldSolids:true,quietStraight:true}));
  // The merged production world supplies swept mesh contacts, while small
  // review worlds still use wall boxes. Verify the new tumbling solver in both.
  for(const spec of cases.filter(c=>c.walls&&c.name!=='landing on barrier top'))
    for(const dt of [1/30,1/60,1/120])rows.push(run({...spec,name:`solid world ${spec.name}`,useWorldSolids:true},dt));
  check(Math.abs(rows[0].position[2])>Math.abs(rows[1].position[0])*2,'wheels coast further than sideways skid');
  check(rows[0].settle>1&&rows[1].settle> .3,'finite friction, not immediate sleep');
  const rates=[1/30,1/120].map(dt=>run(cases[3],dt));
  for(const row of rates){
    check(Math.abs(row.settle-rows[3].settle)<1,`throw at ${1/row.dt} Hz: similar settle time`);
    check(new THREE.Vector3().fromArray(row.position).distanceTo(new THREE.Vector3().fromArray(rows[3].position))<6,`throw at ${1/row.dt} Hz: stable trajectory`);
  }
  const varied=[];
  for(let i=0;i<36;i++){
    const spec={name:`varied toss ${i}`,position:[0,.4+(i%5)*.6,0],velocity:[Math.sin(i*2.3)*5,2+i%7,-8-(i%8)*2],
      angular:[Math.sin(i)*13,Math.cos(i*.7)*17,Math.sin(i*.3)*12],rotation:[i*.7,i*.3,i*.4],ground:[floor],random:i%7===0?.05:i%7===1?.2:.9};
    const row=run(spec);varied.push({name:row.name,settle:row.settle,sounds:row.events.length,position:row.position});
  }
  const supportChanges=[];
  for(const kind of ['moving support','falling crumble']){
    const support=new THREE.Mesh(new THREE.BoxGeometry(8,1,8));support.position.set(kind==='moving support'?20:0,kind==='moving support'?-.5:1.5,0);
    support.userData.crumbleId=0;support.updateMatrixWorld(true);
    const world={groundMeshes:kind==='moving support'?[support]:[support,floor],crumbles:[{state:'idle'}],killY:-20};
    source.position.set(0,4,0);source.rotation.set(0,0,0);const pile=new DiscardedBoards(()=>.9),board=pile.spawn(source);
    for(let i=0;i<360;i++){
      if(i===8){if(kind==='moving support'){support.position.x=0;support.updateMatrixWorld(true);}else world.crumbles[0].state='fall';}
      pile.update(1/60,world);
    }
    check(board.rest&&pile.diagnostics.settledPieces===1&&board.root.position.y<.05,`${kind}: fresh ground candidates/state`);
    supportChanges.push({kind,position:board.root.position.toArray(),...pile.diagnostics});pile.dispose();support.geometry.dispose();support.material.dispose();
  }
  // Production-size broadphase: many remote meshes, one local floor. Resting
  // piles must make zero narrow-phase calls, irrespective of pile size.
  const meshes=[floor];for(let i=0;i<600;i++){
    const mesh=new THREE.Mesh(floor.geometry);mesh.position.set(350+(i%30)*250,0,350+Math.floor(i/30)*250);mesh.updateMatrixWorld(true);meshes.push(mesh);
  }
  const perf=new DiscardedBoards(()=>.9);let narrowPhase=0;const originals=meshes.map(m=>m.raycast);
  meshes.forEach((m,i)=>m.raycast=function(...args){narrowPhase++;return originals[i].apply(this,args);});
  const world={groundMeshes:meshes,crumbles:[],killY:-30};source.rotation.set(0,0,0);source.position.set(0,2,0);
  for(let i=0;i<40;i++){const b=perf.spawn(source);b.velocity.set(2,4,-12);b.angular.set(4+i*.1,8,3);}
  const activeStart=performance.now();for(let i=0;i<720;i++)perf.update(1/60,world);const activeMs=performance.now()-activeStart;
  const count=narrowPhase,sleepStart=performance.now();for(let i=0;i<3600;i++)perf.update(1/60,world);const asleepMs=performance.now()-sleepStart;
  const performanceResult={boards:40,groundMeshes:meshes.length,seconds:12,activeMs,narrowPhase:count,asleepMs,asleepFrames:3600,asleepQueries:narrowPhase-count,pile:perf.diagnostics};
  check(count<60000,'remote geometry excluded before raycasts');check(narrowPhase===count,'sleeping pile has zero collision queries');check(perf.diagnostics.active===0,'large pile fully asleep');
  meshes.forEach((m,i)=>m.raycast=originals[i]);perf.dispose();
  console.log(JSON.stringify({implementation:snapshot?'before':'after',rows,rates,varied,supportChanges,performance:performanceResult,failures:[...new Set(failures)]},null,2));
  if(!reportOnly)assert.equal(failures.length,0,[...new Set(failures)].join('\n'));
}finally{await server.close();}
