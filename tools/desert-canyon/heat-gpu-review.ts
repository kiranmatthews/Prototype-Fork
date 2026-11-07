import * as THREE from 'three';
import {DesertHeatMirage} from '../../src/desertHeatMirage';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:false,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color('#30271b');
const camera=new THREE.PerspectiveCamera(45,16/9,.1,500);camera.updateMatrixWorld();
const tile=new THREE.PlaneGeometry(5,5),materials=[0xf9c278,0x503a32].map(color=>new THREE.MeshBasicMaterial({color}));
for(let y=-8;y<=8;y++)for(let x=-15;x<=15;x++){
  const mesh=new THREE.Mesh(tile,materials[(x+y+100)%2]);mesh.position.set(x*5,y*5,-110);scene.add(mesh);
}
const foreground=new THREE.Mesh(new THREE.PlaneGeometry(4,32),new THREE.MeshBasicMaterial({color:0x02ff94}));
foreground.position.set(-3,0,-50);scene.add(foreground);
const heat=new DesertHeatMirage();heat.reviewTime=0;
let width=1280,height=720,target:THREE.WebGLRenderTarget|null=null;
function configure(strength:number){heat.configure('bryce-canyon',[{p:[0,0,-90],size:[32,13],strength}]);}
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
function draw(enabled:boolean):Float32Array {
  heat.enabled=enabled;renderer.setRenderTarget(target);
  if(!heat.render(renderer,scene,camera,target,false))renderer.render(scene,camera);
  return read();
}
function compare(a:Float32Array,b:Float32Array){
  let max=0,changed=0,foregroundError=0,outsideError=0;
  for(let i=0;i<a.length;i+=4){
    const delta=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
    if(!Number.isFinite(delta))throw new Error('Nonfinite pixel');
    max=Math.max(max,delta);if(delta>2/255)changed++;
    const x=(i/4)%width,y=Math.floor(i/4/width);
    // Interior of the near green bar; border avoids its antialias/edge pixels.
    if(x>width*.442&&x<width*.476&&y>height*.3&&y<height*.7)foregroundError=Math.max(foregroundError,delta);
    if(y<height*.15||y>height*.85)outsideError=Math.max(outsideError,delta);
  }
  return {max,changed,foregroundError,outsideError};
}
document.querySelector<HTMLButtonElement>('#run')!.onclick=()=>{
  const output=document.querySelector('#result')!;
  try{
    const results=[];
    for(const hdr of [false,true])for(const size of [[640,360],[1280,720],[2560,1440]]){
      [width,height]=size;renderer.setSize(width,height);target?.dispose();
      target=hdr?new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType}):null;
      configure(0);const baseline=draw(false),identity=compare(baseline,draw(true));
      configure(2);heat.reviewTime=0;const warped=draw(true),warp=compare(baseline,warped);
      heat.reviewTime=.35;const motion=compare(warped,draw(true));
      const pass=identity.max<.005&&warp.changed>100&&motion.changed>100&&warp.foregroundError===0&&warp.outsideError===0;
      results.push({hdr,size,identity,warp,motion,pass,copy:heat.diagnostics.copySize});
    }
    output.textContent=JSON.stringify({pass:results.every(r=>r.pass),results},null,2);
  }catch(error){output.textContent=String(error);throw error;}
};
