import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CarlisleMarineNet} from '../../src/carlisleMarineNet.ts';

const stage=document.querySelector('#stage');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x132338);
const camera=new THREE.PerspectiveCamera(38,1,.01,1000);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(window.devicePixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;stage.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.autoRotateSpeed=1.2;
const ambient=new THREE.HemisphereLight(0xd5e7ff,0x3b2b22,2.1);scene.add(ambient);
const key=new THREE.DirectionalLight(0xffe4c8,3.1);key.position.set(4,7,6);scene.add(key);
const rim=new THREE.DirectionalLight(0x82b9ff,2);rim.position.set(-5,3,-4);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x1a2b3d,roughness:.76,metalness:.1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const library=await fetch('./models.json').then(r=>r.json());
const props=await fetch('/docs/carlisle-relay/shipyard-polish/props.json').then(r=>r.json());
const propById=new Map(props.assets.map(p=>[p.id,p]));
const housing=library.assets.find(a=>a.id==='01-net-housing');
const options=[{id:'procedural-net',name:'Orange marine net · procedural',procedural:true},...(housing?[{...housing,id:'assembled-net',name:'Net and housing · assembled',assembly:true}]:[]),...library.assets];
const select=document.querySelector('#asset');for(const asset of options){const option=document.createElement('option');option.value=asset.id;option.textContent=asset.name;select.append(option)}
let current=null,net=null,loading=0;
const metrics=object=>{let triangles=0,meshes=0;const materials=new Set(),textures=new Set();object.traverse(node=>{if(!node.isMesh)return;meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material.uuid);for(const value of Object.values(material))if(value?.isTexture)textures.add(value.uuid)}});return{triangles,meshes,materials:materials.size,textures:textures.size}};
function frame(){
  if(!current)return;
  current.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(current),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),span=Math.max(...size.toArray());
  const vertical=THREE.MathUtils.degToRad(camera.fov/2),horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
  const distance=size.length()*.5/Math.sin(Math.min(vertical,horizontal))*1.1;
  controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.7,1.25).normalize().multiplyScalar(distance));
  camera.near=Math.max(span/1000,.001);camera.far=Math.max(100,span*100);camera.updateProjectionMatrix();controls.minDistance=span*.2;controls.maxDistance=span*12;controls.update();floor.scale.setScalar(span/12);
}
function getFraming(){
  camera.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(current),points=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera));
  return{maxX:Math.max(...points.map(p=>Math.abs(p.x))),maxY:Math.max(...points.map(p=>Math.abs(p.y)))};
}
function dispose(object){object.traverse(node=>{if(!node.isMesh)return;node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material]){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose()}})}
async function show(id){const token=++loading;document.querySelector('#error').textContent='';document.querySelector('#status').textContent='Loading asset…';const asset=options.find(a=>a.id===id)??options[0];select.value=asset.id;
 try{let object,nextNet;
  if(asset.procedural){nextNet=new CarlisleMarineNet(6,4);object=nextNet.group;object.position.y=1.1;}
  else{const gltf=await loader.loadAsync('/'+asset.model);object=gltf.scene;nextNet=null;object.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(object);const center=bounds.getCenter(new THREE.Vector3());
    if(asset.assembly){const size=bounds.getSize(new THREE.Vector3());nextNet=new CarlisleMarineNet(size.x,size.z,size.y);nextNet.group.position.set(center.x,bounds.min.y+size.y*.87,center.z);object.add(nextNet.group);}
    object.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));}
  if(token!==loading){nextNet?.dispose();dispose(object);return}
  if(current){net?.dispose();scene.remove(current);dispose(current)}current=object;net=nextNet;scene.add(current);current.name=asset.name;
  const info=metrics(current);document.querySelector('#metrics').innerHTML=Object.entries(info).map(([k,v])=>`<dt>${k}</dt><dd>${v.toLocaleString()}</dd>`).join('');
  const prop=propById.get(asset.assembly?'01-net-housing':asset.id);document.querySelector('#description').textContent=asset.assembly?'Original housing with ropes threaded through all eight measured eyelets. Woven strands, knotted crossings and a bound perimeter deform on impact.':prop?.uses??'Open diamond rope mesh. Drag to orbit, scroll to zoom, and test the compression slider.';
  const ref=document.querySelector('#reference');ref.hidden=!prop;if(prop)ref.src='/'+prop.reference;else ref.removeAttribute('src');
  document.querySelector('#net-controls').hidden=!net;document.querySelector('#compression').value='0';document.querySelector('#amount').textContent='0%';
  document.querySelector('#wire').setAttribute('aria-pressed','false');frame();history.replaceState(null,'','?asset='+asset.id);
  window.__shipyardViewer.current={id:asset.id,...info};document.querySelector('#status').textContent=`${asset.name} · drag to orbit · scroll to zoom · full geometry at every distance`;
 }catch(error){document.querySelector('#error').textContent=error.message;document.querySelector('#status').textContent='Asset failed to load';throw error}
}
document.querySelector('#bounce').onclick=()=>{document.querySelector('#compression').value='0';document.querySelector('#amount').textContent='0%';net?.setCompression(0);net?.impact(net.width*.13,-net.length*.1,55)};
select.onchange=()=>show(select.value);document.querySelector('#fit').onclick=frame;
document.querySelector('#spin').onclick=e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate))};
document.querySelector('#wire').onclick=e=>{const enabled=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(enabled));current?.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])m.wireframe=enabled})};
document.querySelector('#lighting').onclick=e=>{const night=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(night));ambient.color.setHex(night?0x688dcc:0xd5e7ff);ambient.intensity=night?1.3:2.1;key.color.setHex(night?0xff7935:0xffe4c8);key.intensity=night?3.8:3.1;scene.background.setHex(night?0x061225:0x132338)};
document.querySelector('#compression').oninput=e=>{net?.setCompression(+e.target.value);document.querySelector('#amount').textContent=Math.round(+e.target.value*100)+'%'};
new ResizeObserver(()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();frame()}).observe(stage);
window.__shipyardViewer={show,scene,camera,renderer,controls,loader,getFraming,getObject:()=>current,getNet:()=>net,bounce:(x=0,z=0)=>net?.impact(x,z,55),exportCurrent:async()=>{const baked=net?.bakeForExport();let object=current;if(baked){if(current===net.group)object=baked.group;else{object=current.clone(true);const old=object.getObjectByName(net.group.name),parent=old.parent;parent.remove(old);parent.add(baked.group)}}try{return Array.from(new Uint8Array(await new GLTFExporter().parseAsync(object,{binary:true})))}finally{baked?.dispose()}},exportNet:async()=>{const original=new CarlisleMarineNet(6,4),baked=original.bakeForExport();try{return Array.from(new Uint8Array(await new GLTFExporter().parseAsync(baked.group,{binary:true})))}finally{baked.dispose();original.dispose()}}};
await show(new URLSearchParams(location.search).get('asset')??options[0].id);
let last=performance.now();renderer.setAnimationLoop(now=>{net?.update(Math.min(.05,(now-last)/1000));last=now;controls.update();renderer.render(scene,camera)});
