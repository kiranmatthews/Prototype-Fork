// Local authoring entry. Never imported by the shipping application.
import { JungleCupEvent } from '../src/competition/event';
const g:any = await new Promise(resolve=>{
  const ready=()=>{const game=(window as any).__game;if(game&&!document.body.classList.contains('game-startup-loading')&&!document.getElementById('game-boot-loading')&&!game.gameFlow.transitionActive)resolve(game);else requestAnimationFrame(ready);};ready();
});
const flow=g.gameFlow, campaign=g.campaign;
let reviewInput='keyboard';
const nativeTouch=navigator.maxTouchPoints>0;
const updatePrompts=g.inputPrompts.update.bind(g.inputPrompts);
g.inputPrompts.update=()=>updatePrompts(null,nativeTouch||reviewInput==='touch');
// All save previews are memory-only fixtures, including writes from UI callbacks.
const save=campaign.startEphemeral();save.slot=1;save.lastFinishedLevel='treehouse-trail';
for(const level of Object.values(save.levels) as any[]){level.completed=true;level.cleared=true;level.crystal=true;}
campaign.persistedSlots=[structuredClone(save),null,{...structuredClone(save),slot:3,lastFinishedLevel:'jungle-cup'},null];
campaign.saveActive=()=>({ok:false,reason:'ephemeral-save'});
const actions:string[]=[];
flow.callbacks.onNewGame=(slot:number)=>actions.push(`new:${slot}`);flow.callbacks.onLoadGame=(slot:number)=>actions.push(`load:${slot}`);
flow.callbacks.onSaveGame=()=>false;flow.callbacks.onAutosaveChange=()=>false;flow.callbacks.onQuitToMain=()=>false;
flow.callbacks.onResultsRetry=()=>actions.push('results:retry');flow.callbacks.onResultsContinue=()=>actions.push('results:continue');
flow.callbacks.onGameOverRetry=()=>actions.push('gameover:retry');flow.callbacks.onGameOverQuit=()=>actions.push('gameover:quit');
const selectors=['launch','new-slots','load-slots','pause','map-pause','options','home-options','map-options','level-select','progress','save-load','confirm-new','confirm-save','confirm-load','confirm-quit-main','confirm-level-select','trick-guide','gameover','results','time-trial','cup-intro','cup-guide','cup-judges','cup-standings','cup-final-win','cup-final-loss'];
const panel=document.createElement('div');panel.id='menu-review';panel.className='side-wrap';
panel.innerHTML=`<select aria-label="Review screen">${selectors.map(s=>`<option>${s}</option>`).join('')}</select><select aria-label="Review prompts"><option>keyboard</option><option>ps5</option><option>xbox</option><option>touch</option></select><button>Audit layout</button><output></output>`;
panel.style.cssText='display:flex!important;position:fixed!important;top:0!important;left:0!important;width:auto!important;height:22px!important;z-index:999999!important;gap:8px;background:#000;color:white;font:12px monospace;pointer-events:auto!important;transform:none!important';
const chooser=panel.querySelector('select')!,output=panel.querySelector('output')!;
let fixture:JungleCupEvent|null=null;
const realCupAction=g.competitionUI.action;
g.competitionUI.action=(action:string)=>fixture?actions.push(`cup:${action}`):realCupAction(action);
const realCupRender=g.competitionUI.render.bind(g.competitionUI);
g.competitionUI.render=(event:any,suppressed:boolean)=>realCupRender(fixture??event,fixture?false:suppressed);
function show(name:string){
  fixture=null;
  if(name.startsWith('cup-')){
    flow.hide();fixture=new JungleCupEvent(()=>.5);
    if(!['cup-intro','cup-guide'].includes(name))for(let i=0;i<(name.includes('final')?3:1);i++){
      fixture.startRun();fixture.stepPresentation(3);fixture.stepRun(60,name.includes('loss')?100:48000,false,true);fixture.stepFinish(1,true,true);fixture.stepPresentation(3);
      if(name!=='cup-judges')fixture.showStandings();
    }
    fixture.cupAwarded=name==='cup-final-win';realCupRender(fixture,false);
    if(name==='cup-guide')g.competitionUI.element.querySelector('[data-action="guide"]').click();
  }else if(name==='results'||name==='time-trial')flow.showResults(name==='results'?{kind:'normal',levelName:'Jungle Ruins',boxes:42,totalBoxes:42,crystal:true,boxGem:true,comboGem:true,firstClear:true,timeTrialUnlocked:true}:{kind:'time-trial',levelName:'Jungle Ruins',actualTime:58.42,relicTarget:90,medal:'gold',boxes:42,totalBoxes:42,bestTimes:[55.12,58.42,61.73]});
  else if(name==='gameover')flow.showGameOver('Jungle Ruins');
  else if(name==='launch')flow.showLaunch();
  else if(name==='map-options')flow.showMapSection('options');
  else{
    flow.showPause({levelName:'Jungle Ruins',inWarpRoom:name==='map-pause'});
    if(!['pause','map-pause'].includes(name)){
      flow.previousScreen=name==='home-options'?'launch':'pause';flow.screen=name==='home-options'?'options':name;
      flow.pendingNewSlot=1;flow.pendingLoadSlot=1;flow.render();
    }
  }
  panel.inert=false;panel.removeAttribute('aria-hidden');output.textContent='';
}
function audit(){
  const root=fixture?g.competitionUI.element:document.querySelector('.game-shell-panel');
  const problems:string[]=[];
  const inViewport=(r:DOMRect)=>r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;
  const visible=(node:Element)=>{
    for(let parent:Element|null=node;parent;parent=parent.parentElement)if((parent as HTMLElement).hidden||getComputedStyle(parent).display==='none')return false;
    const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;
  };
  const scrollHost=(node:Element)=>{
    for(let parent=node.parentElement;parent&&parent!==root;parent=parent.parentElement)
      if(/auto|scroll/.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight+1)return parent;
    return null;
  };
  for(const node of root.querySelectorAll('button,h1,h2,.game-menu-hints,.game-level-footer')){
    const rect=node.getBoundingClientRect();if(!visible(node))continue;
    // Only the bounded content region may scroll; headings/actions remain fixed.
    const host=scrollHost(node);if(host){if(!inViewport(host.getBoundingClientRect()))problems.push('scroll region outside screen');continue;}
    if(!inViewport(rect))problems.push(node.textContent.trim());
  }
  for(const table of root.querySelectorAll('.comp-table-wrap'))if(table.scrollHeight>table.clientHeight+2&&!scrollHost(table))problems.push('standings clipped');
  for(const button of root.querySelectorAll('button')){
    const r=button.getBoundingClientRect();if(!visible(button))continue;
    const scroll=scrollHost(button);
    if(document.body.classList.contains('tc-on')||document.body.dataset.promptFamily==='touch')
      if(r.width<47.5||r.height<47.5)problems.push('small target '+(button.getAttribute('aria-label')||button.textContent.trim()));
    for(let parent=button.parentElement;parent&&parent!==root;parent=parent.parentElement){
      if(scroll&&parent.contains(scroll))continue;
      const style=getComputedStyle(parent),p=parent.getBoundingClientRect();
      if(['hidden','auto','scroll'].includes(style.overflowY)&&(r.top<p.top-1||r.bottom>p.bottom+1))problems.push('clipped '+button.textContent.trim());
    }
  }
  for(const node of root.querySelectorAll<HTMLElement>('.game-panel-title,.game-panel-subtitle,.game-level-name,.game-results-title,.game-slot-level,.game-slot-date'))
    if(visible(node)&&node.scrollWidth>node.clientWidth+2)problems.push('text too wide '+node.textContent.trim());
  for(const node of root.querySelectorAll<HTMLElement>('.game-trick-content td,.game-trick-content th,.comp-guide td,.comp-guide th'))
    if(visible(node)&&node.scrollWidth>node.clientWidth+2)problems.push('guide cell too wide '+node.textContent.trim());
  if(document.documentElement.scrollWidth>innerWidth)problems.push('page width');
  output.textContent=problems.length?`FAIL: ${problems.join(', ')}`:`PASS ${innerWidth}×${innerHeight}`;
  output.dataset.problems=JSON.stringify(problems);
  return {screen:chooser.value,width:innerWidth,height:innerHeight,problems};
}
panel.querySelector<HTMLSelectElement>('[aria-label="Review prompts"]')!.onchange=e=>{
  reviewInput=(e.target as HTMLSelectElement).value;
  g.inputPrompts.setHostFamily(['ps5','xbox'].includes(reviewInput)?reviewInput:null);g.inputPrompts.update();
};
chooser.onchange=()=>show(chooser.value);panel.querySelector('button')!.onclick=audit;
document.body.append(panel);show('launch');
(window as any).__menuReview={selectors,show:(name:string)=>{chooser.value=name;show(name);},audit,actions,
  get root(){return fixture?g.competitionUI.element:flow.panel;}};
