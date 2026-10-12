import * as THREE from 'three';

/** Local authoring capture; callers save the returned JPEG without a receiver. */
export async function captureNightworksPreview(g: any): Promise<string> {
  await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages()]);
  const camera=new THREE.PerspectiveCamera(58,16/9,.1,2000);
  camera.position.set(155,56,-618);camera.lookAt(127,36,-690);camera.updateMatrixWorld(true);
  const target=new THREE.WebGLRenderTarget(640,360);target.texture.colorSpace=THREE.SRGBColorSpace;
  const pixels=new Uint8Array(640*360*4),canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const context=canvas.getContext('2d')!,image=context.createImageData(640,360),previous=g.renderer.getRenderTarget();
  try{
    g.getLevel().updateSceneryView(camera);await g.getLevel().prepareJungleAssets();
    g.renderer.setRenderTarget(target);g.renderer.clear();g.renderer.render(g.scene,camera);
    g.renderer.readRenderTargetPixels(target,0,0,640,360,pixels);
    for(let y=0;y<360;y++)image.data.set(pixels.subarray((359-y)*640*4,(360-y)*640*4),y*640*4);
    context.putImageData(image,0,0);return canvas.toDataURL('image/jpeg',.92);
  }finally{g.renderer.setRenderTarget(previous);g.getLevel().updateSceneryView(g.camera);target.dispose();}
}
