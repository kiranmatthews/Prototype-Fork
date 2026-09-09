// Local-only live interaction review. No authored level or saved progress is edited.
import * as THREE from 'three';
import { JungleCupEvent } from '../src/competition/event';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player,initial={...p.characterProportions},initialStyle=p.characterHeadStyle;
g.competitionAction('retry');g.getCompetition().phase='running';g.level.skatepark=false;p.competitionMode=false;
JungleCupEvent.prototype.stepRun=()=>false;
const updateInput=g.input.update.bind(g.input);g.input.update=()=>{updateInput();g.input.inventoryHeld=true;};
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='interaction-review';
panel.style.cssText='position:fixed;z-index:999999;bottom:6px;left:6px;background:#082a2aee;color:white;padding:10px;width:320px;font:12px monospace';panel.innerHTML='<summary>Pickup / smash review</summary>';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='interaction-status';status.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';panel.append(controls,status);document.body.append(panel);
const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='margin:2px;padding:6px';b.onclick=fn;controls.append(b);};
let freeze=false,oneFrame=false,stopAtMagnet=false,stopAtHud=false;
const box=new THREE.Box3(),helper=new THREE.Box3Helper(box,0x4cffee);g.scene.add(helper);
const nativeStep=p.step.bind(p);
p.step=(dt:number,input:any,level:any)=>{
  if(freeze&&!oneFrame)return;oneFrame=false;
  nativeStep(dt,input,level);
  if(stopAtMagnet&&p.fruits.some((f:any)=>f.phase==='magnet')){freeze=true;stopAtMagnet=false;}
  if(stopAtHud&&p.fruits.some((f:any)=>f.phase==='fly')){freeze=true;stopAtHud=false;}
};
function reset(){
  p.respawn(g.level,true,true,{position:new THREE.Vector3(0,.02,14),heading:new THREE.Vector3(0,0,-1)});
  p.competitionMode=false;p.freeSkate=false;p.speed=0;p.rawInput=g.input;p.rawInput.moveX=p.rawInput.moveY=0;p.prepareStartPresentation(g.level);g.ui.setLevel('jungle-cup','standard',p.fruitCollectionRevision,false);freeze=false;
}
function fruit(head=false){
  p.refreshCharacterBounds();const b=p.characterBounds;
  g.level.pickup(head?(b.min.x+b.max.x)/2:b.max.x+1.5,head?b.max.y+.2:(b.min.y+b.max.y)/2,p.pos.z);
  freeze=false;
}
button('Reset',reset);button('Normal size',()=>p.setCharacterProportions(initial));
button('Large head',()=>p.setCharacterProportions({headSize:2.4,headWidth:1.5,headDepth:1.5,height:1.4}));
button('Small head',()=>p.setCharacterProportions({headSize:.7,headWidth:.7,headDepth:.7,height:.75}));
button('Skull',()=>p.setCharacterHeadStyle('skull'));button('Roo head',()=>p.setCharacterHeadStyle('alternate'));
button('Magnet fruit',()=>fruit());button('Head contact fruit',()=>fruit(true));
button('Pause at magnet',()=>{stopAtMagnet=true;fruit();});button('Pause at HUD',()=>{stopAtHud=true;freeze=false;});
button('Resume',()=>freeze=false);button('Next frame',()=>{freeze=true;oneFrame=true;});
button('Crown crates',()=>{p.refreshCharacterBounds();const b=p.characterBounds;g.level.crate(p.pos.x,b.max.y-.04,p.pos.z);g.level.crate(p.pos.x,b.max.y+1.1,p.pos.z);});
button('Crate stack',()=>{for(let i=0;i<4;i++)g.level.crate(0,i*.96,11.5);});
button('Show bounds',()=>helper.visible=!helper.visible);
button('Finish review',()=>{p.setCharacterHeadStyle(initialStyle);p.setCharacterProportions(initial);location.assign('/?playtest&level=jungle-cup');});
const render=g.renderer.render.bind(g.renderer);
g.renderer.render=(...args:any[])=>{
  if(args[1]===g.camera){
    const b=p.interactionBoundsDiagnostics;box.min.fromArray(b.min);box.max.fromArray(b.max);
    const height=Math.max(1,box.max.y-box.min.y),target=p.pos.clone().add(new THREE.Vector3(0,height*.5,0));
    g.camera.position.copy(target).add(new THREE.Vector3(5,height*.3,7));g.camera.up.set(0,1,0);g.camera.lookAt(target);
  }
  render(...args);
};
function report(){status.textContent=JSON.stringify({paused:freeze,state:p.state,fruit:p.fruit,bounds:p.interactionBoundsDiagnostics,phases:p.fruits.filter((f:any)=>f.phase!=='off').map((f:any)=>({phase:f.phase,position:f.mesh.position.toArray().map((n:number)=>+n.toFixed(2)),t:+f.t.toFixed(2)})),crates:g.level.crates.filter((c:any)=>c.alive).length},null,0);requestAnimationFrame(report);}reset();report();
window.addEventListener('pagehide',()=>{p.setCharacterHeadStyle(initialStyle);p.setCharacterProportions(initial);});
