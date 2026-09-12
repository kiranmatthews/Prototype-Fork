// Local-only review. No saved suite, level, tuning or campaign writes.
import * as THREE from 'three';
import { Level } from '../src/level';
import { createPlayerStarterAnimationSuite, RigBinding } from '../src/animation';
const g:any = await new Promise(resolve => { const poll = () => {
  const game = (window as any).__game; if (game) resolve(game); else requestAnimationFrame(poll);
}; poll(); });
const p = g.player, runtime = g.characterAnimationRuntime;
runtime.setDocument(createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
const fixture = new Level(g.scene, {id:'rope-review', name:'Rope review', data:{
  v:1,name:'Rope review',spawn:[0,2,0],killY:-80,components:[
    {t:'ropeswing',p:[0,6,0],len:6,amp:0,speed:1,phase:0},
    {t:'gate',p:[0,-30,0]},
  ],
}});
let angle = 0, climb = 0, frozen = false, frames = 0;
const neutral = () => ({moveX:0,moveY:climb,jumpHeld:false,jumpPressed:false,jumpReleased:false,
  grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,
  grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,consumeEdges(){}});
function catchRope() {
  fixture.update(0); p.pos.set(0,2,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;
  p.axisF.set(0,0,-1);p.axisL.set(1,0,0);p.lastVelX=0;p.lastVelZ=-12;p.speed=12;p.vVel=-2;
  p.ropeCoolT=0;p.syncVisual(neutral(),0);p.tryRopeGrab(fixture);runtime.restart();frozen=false;
}
p.step = (dt:number) => {if(frozen)return;fixture.update(dt);
  if(p.state==='rope'){p.ropeD=3; p.stepRope(dt,neutral(),fixture);}
  else {p.ropeReleaseElapsed+=dt;if(p.ropeReleaseElapsed>p.ropeReleaseDuration)catchRope();}
  p.syncVisual(neutral(),dt);frames++;
};
const render = g.renderer.render.bind(g.renderer);
g.renderer.render = (...args:any[]) => {if(args[1]===g.camera){
  p.bodyGroup.updateWorldMatrix(true,true);
  const target=p.bodyGroup.localToWorld(new THREE.Vector3(0,1,0));
  const eye=p.bodyGroup.localToWorld(new THREE.Vector3(Math.sin(angle)*4,1.1,Math.cos(angle)*4));
  g.camera.position.copy(eye);g.camera.up.set(0,1,0);g.camera.lookAt(target);
}return render(...args);};
const panel=document.createElement('div');panel.style.cssText='position:fixed;top:60px;left:8px;z-index:999999;background:#15212def;color:white;padding:12px;width:250px;font:13px monospace';
const buttons=document.createElement('div'),status=document.createElement('pre');status.style.whiteSpace='pre-wrap';panel.append(buttons,status);document.body.append(panel);
const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;b.style.cssText='padding:7px;margin:2px';buttons.append(b);};
button('Hang',()=>{climb=0;catchRope();});button('Climb',()=>{climb=1;catchRope();});button('Descend',()=>{climb=-1;catchRope();});
button('Release',()=>{if(p.ropeObj){p.chargeTimer=0;p.ropeLeap(fixture,p.ropeObj);}frozen=false;});
button('Charged release',()=>{if(p.ropeObj){p.chargeTimer=999;p.ropeLeap(fixture,p.ropeObj);}frozen=false;});
for(const degrees of [0,40,90,180])button(`${degrees}°`,()=>angle=THREE.MathUtils.degToRad(degrees));
button('Freeze',()=>frozen=true);button('Play',()=>frozen=false);
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({frames,clip:runtime.activeClipId,...p.ropeAnimationDiagnostics},null,2);requestAnimationFrame(report);}
catchRope();report();
