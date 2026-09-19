import {Vector2,type WebGLRenderer} from 'three';
const size=new Vector2();

/** Change DPR and dimensions together, without an intermediate allocation or
 * resetting the canvas again for duplicate iOS viewport/orientation events. */
export function resizeRendererSurface(renderer:WebGLRenderer,width:number,height:number,pixelRatio:number):boolean {
  if(![width,height,pixelRatio].every(value=>Number.isFinite(value)&&value>0))return false;
  renderer.getSize(size);
  if(size.x===width&&size.y===height&&renderer.getPixelRatio()===pixelRatio)return false;
  renderer.setDrawingBufferSize(width,height,pixelRatio);
  return true;
}
