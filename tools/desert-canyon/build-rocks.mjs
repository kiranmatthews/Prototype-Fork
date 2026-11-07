import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeVertices,mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SimplexNoise} from '../../vendor/rock-generator/noise.js';
import {crackDisplace} from '../../vendor/rock-generator/displacement.js';

// Offline authoring only. The upstream noise and crack implementation is kept
// verbatim; these imagegen-guided rounded cartoon hoodoo profiles and placement seeds are our input.
// Every runtime placement uses this complete mesh, including reflections.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
};
const out=new URL('../../public/desert-canyon/',import.meta.url);
await mkdir(out,{recursive:true});
const exporter=new GLTFExporter(),manifest=[];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

function pillar(seed,{height=28,radius=4,cap=.4,taper=.4,lean=.7,flutes=6,radial=64,rows=100}={}){
  const noise=new SimplexNoise(seed),warp=new SimplexNoise(seed+111),cracks=new SimplexNoise(seed+500);
  const positions=[],indices=[],colors=[],uvs=[];
  for(let j=0;j<=rows;j++){
    const t=j/rows,y=t*height;
    const ledges=.08*Math.sin(t*16+seed*.05)+.055*Math.sin(t*31+1.3); // broad rounded beds
    const neck=1-.23*Math.exp(-(((t-.76)/.10)**2));
    const crown=cap*1.45*Math.exp(-(((t-.89)/.095)**2));
    const foot=.65*Math.exp(-t*5);
    const profile=(1-taper*t+foot+ledges+crown)*neck;
    const roundTop=1-(cap>.25?.28:.52)*smooth(.9,1,t);
    for(let i=0;i<=radial;i++){
      const a=i/radial*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a);
      const flute=.11*Math.cos(a*flutes+noise.noise3D(cs*1.4,t*.7,sn*1.4))+.035*Math.cos(a*(flutes+2)+t*.4);
      const erosion=noise.fbm(cs*1.4,t*2.5,sn*1.4,2,2,.5)*.065;
      const r=radius*(profile+flute+erosion)*roundTop;
      const x=Math.sign(cs)*Math.abs(cs)**.84*r+lean*1.35*t*t;
      const z=Math.sign(sn)*Math.abs(sn)**.84*r*(.83+.04*Math.sin(seed));
      const peak=1+smooth(.66,1,t)*(noise.noise3D(cs*1.4,seed,sn*1.4)*.012+.005*Math.cos(a*3));
      positions.push(x,y*peak+noise.noise3D(cs*1.5,t*3,sn*1.5)*.035*radius,z);
      uvs.push(i/radial,t);
      if(j<rows&&i<radial){const q=j*(radial+1)+i;indices.push(q,q+1,q+radial+1,q+1,q+radial+2,q+radial+1);}
    }
  }
  // Closed end caps; their irregular outline is the same as the side rings.
  for(const j of [0,rows]){
    const center=positions.length/3;positions.push(lean*(j/rows)**2,j/rows*height,0);uvs.push(.5,.5);
    for(let i=0;i<radial;i++){const q=j*(radial+1)+i;indices.push(...(j===0?[center,q+1,q]:[center,q,q+1]));}
  }
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g=mergeVertices(g,1e-4);g.computeVertexNormals();
  const p=g.attributes.position,n=g.attributes.normal;
  const params={baseSize:radius,crackAlgo:'horizontal',crackDensity:.12,crackWidth:.24,crackDepth:.035};
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const horizontal=crackDisplace(x,y,z,params,cracks,warp);
    const vertical=crackDisplace(x,y,z,{...params,crackAlgo:'vertical',crackDepth:.045,crackDensity:.14,crackWidth:.26},cracks,warp);
    const displacement=-(horizontal+vertical)+noise.fbm(x*.25,y*.18,z*.25,2,2,.5)*.018;
    p.setXYZ(i,x+n.getX(i)*displacement,y+n.getY(i)*displacement*.45,z+n.getZ(i)*displacement);
    const sediment=noise.fbm(x*.11,y*.15,z*.11,3,2,.5);
    const chalk=smooth(.85,.97,y/height)*.68+smooth(.23,.27,y/height)*(1-smooth(.29,.33,y/height))*.24;
    const c=new THREE.Color('#cb7848').lerp(new THREE.Color('#edc79a'),Math.min(.94,chalk+clamp(sediment+.3)*.16));
    c.multiplyScalar(.97+noise.noise3D(x*.3,y*.13,z*.3)*.035+clamp(n.getY(i))*.035);
    colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingBox();
  // Assets use normalized dimensions in the library; the catalog retains their
  // intended metre bounds. This is a bake, never camera-dependent simplification.
  return g;
}
async function save(name,g){
  g.computeBoundingBox();const box=g.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  g.translate(-center.x,-box.min.y,-center.z);
  const count=g.index.count/3;if(count>30000)throw Error(`${name}: ${count} triangles exceeds the authored budget`);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96});
  const mesh=new THREE.Mesh(g,material);mesh.name=name;
  const bytes=Buffer.from(await exporter.parseAsync(mesh,{binary:true}));await writeFile(new URL(name+'.glb',out),bytes);
  manifest.push({name,triangles:count,vertices:g.attributes.position.count,size:size.toArray().map(v=>+v.toFixed(4)),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await save('hoodoo-spire',pillar(173,{height:35,radius:3.7,cap:.16,taper:.63,flutes:7,lean:1.3}));
await save('hoodoo-cap',pillar(291,{height:25,radius:3.4,cap:.38,taper:.43,flutes:5,lean:-.9}));
function cathedral(seed,height,width,depth,columns){
  const parts=[];
  for(let i=0;i<columns;i++){
    const h=height*(.72+.28*Math.sin(i*1.9+1)**2),r=width/columns*.61;
    const g=pillar(seed+i*67,{height:h,radius:r,cap:.10,taper:.38,flutes:5,lean:(i-columns/2)*.15,radial:40,rows:68});
    g.scale(1,1,depth/(r*2.6));g.translate((i/(columns-1)-.5)*width*.76,0,Math.sin(i*2.2)*depth*.13);parts.push(g);
  }
  return mergeGeometries(parts);
}
await save('hoodoo-fluted',cathedral(419,42,14,12,4));
await save('hoodoo-needle',pillar(631,{height:28,radius:2,cap:.24,taper:.68,flutes:4,lean:.3}));
await save('hoodoo-buttress',cathedral(853,32,23,15,5));
await save('hoodoo-low',pillar(977,{height:9,radius:5.4,cap:.38,taper:.5,flutes:5,lean:.7,rows:54}));
const twinA=pillar(1081,{height:31,radius:3.3,cap:.6,taper:.4,radial:48,rows:84});
const twinB=pillar(1201,{height:35,radius:3.6,cap:.45,taper:.5,radial:48,rows:84});twinA.translate(-2.7,0,0);twinB.translate(2.7,0,.7);
await save('hoodoo-twins',mergeGeometries([twinA,twinB]));
await save('hoodoo-fin',cathedral(1423,39,24,7,5));
// Hand-pressed clay pebbles from the existing cartoon reference: broad soft
// planes and a squat, uneven silhouette, without a miniature hoodoo's neck.
const clayNoise=new SimplexNoise(1601);
const boulder=mergeVertices(new THREE.IcosahedronGeometry(1,2));
const bp=boulder.attributes.position,bc=[];
for(let i=0;i<bp.count;i++){
  const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i);
  const shape=1+clayNoise.noise3D(x*1.6+4,y*1.6,z*1.6)*.10;
  bp.setXYZ(i,x*2.8*shape+Math.max(y,0)*.18,
    Math.max(-.54,y*.66)*2.4*shape,z*2.25*shape);
  const tint=new THREE.Color('#ce9667').lerp(new THREE.Color('#e4b68a'),(y+1)*.12);
  tint.multiplyScalar(.98+clayNoise.noise3D(x,y+3,z)*.025);bc.push(...tint.toArray());
}
boulder.setAttribute('color',new THREE.Float32BufferAttribute(bc,3));
boulder.computeVertexNormals();await save('talus',boulder);
await writeFile(new URL('manifest.json',out),JSON.stringify({generator:'bamyazi/RockGenerator (MIT); unchanged noise.js and displacement.js; imagegen-guided rounded cartoon hoodoo profiles',geometryPolicy:'Native mesh at all distances and in reflections; no simplification',models:manifest},null,2)+'\n');
console.log(JSON.stringify(manifest.map(({name,triangles,bytes})=>({name,triangles,bytes})),null,2));
