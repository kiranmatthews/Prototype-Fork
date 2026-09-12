// Local-only full-loop review: real event, player, audio and HUD cash-in.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player;let mode='live',frame=0,prepared=false,beeps:number[]=[],events:string[]=[],lastPhase='',startMs=0,lastDismounted=false,holdDismount=false;
const blank=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
const native=p.step.bind(p);
p.step=(dt:number,input:any,level:any)=>{
 if(mode==='live'){native(dt,input,level);return;}
 const e=g.getCompetition();
 if(holdDismount&&e.phase==='finishing'&&p.competitionFinishT>=.28)return;
 if(!prepared){
  const position=new THREE.Vector3(-20,.1,-70),heading=new THREE.Vector3(1,0,0);
  p.respawn(level,true,true,{position,heading});p.axisF.copy(heading);p.axisL.set(0,0,-1);
  p.groundHit=p.queryGround(level);p.pos.y=p.groundHit.y;p.rideNormal.copy(p.groundHit.normal);
  p.freeSkate=true;p.speed=8;p.points=1234;e.remaining=3.2;
  const cue=e.onFinalSecond;e.onFinalSecond=(second:number)=>{beeps.push(second);cue(second);};
  prepared=true;
  if(mode==='combo'||mode==='bail'){
   p.manualing=1;p.balanceBoostT=20;p.comboPoints=12000;p.comboMult=3;p.comboHasTrick=true;p.comboLabels=['Final Manual'];p.comboTimer=.65;
  }
 }
 if(e.phase==='running'){
  if(mode==='air'&&e.remaining>0&&e.remaining<.12&&p.grounded){p.chargeTimer=.4;p.chargedJump(dt);}
  if(mode==='combo'&&e.remaining===0&&frame>230&&p.manualing){p.manualing=0;p.comboTimer=.1;events.push('released final manual');}
  if(mode==='bail'&&e.remaining===0&&!p.isBailing&&frame<220){p.bail();events.push('bail at zero');}
 }
 native(dt,blank(),level);frame++;
};
const panel=document.createElement('section');panel.style.cssText='position:fixed;z-index:999999;left:12px;top:12px;width:340px;padding:10px;background:#081d25ed;color:white;font:12px monospace';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='run-finish-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
const start=(kind:string)=>{mode=kind;frame=0;prepared=false;beeps=[];events=[];lastPhase='';lastDismounted=false;startMs=performance.now();g.competitionAction('retry');};
const button=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:6px;margin:2px';b.onclick=fn;controls.append(b);};
button('Hold dismount pose',()=>{holdDismount=true;});button('Continue dismount',()=>{holdDismount=false;});
button('Ground finish',()=>start('ground'));button('Air at zero',()=>start('air'));button('Final combo',()=>start('combo'));button('Bail at zero',()=>start('bail'));button('Normal play',()=>{mode='live';g.competitionAction('retry');});
function report(){
 panel.inert=false;document.body.classList.add('game-debug-hidden');document.body.classList.remove('game-debug-visible');
 const e=g.getCompetition();if(e?.phase==='finishing'&&p.competitionDismounted&&!lastDismounted){lastDismounted=true;events.push(`${((performance.now()-startMs)/1000).toFixed(2)}s dismounted`);}if(e?.phase!==lastPhase){lastPhase=e?.phase;events.push(`${((performance.now()-startMs)/1000).toFixed(2)}s ${lastPhase}`);}
 status.textContent=JSON.stringify({mode,phase:e?.phase,remaining:e?.remaining,beeps,grounded:p.grounded,state:p.state,combo:p.competitionComboActive,ready:p.competitionReadyToStop,dismounted:p.competitionDismounted,board:p.freeSkate,parkedBoard:!!p.competitionParkedBoard?.parent,score:p.points,shownScore:g.ui.dispScore,purse:g.ui.dispCombo,cashIn:g.ui.comboState,scoreSettled:g.ui.competitionScoreSettled(p.points),events:events.slice(-7)},null,2);
 requestAnimationFrame(report);
}report();
