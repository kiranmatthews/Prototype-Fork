import * as THREE from 'three';
import {FlameHeatDistortion} from '../../src/flameHeatDistortion';
import {attachFlameHeat} from '../../src/flameHeatSource';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:false,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color('#30271b');
const camera=new THREE.PerspectiveCamera(45,16/9,.1,500);camera.updateMatrixWorld();
const tile=new THREE.PlaneGeometry(1,1),materials=[0xf9c278,0x503a32].map(color=>new THREE.MeshBasicMaterial({color}));
for(let y=-8;y<=8;y++)for(let x=-15;x<=15;x++){
  const mesh=new THREE.Mesh(tile,materials[(x+y+100)%2]);mesh.position.set(x,y,-22);scene.add(mesh);
}
const foreground=new THREE.Mesh(new THREE.PlaneGeometry(.8,6.4),new THREE.MeshBasicMaterial({color:0x02ff94}));
foreground.position.set(-.6,0,-10);scene.add(foreground);
const flame=new THREE.Mesh(new THREE.PlaneGeometry(.4,1.5),new THREE.MeshBasicMaterial({color:0xff8200,toneMapped:false}));
flame.position.set(1,0,-18);scene.add(flame);
attachFlameHeat(flame,emit=>emit(-1,0,0,6.4,2.6,2,0));scene.updateMatrixWorld(true);
const heat=new FlameHeatDistortion();heat.reviewTime=0;
let width=1280,height=720,target:THREE.WebGLRenderTarget|null=null;
function read():Float32Array {
  const floats=new Float32Array(width*height*4);
  if(target){const data=new Uint16Array(floats.length);renderer.readRenderTargetPixels(target,0,0,width,height,data);
    data.forEach((v,i)=>{floats[i]=THREE.DataUtils.fromHalfFloat(v);});
  }else{
    const data=new Uint8Array(floats.length),gl=renderer.getContext();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    data.forEach((v,i)=>{floats[i]=v/255;});
  }
  const gl=renderer.getContext();if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL error after framebuffer copy/read');
  return floats;
}
function draw(enabled:boolean,split=false):Float32Array {
  heat.enabled=enabled;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear();
  const slices=split?2:1;
  for(let slice=0;slice<slices;slice++){
    // r166's viewport/scissor setters multiply by DPR, even on a target.
    const dpr=renderer.getPixelRatio();
    renderer.setViewport(0,height*slice/slices/dpr,width/dpr,height/slices/dpr);
    renderer.setScissor(0,height*slice/slices/dpr,width/dpr,height/slices/dpr);renderer.setScissorTest(true);
    camera.aspect=width/(height/slices);camera.updateProjectionMatrix();
    const gl=renderer.getContext(),viewportBefore=Array.from(gl.getParameter(gl.VIEWPORT)),scissorBefore=Array.from(gl.getParameter(gl.SCISSOR_BOX));
    if(!heat.render(renderer,scene,camera,target,undefined,false))renderer.render(scene,camera);
    if(JSON.stringify(viewportBefore)!==JSON.stringify(Array.from(gl.getParameter(gl.VIEWPORT)))||
      JSON.stringify(scissorBefore)!==JSON.stringify(Array.from(gl.getParameter(gl.SCISSOR_BOX)))||!gl.isEnabled(gl.SCISSOR_TEST))throw new Error('Viewport/scissor leaked from flame pass');
  }
  return read();
}
function compare(a:Float32Array,b:Float32Array,split=false,mask=a){
  let max=0,changed=0,foregroundError=0,flameError=0,outsideError=0;
  for(let i=0;i<a.length;i+=4){
    const delta=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
    if(!Number.isFinite(delta))throw new Error('Nonfinite pixel');
    max=Math.max(max,delta);if(delta>2/255)changed++;
    const x=(i/4)%width,y=Math.floor(i/4/width),sliceHeight=height/(split?2:1),v=(y%sliceHeight)/sliceHeight;
    // Exact colours identify opaque foreground/foreground flame interiors.
    if(mask[i+1]>.85&&mask[i]<.25&&x>0&&v>.3&&v<.7)foregroundError=Math.max(foregroundError,delta);
    if(mask[i]>.98&&mask[i+1]>.20&&mask[i+1]<.55&&mask[i+2]<.01)flameError=Math.max(flameError,delta);
    if(v<.15||v>.85)outsideError=Math.max(outsideError,delta);
  }
  return {max,changed,foregroundError,flameError,outsideError};
}
document.querySelector<HTMLButtonElement>('#run')!.onclick=()=>{
  const output=document.querySelector('#result')!;
  try{
    const results=[];
    for(const hdr of [false,true])for(const [widthPx,heightPx,dpr,split] of [[640,360,1,false],[1280,720,1,false],[2560,1440,2,false],[2493,1726,1.8,false],[1280,720,1,true]] as const){
      width=widthPx;height=heightPx;renderer.setPixelRatio(dpr);renderer.setSize(width/dpr,height/dpr);target?.dispose();
      target=hdr?new THREE.WebGLRenderTarget(width+(dpr===1.8?.7:0),height+(dpr===1.8?.3:0),{type:THREE.HalfFloatType}):null;
      heat.strength=0;const baseline=draw(false,split),identity=compare(baseline,draw(true,split),split);
      heat.strength=1;heat.reviewTime=0;const warped=draw(true,split),warp=compare(baseline,warped,split);
      heat.reviewTime=.35;const motion=compare(warped,draw(true,split),split,baseline);
      const pass=identity.max<.005&&warp.changed>20&&motion.changed>20&&[warp,motion].every(d=>d.foregroundError===0&&d.flameError===0&&d.outsideError===0);
      results.push({hdr,size:[width,height],dpr,split,identity,warp,motion,pass,copy:heat.diagnostics.copySize});
    }
    output.textContent=JSON.stringify({pass:results.every(r=>r.pass),results},null,2);
  }catch(error){output.textContent=String(error);throw error;}
};
