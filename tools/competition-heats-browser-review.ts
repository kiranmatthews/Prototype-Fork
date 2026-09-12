// Local-only heat/judging fixtures. They never commit campaign results.
import {JungleCupEvent,COMPETITION_TUNING} from '../src/competition/event';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
let frozen=true;
const run=JungleCupEvent.prototype.stepRun,track=JungleCupEvent.prototype.trackActivity,presentation=JungleCupEvent.prototype.stepPresentation;
JungleCupEvent.prototype.stepRun=function(dt,...args){return run.call(this,frozen?0:dt,...args);};
JungleCupEvent.prototype.trackActivity=function(dt,active){track.call(this,frozen?0:dt,active);};
JungleCupEvent.prototype.stepPresentation=function(dt){presentation.call(this,frozen?0:dt);};
const playerStep=g.player.step.bind(g.player);g.player.step=(...args:any[])=>{if(!frozen)playerStep(...args);};
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='heat-review';
panel.style.cssText='position:fixed;top:4px;left:4px;z-index:999999;max-width:300px;background:#071d1fe8;color:white;padding:6px;font:11px monospace';
panel.innerHTML='<summary>Heat review</summary>';const controls=document.createElement('div'),status=document.createElement('pre');
status.dataset.testid='heat-review-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
const add=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;controls.append(b);};
function finish(score:number,bails=0,idle=0){const e=g.getCompetition();presentation.call(e,3);e.bails=bails;track.call(e,idle,false);run.call(e,60,score,false,true);e.stepFinish(COMPETITION_TUNING.finishBeat,true,true);presentation.call(e,3);}
function heat(number:number){frozen=true;g.gameFlow.hide();g.competitionAction('retry');for(let i=1;i<number;i++){finish(12000);g.competitionAction('standings');g.competitionAction('start');}presentation.call(g.getCompetition(),3);g.player.special.award(600);}
for(const number of [1,2,3])add(`Heat ${number}`,()=>heat(number));
add('Huge · 2 bails',()=>{heat(1);finish(48000,2);});
add('Huge · idle 20s',()=>{heat(1);finish(48000,0,20);});
add('Huge · idle 30s',()=>{heat(1);finish(48000,0,30);});
add('Pause',()=>g.gameFlow.showPause({levelName:'Jungle Cup',inWarpRoom:false,competition:true}));
add('Life rule',()=>g.player.endlessDeaths=false);add('Death rule',()=>g.player.endlessDeaths=true);
add('Live play',()=>{g.gameFlow.hide();frozen=false;});
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');const e=g.getCompetition();status.textContent=JSON.stringify({heat:e?.runNumber,sky:e?.heatLook.sky,phase:e?.phase,idle:e?.idleSeconds,penalty:e?.inactivityPenalty,marks:e?.runs.at(-1)?.judges,runMark:e?.runs.at(-1)?.score,menu:g.gameFlow.currentScreen,lifeHidden:getComputedStyle(document.querySelector('.hud-lives')!).display,deathHidden:getComputedStyle(document.querySelector('.hud-deathcount-label')!).display,special:g.player.specialMeter},null,2);requestAnimationFrame(report);}heat(1);report();
