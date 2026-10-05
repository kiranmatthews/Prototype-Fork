import * as THREE from 'three';
import type { CustomComponent } from './level';
import { createJungleAssetScope, isJungleAsset, JUNGLE_ASSETS, type Template } from './jungleAssets';

const MAX_CONTACTS=6;
const STONE=/riverstone|mossrock|boulder/;

export interface JungleStreamReflectionSource {
  acquire():{promise:Promise<Template>;release:()=>void;subscribe?:(listener:(template:Template)=>void)=>()=>void};
}
/** One scope and retry schedule shared by all stream materials in a level. */
export class JungleStreamReflectionOwner implements JungleStreamReflectionSource {
  private scope:ReturnType<typeof createJungleAssetScope>|null=null;
  private pending:Promise<Template>|null=null;
  private template:Template|null=null;
  private listeners=new Set<(template:Template)=>void>();
  private timer:ReturnType<typeof setTimeout>|undefined;
  private failures=0;private users=0;private disposed=false;
  private load(scope:ReturnType<typeof createJungleAssetScope>):Promise<Template>{
    const pending=scope.load('trialsv2waterreflection').then(template=>{
      if(this.disposed||this.scope!==scope)return template;
      this.template=template;this.failures=0;
      for(const listener of this.listeners)listener(template);
      return template;
    });
    this.pending=pending;
    pending.catch(()=>{
      if(this.disposed||this.scope!==scope||this.users===0)return;
      this.timer=setTimeout(()=>{
        if(!this.disposed&&this.scope===scope&&this.users>0)this.load(scope);
      },Math.min(30000,2000*2**this.failures++));
    });
    return pending;
  }
  acquire():{promise:Promise<Template>;release:()=>void;subscribe:(listener:(template:Template)=>void)=>()=>void}{
    if(this.disposed)return {promise:Promise.reject(new Error('Stream reflection owner is disposed')),release:()=>{},subscribe:()=>()=>{}};
    const scope=this.scope??=createJungleAssetScope();this.users++;
    const promise=this.pending??this.load(scope),owned=new Set<(template:Template)=>void>();let released=false;
    return {promise,subscribe:listener=>{
      if(released||this.disposed)return ()=>{};
      owned.add(listener);this.listeners.add(listener);if(this.template)listener(this.template);
      return ()=>{owned.delete(listener);this.listeners.delete(listener);};
    },release:()=>{
      if(released)return;released=true;
      for(const listener of owned)this.listeners.delete(listener);owned.clear();
      if(this.disposed)return;
      if(--this.users===0){
        clearTimeout(this.timer);scope.dispose();
        if(this.scope===scope){this.scope=null;this.pending=null;this.template=null;this.failures=0;}
      }
    }};
  }
  async ready():Promise<void>{if(this.pending&&!this.disposed)await this.pending.then(()=>{},()=>{});}
  dispose():void{
    if(this.disposed)return;this.disposed=true;clearTimeout(this.timer);
    this.scope?.dispose();this.scope=null;this.pending=null;this.template=null;this.listeners.clear();this.users=0;
  }
}


/** Contact ellipses come from the same authored props as the picture. The
 * renderer never queries loaded meshes or changes a collision surface. */
export function jungleStreamContacts(water:CustomComponent,geometry:THREE.BufferGeometry,
  components:readonly CustomComponent[]):THREE.Vector4[]{
  geometry.computeBoundingBox();
  const yaw=THREE.MathUtils.degToRad(water.yaw??0),scale=new THREE.Vector3(...(water.s??[1,1,1]));
  const transform=new THREE.Matrix4().compose(new THREE.Vector3(...water.p),
    new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,yaw),scale);
  const bounds=geometry.boundingBox!.clone().applyMatrix4(transform),center=bounds.getCenter(new THREE.Vector3());
  const stones:THREE.Vector4[]=[];
  for(const c of components){
    if(c.invisible||c.t!=='decor'||!c.dkind||!STONE.test(c.dkind)||/submerged|sunken|underwater|riverbed|lagoon bed/i.test(c.nm??''))continue;
    const size=c.s??(isJungleAsset(c.dkind)?JUNGLE_ASSETS[c.dkind].size:undefined);
    if(!size)continue;
    const factor=c.w??1,angle=THREE.MathUtils.degToRad(c.yaw??0);
    const rx=(Math.abs(Math.cos(angle))*size[0]+Math.abs(Math.sin(angle))*size[2])*factor*.5;
    const rz=(Math.abs(Math.sin(angle))*size[0]+Math.abs(Math.cos(angle))*size[2])*factor*.5;
    if(c.p[1]>bounds.max.y+.12||c.p[1]+size[1]*factor<bounds.min.y+.02||
      c.p[0]+rx<bounds.min.x||c.p[0]-rx>bounds.max.x||c.p[2]+rz<bounds.min.z||c.p[2]-rz>bounds.max.z)continue;
    stones.push(new THREE.Vector4(c.p[0],c.p[2],Math.max(.2,rx),Math.max(.2,rz)));
  }
  return stones.sort((a,b)=>(a.x-center.x)**2+(a.y-center.z)**2-(b.x-center.x)**2-(b.y-center.z)**2).slice(0,MAX_CONTACTS);
}

