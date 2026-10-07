// Dev-only, visible controls for reviewing production bonus presentation.
import '../src/main';
const status = document.querySelector('#status')!;
const errors: string[] = [];
window.addEventListener('error', event => errors.push(event.message));
const samples: object[] = [];
let pilotReport:any=null;
let previous = '', jumpTimer = 0;
const game = () => (window as any).__game;
const act = (id: string, action: (g: any) => void) => document.querySelector(id)!.addEventListener('click', () => {
  const g = game(); if (g && !g.gameFlow.blocksGameplay) action(g);
  (document.activeElement as HTMLElement)?.blur();
});
act('#pad', g => {
  const pad = g.getLevel().bonusPlatformDiagnostics;
  if (!pad) return;
  g.player.pos.set(pad.x, pad.topY + 0.02, pad.z);
  g.player.settle(g.getLevel());
  g.player.prepareStartPresentation(g.getLevel());
  g.getLevel().cancelBonusEntry();
  samples.length = 0;
});
act('#jump', () => {
  window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space', key: ' ', bubbles: true}));
  window.clearTimeout(jumpTimer);
  jumpTimer = window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', {code:'Space',key:' ',bubbles:true})), 180);
});
act('#fail', g => { g.player.pos.y = g.getLevel().killY - 2; g.player.grounded = false; });
act('#finish', g => {
  const gate = g.getLevel().captureData().components.find((c: any) => c.t === 'gate');
  if (!gate) return;
  g.player.pos.set(gate.p[0], gate.p[1] + .1, gate.p[2]);
  g.player.settle(g.getLevel()); g.player.prepareStartPresentation(g.getLevel());
});
document.querySelector('#hide')!.addEventListener('click', () => (document.querySelector('#review') as HTMLElement).hidden = true);
function review() {
  requestAnimationFrame(review);
  const g = game(); if (!g) return;
  const p = g.player, departure = g.getBonusDeparture();
  const state = { level:g.getCurrentLevel().id, phase:departure?.phase ?? g.gameFlow.loadingPhase ?? 'play',
    kind:departure?.kind, elapsed:departure?.elapsed, lift:departure?.offsetY, runTime:p.runTime, position:p.pos.toArray(),
    grounded:p.grounded, state:p.state, camera:g.camera.position.toArray(), lives:p.lives, fruit:p.fruit,
    completed:g.getLevel().bonusRoundCompleted, hudBonus:document.querySelector('.game-hud-layer')?.classList.contains('hud-bonus'),
    errors };
  const marker = state.level + ':' + state.phase;
  if (marker !== previous || (departure && samples.length < 150)) { samples.push({...state}); previous=marker; }
  status.textContent = JSON.stringify({pilot:pilotReport&&{stage:pilotReport.stage,frame:pilotReport.frame,done:pilotReport.done,failed:pilotReport.failed,result:pilotReport.result}, current:state, transitions:samples.filter((_:object,i:number)=>!i||(samples[i-1] as any).phase!==(samples[i] as any).phase)},null,1);
  (window as any).bonusReview = { samples, errors };
}
review();


act('#slow',g=>g.setBonusTravelReviewRate(.18));
act('#pilot',async g=>{
 const path='/tools/themed-bonus-pilot.mjs';
 const {runThemedBonusJourney}=await import(/* @vite-ignore */ path);
 const recipes='/src/levels/themed-bonuses.ts';
 const {THEMED_BONUS_COURSES}=await import(/* @vite-ignore */ recipes);
 const id=g.getCurrentLevel().id;
 const course=THEMED_BONUS_COURSES.find((c:any)=>c.id===id||id==='bonus:'+c.parentId);
 if(!course)return;
 const p=g.player,l=g.getLevel(),report=pilotReport={stage:'start',frame:0,done:false,failed:null,actions:[],evidence:[],trace:[]};
 const ctx={id:course.id,p,l,course,source:course.data,report,trace:report.trace,get frame(){return report.frame;}};
 const pilot=runThemedBonusJourney(ctx);let next=pilot.next(),last:any={},advanced=false;
 const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
 p.step=(dt:number,input:any,level:any)=>{
  const sample=next.value??{};input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;
  const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
  input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
  for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
   input[held]=sample[held]??false;const pressed=held.replace('Held','Pressed');input[pressed]=sample[pressed]??(input[held]&&!last[held]);
  }
  input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;
  last={...sample};step(dt,input,level);advanced=true;
 };
 p.commitRenderStep=(...args:any[])=>{
  commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
  report.trace.push({frame:report.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,crates:p.cratesBroken,gem:p.gemEarned});
  try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;}}
  catch(error){report.done=true;report.failed=String(error);}
  if(report.done){p.step=step;p.commitRenderStep=commit;if(!report.failed)g.setBonusTravelReviewRate(0);}
 };
});
document.querySelector('#capture')!.addEventListener('click',()=>{
 const data=game()?.captureBonusReviewFrame();if(!data)return;
 const a=document.createElement('a');a.href=data;a.download='bonus-polish-'+Date.now()+'.png';a.click();
});
act('#study',g=>{
 if(!g.getCurrentLevel().id.startsWith('bonus:'))return;
 g.player.bankFlyingFruit();g.player.fruit=26;g.player.lives=3;g.player.cratesBroken=g.getLevel().totalCrates;
 const gate=g.getLevel().captureData().components.find((c:any)=>c.t==='gate');
 g.player.pos.set(gate.p[0],gate.p[1]+.74,gate.p[2]);g.player.settle(g.getLevel());g.player.prepareStartPresentation(g.getLevel());
 g.camera.position.set(gate.p[0],gate.p[1]+4.48,13.307);g.camera.lookAt(gate.p[0],gate.p[1]+2.7,0);
 g.setBonusTravelReviewRate(0);g.returnFromBonus(true);
});
document.querySelector('#advance')!.addEventListener('click',()=>game()?.advanceBonusTravelReview(.25));

document.querySelector('#resume')!.addEventListener('click',()=>game()?.setBonusTravelReviewRate(1));

// Typography-only stress fixture; game inventory remains untouched.
act('#counterfit',g=>{g.ui.rooCratesCurrent.set('18');g.ui.rooCratesTotal.set('/18');});

act('#hold',g=>g.setBonusTravelReviewRate(0));
