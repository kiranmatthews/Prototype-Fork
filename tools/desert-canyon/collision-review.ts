import * as THREE from 'three';
import {DESERT_CANYON_LEVEL,desertPoint,desertGround} from '../../src/levels/desert-canyon';
import {inDesertValleyDrop} from '../../src/desertContacts';
const g=(window as unknown as {__game:any}).__game;
const panel=document.createElement('section');panel.setAttribute('aria-label','Collision review');
panel.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:999999;background:#231b17ed;color:#fff4dc;padding:12px;font:12px system-ui;border-radius:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center';
panel.innerHTML='<b>DUSTY ROAD CONTACT REVIEW</b><label>Route metres <input aria-label="Route metres" type="number" value="1087" style="width:80px"></label><button>Go to road</button><label>Cactus <select aria-label="Cactus species"><option value="canyonbarrel">Barrel</option><option value="canyonpricklypear">Prickly pear</option><option value="canyonsaguaro">Saguaro</option></select></label><button>Walk into cactus</button><button>Walk into tower</button><button>Walk into fence</button><button>Walk down right valley</button><button>Stop</button><label>Resolution <select aria-label="Resolution"><option value="720">Normal</option><option value="max">MAX native</option></select></label><button>Hide review</button><output style="flex-basis:100%;font:11px monospace"></output>';
document.body.append(panel);
const buttons=panel.querySelectorAll('button'),output=panel.querySelector('output')!,station=panel.querySelector('input')!;
let running=false,frames=0,status='Ready',trial='',target=new THREE.Vector3(),result:unknown=null;
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
async function place(p:THREE.Vector3,t:THREE.Vector3){
  running=false;g.input.moveX=g.input.moveY=0;g.input.grabHeld=false;g.launchReview.rate=1;
  const heading=t.clone().sub(p).setY(0).normalize();
  g.player.respawn(g.getLevel(),true,false,{position:p,heading});g.player.endlessDeaths=true;
  await frame();await frame();await g.getLevel().prepareJungleAssets();g.getLevel().prepareWorldSolids();
  const ray=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,12,0)),new THREE.Vector3(0,-1,0),0,30);
  const hit=g.getLevel().raycastGround(ray)[0];if(hit)p.y=hit.point.y+.1;
  g.player.respawn(g.getLevel(),true,false,{position:p,heading});
  await new Promise(resolve=>setTimeout(resolve,500));g.launchReview.rate=0;
}
buttons[0].onclick=async()=>{const s=Number(station.value),p=new THREE.Vector3(...desertPoint(s));p.y+=.4;await place(p,new THREE.Vector3(...desertPoint(s+10)));status='Road ready';};
async function walk(kind:string){
  status='Preparing '+kind;result=null;trial=kind;
  const s=Number(station.value),road=new THREE.Vector3(...desertPoint(s));
  const components=DESERT_CANYON_LEVEL.components.filter(c=>kind==='tower'?c.dkind?.startsWith('deserthoodoo'):kind==='fence'?c.nm==='Race fence contact':c.dkind===kind);
  const c=components.sort((a,b)=>new THREE.Vector3(...a.p).distanceToSquared(road)-new THREE.Vector3(...b.p).distanceToSquared(road))[0];
  let p:THREE.Vector3;
  if(kind==='fence'){
    const end=new THREE.Vector3(...c.vertices!.slice(3,6) as [number,number,number]);
    const centre=new THREE.Vector3(...c.p).addScaledVector(end,.5),toward=road.clone().sub(centre).setY(0).normalize();
    p=centre.clone().addScaledVector(toward,2.5);target=centre.clone().addScaledVector(toward,-2.5);
  }else{
    target.set(...c.p);const toward=road.clone().sub(target).setY(0).normalize();
    p=target.clone().addScaledVector(toward,Math.hypot(c.s![0],c.s![2])*.5+2.5);
  }
  p.y=desertGround(p.x,p.z)+.4;await place(p,target);frames=0;running=true;g.launchReview.rate=1;status='Walking '+kind;
}
buttons[1].onclick=()=>walk(panel.querySelector<HTMLSelectElement>('[aria-label="Cactus species"]')!.value);
const drop=document.createElement('button');drop.textContent='Drop onto cactus';panel.insertBefore(drop,output);
drop.onclick=async()=>{
  running=false;const kind=panel.querySelector<HTMLSelectElement>('[aria-label="Cactus species"]')!.value;
  const road=new THREE.Vector3(...desertPoint(Number(station.value)));
  const c=DESERT_CANYON_LEVEL.components.filter(c=>c.dkind===kind).sort((a,b)=>new THREE.Vector3(...a.p).distanceToSquared(road)-new THREE.Vector3(...b.p).distanceToSquared(road))[0];
  trial='drop '+kind;status='Preparing cactus drop';result=null;target.set(...c.p);
  const position=target.clone();position.y+=c.s![1]+1;
  g.player.respawn(g.getLevel(),true,false,{position,heading:new THREE.Vector3(0,0,-1)});g.launchReview.rate=0;
  await frame();await g.getLevel().prepareJungleAssets();g.getLevel().prepareWorldSolids();
  g.player.respawn(g.getLevel(),true,false,{position,heading:new THREE.Vector3(0,0,-1)});
  g.player.grounded=false;g.player.state='air';g.player.vVel=-1;frames=0;running=true;g.launchReview.rate=1;status='Falling onto cactus';
};
buttons[2].onclick=()=>walk('tower');buttons[3].onclick=()=>walk('fence');
buttons[4].onclick=async()=>{
  const s=5000;station.value=String(s);trial='right valley';result=null;status='Preparing valley walk';
  const p=new THREE.Vector3(...desertPoint(s,12));p.y=desertGround(p.x,p.z)+.4;
  target.set(...desertPoint(s,120));await place(p,target);frames=0;running=true;g.launchReview.rate=1;status='Walking down valley';
};
function stop(){running=false;g.launchReview.rate=0;g.input.moveX=g.input.moveY=0;g.input.grabHeld=false;}
buttons[5].onclick=stop;buttons[6].onclick=()=>{panel.hidden=true;panel.style.display='none';};
panel.querySelector<HTMLSelectElement>('[aria-label="Resolution"]')!.onchange=e=>g.renderQualitySettings.setRegularResolution((e.target as HTMLSelectElement).value==='max'?null:720);
g.renderQualitySettings.setRegularResolution(720);
g.launchReview.beforeStep=()=>{
  if(!running)return;frames++;
  const p=g.player,dx=target.x-p.pos.x,dz=target.z-p.pos.z,d=Math.hypot(dx,dz)||1,cf=p.raceInputBasis(g.getLevel());
  g.input.moveX=(-dx*cf.z+dz*cf.x)/d*.85;g.input.moveY=(dx*cf.x+dz*cf.z)/d*.85;
  if(p.state==='dead'||frames>=360){
    result={trial,frames,state:p.state,pos:p.pos.toArray(),distance:d,lastContact:g.getLevel().desertContacts?.lastSurface?.mesh.userData.jungleAsset??null,valleyDrop:inDesertValleyDrop(p.pos)};
    status=p.state==='dead'?'Contact death':'Walk stopped';stop();
  }
};
function report(){output.textContent=JSON.stringify({status,trial,frames,state:g.player.state,position:g.player.pos.toArray(),grounded:g.player.grounded,heat:g.desertHeat.diagnostics,loaded:!g.gameFlow.blocksGameplay,result,solids:g.getLevel().worldSolidDiagnostics});requestAnimationFrame(report);}requestAnimationFrame(report);
