import { SCHOOL_MIAMI_LEVEL, SCHOOL_POOLS, SCHOOL_DITCH_KICKER, SCHOOL_LONG_HALFPIPE, SCHOOL_HALL_PASS, SCHOOL_PLANTERS, SCHOOL_REAR_BANK, SCHOOL_SKYLIGHT } from '../src/levels/school-miami';
import { OrthographicCamera } from 'three';
import { runSchoolBrowserChecks } from './school-browser-checks';
const frame=document.createElement('iframe'),status=document.querySelector<HTMLDivElement>('#status')!;
let overview=false,game:any,reviewCamera:any,full=new URLSearchParams(location.search).has('full'),checks:any=null;
const errors:string[]=[];
// Assign the URL before attaching the frame, so the review does not expose
// an initial blank document before its actual game document starts.
frame.id='game';frame.title='School Miami game';
frame.src='/?playtest&level=school-miami'+(full?'':'&lite');
document.querySelector('#game-host')!.replaceWith(frame);
document.querySelector('#full')!.textContent=full?'Lite render':'Full render';
function bind(){
  const w=frame.contentWindow as any;if(!w?.__game){setTimeout(bind,250);return;}
  if(game===w.__game)return;
  game=w.__game;const render=game.renderer.render.bind(game.renderer);reviewCamera=new OrthographicCamera(-100,100,65,-65,.1,700);
  // Match the supplied oblique map: world X runs gently down to the right,
  // world Z down-left; the same camera captures the whole connected campus.
  reviewCamera.position.set(70,205,225);reviewCamera.lookAt(0,-2,-20);reviewCamera.updateProjectionMatrix();
  game.renderer.render=(scene:any,camera:any)=>{
    if(!overview||scene!==game.scene)return render(scene,camera);
    const fog=scene.fog;scene.fog=null;reviewCamera.left=-65*camera.aspect;reviewCamera.right=65*camera.aspect;reviewCamera.updateProjectionMatrix();
    try{return render(scene,reviewCamera);}finally{scene.fog=fog;}
  };
  w.addEventListener('error',(e:any)=>errors.push(e.message));
  const original=w.console.error.bind(w.console);w.console.error=(...args:any[])=>{errors.push(args.map(String).join(' '));original(...args);};
}
frame.addEventListener('load',bind);bind();
function place(p:number[],h:number[],speed=0){if(!game)return;overview=false;const player=game.player,level=game.getLevel();
  const position=player.pos.clone().set(...p),heading=player.axisF.clone().set(...h).normalize();
  player.respawn(level,true,true,{position,heading});player.speed=speed;player.axisF.copy(heading);player.axisL.set(heading.z,0,-heading.x);player.freeSkate=true;frame.contentWindow?.focus();}
