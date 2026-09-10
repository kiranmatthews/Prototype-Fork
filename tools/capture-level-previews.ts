// Local authoring tool: the review button captures actual level geometry with
// the existing renderer. Its temporary localhost receiver is never published.
import * as THREE from 'three';
import { CAMPAIGN_LEVELS } from '../src/campaign';
import { presentationAssets } from '../src/presentationLoading';
export async function captureLevelPreviews(g:any, report:(text:string)=>void):Promise<void> {
  const target=new THREE.WebGLRenderTarget(640,360);target.texture.colorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.PerspectiveCamera(58,16/9,.1,900);
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const ctx=canvas.getContext('2d')!,bytes=new Uint8Array(640*360*4),pixels=ctx.createImageData(640,360);
  try {
    for(const def of CAMPAIGN_LEVELS){
      report(`Capturing ${def.name}`);
      g.gameFlow.hide();g.switchLevel(def.levelId);
      g.gameFlow.showPause({levelName:def.name,inWarpRoom:false});
      await g.getLevel().prepareJungleAssets();await presentationAssets.waitUntilSettled();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const spawn=g.getLevel().spawnPos;
      camera.position.copy(spawn).add(new THREE.Vector3(7,6,9));camera.lookAt(spawn.x,spawn.y+1,spawn.z-20);
      if(def.competition){camera.position.set(30,19,-18);camera.lookAt(-12,2,-68);}
      if(def.levelId==='sky'){camera.position.copy(spawn).add(new THREE.Vector3(2,4,4));camera.lookAt(spawn.x,spawn.y-1,spawn.z-12);}
      const previous=g.renderer.getRenderTarget();
      g.renderer.setRenderTarget(target);g.renderer.clear();g.renderer.render(g.scene,camera);g.renderer.readRenderTargetPixels(target,0,0,640,360,bytes);g.renderer.setRenderTarget(previous);
      for(let y=0;y<360;y++)pixels.data.set(bytes.subarray((359-y)*640*4,(360-y)*640*4),y*640*4);
      ctx.putImageData(pixels,0,0);
      const response=await fetch('http://127.0.0.1:5174',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:def.progressKey,image:canvas.toDataURL('image/jpeg',.9)})});
      if(!response.ok)throw new Error(`Capture failed: ${def.progressKey}`);
    }
    report('12 level previews saved');
  } finally {target.dispose();g.gameFlow.hide();g.switchLevel('jungle');g.gameFlow.showPause({levelName:'Jungle Ruins',inWarpRoom:false});}
}
