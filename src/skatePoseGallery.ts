import './skatePoseGallery.css';
import * as THREE from 'three';
import {Player} from './player';
import {Halfpipe} from './halfpipe';
import {RigBinding, sampleComposedClip, clipTimeAt, createProceduralMotionContext, createLocalDraftStore, createPreferredDraftStore, type AnimationClip} from './animation';
import {SKATE_REVIEW_ENTRIES, loadSkateReviewCatalog, skateBoardVisibleAt, withSkatePresentationRig, type SkateReviewEntry} from './animation/skateCatalog';
declare const __BUILD_CHANNEL__: string;
declare const __BUILD_TAG__: string;

const grid=document.querySelector<HTMLDivElement>('#grid')!;
const play=document.querySelector<HTMLButtonElement>('#play')!;
const speed=document.querySelector<HTMLSelectElement>('#speed')!;
const view=document.querySelector<HTMLSelectElement>('#view')!;
const category=document.querySelector<HTMLSelectElement>('#category')!;
const scrub=document.querySelector<HTMLInputElement>('#scrub')!;
const status=document.querySelector<HTMLParagraphElement>('#status')!;
const studies=document.querySelector<HTMLButtonElement>('#studies')!;
document.querySelector('#build-stamp')!.textContent=`${__BUILD_CHANNEL__} · build ${__BUILD_TAG__}`;
const views=[['','Global view'],['front','Front three-quarter'],['rear','Rear three-quarter'],['side','Board side'],['nose','Board nose'],['orbit','Orbit']];
interface Card { entry:SkateReviewEntry; element:HTMLElement; stage:HTMLElement; pause:HTMLButtonElement; view:HTMLSelectElement; time:HTMLElement; bar:HTMLElement; clip?:AnimationClip; frozen:number|null; cursor:number; rect:DOMRect; }
let playing=true,clock=0,last=0,lastLabels=0,ready=false,dirty=true;
let usingStudies=false,notice='',noticeUntil=0;
const cards:Card[]=[];
const duration=(card:Card)=>card.clip?Math.max(.001,(card.clip.range.end-card.clip.range.start)/Math.max(.01,card.clip.playbackSpeed))*(card.clip.loop.mode==='ping-pong'?2:1):card.entry.duration;
const timeline=(card:Card)=>card.clip?clipTimeAt(card.clip,card.frozen??card.cursor):card.cursor;
for(const entry of SKATE_REVIEW_ENTRIES){
  const el=document.createElement('article');el.className='pose-card';el.id=entry.number;el.dataset.poseId=entry.id;
  el.innerHTML=`<header class="card-heading"><span class="pose-number">${entry.number}</span><h2>${entry.name}</h2><span class="card-category">${entry.category}</span></header><div class="pose-stage" role="img" aria-label="${entry.number} ${entry.name} animation"><span class="loading">Preparing pose…</span></div><footer class="card-footer"><div class="card-controls"><button type="button" class="card-pause" aria-label="Pause ${entry.number}" aria-pressed="false">Pause</button><select aria-label="View for ${entry.number}">${views.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select><a href="./?playtest&level=codex-lab&lite&skateClip=${encodeURIComponent(entry.clipId)}#animationstudio" target="_blank" rel="noopener" aria-label="Edit ${entry.number} ${entry.name} in Animation Lab">Edit in Lab ↗</a><time>0.00 s</time></div><div class="pose-progress"><span></span></div><button class="copy-prompt" type="button">Copy repair prompt</button></footer>`;
  grid.append(el);
  const card:Card={entry,element:el,stage:el.querySelector('.pose-stage')!,pause:el.querySelector('.card-pause')!,view:el.querySelector('select')!,time:el.querySelector('time')!,bar:el.querySelector('.pose-progress span')!,frozen:null,cursor:0,rect:el.getBoundingClientRect()};
  card.pause.onclick=()=>{card.frozen=card.frozen===null?card.cursor%duration(card):null;card.pause.textContent=card.frozen===null?'Pause':'Play';card.pause.setAttribute('aria-pressed',String(card.frozen!==null));card.pause.setAttribute('aria-label',`${card.frozen===null?'Pause':'Play'} ${entry.number}`);dirty=true;};
  card.view.onchange=()=>dirty=true;
  const copy=el.querySelector<HTMLButtonElement>('.copy-prompt')!;
  copy.onclick=async()=>{
    const time=timeline(card);
    const text=`Repair ${entry.number} — ${entry.name} (${entry.id}). At ${time.toFixed(2)} s, ${card.view.selectedOptions[0].textContent==='Global view'?view.selectedOptions[0].textContent:card.view.selectedOptions[0].textContent}, right foot forward: [describe what needs repair]. Preserve the intended contact and the shared stretch, compression and rebound.`;
    try { await navigator.clipboard.writeText(text);copy.textContent='Copied — paste and add your notes'; }
    catch { const field=document.createElement('textarea');field.value=text;copy.after(field);field.select();copy.textContent='Select and copy the prompt below'; }
  };
  cards.push(card);
}
for(const name of [...new Set(SKATE_REVIEW_ENTRIES.map(e=>e.category))]){const option=document.createElement('option');option.textContent=name;category.add(option);}
function measure(){for(const card of cards)card.rect=card.stage.getBoundingClientRect();dirty=true;}
category.onchange=()=>{for(const card of cards)card.element.hidden=category.value!=='All poses'&&card.entry.category!==category.value;window.scrollTo({top:0,behavior:'auto'});measure();requestAnimationFrame(measure);};
play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause all':'Play all';dirty=true;};
view.onchange=()=>dirty=true;
scrub.oninput=()=>{playing=false;play.textContent='Play all';for(const card of cards){card.cursor=Number(scrub.value)*duration(card);if(card.frozen!==null)card.frozen=card.cursor;}dirty=true;};
document.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>{clock=0;for(const card of cards){card.cursor=0;card.frozen=null;card.pause.textContent='Pause';card.pause.setAttribute('aria-pressed','false');card.pause.setAttribute('aria-label',`Pause ${card.entry.number}`);}playing=true;play.textContent='Pause all';dirty=true;};
// Play all releases a shared scrub while retaining individually paused cards.
play.addEventListener('click',()=>{if(playing)for(const card of cards){card.frozen=null;card.pause.textContent='Pause';card.pause.setAttribute('aria-pressed','false');card.pause.setAttribute('aria-label',`Pause ${card.entry.number}`);}});
window.addEventListener('scroll',measure,{passive:true});window.addEventListener('resize',measure);

