import { SCHOOL_MIAMI_LEVEL, SCHOOL_POOLS, SCHOOL_DITCH_KICKER } from '../src/levels/school-miami';
import { OrthographicCamera } from 'three';
import { runSchoolBrowserChecks } from './school-browser-checks';
const frame=document.querySelector<HTMLIFrameElement>('#game')!,status=document.querySelector<HTMLDivElement>('#status')!;
let overview=false,game:any,reviewCamera:any,full=false,checks:any=null;
const errors:string[]=[];
function bind(){
  const w=frame.contentWindow as any;if(!w?.__game){setTimeout(bind,250);return;}
  if(game===w.__game)return;
  game=w.__game;const render=game.renderer.render.bind(game.renderer);reviewCamera=new OrthographicCamera(-100,100,90,-90,.1,700);
  // Match the supplied oblique map: world X runs gently down to the right,
  // world Z down-left; the same camera captures the whole connected campus.
  reviewCamera.position.set(70,205,225);reviewCamera.lookAt(0,-2,-20);reviewCamera.updateProjectionMatrix();
  game.renderer.render=(scene:any,camera:any)=>{
    if(!overview||scene!==game.scene)return render(scene,camera);
    const fog=scene.fog;scene.fog=null;reviewCamera.left=-90*camera.aspect;reviewCamera.right=90*camera.aspect;reviewCamera.updateProjectionMatrix();
    try{return render(scene,reviewCamera);}finally{scene.fog=fog;}
  };
  w.addEventListener('error',(e:any)=>errors.push(e.message));
  const original=w.console.error.bind(w.console);w.console.error=(...args:any[])=>{errors.push(args.map(String).join(' '));original(...args);};
}
frame.addEventListener('load',bind);bind();
function place(p:number[],h:number[]){if(!game)return;overview=false;const player=game.player,level=game.getLevel();
  const position=player.pos.clone().set(...p),heading=player.axisF.clone().set(...h).normalize();
  player.respawn(level,true,true,{position,heading});player.speed=0;player.axisF.copy(heading);player.axisL.set(heading.z,0,-heading.x);player.freeSkate=true;frame.contentWindow?.focus();}
document.querySelector('#overview')!.addEventListener('click',()=>{overview=true;});
document.querySelector('#play')!.addEventListener('click',()=>{overview=false;frame.contentWindow?.focus();});
document.querySelector('#start')!.addEventListener('click',()=>place(SCHOOL_MIAMI_LEVEL.spawn,[1,0,0]));
document.querySelector('#yard')!.addEventListener('click',()=>place([25,-4.9,-46],[-1,0,-.5]));
document.querySelector('#pools')!.addEventListener('click',()=>{const p=SCHOOL_POOLS[0];place([p.centre[0],p.bottom+.1,p.centre[2]],[1,0,0]);});
document.querySelector('#gym')!.addEventListener('click',()=>place([48.5,.1,23],[0,0,1]));
document.querySelector('#roof')!.addEventListener('click',()=>place([63,7.1,38],[-1,0,-.3]));
document.querySelector('#bonus')!.addEventListener('click',()=>place([63,7.1,23],[0,0,-1]));
document.querySelector('#hill')!.addEventListener('click',()=>place([80,.1,53],[0,0,-1]));
document.querySelector('#ditch')!.addEventListener('click',()=>{const k=SCHOOL_DITCH_KICKER,h=k.direction;place([k.p[0]-h[0]*3.8,-6.4,k.p[2]-h[2]*3.8],h);});
document.querySelector('#rail')!.addEventListener('click',()=>place([44,.1,-5],[-.15,0,-1]));
document.querySelector('#full')!.addEventListener('click',()=>{full=!full;game=null;checks=null;errors.length=0;frame.src='/?playtest&level=school-miami'+(full?'':'&lite');document.querySelector('#full')!.textContent=full?'Lite render':'Full render';});
document.querySelector('#checks')!.addEventListener('click',()=>{if(!game||checks?.running)return;overview=false;checks=runSchoolBrowserChecks(game);});
setInterval(()=>{if(!game)return;const p=game.player,l=game.getLevel();status.textContent=JSON.stringify({level:game.getCurrentLevel().id,grounded:p.grounded,state:p.state,pos:p.pos.toArray().map((n:number)=>+n.toFixed(2)),speed:+p.speed.toFixed(2),components:SCHOOL_MIAMI_LEVEL.components.length,rails:l.rails.length,errors,checks:checks?{...checks,tuningBefore:undefined}:undefined},null,0);},300);
