import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const fixture=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
runInThisContext('const noop=()=>{};'+fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nconst held'))+'\ninstallHeadlessDom();');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}}),levels=[];
const warn=console.warn,error=console.error;
console.warn=(...a)=>{if(!/failed|GLB|procedural skateboard/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
try{
 const {Level,normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const build=data=>{assert.ok(normalizeCustomLevelData(data),'invalid rail opt-out data');const level=new Level(new THREE.Scene(),{id:'vert-rails',name:data.name,data});levels.push(level);return level;};
 // Exercise both source-owned round trips and the actual geometry capture
 // used by hand-built/editor-adopted courses. The former is a source clone.
 const captureGeometry=level=>{const source=level.builtFromData;level.builtFromData=null;try{return level.captureData();}finally{level.builtFromData=source;}};
 for(const swept of [false,true]){
  const vert={t:'vertramp',p:[0,0,0],vkind:'half',w:2.6,rise:3.6,arc:90,len:20,
   ...(swept?{pts:[[0,10,0,0],[0,0,0,0],[4,-12,0,0]],curve:'spline',deck:1.2}:{})};
  const data={v:1,name:'Vert rail policy',spawn:[0,.05,0],killY:-20,components:[
   {t:'platform',p:[0,-1,0],s:[30,2,60],edgeGrinding:false},vert,{t:'gate',p:[0,0,-25]}]};
  const legacy=build(data);assert.equal(legacy.rails.filter(r=>r.coping).length,2,'existing halfpipes lost default coping');
  const clear=build({...data,components:data.components.map(c=>c===vert?{...c,rails:false}:c)});
  assert.equal(clear.rails.length,0,'rails:false left a riding obstruction');
  assert.ok(clear.groundMeshes.some(m=>m.userData.vert),'rail opt-out removed the transition surface');
  const captured=clear.captureData(),capturedVert=captured.components.find(c=>c.t==='vertramp');
  assert.equal(capturedVert?.rails,false,'capture forgot the halfpipe rail opt-out');
  assert.equal(build(captured).rails.length,0,'capture/rebuild restored unwanted rails');
  // Authored bars remain real components even when laid exactly on an opted-out lip.
  const points=legacy.rails[0].points,p=points[0].toArray();
  const manual={t:'rail',p,pts:points.map(q=>[q.x-p[0],q.z-p[2],0,q.y-p[1]])};
  const explicit=build({...data,components:[...data.components.map(c=>c===vert?{...c,rails:false}:c),manual]});
  assert.equal(explicit.rails.length,1);
  const saved=explicit.captureData();assert.equal(saved.components.filter(c=>c.t==='rail').length,1,'capture erased an explicit lip rail');
  assert.equal(build(saved).rails.length,1,'explicit rail was duplicated or discarded');
  for(const [level,count] of [[clear,0],[explicit,1]]) {
   const capturedGeometry=captureGeometry(level);
   assert.equal(capturedGeometry.components.find(c=>c.t==='vertramp')?.rails,false,'geometry capture forgot rails:false');
   assert.equal(capturedGeometry.components.filter(c=>c.t==='rail').length,count,'geometry capture misclassified a manual rail as generated coping');
   assert.equal(build(capturedGeometry).rails.length,count,'geometry reconstruction changed rail ownership');
  }
 }
 console.log('PASS analytic/swept halfpipes retain default coping, opt out without changing vert surfaces, and preserve rails:false plus explicit rails through capture');
}finally{for(const l of levels)l.dispose();await server.close();console.warn=warn;console.error=error;}
