import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {acquireConeAsset, ConeActor} from '../../src/carlisleCone.ts';
const stage=document.querySelector('#stage'), scene=new THREE.Scene();scene.background=new THREE.Color(0x102438);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(devicePixelRatio);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;stage.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(36,1,.01,100);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,1.3,0);
const sky=new THREE.HemisphereLight(0xd4e4ff,0x3c2c25,2.2);scene.add(sky);
const key=new THREE.DirectionalLight(0xffe9d2,3);key.position.set(4,6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.015;scene.add(key);
const rim=new THREE.DirectionalLight(0x92bfff,2);rim.position.set(-4,4,-3);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(4,80),new THREE.MeshStandardMaterial({color:0x183049,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
const ring=new THREE.Mesh(new THREE.RingGeometry(2,2.02,100),new THREE.MeshBasicMaterial({color:0xff7836,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;scene.add(ring);
const lease=acquireConeAsset();let actor,playing=true,speed=1,angle=0;
const api={ready:false,error:null,actor:null,renderer,scene,camera,controls,cycles:{},clip:'idle',angle:0};window.__coneReview=api;
function view(degrees){angle=degrees;const theta=degrees*Math.PI/180;camera.position.set(Math.sin(theta)*6.2,2.35,Math.cos(theta)*6.2);controls.target.set(0,1.32,0);controls.update();api.angle=degrees;}
function choose(name){actor.play(name);api.clip=name;document.querySelectorAll('[data-clip]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clip===name)));}
function sample(phase){actor.sample(phase*actor.duration);renderer.render(scene,camera);}
function playback(value){playing=value;document.querySelector('#play').textContent=playing?'Pause':'Play';document.querySelector('#play').setAttribute('aria-pressed',String(playing));}
api.view=view;api.choose=choose;api.sample=sample;api.playback=playback;
try{
 const asset=await lease.promise;actor=new ConeActor(asset);scene.add(actor.group);api.actor=actor;
 let triangles=0,bones=0,skins=0;actor.model.traverse(n=>{if(n.isMesh)triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;if(n.isBone)bones++;if(n.isSkinnedMesh)skins++});
 api.metrics={triangles,bones,skins,clips:[...actor.clips].map(([name,clip])=>({name,duration:clip.duration,tracks:clip.tracks.length}))};
 for(const [name]of actor.clips){const b=document.createElement('button');b.dataset.clip=name;b.textContent=({idle:'Idle',walk:'Walk',jump:'Jump',slash:'Tantrum'})[name];b.onclick=()=>choose(name);document.querySelector('#clips').append(b)}
 document.querySelector('#metrics').textContent=`${triangles.toLocaleString()} triangles · ${bones} bones · ${actor.clips.size} tailored clips · original Tripo cone`;
 choose('idle');view(0);api.ready=true;
}catch(error){api.error=error.message;document.querySelector('#error').textContent=error.message;throw error;}
document.querySelector('#play').onclick=()=>playback(!playing);
document.querySelector('#time').oninput=e=>{playback(false);sample(+e.target.value)};
document.querySelector('#speed').oninput=e=>{speed=+e.target.value;document.querySelector('#speed-label').textContent=speed.toFixed(2)+'×'};
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>view(+b.dataset.angle));
document.querySelector('#light').onclick=e=>{const night=e.target.getAttribute('aria-pressed')!=='true';e.target.setAttribute('aria-pressed',String(night));sky.color.setHex(night?0x799dcc:0xd4e4ff);sky.intensity=night?1.4:2.2;key.color.setHex(night?0xff8949:0xffe9d2);key.intensity=night?3.3:3;scene.background.setHex(night?0x061225:0x102438)};
new ResizeObserver(()=>{const{width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()}).observe(stage);
let last=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(actor&&playing){const before=Math.floor(actor.time/actor.duration);actor.update(dt*speed);if(Math.floor(actor.time/actor.duration)>before)api.cycles[api.clip]=(api.cycles[api.clip]??0)+1;}
 if(actor){document.querySelector('#time').value=(actor.time%actor.duration)/actor.duration;document.querySelector('#time-label').textContent=(actor.time%actor.duration).toFixed(2)+'s / '+actor.duration.toFixed(2)+'s';}
 controls.update();renderer.render(scene,camera);
});
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);actor?.dispose();lease.release();renderer.dispose()},{once:true});
