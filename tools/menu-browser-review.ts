// Local authoring entry. Never imported by the shipping application.
import { JungleCupEvent } from '../src/competition/event';
const g:any = await new Promise(resolve=>{
  const ready=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(ready);};ready();
});
const flow=g.gameFlow, campaign=g.campaign;
let reviewInput='keyboard';
const updatePrompts=g.inputPrompts.update.bind(g.inputPrompts);
g.inputPrompts.update=()=>updatePrompts(null,reviewInput==='touch');
// All save previews are memory-only fixtures, including writes from UI callbacks.
const save=campaign.startEphemeral();save.slot=1;save.lastFinishedLevel='jungle';
for(const level of Object.values(save.levels) as any[]){level.completed=true;level.crystal=true;}
campaign.persistedSlots=[structuredClone(save),null,{...structuredClone(save),slot:3,lastFinishedLevel:'jungle-cup'},null];
campaign.saveActive=()=>({ok:false,reason:'ephemeral-save'});
flow.callbacks.onNewGame=()=>{};flow.callbacks.onLoadGame=()=>{};
flow.callbacks.onSaveGame=()=>false;flow.callbacks.onAutosaveChange=()=>false;flow.callbacks.onQuitToMain=()=>false;
const selectors=['launch','new-slots','load-slots','pause','map-pause','options','home-options','level-select','progress','save-load','confirm-new','confirm-save','confirm-load','confirm-quit-main','confirm-level-select','trick-guide','gameover','results','time-trial','cup-intro','cup-guide','cup-judges','cup-standings','cup-final-win','cup-final-loss'];
const panel=document.createElement('div');panel.id='menu-review';panel.className='side-wrap';
panel.innerHTML=`<select aria-label="Review screen">${selectors.map(s=>`<option>${s}</option>`).join('')}</select><select aria-label="Review prompts"><option>keyboard</option><option>ps5</option><option>xbox</option><option>touch</option></select><button>Audit layout</button><output></output>`;
panel.style.cssText='display:flex!important;position:fixed!important;top:0!important;left:0!important;width:auto!important;height:22px!important;z-index:999999!important;gap:8px;background:#000;color:white;font:12px monospace;pointer-events:auto!important;transform:none!important';
const chooser=panel.querySelector('select')!,output=panel.querySelector('output')!;
let fixture:JungleCupEvent|null=null;
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
  for(const node of root.querySelectorAll('button,h1,h2,.game-menu-hints,.game-level-footer')){
    const rect=node.getBoundingClientRect();if(!rect.width||!rect.height||getComputedStyle(node).display==='none')continue;
    // Only the bounded content region may scroll; headings/actions remain fixed.
    if(node.closest('.comp-content,.game-scroll-segment')&&!node.matches('button'))continue;
    if(!inViewport(rect))problems.push(node.textContent.trim());
  }
  for(const table of root.querySelectorAll('.comp-table-wrap'))if(table.scrollHeight>table.clientHeight+2)problems.push('standings clipped');
  for(const button of root.querySelectorAll('button')){
    const r=button.getBoundingClientRect();if(!r.width||!r.height)continue;
    for(let parent=button.parentElement;parent&&parent!==root;parent=parent.parentElement){
      const style=getComputedStyle(parent),p=parent.getBoundingClientRect();
      if(['hidden','auto','scroll'].includes(style.overflowY)&&(r.top<p.top-1||r.bottom>p.bottom+1))problems.push('clipped '+button.textContent.trim());
    }
  }
  if(document.documentElement.scrollWidth>innerWidth)problems.push('page width');
  output.textContent=problems.length?`FAIL: ${problems.join(', ')}`:`PASS ${innerWidth}×${innerHeight}`;
  output.dataset.problems=JSON.stringify(problems);
}
panel.querySelector<HTMLSelectElement>('[aria-label="Review prompts"]')!.onchange=e=>{
  reviewInput=(e.target as HTMLSelectElement).value;
  g.inputPrompts.setHostFamily(['ps5','xbox'].includes(reviewInput)?reviewInput:null);g.inputPrompts.update();
};
chooser.onchange=()=>show(chooser.value);panel.querySelector('button')!.onclick=audit;
document.body.append(panel);show('launch');