/** Clear, sheltered stream: one surface draw, analytic fragment normals,
 * attached stone ripples and thin contact foam. Authored vertices stay exact. */
export function createJungleStreamMaterial(clock:{value:number},c:CustomComponent,
  geometry:THREE.BufferGeometry,components:readonly CustomComponent[],reflection?:JungleStreamReflectionSource):THREE.MeshStandardMaterial{
  geometry.computeBoundingBox();const bounds=geometry.boundingBox!;
  const contacts=jungleStreamContacts(c,geometry,components);
  const stones=Array.from({length:MAX_CONTACTS},(_,i)=>contacts[i]??new THREE.Vector4(0,0,1,1));
  const localScale=c.s??[1,1,1];
  const material=new THREE.MeshStandardMaterial({color:c.color??'#8cb9a9',emissive:c.emissive??'#000000',
    roughness:.24,metalness:.015,opacity:c.opacity??.48,transparent:true,depthWrite:false,
    vertexColors:!!c.colors,fog:c.fog!==false,side:c.doubleSided===false?THREE.FrontSide:THREE.DoubleSide});
  material.forceSinglePass=true;
  material.userData.waterSurface=true;material.userData.jungleStream=true;material.userData.noWaterShore=true;
  material.userData.streamContacts=contacts.map(stone=>stone.toArray());
  const reflectionMap={value:null as THREE.Texture|null},reflectionReady={value:0};
  const lease=reflection?.acquire();let disposed=false;
  const applyReflection=(template:Template)=>{
    if(disposed)return;reflectionMap.value=template.map;reflectionReady.value=template.map?1:0;
    material.userData.streamReflectionReady=reflectionReady.value>0;material.userData.streamReflectionUnavailable=false;
  };
  const unsubscribe=lease?.subscribe?.(applyReflection);
  if(lease)lease.promise.then(applyReflection).catch(()=>{if(!disposed)material.userData.streamReflectionUnavailable=true;});
  material.addEventListener('dispose',()=>{
    if(disposed)return;disposed=true;reflectionReady.value=0;reflectionMap.value=null;
    material.userData.streamReflectionReady=false;unsubscribe?.();lease?.release();
  });
  material.onBeforeCompile=shader=>{
    shader.uniforms.uJungleStreamTime=clock;
    shader.uniforms.uJungleStreamBounds={value:new THREE.Vector4(bounds.min.x,bounds.min.z,bounds.max.x,bounds.max.z)};
    shader.uniforms.uJungleStreamScale={value:new THREE.Vector2(Math.abs(localScale[0]),Math.abs(localScale[2]))};
    shader.uniforms.uJungleStreamStoneCount={value:contacts.length};shader.uniforms.uJungleStreamStones={value:stones};
    shader.uniforms.uJungleStreamReflection=reflectionMap;shader.uniforms.uJungleStreamReflectionReady=reflectionReady;
    shader.vertexShader='varying vec2 vJungleStreamXZ; varying vec2 vJungleStreamLocal; varying vec3 vJungleStreamWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvJungleStreamWorld = (modelMatrix*vec4(position,1.0)).xyz;\nvJungleStreamXZ = vJungleStreamWorld.xz;\nvJungleStreamLocal = position.xz;');
    shader.fragmentShader=/* glsl */`
      uniform float uJungleStreamTime; uniform vec4 uJungleStreamBounds;
      uniform vec2 uJungleStreamScale; uniform int uJungleStreamStoneCount;
      uniform vec4 uJungleStreamStones[6];
      uniform sampler2D uJungleStreamReflection; uniform float uJungleStreamReflectionReady;
      varying vec2 vJungleStreamXZ; varying vec2 vJungleStreamLocal; varying vec3 vJungleStreamWorld;
      void jungleStreamDetail(vec2 xz,out vec2 slope,out float foam){
        float drift=uJungleStreamTime*0.42;
        slope=vec2(0.018*cos(xz.x*1.42+xz.y*0.53-drift),0.014*cos(xz.y*1.72-xz.x*0.31+drift*0.76));
        slope+=vec2(0.008*sin(xz.y*4.1+xz.x*2.1+drift),0.007*cos(xz.x*3.7-xz.y*2.3-drift));
        foam=0.0;
        for(int i=0;i<6;i++){
          if(i>=uJungleStreamStoneCount)break;
          vec4 stone=uJungleStreamStones[i];vec2 delta=xz-stone.xy;
          float radial=length(delta/stone.zw);
          float shore=(radial-1.0)*min(stone.z,stone.w);
          vec2 direction=delta/max(length(delta),0.01);
          float envelope=exp(-max(shore,0.0)*1.5)*smoothstep(-0.08,0.08,shore);
          slope+=direction*cos(shore*7.0-uJungleStreamTime*1.15+float(i)*1.3)*0.025*envelope;
          float contactAngle=dot(delta,delta)>0.000001?atan(delta.y,delta.x):0.0;
          float broken=0.64+0.36*sin(contactAngle*9.0+uJungleStreamTime*0.32+float(i));
          foam=max(foam,(1.0-smoothstep(0.03,0.30,abs(shore)))*broken*0.64);
        }
      }\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
      vec2 streamSlope; float streamFoam;jungleStreamDetail(vJungleStreamXZ,streamSlope,streamFoam);
      vec2 streamEdge=min(vJungleStreamLocal-uJungleStreamBounds.xy,uJungleStreamBounds.zw-vJungleStreamLocal)*uJungleStreamScale;
      float streamShore=max(0.0,min(streamEdge.x,streamEdge.y));
      float streamDepth=smoothstep(0.0,0.85,streamShore);
      vec3 streamWorldNormal=normalize(vec3(-streamSlope.x,1.0,-streamSlope.y));
      vec3 streamView=normalize(cameraPosition-vJungleStreamWorld);
      float streamFacing=clamp(dot(streamWorldNormal,streamView),0.0,1.0);
      float streamGrazing=pow(1.0-streamFacing,1.5);
      float streamFresnel=0.035+0.965*pow(1.0-streamFacing,4.0);
      float streamShimmer=0.98+0.02*sin(vJungleStreamXZ.x*1.21+vJungleStreamXZ.y*0.89-uJungleStreamTime*0.36);
      diffuseColor.rgb*=mix(vec3(1.08,1.08,0.98),vec3(0.82,0.96,1.02),streamDepth)*streamShimmer;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.82,0.91,0.84),streamFoam);
      diffuseColor.a=clamp(diffuseColor.a*mix(0.42,1.56,streamGrazing)*mix(0.30,1.0,streamDepth)+streamFoam*min(0.22,diffuseColor.a*0.46),0.0,1.0);
    `).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mat3(viewMatrix)*streamWorldNormal);')
      .replace('#include <lights_fragment_end>', /* glsl */`#include <lights_fragment_end>
        float streamDiffuseEnergy=0.68*(1.0-streamFresnel*0.75);
        reflectedLight.directDiffuse*=streamDiffuseEnergy;
        reflectedLight.indirectDiffuse*=streamDiffuseEnergy;
        vec3 streamReflection=vec3(0.0);
        if(uJungleStreamReflectionReady>0.5){
          vec3 streamRay=reflect(-streamView,streamWorldNormal);
          vec2 streamEnvUv=vec2(atan(streamRay.z,streamRay.x)*0.1591549431+0.5,asin(clamp(streamRay.y,-1.0,1.0))*0.3183098862+0.5);
          // Nearby canopy fills the grazing horizon in this authored probe.
          streamEnvUv.y=clamp(streamEnvUv.y-0.16*(1.0-abs(streamRay.y)),0.0,1.0);
          streamReflection=texture2DLodEXT(uJungleStreamReflection,streamEnvUv,2.0).rgb;
          reflectedLight.indirectSpecular+=streamReflection*streamFresnel*(1.0-streamFoam*0.45);
        }
      `).replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\nif(uJungleStreamReflectionReady>0.5)outgoingLight=mix(outgoingLight,streamReflection,streamFresnel*0.6*(1.0-streamFoam));');
  };
  material.customProgramCacheKey=()=> 'clear-jungle-stream-v3';return material;
}
