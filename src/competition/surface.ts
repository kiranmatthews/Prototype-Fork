import { paintMenuBackdrop, paintMenuPanel } from '../menuTheme';
import { updateMenuPngFocus } from '../menuPngFocus';
import { paintSilverSecondaryText } from "../secondaryText";
import { paintInputPrompts } from '../inputPromptUI';
import { gameFlowRasterSize } from '../gameFlowSurface';
import { loadRooAtlases, RooAtlasPainter } from '../roo-type/atlas';
import { rooMenuText, rooMenuPalette } from '../roo-type/menu';
import { ROO_APPEARANCE_EVENT, rooLightPosition } from '../roo-type/settings';
import type * as THREE from 'three';
import {GameHudSurface} from '../gameHudSurface';

/** Native ink for the competition's semantic DOM, drawn by the shared pre-CRT
 * interface pass. Layout/hit targets remain in DOM, just like the other menus. */
export class CompetitionSurface {
  private surface:GameHudSurface|null=null;
  private dirty = true;
  private active = false;
  private layout = '';
  private paints = 0;
  private paths = new Map<string, Path2D>();
  private readonly rooAtlas=new RooAtlasPainter();
  private lightPhase=NaN;
  constructor(private root: HTMLElement) {
    void loadRooAtlases().then(()=>this.invalidate());
    window.addEventListener(ROO_APPEARANCE_EVENT,()=>this.invalidate());
    root.addEventListener('scroll', () => this.invalidate(), true);
    root.addEventListener('load', () => this.invalidate(), true);
    window.addEventListener('resize', () => this.invalidate());
    window.addEventListener('input-prompts-changed', () => this.invalidate());
    document.fonts?.addEventListener('loadingdone', () => this.invalidate());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.invalidate()).observe(root);
    if (typeof MutationObserver !== 'undefined') new MutationObserver(records => {
      // render() owns root visibility; assigning its hidden attribute each frame
      // must not turn an idle menu into a full layout/raster pass every frame.
      if(records.some(record => record.target !== root || record.type === 'childList')) this.invalidate();
    }).observe(root, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','src','hidden']});
  }
  invalidate(): void { this.dirty = true; }
  deactivate(): void {
    this.surface?.dispose();this.surface=null;
    this.active=false;this.dirty=true;this.layout='';
  }
  get diagnostics() { return { active:this.active, paints:this.paints, width:this.surface?.diagnostics.textureWidth??0, height:this.surface?.diagnostics.textureHeight??0 }; }
  draw(renderer:THREE.WebGLRenderer,size:{width:number;height:number},target:THREE.WebGLRenderTarget|null):void {
    if(this.root.hidden || getComputedStyle(this.root).display==='none'){this.deactivate();return;}
    const ratio=target===null?renderer.getPixelRatio():1;
    const raster=gameFlowRasterSize(size.width*ratio,size.height*ratio);
    const clock=this.root.classList.contains('is-running')?this.root.querySelector<HTMLElement>('.comp-run-hud'):null;
    const r=clock?.getBoundingClientRect(),sx=raster.width/window.innerWidth,sy=raster.height/window.innerHeight;
    // Preserve the timer's shadow and native pixel density, without an extra
    // viewport-sized canvas copy and upload through the touch-control layer.
    const bounds=r?{x:(r.x-8)*sx,y:(r.y-8)*sy,width:(r.width+20)*sx,height:(r.height+20)*sy}:undefined;
    const layout=JSON.stringify([raster,window.innerWidth,window.innerHeight,bounds]);
    this.surface??=new GameHudSurface({lifeFaceUrl:''});
    if(this.layout!==layout){this.layout=layout;this.dirty=true;}
    this.active=true;
    if(updateMenuPngFocus(this.root,performance.now(),this.dirty))this.dirty=true;
    const lightPhase=Math.round(rooLightPosition()*64);
    if(this.dirty||lightPhase!==this.lightPhase){
      this.surface.draw(raster,{rasterBounds:bounds,drawExtra:ctx=>{
        ctx.scale(sx,sy);this.paintElement(ctx,this.root);
      }});
      this.paints++;this.dirty=false;this.lightPhase=lightPhase;
    }
    this.surface.composite(renderer,size,target);
  }
  private paintElement(ctx: CanvasRenderingContext2D, element: Element): void {
    const style=getComputedStyle(element),rect=element.getBoundingClientRect();
    if(style.display==='none'||style.visibility==='hidden'||rect.width<.1||rect.height<.1||Number(style.opacity)<.001)return;
    ctx.save();ctx.globalAlpha*=Number(style.opacity);
    if(element.hasAttribute?.('data-roo-menu')){
      const text=element.querySelector('.roo-menu-source')?.textContent??'';
      const button=element.closest('.game-menu-button');
      if(button)ctx.filter=getComputedStyle(button).getPropertyValue('--menu-png-colour-filter').trim()||'none';
      if(!this.rooAtlas.draw(ctx,rooMenuText(text),rect.x+rect.width/2,rect.y+rect.height/2,{size:parseFloat(style.fontSize)*.882,palette:rooMenuPalette(element),lightPosition:button?0:undefined,align:'center',maxWidth:rect.width})){
        ctx.font=`${style.fontSize} ${style.fontFamily}`;ctx.fillStyle=style.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,rect.x+rect.width/2,rect.y+rect.height/2,rect.width);
      }
      ctx.restore();return;
    }
    if(element.classList.contains('secondary-silver')&&!element.classList.contains('input-prompt-row')){paintSilverSecondaryText(ctx,element.firstChild?.textContent??'',rect.x,rect.y,parseFloat(style.fontSize));ctx.restore();return;}
    if(element.classList.contains('input-glyph')){ctx.restore();return;}
    if(element.classList.contains('game-control-hint')){const alpha=ctx.globalAlpha;ctx.globalAlpha=1;paintInputPrompts(ctx,element);ctx.globalAlpha=alpha;}
    if(element instanceof SVGSVGElement){this.paintSvg(ctx,element);ctx.restore();return;}
    if(element instanceof HTMLImageElement){
      if(element.complete&&element.naturalWidth)ctx.drawImage(element,rect.x,rect.y,rect.width,rect.height);
      ctx.restore();return;
    }
    this.paintBox(ctx,element,rect,style);
    // Both the card's vertical scroll and narrow tables use the same DOM clip
    // in the Canvas pass, including portraits and controller prompt glyphs.
    if(['auto','scroll','hidden','clip'].includes(style.overflowX)||['auto','scroll','hidden','clip'].includes(style.overflowY)){
      const x=rect.x+(parseFloat(style.borderLeftWidth)||0),y=rect.y+(parseFloat(style.borderTopWidth)||0);
      ctx.beginPath();ctx.rect(x,y,(element as HTMLElement).clientWidth,(element as HTMLElement).clientHeight);ctx.clip();
    }
    if(element.classList.contains('input-prompt-row')){
      // The prompt painter computes opacity through its ancestor chain.
      const alpha=ctx.globalAlpha;ctx.globalAlpha=1;paintInputPrompts(ctx,element);ctx.globalAlpha=alpha;
    } else for(const child of element.childNodes){
      if(child.nodeType===Node.TEXT_NODE)this.paintText(ctx,child as Text,style);
      else if(child instanceof Element)this.paintElement(ctx,child);
    }
    ctx.restore();
  }
  private paintBox(ctx: CanvasRenderingContext2D, element: Element, r: DOMRect, style: CSSStyleDeclaration): void {
    const running=element.classList.contains('is-running');
    let fill: string|CanvasGradient=style.backgroundColor;
    if(element===this.root&&!running){paintMenuBackdrop(ctx,r.width,r.height);return;}
    if(element.classList.contains('comp-card')){paintMenuPanel(ctx,r);return;}
    if(element.classList.contains('comp-run-hud')){
      ctx.fillStyle='#0006';ctx.fillRect(r.x+4,r.y+4,r.width,r.height);
    }
    ctx.fillStyle=fill;ctx.fillRect(r.x,r.y,r.width,r.height);
    const borders=[
      [style.borderTopWidth,style.borderTopColor,r.x,r.y,r.width,0],
      [style.borderRightWidth,style.borderRightColor,r.right,r.y,0,r.height],
      [style.borderBottomWidth,style.borderBottomColor,r.x,r.bottom,r.width,0],
      [style.borderLeftWidth,style.borderLeftColor,r.x,r.y,0,r.height],
    ] as const;
    borders.forEach(([width,color,x,y,w,h],i)=>{
      const b=parseFloat(width)||0;if(!b)return;
      ctx.fillStyle=color;ctx.fillRect(x-(i===1?b:0),y-(i===2?b:0),w||b,h||b);
    });
    if(element.classList.contains('player-row')){ctx.fillStyle='#ffd278';ctx.fillRect(r.x,r.y,4,r.height);}
    const outline=parseFloat(style.outlineWidth)||0,offset=parseFloat(style.outlineOffset)||0;
    if(outline&&style.outlineStyle!=='none'){
      ctx.strokeStyle=style.outlineColor;ctx.lineWidth=outline;
      const gap=offset+outline/2;ctx.strokeRect(r.x-gap,r.y-gap,r.width+2*gap,r.height+2*gap);
    }
  }
  private paintText(ctx: CanvasRenderingContext2D, node: Text, style: CSSStyleDeclaration): void {
    const text=node.data;if(!text.trim())return;
    const range=document.createRange();
    const lines:{start:number;end:number;top:number}[]=[];
    // Range measurements retain actual wrapping, flex/table alignment, inline
    // emphasis and loaded game fonts, without a second approximation of layout.
    for(const match of text.matchAll(/\S+/g)){
      const start=match.index!,end=start+match[0].length;
      range.setStart(node,start);range.setEnd(node,end);
      const rect=range.getBoundingClientRect(),last=lines[lines.length-1];
      if(last&&Math.abs(last.top-rect.top)<1)last.end=end;
      else lines.push({start,end,top:rect.top});
    }
    ctx.save();ctx.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle=style.color;ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;
    for(const line of lines){
      range.setStart(node,line.start);range.setEnd(node,line.end);
      const rect=range.getBoundingClientRect(),label=text.slice(line.start,line.end).replace(/\s+/g,' '),y=rect.y+rect.height/2;
      if(node.parentElement?.tagName==='H1'){
        ctx.fillStyle='#0c1d19';ctx.fillText(label,rect.x+3,y+4);ctx.fillStyle=style.color;
      }
      ctx.fillText(label,rect.x,y);
      if(style.textDecorationLine.includes('line-through')){
        ctx.fillRect(rect.x,y-1,rect.width,Math.max(1,parseFloat(style.fontSize)/16));
      }
    }
    ctx.restore();range.detach();
  }
  private paintSvg(ctx: CanvasRenderingContext2D, svg: SVGSVGElement): void {
    const r=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;
    const scale=Math.min(r.width/v.width,r.height/v.height);
    ctx.translate(r.x+(r.width-v.width*scale)/2,r.y+(r.height-v.height*scale)/2);
    ctx.scale(scale,scale);ctx.translate(-v.x,-v.y);
    for(const element of svg.children){
      let path:Path2D;
      if(element.tagName.toLowerCase()==='path'){
        const d=element.getAttribute('d')??'';
        path=this.paths.get(d)??new Path2D(d);this.paths.set(d,path);
      }else{
        path=new Path2D();const n=(key:string)=>Number(element.getAttribute(key)??0);
        if(element.tagName.toLowerCase()==='rect')path.roundRect(n('x'),n('y'),n('width'),n('height'),n('rx'));
        else if(element.tagName.toLowerCase()==='ellipse')path.ellipse(n('cx'),n('cy'),n('rx'),n('ry'),0,0,Math.PI*2);
        else continue;
      }
      const fill=element.getAttribute('fill')??'#000',stroke=element.getAttribute('stroke');
      if(fill!=='none'){ctx.fillStyle=fill;ctx.fill(path);}
      if(stroke&&stroke!=='none'){ctx.strokeStyle=stroke;ctx.lineWidth=Number(element.getAttribute('stroke-width')??1);ctx.stroke(path);}
    }
  }
}
