// Session-only source-owned review controls. No level or campaign save is written.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
g.campaign.startEphemeral();g.gameFlow.hide();const level=g.getLevel(),p=g.player,spawn=level.spawnPos.clone();
level.crate(spawn.x-1.8,spawn.y,spawn.z-3,'tnt',{noAuto:true});const tnt=level.crates.at(-1);
level.crate(spawn.x+1.8,spawn.y,spawn.z-3,'nitro',{noAuto:true});const nitro=level.crates.at(-1);
await Promise.all([tnt.explosiveBundle.ready,nitro.explosiveBundle.ready]);
p.step=()=>{};let paused=false,selected=tnt,angle=.5,compare=false;
const nativeUpdate=level.update.bind(level);level.update=(dt:number)=>nativeUpdate(paused?0:dt);
const panel=document.createElement('details');panel.open=true;panel.style.cssText='position:fixed;z-index:999999;bottom:10px;left:10px;max-width:330px;background:#071d29ed;color:white;font:12px monospace;padding:10px';
const summary=document.createElement('summary');summary.textContent='Explosive bundle review';const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='explosive-status';status.style.whiteSpace='pre-wrap';panel.append(summary,controls,status);document.body.append(panel);
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:7px;margin:2px';b.onclick=fn;controls.append(b);};
add('TNT',()=>{selected=tnt;compare=false;});add('Nitro',()=>{selected=nitro;compare=false;});add('Both',()=>compare=true);
add('Reset',()=>{level.reset(true);paused=false;});add('Light TNT',()=>{level.lightFuse(tnt);paused=false;});add('Pause',()=>paused=true);add('Resume',()=>paused=false);
for(const [label,remaining]of[['Full fuse',3],['Two seconds',2],['One second',1],['Last quarter',.25]] as const)add(label,()=>{level.reset(true);tnt.fuse=remaining;paused=true;level.update(0);selected=tnt;compare=false;});
for(const [label,value]of[['Front',.5],['Side',Math.PI/2+.5],['Back',Math.PI+.5],['Top',-1]] as const)add(label,()=>angle=value);
add('Stomp TNT',()=>{p.state='air';p.grounded=false;p.spinTimer=0;p.slamActive=false;p.freeSkate=false;p.speed=0;p.prevPos.set(tnt.mesh.position.x,tnt.box.max.y+.2,tnt.mesh.position.z);p.pos.set(tnt.mesh.position.x,tnt.box.max.y-.06,tnt.mesh.position.z);p.vVel=-10;p.collide(level);paused=false;});
add('CRT on',()=>g.crtGuestSettings.setEnabled(true));add('CRT off',()=>g.crtGuestSettings.setEnabled(false));add('Finish review',()=>location.assign('/?playtest&level=jungle'));
const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args:any[])=>{if(args[1]===g.camera){
 const target=compare?tnt.mesh.position.clone().lerp(nitro.mesh.position,.5):selected.mesh.position.clone();target.y+=.1;g.camera.fov=35;g.camera.up.set(0,1,0);p.group.visible=false;
 const distance=compare?7:3.2;
 if(angle===-1)g.camera.position.copy(target).add(new THREE.Vector3(0,distance+.6,.01));else g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*distance,compare?2.8:1.8,Math.cos(angle)*distance));
 g.camera.lookAt(target);g.camera.updateProjectionMatrix();}render(...args);};
function report(){panel.inert=false;document.body.classList.add('game-debug-hidden');document.body.classList.remove('game-debug-visible');status.textContent=JSON.stringify({view:compare?'both':selected===tnt?'tnt':'nitro',paused,tnt:{alive:tnt.alive,fuse:tnt.fuse??null,remaining:tnt.explosiveBundle.fuseFraction.value,pulse:tnt.explosiveBundle.pulse.value,tip:tnt.explosiveBundle.ember.position.toArray(),loaded:tnt.explosiveBundle.loaded},nitro:{alive:nitro.alive,pulse:nitro.explosiveBundle.pulse.value,hasFuse:!!nitro.explosiveBundle.ember,loaded:nitro.explosiveBundle.loaded},crt:g.crtGuestSettings.enabled},null,2);requestAnimationFrame(report);}report();
