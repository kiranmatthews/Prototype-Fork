// Local-only campaign fixtures and a standard-mapped PS controller. Slot 0 never writes a save.
import {CAMPAIGN_LEVELS} from '../src/campaign';
const g:any=await new Promise(resolve=>{const poll=()=>{if((window as any).__game)resolve((window as any).__game);else requestAnimationFrame(poll);};poll();});
const pad:any={id:'DualSense Wireless Controller (054c-0ce6)',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0})),timestamp:0};
g.input.pollGamepad=()=>pad;
const panel=document.createElement('details');panel.dataset.crtGuestPanelHost='';panel.open=true;
panel.style.cssText='position:fixed;left:4px;top:4px;z-index:999999;max-width:260px;background:#091b29ed;color:white;font:11px monospace;padding:5px';
const summary=document.createElement('summary');summary.textContent='Review controls';panel.append(summary);
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='level-select-review-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
let launches:string[]=[];
const launch=g.gameFlow.callbacks.onLevelSelect;g.gameFlow.callbacks.onLevelSelect=(id:string)=>{launches.push(id);launch(id);};
function fixture(all:boolean){
 const save=g.campaign.startEphemeral();
 if(all)for(const [i,d] of CAMPAIGN_LEVELS.entries())save.levels[d.progressKey]={cleared:true,crystal:i%2===0,boxGem:i%3===0,comboGem:i%2===1,timeRelic:false,timeMedal:'silver',bestTime:64.15,trialTimes:[64.15,68.3,72.8],...(d.competition?{cup:true}:{})};
 launches=[];g.player.lives=4;g.player.fruit=12;
 g.gameFlow.hide();g.switchLevel('jungle');g.gameFlow.showPause({levelName:'Jungle Ruins',inWarpRoom:false});
}
function press(index:number){pad.buttons[index].pressed=true;pad.buttons[index].value=1;
 requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{pad.buttons[index].pressed=false;pad.buttons[index].value=0;})));}
const add=(name:string,fn:()=>void)=>{const button=document.createElement('button');button.textContent=name;button.style.cssText='font:11px Arial;padding:5px;margin:2px';button.onclick=fn;controls.append(button);};
add('CRT on',()=>g.crtGuestSettings.setEnabled(true));add('CRT off',()=>g.crtGuestSettings.setEnabled(false));
add('Fresh save',()=>fixture(false));add('Both islands',()=>fixture(true));
add('Pause',()=>{g.gameFlow.showPause({levelName:g.getLevel().name,inWarpRoom:false});});
add('Map',()=>{g.gameFlow.hide();g.switchLevel('warproom');});
for(const [name,index] of [['Up',12],['Down',13],['Left',14],['Right',15],['Cross',0],['Circle',1],['Touchpad',17]] as const)add(name,()=>press(index));
add('Hold Cross',()=>{pad.buttons[0].pressed=true;pad.buttons[0].value=1;});
add('Release pad',()=>{for(const b of pad.buttons){b.pressed=false;b.value=0;}});
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');
 status.textContent=JSON.stringify({screen:g.gameFlow.currentScreen,island:g.gameFlow.levelSelectIsland,selected:g.gameFlow.levelSelectKey,
  currentLevel:g.getLevel().id??g.getLevel().name,launches,charging:g.player.charging,
  crt:g.crtGuestSettings.enabled,crtPass:g.getCrtDiagnostics()?.active,
  surface:g.getGameFlowSurfaceDiagnostics().screen,composited:g.getGameFlowSurfaceDiagnostics().active},null,2);
 requestAnimationFrame(report);
}
fixture(true);report();
add('Capture previews',()=>{void import('./capture-level-previews').then(module=>module.captureLevelPreviews(g,text=>summary.textContent=text)).catch(error=>summary.textContent=String(error));});
add('Hide controls',()=>panel.open=false);
