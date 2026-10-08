import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Cross-component regressions: validate built collision, not copied coordinates.
const ids=['jungle','flats','sky','slip','dark','coastal-street-run','codex-lab','crate-primer','switchyard','clockwork-gauntlet','ghost-train'];
const reports=[];
await withBlockworksRuntime(async({server,Level,THREE})=>{
  const {BUILTIN_LEVELS}=await server.ssrLoadModule('/src/level.ts');
  const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
  for(const id of ids)for(const source of ['builtin','published']){
    const entry=(source==='builtin'?BUILTIN_LEVELS:pack.levels).find(e=>e.id===id);
    if(!entry)continue;
    const scene=new THREE.Scene(),level=new Level(scene,entry),label=`${id}/${source}`;
    level.update(0);scene.updateMatrixWorld(true);
    try{
      const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
      const ground=(x,y,z)=>{
        ray.set(new THREE.Vector3(x,y+1.6,z),down);ray.far=4;
        return ray.intersectObjects(level.groundMeshes,false).find(hit=>hit.face.normal.y>.25);
      };
      const supported=(p,tolerance=.35)=>{
        const hit=ground(...p);assert.ok(hit&&Math.abs(hit.point.y-p[1])<=tolerance,`${label} unsupported ${p}: ${hit?.point.y}`);
      };
      supported(level.spawnPos.toArray());
      if(['crate-primer','switchyard','clockwork-gauntlet'].includes(id)) {
        assert.equal(level.cameraAirLift,1,`${label} tall puzzle jumps need full vertical follow`);
        assert.ok(level.cameraRig?.camDist>=16,`${label} upper goals need a wide authored view`);
        const clock=level.clockPickup;
        assert.ok(clock&&clock.box.max.x<level.spawnPos.x-.53,`${label} trial clock blocks normal play`);
        supported([clock.group.position.x,clock.group.userData.baseY-1.35,clock.group.position.z]);
        const sideWalls=entry.data.components.filter(c=>c.nm==='Bonus alcove side boundary');
        assert.equal(sideWalls.length,2);
        assert.ok(sideWalls.every(c=>c.p[2]-c.s[2]/2>.6),`${label} bonus wall snags the straight route`);
      }
      let patrolSamples=0,railSamples=0,minRecovery=Infinity;
      for(const cp of level.checkpoints){
        supported(cp.spawnPos.toArray());
        for(const enemy of level.enemies){
          if(Math.abs(enemy.baseY-cp.spawnPos.y)>2)continue;
          const axis=enemy.axis==='z'?'z':'x',cross=axis==='x'?'z':'x';
          const along=Math.max(enemy.x0,Math.min(enemy.x1,cp.spawnPos[axis]));
          const distance=Math.hypot(cp.spawnPos[axis]-along,cp.spawnPos[cross]-enemy.group.position[cross]);
          minRecovery=Math.min(minRecovery,distance);
          assert.ok(distance>=4.75,`${label} checkpoint inside ${enemy.kind} patrol recovery space: ${distance}`);
        }
      }
      const enemies=level.enemies.filter(enemy=>id==='dark'||id==='coastal-street-run'||
        (id==='jungle'&&Math.abs(enemy.group.position.z+616)<.01));
      for(const enemy of enemies)for(let i=0;i<=32;i++){
        const p=enemy.group.position.toArray();p[enemy.axis==='z'?2:0]=enemy.x0+(enemy.x1-enemy.x0)*i/32;p[1]=enemy.baseY;
        supported(p,id==='jungle'?.3:.15);patrolSamples++;
      }
      for(const rail of level.rails){
        const component=entry.data?.components[rail.object.userData.editorIdx];
        if(!component||component.t!=='rail'||rail.coping)continue;
        for(let s=.25;s<rail.totalLength;s+=.5){
          const p=rail.pointAt(s),hit=ground(p.x,p.y,p.z);railSamples++;
          assert.ok(!hit||hit.point.y<=p.y+.15,`${label} rail ${component.nm??''} buried at ${p.toArray()}: ${hit?.object.name}`);
        }
      }
      if(id==='sky'){
        for(const cp of level.checkpoints)for(const dx of [-1.5,0,1.5])for(const dz of [-1.5,0,1.5])
          supported([cp.spawnPos.x+dx,.1,cp.spawnPos.z+dz]);
        // Load each rope almost to its break time; its deepest sag must still
        // clear the widened recovery decks and the original enemy platforms.
        for(let frame=0;frame<150;frame++){
          for(const rope of level.ropes)level.grindRope(rope.rail);
          level.update(1/60);
        }
        for(const rope of level.ropes)for(const p of rope.rail.points){
          const hit=ground(p.x,p.y,p.z);railSamples++;
          assert.ok(!hit||p.y-hit.point.y>.3,`${label} loaded rope clips a platform`);
        }
      }
      if(id==='switchyard'){
        const reward=level.crates.find(c=>Math.abs(c.mesh.position.x-221)<.01&&Math.abs(c.box.min.y-4)<.01);
        assert.ok(reward,'mastery reward must precede the finish pad');
        assert.ok(!level.finishBox.intersectsBox(reward.box),'reward intersects the finish trigger');
        supported([reward.mesh.position.x,reward.box.min.y,reward.mesh.position.z],.1);
      }
      if(id==='flats')assert.equal(level.checkpoints.length,2,'long practice course needs recoverable progress');
      reports.push({id,source,checkpoints:level.checkpoints.length,enemies:level.enemies.length,
        minCheckpointPatrolDistance:Number.isFinite(minRecovery)?+minRecovery.toFixed(2):null,patrolSamples,railSamples,
        ...(level.cameraRig?{cameraRig:level.cameraRig,cameraAirLift:level.cameraAirLift}:{})});
    }finally{level.dispose();}
  }
  for(const id of ['crate-primer','switchyard','clockwork-gauntlet']) {
    const published=pack.levels.find(e=>e.id===id),native=BUILTIN_LEVELS.find(e=>e.id===id);
    assert.deepEqual(published.data,native.data,`${id} published copy must include the source placement fixes`);
  }
},{source:()=>({v:1,name:'Placement fixture',spawn:[0,.1,0],killY:-20,components:[
  {t:'platform',p:[0,-.5,0],s:[4,1,4]},{t:'gate',p:[0,0,-1]}]})});
const reportPath=process.argv.find(arg=>arg.startsWith('--report='))?.slice(9);
if(reportPath)await writeFile(reportPath,JSON.stringify({pass:true,reports},null,2)+'\n');
console.log(JSON.stringify(reports));
console.log('PASS supported patrols, checkpoint recovery room, clear authored rails, loaded ropes, reward before finish and source/pack parity');
