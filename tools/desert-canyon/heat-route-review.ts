import * as THREE from 'three';
import {desertPoint,DESERT_LENGTH,DESERT_CHECKPOINTS,DESERT_CHECKPOINT_NAMES} from '../../src/levels/desert-canyon';
const g=(window as unknown as {__game:any}).__game;
const panel=document.createElement('section');panel.setAttribute('aria-label','Heat route review');
panel.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:999999;background:#231b17ed;color:#f5e8d4;padding:10px 14px;border:1px solid #b69c70;border-radius:8px;font:12px system-ui;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
panel.innerHTML='<b>DUSTY ROAD · HEAT COVERAGE</b><label>Route metres <input aria-label="Route metres" type="number" value="155" min="0" step="25" style="width:80px"></label><button>Review station</button><button>Measure view</button><button>Audit route</button><button>Stop audit</button><button>Drive route</button><button>Stop driving</button><label><input aria-label="Heat mirage" type="checkbox" checked>Heat mirage</label><label>Resolution <select aria-label="Review resolution"><option value="720">Normal 720</option><option value="max">MAX native</option></select></label><output style="flex-basis:100%;font:11px monospace"></output><details><summary>Coverage report</summary><pre style="max-height:220px;overflow:auto;white-space:pre-wrap"></pre></details>';
document.body.append(panel);
const station=panel.querySelector('input')!,buttons=panel.querySelectorAll('button'),output=panel.querySelector('output')!,report=panel.querySelector('pre')!;
let abort=false,auditing=false,driving=false,progress=0,measurement:unknown=null,rows:unknown[]=[],status='Ready';
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
async function teleport(s:number){
  driving=false;progress=s;g.input.moveX=g.input.moveY=0;
  const p=new THREE.Vector3(...desertPoint(s));p.y+=.35;
  const heading=new THREE.Vector3(...desertPoint(s+2)).sub(p).setY(0).normalize();
  g.player.respawn(g.getLevel(),true,false,{position:p,heading});g.player.endlessDeaths=true;g.launchReview.rate=1;
  await wait(900);g.launchReview.rate=0;
  await g.getLevel().prepareJungleAssets();await frame();await frame();
}
function measure(){
  const heat=g.desertHeat,enabled=heat.enabled,time=heat.reviewTime,gl=g.renderer.getContext();
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const capture=(active:boolean,phase:number)=>{
    heat.enabled=active;heat.reviewTime=phase;g.captureBonusReviewFrame();
    const bytes=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;
  };
  const diff=(a:Uint8Array,b:Uint8Array)=>{
    let changed=0,max=0,central=0;const bounds=[w,h,0,0];
    for(let i=0;i<a.length;i+=4){const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));max=Math.max(max,d);
      if(d>2){changed++;const x=i/4%w,y=Math.floor(i/4/w);if(x>w*.15&&x<w*.85&&y>h*.2&&y<h*.85)central++;
        bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}}
    return {changed,central,max,bounds};
  };
  try{
    const baseline=capture(false,0),still=capture(false,0),hot=capture(true,0),moving=capture(true,.35);
    return {station:progress,size:[w,h],heat:heat.diagnostics,control:diff(baseline,still),effect:diff(still,hot),motion:diff(hot,moving),
      camera:{matrix:g.camera.matrixWorld.toArray(),projection:g.camera.projectionMatrix.toArray()},player:g.player.pos.toArray(),grounded:g.player.grounded,webglError:gl.getError()};
  }finally{heat.enabled=enabled;heat.reviewTime=time;}
}
buttons[0].onclick=async()=>{await teleport(Number(station.value));status='Station ready';};
buttons[1].onclick=()=>{g.launchReview.rate=0;measurement=measure();report.textContent=JSON.stringify(measurement,null,2);};
buttons[2].onclick=async()=>{
  if(auditing)return;abort=false;auditing=true;rows=[];
  try{
    for(let i=0;i<DESERT_CHECKPOINTS.length&&!abort;i++){
      const s=DESERT_CHECKPOINTS[i];status=`Auditing ${i+1}/${DESERT_CHECKPOINTS.length}: ${DESERT_CHECKPOINT_NAMES[i]}`;
      station.value=String(s);await teleport(s);const result=measure();measurement=result;rows.push({name:DESERT_CHECKPOINT_NAMES[i],...result});
      report.textContent=JSON.stringify(rows,null,2);
    }status=abort?'Stopped':'Audit complete';
  }catch(error){status=String(error);throw error;}finally{auditing=false;}
};
buttons[3].onclick=()=>{abort=true;};
buttons[4].onclick=()=>{driving=true;g.launchReview.rate=1;};
buttons[5].onclick=()=>{driving=false;g.launchReview.rate=0;g.input.moveX=g.input.moveY=0;};
panel.querySelector<HTMLInputElement>('[aria-label="Heat mirage"]')!.onchange=e=>{g.desertHeat.enabled=(e.target as HTMLInputElement).checked;};
panel.querySelector<HTMLSelectElement>('select')!.onchange=e=>{g.renderQualitySettings.setRegularResolution((e.target as HTMLSelectElement).value==='max'?null:720);};
g.renderQualitySettings.setRegularResolution(720);
g.launchReview.beforeStep=()=>{
  if(!driving)return;const p=g.player;let best=Infinity,at=progress;
  for(let s=Math.max(0,progress-10);s<Math.min(DESERT_LENGTH,progress+30);s+=1){const q=desertPoint(s),d=(q[0]-p.pos.x)**2+(q[2]-p.pos.z)**2;if(d<best){best=d;at=s;}}
  progress=at;const target=desertPoint(at+12),dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,cf=p.raceInputBasis(g.getLevel()),distance=Math.hypot(dx,dz)||1;
  g.input.moveY=(dx*cf.x+dz*cf.z)/distance*.65;g.input.moveX=(-dx*cf.z+dz*cf.x)/distance*.65;g.input.grabHeld=p.speed>18;
};
function update(){
  const latest=measurement as ReturnType<typeof measure>|null;
  output.textContent=JSON.stringify({status,route:Math.round(progress),heat:g.desertHeat.diagnostics,
    measurement:latest?{station:latest.station,control:latest.control.changed,motion:latest.motion.central,webglError:latest.webglError}:null,
    // Full rendering animates the HUD glow even while simulation is frozen.
    // Require central heat motion well above that unchanged-scene control.
    completed:rows.length,withVisibleMotion:rows.filter((r:any)=>r.motion.central>200*r.size[0]*r.size[1]/(1280*720)&&r.motion.central>r.control.central*5&&r.webglError===0).length,
    loaded:!g.gameFlow.blocksGameplay,grounded:g.player.grounded,render:g.getRenderFrameStats()});requestAnimationFrame(update);
}requestAnimationFrame(update);
