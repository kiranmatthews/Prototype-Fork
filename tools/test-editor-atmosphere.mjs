import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';
import { atmosphereRenderer } from './atmosphere-runtime-harness.mjs';

// Baseline fixture was measured by executing c902b81's actual renderer functions
// before the shared resolver change. Only `dark` was intentionally refreshed
// from 55edc03's pristine Level/renderer when Nightworks became a floating-rock
// data-backed course. The other nineteen scenarios retain their old baseline.
// This prevents source/copy tests from sharing the same accidental drift.
const baseline = JSON.parse(await readFile(new URL('./fixtures/native-atmosphere-baseline.json', import.meta.url),'utf8'));
// The stored baseline crosses CPU/OS/Node versions. Math.pow in Three's sRGB
// conversion can differ by a few double-precision ULPs on Linux and macOS.
// Keep structure, flags and strings exact, with a tolerance far below GPU
// precision for these historical numeric values. Same-run copy/history
// comparisons below remain exact so serialization must preserve real values.
function assertRenderBaseline(actual, expected, at = 'renderer') {
  assert.equal(typeof actual, typeof expected, `${at}: value type changed`);
  if (typeof expected === 'number') {
    assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-12,
      `${at}: expected ${expected}, received ${actual}`);
  } else if (expected === null || typeof expected !== 'object') {
    assert.equal(actual, expected, `${at}: value changed`);
  } else {
    assert.ok(actual !== null, `${at}: object missing`);
    assert.equal(Array.isArray(actual), Array.isArray(expected), `${at}: container changed`);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${at}: fields changed`);
    for (const key of Object.keys(expected)) assertRenderBaseline(actual[key], expected[key], `${at}.${key}`);
  }
}
assertRenderBaseline({ color: [.0865004620280852], sky: false },
  { color: [.08650046202808521], sky: false });
assert.throws(() => assertRenderBaseline({ color: [.08651] }, { color: [.08650] }));
assert.throws(() => assertRenderBaseline({ sky: true }, { sky: false }));
assert.throws(() => assertRenderBaseline({ color: [NaN] }, { color: [0] }));
const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url),'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
const server = await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const clone = value => JSON.parse(JSON.stringify(value));
const dataFor = (kind='ordinary',sky='coast') => ({v:1,name:'Atmosphere sentinel',spawn:[0,1,0],killY:-30,sky,
  ...(kind==='jungle'?{jungleAtmosphere:true}:{}),components:kind==='map'?[{t:'worldmap',p:[0,0,0]}]:
    [{t:'platform',...(kind==='nightworks'?{dkind:'nightplateau',p:[0,-3,0],s:[8,6,8]}:{p:[0,-1,0],s:[4,1,4]})},{t:'gate',p:[0,0,-2]}]});
let checks=0, failures=0;
const check=(label,fn)=>{checks++;try{fn();}catch(error){failures++;console.error(`FAIL ${label}: ${error.stack}`);}};
try{
  const api=await server.ssrLoadModule('/src/level.ts');
  const atmosphere=await server.ssrLoadModule('/src/levelAtmosphere.ts');
  const {NIGHTWORKS_LEVEL}=await server.ssrLoadModule('/src/levels/nightworks.ts');
  const render=atmosphereRenderer(await readFile(new URL('../src/main.ts',import.meta.url),'utf8'),atmosphere);
  const renderLevel=(level,entry,painted=true,editor=false)=>render(level,entry,{painted,editor},THREE,atmosphere);
  const build=(data,id='atmosphere_copy')=>new api.Level(new THREE.Scene(),{id,name:data.name,data:clone(data)});
  for(const query of ['?lite','']){
    window.location.search=query;api.setEditorBuild(false);
    for(const entry of api.BUILTIN_LEVELS.filter(e=>!e.data)){
      const source=new api.Level(new THREE.Scene(),entry);let copy;
      try{
        const exported=source.captureData(), normalized=api.normalizeCustomLevelData(exported);
        check(`${entry.id} ${query}: captured atmosphere is safe portable JSON`,()=>{
          assert.ok(normalized);assert.ok(api.parseCustomLevelJson(JSON.stringify(exported)));
          if(entry.id==='dark'){
            assert.ok(source.builtFromData,'Nightworks no longer uses its source-owned data');
            assert.deepEqual(exported,api.migrateCustomLevel(clone(NIGHTWORKS_LEVEL)),
              'read-only data-backed Nightworks capture materialized atmosphere overrides');
          }else assert.ok(normalized.atmosphere);
          assert.deepEqual(api.normalizeCustomLevelData(normalized),normalized);
        });
        if(!normalized)continue;
        const copied={id:`copied_${entry.id}`,name:entry.name+' copy',data:normalized};copy=build(normalized,copied.id);
        for(const painted of [true,false])check(`${entry.id} ${query} ${painted}: native and copied effective renderer state`,()=>{
          const actual=renderLevel(source,entry,painted), restored=renderLevel(copy,copied,painted);
          assertRenderBaseline(actual,baseline[entry.id][painted?'painted':'fallback']);
          assert.deepEqual(restored,actual,'capture changed effective fog, lights or backdrop under a different ID');
        });
        if(query)check(`${entry.id}: lite renderer preserves copied atmosphere`,()=>{
          const original=render(source,entry,{painted:true,lite:true},THREE,atmosphere);
          const restored=render(copy,copied,{painted:true,lite:true},THREE,atmosphere);
          assert.deepEqual(restored,original);assert.equal(restored.skyVisible,false);assert.equal(restored.mistVisible,false);
        });
        if(entry.id==='sky')check(`${query}: portable whiteout still permits editor inspection`,()=>{
          const inspection=renderLevel(copy,copied,true,true);
          assert.equal(inspection.fog,null);assert.equal(inspection.skyVisible,true);assert.equal(inspection.drawDistance,1234);
          assert.equal(renderLevel(copy,copied).skyVisible,false);
        });
      }finally{copy?.dispose();source.dispose();}
    }
  }
  window.location.search='?lite';
  for(const sky of ['day','sunset','night','coast'])for(const kind of ['ordinary','jungle','map']){
    const data=dataFor(kind,sky),entry={id:'defaults',name:data.name,data},level=build(data,entry.id);
    try{for(const painted of [true,false])check(`absent overrides preserve ${kind}/${sky}/${painted} defaults`,()=>{
      assertRenderBaseline(renderLevel(level,entry,painted),baseline[`default:${kind}:${sky}`][painted?'painted':'fallback']);
      assert.equal(level.captureData().atmosphere,undefined,'opening authored default data materialized overrides');
    });}finally{level.dispose();}
  }
  const numericValues={fogNear:321,fogFar:78,ambientIntensity:3.2,sunIntensity:2.7,fillIntensity:1.6,
    shadowStrength:.17,drawDistance:1234,fallbackSunU:.23,fallbackSunV:.71};
  const tuple=[.123,.456,.789],hex='#17a39f';
  for(const kind of ['ordinary','jungle','map','nightworks']){
    const data=dataFor(kind),entry={id:'overrides',name:data.name,data},level=build(data,entry.id);
    try{
      for(const [key,value] of Object.entries(numericValues))check(`${kind}: final numeric override ${key}`,()=>{
        const normalized=api.normalizeCustomLevelData({...data,atmosphere:{[key]:value}});assert.ok(normalized);
        level.atmosphere=normalized.atmosphere;const result=renderLevel(level,entry,false);
        const actual=key==='fogNear'?result.fog.near:key==='fogFar'?result.fog.far:
          key==='fallbackSunU'?result.fallback.sunU:key==='fallbackSunV'?result.fallback.sunV:result[key];
        assert.equal(actual,value,'preset/map/jungle defaults ignored an authored value');
        if(key==='drawDistance')assert.equal(result.secondDrawDistance,value);
      });
      for(const key of Object.keys(atmosphere.ATMOSPHERE_COLORS))for(const value of [tuple,hex])check(`${kind}: final color override ${key}/${typeof value}`,()=>{
        const normalized=api.normalizeCustomLevelData({...data,atmosphere:{[key]:value}});assert.ok(normalized);
        level.atmosphere=normalized.atmosphere;const result=renderLevel(level,entry,false);
        const expected=Array.isArray(value)?value:new THREE.Color(value).toArray();
        if(key==='fogColor'){assert.deepEqual(result.fog.color,expected);assert.deepEqual(result.background,expected);}
        else if(key.startsWith('fallback')){
          const field={fallbackTop:'skyTop',fallbackBottom:'skyBottom',fallbackFog:'fog',fallbackSunColor:'sunColorHex'}[key];
          const color=Array.isArray(value)?new THREE.Color().setRGB(...value):new THREE.Color(value);
          assert.equal(result.fallback[field],key==='fallbackFog'?color.getHex():`#${color.getHexString()}`);
        }else assert.deepEqual(result[key],expected);
      });
      for(const value of [true,false])check(`${kind}: fog/stars booleans ${value}`,()=>{
        level.atmosphere={fogEnabled:value,fallbackStars:value};const result=renderLevel(level,entry,false);
        assert.equal(!!result.fog,value);assert.equal(result.fallback.stars,value);
      });
      for(const value of ['sky','fog'])check(`${kind}: final backdrop ${value}`,()=>{
        level.atmosphere={backdrop:value};assert.equal(renderLevel(level,entry).skyVisible,value==='sky');
      });
      check(`${kind}: null fallback sun hides its disc`,()=>{
        level.atmosphere={fallbackSunColor:null};assert.equal(renderLevel(level,entry,false).fallback.sunColorHex,'');
      });
    }finally{level.dispose();}
  }
  // Legacy data-backed Sky Bridge copies/export bypassed native capture.
  for(const extra of [{},{keepPlayFog:false,atmosphere:{backdrop:'sky',fogNear:10,fogFar:40}},
    {keepPlayFog:true,atmosphere:{backdrop:'fog',fogEnabled:false}}]){
    const data={...dataFor('ordinary','sunset'),...extra}, original=clone(data);
    const entry={id:'sky',name:'Legacy sky override',data},source=build(data,'sky');let copy;
    try{check(`legacy Sky override portability ${JSON.stringify(extra)}`,()=>{
      assert.deepEqual(source.captureData(),api.migrateCustomLevel(clone(data)),'read-only capture changed stored data');
      const portable=api.normalizeCustomLevelData(atmosphere.withPortableAtmosphere(data,'sky'));assert.ok(portable);
      assert.deepEqual(data,original,'copy/export mutated the old override');
      copy=build(portable,'arbitrary_shared_id');
      assert.equal(copy.keepPlayFog,data.keepPlayFog??true);
      assert.equal(source.keepPlayFog,data.keepPlayFog??true,'explicit false was replaced by the built-in default');
      for(const painted of [true,false])assert.deepEqual(renderLevel(copy,{id:'arbitrary_shared_id',data:portable},painted),renderLevel(source,entry,painted));
      // The source ID can add separate campaign furniture; compare the same
      // explicitly authored floor owner rather than unrelated mesh counts.
      assert.equal(copy.groundMeshes.find(m=>m.userData.editorIdx===0).material.fog,
        source.groundMeshes.find(m=>m.userData.editorIdx===0).material.fog);
    });}finally{copy?.dispose();source.dispose();}
  }
  for(const kind of ['jungle','nightworks'])for(const keepPlayFog of [undefined,false,true]){
    const data={...dataFor(kind,'day'),...(keepPlayFog!==undefined?{keepPlayFog}: {})};const level=build(data);
    try{check(`${kind} material fog default/override ${keepPlayFog}`,()=>{
      assert.equal(level.keepPlayFog,keepPlayFog??true);
      assert.equal(level.groundMeshes.find(m=>m.userData.editorIdx===0).material.fog,keepPlayFog??true);
    });}finally{level.dispose();}
  }
  const rockTriggers=[
    ...['nightplateau','nightlongisland','nightsteppingrock','nightphaserock','nightrockridge'].map(dkind=>({t:'platform',dkind,p:[0,-3,0],s:[8,6,8]})),
    {t:'mover',dkind:'nightsteppingrock',p:[0,3,0],s:[5,4,5]},
    {t:'phasepad',dkind:'nightphaserock',p:[0,3,0],s:[5,4,5]},
    {t:'rail',dkind:'nightrockridge',p:[0,3,0],len:12},
    {t:'ropeswing',dkind:'nightanchorrock',p:[0,10,0],len:6},
  ];
  for(const component of [...rockTriggers,{t:'decor',dkind:'nightdistantarch',p:[0,10,0],s:[8,10,4]},
    {t:'decor',dkind:'nightanchorrock',p:[0,10,0],s:[4,3,3]},
    {t:'rail',dkind:'nightplateau',p:[0,3,0],len:12}]){
    const data={...dataFor('ordinary','night'),components:[component,{t:'gate',p:[0,0,-20]}]},level=build(data);
    try{check(`Nightworks inherited-default trigger ${component.t}/${component.dkind}`,()=>{
      assert.equal(atmosphere.usesNightworksAtmosphere(data),!!level.nightworksRocks);
      assert.deepEqual(atmosphere.resolveDataAtmosphere(data),atmosphere.resolveLevelAtmosphere(level),
        'inspector inherited values disagree with the constructed level');
    });}finally{level.dispose();}
  }
  for(const data of [clone(NIGHTWORKS_LEVEL),{...dataFor('nightworks','day'),jungleAtmosphere:true},
    {...dataFor('nightworks','night'),components:[...dataFor('nightworks').components,{t:'worldmap',p:[0,0,0]}]}]){
    const level=build(data);
    try{check('Nightworks defaults/custom transition preserves effective appearance',()=>{
      const before=renderLevel(level,{id:'custom-transition',data});
      assert.deepEqual(atmosphere.resolveDataAtmosphere(data),atmosphere.resolveLevelAtmosphere(level));
      level.atmosphere=atmosphere.resolveDataAtmosphere(data);
      assert.deepEqual(renderLevel(level,{id:'custom-transition',data}),before);
    });}finally{level.dispose();}
  }
  const base=dataFor();
  const reject=(atmosphereData,label)=>check(`reject ${label}`,()=>assert.equal(api.normalizeCustomLevelData({...base,atmosphere:atmosphereData}),null));
  for(const [key,range] of Object.entries(atmosphere.ATMOSPHERE_NUMBERS)){
    for(const value of [range.min,range.max])check(`accept ${key} boundary ${value}`,()=>assert.ok(api.normalizeCustomLevelData({...base,atmosphere:{[key]:value}})));
    for(const value of [range.min-1,range.max+1,NaN,Infinity,'1',null,true,[]])reject({[key]:value},`${key}/${String(value)}`);
  }
  for(const key of Object.keys(atmosphere.ATMOSPHERE_COLORS)){
    for(const value of ['javascript:alert(1)','#fff','#gg0000',[0,0],[0,0,0,0],[-.1,0,0],[0,0,1.1],[0,NaN,0],{r:1,g:0,b:0},true])reject({[key]:value},`${key}/${JSON.stringify(value)}`);
    if(key!=='fallbackSunColor')reject({[key]:null},`${key}/null`);
  }
  for(const key of ['fogEnabled','fallbackStars'])for(const value of [0,'true',null,[]])reject({[key]:value},`${key}/${value}`);
  for(const value of ['none',0,null,{}])reject({backdrop:value},`backdrop/${value}`);
  for(const value of [null,[],{script:'alert(1)'},{fogNear:50,fogFar:50},{fogNear:51,fogFar:50}])reject(value,'invalid atmosphere shape/range');
  check('atmosphere executable object hooks are rejected without execution',()=>{
    let invoked=false;const bad={};Object.defineProperty(bad,'fogColor',{enumerable:true,get(){invoked=true;return '#ffffff';}});
    assert.equal(api.normalizeCustomLevelData({...base,atmosphere:bad}),null);assert.equal(invoked,false);
    assert.equal(api.parseCustomLevelJson(JSON.stringify(base).replace('"components":','"atmosphere":{"__proto__":{}},"components":')),null);
  });
  // Use real Editor history and registry transactions; only DOM/WebGL hooks
  // are stubbed. Rebuild the scene and inspect the actual renderer after undo.
  const {Editor}=await server.ssrLoadModule('/src/editor.ts');
  const data=api.normalizeCustomLevelData(base);api.setUserLevels([{id:'atmosphere_history',name:data.name,data}]);
  const editor=Object.create(Editor.prototype);Object.assign(editor,{active:true,data:clone(data),sel:[],selVtxs:new Set(),resizeIdx:-1,
    targetId:'atmosphere_history',targetName:data.name,initialTargetId:'atmosphere_history',initialTargetName:data.name,
    initialJson:JSON.stringify(data),lastCommitted:JSON.stringify(data),forkOnFirstCommit:false,forkedLevelId:null,pristineBuiltin:false,
    registryChanged:false,closedGroups:new Set(),undoStack:[],redoStack:[],lastCoalesce:'',lastCommitT:0,
    moveDrag:null,gizmoDrag:null,hdlDrag:null,dragging:false,dragSel:[],dragAddedFrom:null,dragGroupsBefore:null,
    dragSourceJson:null,dragSelectionBefore:null,downAt:null,marquee:null,cancelScrub:null,
    statusEl:{textContent:'',dataset:{}},renderLayers(){},renderProps(){},syncSkySelect(){},syncProjectFields(){},
    refreshSelectionBox(){},refreshHandles(){},refreshSpawnMarker(){},hideMarquee(){},cancelDraw(){}});
  let preview=build(data);
  editor.hooks={showMsg(){},preflight:prepared=>!!(api.borrowedValidatedLevelData(prepared?.data??editor.data)??api.normalizeCustomLevelData(editor.data)),
    resetPreview(){},rebuild(){preview.dispose();preview=build(editor.data);},levelsChanged(){}};
  try{check('actual editor atmosphere commit/undo/redo reaches renderer and saved JSON',()=>{
    const initial=renderLevel(preview,{id:editor.targetId,data:editor.data});
    editor.data.atmosphere={fogNear:8,fogFar:32,backdrop:'fog',sunIntensity:2.2,ambientSky:tuple};
    assert.equal(editor.commit(),true);
    const changed=renderLevel(preview,{id:editor.targetId,data:editor.data});assert.equal(changed.fog.near,8);assert.equal(changed.skyVisible,false);
    assert.equal(changed.sunIntensity,2.2);assert.deepEqual(changed.ambientSky,tuple);
    assert.deepEqual(api.findLevel(editor.targetId).data,editor.data);
    editor.undo();assert.deepEqual(renderLevel(preview,{id:editor.targetId,data:editor.data}),initial);
    editor.redo();assert.deepEqual(renderLevel(preview,{id:editor.targetId,data:editor.data}),changed);
    editor.data.atmosphere.sunIntensity=99;assert.equal(editor.commit(),false);assert.equal(editor.data.atmosphere.sunIntensity,2.2);
    assert.deepEqual(api.findLevel(editor.targetId).data,editor.data);
  });
    const {EditorEnvironment}=await server.ssrLoadModule('/src/editorEnvironment.ts');
    check('rounded atmosphere fields preserve exact stored precision on focus, blur and Enter',()=>{
      const originalDocument=globalThis.document;
      class Element {
        children=[];listeners=new Map();style={};attributes={};value='';
        constructor(tag){this.tagName=tag;}
        append(...children){this.children.push(...children);}
        appendChild(child){this.children.push(child);return child;}
        replaceChildren(...children){this.children=[...children];}
        setAttribute(key,value){this.attributes[key]=value;}
        addEventListener(type,listener){this.listeners.set(type,listener);}
        blur(){this.listeners.get('blur')?.({});}
      }
      globalThis.document={createElement:tag=>new Element(tag)};
      try{
        editor.numberGetters=new WeakMap();
        editor.data.atmosphere.sunIntensity=1.7050000000000002;
        const before=JSON.stringify(editor.data), history=editor.undoStack.length;
        const controls=new EditorEnvironment({data:()=>editor.data,levelId:()=>editor.targetId,
          number:(...args)=>editor.numRow(...args),commit:()=>editor.commit(),focus(){},cameraFocus:()=>[0,0,0]});
        const descendants=node=>[node,...node.children.flatMap(descendants)];
        const input=descendants(controls.element).find(element=>element.attributes['aria-label']==='sun intensity');
        assert.equal(input.value,'1.705');
        input.listeners.get('focus')?.({});input.blur();
        input.listeners.get('keydown')?.({key:'Enter',preventDefault(){}});
        assert.equal(JSON.stringify(editor.data),before,'display formatting rewrote the captured number');
        assert.equal(editor.undoStack.length,history,'display-only focus/blur added history');
      }finally{globalThis.document=originalDocument;}
    });
  }finally{preview.dispose();}
}finally{await server.close();}
console.log(`${checks-failures}/${checks} editor atmosphere runtime/security/history checks passed`);
if(failures)process.exitCode=1;
