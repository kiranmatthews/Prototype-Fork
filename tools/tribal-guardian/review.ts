import * as T from 'three';
import { createEnemyVisual } from '../../src/enemies/runtime';
const scene=new T.Scene();scene.background=new T.Color('#192a31');
scene.add(new T.HemisphereLight(0xd9efff,0x62734f,2.3));
const sun=new T.DirectionalLight(0xffdfb0,3.5);sun.position.set(-3,6,4);scene.add(sun);
const fill=new T.DirectionalLight(0xd2e7ef,1.2);fill.position.set(4,3,-1);scene.add(fill);
const floor=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:0x425644,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;scene.add(floor);
const grid=new T.GridHelper(30,60,0x7d987d,0x526e59);scene.add(grid);
const camera=new T.PerspectiveCamera(30,1,.02,100);camera.position.set(0,2.8,13.5);camera.lookAt(0,1.4,0);
const renderer=new T.WebGLRenderer({antialias:true});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
let native=true;function resize(){renderer.setPixelRatio(native?devicePixelRatio:1);renderer.setSize(native?innerWidth:Math.round(innerWidth*480/innerHeight),native?innerHeight:480,false);renderer.domElement.style.width='100vw';renderer.domElement.style.height='100vh';camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}resize();addEventListener('resize',resize);
const yaw=[0,40,90],actors=yaw.map((a,i)=>{const v=createEnemyVisual('grunt',{appearance:'tribal'});v.group.position.x=(i-1)*3.1;v.group.rotation.y=a*Math.PI/180;scene.add(v.group);return v;});
let mode='walk',time=0,playing=true,last=performance.now(),ready=false;
const status=document.querySelector('#status')!,timeInput=document.querySelector<HTMLInputElement>('#time')!;
function frame(t:number){const alive=mode!=='defeat'&&mode!=='fling';return {state:alive?(mode==='turn'?'turn':'patrol'):'defeated',stateTime:t,time:t,speed:mode==='walk'?2.8:0,grounded:mode!=='fling',verticalVelocity:0,alive,flung:mode==='fling',inPlace:true};}
function render(dt:number){
  actors.forEach((v,i)=>{v.group.rotation.y=(yaw[i]+(mode==='turn'?180*Math.min(1,time/.38):0))*Math.PI/180;v.update(dt,frame(time));});
  scene.updateMatrixWorld(true);renderer.render(scene,camera);
  if(ready)status.textContent=JSON.stringify({mode,time:+time.toFixed(3),buffer:[renderer.domElement.width,renderer.domElement.height],status:actors.map(v=>v.diagnostics.status),clip:actors[0].diagnostics.activeClip,contacts:actors[0].diagnostics.plantedFeet,torsoScale:actors[0].group.getObjectByName('mixamorigSpine2')?.matrix.elements.slice(0,3),rootScale:actors[0].group.scale.toArray()});
}
function reset(){time=0;actors.forEach(v=>v.reset());render(0);}
for(const name of ['walk','idle','turn','defeat','fling'])document.querySelector('#'+name)!.addEventListener('click',()=>{mode=name;reset();playing=true;document.querySelector('#pause')!.textContent='Pause';});
document.querySelector('#pause')!.addEventListener('click',event=>{playing=!playing;(event.target as HTMLElement).textContent=playing?'Pause':'Play';});
document.querySelector('#sample')!.addEventListener('click',()=>{const target=Math.max(0,Number(timeInput.value));playing=false;document.querySelector('#pause')!.textContent='Play';reset();for(let i=0;i<Math.ceil(target*120);i++){const dt=Math.min(1/120,target-time);time+=dt;actors.forEach(v=>v.update(dt,frame(time)));}render(0);});
document.querySelector('#normal')!.addEventListener('click',()=>{native=false;resize();render(0);});document.querySelector('#native')!.addEventListener('click',()=>{native=true;resize();render(0);});
await Promise.all(actors.map(v=>v.ready));ready=true;render(0);
function animate(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing){time+=dt;render(dt);}requestAnimationFrame(animate);}requestAnimationFrame(animate);
