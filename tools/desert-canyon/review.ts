import * as THREE from 'three';
import {desertPoint,desertGround,DESERT_LENGTH,DESERT_CHECKPOINTS,DESERT_CHECKPOINT_NAMES,DESERT_GAPS,DESERT_CANYON_START,DESERT_VISTA_START,DESERT_YELLOW_GEM,DESERT_BONUS_STATION} from '../../src/levels/desert-canyon';
const g=(window as unknown as {__game:any}).__game;
const panel=document.createElement('section');panel.setAttribute('aria-label','Canyon review');
panel.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:999999;background:#231b17e8;color:#f5e8d4;padding:9px 14px;border:1px solid #b69c70;border-radius:8px;font:12px system-ui;display:flex;align-items:center;gap:12px;flex-wrap:wrap';
panel.innerHTML=`<b>BRYCE · REVIEW</b><label>Location <select aria-label="Canyon location"><option value="6">Spawn</option><option value="58">Boardwalk takeoff</option>${DESERT_CHECKPOINT_NAMES.map((name,i)=>`<option value="${DESERT_CHECKPOINTS[i]}">${name}</option>`).join('')}<option value="gem">Yellow gem approach</option></select></label><button>Go to location</button><button>Run traversal</button><button>Stop traversal</button><button>Test valley landing</button><button>Save frame</button><button>Free play</button><label>Resolution <select aria-label="Canyon resolution"><option value="720">Normal 720</option><option value="max">MAX native</option></select></label><label>View <select aria-label="Canyon view"><option value="game">Gameplay</option><option value="wide">Wide terrain</option><option value="overlook">Right valley</option></select></label><output style="flex-basis:100%;font:11px monospace"></output>`;
document.body.append(panel);
panel.querySelector('b')!.textContent='DUSTY ROAD · REVIEW';
const bonusOption=document.createElement('option');bonusOption.value=String(DESERT_BONUS_STATION);bonusOption.textContent='Cactus Cache entrance';panel.querySelector('select')!.append(bonusOption);
const location=panel.querySelector('[aria-label="Canyon location"]') as HTMLSelectElement;
const output=panel.querySelector('output')!,buttons=panel.querySelectorAll('button');
const gemArtButton=document.createElement('button');gemArtButton.textContent='Review yellow gem';panel.insertBefore(gemArtButton,output);
const heatControl=document.createElement('label');heatControl.innerHTML='<input type="checkbox" checked aria-label="Desert heat mirage"> Heat mirage';panel.insertBefore(heatControl,output);
heatControl.querySelector('input')!.onchange=e=>{g.desertHeat.enabled=(e.target as HTMLInputElement).checked;};
const heatPhase=document.createElement('select');heatPhase.setAttribute('aria-label','Heat animation');
heatPhase.innerHTML='<option value="live">Heat: animated</option><option value="0">Heat: phase 0</option><option value="0.35">Heat: phase 0.35</option>';
heatPhase.onchange=()=>{g.desertHeat.reviewTime=heatPhase.value==='live'?null:Number(heatPhase.value);};panel.insertBefore(heatPhase,output);
const heatBonus=document.createElement('button');heatBonus.textContent='Enter Cactus Cache';
heatBonus.onclick=()=>{running=false;g.launchReview.rate=1;g.enterBonusRound();};panel.insertBefore(heatBonus,output);
let heatPixels:unknown=null;
const measureHeat=document.createElement('button');measureHeat.textContent='Measure heat pixels';panel.insertBefore(measureHeat,output);
measureHeat.onclick=()=>{
  const enabled=g.desertHeat.enabled,time=g.desertHeat.reviewTime;
  const gl=g.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const capture=(active:boolean,phase:number)=>{
    g.desertHeat.enabled=active;g.desertHeat.reviewTime=phase;g.captureBonusReviewFrame();
    const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
  };
  const diff=(a:Uint8Array,b:Uint8Array)=>{
    let changed=0,max=0;const bounds=[w,h,0,0];
    for(let i=0;i<a.length;i+=4){
      const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));max=Math.max(max,d);
      if(d>2){changed++;const x=i/4%w,y=Math.floor(i/4/w);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
    }return {changed,max,bounds};
  };
  try{const baseline=capture(false,0),still=capture(false,0),a=capture(true,0),b=capture(true,.35);
    heatPixels={size:[w,h],control:diff(baseline,still),effect:diff(still,a),motion:diff(a,b)};
  }finally{g.desertHeat.enabled=enabled;g.desertHeat.reviewTime=time;}
};
let gemPreview:THREE.Group|undefined;
let running=false,progress=0,saveRequested=false,frames=0,settleUntil=0,previousJump=false,savedFrame='';
let gemSupport:{y:number;name:string}|undefined;
const timings:number[]=[];let lastFrame=0;
g.renderQualitySettings.setRegularResolution(720);
async function teleport(s:number){
  if(location.value==='gem'){
    const level=g.getLevel(),target=new THREE.Vector3(...DESERT_YELLOW_GEM),p=target.clone().add(new THREE.Vector3(-4,0,9));
    const heading=target.clone().sub(p).setY(0).normalize();
    // A remote review warp must let streaming finish before asking for its
    // exact native support. Frozen review frames do not run Level.update().
    g.launchReview.rate=0;settleUntil=0;p.y=target.y+60;
    g.player.respawn(level,true,false,{position:p,heading});
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    await level.prepareJungleAssets();
    level.root.updateMatrixWorld(true);level.prepareWorldSolids();
    const ray=new THREE.Raycaster(new THREE.Vector3(p.x,target.y+50,p.z),new THREE.Vector3(0,-1,0),0,100);
    const hit=level.raycastGround(ray)[0];
    if(!hit){output.textContent='Gem approach terrain is still loading; try Go to location again.';return;}
    gemSupport={y:hit.point.y,name:hit.object.name};p.y=hit.point.y+.4;
    g.player.respawn(level,true,false,{position:p,heading});g.player.endlessDeaths=true;
    progress=DESERT_LENGTH;g.launchReview.rate=1;settleUntil=performance.now()+600;return;
  }
  const p=new THREE.Vector3(...desertPoint(s));p.y+=.4;const heading=new THREE.Vector3(...desertPoint(s+2)).sub(p);heading.y=0;heading.normalize();
  g.player.respawn(g.getLevel(),true,false,{position:p,heading});g.player.endlessDeaths=true;
  progress=s;previousJump=false;g.launchReview.rate=1;settleUntil=performance.now()+500;
}
buttons[0].onclick=()=>{running=false;teleport(Number(location.value));};
buttons[1].onclick=()=>{teleport(Number(location.value));running=location.value!=='gem';};
buttons[2].onclick=()=>{running=false;g.launchReview.rate=0;g.input.moveX=g.input.moveY=0;};
buttons[3].onclick=()=>{running=false;g.launchReview.rate=1;settleUntil=performance.now()+7000;
  if(progress>DESERT_VISTA_START){const p=desertPoint(progress,120);g.player.pos.set(p[0],p[1]+2,p[2]);}
  else g.player.pos.y=g.getLevel().killY-80;
  g.player.state='air';g.player.grounded=false;g.player.vVel=-1;g.input.moveX=g.input.moveY=0;};
