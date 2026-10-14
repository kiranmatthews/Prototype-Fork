import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runPrimer} from './puzzle-primer-pilot.mjs';
import {runSwitchyardJourney} from './puzzle-switchyard-pilot.mjs';
import {runClockworkJourney} from './puzzle-clockwork-pilot.mjs';

const pilots={'crate-primer':runPrimer,switchyard:runSwitchyardJourney,'clockwork-gauntlet':runClockworkJourney};
const replacements=[['jungle','crate-primer'],['beachside-run','switchyard'],['coastal','clockwork-gauntlet']];
const reports=[];
for(const [key,donorId] of replacements.filter(([key])=>!process.argv.includes('--id=coastal')||key==='coastal')){
  await withBlockworksRuntime(async r=>{
    const {PUZZLE_LAYOUTS,PUZZLE_LEVELS}=await r.server.ssrLoadModule('/src/levels/puzzle-trilogy.ts');
    const {findLevel,levelList,getUserLevels,setUserLevels}=await r.server.ssrLoadModule('/src/level.ts');
    const {resolveBonusLevel,bonusCrateCount}=r.sourceModule;
    const course=r.sourceModule.THEMED_BONUS_COURSES.find(c=>c.progressKey===key);
    assert.equal(course.layout,donorId);
    assert.equal(findLevel(course.id).data,resolveBonusLevel(course.parentId));
    assert.equal(r.l.totalCrates,bonusCrateCount(course.parentId));
    assert.equal(r.l.bonusCrateTotal,0);
    assert.equal(r.l.bonusPlatform,null);
    assert.equal(r.l.clockPickup,null);
    assert.equal(r.l.crystalPickup,null);
    assert.equal(r.l.cameraViews.length,1);
    assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
    const raw=PUZZLE_LAYOUTS[donorId];
    const geometry=c=>Object.fromEntries(Object.entries(c).filter(([k])=>!['t','color','tex','vertices','indices','uvs'].includes(k)));
    const expected=raw.components.filter(c=>c.grp!==5&&!['clock','zone','camnode'].includes(c.t));
    const actual=r.source.components.filter(c=>(c.grp??0)<90&&c.t!=='camnode');
    assert.equal(actual.length,expected.length,'scenery added or removed a gameplay component');
    for(const [i,c]of expected.entries()){
      assert.equal(actual[i].t,c.t==='platform'?'mesh':c.t);
      assert.deepEqual(geometry(actual[i]),geometry(c),`${course.id} changed ${c.nm}`);
    }
    assert.ok(r.source.components.every(c=>c.grp!==5),'donor scenery leaked into bonus');
    assert.ok(r.source.components.some(c=>c.t==='decor'&&c.solid===false),'destination art is missing');
    const tex={jungle:'treehouse-stone','beachside-run':'plank',coastal:'bay-paving'}[key];
    assert.ok(actual.filter(c=>c.t==='mesh'&&!c.outline).every(c=>c.tex===tex),'destination surface style lost');
    const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
    const retired=Object.keys(pilots).flatMap(id=>[id,`bonus-${id}`]);
    assert.ok(pack.levels.every(e=>!retired.includes(e.id)));
    for(const id of retired)assert.equal(findLevel(id),null,`${id} is still registered`);
    const archived=[...PUZZLE_LEVELS,...PUZZLE_LEVELS.map(e=>({...e,id:`bonus-${e.id}`})),
      {id:'u-preserved',name:'Preserved custom level',data:raw}];
    assert.equal(setUserLevels(archived),true);
    assert.ok(levelList().every(e=>!retired.includes(e.id)),'cached editor entries resurrected retired levels');
    assert.equal(getUserLevels().length,archived.length,'retirement erased user archives');
    assert.ok(findLevel('u-preserved'),'retirement hid an unrelated editor level');
    setUserLevels([]);
    const patrolLevel=new r.Level(new r.THREE.Scene(),{id:course.id,name:r.source.name,data:r.source});
    patrolLevel.update(0);patrolLevel.scene.updateMatrixWorld(true);
    const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
    for(let frame=0;frame<300;frame++){
      patrolLevel.update(r.dt);
      if(frame%15)continue;
      for(const foe of patrolLevel.enemies){
        if(['hopper','floater'].includes(foe.kind))continue;
        ray.set(foe.group.position.clone().setY(foe.baseY+2),down);ray.far=4;
        const hit=ray.intersectObjects(patrolLevel.groundMeshes,false)[0];
        assert.ok(hit&&Math.abs(hit.point.y-foe.baseY)<.1,`${donorId}: unsupported ${foe.kind}`);
      }
    }
    patrolLevel.dispose();
    r.p.bonusMode=true;r.id=donorId;
    try{
      const result=runInputPilot(r,pilots[donorId]);
      assert.equal(result.state,'finished');assert.equal(result.deaths,0);
      assert.equal(result.cratesBroken,r.l.totalCrates);
      assert.equal(result.gemEarned,false,'detour should bank boxes into its parent');
      reports.push({id:course.id,donor:donorId,boxes:result.cratesBroken,enemies:r.l.enemies.length,
        checkpoints:r.l.checkpoints.length,seconds:result.seconds,deaths:result.deaths,state:result.state});
      console.log(JSON.stringify(reports.at(-1)));
    }catch(error){
      await writeFile(join(tmpdir(),`${donorId}-bonus-failure.json`),JSON.stringify({error:error.message,report:r.report,trace:r.trace},null,2));
      throw error;
    }
  },{modulePath:'/src/levels/themed-bonuses.ts',levelId:`bonus-${key}`,maxFrames:40000,
    controlFrame:()=>({x:0,z:-1}),source:m=>m.resolveBonusLevel(key)});
}
await writeFile(join(tmpdir(),'puzzle-bonus-replacements.json'),JSON.stringify(reports,null,2));
console.log(`PASS donor geometry, destination art, retired cached entries, supported patrols, and ${reports.length} input-only all-box bonus clears.`);
