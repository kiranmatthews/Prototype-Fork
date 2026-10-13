import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import type {CustomComponent} from './level';

/** A thin animated surface ribbon following the actual stone/water contacts. */
export function custardFoamMaterial(clock:{value:number},c:CustomComponent):THREE.MeshBasicMaterial {
 const m=new THREE.MeshBasicMaterial({color:c.color??'#d9ecd3',transparent:true,opacity:c.opacity??.68,depthWrite:false,fog:c.fog!==false,side:THREE.DoubleSide});
 m.forceSinglePass=true;m.userData.custardFoam=true;m.userData.jungleDapple=true;
 m.onBeforeCompile=shader=>{
  shader.uniforms.uCustardFoamTime=clock;
  shader.vertexShader='varying vec2 vCustardFoamUv; varying vec2 vCustardFoamWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCustardFoamUv=uv;vCustardFoamWorld=(modelMatrix*vec4(position,1.)).xz;');
  shader.fragmentShader='varying vec2 vCustardFoamUv; varying vec2 vCustardFoamWorld; uniform float uCustardFoamTime;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 p=vCustardFoamWorld;float t=uCustardFoamTime;
   float wave=sin(p.x*.82+p.y*.37-t*.3)+.45*sin(p.y*1.9-p.x*.21+t*.21);
   float broken=.2+.8*smoothstep(-.45,.65,wave);
   diffuseColor.a*=smoothstep(0.,.1,vCustardFoamUv.y)*(1.-smoothstep(.25,1.,vCustardFoamUv.y))*broken;
  `);
 };
 m.customProgramCacheKey=()=> 'custard-measured-foam-v1';return m;
}

export function addCustardPoolBedLook(material:THREE.Material,clock:{value:number}):void {
 const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  before.call(material,shader,renderer);shader.uniforms.uPoolBedTime=clock;
  shader.vertexShader='varying vec3 vPoolBedWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPoolBedWorld=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader='varying vec3 vPoolBedWorld; uniform float uPoolBedTime;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec2 p=vPoolBedWorld.xz;float t=uPoolBedTime;
   float caustic=sin(p.x*1.5+t*.25+sin(p.y*.9-t*.16))*sin(p.y*1.3-t*.21+sin(p.x*.84));
   float thread=pow(1.-abs(caustic),18.);
   totalEmissiveRadiance+=vec3(.11,.18,.055)*thread*.3*smoothstep(-32.,-28.,vPoolBedWorld.y);
  `);
 };
 material.customProgramCacheKey=()=> key()+'|custard-pool-bed-v1';
}

