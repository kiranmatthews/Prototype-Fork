import * as THREE from 'three';
import {SpriteBatch} from '../../src/jak-lab/particles';
import type {LabParticle} from '../../src/jak-lab/particleMotion';

const canvas=document.querySelector('canvas')!,output=document.querySelector<HTMLPreElement>('#result')!;
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,preserveDrawingBuffer:true});
renderer.setClearColor(0,0);renderer.toneMapping=THREE.NoToneMapping;
const camera=new THREE.PerspectiveCamera(48,16/9,.1,50);camera.position.set(5,6,8);camera.lookAt(0,0,0);camera.layers.enable(2);
const scene=new THREE.Scene(),sheet=document.createElement('canvas');sheet.width=sheet.height=4;
const context=sheet.getContext('2d')!;context.fillStyle='#fff';context.fillRect(0,0,4,4);
const texture=new THREE.CanvasTexture(sheet);texture.colorSpace=THREE.NoColorSpace;
const batch=new SpriteBatch(texture,'normal',false);scene.add(batch.original,batch.gouraud);
const expected=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
expected.geometry.setIndex([0,1,2,0,2,3]);scene.add(expected);
const particle:LabParticle={id:1,definitionId:1,alive:true,texture:'fixture',values:{'scale-x':3*4096,'scale-y':2*4096,r:127.5,g:127.5,b:127.5,a:63.75},
  flags:new Set(),position:new THREE.Vector3(),orientation:new THREE.Quaternion(),orbit:new THREE.Quaternion(),radius:0,
  parent:null,child:null,is3d:true,callback:'',birth:'',age:0,blend:'normal',depthWrite:false,controlled:false};
let width=960,height=540;
function render(which:'original'|'gouraud'|'reference'):Uint8Array {
  batch.original.visible=which==='original';batch.gouraud.visible=which==='gouraud';expected.visible=which==='reference';renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  if(gl.getError()!==gl.NO_ERROR)throw new Error('GPU read failed');return pixels;
}
function coverage(a:Uint8Array,b:Uint8Array):{pixels:number;mismatches:number} {
  let pixels=0,mismatches=0;for(let i=3;i<a.length;i+=4){if(a[i]>127)pixels++;if((a[i]>127)!==(b[i]>127))mismatches++;}
  return {pixels,mismatches};
}
function reference(wrong=false):void {
  // Independent source cdata[0..7,12..15], transformed on the CPU. Do not
  // derive these positions from the production shader's strings or attributes.
  const vertices:number[]=[],rotation=(particle.values['rot-z']??0)*Math.PI*2/65536;
  for(const [x,y] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]) {
    const p=new THREE.Vector3();
    if(particle.is3d) {
      p.set(x*3,wrong?y*2:0,wrong?0:y*2).applyQuaternion(particle.orientation);
    } else {
      const u=(x+(!wrong&&particle.values['rot-x']===4?.5:0))*3,v=y*2;
      p.set(u*Math.cos(rotation)-v*Math.sin(rotation),u*Math.sin(rotation)+v*Math.cos(rotation),0).applyQuaternion(camera.quaternion);
    }
    vertices.push(...p.toArray());
  }
  expected.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));expected.geometry.computeBoundingSphere();
}
function run():void {
  try {
    const rows=[];
    for(const resolution of [[480,270],[960,540]]) {
      [width,height]=resolution;renderer.setSize(width,height);
      for(const mode of ['3D identity','3D X quarter-turn','3D arbitrary','3D negative quaternion','2D centered','2D anchored','2D anchored rotated']) {
        particle.is3d=mode.startsWith('3D');particle.orientation.identity();
        particle.values['rot-x']=mode.includes('anchored')?4:0;particle.values['rot-z']=mode.includes('rotated')?8192:0;
        if(mode.includes('quarter-turn'))particle.orientation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
        if(mode.includes('arbitrary')||mode.includes('negative'))particle.orientation.setFromEuler(new THREE.Euler(.4,.8,-.3));
        if(mode.includes('negative'))particle.orientation.set(-particle.orientation.x,-particle.orientation.y,-particle.orientation.z,-particle.orientation.w);
        batch.write([particle]);reference();const target=render('reference');
        for(const variant of ['original','gouraud'] as const) {
          const result=coverage(target,render(variant));
          if(result.pixels<100||result.mismatches>8)throw new Error(`${mode}/${variant}: ${JSON.stringify(result)}`);
          rows.push({resolution,mode,variant,...result});
        }
        if(mode==='3D identity'||mode==='2D anchored') {
          reference(true);const wrong=coverage(target,render('reference'));
          if(wrong.mismatches<100)throw new Error('Fixture does not reject the old plane/pivot');
        }
      }
    }
    reference();render('original');output.textContent=JSON.stringify({status:'PASS',rows},null,2);
  } catch(error){output.textContent=`FAIL ${error}`;console.error(error);}
}
document.querySelector('#run')!.addEventListener('click',run);renderer.setSize(width,height);batch.write([particle]);reference();render('original');
