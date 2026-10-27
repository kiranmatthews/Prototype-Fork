import * as THREE from 'three';
import {Lensflare,LensflareElement} from 'three/examples/jsm/objects/Lensflare.js';
import type {CustomComponent} from './level';
import {WarehouseMaterials,warehouseSurfaceUV} from './warehouseMaterials';
import {StadiumCrowd,type CrowdSection} from './golf-cart/stadiumCrowd';
import {MOTU_STANDS,MOTU_SUN,motuStandPoint} from './levels/motu-beach-art';
import {MOTU_SIGNS,MOTU_PALETTE} from './levels/motu-festival';
import {MOTU_FLOODS,motuHeatLook,type MotuHeatLook} from './motuLighting';
import {MotuSky} from './motuSky';
import type {CoastWater,OceanColor} from './water';

function festivalGraphic(key:string):THREE.CanvasTexture{
  const art=MOTU_SIGNS[key]??MOTU_SIGNS.welcome,canvas=document.createElement('canvas');canvas.width=1536;canvas.height=384;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=art.color;ctx.fillRect(0,0,1536,384);
  ctx.strokeStyle=MOTU_PALETTE.cream;ctx.lineWidth=5;ctx.strokeRect(14,14,1508,356);
  // A sun stamp, surf stripes and asymmetric corners give every zone the
  // same recognisable event identity, rather than floating default text.
  ctx.fillStyle=MOTU_PALETTE.yellow;ctx.beginPath();ctx.arc(118,128,64,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=art.color;for(let i=0;i<5;i++)ctx.fillRect(40,136+i*12,156,5);
  ctx.fillStyle=MOTU_PALETTE.coral;ctx.beginPath();ctx.moveTo(1390,18);ctx.lineTo(1518,18);ctx.lineTo(1518,155);ctx.closePath();ctx.fill();
  ctx.fillStyle=MOTU_PALETTE.cream;ctx.textAlign='center';ctx.font=`italic 900 ${key==='floor'?176:106}px sans-serif`;
  ctx.fillText(art.title,818,211,1240);ctx.font='700 33px sans-serif';ctx.fillText(art.subtitle,818,285,1200);
  ctx.strokeStyle=MOTU_PALETTE.cream;ctx.lineWidth=3;
  for(let j=0;j<3;j++){ctx.beginPath();for(let i=0;i<=80;i++){const x=30+i*18.5,y=327+j*8+Math.sin(i*.22)*6;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}

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

function moonTexture():THREE.DataTexture {
  const width=256,height=128,data=new Uint8Array(width*height*4);
  const craters=Array.from({length:24},(_,i)=>({u:(i*.61803398875)%1,v:.16+((i*.41421356)%1)*.68,r:.012+(i%5)*.007}));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height;let value=.83+.035*Math.sin(u*173+Math.sin(v*91)*2);
    for(const c of craters){const du=Math.min(Math.abs(u-c.u),1-Math.abs(u-c.u)),d=Math.hypot(du*2,v-c.v)/c.r;
      value-=.23*Math.exp(-d*d*2);value+=.12*Math.exp(-(((d-.9)*7)**2));}
    const k=(y*width+x)*4,n=Math.round(THREE.MathUtils.clamp(value,.35,1)*255);
    data[k]=n;data[k+1]=n;data[k+2]=Math.min(255,n+6);data[k+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height);texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

/** Scoped art owner: no movement changes, new downloads, geometry LODs or
 * reflection substitutes. Native collision meshes retain their full topology. */
export class MotuBeachPresentation {
  readonly root=new THREE.Group();
  readonly materials=new WarehouseMaterials();
  private readonly sky=new MotuSky();
  private readonly oceanColors=new Map<string,{base:OceanColor;applied:OceanColor;mode:string}>();
  readonly crowd=new StadiumCrowd(motuCrowdLayout());
  private readonly replaced:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]}[]=[];
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private marqueeTexture:THREE.CanvasTexture|undefined;
  private readonly graphicTextures=new Map<string,THREE.CanvasTexture>();
  private readonly sun=new THREE.Group();
  private readonly direction=new THREE.Vector3(...MOTU_SUN).normalize();
  private readonly flare=new Lensflare();
  private readonly flareElements:LensflareElement[]=[];
  private readonly moonMap=moonTexture();
  private look:MotuHeatLook|undefined;
  private readonly lampMaterial=this.materials.own(new THREE.MeshStandardMaterial({color:'#fff1c9',emissive:'#ffbd6d',roughness:.32}));
  private readonly floodlights=MOTU_FLOODS.map(fixture=>{
    const light=new THREE.SpotLight('#ffd098',0,170,.95,.8,2);
    light.name='Motu / warm floodlight illumination';
    light.position.fromArray(fixture.p);light.target.position.fromArray(fixture.target);light.castShadow=false;return light;
  });
  private readonly disc=new THREE.Mesh(new THREE.SphereGeometry(2.15,32,20),
    new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,2.8,1.9),toneMapped:false,fog:false,depthWrite:false}));
  constructor(parent:THREE.Group,components:readonly CustomComponent[]){
    this.root.name='Motu / coastal festival presentation';
    parent.updateMatrixWorld(true);
    parent.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh||(mesh as THREE.InstancedMesh).isInstancedMesh)return;
      const c=components[mesh.userData.editorIdx];
      if(c?.nm==='Motu / warm floodlight glass'){
        this.replaced.push({mesh,geometry:mesh.geometry,material:mesh.material});mesh.material=this.lampMaterial;return;
      }
      if(c?.nm?.startsWith('Motu / graphic sign / ')){
        const key=c.nm.slice('Motu / graphic sign / '.length);let texture=this.graphicTextures.get(key);
        if(!texture){texture=festivalGraphic(key);this.graphicTextures.set(key,texture);}
        this.replaced.push({mesh,geometry:mesh.geometry,material:mesh.material});
        const graphicOptions={map:texture,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1};
        mesh.material=this.materials.own(key==='floor'?new THREE.MeshStandardMaterial({...graphicOptions,roughness:.85}):new THREE.MeshBasicMaterial(graphicOptions));
        mesh.receiveShadow=key==='floor';return;
      }
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
      const g=warehouseSurfaceUV(mesh,c.nm?.includes('ceramic floor')?.45:wood?2.4:4.5,mesh.userData.vertRampMesh?c:undefined);
      const pos=g.getAttribute('position'),trim=new Float32Array(pos.count),v=new THREE.Vector3();
      const pool=c.t==='vertramp'&&c.vkind==='quarter',lip=c.p[1]+(c.rise??0)*(1-Math.cos((c.arc??90)*Math.PI/180))+(c.lipRise??0);
      for(let i=0;i<pos.count;i++)trim[i]=pool?v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).y-lip+.65:-100;
      g.setAttribute('motuTrim',new THREE.BufferAttribute(trim,1));
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
            shader.vertexShader='attribute float motuTrim; varying float vMotuTrim; varying vec2 vMotuUv;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMotuUv=uv;vMotuTrim=motuTrim;');
            shader.fragmentShader='varying float vMotuTrim; varying vec2 vMotuUv;\n'+shader.fragmentShader;
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
              vec3 scan=diffuseColor.rgb/max(diffuse,vec3(.001));
              float grain=clamp(.68+dot(scan,vec3(.2126,.7152,.0722))*.95,.7,1.16);
              diffuseColor.rgb=diffuse*grain;
              diffuseColor.rgb*=1.0-.10*seam-.075*scuff;
              vec2 tile=vMotuUv*${wood?'2.4':'4.5'}/.34;
              float checker=mod(floor(tile.x)+floor(tile.y),2.0);
              float band=step(0.0,vMotuTrim)*(1.0-step(.48,vMotuTrim));
              diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.025,.13,.18),vec3(.91,.86,.7),checker),band);
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.87,.79,.62),step(.6,vMotuTrim));`);
          };
          material.customProgramCacheKey=()=>`motu-surface-${wood?'plywood':'concrete'}-v3`;
        }
      }
      mesh.material=material;mesh.receiveShadow=true;
    });
    this.sun.name='Motu / sun disc, bloom and depth-occluded lens flare';
    this.disc.renderOrder=2;
    for(const [size,distance,ring]of [[270,0,false],[88,.42,true],[55,.65,false],[155,.92,true]] as const){
      const element=new LensflareElement(glowTexture(ring),size,distance,new THREE.Color('#ffe6b8'));
      this.flareElements.push(element);this.flare.addElement(element);
    }
    for(const light of this.floodlights)this.root.add(light,light.target);
    this.sun.add(this.disc,this.flare);this.root.add(this.sun,this.crowd.root);parent.add(this.root);
    this.setHeat(1);
    this.root.userData.visualOnly=true;
  }
  setHeat(runNumber:number){
    const look=motuHeatLook(runNumber);if(this.look===look)return;this.look=look;
    this.direction.fromArray(look.sunOffset).normalize();this.disc.scale.setScalar(look.discScale);
    this.disc.material.color.setRGB(...look.discColor);
    const map=look.name==='moonlight'?this.moonMap:null;
    if(this.disc.material.map!==map){this.disc.material.map=map;this.disc.material.needsUpdate=true;}
    this.flare.visible=look.name!=='moonlight';
    for(const element of this.flareElements)element.color.set(look.name==='sunset'?'#ffc185':'#ffe5b5');
    this.lampMaterial.emissiveIntensity=.18+look.lampPower*5;
    for(const light of this.floodlights)light.intensity=3200*look.lampPower;
  }
  skyTexture(source:THREE.Texture){return this.sky.texture(source,this.look??motuHeatLook(1));}
  applyOcean(water:CoastWater){
    const look=this.look??motuHeatLook(1),night=look.name==='moonlight',sunset=look.name==='sunset';
    const tint=night?[.19,.26,.40]:sunset?[.75,.56,.44]:[1,1,1];
    for(const key of ['shallow','deep','peak','intersection','specular','shadow'] as const){
      const current=water.params[key],saved=this.oceanColors.get(key);
      if(saved?.applied===current&&saved.mode===look.name)continue;
      const base=saved?.applied===current?saved.base:{...current};
      const gain=key==='specular'?(night?[.38,.53,.78]:sunset?[1.5,.88,.38]:[1,1,1]):tint;
      const applied={r:base.r*gain[0],g:base.g*gain[1],b:base.b*gain[2],a:base.a};
      water.params[key]=applied;this.oceanColors.set(key,{base,applied,mode:look.name});
    }
    water.setMainLightDirection(this.direction);
  }
  update(time:number){this.crowd.update(time);}
  view(camera:THREE.Camera){this.sun.position.copy(camera.position).addScaledVector(this.direction,350);}
  get diagnostics(){return {spectators:this.crowd.count,sections:this.crowd.sections.length,
    surfaces:this.replaced.length,maps:this.materials.textures.size,graphics:this.graphicTextures.size,errors:[...this.materials.errors],
    sunDirection:this.direction.toArray(),sunOcclusion:'depth buffer',geometryLod:false,
    lighting:{mode:this.look?.name,skyVariants:this.sky.count,moon:this.disc.material.map===this.moonMap,flare:this.flare.visible,
      warmFloodlights:this.floodlights.length,floodPower:this.floodlights[0].intensity,extraShadowMaps:0,bloom:this.look?.bloom}};}
  dispose(){
    for(const r of this.replaced){r.mesh.geometry=r.geometry;r.mesh.material=r.material;}
    for(const g of this.geometries)g.dispose();this.geometries.clear();
    for(const t of this.graphicTextures.values())t.dispose();this.graphicTextures.clear();
    this.sky.dispose();this.oceanColors.clear();this.moonMap.dispose();for(const light of this.floodlights)light.dispose();
    this.materials.dispose();this.marqueeTexture?.dispose();this.crowd.dispose();this.flare.dispose();this.disc.geometry.dispose();this.disc.material.dispose();
    this.root.removeFromParent();this.root.clear();
  }
}