async function start(){
  const data=await loadSkateReviewCatalog();
  studies.disabled=false;
  studies.onclick=async()=>{
    studies.disabled=true;
    try {
      let clips=data.clips;
      if(!usingStudies){
        const store=createPreferredDraftStore({fallback:createLocalDraftStore()});
        const draft=await store.load('player-animation-suite');
        if(!draft?.clips.some(clip=>clip.metadata?.reviewCapture===true))throw new Error('No saved skate studies yet. Open a pose in the Lab first.');
        clips=draft.clips;
      }
      for(const card of cards){card.clip=clips.find(clip=>clip.id===card.entry.clipId)??data.clips.find(clip=>clip.id===card.entry.clipId);card.cursor=0;card.frozen=null;card.pause.textContent='Pause';card.pause.setAttribute('aria-pressed','false');card.pause.setAttribute('aria-label',`Pause ${card.entry.number}`);}
      usingStudies=!usingStudies;studies.textContent=usingStudies?'Use game captures':'Use Lab edits';dirty=true;
    } catch(error){notice=error instanceof Error?error.message:String(error);noticeUntil=performance.now()+6000;}
    finally{studies.disabled=false;}
  };
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.domElement.className='sheet-canvas';renderer.domElement.dataset.testid='skate-grid-canvas';document.body.prepend(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#edf0e9');
  scene.add(new THREE.HemisphereLight(0xe9f4ff,0x92856f,2.6));
  const sun=new THREE.DirectionalLight(0xffefdb,3.0);sun.position.set(-4,8,-3);scene.add(sun);
  const scratch=new THREE.Scene(),player=new Player(scratch);
  player.group.position.set(0,0,0);player.group.rotation.set(0,Math.PI,0);scene.add(player.group);
  const rig=player.enterAnimationPreview();
  const binding=RigBinding.fromDefinition(rig.root,withSkatePresentationRig(RigBinding.fromSculptRuntime(rig.root).definition));
  const board=rig.root.getObjectByName('board')!;board.visible=true;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0xe1e6dc,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
  const stageGrid=new THREE.GridHelper(12,12,0xc4cec1,0xd6ddd2);stageGrid.position.y=-.01;scene.add(stageGrid);
  const rail=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,6,8),new THREE.MeshStandardMaterial({color:0x829891,roughness:.45,metalness:.25}));rail.rotation.x=Math.PI/2;rail.position.y=.8;scene.add(rail);
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(6,5),new THREE.MeshStandardMaterial({color:0xc5d3c6,side:THREE.DoubleSide}));wall.rotation.y=Math.PI/2;wall.position.set(-.55,2.5,0);scene.add(wall);
  const pipe=new Halfpipe(5,-5,0,2,3,new THREE.MeshStandardMaterial({color:0xc5d3c6,side:THREE.DoubleSide}),5,'x');scene.add(pipe.object);
  const camera=new THREE.PerspectiveCamera(35,1,.03,80),target=new THREE.Vector3();
  const motion=createProceduralMotionContext();
  for(const card of cards){card.clip=data.clips.find(clip=>clip.id===card.entry.clipId);card.stage.classList.add('ready');}
  ready=true;play.disabled=false;measure();
  let width=0,height=0;
  function render(now:number){
    const dt=Math.min(.25,(now-last)/1000||0);last=now;if(playing){clock+=dt*Number(speed.value);for(const card of cards)if(card.frozen===null)card.cursor=(card.cursor+dt*Number(speed.value))%duration(card);}
    if(innerWidth!==width||innerHeight!==height){width=innerWidth;height=innerHeight;renderer.setSize(width,height,false);measure();}
    const live=cards.filter(card=>!card.element.hidden&&card.rect.bottom>0&&card.rect.top<height&&card.rect.right>0&&card.rect.left<width);
    const changed=dirty;
    if(playing||dirty){
      renderer.setScissorTest(false);scene.background=null;renderer.setClearColor(0,0);renderer.clear();scene.background=new THREE.Color('#edf0e9');renderer.setScissorTest(true);
      for(const card of live){
        const r=card.rect,t=timeline(card);
        player.applyAnimationDeformations({});
        const pose=sampleComposedClip(card.clip!,t,motion);binding.applyPose(pose,{resetUnspecified:true});
        player.applyAnimationDeformations(pose.scalars);player.syncCharacterAppearance({upperArmRestAngleWeight:0});board.visible=skateBoardVisibleAt(card.clip!,t);
        rail.visible=card.entry.category==='Grinds'||card.entry.category==='Lip stalls'||card.entry.id==='special:darkslide';rail.rotation.z=card.entry.category==='Lip stalls'?Math.PI/2:0;rail.position.y=Number(card.clip?.metadata?.reviewRailHeight??.8);
        wall.visible=card.entry.id==='basic:Wallride';
        pipe.object.visible=card.clip?.metadata?.reviewPipe===true;
        const airborne=card.entry.category==='Flips'||card.entry.category==='Grabs'||card.entry.category==='Specials'&&card.entry.id!=='special:darkslide'||card.entry.id==='basic:Ollie';
        const rootPosition=pose.joints.skateBody?.position??[0,0,0];
        target.set(-rootPosition[0],rootPosition[1]+1.25,-rootPosition[2]);
        const mode=card.view.value||view.value;
        const angle=mode==='front'?-2.35:mode==='rear'?.8:mode==='side'?-Math.PI/2:mode==='nose'?Math.PI:clock*.28;
        const distance=airborne?7.8:6.7;
        camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*distance,1.7,Math.cos(angle)*distance));camera.lookAt(target);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
        renderer.setViewport(r.left,height-r.bottom,r.width,r.height);renderer.setScissor(r.left,height-r.bottom,r.width,r.height);renderer.render(scene,camera);
      }
      dirty=false;
    }
    if(changed||now-lastLabels>200){
      for(const card of cards){const t=timeline(card);card.time.textContent=`${t.toFixed(2)} s`;card.element.dataset.time=t.toFixed(3);card.bar.style.transform=`scaleX(${(card.frozen??card.cursor)/duration(card)})`;}
      status.textContent=now<noticeUntil?notice:`${cards.filter(c=>!c.element.hidden).length} of ${cards.length} poses · 3 columns · ${playing?'Looping':'Paused'} · ${usingStudies?'Lab edits':'Game captures'} · ${live.length} in view`;
      lastLabels=now;
    }
    requestAnimationFrame(render);
  }
  // Asset readiness is independent of playback. Redraw a paused sheet when
  // streamed character surfaces arrive, without advancing any playheads.
  THREE.DefaultLoadingManager.onLoad=()=>dirty=true;
  requestAnimationFrame(render);
  if(location.hash){const entry=document.getElementById(location.hash.slice(1));entry?.scrollIntoView({block:'start'});measure();}
}
start().catch(error=>{const failure=document.querySelector<HTMLParagraphElement>('#failure')!;failure.hidden=false;failure.textContent=`${error instanceof Error?error.message:String(error)} Please reload this page. The contact sheet must be opened over HTTP, not as raw TypeScript.`;status.textContent='The contact sheet could not start.';console.error(error);});
window.addEventListener('pageshow',()=>{if(ready)measure();});
