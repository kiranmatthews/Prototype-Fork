import * as THREE from 'three';
import { GameHudSurface } from '../gameHudSurface';
import { trackPresentationImage } from '../presentationLoading';
import type { CrabChiefEncounter } from './crabChief';
import './presentation.css';

/** Portrait/name/health only, painted through the shared pre-CRT surface. */
export class BossPresentation {
  readonly root=document.createElement('section');
  private readonly portrait=new Image();
  private readonly bar=document.createElement('div');
  private readonly fill=document.createElement('div');
  private readonly name=document.createElement('div');
  private surface:GameHudSurface|null=null;
  private boss:CrabChiefEncounter|null=null;
  private key='';
  private composited=false;
  constructor(){
    this.root.className='boss-hud';this.root.hidden=true;this.root.setAttribute('aria-label','Crab Chief health');
    this.portrait.className='boss-portrait';this.portrait.alt='Crab Chief';
    this.portrait.src=import.meta.env.BASE_URL+'boss/chief-portrait.png';trackPresentationImage(this.portrait,this.portrait.src);
    this.bar.className='boss-health';this.bar.setAttribute('role','meter');this.bar.setAttribute('aria-label','Chief health');
    this.bar.setAttribute('aria-valuemin','0');this.bar.setAttribute('aria-valuemax','9');
    this.fill.className='boss-health-fill';this.name.className='boss-name';this.name.textContent='CRAB CHIEF';
    this.bar.append(this.fill,this.name);this.root.append(this.bar,this.portrait);document.body.append(this.root);
  }
  render(boss:CrabChiefEncounter|null,suppressed:boolean):void {
    this.boss=suppressed?null:boss;this.root.hidden=!this.boss;
    if(!this.boss){this.key='';return;}
    this.bar.setAttribute('aria-valuenow',String(this.boss.health));this.fill.style.width=`${this.boss.health/9*100}%`;
  }
  setComposited(value:boolean):void{this.composited=value;this.root.classList.toggle('boss-composited',value);}
  draw(renderer:THREE.WebGLRenderer,size:{width:number;height:number},target:THREE.WebGLRenderTarget|null):void {
    if(!this.boss)return;this.surface??=new GameHudSurface();
    const ratio=target===null?renderer.getPixelRatio():1;
    const raster={width:Math.round(size.width*ratio),height:Math.round(size.height*ratio)};
    const key=[raster.width,raster.height,window.innerWidth,window.innerHeight,this.boss.health,this.portrait.complete,this.portrait.naturalWidth].join(':');
    if(key!==this.key){this.surface.draw(raster,{drawExtra:ctx=>{
      ctx.scale(raster.width/window.innerWidth,raster.height/window.innerHeight);
      const width=window.innerWidth,small=width<700||window.innerHeight<480;
      const x=small?10:22,y=small?12:22,face=small?64:88,barWidth=small?Math.min(218,width-110):258,barHeight=small?30:37;
      const left=x+face*.68,top=y+face*.32;
      ctx.lineWidth=3;ctx.strokeStyle='#17100d';ctx.fillStyle='#b67b32';ctx.fillRect(left,top,barWidth,barHeight);
      ctx.save();ctx.beginPath();ctx.rect(left,top,barWidth*this.boss!.health/9,barHeight);ctx.clip();
      const gradient=ctx.createLinearGradient(left,top,left+barWidth,top);gradient.addColorStop(0,'#70eb00');gradient.addColorStop(.55,'#b7dc00');gradient.addColorStop(1,'#fa9a00');
      ctx.fillStyle=gradient;ctx.fillRect(left,top,barWidth,barHeight);ctx.restore();ctx.strokeRect(left,top,barWidth,barHeight);
      ctx.fillStyle='#101000';ctx.font=`bold ${small?18:23}px Roo,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('CRAB CHIEF',left+barWidth*.5,top+barHeight*.54);
      if(this.portrait.complete&&this.portrait.naturalWidth)ctx.drawImage(this.portrait,x,y,face,face);
    }});this.key=key;}
    this.surface.composite(renderer,size,target);
  }
  get diagnostics(){return{visible:!!this.boss,composited:this.composited,health:this.boss?.health,hints:false,surface:this.surface?.diagnostics??null};}
}
