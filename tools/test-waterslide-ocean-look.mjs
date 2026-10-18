import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async({l,source,server,THREE})=>{
 const {Level,normalizeCustomLevelData,parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
 const {WATERPARK_ISLAND_OCEAN_LOOK:look}=await server.ssrLoadModule('/src/levels/slipstream-island.ts');
 const {SUNNY_BEACH_OCEAN_LOOK:beach}=await server.ssrLoadModule('/src/levels/sunny-beach.ts');
 const {OceanTuningStore}=await server.ssrLoadModule('/src/oceanTuning.ts');
 const baseline=structuredClone(look),old=new Level(new THREE.Scene(),{id:'ocean-look-reference',name:source.name,data:{...source,ocean:{...source.ocean,look:'sunny-beach'}}});
 try{
  for(const quality of ['lite','full']){
   l.water.setQuality(quality);old.water.setQuality(quality);
   for(const [key,value]of Object.entries(look))assert.deepEqual(l.water.params[key],value,'scoped look reaches '+quality+' water: '+key);
   for(const [key,value]of Object.entries(beach))assert.deepEqual(old.water.params[key],value,'other level retains beach look: '+key);
   for(const time of [0,7,30,103])for(let i=0;i<80;i++){
    const x=-850+i*19,z=-2800+Math.sin(i*1.7)*400;
    assert.deepEqual(l.water.sampleWaterSurface(x,z,time),old.water.sampleWaterSurface(x,z,time),'palette changes cannot alter wave heights, normals, shore influence or swimming motion');
   }
  }
  const captured=l.captureData(),parsed=parseCustomLevelJson(JSON.stringify(captured));
  assert.equal(parsed.ocean.look,'waterpark-island','editor save/import preserves the authored palette');
  assert.equal(normalizeCustomLevelData({...captured,ocean:{...captured.ocean,look:'unknown'}}),null);
  const legacy=structuredClone(captured);delete legacy.ocean.look;assert.ok(normalizeCustomLevelData(legacy),'old ocean data remains valid');
  const store=new OceanTuningStore();store.apply(l.water,'level');store.setField('level',['deep','g'],.11);store.apply(l.water,'level');
  assert.equal(l.water.params.deep.g,.11);assert.deepEqual(look,baseline,'studio edits cannot mutate the shared source palette');
  assert.deepEqual(old.water.params.deep,beach.deep,'editing this ocean cannot mutate another level');
  store.reset('level');store.apply(l.water,'level');assert.deepEqual(l.water.params.deep,look.deep,'reset returns to the authored island look');
  const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
  assert.equal(pack.levels.find(row=>row.id==='slipstream-race').data.ocean.look,source.ocean.look,'source and shared snapshot choose the same look');
  console.log('PASS island ocean: portable scoped palette, lite/full materials, 640 identical physical surface samples, independent edits, reset and legacy data.');
 }finally{old.dispose();}
},{modulePath:'/src/levels/slipstream-island.ts',levelId:'waterpark-ocean-look',source:m=>({v:1,name:'Waterpark lagoon look',spawn:[0,132,0],killY:100,ocean:structuredClone(m.WATERPARK_ISLAND_LOOK.ocean),components:[{t:'platform',p:[0,130,0],s:[8,2,8]},{t:'gate',p:[0,131,-3]}]})});
