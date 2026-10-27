import * as THREE from 'three';
import {Lensflare,LensflareElement} from 'three/examples/jsm/objects/Lensflare.js';
import type {CustomComponent} from './level';
import {WarehouseMaterials,warehouseSurfaceUV} from './warehouseMaterials';
import {StadiumCrowd,type CrowdSection} from './golf-cart/stadiumCrowd';
import {MOTU_STANDS,MOTU_SUN,motuStandPoint} from './levels/motu-beach-art';

export function motuCrowdLayout():CrowdSection[]{
  return MOTU_STANDS.map((stand,section)=>({name:`Motu ${section+1}`,seats:
    Array.from({length:stand.rows*stand.columns},(_,index)=>{
      const row=Math.floor(index/stand.columns),column=index%stand.columns;
      return {row,column,position:motuStandPoint(stand,(column-(stand.columns-1)/2)*1.15,row*.78,row*1.3+.65),
        yaw:stand.yaw*Math.PI/180,seed:Math.abs(Math.sin(index*12.989+section*78.233)*43758.5453)%1,colorIndex:column*3+row*5+section};
    }).filter(seat=>seat.column%13!==12),
  }));
}

function glowTexture(ring=false):THREE.DataTexture {
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;
    const alpha=ring?Math.exp(-(((r-.58)/.055)**2))*.065:Math.pow(Math.max(0,1-r),3)*.48;
    data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(alpha*255);
  }
  const t=new THREE.DataTexture(data,size,size);t.needsUpdate=true;t.minFilter=t.magFilter=THREE.LinearFilter;return t;
}

/** Scoped art owner: no movement changes, new downloads, geometry LODs or
 * reflection substitutes. Native collision meshes retain their full topology. */
