// Development-only visible test controls. No review code enters the release.
import * as THREE from 'three';
import * as m from '../src/levels/tribal-run';
// @ts-expect-error Shared browser/native input generator.
import {runTribalMoving} from './tribal-moving-pilot.mjs';
const g:any=await new Promise(resolve=>{const ready=()=>{const value=(window as any).__game;value?resolve(value):requestAnimationFrame(ready);};ready();});
g.campaign.startEphemeral();const p=g.player,l=g.getLevel();await l.prepareJungleAssets();
const panel=document.createElement('details');panel.open=true;panel.style.cssText='position:fixed;left:6px;top:6px;z-index:999999;background:#182315ed;color:white;padding:8px;max-width:320px;font:11px monospace';
panel.innerHTML='<summary>Tribal moving-platform review</summary>';const buttons=document.createElement('div'),status=document.createElement('pre');status.id='tribal-status';status.style.whiteSpace='pre-wrap';panel.append(buttons,status);document.body.append(panel);
let running=false,frozen=false,ticks=0,mode='Ready',pilot:any,report:any={},previous:any={},spinTicks=0,finishTicks=0;
const results:any[]=[];
const held=['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld'],edges=['jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','transferPressed','restartPressed'];
const clear=(input:any)=>{input.moveX=input.moveY=0;for(const k of [...held,...edges])input[k]=false;};
function place(s:number,u=0,y=m.tribalHeight(s)+.12,hard=true){running=frozen=false;clear(g.input);g.gameFlow.hide();p.respawn(l,hard,true,{position:new THREE.Vector3(...m.tribalPoint(s,y,u)),heading:new THREE.Vector3(...m.tribalTangent(s))});mode='Manual';}
function start(first:number,last:number){place(first?m.TRIBAL_RUN_CROSSINGS[first].a-8:0);ticks=0;previous={};report={rides:[],actions:[]};
 const r={p,l,source:m.TRIBAL_RUN_LEVEL,sourceModule:m,report,get frame(){return ticks;}};
 pilot=runTribalMoving(r,{first,last,finish:last===28});running=true;mode='Input pilot';}
const button=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:5px;margin:2px';b.onclick=fn;buttons.append(b);};
button('Start',()=>place(0));button('Run first five',()=>start(0,4));button('Run final three',()=>start(26,28));button('Run whole course',()=>start(0,28));
for(const n of [1,3,5,10,18,29])button('Crossing '+n,()=>place(m.TRIBAL_RUN_CROSSINGS[n-1].a-8));
button('Crab patrol',()=>place(126));button('Drum court',()=>place(978));button('Checkpoint spin',()=>{place(250);spinTicks=35;});
button('River reset',()=>{place(106,0,-10.4,false);p.state='air';p.grounded=false;p.vVel=-2;mode='Water reset';});
button('Finish gate',()=>{place(2305);finishTicks=150;});
button('MAX native',()=>g.renderQualitySettings.setRegularResolution(null));button('720p normal',()=>g.renderQualitySettings.setRegularResolution(720));
button('Freeze',()=>{running=false;frozen=true;clear(g.input);mode='Frozen';});button('Manual',()=>{running=frozen=false;clear(g.input);mode='Manual';});button('Hide',()=>panel.open=false);
const native=p.step.bind(p);
p.step=(dt:number,input:any,current:any)=>{
 if(frozen)return;
 if(spinTicks){clear(input);input.spinPressed=spinTicks--%15===0;}
 if(finishTicks){clear(input);input.moveY=1;finishTicks--;}
 if(running){
  try{
   p.viewInput.reset();const next=pilot.next();clear(input);
   if(next.done){running=false;mode='PASS';results.push({pass:true,...next.value});}
   else{
    const sample=next.value;input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;const length=Math.hypot(input.moveX,input.moveY);if(length>1){input.moveX/=length;input.moveY/=length;}
    input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
    for(const k of held){input[k]=!!sample[k];const edge=k.replace('Held','Pressed');input[edge]=sample[edge]??(input[k]&&!previous[k]);}
    input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!previous.jumpHeld);previous={...input};ticks++;
   }
  }catch(error){mode='FAIL';running=false;results.push({pass:false,error:String(error)});clear(input);}
 }
 return native(dt,input,current);
};
function update(){panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({mode,stage:report.stage,seconds:ticks/60,rides:report.rides?.length,resolution:g.renderQualitySettings.regularResolution,position:p.pos.toArray().map((n:number)=>+n.toFixed(2)),state:p.state,grounded:p.grounded,mover:p.groundHit?.moverId,deaths:p.totalDeaths,checkpoints:l.checkpoints.filter((c:any)=>c.active).length,enemies:l.enemies.length,enemyArt:l.enemies.slice(0,2).map((e:any)=>e.visual?.diagnostics??e.group.userData.enemyVisual),assets:l.jungleAssetDiagnostics.errors,results},null,1);requestAnimationFrame(update);}update();
