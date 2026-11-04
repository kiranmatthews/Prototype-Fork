import * as THREE from 'three';
import { milkBlob, MILK_VARIANTS, updateMilkMotion, kickMilkMotion, resetMilkMotion } from '../src/milk';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,100);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(devicePixelRatio);renderer.setClearColor(0x152d30);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
document.body.prepend(renderer.domElement);
const hemisphere=new THREE.HemisphereLight(0xdbedff,0x819383,1.4);scene.add(hemisphere);
const key=new THREE.DirectionalLight(0xffe7c8,1.9);key.position.set(-3,3,5);scene.add(key);
const fill=new THREE.DirectionalLight(0xd2e9ff,.65);fill.position.set(4,1,2);scene.add(fill);
const rim=new THREE.DirectionalLight(0xffcd80,.65);rim.position.set(1,3,-3);scene.add(rim);
const models=MILK_VARIANTS.map((name,i)=>{
 const blob=milkBlob(1,i);scene.add(blob);
 const label=document.createElement('div');label.className='label';label.innerHTML=`<b>${String(i+1).padStart(2,'0')}</b> ${name}`;document.body.append(label);
 return {blob,label,lastCycle:-1};
});
let mode='idle',elapsed=0,light='studio',turn=true,view='front',native=true,hero=false;
const controls=document.querySelector('nav')!;
function button(text:string,click:(b:HTMLButtonElement)=>void,id?:string){const b=document.createElement('button');b.textContent=text;if(id)b.id=id;b.onclick=()=>click(b);controls.append(b);return b;}
for(const [value,label]of [['idle','Idle'],['crate','Crate release'],['hud','Collection flight']]){
 const b=button(label,()=>{mode=value;elapsed=0;models.forEach(m=>{resetMilkMotion(m.blob);m.lastCycle=-1;});
 controls.querySelectorAll('[data-mode]').forEach(e=>e.setAttribute('aria-pressed',String((e as HTMLElement).dataset.mode===mode)));});
 b.dataset.mode=value;b.setAttribute('aria-pressed',String(value===mode));
}
button('Lighting: Studio',b=>{
 light=light==='studio'?'shade':light==='shade'?'sunset':'studio';b.textContent=`Lighting: ${light[0].toUpperCase()+light.slice(1)}`;
 hemisphere.intensity=light==='shade'?.85:1.4;hemisphere.color.set(light==='sunset'?0xb6bdeb:0xdbedff);
 key.color.set(light==='sunset'?0xffaa56:0xffe0b3);key.intensity=light==='shade'?.55:light==='sunset'?1.9:1.9;
 key.position.x=light==='shade'?4:-3;fill.intensity=light==='shade'?.4:.65;rim.intensity=light==='shade'?.35:.65;
 renderer.setClearColor(light==='shade'?0x0c1d29:light==='sunset'?0x302232:0x152d30);
});
button('Turntable: on',b=>{turn=!turn;b.textContent=`Turntable: ${turn?'on':'off'}`;});
button('View: Front',b=>{view=view==='front'?'back':view==='back'?'top':'front';b.textContent=`View: ${view[0].toUpperCase()+view.slice(1)}`;});
button('View: Collection',b=>{hero=!hero;b.textContent=hero?'View: Detail':'View: Collection';});
button('Resolution: MAX',b=>{native=!native;renderer.setPixelRatio(native?devicePixelRatio:Math.min(1,720/innerHeight));b.textContent=`Resolution: ${native?'MAX':'720p'}`;});
const play=document.createElement('a');play.href='./?playtest&level=jungle';play.textContent='Play Jungle';controls.append(play);
const point=new THREE.Vector3(),velocity=new THREE.Vector3();let last=performance.now(),width=0,height=0;
function frame(now:number){
 const dt=Math.min(.05,(now-last)*.001);last=now;elapsed+=dt;
 const w=innerWidth,h=innerHeight,portrait=w<650;
 if(width!==w||height!==h){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 camera.position.set(0,.12,Math.max(portrait?8.8:6.7,(portrait?1.65:2.7)/(Math.tan(16*Math.PI/180)*camera.aspect)));camera.lookAt(0,.12,0);
 models.forEach((m,i)=>{
  const {blob,label}=m,x=portrait?(i%2-.5)*1.5:(i%3-1)*1.75,y=portrait?1.4-Math.floor(i/2)*1.45:.9-Math.floor(i/3)*1.6;
  blob.visible=!hero||i===0;label.style.display=hero?'none':'';
  blob.scale.setScalar(hero?3.5:1);
  blob.position.set(hero?0:x,hero?-.06:y,0);velocity.set(0,0,0);
  blob.rotation.set(view==='top'?.95:0,(view==='back'?Math.PI:0)+(turn?elapsed*.22+i*.16:0),0);
  const age=Math.max(0,elapsed-i*.12),cycle=Math.floor(age/3),u=age%3;
  if(mode==='crate'){
   if(cycle!==m.lastCycle&&elapsed>=i*.12){kickMilkMotion(blob);m.lastCycle=cycle;}
   if(u<.6&&elapsed>=i*.12){const t=u/.6;blob.position.y+=.24*4*t*(1-t);velocity.y=.9*4*(1-2*t)/.6;}
  }else if(mode==='hud'){
   const t=Math.min(1,u/1.2);blob.position.x+=-.3+.6*t;blob.position.y+=.13*Math.sin(t*Math.PI);
   if(cycle!==m.lastCycle){resetMilkMotion(blob);m.lastCycle=cycle;}
   if(t<1)velocity.set(.8/1.2,.18*Math.PI*Math.cos(t*Math.PI)/1.2,0).multiplyScalar(35);
  }else blob.position.y+=Math.sin(elapsed*1.5+i)*.025;
  updateMilkMotion(blob,velocity,dt,mode==='crate');
  point.set(x,y-.58,0).project(camera);label.style.left=`${(point.x*.5+.5)*w}px`;label.style.top=`${(-point.y*.5+.5)*h}px`;
 });
 renderer.render(scene,camera);
 document.querySelector('#status')!.textContent=`${renderer.domElement.width} × ${renderer.domElement.height} · ${light} · ${mode}`;
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
