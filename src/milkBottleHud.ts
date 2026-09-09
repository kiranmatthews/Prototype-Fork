import * as THREE from 'three';
import { trackPresentationImage } from './presentationLoading';

const FRAME_COUNT=101;
const frames:(HTMLImageElement|undefined)[]=new Array(FRAME_COUNT);
const pending:number[]=[0,100,...Array.from({length:99},(_,i)=>i+1)];
const listeners=new Set<()=>void>();
let loading:Promise<void>|null=null;
const quad=new THREE.PlaneGeometry(1,1);quad.userData.shared=true;
export const milkBottleFrameUrl=(frame:number):string=>
  `${import.meta.env.BASE_URL}hud/milk-bottle/milk_${String(frame).padStart(3,'0')}.png`;

/** One decode/cache for both players, with bounded parallel image requests. */
export function prepareMilkBottleFrames():Promise<void> {
  if(loading)return loading;
  if(typeof Image==='undefined')return Promise.resolve();
  loading=Promise.all(Array.from({length:8},async()=>{
    while(pending.length){
      const frame=pending.shift()!;
      await new Promise<void>(resolve=>{
        const image=new Image();image.decoding='async';
        image.onload=()=>{
          if(image.naturalWidth>0)frames[frame]=image;
          for(const listener of listeners)listener();
          resolve();
        };
        image.onerror=()=>resolve();
        const url=milkBottleFrameUrl(frame);trackPresentationImage(image,url);image.src=url;
      });
    }
  })).then(()=>{});
  return loading;
}

/** Presentation only: inventory still awards the life and wraps at 100. */
export class MilkBottleFill {
  frame=0;
  private previousCount:number|null=null;
  private previousRevision:number|null=null;
  private drinkTime:number|null=null;
  reset():void {this.previousCount=this.previousRevision=null;this.drinkTime=null;this.frame=0;}
  update(count:number,revision:number,dt:number,displayCollected?:number):number {
    const value=THREE.MathUtils.clamp(Math.round(Number.isFinite(count)?count:0),0,100);
    const earned=displayCollected??(this.previousRevision===null?0:Math.max(0,revision-this.previousRevision));
    if(this.drinkTime!==null)this.drinkTime+=Math.max(0,dt);
    if(this.previousCount!==null&&this.previousCount<100&&value<100&&
       this.previousCount+earned>=100)this.drinkTime=0;
    this.previousCount=value;this.previousRevision=revision;
    this.frame=value;
    if(this.drinkTime!==null){
      const time=this.drinkTime;
      const ease=(t:number)=>t*t*(3-2*t);
      if(time<.12)this.frame=100;
      else if(time<.84)this.frame=Math.round(100*(1-ease((time-.12)/.72)));
      else if(time<.91)this.frame=0;
      // Milk arriving during the drink remains owned by gameplay. Show it
      // after reaching empty; never animate the real counter backwards.
      else if(time<1.07)this.frame=Math.round(value*ease((time-.91)/.16));
      else this.drinkTime=null;
    }
    return this.frame;
  }
}

/** A fixed PNG plane in the existing icon pass, including pre-CRT composition. */
export class MilkBottleHud {
  readonly group=new THREE.Group();
  readonly fill=new MilkBottleFill();
  private readonly texture=new THREE.Texture();
  private readonly mesh=new THREE.Mesh(quad,new THREE.MeshBasicMaterial({
    transparent:true,depthWrite:false,toneMapped:false,
  }));
  displayedFrame:number|null=null;
  private readonly refresh=()=>this.applyTexture();
  constructor(){
    this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.generateMipmaps=false;
    this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;this.texture.userData.shared=true;
    this.mesh.material.map=this.texture;
    this.group.name='milk bottle HUD';this.mesh.visible=false;this.group.add(this.mesh);
    listeners.add(this.refresh);
    void prepareMilkBottleFrames().then(()=>{this.applyTexture();listeners.delete(this.refresh);});
    this.applyTexture();
  }
  update(count:number,revision:number,dt:number,displayCollected?:number):void {
    this.fill.update(count,revision,dt,displayCollected);
    // A loaded checkpoint may start at any count. Prioritize that frame over
    // the remaining background frames instead of flashing an empty bottle.
    const index=pending.indexOf(this.fill.frame);
    if(index>0)pending.unshift(...pending.splice(index,1));
    this.applyTexture();
  }
  reset():void {this.fill.reset();this.applyTexture();}
  private applyTexture():void {
    const image=frames[this.fill.frame];
    if(!image)return;
    // One GPU texture per HUD, rather than retaining 101 GPU allocations.
    // Reveal-material clones share this texture, so their fades keep working.
    if(this.displayedFrame!==this.fill.frame){this.texture.image=image;this.texture.needsUpdate=true;}
    this.displayedFrame=this.fill.frame;this.mesh.visible=true;
  }
}
