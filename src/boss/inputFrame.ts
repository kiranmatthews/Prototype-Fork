export interface ChiefInputDirection { readonly x:number; readonly z:number; }
export interface ChiefDeviceInput { readonly moveX:number; readonly moveY:number; readonly needsNeutral:boolean; }

const normalized=(direction:ChiefInputDirection):ChiefInputDirection=>{
  const length=Math.hypot(direction.x,direction.z);
  return length>1e-6&&Number.isFinite(length)?{x:direction.x/length,z:direction.z/length}:{x:0,z:-1};
};

/** A camera turn preserves a held intention; releasing/re-aiming adopts the new view. */
export class ChiefInputFrame {
  private held=false;
  private stickX=0;
  private stickY=0;
  private forward:ChiefInputDirection={x:0,z:-1};
  reset():void {this.held=false;this.forward={x:0,z:-1};}
  private changes(mx:number,my:number):boolean {
    const length=Math.hypot(mx,my);
    return length<=.1||!this.held||(mx*this.stickX+my*this.stickY)/length<.7;
  }
  preview(mx:number,my:number,camera:ChiefInputDirection):ChiefInputDirection {
    return this.changes(mx,my)?normalized(camera):{...this.forward};
  }
  sample(mx:number,my:number,camera:ChiefInputDirection):ChiefInputDirection {
    const direction=this.preview(mx,my,camera),length=Math.hypot(mx,my);
    if(this.changes(mx,my)&&length>.1){this.stickX=mx/length;this.stickY=my/length;}
    this.forward=direction;this.held=length>.1;
    return direction;
  }
  get basis():ChiefInputDirection {return {...this.forward};}
  /** Read-only authoring/test conversion. A neutral sample resolves ambiguous held frames. */
  inputForWorld(x:number,z:number,camera:ChiefInputDirection):ChiefDeviceInput {
    const length=Math.hypot(x,z),scale=1/Math.max(1,length);
    if(!Number.isFinite(length)||length<=1e-6)return{moveX:0,moveY:0,needsNeutral:false};
    const worldX=x*scale,worldZ=z*scale;
    const current=this.held?this.forward:normalized(camera);
    for(const direction of [current,normalized(camera)]){
      const moveX=-direction.z*worldX+direction.x*worldZ;
      const moveY=direction.x*worldX+direction.z*worldZ;
      const sampled=this.preview(moveX,moveY,camera);
      if(Math.abs(sampled.x-direction.x)+Math.abs(sampled.z-direction.z)<1e-6)
        return{moveX,moveY,needsNeutral:false};
    }
    return{moveX:0,moveY:0,needsNeutral:true};
  }
}
