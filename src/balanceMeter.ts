import {trackPresentationImage} from './presentationLoading';
import {BALANCE_METER_ASSETS} from './balanceMeterAssets';

export interface BalanceMeterRect {x:number;y:number;width:number;height:number}
export interface BalanceMeterState {mode:'grind'|'manual';value:number;critical?:boolean;nowMs?:number;reducedMotion?:boolean}
const images:HTMLImageElement[]=[],glove=new Map<string,HTMLImageElement>();
let loading:Promise<void>|undefined;
const motion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
const order=[0,1,2,1,3,0,2,3],holds=[140,95,180,110,155,90,170,120],angles=[-1.4,.8,-.6,1.7,-1.1,.4,1.1,-.7];
const cycle=holds.reduce((a,b)=>a+b,0);

export function loadBalanceMeterAssets():Promise<void>{
 if(typeof Image==='undefined')return Promise.resolve();
 return loading??=Promise.all([...BALANCE_METER_ASSETS.frames.map((f,i)=>({file:f.file,set:(image:HTMLImageElement)=>images[i]=image})),
  {file:BALANCE_METER_ASSETS.glove.file,set:(image:HTMLImageElement)=>glove.set('pointer',image)}].map(({file,set})=>new Promise<void>(resolve=>{
   const image=new Image(),url=import.meta.env.BASE_URL+file;trackPresentationImage(image,url);
   image.onload=()=>{set(image);resolve();};image.onerror=()=>resolve();image.src=url;
  }))).then(()=>undefined);
}
export function balanceMeterFrame(now:number,reduced=false){
 if(reduced)return{frame:0,angle:0,beat:0};
 let t=((now%cycle)+cycle)%cycle,i=0;while(i<holds.length-1&&t>=holds[i]){t-=holds[i];i++;}
 return{frame:order[i],angle:angles[i]*Math.PI/180,beat:i};
}
export function balanceMeterPoint(value:number,frame=0){
 const points=BALANCE_METER_ASSETS.frames[frame].points;
 const t=.045+(.5+.5*Math.max(-1,Math.min(1,Number.isFinite(value)?value:0)))*.91,u=t*(points.length-1),i=Math.floor(u),f=u-i,a=points[i],b=points[Math.min(points.length-1,i+1)];
 return{x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f};
}

/** Both DOM/lite and pre-CRT Canvas draw the same generated frames and marker. */
export function drawBalanceMeter(ctx:CanvasRenderingContext2D,rect:BalanceMeterRect,state:BalanceMeterState):boolean {
 void loadBalanceMeterAssets();if(![0,1,2,3].every(i=>images[i])||!glove.has('pointer'))return false;
 const reduced=state.reducedMotion??motion?.matches??false,pose=balanceMeterFrame(state.nowMs??performance.now(),reduced);
 const horizontal=state.mode==='grind',point=balanceMeterPoint(horizontal?-state.value:state.value,pose.frame),scale=Math.min(rect.width/(horizontal?1390:700),rect.height/(horizontal?700:1390));
 const sprite=images[pose.frame],pointer=glove.get('pointer')!,tip=BALANCE_METER_ASSETS.glove.tip;
 ctx.save();ctx.translate(rect.x+rect.width/2,rect.y+rect.height/2);if(horizontal)ctx.rotate(Math.PI/2);ctx.rotate(pose.angle);ctx.scale(scale,scale);ctx.translate(-350,-695);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(sprite,300,119,360,1152);
 const x=300+point.x*360,y=119+point.y*1152,pw=250,ph=pw*pointer.height/pointer.width;
 if(state.critical){ctx.shadowColor='#ff471e';ctx.shadowBlur=6;}
 ctx.drawImage(pointer,x-pw*tip[0],y-ph*tip[1],pw,ph);ctx.restore();return true;
}

export function paintBalanceElement(host:HTMLElement,state:BalanceMeterState):void {
 let canvas=host.querySelector<HTMLCanvasElement>('canvas');
 if(!canvas){canvas=document.createElement('canvas');canvas.className='hud-balance-art';canvas.setAttribute('aria-hidden','true');host.append(canvas);}
 const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
 const ratio=Math.min(3,Math.max(1,devicePixelRatio));if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
 const ctx=canvas.getContext('2d')!;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
 drawBalanceMeter(ctx,{x:0,y:0,width,height},state);host.dataset.artFrame=String(balanceMeterFrame(state.nowMs??performance.now(),state.reducedMotion??motion?.matches??false).frame);
}
