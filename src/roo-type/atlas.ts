import {applyRooInk,type RooInk} from './ink';
import { trackPresentationImage } from '../presentationLoading';
import { ROO_ATLAS_METRICS } from './atlas-metrics';
import type { RooAtlasMetrics } from './bake';
import { getRooAppearance, rooLightPosition, rooLightWeights } from './settings';

export interface RooAtlasStyle {
  /** Fixed, font-wide cap-band height in output pixels. */
  size: number;
  palette?: 'bonus' | 'counter';
  tracking?: number;
  align?: CanvasTextAlign;
  maxWidth?: number;
  alpha?: number;
  /** Cached runtime colour layer; source PNGs and alpha are untouched. */
  ink?: RooInk;
  /** -1 left, 0 neutral, +1 right. Omit for gentle automatic lighting. */
  lightPosition?: number;
}
type Palette = 'bonus' | 'counter';
const images: Record<Palette,HTMLImageElement[]>={bonus:[],counter:[]};
let loading:Promise<void>|null=null;

export function loadRooAtlases():Promise<void> {
  if(typeof Image==='undefined')return Promise.resolve();
  if(!loading) loading=Promise.all((['bonus','counter'] as const).flatMap(palette=>Array.from({length:ROO_ATLAS_METRICS[palette].lightFrames??1},(_,frame)=>new Promise<void>(resolve=>{
    const image=new Image();
    const url=rooAtlasUrl(palette,frame);
    trackPresentationImage(image,url);
    image.onload=()=>{images[palette][frame]=image;resolve();};
    image.onerror=()=>resolve(); // Existing Roo/Canvas rendering remains the fallback.
    image.src=url;
  })))).then(()=>undefined);
  return loading;
}

export function layoutRooAtlas(metrics:RooAtlasMetrics,raw:string,tracking=0) {
  const text=raw.toUpperCase();
  const glyphs:Array<{char:string;x:number;y:number;sx:number;sy:number}>=[];
  const optical=metrics.layouts?.[text];
  if(optical){
    for(const [i,entry]of optical.glyphs.entries()){
      const g=metrics.glyphs[entry.char];if(!g)return null;
      const sx=entry.width/(g.inkRight-g.inkLeft),sy=entry.height/((g.inkBottom??1)-(g.inkTop??0));
      glyphs.push({char:entry.char,x:entry.x+i*tracking-g.inkLeft*sx,y:entry.y-(g.inkTop??0)*sy,sx,sy});
    }
    const width=optical.width+Math.max(0,glyphs.length-1)*tracking;return{glyphs,min:0,max:width,width};
  }
  let pen=0,min=Infinity,max=-Infinity;
  for(let i=0;i<text.length;i++){
    const glyph=metrics.glyphs[text[i]];
    if(!glyph)return null; // Do not quietly turn unsupported symbols into question marks.
    if(glyph.width){glyphs.push({char:text[i],x:pen,y:0,sx:1,sy:1});min=Math.min(min,pen+glyph.inkLeft);max=Math.max(max,pen+glyph.inkRight);}
    pen+=glyph.advance+(metrics.kern[text.slice(i,i+2)]??0);
    if(i<text.length-1)pen+=tracking;
  }
  if(!Number.isFinite(min))min=max=0;
  return {glyphs,min,max,width:max-min};
}

export function rooAtlasUrl(palette:Palette,frame=0){return `${import.meta.env.BASE_URL}fonts/roo-${palette}-v${ROO_ATLAS_METRICS[palette].version}${frame?'-light'+frame:''}.png`;}

export function rooAtlasGlyphRect(metrics:RooAtlasMetrics,entry:{char:string;x:number;y:number;sx:number;sy:number}){
  const g=metrics.glyphs[entry.char];
  return{x:entry.x+g.left*entry.sx,y:entry.y+g.top*entry.sy,width:g.width/metrics.capPixels*entry.sx,height:g.height/metrics.capPixels*entry.sy};
}

/** Uses the existing Canvas2D/CRT pass: no new WebGL context, mesh, or per-frame bake. */
export class RooAtlasPainter {
  private cache=new Map<string,{canvas:HTMLCanvasElement;phase:number}>();
  private frameCanvas:HTMLCanvasElement|null=null;
  constructor(){void loadRooAtlases();}
  get ready(){return Boolean(images.bonus[0]&&images.counter[0]);}
  get lightingReady(){return (['bonus','counter'] as const).every(p=>[0,1,2].every(i=>!!images[p][i]));}
  dispose(){for(const item of this.cache.values())item.canvas.width=item.canvas.height=1;this.cache.clear();if(this.frameCanvas)this.frameCanvas.width=this.frameCanvas.height=1;this.frameCanvas=null;}