export class MotuBeachPresentation {
  readonly root=new THREE.Group();
  readonly materials=new WarehouseMaterials();
  readonly crowd=new StadiumCrowd(motuCrowdLayout());
  private readonly replaced:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]}[]=[];
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private marqueeTexture:THREE.CanvasTexture|undefined;
  private readonly sun=new THREE.Group();
  private readonly direction=new THREE.Vector3(...MOTU_SUN).normalize();
  private readonly flare=new Lensflare();
  private readonly disc=new THREE.Mesh(new THREE.SphereGeometry(2.15,32,20),
    new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,2.8,1.9),toneMapped:false,fog:false,depthWrite:false}));
  constructor(parent:THREE.Group,components:readonly CustomComponent[]){
    this.root.name='Motu / coastal festival presentation';
    parent.updateMatrixWorld(true);
    parent.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh||(mesh as THREE.InstancedMesh).isInstancedMesh)return;
      const c=components[mesh.userData.editorIdx];
      if(c?.nm==='Motu / invitational marquee'){
        const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=256;const ctx=canvas.getContext('2d')!;
        ctx.fillStyle='#123f49';ctx.fillRect(0,0,1536,256);ctx.strokeStyle='#dfb375';ctx.lineWidth=10;ctx.strokeRect(12,12,1512,232);
        ctx.fillStyle='#ffe7ad';ctx.textAlign='center';ctx.font='italic 900 118px sans-serif';ctx.fillText('MOTU BEACH',768,132);
        ctx.fillStyle='#8ed5ca';ctx.font='700 41px sans-serif';ctx.fillText('I N V I T A T I O N A L   /   S K A T E   &   S U R F',768,205);
        this.marqueeTexture=new THREE.CanvasTexture(canvas);this.marqueeTexture.colorSpace=THREE.SRGBColorSpace;this.marqueeTexture.anisotropy=8;
        this.replaced.push({mesh,geometry:mesh.geometry,material:mesh.material});
        mesh.material=this.materials.own(new THREE.MeshBasicMaterial({map:this.marqueeTexture,side:THREE.DoubleSide}));return;
      }
      if(!c||c.invisible||!['platform','ramp','mesh','vertramp','rail','wallpath'].includes(c.t))return;
      if(c.t!=='rail'&&!['pavement','plank'].includes(c.tex??''))return;
      const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
      const coping=c.t==='rail'||mesh.userData.grindRail!==undefined;
      const wood=c.tex==='plank'&&!coping;
      const g=warehouseSurfaceUV(mesh,wood?2.4:4.5,mesh.userData.vertRampMesh?c:undefined);
      this.replaced.push({mesh,geometry:mesh.geometry,material:mesh.material});
      this.geometries.add(g);mesh.geometry=g;
      const material=coping?this.materials.finish('#b7c6c4',source.side,.65,.3):
        this.materials.surface(wood?'plywood':'concrete',c.color??'#ddd8cb',source.side,source.userData.texKind,c.depthBias??0);
      if(!coping){
        material.normalScale.set(wood?.22:.17,wood?.22:.17);
        material.roughness=wood?.72:.76;
        // Metre-scaled construction seams and sparse wheel scuffs, derived
        // from the same UVs as the licensed reconstruction surface maps.
        if(!material.userData.motuFinish){
          material.userData.motuFinish=true;
          material.onBeforeCompile=shader=>{
            shader.vertexShader='varying vec2 vMotuUv;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMotuUv=uv;');
            shader.fragmentShader='varying vec2 vMotuUv;\n'+shader.fragmentShader;
            // The reconstruction scans include polished roughness patches.
            // Keep their variation in the dry concrete / sealed timber range
            // so the bowls never read as a mirror-finished metal shell.
            shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
              `#include <roughnessmap_fragment>\nroughnessFactor=${wood?'.55+.30':'.72+.24'}*roughnessFactor;`);
            shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
              vec2 cell=vMotuUv*${wood?'vec2(1.0,2.0)':'vec2(1.0)'};
              vec2 edge=abs(fract(cell+.5)-.5)/max(fwidth(cell),vec2(.0001));
              float seam=1.0-smoothstep(.35,1.3,min(edge.x,edge.y));
              float scuff=pow(max(0.0,sin(cell.x*37.0+sin(cell.y*9.0)*.18)),38.0)*pow(max(0.0,sin(cell.y*6.0)),12.0);
              diffuseColor.rgb=min(vec3(.95),diffuseColor.rgb*${wood?'1.6':'2.2'});
              diffuseColor.rgb*=1.0-.12*seam-.065*scuff;`);
          };
          material.customProgramCacheKey=()=>`motu-surface-${wood?'plywood':'concrete'}-v2`;
        }
      }
      mesh.material=material;mesh.receiveShadow=true;
    });
    this.sun.name='Motu / sun disc, bloom and depth-occluded lens flare';
    this.disc.renderOrder=2;
    this.flare.addElement(new LensflareElement(glowTexture(),380,0,new THREE.Color('#fff1ce')));
    this.flare.addElement(new LensflareElement(glowTexture(true),110,.42,new THREE.Color('#a8dddc')));
    this.flare.addElement(new LensflareElement(glowTexture(),70,.65,new THREE.Color('#f0bc7c')));
    this.flare.addElement(new LensflareElement(glowTexture(true),190,.92,new THREE.Color('#f6ca91')));
    this.sun.add(this.disc,this.flare);this.root.add(this.sun,this.crowd.root);parent.add(this.root);
    this.root.userData.visualOnly=true;
  }
  update(time:number){this.crowd.update(time);}
  view(camera:THREE.Camera){this.sun.position.copy(camera.position).addScaledVector(this.direction,350);}
  get diagnostics(){return {spectators:this.crowd.count,sections:this.crowd.sections.length,
    surfaces:this.replaced.length,maps:this.materials.textures.size,errors:[...this.materials.errors],
    sunDirection:this.direction.toArray(),sunOcclusion:'depth buffer',geometryLod:false};}
  dispose(){
    for(const r of this.replaced){r.mesh.geometry=r.geometry;r.mesh.material=r.material;}
    for(const g of this.geometries)g.dispose();this.geometries.clear();
    this.materials.dispose();this.marqueeTexture?.dispose();this.crowd.dispose();this.flare.dispose();this.disc.geometry.dispose();this.disc.material.dispose();
    this.root.removeFromParent();this.root.clear();
  }
}