document.querySelector('#overview')!.addEventListener('click',()=>{overview=true;});
document.querySelector('#play')!.addEventListener('click',()=>{overview=false;frame.contentWindow?.focus();});
document.querySelector('#start')!.addEventListener('click',()=>place(SCHOOL_MIAMI_LEVEL.spawn,[1,0,0]));
document.querySelector('#yard')!.addEventListener('click',()=>place([25,-4.9,-46],[-1,0,-.5]));
document.querySelector('#halfpipe')!.addEventListener('click',()=>{const a=SCHOOL_LONG_HALFPIPE[2],b=SCHOOL_LONG_HALFPIPE[3];place([a[0],a[1]+.1,a[2]],[b[0]-a[0],0,b[2]-a[2]]);});
document.querySelector('#street')!.addEventListener('click',()=>place([-9.7937,-4.9,-74.0889],[-.92,0,.392]));
document.querySelector('#hall')!.addEventListener('click',()=>{const a=SCHOOL_HALL_PASS.takeoff[0],b=SCHOOL_HALL_PASS.takeoff[1],n=Math.hypot(b[0]-a[0],b[2]-a[2]),h=[(b[0]-a[0])/n,0,(b[2]-a[2])/n];place([a[0]-h[0]*4,.1,a[2]-h[2]*4],h);});
document.querySelector('#planters')!.addEventListener('click',()=>{const q=SCHOOL_PLANTERS[0];place([q.p[0]-q.width/2-3,.1,q.p[2]+q.depth/2],[1,0,0]);});
document.querySelector('#pools')!.addEventListener('click',()=>{const p=SCHOOL_POOLS[0];place([p.centre[0],p.bottom+.1,p.centre[2]],[1,0,0]);});
document.querySelector('#annex')!.addEventListener('click',()=>place([12,.1,9],[0,0,1]));
document.querySelector('#gym')!.addEventListener('click',()=>place([48.5,.1,23],[0,0,1]));
document.querySelector('#gym-bank')!.addEventListener('click',()=>place([45,.1,32],[-1,0,0]));
document.querySelector('#gym-door')!.addEventListener('click',()=>place([48.5,.1,9],[0,0,1],12));
document.querySelector('#hoop')!.addEventListener('click',()=>place([48.5,.1,36],[0,0,1]));
document.querySelector('#skylight')!.addEventListener('click',()=>place([SCHOOL_SKYLIGHT.hole.minX-1.3,SCHOOL_SKYLIGHT.lipY+.1,SCHOOL_SKYLIGHT.z],[1,0,0],6));
document.querySelector('#gym-rail')!.addEventListener('click',()=>place([37,.1,19],[-1,0,0],14));
document.querySelector('#rear-bank')!.addEventListener('click',()=>{const a=SCHOOL_REAR_BANK.toe[0];place([a[0]-2,-4.9,a[2]+6],[.3,0,-1]);});
document.querySelector('#roof')!.addEventListener('click',()=>place([64,7.1,45.4],[0,0,-1]));
document.querySelector('#roof-edge')!.addEventListener('click',()=>place([48,7.1,46.8],[1,0,0]));
document.querySelector('#roof-rails')!.addEventListener('click',()=>place([35,7.1,47],[.6,0,-.8]));
document.querySelector('#bonus')!.addEventListener('click',()=>place([61.3,7.1,23],[0,0,-1]));
document.querySelector('#hill')!.addEventListener('click',()=>place([80,.1,53],[0,0,-1]));
document.querySelector('#ditch')!.addEventListener('click',()=>{const k=SCHOOL_DITCH_KICKER,h=k.direction;place([k.p[0]-h[0]*3.8,-6.4,k.p[2]-h[2]*3.8],h);});
document.querySelector('#alley')!.addEventListener('click',()=>place([18.2,.1,52.2],[1,0,0]));
document.querySelector('#rail')!.addEventListener('click',()=>place([44,.1,-5],[-.15,0,-1]));
document.querySelector('#stairs')!.addEventListener('click',()=>place([49,0,-15],[-.6,0,-.8]));
document.querySelector('#under-awning')!.addEventListener('click',()=>place([42,-1,-15],[.15,0,1],12));
document.querySelector('#full')!.addEventListener('click',()=>{full=!full;game=null;checks=null;errors.length=0;frame.src='/?playtest&level=school-miami'+(full?'':'&lite');document.querySelector('#full')!.textContent=full?'Lite render':'Full render';});
document.querySelector('#checks')!.addEventListener('click',()=>{if(!game||checks?.running)return;overview=false;checks=runSchoolBrowserChecks(game);});
setInterval(()=>{if(!game)return;const p=game.player,l=game.getLevel(),bounds=p.cameraPoseBounds;status.textContent=JSON.stringify({level:game.getCurrentLevel().id,grounded:p.grounded,state:p.state,pos:p.pos.toArray().map((n:number)=>+n.toFixed(2)),speed:+p.speed.toFixed(2),components:SCHOOL_MIAMI_LEVEL.components.length,rails:l.rails.length,camera:{eye:game.camera.position.toArray(),trailing:Math.hypot(game.camera.position.x-p.pos.x,game.camera.position.z-p.pos.z),bodyBounds:bounds?{min:bounds.min.toArray(),max:bounds.max.toArray()}:null},errors,checks:checks?{...checks,tuningBefore:undefined}:undefined},null,0);},300);
