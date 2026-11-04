import * as THREE from 'three';
import {DistortionBatch,ParticleRenderPass,PARTICLE_SPRITE_LAYER} from '../../src/jak-lab/distortion';
import type {LabParticle} from '../../src/jak-lab/particleMotion';

// A real framebuffer test, independent of the source corpus. Identity mapping
// catches UV flips, resolution errors and double tone mapping. The two bars
// exercise preserved scene depth and the source's later ordinary-sprite pass.
const canvas=document.querySelector('canvas')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
renderer.setSize(960,540);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#172e49');
const camera=new THREE.PerspectiveCamera(45,960/540,.1,100);camera.position.z=10;camera.updateMatrixWorld();
const board=new THREE.Group(),tileGeometry=new THREE.PlaneGeometry(.8,.8);
const tiles=[0xd9b659,0x326280].map(color=>new THREE.MeshBasicMaterial({color}));
for(let y=-5;y<=5;y++)for(let x=-9;x<=9;x++) {
  const mesh=new THREE.Mesh(tileGeometry,tiles[(x+y+20)%2]);mesh.position.set(x*.8,y*.8,-3);board.add(mesh);
}
scene.add(board);
const bar=(x:number,z:number,color:number,layer=0)=>{
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.32,3),new THREE.MeshBasicMaterial({color}));
  mesh.position.set(x,0,z);mesh.layers.set(layer);scene.add(mesh);return mesh;
};
const foreground=bar(-.4,2,0xff0074),sprite=bar(.4,-1,0x00ff66,PARTICLE_SPRITE_LAYER);
const pass=new ParticleRenderPass(),batch=new DistortionBatch(pass.sceneTexture);scene.add(batch.original,batch.gouraud);
const particle:LabParticle={id:1,definitionId:1,alive:true,position:new THREE.Vector3(),
  values:{'rot-x':7,r:1.8*4096,g:.7*4096,b:.7*4096},texture:'',flags:new Set(['aux-list']),
  orientation:new THREE.Quaternion(),orbit:new THREE.Quaternion(),radius:0,parent:null,child:null,
  is3d:false,callback:'add-to-sprite-aux-list',birth:'',age:0,blend:'normal',depthWrite:false,controlled:true};
const output=document.querySelector<HTMLPreElement>('#result')!;
let size=[960,540];
function pixels():Uint8Array {
  const data=new Uint8Array(size[0]*size[1]*4),gl=renderer.getContext();
  gl.readPixels(0,0,size[0],size[1],gl.RGBA,gl.UNSIGNED_BYTE,data);
  if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL framebuffer read failed');
  return data;
}
function draw(mode:'baseline'|'original'|'gouraud',sampleRadius:number):Uint8Array {
  particle.values.b=sampleRadius*4096;batch.write([particle]);
  batch.original.visible=mode==='original';batch.gouraud.visible=mode==='gouraud';
  pass.render(renderer,scene,camera,mode!=='baseline');return pixels();
}
function difference(a:Uint8Array,b:Uint8Array):{max:number;changedPixels:number} {
  let max=0,changedPixels=0;
  for(let i=0;i<a.length;i+=4) {
    const delta=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
    max=Math.max(max,delta);if(delta>2)changedPixels++;
  }
  return {max,changedPixels};
}
function barError(a:Uint8Array,b:Uint8Array,mesh:THREE.Mesh):number {
  const at=mesh.position.clone().project(camera),cx=Math.floor((at.x*.5+.5)*size[0]),cy=Math.floor((at.y*.5+.5)*size[1]);
  let max=0;
  for(let y=cy-3;y<=cy+3;y++)for(let x=cx-3;x<=cx+3;x++)for(let c=0;c<3;c++) {
    const i=(y*size[0]+x)*4+c;max=Math.max(max,Math.abs(a[i]-b[i]));
  }
  return max;
}
function verify():void {
  try {
    const rows=[];
    for(const resolution of [[960,540],[1920,1080],[640,360]]) {
      size=resolution;renderer.setSize(...size as [number,number]);
      const baseline=draw('baseline',.7),identity=draw('original',.7),neutralGouraud=draw('gouraud',.7),original=draw('original',1.2),gouraud=draw('gouraud',1.2);
      const identityError=difference(baseline,identity),originalWarp=difference(baseline,original),gouraudWarp=difference(original,gouraud);
      const neutralGouraudError=difference(baseline,neutralGouraud);
      const depthError=Math.max(barError(baseline,original,foreground),barError(baseline,gouraud,foreground));
      const spriteError=Math.max(barError(baseline,original,sprite),barError(baseline,gouraud,sprite));
      if(identityError.max>2)throw new Error(`Identity image changed by ${identityError.max} at ${resolution}`);
      if(neutralGouraudError.max)throw new Error(`Neutral Gouraud warp left a footprint: ${neutralGouraudError.max}`);
      if(originalWarp.changedPixels<100)throw new Error('Original warp is missing');
      if(gouraudWarp.changedPixels<100)throw new Error('Gouraud variant did not interpolate vertex samples');
      if(depthError||spriteError)throw new Error(`Depth/sprite pass mismatch: ${depthError}/${spriteError}`);
      rows.push({resolution,identityError,neutralGouraudError,originalWarp,gouraudWarp,depthError,spriteError});
    }
    size=[960,540];renderer.setSize(...size as [number,number]);draw('gouraud',1.2);
    output.textContent=JSON.stringify({status:'PASS',checks:['identity colour/UV','neutral Gouraud warp','actual warp','Gouraud interpolation','foreground depth','later sprites','framebuffer resize'],rows},null,2);
  } catch(error) {output.textContent=`FAIL ${error}`;console.error(error);}
}
document.querySelector('#run')!.addEventListener('click',verify);
document.querySelector('#original')!.addEventListener('click',()=>{draw('original',1.2);});
document.querySelector('#gouraud')!.addEventListener('click',()=>{draw('gouraud',1.2);});
draw('original',1.2);
