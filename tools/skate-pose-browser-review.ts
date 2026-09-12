// Visual QA of the real Player pose path, including asynchronous character assets.
import * as THREE from 'three';
import { Player } from '../src/player';
import { Rail } from '../src/rails';
import { DECK_TRICKS, GRAB_TRICKS, GRIND_TRICKS, GRAB_CONTACTS, GRIND_CONTACTS, LIP_CONTACTS } from '../src/skateTricks';
import { SPECIAL_TRICKS } from '../src/specialTricks';
const scene=new THREE.Scene();scene.background=new THREE.Color('#e6e4dd');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xddefff,0x8a816b,2.6));
const sun=new THREE.DirectionalLight(0xfff3d8,3.3);sun.position.set(4,8,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0xcecec3,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(30,30,0xacb1ac,0xc0c4bc);grid.position.y=.002;scene.add(grid);
const wall=new THREE.Mesh(new THREE.PlaneGeometry(8,5),new THREE.MeshStandardMaterial({color:0xb7c6c0,side:THREE.DoubleSide}));wall.rotation.y=Math.PI/2;wall.position.set(-.55,2.5,0);scene.add(wall);
const rail=new Rail([new THREE.Vector3(0,.8,4),new THREE.Vector3(0,.8,-4)]);scene.add(rail.object);
const p:any=new Player(scene);p.competitionMode=true;p.freeSkate=p.airFromSkate=true;p.skateMountT=-1;
const camera=new THREE.PerspectiveCamera(38,1,.03,100);
const trick=document.querySelector<HTMLSelectElement>('#trick')!,view=document.querySelector<HTMLSelectElement>('#view')!,stance=document.querySelector<HTMLSelectElement>('#stance')!;
const phase=document.querySelector<HTMLInputElement>('#phase')!,play=document.querySelector<HTMLButtonElement>('#play')!;
const entries=[...Object.entries(GRIND_TRICKS).map(([id,t])=>({id:`grind:${id}`,label:t.label})),
  ...GRAB_TRICKS.map(t=>({id:`grab:${t.kind}`,label:t.label})),...DECK_TRICKS.map(t=>({id:`flip:${t.kind}`,label:t.label})),
  ...SPECIAL_TRICKS.map(t=>({id:`special:${t.id}`,label:t.label})),
  ...Object.entries(LIP_CONTACTS).map(([id,t])=>({id:`lip:${id}`,label:t.label})),
  ...['Rolling','Ollie','Manual','Nose Manual','Wallride','Revert'].map(t=>({id:`basic:${t}`,label:t}))];
for(const t of entries){const o=document.createElement('option');o.value=t.id;o.textContent=t.label;trick.append(o);}
let clock=0,playing=true,elapsed=0,last=0;
const input={moveX:0,moveY:0};
const reset=()=>{elapsed=0;p.skateAnimation?.reset();p.grindPoseX=p.grindPoseZ=p.grindYawPose=p.grindCrossPose=0;p.grabPose=0;};
trick.onchange=reset;stance.onchange=reset;
play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';};
document.querySelector<HTMLButtonElement>('#next')!.onclick=()=>{trick.selectedIndex=(trick.selectedIndex+1)%entries.length;reset();};
phase.oninput=()=>{playing=false;play.textContent='Play';elapsed=Number(phase.value)*2.6;};
function render(now:number){
  const dt=Math.min(.035,(now-last)/1000||1/60);last=now;clock+=dt;if(playing)elapsed=(elapsed+dt*.48)%2.6;
  const u=elapsed/2.6;phase.value=String(u);const [category,id]=trick.value.split(':');
  p.runTime=clock;p.stance=Number(stance.value);p.rawInput=input;p.visualYaw=0;p.speed=8;p.balance=0;
  p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.sidePose=p.deckPose=1;p.skatePose=1;
  p.state=category==='grind'||id==='darkslide'?'grind':category==='lip'||category==='basic'&&id!=='Ollie'&&id!=='Wallride'?'ride':'air';
  p.grounded=p.state==='ride';p.grindStyle=category==='grind'?id:'board';p.grindRail=p.state==='grind'?rail:null;
  p.skatePose=p.grounded?1:0;
  p.grindT=4;p.grindDir=1;p.grindCrossDir=1;p.grindApproachSide=1;p.grindYawDir=1;
  p.grabKind=category==='grab'?id:'mute';p.grabPhase=category==='grab'&&u>.08&&u<.82?'held':'none';
  p.specialGrind=id==='darkslide'?SPECIAL_TRICKS[2]:null;p.specialGrab=id==='the-900'?SPECIAL_TRICKS[1]:null;
  p.specialFlip=id==='kickflip-mctwist'?SPECIAL_TRICKS[0]:null;
  if(p.specialGrab)p.grabPhase=u>.08&&u<.85?'held':'none';
  if(!playing)p.grabPose=p.grabPhase==='held'?1:0;
  p.flipKind=category==='flip'?id:'kick';p.flipDuration=1;p.flipT=category==='flip'||p.specialFlip?Math.max(.000001,1-u):0;
  p.grabSpinAngle=p.specialGrab?Math.PI*5*p.stance*(u*u*(3-2*u)):0;p.deckYawOffset=id==='Revert'?Math.PI:0;
  p.revertPoseT=id==='Revert'?.22*(1-u):0;p.revertPoseSign=p.stance;
  p.manualing=id==='Manual'?1:id==='Nose Manual'?-1:0;p.lipStallT=category==='lip'?1:0;p.lipStyle=category==='lip'?id:'axle';p.boardOllieAir=id==='Ollie';
  p.wallriding=id==='Wallride';p.wallridePose=p.wallriding?1:0;p.wallNormal.set(1,0,0);
  if(p.skateAnimation&&id==='Ollie')p.skateAnimation.airAge=u*.7;
  p.pos.set(0,p.state==='grind'?.95:category==='lip'?.8:p.grounded?0:.7+Math.sin(u*Math.PI)*.4,0);p.prevPos.copy(p.pos);
  p.alignPose=p.alignNormal.x=p.alignNormal.z=0;p.alignNormal.y=1;p.slopePose=p.slopeRoll=0;
  p.syncVisual(input,1/60);rail.object.visible=p.state==='grind'||p.lipStallT>0;rail.object.rotation.y=category==='lip'?Math.PI/2:0;wall.visible=p.wallriding;
  const head=p.headM.getWorldPosition(new THREE.Vector3()),board=p.boardG.getWorldPosition(new THREE.Vector3());
  const target=head.clone().lerp(board,.50);target.y+=.35;target.x-=.60;
  const angle=view.value==='Side'?Math.PI/2:view.value==='Front'?Math.PI:view.value==='Back'?0:view.value==='Orbit'?clock*.22:.85;
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*6.6,1.8,Math.cos(angle)*6.6));camera.up.set(0,1,0);camera.lookAt(target);
  renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.render(scene,camera);
  const c=p.boardG.userData.skateContact,g=p.boardG.userData.skateGrab;
  document.querySelector('#definition')!.textContent=category==='grind'?`${GRIND_CONTACTS[id as keyof typeof GRIND_CONTACTS].support.replaceAll('-',' ')} stays on the rail.`
    :category==='grab'?`${GRAB_CONTACTS[id as keyof typeof GRAB_CONTACTS].hand} hand · ${GRAB_CONTACTS[id as keyof typeof GRAB_CONTACTS].edge} edge.`
      :category==='flip'?'Pop · separate · rotate · catch. The rider keeps the takeoff heading.':entries[trick.selectedIndex].label;
  document.querySelector('#metrics')!.textContent=JSON.stringify({trick:trick.value,phase:+u.toFixed(3),stance:p.stance,footError:c?.footError,handError:g?.error,contact:c?.support},null,2);
  requestAnimationFrame(render);
}requestAnimationFrame(render);
