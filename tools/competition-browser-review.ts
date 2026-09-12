// Local-only review controls: never imported by the production game.
import { JungleCupEvent } from '../src/competition/event';
const g:any=await new Promise(resolve=>{const ready=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(ready);};ready();});
const panel=document.createElement('details');panel.open=true;panel.dataset.testid='competition-review';
panel.style.cssText='position:fixed;bottom:6px;left:6px;max-width:510px;z-index:999999;background:#071d1ff2;color:white;padding:8px;font:11px monospace';
panel.innerHTML='<summary>Competition UI review</summary>';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='competition-status';status.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';panel.append(controls,status);document.body.append(panel);
const button=(name:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:2px;padding:4px;cursor:pointer';b.onclick=action;controls.append(b);};
let pad:Gamepad|null=null,actions:string[]=[];
const fakePad=(x=0,y=0,held:number[]=[]):Gamepad=>({id:'Review controller',index:0,connected:true,mapping:'standard',timestamp:performance.now(),axes:[x,y,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:held.includes(i),touched:held.includes(i),value:held.includes(i)?1:0})),vibrationActuator:null} as Gamepad);
const nativeInput=g.competitionUI.updateInput.bind(g.competitionUI);
g.competitionUI.updateInput=()=>nativeInput(pad);
g.competitionUI.action=(action:string)=>{actions.push(action);};
g.player.step=()=>{}; // Keep the real run HUD visible on a stationary rider.
const nativeRun=JungleCupEvent.prototype.stepRun;
JungleCupEvent.prototype.stepRun=function(_dt,score,active){return nativeRun.call(this,0,score,active);};
JungleCupEvent.prototype.stepPresentation=()=>{};
function fixture(kind:'intro'|'countdown'|'running'|'judges'|'standings'|'win'|'loss'|'overtime'){
  g.competitionAction('retry');
  const event=new JungleCupEvent(()=>.5);
  if(!['intro','countdown','running','overtime'].includes(kind)){
    const count=kind==='win'||kind==='loss'?3:1;
    for(let i=0;i<count;i++){
      event.startRun();event.phase='running';
      nativeRun.call(event,60,kind==='loss'?500:12000,false);
      event.presentationTime=3;
      if(kind!=='judges')event.showStandings();
    }
  }else if(kind!=='intro'){
    event.startRun();
    if(kind!=='countdown')event.phase='running';
    if(kind==='overtime'){event.remaining=0;event.overtime=true;}
  }
  const current=g.getCompetition();g.competitionUI.render(null);Object.assign(current,event);g.competitionUI.render(current);
  g.player.points=12345;g.player.special.award(1500);
  g.player.comboPoints=kind==='overtime'?200:0;g.player.comboMult=kind==='overtime'?2:1;g.player.comboHasTrick=kind==='overtime';g.player.comboTimer=kind==='overtime'?10:0;
  pad=null;actions=[];
}
for(const name of ['intro','countdown','running','judges','standings','win','loss','overtime'] as const)button(name,()=>fixture(name));
for(const digit of [3,2,1])button(`Countdown ${digit}`,()=>{fixture('countdown');g.getCompetition().countdown=digit;});
button('Pad left',()=>pad=fakePad(-1));button('Pad right',()=>pad=fakePad(1));
button('Pad up',()=>pad=fakePad(0,-1));button('Pad down',()=>pad=fakePad(0,1));
button('Pad confirm held',()=>pad=fakePad(0,0,[0]));button('Pad release',()=>pad=null);
button('SPECIAL full',()=>g.player.special.award(100000));
button('Judge reveal',()=>{const e=g.getCompetition();e.presentationTime=(e.presentationTime+.65)%2.6;});
button('Suppress menu',()=>document.body.classList.toggle('ed-active'));
const initialCrt=g.crtGuestSettings.enabled;
button('Toggle CRT',()=>g.crtGuestSettings.setEnabled(!g.crtGuestSettings.enabled));
window.addEventListener('pagehide',()=>g.crtGuestSettings.setEnabled(initialCrt));
function report(){
  const cup=g.getCompetition(),hud=g.getGameHudDiagnostics(),crt=g.getCrtDiagnostics();
  status.textContent=JSON.stringify({phase:cup?.phase,actions,ui:g.getInterfaceSurfaceDiagnostics().competition,composited:g.getInterfaceSurfaceDiagnostics().composited,
    life:document.querySelector('.hud-life-row')?.getAttribute('aria-hidden'),score:document.querySelector('.hud-scoreplate')?.getAttribute('aria-hidden'),special:g.player.specialMeter,
    hud:{primitives:hud.primitives,frames:hud.canvasFrames},crt:{active:crt?.active,frames:crt?.renderCount,failures:crt?.failureCount}},null,0);
  requestAnimationFrame(report);
}
const requested=new URLSearchParams(location.search).get('ui');
if(requested&&['intro','countdown','running','judges','standings','win','loss','overtime'].includes(requested))fixture(requested as Parameters<typeof fixture>[0]);
report();