/** A shaped, clear pool. UVs contain metres to the two authored banks. */
export function custardPoolMaterial(clock:{value:number},c:CustomComponent,components:readonly CustomComponent[]):THREE.MeshStandardMaterial {
 const m=new THREE.MeshStandardMaterial({color:c.color??'#139b77',emissive:c.emissive??'#000000',roughness:.24,metalness:0,
  transparent:true,depthWrite:false,opacity:c.opacity??1,vertexColors:!!c.colors,fog:c.fog!==false,
  side:c.doubleSided===false?THREE.FrontSide:THREE.DoubleSide});
 m.forceSinglePass=true;m.userData.waterSurface=true;m.userData.jungleStream=true;m.userData.noWaterShore=true;
 const reflection={value:null as THREE.Texture|null},matrix={value:new THREE.Matrix4()},ready={value:0};
 const stones=components.filter(c=>c.dkind==='custardshoreboulder'&&c.nm?.includes('shoreline'))
  .slice(0,12).map(c=>{const s=c.s!,a=(c.yaw??0)*Math.PI/180;
   return new THREE.Vector4(c.p[0],c.p[2],(Math.abs(Math.cos(a))*s[0]+Math.abs(Math.sin(a))*s[2])*.36,
    (Math.abs(Math.sin(a))*s[0]+Math.abs(Math.cos(a))*s[2])*.36);});
 const stoneCount=stones.length;while(stones.length<12)stones.push(new THREE.Vector4(0,0,1,1));
 m.userData.custardReflection={reflection,matrix,ready};
 m.onBeforeCompile=shader=>{
  shader.uniforms.uPoolTime=clock;shader.uniforms.uPoolReflection=reflection;
  shader.uniforms.uPoolReflectionMatrix=matrix;shader.uniforms.uPoolReflectionReady=ready;
  shader.uniforms.uPoolStones={value:stones};shader.uniforms.uPoolStoneCount={value:stoneCount};
  shader.vertexShader='uniform mat4 uPoolReflectionMatrix; varying vec3 vPoolWorld; varying vec2 vPoolBank; varying vec4 vPoolMirror;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vPoolWorld=(modelMatrix*vec4(position,1.)).xyz;vPoolBank=uv;
   vPoolMirror=uPoolReflectionMatrix*vec4(vPoolWorld,1.);`);
  shader.fragmentShader=`uniform float uPoolTime; uniform sampler2D uPoolReflection; uniform float uPoolReflectionReady;
   uniform vec4 uPoolStones[12]; uniform int uPoolStoneCount;
   varying vec3 vPoolWorld; varying vec2 vPoolBank; varying vec4 vPoolMirror;
   float poolNoise(vec2 p){return sin(p.x+sin(p.y*1.17))*.5+sin(p.y*.79-p.x*.31)*.5;}
   `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 p=vPoolWorld.xz;float t=uPoolTime;
   float shore=max(0.,min(vPoolBank.x,vPoolBank.y));
   for(int i=0;i<12;i++){if(i>=uPoolStoneCount)break;vec4 stone=uPoolStones[i];
    float distanceToStone=(length((p-stone.xy)/stone.zw)-1.)*min(stone.z,stone.w);
    shore=min(shore,max(0.,distanceToStone));
   }
   float depth=smoothstep(.5,10.,shore);
   vec2 slope=vec2(.021*cos(p.x*.72+p.y*.31-t*.56),.017*cos(p.y*.93-p.x*.18+t*.37));
   slope+=vec2(.006*sin(p.y*2.3+p.x*1.2+t*.7),.005*cos(p.x*2.4-p.y*.8-t*.5));
   vec3 poolNormal=normalize(vec3(-slope.x,1.,-slope.y));
   vec3 poolView=normalize(cameraPosition-vPoolWorld);
   float facing=clamp(dot(poolNormal,poolView),0.,1.);
   float fresnel=.035+.965*pow(1.-facing,4.);
   float shoreWave=sin(shore*7.-t*1.2+poolNoise(p*.3)*2.);
   float rim=(1.-smoothstep(.12,.6,shore))*(.65+.35*shoreWave);
   float ripple=pow(max(0.,sin(p.y*1.9+p.x*.65-t*.42+poolNoise(p*.6))),24.);
   float glints=ripple*(.025+.07*pow(1.-facing,2.));
   vec3 poolTint=diffuseColor.rgb;
   diffuseColor.rgb=mix(poolTint*vec3(3.8,.95,.78),poolTint*vec3(.16,.56,.55),depth);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.87,.68),rim*.4)+vec3(.55,.74,.55)*glints;
   diffuseColor.a*=clamp(mix(.29,.84,depth)+fresnel*.25+rim*.13,.2,.97);
   totalEmissiveRadiance+=mix(vec3(.018,.09,.035),vec3(.002,.055,.033),depth);
  `).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mat3(viewMatrix)*poolNormal);')
   .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    reflectedLight.directSpecular*=.04;
    if(uPoolReflectionReady>.5){
     vec2 mirrorUv=vPoolMirror.xy/vPoolMirror.w+slope*.052;
     vec3 reflected=texture2D(uPoolReflection,clamp(mirrorUv,vec2(.002),vec2(.998))).rgb;
     reflected*=mix(vec3(1.),vec3(.18,.9,.68),depth*.8);
     reflectedLight.indirectSpecular+=reflected*(.07+fresnel*.65);
    }
   `);
 };
 m.customProgramCacheKey=()=> 'custard-clear-pool-v1';return m;
}

/** Bounded real scene reflection. The ordinary renderer owns all main draws;
 * this mirror borrows its current pose and restores every changed state. */
export function attachCustardPoolReflection(mesh:THREE.Mesh,clock:{value:number},lite:boolean,capture:(draw:()=>void)=>void=draw=>draw()):void {
 if(lite)return;
 const material=mesh.material as THREE.MeshStandardMaterial,u=material.userData.custardReflection;
 const mirror=new Reflector(new THREE.PlaneGeometry(1,1),{textureWidth:512,textureHeight:512,multisample:0,clipBias:.003});
 const mirrorMaterial=mirror.material as THREE.ShaderMaterial;
 mirror.rotation.x=-Math.PI/2;mesh.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(mesh),centre=bounds.getCenter(new THREE.Vector3());
 mirror.position.copy(centre);mirror.updateMatrixWorld(true);
 u.reflection.value=mirror.getRenderTarget().texture;
 const inverse=mirror.matrixWorld.clone().invert(),lastView=new THREE.Matrix4(),viewport=new THREE.Vector4(),afterViewport=new THREE.Vector4();
 const hidden:THREE.Object3D[]=[];let busy=false,lastTime=-Infinity,disposed=false,frames=0;
 const previous=mesh.onBeforeRender;
 mesh.userData.poolReflection={size:512,frames:0,stateRestored:true};
 mesh.onBeforeRender=(renderer,scene,camera,geometry,mat,group)=>{
  previous.call(mesh,renderer,scene,camera,geometry,mat,group);
  if(busy||disposed||camera.position.y<=centre.y+.05)return;
  const moving=camera.matrixWorld.elements.some((v,i)=>Math.abs(v-lastView.elements[i])>.015);
  if(!moving&&clock.value-lastTime<1/12)return;
  lastTime=clock.value;lastView.copy(camera.matrixWorld);busy=true;
  const info=renderer.info,beforeTriangles=info?.render.triangles??0,beforeCalls=info?.render.calls??0;
  const target=renderer.getRenderTarget(),xr=renderer.xr.enabled,shadow=renderer.shadowMap.autoUpdate,scissorTest=renderer.getScissorTest();
  renderer.getCurrentViewport(viewport);
  scene.traverse(o=>{if(o.visible&&(o as THREE.Mesh).isMesh){const ms=(o as THREE.Mesh).material;
   if((Array.isArray(ms)?ms:[ms]).some(m=>m.userData.waterSurface||m.userData.custardFoam)){hidden.push(o);o.visible=false;}}});
  try{
   capture(()=>mirror.onBeforeRender(renderer,scene,camera,mirror.geometry,mirrorMaterial,group));
   u.matrix.value.copy(mirrorMaterial.uniforms.textureMatrix.value).multiply(inverse);u.ready.value=1;
   mesh.userData.poolReflection.frames=++frames;
   if(info){mesh.userData.poolReflection.triangles=info.render.triangles-(info.autoReset?0:beforeTriangles);mesh.userData.poolReflection.calls=info.render.calls-(info.autoReset?0:beforeCalls);}
  }finally{
   for(const o of hidden)o.visible=true;hidden.length=0;busy=false;
   renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadow;
   renderer.setRenderTarget(target);
   mesh.userData.poolReflection.stateRestored &&= renderer.getRenderTarget()===target &&
    renderer.getScissorTest()===scissorTest && renderer.getCurrentViewport(afterViewport).equals(viewport);
  }
 };
 material.addEventListener('dispose',()=>{if(disposed)return;disposed=true;u.ready.value=0;u.reflection.value=null;
  mesh.onBeforeRender=previous;mirror.geometry.dispose();mirror.dispose();});
}

/** Finale-only golden key and jade bounce; approach and exit restore the
 * original fog. No light, material or movement tuning leaks to other levels. */
export class CustardFinalePresentation {
 readonly root=new THREE.Group();
 private readonly key=new THREE.PointLight('#ffdda2',0,175,1.5);
 private readonly bounce=new THREE.PointLight('#a9d8a7',0,135,1.5);
 private readonly centre:THREE.Vector3;
 private fog:THREE.Fog|null=null;private base:{near:number;far:number;color:THREE.Color}|null=null;
 private readonly warmFog=new THREE.Color('#b9c098');
 private disposed=false;
 constructor(mesh:THREE.Mesh,private readonly scene:THREE.Scene){
  mesh.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(mesh);this.centre=box.getCenter(new THREE.Vector3());
  const p=mesh.geometry.attributes.position,right=new THREE.Vector3().fromBufferAttribute(p,1).sub(new THREE.Vector3().fromBufferAttribute(p,0));
  right.y=0;if(right.lengthSq()<.0001)right.set(1,0,0);right.transformDirection(mesh.matrixWorld);
  const forward=new THREE.Vector3(0,1,0).cross(right).normalize();
  this.key.position.copy(this.centre).addScaledVector(right,26).addScaledVector(forward,-18);this.key.position.y+=68;
  this.bounce.position.copy(this.centre).addScaledVector(right,22).addScaledVector(forward,-12);this.bounce.position.y+=12;
  this.key.castShadow=this.bounce.castShadow=false;
  this.root.name='Custard finale golden light and river bounce';this.root.add(this.key,this.bounce);
 }
 update(camera:THREE.Camera):void {
  if(this.disposed)return;
  const distance=Math.hypot(camera.position.x-this.centre.x,camera.position.z-this.centre.z),blend=1-THREE.MathUtils.smoothstep(distance,105,175);
  this.key.intensity=240*blend;this.bounce.intensity=20*blend;
  if(this.scene.fog instanceof THREE.Fog&&this.scene.fog!==this.fog){this.fog=this.scene.fog;this.base={near:this.fog.near,far:this.fog.far,color:this.fog.color.clone()};}
  if(this.fog&&this.base){this.fog.near=THREE.MathUtils.lerp(this.base.near,108,blend);this.fog.far=THREE.MathUtils.lerp(this.base.far,245,blend);this.fog.color.copy(this.base.color).lerp(this.warmFog,blend);}
 }
 dispose():void {
  if(this.disposed)return;this.disposed=true;
  if(this.fog&&this.base){this.fog.near=this.base.near;this.fog.far=this.base.far;this.fog.color.copy(this.base.color);}
  this.key.dispose();this.bounce.dispose();this.root.removeFromParent();this.root.clear();
 }
}
