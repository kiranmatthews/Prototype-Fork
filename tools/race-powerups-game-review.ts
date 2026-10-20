/** Only a local fixture: production race, renderer, HUD and item activation. */
import { RACE_ITEMS, type RaceItem } from '../src/race/types';
if(!import.meta.env.DEV)throw new Error('Power-up game review is development-only');
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
g.input.pollGamepad=()=>null;
const race=g.getSkateRace();race.onFinish=()=>{};let pilot=false;
const native=race.step.bind(race);race.step=(dt:number,input:any)=>native(dt,pilot&&race.phase==='running'?race.drive(0):input);
const panel=document.createElement('section');panel.style.cssText='position:fixed;z-index:999999;left:8px;top:8px;padding:8px;background:#102232e8;color:white;font:12px monospace;max-width:48vw';panel.setAttribute('aria-label','Power-up game review');
const select=document.createElement('select');select.setAttribute('aria-label','Power-up');for(const [kind,info] of Object.entries(RACE_ITEMS)){const o=document.createElement('option');o.value=kind;o.textContent=info.name;select.append(o);}panel.append(select);
function button(text:string,fn:()=>void){const b=document.createElement('button');b.textContent=text;b.style.cssText='padding:7px;margin:3px';b.onclick=fn;panel.append(b);}
button('Start review race',()=>{race.start('race',0);race.phase='running';pilot=true;});
button('Give power-up',()=>{race.riders[0].item=select.value as RaceItem;});
button('Use power-up',()=>{race.riders[0].item=select.value as RaceItem;race.useItem();});
button('Use all visuals',()=>{for(const k of ['mushroom','star','shield','green-shell','water-bomb']){race.riders[0].item=k;race.useItem();}});
button('Pause pilot',()=>{pilot=!pilot;});button('Hide review',()=>{panel.hidden=true;});
const status=document.createElement('output');status.style.cssText='display:block;white-space:pre-wrap';panel.append(status);document.body.append(panel);
function frame(){panel.inert=false;status.textContent=JSON.stringify({phase:race.phase,speed:Math.round(g.player.speed),progress:Math.round(race.riders[0]?.progress??0),item:race.hud()?.item,boost:race.hud()?.star,fx:race.effects.stats,falls:race.riders[0]?.falls});requestAnimationFrame(frame);}frame();
