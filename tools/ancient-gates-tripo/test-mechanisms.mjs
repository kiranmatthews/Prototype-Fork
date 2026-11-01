import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import * as THREE from 'three';

const harness=await readFile('tools/validate-editor-roundtrip.mjs','utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
globalThis.self=globalThis;
const NativeImage=globalThis.Image;
globalThis.Image=class extends NativeImage{set src(v){if(v.startsWith('data:image/webp;')){this.width=1;this.height=1;}super.src=v;}};
globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
const nativeFetch=globalThis.fetch;
globalThis.fetch=async input=>{
 const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);
 const path=new URL(url,'http://headless.invalid').pathname;
 try{return path.endsWith('.glb')?new Response(await readFile('public'+path)):new Response('',{status:404});}
 catch{return new Response('',{status:404});}
};
const cacheDir=await mkdtemp(join(tmpdir(),'ancient-mechanisms-'));
const server=await createServer({configFile:false,cacheDir,logLevel:'silent',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom'});
const cube={vertices:[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],indices:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]};
const components=[
 {t:'platform',p:[-5,-.5,0],s:[10,1,6.4]},
 {t:'spinbridge',p:[0,0,0],s:[8,.4,6.4],cycle:.7,dkind:'trialsv2plank',nm:'Door'},
 {t:'mover',p:[20,4,0],s:[7,.85,6.4],axis:'x',amp:6,speed:.55,dkind:'trialsv2plank',nm:'Ferry'},
 {t:'crumble',p:[40,3,0],s:[4.2,.65,5.6],shake:.3,dkind:'trialsv2plank',nm:'Falling step'},
 {t:'phasepad',p:[50,3,0],s:[6,.65,6.4],cycle:4,amp:.5,dkind:'trialsv2plank',nm:'Phase step'},
 {t:'mesh',p:[60,2.6,0],s:[4.5,.8,6.4],...cube,outline:true,grp:20,dkind:'stonepaver',nm:'Revealed step'},
 {t:'crate',p:[-4,0,0],kind:'bang',grp:20},
 {t:'ramp',p:[70,0,0],len:7,rise:1.3,w:6.4,yaw:-90,dkind:'trialsv2plank',nm:'Kicker'},
 {t:'crusher',p:[80,0,0],s:[3.2,3.6,6.4],cycle:3.7,dkind:'ancientcanyonrock',nm:'Hammer'},
 {t:'gate',p:[90,0,0],yaw:90},
];
let native,baseline;
try{
 const {Level}=await server.ssrLoadModule('/src/level.ts');
 const {ANCIENT_NATIVE_SIZE}=await server.ssrLoadModule('/src/ancientGatesAssetBounds.ts');
 const make=(id,skinned)=>new Level(new THREE.Scene(),{id,name:id,data:{v:1,name:id,spawn:[-5,.12,0],killY:-18,
  components:structuredClone(components).map(c=>{if(!skinned)delete c.dkind;return c;})}});
 native=make('native-mechanisms',true);baseline=make('original-mechanisms',false);
 await native.prepareJungleAssets();
 assert.equal(native.ancientMechanismDiagnostics.ready,7);
 assert.deepEqual(native.ancientMechanismDiagnostics.errors,[]);
 const compare=()=>{
  assert.equal(native.groundMeshes.length,baseline.groundMeshes.length);
  for(const key of ['movers','crumbles','crushers','phasePads'])native[key].forEach((a,i)=>{
   const b=baseline[key][i];assert.deepEqual(a.mesh.position.toArray(),b.mesh.position.toArray());
   assert.deepEqual(a.mesh.rotation.toArray(),b.mesh.rotation.toArray());assert.deepEqual(a.mesh.scale.toArray(),b.mesh.scale.toArray());
   if('state'in a)assert.equal(a.state,b.state);if('on'in a)assert.equal(a.on,b.on);
  });
  assert.deepEqual(native.spinBridges[0].hitBox,baseline.spinBridges[0].hitBox);
  assert.deepEqual(native.spinBridges[0].wallBox,baseline.spinBridges[0].wallBox);
  const phase=native.ancientMechanismDiagnostics.mechanisms.find(m=>m.type==='phasepad');
  assert.equal(phase.visible,native.phasePads[0].on);
 };
 const step=(seconds)=>{for(let i=0;i<Math.round(seconds*60);i++){native.update(1/60);baseline.update(1/60);compare();}};
 compare();
 for(const l of [native,baseline])l.spinBridges[0].trigger(l.spinBridges[0].hitBox.clone());
 step(1);assert.equal(native.spinBridges[0].deployed,true);
 for(const l of [native,baseline])l.touchCrumble(0);
 step(.6);assert.equal(native.crumbles[0].state,'fall');
 step(11);assert.equal(native.crumbles[0].state,'idle');
 for(const l of [native,baseline])l.triggerBang(l.crates.find(c=>c.bang));
 step(.1);assert.equal(native.ancientMechanismDiagnostics.mechanisms.find(m=>m.type==='mesh').visible,true);
 let pieces=0,triangles=0;const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3();
 native.root.traverse(o=>{
  if(!o.isInstancedMesh||!o.userData.nativeAsset)return;
  const kind=o.userData.nativeAsset,source=ANCIENT_NATIVE_SIZE[kind];assert.ok(source,kind);
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.decompose(pos,rot,scale);
   const ratios=scale.toArray().map((s,k)=>s/source[k]);
   assert.ok(Math.max(...ratios)/Math.min(...ratios)<1.00001,kind+' was stretched');pieces++;
  }
  triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*o.count;
 });
 for(const l of [native,baseline])l.reset(true);step(.1);
 assert.equal(native.spinBridges[0].deployed,false);
 assert.equal(native.ancientMechanismDiagnostics.mechanisms.find(m=>m.type==='mesh').visible,false);
 assert.equal(native.spinBridges[0].mesh.children.some(o=>o.userData.nativeAsset),false,'art must not expand interaction bounds');
 const report={mechanisms:7,nativePieces:pieces,triangles,unchangedMotionAndCollision:true,
  doorDeployAndReset:true,crumbleFallAndReturn:true,phaseVisibility:true,switchRevealAndReset:true,nativeRatios:true,errors:[]};
 await writeFile('docs/ancient-gates/tripo/mechanisms-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{native?.dispose();baseline?.dispose();await server.close();await rm(cacheDir,{recursive:true,force:true});}
