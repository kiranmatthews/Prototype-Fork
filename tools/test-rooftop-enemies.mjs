// Pig retirement must preserve old levels and the ordinary enemy runtime.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({server,THREE,Level})=>{
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const {ROOFTOP_RELAY_LEVEL}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const pack=JSON.parse(await readFile('public/levels.json','utf8'));
 assert.equal(ROOFTOP_RELAY_LEVEL.components.filter(c=>c.kookRole).length,0);
 for(const row of pack.levels)assert.equal(row.data?.components.filter(c=>c.kookRole).length??0,0,'Published pig placement: '+row.id);
 const ground={t:'platform',p:[0,-.5,0],s:[40,1,40]},ordinary={t:'enemy',p:[-8,0,0],range:3,speed:1};
 const legacy={v:1,name:'Retired pig import',spawn:[0,1,0],killY:-20,components:[ground,ordinary,
  {t:'enemy',p:[0,0,0],range:3,speed:1,foe:'grunt',kookRole:'lookout',alertGroup:1},
  {t:'enemy',p:[8,0,0],range:3,speed:1,foe:'sentry',kookRole:'gunner',alertGroup:1},
  {t:'gate',p:[0,0,-15]}]};
 const normalized=normalizeCustomLevelData(legacy);
 assert.ok(normalized,'Old saves remain importable');
 assert.equal(normalized.components.filter(c=>c.t==='enemy').length,1,'Only retired actors are removed');
 assert.deepEqual(normalized.components.find(c=>c.t==='platform'),ground);
 assert.deepEqual(normalized.components.find(c=>c.t==='enemy'),ordinary);
 assert.equal(legacy.components.length,5,'Import leaves caller data unchanged');
 const level=new Level(new THREE.Scene(),{id:'pig-retirement',name:legacy.name,data:legacy});
 try{
  assert.equal(level.enemies.length,1,'Direct fixtures also cannot revive deleted actors');
  level.playerPos.set(1000,0,1000);
  const enemy=level.enemies[0],start=enemy.group.position.x;
  for(let frame=0;frame<60;frame++)level.update(1/60);
  assert.ok(enemy.group.position.x!==start,'Ordinary patrol still moves');
  level.reset(true);assert.equal(level.enemies.length,1);assert.ok(enemy.alive);
 }finally{level.dispose();}
 for(const file of ['public/rooftop-kook/pig-matron.glb','public/rooftop-kook/pig-guard.glb','public/sfx/enemies/pig-oink.wav','public/sfx/enemies/pig-squeal.wav'])await assert.rejects(access(file),{code:'ENOENT'});
 console.log('PASS pig removal: source/pack clear, legacy saves retained, direct fixtures filtered, ordinary patrol/reset intact, assets absent');
});
