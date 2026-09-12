// Local-only reproduction of the supplied map input pulses. Unlock/focus
// overrides are in memory and map browsing cannot write a save in this view.
import { CampaignStore } from '../src/campaign';
import { WorldMapController } from '../src/worldMapController';
import recording from './fixtures/world-map-skid-inputs.json';
CampaignStore.prototype.levelUnlocked=()=>true;
CampaignStore.prototype.setMapFocus=()=>{};
CampaignStore.prototype.recommendedMapLevelKey=()=> 'jungle';
let frame=0,playing=true,skids=0,map:any=null,game:any=null;
const native=WorldMapController.prototype.step;
WorldMapController.prototype.step=function(dt,input){
  map=this;
  const pulse=playing?recording.pulses.find(p=>frame>=p.start&&frame<p.end):null;
  input.moveX=pulse?.x??0;input.moveY=pulse?.y??0;
  input.mapDirectionX=input.mapDirectionY=0;
  input.jumpPressed=input.grindPressed=input.spinPressed=input.grabPressed=input.confirmPressed=false;
  // Model returning from gameplay with the shared mutable Input reference.
  (this as any).player.rawInput=input;
  native.call(this,dt,input);
  if(game?.characterAnimationRuntime.activeClipId==='player.run-stop')skids++;
  if(playing)frame++;
};
await import('../src/main');
game=(window as any).__game;
const panel=document.createElement('div');panel.style.cssText='position:fixed;z-index:999999;left:12px;top:12px;background:#132128ef;color:white;padding:12px;width:270px;font:13px monospace';
const buttons=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='map-skid-status';status.style.whiteSpace='pre-wrap';panel.append(buttons,status);document.body.append(panel);
const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;buttons.append(b);};
button('Replay map taps',()=>{frame=0;skids=0;playing=true;map?.activate(game.getLevel(),'jungle');});
button('Map idle',()=>{playing=false;});
button('Boardslide route',()=>{playing=false;map?.activate(game.getLevel(),'slipstream');map?.travelTo('codex-switchback');});
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');const runtime=game.characterAnimationRuntime;
 status.textContent=JSON.stringify({frame,playing,selected:map?.selectedKey,moving:map?.moving,
  presentation:game.player.animationIntent.presentation,clip:runtime.activeClipId,transient:runtime.diagnostics.transientClipId,skidFrames:skids},null,2);
 requestAnimationFrame(report);
}report();
