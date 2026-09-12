// Local QA only: real Triangle catches and the real balance-failure handler.
import * as THREE from 'three';
import { TUNING } from '../src/tuning';
const g:any = await new Promise(resolve => { const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll(); });
const p=g.player;
let frame=0,active=false,paused=false,fraction=.37,direction=1,outward=false,stopAt=48;
let events:string[]=[];
const neutral=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:true,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
const step=p.step.bind(p);
p.step=(dt:number,input:any,level:any)=>{
  if(paused)return;
  if(!active){step(dt,input,level);return;}
  if(frame===0){
    const rail=level.grindRails[0],t=rail.totalLength*fraction;
    const position=rail.pointAt(t).add(new THREE.Vector3(0,.25,0)),heading=rail.tangentAt(t).multiplyScalar(direction);
    p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);
    p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=14;p.vVel=0;p.balanceBoostT=1;
  }
  const side=direction*(outward?-1:1),scripted={...neutral(),grindPressed:frame===0,moveX:frame>=35&&frame<47?side:0};
  if(frame===35){p.balanceBoostT=0;p.balance=side;p.balanceVel=side;p.balanceCritT=TUNING.bailGrace;}
  const before=p.state;
  p.rawInput=scripted;step(dt,scripted,level);frame++;
  if(before!==p.state)events.push(`${frame}: ${before} → ${p.state} at y=${p.pos.y.toFixed(2)}, vy=${p.vVel.toFixed(2)}`);
  if(frame>=stopAt)paused=true;
};
const panel=document.createElement('section');panel.style.cssText='position:fixed;z-index:999999;right:12px;bottom:12px;width:325px;padding:12px;background:#071d25ed;color:white;font:12px monospace';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='drop-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
function start(f=.37,dir=1,deck=false){g.competitionAction('retry');fraction=f;direction=dir;outward=deck;frame=0;events=[];active=true;paused=false;stopAt=48;}
function button(label:string,action:()=>void){const b=document.createElement('button');b.textContent=label;b.style.cssText='margin:2px;padding:6px';b.onclick=action;controls.append(b);}
button('Straight drop',()=>start());button('Reverse drop',()=>start(.37,-1));button('Corner drop',()=>start(.035));button('Deck fail',()=>start(.37,1,true));
button('Continue to flat',()=>{stopAt=150;paused=false;});button('Step 5 frames',()=>{stopAt=frame+5;paused=false;});button('Play freely',()=>{active=paused=false;});
function report(){panel.inert=false;document.body.classList.add('game-debug-hidden');document.body.classList.remove('game-debug-visible');status.textContent=`${frame} ${paused?'PAUSED':''} · ${p.state} · grounded ${p.grounded}\nboard ${p.freeSkate} · bail ${p.isBailing} · speed ${p.speed.toFixed(2)}\nposition ${p.pos.toArray().map((n:number)=>n.toFixed(2)).join(', ')}\n${events.join('\n')}`;requestAnimationFrame(report);}
report();
