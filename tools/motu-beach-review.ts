// Local review controls; never imported by the production application.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const ready=()=>{const game=(window as any).__game;if(game&&!game.gameFlow.blocksGameplay)resolve(game);else requestAnimationFrame(ready);};ready();});
const event=g.getCompetition();event.startRun();event.phase='running';event.stepRun=()=>false;
const panel=document.createElement('section');panel.style.cssText='position:fixed;z-index:2147483646;left:12px;top:12px;padding:10px;background:#11262eea;color:white;font:12px monospace;max-width:430px';
const buttons=document.createElement('div'),status=document.createElement('pre');status.style.cssText='white-space:pre-wrap;max-height:140px;overflow:auto';panel.append(buttons,status);document.body.append(panel);
let eye:number[]|null=null,target:number[]=[0,0,-60],fov=53;
const render=g.renderer.render.bind(g.renderer),view=g.getLevel().updateSceneryView.bind(g.getLevel()),playerStep=g.player.step.bind(g.player);
const routes=[
  {name:'halfpipe east',p:[43,.1,-125],h:[1,0,0],pop:true},
  {name:'halfpipe west',p:[43,.1,-125],h:[-1,0,0],pop:true},
  {name:'kidney east',p:[-42,.1,-134],h:[1,0,0],pop:true},
  {name:'kidney west',p:[-42,.1,-134],h:[-1,0,0],pop:true},
  {name:'south perimeter',p:[0,.1,31],h:[0,0,1],pop:true},
  {name:'beach flat bar',p:[54,.86,-40],h:[0,0,-1],grind:true},
];
let review:any=null;
const blank=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
g.player.step=(dt:number,input:any,level:any)=>{
  if(eye)return;
  if(!review||review.done){playerStep(dt,input,level);return;}
  const route=routes[review.index],p=g.player;
  if(review.frame===0){
    p.respawn(level,true,true,{position:new THREE.Vector3().fromArray(route.p),heading:new THREE.Vector3().fromArray(route.h)});
    p.axisF.fromArray(route.h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.speed=19;p.freeSkate=true;p.balanceBoostT=10;
    p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);
    if(route.grind){p.pos.fromArray(route.p);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-1;}
  }
  const release=route.pop&&!review.released&&p.grounded&&p.rideNormal.y<.42;
  if(release)review.released=true;
  const scripted={...blank(),jumpHeld:!review.released&&!route.grind,jumpPressed:review.frame===0&&!route.grind,jumpReleased:release,
    grindHeld:!!route.grind,grindPressed:!!route.grind&&review.frame===0};
  playerStep(dt,scripted,level);review.frame++;review.air ||= p.vertAir||p.state==='air';review.grind ||= p.state==='grind';
  review.maxY=Math.max(review.maxY,p.pos.y);
  const failed=p.isBailing||p.pos.y<-.1||!p.pos.toArray().every(Number.isFinite);
  const completed=route.grind?review.grind&&review.frame>45:review.air&&p.grounded;
  if(failed||completed||review.frame>450){
    review.results.push({name:route.name,passed:!failed&&completed,frames:review.frame,maxY:review.maxY,air:review.air,grind:review.grind,position:p.pos.toArray()});
    review.index++;review.frame=0;review.air=false;review.grind=false;review.maxY=0;review.released=false;
    if(review.index===routes.length){review.done=true;review.passed=review.results.every((r:any)=>r.passed);eye=[156,145,137];target=[-3,0,-64];}
  }
  status.textContent=JSON.stringify(review,null,2);
};
g.getLevel().updateSceneryView=(camera:THREE.PerspectiveCamera,...args:any[])=>{
  if(eye){camera.position.fromArray(eye);camera.fov=fov;camera.lookAt(new THREE.Vector3().fromArray(target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
  view(camera,...args);
};
g.renderer.render=(scene:THREE.Scene,camera:THREE.PerspectiveCamera)=>{
  if(scene===g.scene&&camera===g.camera&&eye){camera.position.fromArray(eye);camera.fov=fov;camera.lookAt(new THREE.Vector3().fromArray(target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);view(camera);}
  render(scene,camera);
};
const button=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.margin='3px';b.onclick=fn;buttons.append(b);};
function shot(e:number[],t:number[],angle=53){eye=e;target=t;fov=angle;document.body.classList.add('motu-review-clean');}
button('Overview',()=>shot([156,145,137],[-3,0,-64],53));
button('Beach horizon',()=>shot([-65,17,48],[38,6,-75],63));
button('Kidney bowl',()=>shot([-72,22,-103],[-42,1,-134],58));
button('Halfpipe',()=>shot([70,19,-88],[43,2,-125],58));
button('Sponsors and crowd',()=>shot([-62,10,-27],[-89,8,-29],60));
button('Street terrace',()=>shot([-44,9,45],[-20,1,27],59));
button('Sun flare',()=>shot([0,5,-45],[65,47,-108],60));
button('Native MAX',()=>g.renderQualitySettings.setRegularResolution(null));
button('Normal resolution',()=>g.renderQualitySettings.setRegularResolution(720));
button('Play',()=>{eye=null;document.body.classList.remove('motu-review-clean');if(g.getCompetition()?.phase==='intro')g.competitionAction('start');});
button('Ride checks',()=>{eye=null;review={index:0,frame:0,air:false,grind:false,maxY:0,released:false,done:false,results:[]};document.body.classList.add('motu-review-clean');});
button('Hide review',()=>panel.style.opacity=panel.style.opacity==='0'?'1':'0');
button('Report',()=>{
  const assets:Record<string,{instances:number;triangles:number}>= {};
  g.scene.traverse((o:any)=>{const k=o.userData.jungleAsset;if(!k||!o.isInstancedMesh)return;assets[k]??={instances:0,triangles:0};assets[k].instances+=o.count;assets[k].triangles=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  const lights:any[]=[];g.scene.traverse((o:any)=>{if(o.isLight)lights.push({type:o.type,intensity:o.intensity,color:o.color.getHexString()});});
  status.textContent=JSON.stringify({motu:g.getLevel().motuBeachDiagnostics,assets,lights,render:g.getRenderFrameStats(),sizes:g.getRenderQualitySizes(),player:g.player.pos.toArray()},null,2);
});
status.textContent='Local visual review. Native MAX and normal presentation; all scenery retains native geometry.';
shot([156,145,137],[-3,0,-64]);
