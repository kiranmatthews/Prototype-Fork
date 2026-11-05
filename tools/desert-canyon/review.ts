import * as THREE from 'three';
import {desertPoint,DESERT_LENGTH,DESERT_CHECKPOINTS,DESERT_CHECKPOINT_NAMES,DESERT_GAPS,DESERT_CANYON_START} from '../../src/levels/desert-canyon';
const g=(window as unknown as {__game:any}).__game;
const panel=document.createElement('section');panel.setAttribute('aria-label','Canyon review');
panel.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:999999;background:#231b17e8;color:#f5e8d4;padding:9px 14px;border:1px solid #b69c70;border-radius:8px;font:12px system-ui;display:flex;align-items:center;gap:12px;flex-wrap:wrap';
panel.innerHTML=`<b>BRYCE · REVIEW</b><label>Location <select aria-label="Canyon location"><option value="6">Spawn</option><option value="58">Boardwalk takeoff</option>${DESERT_CHECKPOINT_NAMES.map((name,i)=>`<option value="${DESERT_CHECKPOINTS[i]}">${name}</option>`).join('')}</select></label><button>Go to location</button><button>Run traversal</button><button>Stop traversal</button><button>Test fall recovery</button><button>Save frame</button><label>Resolution <select aria-label="Canyon resolution"><option value="720">Normal 720</option><option value="max">MAX native</option></select></label><label>View <select aria-label="Canyon view"><option value="game">Gameplay</option><option value="wide">Wide terrain</option></select></label><output style="flex-basis:100%;font:11px monospace"></output>`;
document.body.append(panel);
const location=panel.querySelector('[aria-label="Canyon location"]') as HTMLSelectElement;
const output=panel.querySelector('output')!,buttons=panel.querySelectorAll('button');
let running=false,progress=0,saveRequested=false,frames=0,settleUntil=0,previousJump=false,savedFrame='';
const timings:number[]=[];let lastFrame=0;
g.renderQualitySettings.setRegularResolution(720);
function teleport(s:number){
  const p=new THREE.Vector3(...desertPoint(s));p.y+=.4;const heading=new THREE.Vector3(...desertPoint(s+2)).sub(p);heading.y=0;heading.normalize();
  g.player.respawn(g.getLevel(),true,false,{position:p,heading});g.player.endlessDeaths=true;
  progress=s;previousJump=false;g.launchReview.rate=1;settleUntil=performance.now()+500;
}
buttons[0].onclick=()=>{running=false;teleport(Number(location.value));};
buttons[1].onclick=()=>{teleport(Number(location.value));running=true;};
buttons[2].onclick=()=>{running=false;g.launchReview.rate=0;g.input.moveX=g.input.moveY=0;};
buttons[3].onclick=()=>{running=false;g.launchReview.rate=1;settleUntil=performance.now()+3000;g.player.pos.y=-680;g.player.state='air';g.player.grounded=false;};
buttons[4].onclick=()=>{saveRequested=true;};
(panel.querySelector('[aria-label="Canyon resolution"]') as HTMLSelectElement).onchange=e=>g.renderQualitySettings.setRegularResolution((e.target as HTMLSelectElement).value==='max'?null:720);
g.launchReview.beforeStep=()=>{
  if(!running)return;
  const p=g.player;
  if(['dead','finished'].includes(p.state)){running=false;settleUntil=performance.now()+3000;g.input.moveX=g.input.moveY=0;return;}
  // Anticipate bends with normal camera-relative device inputs.
  let best=Infinity,at=progress;
  for(let s=Math.max(0,progress-10);s<Math.min(DESERT_LENGTH,progress+25);s+=1){const q=desertPoint(s),d=(q[0]-p.pos.x)**2+(q[2]-p.pos.z)**2;if(d<best){best=d;at=s;}}
  progress=at;const target=desertPoint(at+12),dx=target[0]-p.pos.x,dz=target[2]-p.pos.z;
  const cf=p.raceInputBasis(g.getLevel());
  const f=dx*cf.x+dz*cf.z,l=-dx*cf.z+dz*cf.x;
  const distance=Math.hypot(dx,dz)||1;g.input.moveY=f/distance*.8;g.input.moveX=l/distance*.8;
  const jumping=DESERT_GAPS.some(gap=>at>gap.chargeFrom&&at<gap.releaseAt);
  g.input.jumpPressed=jumping&&!previousJump;g.input.jumpHeld=jumping;g.input.jumpReleased=!jumping&&previousJump;previousJump=jumping;
  g.input.grindHeld=false;g.input.grabHeld=p.speed>(at>DESERT_CANYON_START+95?12:20)&&at>90;
};
g.launchReview.afterCamera=()=>{
  if((panel.querySelector('[aria-label="Canyon view"]') as HTMLSelectElement).value==='wide'){
    const s=running?progress:Number(location.value),eye=desertPoint(s-22,-3),target=desertPoint(s+45);
    g.camera.position.set(eye[0],eye[1]+22,eye[2]);g.camera.up.set(0,1,0);g.camera.lookAt(target[0],target[1]+10,target[2]);g.camera.updateMatrixWorld();
  }
};
function report(){
  const p=g.player,l=g.getLevel(),assets=l.jungleAssetDiagnostics;
  if(!running&&settleUntil&&performance.now()>settleUntil){g.launchReview.rate=0;settleUntil=0;}
  if(g.frameStats.frame!==lastFrame){lastFrame=g.frameStats.frame;timings.push(g.frameStats.rawDt*1000);if(timings.length>240)timings.shift();}
  const sorted=timings.slice().sort((a,b)=>a-b),performanceMs={median:+(sorted[Math.floor(sorted.length*.5)]||0).toFixed(1),p95:+(sorted[Math.floor(sorted.length*.95)]||0).toFixed(1),samples:sorted.length};
  output.textContent=JSON.stringify({loading:g.getLoadingDiagnostics(),state:p.state,grounded:p.grounded,position:p.pos.toArray().map((x:number)=>+x.toFixed(2)),route:+progress.toFixed(1),running,camera:{rig:l.cameraRig,chase:g.TUNING.chaseCam,authoredSkate:p.authoredSkateCamera,position:g.camera.position.toArray(),direction:g.camera.getWorldDirection(new THREE.Vector3()).toArray()},assets,render:g.getRenderFrameStats(),resolution:g.getRenderQualitySizes(),drawingBuffer:[g.renderer.domElement.width,g.renderer.domElement.height],performanceMs,savedFrame});
  if(saveRequested){
    saveRequested=false;
    g.renderer.domElement.toBlob((blob:Blob|null)=>{if(!blob)return;
      if(new URLSearchParams(window.location.search).has('capture')){
        fetch('http://127.0.0.1:51988/frame',{method:'POST',headers:{'Content-Type':'image/png'},body:blob}).then(async r=>{savedFrame=r.ok?await r.text():'Capture failed';}).catch(()=>savedFrame='Start capture-server.mjs first');return;
      }
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`bryce-canyon-${Math.round(progress)}-${++frames}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    });
  }
  requestAnimationFrame(report);
}
requestAnimationFrame(report);
