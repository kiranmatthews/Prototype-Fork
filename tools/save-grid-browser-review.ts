// Local-only in-memory save shelf and callback spies. No save slot is written.
import {CAMPAIGN_LEVELS} from '../src/campaign';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const f=g.gameFlow,c=g.campaign,base=structuredClone(c.startEphemeral());let actions:string[]=[];
function fixture(full=false){
 c.persistedSlots=Array.from({length:4},(_,i)=>{
  if(!full&&i===2)return null;
  const save=structuredClone(base);save.slot=i+1;save.updatedAt=1789190000000+i*60000;save.createdAt=save.updatedAt;
  const definition=CAMPAIGN_LEVELS[[0,4,9,11][i]];
  save.lastFinishedLevel=definition.progressKey;save.levels[definition.progressKey].cleared=true;return save;
 });c.activeValue=structuredClone(c.persistedSlots[0]);c.dirtyValue=false;c.autosaveValue=false;actions=[];f.showLaunch();
}
f.callbacks.onNewGame=(slot:number)=>actions.push(`new:${slot}`);f.callbacks.onLoadGame=(slot:number)=>actions.push(`load:${slot}`);
c.saveActive=()=>{if(!c.activeSlot)return {ok:false,reason:'ephemeral-save'};c.persistedSlots[c.activeSlot-1]=structuredClone(c.active);c.dirtyValue=false;return {ok:true,save:structuredClone(c.active)};};
f.callbacks.onSaveGame=()=>{actions.push(`save:${c.activeSlot}`);return c.saveActive().ok;};
f.callbacks.onAutosaveChange=(value:boolean)=>{c.autosaveValue=value;return true;};
const panel=document.createElement('details');panel.dataset.testid='save-grid-review';panel.open=true;panel.style.cssText='position:fixed;left:5px;top:5px;z-index:999999;max-width:280px;background:#10202bea;color:white;padding:6px;font:11px monospace';panel.innerHTML='<summary>Save grid review</summary>';
const buttons=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='save-grid-status';status.style.whiteSpace='pre-wrap';panel.append(buttons,status);document.body.append(panel);
const add=(label:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;buttons.append(b);};
add('Mixed slots',()=>fixture());add('Four saves',()=>fixture(true));
add('New slots',()=>{f.slotOrigin='launch';f.screen='new-slots';f.render();});
add('Load slots',()=>{f.slotOrigin='launch';f.screen='load-slots';f.render();});add('Save menu',()=>f.showMapSection('save-load'));
add('Finish Nightworks',()=>{c.commitClear('dark',{crystal:false,boxGem:false,comboGem:false});f.showMapSection('save-load');});
const neutral={up:false,down:false,left:false,right:false,accept:false,back:false};const readPad=f.readGamepad.bind(f);let pad:any=null;f.readGamepad=()=>pad??readPad();
for(const key of ['up','down','left','right','accept','back'])add(`Pad ${key}`,()=>{pad={...neutral};f.update();pad={...neutral,[key]:true};f.update();f.update();pad={...neutral};f.update();pad=null;});
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({screen:f.currentScreen,selected:f.navButtons[f.selected]?.getAttribute('aria-label')||f.navButtons[f.selected]?.textContent,actions,preCrt:g.getGameFlowSurfaceDiagnostics().active},null,2);requestAnimationFrame(report);}fixture();f.screen='new-slots';f.render();report();