  draw(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,style:RooAtlasStyle):boolean {
    const palette=style.palette??'counter',image=images[palette][0],metrics=ROO_ATLAS_METRICS[palette];
    if(!image||!Number.isFinite(style.size)||style.size<=0)return false;
    const tracking=(style.tracking??0)/style.size+getRooAppearance().tracking;
    const layout=layoutRooAtlas(metrics,text,tracking);
    if(!layout)return false;
    const size=Math.min(style.size,style.maxWidth&&layout.width>0?style.maxWidth/layout.width:style.size);
    if(size<=0)return true;
    let left=x-layout.min*size;
    if(style.align==='center')left-=layout.width*size/2;
    else if(style.align==='right'||style.align==='end')left-=layout.width*size;
    ctx.save();ctx.globalAlpha*=Math.min(1,Math.max(0,style.alpha??1));ctx.shadowColor='transparent';
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const phase=this.lightingReady?Math.round((style.lightPosition??rooLightPosition())*256)/256:0;
    const placed=layout.glyphs.map(entry=>({glyph:metrics.glyphs[entry.char],rect:rooAtlasGlyphRect(metrics,entry)}));
    if((!this.lightingReady&&!style.ink)||placed.length===0)for(const {glyph,rect}of placed){
      ctx.drawImage(image,glyph.x,glyph.y,glyph.width,glyph.height,
        left+rect.x*size,y-size/2+rect.y*size,rect.width*size,rect.height*size);
    }else{
      const minX=Math.min(...placed.map(p=>p.rect.x)),minY=Math.min(...placed.map(p=>p.rect.y));
      const width=(Math.max(...placed.map(p=>p.rect.x+p.rect.width))-minX)*size;
      const height=(Math.max(...placed.map(p=>p.rect.y+p.rect.height))-minY)*size;
      const transform=ctx.getTransform(),ratio=Math.max(1,Math.min(3,Math.hypot(transform.a,transform.b)));
      const key=JSON.stringify([palette,text,size,tracking,ratio,style.ink]);let item=this.cache.get(key);
      if(!item){const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(width*ratio));canvas.height=Math.max(1,Math.ceil(height*ratio));item={canvas,phase:NaN};this.cache.set(key,item);}
      if(item.phase!==phase){
        // Keep both intermediate surfaces on one raster backend. Chrome can
        // otherwise change downsampling during GPU/CPU transfers at small rims.
        const mix=item.canvas.getContext('2d',{willReadFrequently:true})!;mix.setTransform(1,0,0,1,0,0);mix.clearRect(0,0,item.canvas.width,item.canvas.height);
        mix.imageSmoothingEnabled=true;mix.imageSmoothingQuality='high';
        // Add weighted premultiplied pixels on an isolated transparent surface.
        // Ordinary source-over fades change edge alpha and make the rim pulse.
        mix.globalCompositeOperation='lighter';
        this.frameCanvas??=document.createElement('canvas');
        if(this.frameCanvas.width<item.canvas.width)this.frameCanvas.width=item.canvas.width;
        if(this.frameCanvas.height<item.canvas.height)this.frameCanvas.height=item.canvas.height;
        const frameCtx=this.frameCanvas.getContext('2d',{willReadFrequently:true})!;
        for(const [frame,weight]of rooLightWeights(phase).entries())if(weight>0){
          mix.globalAlpha=weight;
          frameCtx.setTransform(1,0,0,1,0,0);frameCtx.clearRect(0,0,item.canvas.width,item.canvas.height);frameCtx.setTransform(ratio,0,0,ratio,0,0);
          frameCtx.imageSmoothingEnabled=true;frameCtx.imageSmoothingQuality='high';frameCtx.globalCompositeOperation='source-over';frameCtx.globalAlpha=1;
          for(const {glyph,rect}of placed)frameCtx.drawImage(images[palette][frame],glyph.x,glyph.y,glyph.width,glyph.height,(rect.x-minX)*size,(rect.y-minY)*size,rect.width*size,rect.height*size);
          mix.drawImage(this.frameCanvas,0,0,item.canvas.width,item.canvas.height,0,0,item.canvas.width,item.canvas.height);
        }
        if(style.ink)applyRooInk(mix,style.ink);
        item.phase=phase;
      }
      ctx.drawImage(item.canvas,left+minX*size,y-size/2+minY*size,item.canvas.width/ratio,item.canvas.height/ratio);
      this.cache.delete(key);this.cache.set(key,item);
      while(this.cache.size>32){const oldest=this.cache.keys().next().value!;const old=this.cache.get(oldest)!;old.canvas.width=old.canvas.height=1;this.cache.delete(oldest);}
    }
    ctx.restore();return true;
  }
}