buttons[4].onclick=()=>{saveRequested=true;};
buttons[5].onclick=()=>{running=false;settleUntil=0;g.launchReview.rate=1;g.input.moveX=g.input.moveY=0;};
gemArtButton.onclick=()=>{
  const gem=g.getLevel().colouredGemPickups[0];if(!gem)return;
  // Art-only stand-in lets an already earned gem be reviewed without
  // resetting the user's discovery or creating another collectible.
  if(gem.collected&&!gemPreview){gemPreview=gem.group.clone(true);gemPreview.name='Collected gem art preview';g.getLevel().root.add(gemPreview);}
  location.value='gem';running=false;teleport(NaN);
};
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
  if(gemPreview){gemPreview.visible=location.value==='gem';gemPreview.rotation.y=performance.now()*.0006;}
  if(location.value==='gem'){
    const p=g.player.pos;
    const eye=gemPreview?new THREE.Vector3(DESERT_YELLOW_GEM[0]+3,DESERT_YELLOW_GEM[1]+5,DESERT_YELLOW_GEM[2]-7)
      :new THREE.Vector3(p.x+8,p.y+10,p.z+12);
    const ray=new THREE.Raycaster(new THREE.Vector3(eye.x,p.y+150,eye.z),new THREE.Vector3(0,-1,0),0,300);
    eye.y=Math.max(eye.y,(g.getLevel().raycastGround(ray)[0]?.point.y??-Infinity)+4);
    g.camera.position.copy(eye);g.camera.up.set(0,1,0);
    g.camera.lookAt(DESERT_YELLOW_GEM[0],DESERT_YELLOW_GEM[1]+1.6,DESERT_YELLOW_GEM[2]);g.camera.updateMatrixWorld();
  }
  if((panel.querySelector('[aria-label="Canyon view"]') as HTMLSelectElement).value==='overlook'){
    const s=running?progress:Number(location.value),eye=desertPoint(s,1),target=desertPoint(s+140,700);
    g.camera.position.set(eye[0],eye[1]+5,eye[2]);g.camera.up.set(0,1,0);g.camera.lookAt(target[0],desertGround(target[0],target[2])+60,target[2]);g.camera.updateMatrixWorld();
  }
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
  output.textContent=JSON.stringify({heat:g.desertHeat.diagnostics,heatPixels,loading:g.getLoadingDiagnostics(),state:p.state,grounded:p.grounded,colouredGems:l.colouredGemPickups.map((gem:any)=>({colour:gem.colour,collected:gem.collected,position:gem.group.position.toArray()})),gemSupport,groundSurface:p.groundHit?.name,position:p.pos.toArray().map((x:number)=>+x.toFixed(2)),route:+progress.toFixed(1),running,camera:{rig:l.cameraRig,chase:g.TUNING.chaseCam,authoredSkate:p.authoredSkateCamera,position:g.camera.position.toArray(),direction:g.camera.getWorldDirection(new THREE.Vector3()).toArray()},assets,render:g.getRenderFrameStats(),resolution:g.getRenderQualitySizes(),drawingBuffer:[g.renderer.domElement.width,g.renderer.domElement.height],performanceMs,savedFrame});
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
