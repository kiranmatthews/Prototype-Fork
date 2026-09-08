import * as THREE from 'three';
import {Level, normalizeCustomLevelData} from '../src/level.ts';

// Separate visual-QA page: no main game singleton, editor registry, or storage
// writes. The two genuine Level builds render their shoreline owners under
// identical lighting and a shared camera after their local images are loaded.
const status=document.querySelector('#status'), views=document.querySelector('#views');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1200,650);renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
views.append(renderer.domElement);
const scene=()=>{const value=new THREE.Scene();value.background=new THREE.Color('#86afc0');
  value.add(new THREE.HemisphereLight(0xe8f4ff,0x737056,1.4));
  const sun=new THREE.DirectionalLight(0xffefd8,2.1);sun.position.set(-35,65,-15);value.add(sun);return value;};
const sourceScene=scene(), copyScene=scene();
const camera=new THREE.PerspectiveCamera(46,600/650,.1,2500);
let source,copy,data,sourceSand,rebuilds=0,baseline,patchMode=false;
const metrics=()=>({textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries});
const showOnlySand=(level,targetScene)=>{for(const child of [...targetScene.children])
  if(child.userData.materialReview)targetScene.remove(child);
  const group=new THREE.Group();group.userData.materialReview=true;
  level.root.updateMatrixWorld(true);
  for(const mesh of sandMeshes(level)){const display=new THREE.Mesh(mesh.geometry,mesh.material);
    display.applyMatrix4(mesh.matrixWorld);group.add(display);}
  targetScene.add(group);};
const sandMeshes=level=>patchMode&&level===copy
  ? [...level.customUnitySand.map(p=>p.mesh),...level.groundMeshes.filter(m=>m.material.userData.unitySandTileMetres===5.4)]
  : level.groundMeshes.filter(m=>m.name==='Showcase1ContinuousSandSeabed');
const render=()=>{for(const value of [sourceScene,copyScene])for(const child of value.children)
    if(!child.isLight&&!child.userData.materialReview)child.visible=false;
  renderer.setScissorTest(true);
  renderer.setViewport(0,0,600,650);renderer.setScissor(0,0,600,650);renderer.render(sourceScene,camera);
  renderer.setViewport(600,0,600,650);renderer.setScissor(600,0,600,650);renderer.render(copyScene,camera);};
const waitMaps=async()=>{const textures=[...sandMeshes(source),...sandMeshes(copy)].flatMap(m=>[m.material.map,m.material.normalMap,m.material.aoMap]);
  const started=performance.now();while(!textures.every(t=>t?.image?.complete&&t.image.naturalWidth>0)){
    if(performance.now()-started>20000)throw new Error('Registered shoreline maps did not load');
    await new Promise(resolve=>setTimeout(resolve,25));}};
const report=()=>{const meshes=sandMeshes(copy), material=meshes[0].material;
  status.textContent=JSON.stringify({ready:true,rebuilds,source:sourceSand.material.type,copy:material.type,
    copyChunks:meshes.length,uniqueCopyMaterials:new Set(meshes.map(m=>m.material)).size,
    environmentPatches:copy.customUnitySand.length,
    uniqueCopyMaps:new Set(meshes.flatMap(m=>[m.material.map,m.material.normalMap,m.material.aoMap])).size,
    mapSlots:[material.map.name,material.normalMap.name,material.aoMap.name],
    normalScale:material.normalScale.toArray(),aoProgram:material.customProgramCacheKey(),
    roughness:material.roughness,metalness:material.metalness,memory:metrics(),baseline},null,2);};
async function rebuild(){const previous=copy;copy=new Level(copyScene,{id:'__material_review_copy',name:data.name,data});
  showOnlySand(copy,copyScene);previous.dispose(copy);await waitMaps();rebuilds++;render();report();}
try{
  source=new Level(sourceScene,{id:'beachfront',name:'Beachside Run'});
  data=normalizeCustomLevelData(source.captureData());if(!data)throw new Error('Native capture rejected');
  copy=new Level(copyScene,{id:'__material_review_copy',name:data.name,data});
  showOnlySand(source,sourceScene);showOnlySand(copy,copyScene);sourceSand=sandMeshes(source)[0];
  sourceSand.updateWorldMatrix(true,false);
  const target=new THREE.Vector3().fromBufferAttribute(sourceSand.geometry.attributes.position,82*65+24).applyMatrix4(sourceSand.matrixWorld);
  camera.position.copy(target).add(new THREE.Vector3(25,19,26));camera.lookAt(target);
  await waitMaps();render();baseline=metrics();report();
  for(const button of document.querySelectorAll('button'))button.disabled=false;
  document.querySelector('#rebuild').onclick=async()=>{try{await rebuild();}catch(error){status.textContent=error.stack;}};
  document.querySelector('#stress').onclick=async()=>{try{for(let i=0;i<5;i++)await rebuild();
    if(metrics().textures!==baseline.textures||metrics().geometries!==baseline.geometries)throw new Error('GPU resource count grew across rebuilds');
    report();}catch(error){status.textContent=error.stack;}};
  document.querySelector('#patches').onclick=async()=>{try{
    const patchData={v:1,name:'256-patch shared texture budget',spawn:[target.x,target.y+2,target.z],killY:target.y-40,
      unitySand:Array.from({length:256},(_,i)=>({p:[target.x+(i%16-7.5)*3,target.y-1,target.z+(Math.floor(i/16)-7.5)*3],s:[2.4,.7,2.4],yaw:(i%4)*90})),
      components:[...[0,1].map(i=>({t:'mesh',p:[target.x+i*4,target.y,target.z],vertices:[-1,0,0,1,0,0,0,0,-1],indices:[0,1,2],materialStyle:'unity-sand',tex:'sand',color:i?'#eeeeff':'#ffffff'})),
        {t:'gate',p:[target.x,target.y,target.z+10]}]};
    data=normalizeCustomLevelData(patchData);if(!data)throw new Error('Full patch limit rejected');patchMode=true;
    camera.position.copy(target).add(new THREE.Vector3(55,62,63));camera.lookAt(target);
    await rebuild();baseline=metrics();
    if(baseline.textures!==6)throw new Error(`Source plus256 patches/mesh variants requested ${baseline.textures} textures instead of6`);
    report();
  }catch(error){status.textContent=error.stack;console.error(error);}};
}catch(error){status.textContent=error.stack;console.error(error);}
