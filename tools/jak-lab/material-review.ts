import * as THREE from 'three';
import {gouraudMaterial} from '../../src/jak-lab/gouraudMaterial';

const canvas=document.querySelector('canvas')!,output=document.querySelector<HTMLPreElement>('#result')!;
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,preserveDrawingBuffer:true});
renderer.setSize(640,480);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
const camera=new THREE.PerspectiveCamera(48,4/3,.1,10);camera.position.z=3;
const scene=new THREE.Scene();scene.add(new THREE.AmbientLight(0xffffff,3));
const geometry=new THREE.PlaneGeometry(2,2,1,1);
geometry.setAttribute('color',new THREE.Float32BufferAttribute([1,.4,.2,1, .2,1,.4,.8, .4,.2,1,.7, 1,.9,.2,.9],4));
const data=new Uint8Array(16*16*4),separate=new Uint8Array(16*16*4);
for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
  const i=(y*16+x)*4,r=Math.hypot(x-7.5,y-7.5),a=r>2&&r<7?Math.round((.3+.7*x/15)*255):0;
  data.set([x*17,y*17,128,a],i);
  separate.set([255,y>3&&y<13?255:0,0,255],i);
}
const map=new THREE.DataTexture(data,16,16),alphaMap=new THREE.DataTexture(separate,16,16);
for(const texture of [map,alphaMap]) {
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.needsUpdate=true;
}
map.colorSpace=THREE.SRGBColorSpace;map.offset.set(.13,.21);map.repeat.set(1.3,.9);map.rotation=.32;map.center.set(.5,.5);map.flipY=true;
alphaMap.offset.set(.2,-.1);alphaMap.rotation=-.4;alphaMap.channel=1;
geometry.setAttribute('uv1',geometry.getAttribute('uv').clone());
const source=new THREE.MeshStandardMaterial({map,vertexColors:true,alphaTest:.25,side:THREE.DoubleSide});
let derived=gouraudMaterial(source),size:[number,number]=[640,480];
const mesh=new THREE.Mesh<THREE.BufferGeometry,THREE.Material>(geometry,source);scene.add(mesh);
function rebuild():void {derived.dispose();derived=gouraudMaterial(source);source.needsUpdate=true;}
function draw(gouraud:boolean):Uint8Array {
  mesh.material=gouraud?derived:source;renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=new Uint8Array(size[0]*size[1]*4);
  gl.readPixels(0,0,...size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  if(gl.getError()!==gl.NO_ERROR)throw new Error('GPU framebuffer read failed');
  return pixels;
}
function compare(a:Uint8Array,b:Uint8Array):{maxAlphaError:number;coverageMismatches:number;visiblePixels:number;partialPixels:number} {
  let maxAlphaError=0,coverageMismatches=0,visiblePixels=0,partialPixels=0;
  for(let i=3;i<a.length;i+=4) {
    maxAlphaError=Math.max(maxAlphaError,Math.abs(a[i]-b[i]));
    if((a[i]>1)!==(b[i]>1))coverageMismatches++;
    if(a[i]>1)visiblePixels++;if(a[i]>1&&a[i]<254)partialPixels++;
  }
  return {maxAlphaError,coverageMismatches,visiblePixels,partialPixels};
}
function verify():void {
  try {
    const rows=[];
    for(const resolution of [[320,240],[640,480]] as [number,number][]) {
      size=resolution;renderer.setSize(...size);
      for(const mode of ['opaque','cutout','blend','separate alpha + UV1']) {
        source.alphaMap=mode==='separate alpha + UV1'?alphaMap:null;
        source.transparent=mode==='blend';source.opacity=mode==='blend'?.65:1;
        source.alphaTest=mode==='cutout'||mode==='separate alpha + UV1'?.25:0;rebuild();
        const original=draw(false),gouraud=draw(true),result=compare(original,gouraud);
        if(result.maxAlphaError>1||result.coverageMismatches)throw new Error(`${mode}: mask differs ${JSON.stringify(result)}`);
        if(result.visiblePixels<100)throw new Error(`${mode}: empty rendered fixture`);
        if(mode==='blend'&&result.partialPixels<100)throw new Error('Blend opacity was lost');
        if(mode==='opaque'&&derived.map!==null)throw new Error('Opaque Gouraud retained an unnecessary diffuse texture');
        rows.push({resolution,mode,...result});
      }
    }
    source.alphaMap=null;source.alphaTest=.25;source.transparent=false;source.opacity=1;rebuild();draw(true);
    output.textContent=JSON.stringify({status:'PASS',checks:['cutout coverage','translucent alpha','original UV transforms','separate green-channel alpha mask on UV1','opaque texture omission'],rows},null,2);
  } catch(error){output.textContent=`FAIL ${error}`;console.error(error);}
}
document.querySelector('#run')!.addEventListener('click',verify);
document.querySelector('#original')!.addEventListener('click',()=>draw(false));
document.querySelector('#gouraud')!.addEventListener('click',()=>draw(true));
draw(false);
