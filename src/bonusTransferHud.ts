import {RooAtlasPainter,layoutRooAtlas} from './roo-type/atlas';
import {ROO_ATLAS_METRICS} from './roo-type/atlas-metrics';
import {trackPresentationImage} from './presentationLoading';
import {bonusTransferFlights,type BonusTransferFrame} from './bonusTransfer';

type Rect={x:number;y:number;width:number;height:number};
export interface BonusIconDraw {slot:0|1;rect:Rect;alpha:number}
/** One painter for direct/lite and pre-CRT. Fruit/crates reuse the live 3D HUD models. */
export class BonusTransferHud {
  readonly canvas=document.createElement('canvas');
  readonly semantic=document.createElement('div');
  private context=this.canvas.getContext('2d')!;
  private painter=new RooAtlasPainter();
  private face=new Image();
  private frame:BonusTransferFrame|null=null;
  private sources:Record<'fruit'|'boxes'|'lives',Rect>={fruit:{x:0,y:0,width:0,height:0},boxes:{x:0,y:0,width:0,height:0},lives:{x:0,y:0,width:0,height:0}};
  private targets:typeof this.sources={...this.sources};
  private labels:{text:string;x:number;y:number;cap:number;maxWidth:number}[]=[];
  private faces:{rect:Rect;alpha:number}[]=[];
  readonly icons:BonusIconDraw[]=[];

  constructor(host:HTMLElement){
    this.canvas.className='bonus-transfer-canvas';
    this.canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:12;display:none';
    this.canvas.setAttribute('aria-hidden','true');
    this.semantic.className='bonus-transfer-status';this.semantic.setAttribute('role','status');
    this.semantic.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
    host.append(this.canvas,this.semantic);
    this.face.decoding='async';const url=`${import.meta.env.BASE_URL}roo.png`;
    trackPresentationImage(this.face,url);this.face.src=url;
  }
  get active(){return this.frame!==null;}
  update(frame:BonusTransferFrame|null,sources?:Record<'fruit'|'boxes'|'lives',DOMRect>){
    this.frame=frame;this.canvas.style.display=frame?'block':'none';
    if(!frame){this.icons.length=0;this.semantic.textContent='';return;}
    if(sources)for(const kind of ['fruit','boxes','lives'] as const){const r=sources[kind];this.sources[kind]={x:r.x,y:r.y,width:r.width,height:r.height};}
    const w=window.innerWidth,h=window.innerHeight;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){
      this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
    }
    this.layout(w,h);
    if(!this.canvas.closest('[data-precrt-composited]')){
      this.context.setTransform(dpr,0,0,dpr,0,0);this.context.clearRect(0,0,w,h);
      this.paint(this.context,w,h);
    }
    // Announce the final receipt once, rather than every counting tick.
    if(frame.complete)this.semantic.textContent=`Bonus banked: ${frame.receipt.bonus.fruit} fruit, ${frame.receipt.bonus.boxes} boxes, ${frame.receipt.bonus.lives} lives.`;
  }
  private layout(w:number,h:number){
    const f=this.frame!;this.icons.length=0;this.faces=[];this.labels=[];
    const cap=Math.min(h*.092,w*.075),icon=Math.min(h*.105,w*.1),gap=Math.min(10,w*.012),top=h*.08;
    const texts={fruit:String(f.parent.fruit),boxes:`${f.parent.boxes}/${f.receipt.parent.totalBoxes}`,lives:String(f.parent.lives)};
    for(const kind of ['fruit','boxes','lives'] as const){
      const maxWidth=w*.27-icon-gap;
      const measured=(layoutRooAtlas(ROO_ATLAS_METRICS.counter,texts[kind],0)?.width??2)*cap;
      const pair=icon+gap+Math.min(maxWidth,measured);
      const x=kind==='fruit'?w*.06:kind==='boxes'?(w-pair)/2:w*.94-pair;
      const rect={x,y:top,width:icon,height:icon};this.targets[kind]=rect;
      this.labels.push({text:texts[kind],x:x+icon+gap,y:top+icon*.48,cap,maxWidth});
      if(kind==='lives')this.faces.push({rect,alpha:f.alpha});
      else this.icons.push({slot:kind==='fruit'?1:0,rect,alpha:f.alpha});
      if(kind==='lives'&&f.receipt.parent.modern)this.labels.push({text:'DEATHS',x:x+icon+gap,y:top+icon*.91,cap:Math.max(10,cap*.24),maxWidth});
    }
    for(const flight of bonusTransferFlights(f)){
      const from=this.sources[flight.kind],to=this.targets[flight.kind],t=flight.progress;
      const ease=t*t*(3-2*t),size=from.width*(.72+.28*t);
      const rect={x:from.x+(to.x-from.x)*ease+Math.sin(t*Math.PI)*Math.sin(flight.index*1.8)*w*.025,
        y:from.y+(to.y-from.y)*ease,width:size,height:size};
      if(flight.kind==='lives')this.faces.push({rect,alpha:1});
      else this.icons.push({slot:flight.kind==='fruit'?1:0,rect,alpha:1});
    }
  }
  paint(ctx:CanvasRenderingContext2D,width:number,height:number){
    if(!this.frame)return;
    ctx.save();ctx.scale(width/window.innerWidth,height/window.innerHeight);
    for(const l of this.labels){
      if(this.painter.draw(ctx,l.text,l.x,l.y,{size:l.cap,maxWidth:l.maxWidth,palette:'counter',alpha:this.frame.alpha}))continue;
      // A missing/offline atlas must never hide the reward receipt.
      ctx.save();ctx.globalAlpha=this.frame.alpha;ctx.font=`900 ${l.cap}px Impact, sans-serif`;
      ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineWidth=Math.max(2,l.cap*.06);
      ctx.strokeStyle='#352110';ctx.fillStyle='#ffcd52';
      ctx.strokeText(l.text,l.x,l.y,l.maxWidth);ctx.fillText(l.text,l.x,l.y,l.maxWidth);ctx.restore();
    }
    if(this.face.complete&&this.face.naturalWidth)for(const {rect,alpha} of this.faces){
      const r=Math.min(rect.width/this.face.naturalWidth,rect.height/this.face.naturalHeight);
      const w=this.face.naturalWidth*r,h=this.face.naturalHeight*r;
      ctx.globalAlpha=alpha;ctx.drawImage(this.face,rect.x+(rect.width-w)/2,rect.y+(rect.height-h)/2,w,h);
    }
    ctx.restore();
  }
}
