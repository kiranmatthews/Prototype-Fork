import * as THREE from 'three';
const panel=document.createElement('section');panel.style.cssText='position:fixed;z-index:2147483646;left:8px;top:8px;background:#12202dea;color:white;padding:8px;font:12px monospace;max-width:95vw';
const buttons=document.createElement('div'),status=document.createElement('pre');status.id='sky-review-status';status.style.cssText='max-height:140px;overflow:auto;white-space:pre-wrap';panel.append(buttons,status);document.body.append(panel);
const g=await new Promise(resolve=>{const poll=()=>window.__game&&!window.__game.gameFlow.blocksGameplay?resolve(window.__game):requestAnimationFrame(poll);poll();});
const button=(name,action)=>{const b=document.createElement('button');b.textContent=name;b.onclick=action;buttons.append(b);};
let fixed=true,pitch=.2,heading=0,skyOnly=false;
g.player.step=()=>{};
const observed=new WeakSet();
function positionCamera(){if(!fixed)return;const camera=g.camera;camera.position.copy(g.getLevel().spawnPos).add(new THREE.Vector3(0,6,14));camera.up.set(0,1,0);camera.fov=65;camera.lookAt(camera.position.clone().add(new THREE.Vector3(heading,pitch,-1).multiplyScalar(100)));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
function expose(){panel.inert=false;panel.removeAttribute('aria-hidden');const l=g.getLevel();if(!observed.has(l)){observed.add(l);const update=l.updateSceneryView.bind(l);l.updateSceneryView=(camera,...args)=>{if(camera===g.camera)positionCamera();return update(camera,...args);};}if(l.water&&!observed.has(l.water)){observed.add(l.water);const update=l.water.update.bind(l.water);l.water.update=(dt,camera,...args)=>{positionCamera();return update(dt,camera,...args);};}requestAnimationFrame(expose);}expose();
const render=g.renderer.render.bind(g.renderer),skyScene=new THREE.Scene();
g.renderer.render=(scene,camera)=>{
 if(scene===g.scene&&camera===g.camera&&fixed){
  camera.position.copy(g.getLevel().spawnPos).add(new THREE.Vector3(0,6,14));
  camera.up.set(0,1,0);camera.fov=65;camera.lookAt(camera.position.clone().add(new THREE.Vector3(heading,pitch,-1).multiplyScalar(100)));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  if(skyOnly){const sky=scene.getObjectByName('Distant sky backdrop')??scene.getObjectByName('Sea-level sky backdrop');if(sky){skyScene.background=scene.background;skyScene.add(sky);render(skyScene,camera);scene.add(sky);return;}}
 }
 render(scene,camera);
};
for(const [label,id] of [['Sunset Safari','custard-creek'],['Tribal Run','tribal-run'],['Treehouse Trails','treehouse-trail'],['Banana Bay','beachfront'],['Beach Street','coastal-street-run'],['Sky Bridge','sky'],['Skystream','skystream']])button(label,()=>{g.switchLevel(id);g.gameFlow.hide();});
button('Sky only',()=>skyOnly=!skyOnly);button('Horizon',()=>{pitch=0;heading=0;});button('Clouds',()=>{pitch=.4;heading=0;});button('Sun view',()=>{heading=.42/.74;pitch=.52/.74;});button('Hide readout',()=>status.hidden=!status.hidden);button('MAX/native',()=>{g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});button('Normal',()=>{g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
const capture=document.createElement('a');capture.textContent='Capture';capture.download='sky-restoration.png';capture.style.cssText='color:white;padding:6px';buttons.append(capture);capture.onclick=()=>{render(g.scene,g.camera);capture.href=g.renderer.domElement.toDataURL('image/png');};
setInterval(()=>{const l=g.getLevel(),s=g.scene.getObjectByName('Distant sky backdrop')??g.scene.getObjectByName('Sea-level sky backdrop'),m=s?.material,pr=m&&g.renderer.properties.get(m).currentProgram,gl=g.renderer.getContext(),uniform=name=>{const u=pr&&gl.getUniformLocation(pr.program,name);return u?gl.getUniform(pr.program,u):null;};status.textContent=JSON.stringify({level:g.getCurrentLevel().id,preset:l.skyPreset,sky:s?.name,visible:s?.visible,artwork:m?.userData.skyArtwork,texture:[m?.map?.image?.width,m?.map?.image?.height],water:!!l.water,haze:uniform('uSkyHazeStrength'),tint:uniform('uCloudRoadSky'),bananaSun:uniform('uBananaBaySun'),program:m?.customProgramCacheKey(),buffer:[g.renderer.domElement.width,g.renderer.domElement.height],stamp:document.querySelector('.hud-build')?.textContent},null,1);},500);
