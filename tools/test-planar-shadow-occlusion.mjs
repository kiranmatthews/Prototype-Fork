import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();')();
const cacheDir = await mkdtemp(join(tmpdir(), 'crown-shadow-occlusion-'));
const server = await createServer({configFile:false, cacheDir, appType:'custom', logLevel:'silent', optimizeDeps:{noDiscovery:true},
  server:{middlewareMode:true, hmr:false, ws:false, watch:null}});
const clone = value => JSON.parse(JSON.stringify(value));
try {
  const {createHoldShadowOccluder} = await server.ssrLoadModule('/src/planarShadowOcclusion.ts');
  const {JungleAssetKit} = await server.ssrLoadModule('/src/jungleAssets.ts');
  const {installSceneryShadowPass} = await server.ssrLoadModule('/src/sceneryShadowPass.ts');
  const roof = {t:'mesh',p:[0,0,0],solid:false,doubleSided:true,tex:'solid',color:'#202a31',
    nm:'Skate hold · dark ceiling around the daylight openings',vertices:[],indices:[]};
  for (const [left,right,back,front] of [[-10,-2,-10,10],[2,10,-10,10],[-2,2,-10,-2],[-2,2,2,10]]) {
    const n = roof.vertices.length / 3;
    roof.vertices.push(left,10,back,right,10,back,right,10,front,left,10,front);
    roof.indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  const data = {v:1,name:'Ceiling proof',spawn:[0,1,0],killY:-30,atmosphere:{profile:'drowned-crown',sunDirection:[0,1,0]},components:[roof]};
  const original = clone(data), proof = createHoldShadowOccluder(data);
  assert.ok(proof); assert.ok(proof.matches(roof)); assert.equal(proof.matches(clone(roof)),false);
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const ownerGeometry = new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(roof.vertices,3));
  ownerGeometry.setIndex(roof.indices);
  const owner = new THREE.Mesh(ownerGeometry,new THREE.MeshLambertMaterial({side:THREE.DoubleSide}));
  owner.castShadow = true;scene.add(owner);proof.bind(owner);
  const sun = new THREE.DirectionalLight();sun.castShadow=true;sun.position.set(0,100,0);sun.shadow.camera.near=1;sun.shadow.camera.far=500;
  scene.add(sun,sun.target);scene.updateMatrixWorld(true);
  assert.ok(proof.supports([sun],root));
  const cell = new THREE.InstancedMesh(new THREE.BoxGeometry(.5,.5,.5),new THREE.MeshStandardMaterial(),1);
  root.add(cell);cell.castShadow=true;
  const place = (x,y=0,z=0) => {cell.setMatrixAt(0,new THREE.Matrix4().makeTranslation(x,y,z));cell.instanceMatrix.needsUpdate=true;scene.updateMatrixWorld(true);};
  place(6);assert.ok(proof.covers(cell),'whole box under opaque ceiling');
  const firstBounds = cell.boundingBox;assert.ok(proof.covers(cell));assert.equal(cell.boundingBox,firstBounds);
  proof.beginPass();proof.deadline=-Infinity;assert.ok(proof.covers(cell),'cached proof survives exhausted first-use budget');
  place(7);assert.equal(proof.covers(cell),false,'uncached cell keeps normal shadows when budget is exhausted');
  proof.deadline=Infinity;assert.ok(proof.covers(cell),'deferred proof can complete on a later pass');
  place(0);assert.equal(proof.covers(cell),false,'skylight remains open');
  place(2.2);assert.equal(proof.covers(cell),false,'partial skylight overlap is not culled');
  place(9.8);assert.equal(proof.covers(cell),false,'outer ceiling edge remains open');
  place(6,10);assert.equal(proof.covers(cell),false,'box through or above roof remains');
  place(6);assert.ok(proof.covers(cell));
  cell.position.x=-6;scene.updateMatrixWorld(true);assert.equal(proof.covers(cell),false,'world transform invalidates cell cache');
  cell.position.x=0;scene.updateMatrixWorld(true);assert.ok(proof.covers(cell));
  cell.geometry.translate(-6,0,0);assert.equal(proof.covers(cell),false,'changed geometry invalidates bounds and cache');
  cell.geometry.translate(6,0,0);assert.ok(proof.covers(cell));
  cell.count=0;assert.equal(proof.covers(cell),false,'empty cell does not retain prior proof');cell.count=1;
  for (const [key,value] of [['transparent',true],['alphaTest',.5],['alphaHash',true],['opacity',.8],['displacementMap',new THREE.Texture()]]) {
    const before=cell.material[key];cell.material[key]=value;assert.equal(proof.covers(cell),false,key);cell.material[key]=before;
    if(value?.isTexture)value.dispose();
  }
  cell.customDepthMaterial=new THREE.MeshDepthMaterial();assert.equal(proof.covers(cell),false);cell.customDepthMaterial.dispose();cell.customDepthMaterial=undefined;
  assert.equal(proof.supports(undefined,root),false);
  assert.equal(proof.supports([sun,new THREE.PointLight()],root),false,'multiple lights cannot share a ceiling proof');
  assert.equal(proof.supports([new THREE.PointLight()],root),false);
  sun.target.position.x=1;scene.updateMatrixWorld(true);assert.equal(proof.supports([sun],root),false,'changed sun falls back');
  sun.target.position.x=NaN;scene.updateMatrixWorld(true);assert.equal(proof.supports([sun],root),false,'non-finite light falls back');
  sun.target.position.x=0;scene.updateMatrixWorld(true);
  for (const [key,value] of [['near',90],['far',89],['near',NaN]]) {
    const before=sun.shadow.camera[key];sun.shadow.camera[key]=value;assert.equal(proof.supports([sun],root),false,'clipped roof');sun.shadow.camera[key]=before;
  }
  for (const [object,key,value] of [[owner,'visible',false],[owner,'castShadow',false],[owner.material,'transparent',true],
    [owner.material,'side',THREE.FrontSide],[owner.material,'shadowSide',THREE.BackSide]]) {
    const before=object[key];object[key]=value;assert.equal(proof.supports([sun],root),false,key);object[key]=before;
  }
  owner.removeFromParent();assert.equal(proof.supports([sun],root),false,'detached roof');scene.add(owner);
  owner.position.x=1;scene.updateMatrixWorld(true);assert.equal(proof.supports([sun],root),false,'moved roof');
  owner.position.x=0;root.position.y=1;scene.updateMatrixWorld(true);assert.equal(proof.supports([sun],root),false,'moved kit');
  root.position.y=0;scene.updateMatrixWorld(true);
  owner.geometry.attributes.position.needsUpdate=true;assert.equal(proof.supports([sun],root),false,'changed actual roof');proof.bind(owner);
  assert.ok(proof.supports([sun],root));
  for (const mutate of [
    d=>d.components.push(clone(roof)),
    d=>d.components[0].vertices[1]+=.1, d=>d.components[0].vertices[0]=NaN,
    d=>d.components[0].indices[0]=999, d=>d.components[0].opacity=.9,
    d=>d.components[0].invisible=true, d=>d.components[0].artProxy=true,
    d=>d.components[0].castShadow=false, d=>d.components[0].yaw=1,
    d=>d.components[0].s=[1,2,1], d=>d.atmosphere.sunDirection=[0,0,1],
    d=>d.atmosphere.profile='other', d=>{d.components[0].grp=1;d.groups=[{id:1}];},
  ]) { const edited=clone(data);mutate(edited);assert.equal(createHoldShadowOccluder(edited),undefined,'unsafe source must fall back'); }
  const overlapped=clone(data);overlapped.components[0].indices.push(...roof.indices);
  const union=createHoldShadowOccluder(overlapped);assert.ok(union);
  place(0);assert.equal(union.covers(cell),false,'overlapping triangles cannot hide a skylight');
  place(6);assert.ok(union.covers(cell),'overlap retains real opaque coverage');
  const grouped=clone(data);grouped.components[0].grp=1;grouped.groups=[{id:1,editorOnly:true}];assert.ok(createHoldShadowOccluder(grouped));
  // Non-vertical projection must cover the entire box, not just its centre.
  const slanted=clone(data);slanted.atmosphere.sunDirection=[.5,1,0];const angled=createHoldShadowOccluder(slanted);
  place(0);assert.ok(angled.covers(cell));place(-5);assert.equal(angled.covers(cell),false);

  // Exercise the real shadow scope, including low-detail selection, nesting,
  // capture bypass, a renderer failure, and forwarding the actual light list.
  place(6);
  const kit=new JungleAssetKit(true,false,false,true);scene.add(kit.root);root.remove(cell);kit.root.add(cell);
  const far=new THREE.InstancedMesh(cell.geometry,cell.material,1);far.instanceMatrix=cell.instanceMatrix;far.visible=false;kit.root.add(far);
  kit.cells.push({kind:'crownhullpanel',mesh:cell,farMesh:far,transforms:[],colors:[],bounds:new THREE.Box3()});
  kit.setShadowOccluder(proof);scene.updateMatrixWorld(true);
  const state=()=>[cell.visible,cell.castShadow,far.visible,far.castShadow], before=state();
  const during=()=>{assert.deepEqual(state(),[false,true,true,false]);kit.withLowDetailShadows(()=>assert.deepEqual(state(),[false,true,true,false]),[sun]);};
  kit.withLowDetailShadows(during,[sun]);assert.deepEqual(state(),before);
  assert.throws(()=>kit.withLowDetailShadows(()=>{during();throw Error('render failure');},[sun]),/render failure/);assert.deepEqual(state(),before);
  kit.withLowDetailShadows(()=>assert.deepEqual(state(),[false,true,true,true]));assert.deepEqual(state(),before,'missing lights preserves existing LOD policy');
  kit.withLowDetailCapture(()=>kit.withLowDetailShadows(()=>assert.equal(far.castShadow,false),[sun]));assert.deepEqual(state(),before);
  let draws=0;const shadows={enabled:true,autoUpdate:true,needsUpdate:false,render(lights){assert.equal(lights[0],sun);during();draws++;}};
  installSceneryShadowPass({shadowMap:shadows},()=>kit);installSceneryShadowPass({shadowMap:shadows},()=>kit);
  shadows.render([sun],scene,new THREE.PerspectiveCamera());assert.equal(draws,1);assert.deepEqual(state(),before);
  kit.cells.length=0;kit.dispose();kit.withLowDetailShadows(()=>assert.deepEqual(state(),before),[sun]);
  assert.deepEqual(data,original,'source and editor capture remain unchanged');
  // The new cutaway blockout deliberately leaves the hold open overhead.
  const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
  assert.equal(createHoldShadowOccluder(pack.levels.find(l=>l.id==='drowned-crown').data),undefined,'the open greybox hold has no ceiling shadow occluder');
  cell.dispose();far.dispose();cell.geometry.dispose();cell.material.dispose();owner.geometry.dispose();owner.material.dispose();
  console.log('Planar shadow occlusion: geometry, holes, cache invalidation, light/ceiling guards, actual shadow scope and source integrity passed.');
} finally {await server.close();await rm(cacheDir,{recursive:true,force:true});}
