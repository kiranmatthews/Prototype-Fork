// Local browser QA; this script is not part of the published application.
import * as THREE from 'three';
import { DECK_TRICKS, GRAB_TRICKS } from '../src/skateTricks';
import { JungleCupEvent } from '../src/competition/event';
const g:any=await new Promise(resolve=>{const ready=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(ready);};ready();});
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='trick-review';
panel.style.cssText='position:fixed;bottom:7px;left:7px;width:340px;max-width:calc(100vw - 30px);z-index:999999;background:#092323ed;color:white;padding:10px;font:12px monospace;border:1px solid #80a99d';
panel.innerHTML='<summary>Trick review</summary>';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='trick-status';status.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';panel.append(controls,status);document.body.append(panel);
const button=(name:string,fn:()=>void)=>{const element=document.createElement('button');element.textContent=name;element.style.cssText='margin:2px;padding:5px;cursor:pointer';element.onclick=fn;controls.append(element);};
const select=(label:string,values:readonly string[])=>{const element=document.createElement('select');element.setAttribute('aria-label',label);for(const name of values){const option=document.createElement('option');option.value=name;option.textContent=name;element.append(option);}controls.append(element);return element;};
const flip=select('Flip trick',DECK_TRICKS.map(trick=>trick.label)),grab=select('Grab trick',GRAB_TRICKS.map(trick=>trick.label));
const view=select('Review view',['Follow','Side','Front']);
const vectors:Record<string,[number,number]>={kick:[-1,0],heel:[1,0],imposs:[0,1],shove:[0,-1],varial:[-1,-1],'varial-heel':[1,-1],hardflip:[-1,1],'inward-heel':[1,1],indy:[1,0],melon:[-1,0],nose:[0,1],tail:[0,-1],method:[-1,1],mute:[1,1],stalefish:[-1,-1],japan:[1,-1]};
const walls={South:{p:[0,.1,10],h:[0,0,1]},North:{p:[28,.1,-90],h:[0,0,-1]},East:{p:[28,.1,-42],h:[1,0,0]},West:{p:[-28,.1,-70],h:[-1,0,0]}};
let scenario='flip',wall=walls.South,frame=0,air=0,placed=false,freeze=false,single=0,autoPause=true,pausedPose=false,hadAir=false,active=false;
let logs:string[]=[];
const nativeStep=g.player.step.bind(g.player),nativeRun=JungleCupEvent.prototype.stepRun;
JungleCupEvent.prototype.stepRun=function(dt,score,combo,ready){return nativeRun.call(this,freeze?0:dt,score,combo,ready);};
const blank=()=>({moveX:0,moveY:0,jumpHeld:true,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
function start(kind:string,side:keyof typeof walls='South'){
  scenario=kind;wall=walls[side];frame=air=0;placed=freeze=pausedPose=hadAir=false;active=true;logs=[];single=0;
  autoPause=kind==='flip'||kind==='grab'||kind==='special-flip';g.competitionAction('retry');
}
for(const side of Object.keys(walls) as (keyof typeof walls)[])button(`${side} flip`,()=>start('flip',side));
button('Grab air',()=>start('grab'));button('Grab to flip',()=>start('grab-flip'));button('Flip to grab',()=>start('flip-grab'));button('Three-trick line',()=>start('line'));
button('Kickflip McTwist',()=>start('special-flip'));button('The 900',()=>start('special-grab'));button('Grind score',()=>start('grind'));
button('Resume motion',()=>{freeze=false;autoPause=false;});button('Pause',()=>freeze=true);button('Next frame',()=>{freeze=true;single=1;});
g.player.step=(dt:number,input:any,level:any)=>{
  if(freeze&&single===0)return;
  if(single>0)single--;
  if(!active){nativeStep(dt,input,level);return;}
  const p=g.player;
  if(!placed){
    p.respawn(level,true,true,{position:new THREE.Vector3(...wall.p),heading:new THREE.Vector3(...wall.h)});
    p.axisF.set(...wall.h);p.axisL.set(wall.h[2],0,-wall.h[0]);p.freeSkate=true;p.speed=15.3;
    p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);placed=true;
    if(scenario.startsWith('special'))p.special.award(1200);
    if(scenario==='grind'){
      const rail=level.grindRails[3],at=rail.pointAt(2);
      p.pos.copy(at).add(new THREE.Vector3(.05,.2,.05));p.prevPos.copy(p.pos);p.axisF.copy(rail.tangentAt(2));p.axisL.set(p.axisF.z,0,-p.axisF.x);
      p.state='air';p.grounded=false;p.airFromSkate=true;p.airGrav='board';p.vVel=0;p.balanceBoostT=30;
    }
  }
  const command=blank(),flipKind=DECK_TRICKS.find(trick=>trick.label===flip.value)!.kind,grabKind=GRAB_TRICKS.find(trick=>trick.label===grab.value)!.kind;
  const press=(category:'flip'|'grab',direction:[number,number])=>{
    command.moveX=direction[0];command.moveY=direction[1];
    if(category==='flip')command.spinPressed=command.spinHeld=true;else command.grabPressed=command.grabHeld=true;
  };
  if(scenario==='grind'){command.grindHeld=true;command.grindPressed=frame===0;command.jumpHeld=false;}
  if(p.vertAir){
    air++;
    if(scenario==='flip'&&air===1)press('flip',vectors[flipKind]);
    if(scenario==='grab') {command.grabHeld=air<32;if(air===1)press('grab',vectors[grabKind]);}
    if(scenario==='grab-flip'){command.grabHeld=air<45;if(air===1)press('grab',vectors[grabKind]);if(air===12)press('flip',vectors[flipKind]);}
    if(scenario==='flip-grab'){if(air===1)press('flip',vectors[flipKind]);if(air===18)press('grab',vectors[grabKind]);command.grabHeld=air>=18&&air<40;}
    if(scenario==='line'){if(air===1)press('flip',[-1,0]);if(air===18)press('flip',[0,-1]);if(air===37)press('grab',[1,0]);command.grabHeld=air>=37&&air<50;}
    if(scenario==='special-flip'){if(air===1)command.moveX=-1;if(air===3)press('flip',[1,0]);}
    if(scenario==='special-grab'){if(air===1)command.moveX=1;if(air===3)press('grab',[0,-1]);command.grabHeld=air>=3;}
  }
  const was=p.vertAir;
  nativeStep(dt,command,level);frame++;
  if(!was&&p.vertAir){hadAir=true;logs.push(`takeoff vy ${p.vVel.toFixed(3)}`);}
  if(p.flipT>0&&autoPause&&!pausedPose&&1-p.flipT/p.flipDuration>=.45){pausedPose=freeze=true;logs.push('mid-flip');}
  if(scenario==='grab'&&p.grabPhase==='held'&&air>14&&autoPause&&!pausedPose){pausedPose=freeze=true;logs.push('held grab');}
  if(p.isBailing){freeze=true;logs.push('bail');}
  if(hadAir&&p.grounded){freeze=true;logs.push(`landed ${p.comboPoints} × ${p.comboMult}`);}
  if(scenario==='grind'&&frame>=180){freeze=true;logs.push('three seconds of grind');}
  if(frame>500){freeze=true;logs.push('route ended');}
};
const nativeRender=g.renderer.render.bind(g.renderer);
g.renderer.render=(...args:any[])=>{
  if(args[1]===g.camera&&view.value!=='Follow'){
    const p=g.player,up=new THREE.Vector3().copy(p.skateCameraUp),forward=p.vertAir?new THREE.Vector3(0,1,0):p.axisF.clone();
    const side=new THREE.Vector3().crossVectors(up,forward).normalize(),target=p.pos.clone().addScaledVector(up,.75);
    g.camera.up.copy(up);g.camera.position.copy(target).addScaledVector(view.value==='Side'?side:forward,4.2).addScaledVector(up,.45);g.camera.lookAt(target);
  }
  nativeRender(...args);
};
function report(){const p=g.player;status.textContent=JSON.stringify({scenario,frame,air,paused:freeze,state:p.state,vert:p.vertAir,flip:p.flipName,remaining:p.flipT,grab:p.grabTrickName,grabPhase:p.grabPhase,score:p.comboPoints,mult:p.comboMult,labels:p.comboLabels,bail:p.isBailing,vy:p.vVel,history:[...p.runTrickUses],logs},null,0);requestAnimationFrame(report);}report();
