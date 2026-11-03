// Local review controls over the production renderer, Player and BoulderChase.
// Fixtures use ordinary respawn/reset entry points; pilots only supply inputs.
import * as THREE from 'three';
import * as m from '../src/levels/ripcord-river.ts';
import {createRipcordLivePilot} from './ripcord-live-pilot.mjs';
const panel=document.createElement('section');panel.style.cssText='position:fixed;z-index:2147483646;left:10px;top:10px;padding:8px;background:#10231de8;color:white;font:12px monospace;max-width:800px';
const buttons=document.createElement('div'),status=document.createElement('pre');status.id='chasm-review-status';status.style.cssText='white-space:pre-wrap;max-height:105px;overflow:auto';panel.append(buttons,status);document.body.append(panel);
const g=await new Promise(resolve=>{const ready=()=>{const game=window.__game;if(game&&!game.gameFlow.blocksGameplay)resolve(game);else{status.textContent=game?'Waiting for playable game: '+game.gameFlow.blocksGameplay:'Waiting for game runtime';requestAnimationFrame(ready);}};ready();});
status.textContent='Restoring Ripcord River source';
g.restoreBuiltin('rumblewater-run');await g.switchLevel('rumblewater-run');
let l=g.getLevel();const p=g.player;status.textContent='Preparing river assets';await l.prepareJungleAssets();
const {RIPCORD_BOULDER_END:a,RIPCORD_SANCTUARY_START:b}=m,mid=(a+b)/2;
const point=(s,y=0,u=0)=>m.ripcordPoint(s,m.ripcordHeight(s)+y,u);
let eye=null,target=null,pilot=null,mode='overview',frames=0,evidence={},pendingShot=null;
const shots=new Map(),step=p.step.bind(p),render=g.renderer.render.bind(g.renderer);let view=l.updateSceneryView.bind(l);
const neutral={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,transferHeld:false};
function camera(){if(!eye)return;g.camera.position.fromArray(eye);g.camera.up.set(0,1,0);g.camera.fov=56;g.camera.lookAt(new THREE.Vector3(...target));g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);}
l.updateSceneryView=(c,...args)=>{camera();view(c,...args);};
g.renderer.render=(scene,c)=>{if(scene===g.scene&&c===g.camera&&eye){camera();view(c);}render(scene,c);};
function place(s,u=0){if(l!==g.getLevel()){l=g.getLevel();view=l.updateSceneryView.bind(l);l.updateSceneryView=(c,...args)=>{camera();view(c,...args);};}g.gameFlow.hide();p.respawn(l,true,false,{position:new THREE.Vector3(...point(s,.12,u))});p.commitRenderStep(l);frames=0;evidence={errors:[],deaths:0,livesAtStart:p.lives,deadSeen:false,grindFrames:0,fallPhases:[]};}
function overview(){mode='overview';pilot=null;eye=point(mid,42,79);target=point(mid,-8,0);}
function remember(label){if(shots.has(label))return;pendingShot=label;}
const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.style.margin='3px';b.onclick=fn;buttons.append(b);};
button('Run crossing',()=>{place(a-44);eye=null;mode='crossing';pilot=createRipcordLivePilot(g,'chasm');});
button('Miss the rail',()=>{place(a-4);eye=null;mode='miss';});
button('Overview',()=>{place(a-44);overview();});
button('Watch boulder fall',()=>{place(b+8);l.boulder.course.reset(new THREE.Vector3(...point(a-6)));overview();mode='fall';});
button('Native MAX',()=>{g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
button('Normal presentation',()=>{g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
button('Hide controls',()=>panel.style.opacity=panel.style.opacity==='0'?'1':'0');
const capture=document.createElement('img');capture.style.cssText='position:fixed;inset:0;width:100%;height:100%;object-fit:contain;display:none;z-index:2147483645';document.body.append(capture);
button('Live view',()=>capture.style.display='none');
p.step=(dt,input,...rest)=>{
 if(mode==='overview'||mode==='fall')return;
 try{
  const sample=mode==='crossing'?pilot.next():null;
  Object.assign(input,neutral,sample??{});
  if(mode==='miss'&&!evidence.deadSeen){
   const s=m.ripcordProgress(p.pos),q=point(s+7),dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,d=Math.hypot(dx,dz)||1,f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z);
   input.moveX=(dx*-f.z+dz*f.x)/d;input.moveY=(dx*f.x+dz*f.z)/d;input.jumpHeld=true;
  }
  step(dt,input,...rest);frames++;if(['dead','gameover'].includes(p.state)&&!evidence.deadSeen){evidence.deadSeen=true;evidence.deaths++;}
  const s=m.ripcordProgress(p.pos);
  if(p.state==='grind'&&s>a&&s<b){evidence.grindFrames++;if(s>a+23)remember('Mid-chasm grind');}
  if(mode==='crossing'&&p.state==='finished'){evidence.finished=true;evidence.crystal=p.hasCrystal;evidence.livesAtEnd=p.lives;mode='done';remember('Sanctuary finish');}
  if(mode==='miss'&&evidence.deadSeen&&p.grounded){evidence.pitRespawn=true;evidence.livesAtEnd=p.lives;mode='done';remember('Pit respawn');}
 }catch(e){evidence.errors.push(String(e));mode='done';}
};
function inspect(){
 const stone=l.boulder.course.actors.at(-1);
 if(mode==='fall'){
  if(!evidence.fallPhases.includes(stone.phase))evidence.fallPhases.push(stone.phase);
  if(stone.phase==='falling'&&stone.verticalSpeed>22&&stone.verticalSpeed<24)remember('Boulder in chasm');
 }
 if(pendingShot){const label=pendingShot;pendingShot=null;shots.set(label,g.captureBonusReviewFrame());button(label,()=>{capture.src=shots.get(label);capture.style.display='block';});}
 status.textContent=JSON.stringify({mode,frames,gapMetres:b-a,state:p.state,progress:Math.round(m.ripcordProgress(p.pos)),boulder:stone.phase,evidence,
  resolution:g.renderQualitySettings.regularResolution,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],assets:l.jungleAssetDiagnostics?.errors??[],stamp:document.querySelector('.hud-build')?.textContent});
 requestAnimationFrame(inspect);
}
window.addEventListener('error',e=>evidence.errors?.push(e.message));window.addEventListener('unhandledrejection',e=>evidence.errors?.push(String(e.reason)));
place(a-44);overview();requestAnimationFrame(inspect);
