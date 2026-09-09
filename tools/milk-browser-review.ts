import * as THREE from 'three';
import { milkBlob, MILK_SIZE, MILK_VARIANTS, updateMilkMotion, kickMilkMotion, resetMilkMotion } from '../src/milk';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x102b28);document.body.prepend(renderer.domElement);
const models=MILK_VARIANTS.map((name,i)=>{
  const blob=milkBlob(MILK_SIZE,i);scene.add(blob);
  const label=document.createElement('div');label.className='label';label.innerHTML=`${name}<small>SAME BASE SHAPE</small>`;document.body.append(label);
  return {blob,label,lastCycle:-1};
});
let mode='idle',elapsed=0,dark=true;
const controls=document.querySelector('nav')!;
for(const [value,label] of [['idle','Idle'],['crate','Crate release'],['hud','HUD flight']]){
  const button=document.createElement('button');button.textContent=label;button.dataset.mode=value;button.setAttribute('aria-pressed',String(value===mode));
  button.onclick=()=>{mode=value;elapsed=0;models.forEach(m=>{resetMilkMotion(m.blob);m.lastCycle=-1;});
    controls.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.mode===mode)));};
  controls.insertBefore(button,document.querySelector('#backdrop'));
}
document.querySelector('#backdrop')!.addEventListener('click',event=>{
  dark=!dark;document.body.classList.toggle('light',!dark);renderer.setClearColor(dark?0x102b28:0x86988f);
  (event.currentTarget as HTMLButtonElement).textContent=dark?'Dark backdrop':'Light backdrop';
});
const point=new THREE.Vector3(),velocity=new THREE.Vector3();let last=performance.now(),width=0,height=0;
function frame(now:number){
  const dt=Math.min(.05,(now-last)*.001);last=now;elapsed+=dt;
  const w=innerWidth,h=innerHeight,portrait=w<600;
  if(width!==w||height!==h){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  camera.position.set(0,0,Math.max(portrait?9:7.1,(portrait?1.65:2.55)/(Math.tan(Math.PI/10)*camera.aspect)));camera.lookAt(0,0,0);
  models.forEach((m,i)=>{
    const {blob,label}=m;
    const x=portrait?(i%2-.5)*1.35:(i%3-1)*1.5,y=portrait?1-Math.floor(i/2)*1.3:.65-Math.floor(i/3)*1.5;
    blob.position.set(x,y,0);velocity.set(0,0,0);
    const age=Math.max(0,elapsed-i*.12),cycle=Math.floor(age/3),u=age%3;
    if(mode==='crate'){
      if(cycle!==m.lastCycle&&elapsed>=i*.12){kickMilkMotion(blob);m.lastCycle=cycle;}
      if(u<.6&&elapsed>=i*.12){const t=u/.6;blob.position.y+=.35*4*t*(1-t);velocity.y=.9*4*(1-2*t)/.6;}
    }else if(mode==='hud'){
      const t=Math.min(1,u/1.2);blob.position.x+=-.4+.8*t;blob.position.y+=.18*Math.sin(t*Math.PI);
      if(cycle!==m.lastCycle){resetMilkMotion(blob);m.lastCycle=cycle;}
      if(t<1)velocity.set(.8/1.2,.18*Math.PI*Math.cos(t*Math.PI)/1.2,0).multiplyScalar(35);
    }else blob.position.y+=Math.sin(elapsed*1.5+i)*.025;
    updateMilkMotion(blob,velocity,dt,mode==='crate');
    point.set(x,y-.66,0).project(camera);label.style.left=`${(point.x*.5+.5)*w}px`;label.style.top=`${(-point.y*.5+.5)*h}px`;
  });
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
