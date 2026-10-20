export interface ChiefInputDirection { readonly x:number; readonly z:number; }
export interface ChiefDeviceInput { readonly moveX:number; readonly moveY:number; readonly needsNeutral:boolean; }

const normalized=(direction:ChiefInputDirection):ChiefInputDirection=>{
  const length=Math.hypot(direction.x,direction.z);
  return length>1e-6&&Number.isFinite(length)?{x:direction.x/length,z:direction.z/length}:{x:0,z:-1};
};

/** Ground steering follows the visible camera, including while a stick is held.
 * Player keeps launch velocity in its own world frame while airborne. */
export class ChiefInputFrame {
  private forward:ChiefInputDirection={x:0,z:-1};
  reset():void {this.forward={x:0,z:-1};}
  sample(_mx:number,_my:number,camera:ChiefInputDirection):ChiefInputDirection {
    this.forward=normalized(camera);
    return {...this.forward};
  }
  get basis():ChiefInputDirection {return {...this.forward};}
  /** Read-only authoring/test conversion using the same visible screen frame. */
  inputForWorld(x:number,z:number,camera:ChiefInputDirection):ChiefDeviceInput {
    const length=Math.hypot(x,z),scale=1/Math.max(1,length);
    if(!Number.isFinite(length)||length<=1e-6)return{moveX:0,moveY:0,needsNeutral:false};
    const worldX=x*scale,worldZ=z*scale,direction=normalized(camera);
    return{moveX:-direction.z*worldX+direction.x*worldZ,
      moveY:direction.x*worldX+direction.z*worldZ,needsNeutral:false};
  }
}
