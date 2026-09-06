import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const {OceanTuningStore,OCEAN_TUNING_KEY,cloneOceanParams}=await server.ssrLoadModule('/src/oceanTuning.ts');
  const {createMapOceanDefaults}=await server.ssrLoadModule('/src/mapOceanPreset.ts');
  const {UNITY_OCEAN_DEFAULTS}=await server.ssrLoadModule('/src/unityOcean.ts');
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const water=base=>({params:cloneOceanParams(base),debug:{},stats:{quality:'full'},marks:0,markWavesDirty(){this.marks++}});
  const store=new OceanTuningStore(storage), map=water(createMapOceanDefaults()),level=water(UNITY_OCEAN_DEFAULTS);
  store.apply(map,'map');store.apply(level,'level');
  assert.deepEqual(map.params,createMapOceanDefaults(),'opening/registering the map changed its authored look');
  assert.deepEqual(level.params,UNITY_OCEAN_DEFAULTS);
  store.setField('map',['causticsScale'],1.7);store.setDebug('map','reflection',false);
  const levelMarks=level.marks;store.apply(level,'level');assert.equal(level.marks,levelMarks,'inactive-profile edit touched the live ocean');
  store.apply(map,'map');assert.equal(map.params.causticsScale,1.7);assert.equal(map.debug.reflection,false);assert.equal(level.debug.reflection,true);
  store.setField('level',['depthDistance'],2.4);store.setField('level',['shallow','r'],.4);store.apply(level,'level');
  assert.equal(level.params.depthDistance,2.4);assert.equal(map.params.depthDistance,.72);
  assert.equal(level.params.shallow.r,.4);assert.equal(map.params.shallow.r,.026);
  const nextLevel=water({...cloneOceanParams(UNITY_OCEAN_DEFAULTS),specularSpread:.8});store.apply(nextLevel,'level');assert.equal(nextLevel.params.specularSpread,.8,'sparse edits erased authored level-specific values');
  store.reset('map');store.apply(map,'map');assert.equal(map.params.causticsScale,1.05);assert.equal(map.debug.reflection,true);assert.equal(level.params.depthDistance,2.4);
  const reloaded=new OceanTuningStore(storage),newLevel=water(UNITY_OCEAN_DEFAULTS);reloaded.apply(newLevel,'level');assert.equal(newLevel.params.depthDistance,2.4);assert.equal(newLevel.params.shallow.r,.4);
  const before=JSON.stringify(reloaded.params('map'));reloaded.setField('map',['causticsScale'],NaN);assert.equal(JSON.stringify(reloaded.params('map')),before);
  data.clear();data.set('solProtoUnityOceanStudioV1',JSON.stringify({version:1,params:{causticsScale:7},debug:{reflection:false}}));
  const legacy=new OceanTuningStore(storage);assert.equal(legacy.params('map').causticsScale,1.05);assert.equal(legacy.params('level').causticsScale,7);legacy.reset('level');
  assert.ok(data.has(OCEAN_TUNING_KEY));assert.equal(new OceanTuningStore(storage).params('level').causticsScale,UNITY_OCEAN_DEFAULTS.causticsScale,'reset resurrected the old global draft');
  const blocked=new OceanTuningStore({getItem(){throw Error('blocked')},setItem(){throw Error('quota')}});blocked.setField('map',['wave1Height'],.15);assert.equal(blocked.params('map').wave1Height,.15);
  console.log('PASS isolated map/level ocean parameters and debug flags, authored baselines, sparse inheritance, reload, reset, legacy migration and blocked storage');
} finally {await server.close()}
