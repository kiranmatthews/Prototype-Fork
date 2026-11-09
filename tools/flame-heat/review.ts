import * as THREE from 'three';
const g=(window as unknown as {__game:any}).__game;
const panel=document.createElement('section');panel.setAttribute('aria-label','Flame review');
panel.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:999999;background:#211811e8;color:#f5e8d4;padding:9px 14px;border:1px solid #ba9464;border-radius:8px;font:12px system-ui;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
panel.innerHTML=`<b>FLAME HEAT · REVIEW</b><label><input type="checkbox" checked aria-label="Flame heat">Heat distortion</label><button>Frame nearest torch</button><button>Frame tiki breath</button><button>Freeze</button><button>Play</button><button>Gameplay camera</button><button>Measure heat pixels</button><button>Benchmark heat</button><label>Resolution <select aria-label="Flame resolution"><option value="720">Normal 720</option><option value="max">MAX native</option></select></label><label>Phase <select aria-label="Flame animation"><option value="live">Animated</option><option value="0">0</option><option value="0.35">0.35</option></select></label><output style="flex-basis:100%;font:11px monospace"></output>`;
document.body.append(panel);
const buttons=panel.querySelectorAll('button'),output=panel.querySelector('output')!;
let focus:THREE.Vector3|null=null,eye:THREE.Vector3|null=null,measure:unknown=null,benchmark:unknown=null,tikiReview=false;
const kartButtons=document.createElement('span');kartButtons.innerHTML='<button>Review kart jets</button> <button>Review kart wreck</button>';panel.insertBefore(kartButtons,output);
let kartFocus=false,kartFreeze=0;
kartButtons.querySelectorAll('button').forEach((button,index)=>button.onclick=()=>{
  const race=g.getSkateRace();if(!race.carts)return;
  race.canStartTimeTrial=()=>true;race.start('time-trial',0);race.phase='running';
  const carts=race.carts;carts.drive=()=>({moveX:0,moveY:0});
  if(index===0)carts.thrustTime[0]=4;
  else{carts.fleet.physics.carts[0].health=0;carts.wreck(0);}
  kartFreeze=index===0?.45:1.6;
  tikiReview=false;kartFocus=true;g.launchReview.rate=1;
});
const position=new THREE.Vector3();
panel.querySelector('input')!.onchange=e=>{g.flameHeat.enabled=(e.target as HTMLInputElement).checked;};
(panel.querySelector('[aria-label="Flame resolution"]') as HTMLSelectElement).onchange=e=>g.renderQualitySettings.setRegularResolution((e.target as HTMLSelectElement).value==='max'?null:720);
(panel.querySelector('[aria-label="Flame animation"]') as HTMLSelectElement).onchange=e=>{const v=(e.target as HTMLSelectElement).value;g.flameHeat.reviewTime=v==='live'?null:Number(v);};
buttons[0].onclick=()=>{
  tikiReview=false;kartFocus=false;
  const l=g.getLevel(),torch=l.torches.slice().sort((a:any,b:any)=>a.group.position.distanceToSquared(g.player.pos)-b.group.position.distanceToSquared(g.player.pos))[0];
  if(!torch)return;focus=torch.group.getWorldPosition(new THREE.Vector3());focus.y+=torch.group.userData.torchSpec.h+1;
  eye=focus.clone().add(new THREE.Vector3(-5,2,8));g.launchReview.rate=0;
};
buttons[1].onclick=()=>{
  const tiki=g.getLevel().fireTikis[0];if(!tiki)return;
  const c=tiki.spec.cycle??7.8,p=tiki.spec.phase??0;tiki.group.getWorldPosition(position);
  tiki.update(c*.808-p,position);focus=tiki.group.localToWorld(new THREE.Vector3(0,1.2,4));
  eye=tiki.group.localToWorld(new THREE.Vector3(-9,5,10));g.launchReview.rate=0;
  tikiReview=true;
  kartFocus=false;
};
buttons[2].onclick=()=>{g.launchReview.rate=0;};buttons[3].onclick=()=>{g.launchReview.rate=1;};
buttons[4].onclick=()=>{focus=eye=null;tikiReview=kartFocus=false;g.launchReview.rate=1;};
g.launchReview.afterCamera=()=>{
  if(kartFocus){const race=g.getSkateRace(),carts=race.carts;focus=carts.fleet.models[0].root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,1.3,0));eye=focus.clone().add(new THREE.Vector3(8,3.7,10));
    if(kartFreeze&&race.elapsed>=kartFreeze){g.launchReview.rate=0;kartFreeze=0;}}
  if(tikiReview){const tiki=g.getLevel().fireTikis[0];tiki.update((tiki.spec.cycle??7.8)*.808-(tiki.spec.phase??0),tiki.group.position);}
  if(focus&&eye){g.camera.position.copy(eye);g.camera.up.set(0,1,0);g.camera.lookAt(focus);g.camera.updateMatrixWorld();}
};
buttons[5].onclick=()=>{
  const heat=g.flameHeat,enabled=heat.enabled,phase=heat.reviewTime;g.launchReview.rate=0;
  const gl=g.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const capture=(active:boolean,t:number)=>{
    heat.enabled=active;heat.reviewTime=t;g.captureBonusReviewFrame();
    const data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;
  };
  const diff=(a:Uint8Array,b:Uint8Array)=>{let changed=0,max=0;const bounds=[w,h,0,0];
    for(let i=0;i<a.length;i+=4){const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));max=Math.max(max,d);
      if(d>2){changed++;const x=i/4%w,y=Math.floor(i/4/w);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}}
    return {changed,max,bounds};};
  try{const baseline=capture(false,0),still=capture(false,0),hot=capture(true,0),moving=capture(true,.35);
    measure={size:[w,h],control:diff(baseline,still),effect:diff(still,hot),motion:diff(hot,moving),webglError:gl.getError()};
  }finally{heat.enabled=enabled;heat.reviewTime=phase;}
};
buttons[6].onclick=async()=>{
  g.launchReview.rate=0;const heat=g.flameHeat,enabled=heat.enabled,phase=heat.reviewTime,gl=g.renderer.getContext();
  heat.reviewTime=0;const samples:{enabled:boolean;ms:number;calls:number;triangles:number}[]=[];
  try{
    for(const active of [false,true])for(let i=0;i<16;i++){
      heat.enabled=active;await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      g.renderer.info.reset();const start=performance.now();g.captureBonusReviewFrame();gl.finish();
      if(i>=4)samples.push({enabled:heat.enabled,ms:performance.now()-start,...g.getRenderFrameStats()});
    }
    const stats=(active:boolean)=>{const rows=samples.filter(r=>r.enabled===active),ms=rows.map(r=>r.ms).sort((a,b)=>a-b);return {median:ms[Math.floor(ms.length*.5)],calls:rows[0].calls,triangles:rows[0].triangles};};
    benchmark={off:stats(false),on:stats(true),note:'Synchronous scene capture incl PNG encode + GPU finish; 4 warmup + 12 samples each'};
  }finally{heat.enabled=enabled;heat.reviewTime=phase;}
};
g.renderQualitySettings.setRegularResolution(720);
function report(){
  output.textContent=JSON.stringify({level:g.getCurrentLevel().id,heat:g.flameHeat.diagnostics,measure,benchmark,
    loading:g.getLoadingDiagnostics().phase,player:g.player.state,torches:g.getLevel().torches.length,tikis:g.getLevel().fireTikis.length,
    resolution:g.getRenderQualitySizes(),render:g.getRenderFrameStats()});requestAnimationFrame(report);
}requestAnimationFrame(report);
