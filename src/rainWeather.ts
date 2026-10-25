import * as THREE from 'three';

export interface RainProfile { intensity:number; wind:[number,number]; lens?:number; }
const DROP_COUNT=2200, IMPACT_COUNT=96, SPAN=68;
const fract=(n:number)=>n-Math.floor(n);
const random=(n:number)=>fract(Math.sin(n*127.1+311.7)*43758.5453);

const rainVertex=/* glsl */`
 attribute vec4 aSeed;
 uniform float uTime,uIntensity;
 uniform vec3 uEye;
 uniform vec2 uWind;
 varying vec2 vRainUv;
 varying float vAlpha;
 #include <fog_pars_vertex>
 void main(){
  float speed=20.0+aSeed.w*9.0;
  float gust=1.0+.26*sin(uTime*.67)+.14*sin(uTime*1.71);
  vec3 drift=vec3(uWind.x*gust,-speed,uWind.y*gust);
  float windTravel=uTime+.26/.67*(1.0-cos(uTime*.67))+.14/1.71*(1.0-cos(uTime*1.71));
  vec3 world=aSeed.xyz*vec3(68.0,38.0,68.0)+vec3(uWind.x*windTravel,-speed*uTime,uWind.y*windTravel);
  world=uEye+mod(world-uEye+vec3(34.0,19.0,34.0),vec3(68.0,38.0,68.0))-vec3(34.0,19.0,34.0);
  vec4 mvPosition=viewMatrix*vec4(world,1.0);
  vec2 fall=normalize((viewMatrix*vec4(drift,0.0)).xy+vec2(.001));
  vec2 side=vec2(-fall.y,fall.x);
  mvPosition.xy+=side*position.x*(.026+aSeed.w*.028)+fall*position.y*(.7+aSeed.w*.65);
  gl_Position=projectionMatrix*mvPosition;
  vRainUv=uv;
  float distanceToEye=length(world-uEye);
  vAlpha=uIntensity*(.14+aSeed.w*.16)*smoothstep(1.8,4.0,distanceToEye)*(1.0-smoothstep(24.0,34.0,distanceToEye));
  vec3 transformed=world;
  #include <worldpos_vertex>
  #include <fog_vertex>
 }
`;
const rainFragment=/* glsl */`
 varying vec2 vRainUv;
 varying float vAlpha;
 #include <fog_pars_fragment>
 void main(){
  float edge=1.0-smoothstep(.12,.5,abs(vRainUv.x-.5));
  float tail=sin(vRainUv.y*3.14159265);
  gl_FragColor=vec4(.62,.76,.84,edge*tail*vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
 }
`;
const splashVertex=/* glsl */`
 attribute vec4 aImpact;
 attribute vec3 aNormal;
 attribute float aPhase;
 uniform float uTime,uIntensity;
 varying vec2 vRainUv;
 varying float vAge,vAlpha;
 #include <fog_pars_vertex>
 void main(){
  float age=fract(uTime*(1.9+aPhase*.6)+aPhase);
  vec3 tangent=normalize(cross(aNormal,abs(aNormal.z)<.9?vec3(0,0,1):vec3(1,0,0)));
  vec3 bitangent=cross(aNormal,tangent);
  float radius=.06+age*.23;
  vec3 transformed=aImpact.xyz+aNormal*.018+(tangent*position.x+bitangent*position.y)*radius*2.0;
  vec4 mvPosition=modelViewMatrix*vec4(transformed,1.0);
  gl_Position=projectionMatrix*mvPosition;
  vRainUv=uv;vAge=age;vAlpha=aImpact.w*uIntensity;
  #include <worldpos_vertex>
  #include <fog_vertex>
 }
`;
const splashFragment=/* glsl */`
 varying vec2 vRainUv;
 varying float vAge,vAlpha;
 #include <fog_pars_fragment>
 void main(){
  float r=length(vRainUv-.5)*2.0;
  float ring=1.0-smoothstep(.045,.14,abs(r-.78));
  float spray=(1.0-smoothstep(.0,.28,r))*(1.0-smoothstep(.0,.22,vAge));
  gl_FragColor=vec4(.66,.79,.85,(ring*.68+spray*.56)*pow(1.0-vAge,1.7)*vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
 }
`;

function instancedQuad(count:number):THREE.InstancedBufferGeometry {
 const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
 geometry.index=plane.index;geometry.attributes.position=plane.attributes.position;geometry.attributes.uv=plane.attributes.uv;
 geometry.instanceCount=count;return geometry;
}

/** World-space precipitation and surface-aligned impacts. Neither changes
 * geometry, collision or visibility policy; the ordinary depth buffer hides
 * rain behind the mansions. The sample budget is fixed and local to the view. */
export class RainWeather {
 readonly group=new THREE.Group();
 readonly uniforms={uTime:{value:0},uIntensity:{value:1},uEye:{value:new THREE.Vector3()},uWind:{value:new THREE.Vector2()}};
 private readonly rainGeometry=instancedQuad(DROP_COUNT);
 private readonly splashGeometry=instancedQuad(IMPACT_COUNT);
 private readonly impacts=new THREE.InstancedBufferAttribute(new Float32Array(IMPACT_COUNT*4),4).setUsage(THREE.DynamicDrawUsage);
 private readonly normals=new THREE.InstancedBufferAttribute(new Float32Array(IMPACT_COUNT*3),3).setUsage(THREE.DynamicDrawUsage);
 private readonly materials:THREE.ShaderMaterial[]=[];
 private readonly ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,65);
 private readonly normal=new THREE.Vector3();
 private readonly normalMatrix=new THREE.Matrix3();
 private readonly previousEye=new THREE.Vector3(Infinity,Infinity,Infinity);
 private cursor=0;
 private samples=0;
 constructor(private readonly ground:(ray:THREE.Raycaster)=>THREE.Intersection[]){
  this.group.name='Cyclone rain and roof impacts';
  const seeds=Array.from({length:DROP_COUNT*4},(_,i)=>random(i+71));
  this.rainGeometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(new Float32Array(seeds),4));
  this.splashGeometry.setAttribute('aImpact',this.impacts);this.splashGeometry.setAttribute('aNormal',this.normals);
  this.splashGeometry.setAttribute('aPhase',new THREE.InstancedBufferAttribute(new Float32Array(Array.from({length:IMPACT_COUNT},(_,i)=>random(i+871))),1));
  for(const [geometry,vertexShader,fragmentShader]of [[this.rainGeometry,rainVertex,rainFragment],[this.splashGeometry,splashVertex,splashFragment]] as const){
   const material=new THREE.ShaderMaterial({uniforms:{...THREE.UniformsLib.fog,...this.uniforms},vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:true,fog:true,side:THREE.DoubleSide});
   const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=4;mesh.userData.weather=true;
   this.materials.push(material);this.group.add(mesh);
  }
 }
 update(dt:number):void {this.uniforms.uTime.value+=Math.max(0,Math.min(.1,dt));}
 setView(camera:THREE.Camera,profile:RainProfile,enabled=true):void {
  this.group.visible=enabled&&profile.intensity>0;
  this.uniforms.uIntensity.value=profile.intensity;this.uniforms.uWind.value.set(...profile.wind);
  this.uniforms.uEye.value.copy(camera.position);if(!this.group.visible)return;
  const jumped=this.previousEye.distanceToSquared(camera.position)>24*24;
  this.previousEye.copy(camera.position);
  // Warps rebuild the local impact field; normal travel amortizes four rays.
  for(let i=0;i<(jumped?IMPACT_COUNT:4);i++){
   const index=this.cursor++%IMPACT_COUNT,seed=index+this.cursor*7;
   const angle=random(seed)*Math.PI*2,radius=Math.sqrt(random(seed+999))*27;
   this.ray.ray.origin.set(camera.position.x+Math.cos(angle)*radius,camera.position.y+18,camera.position.z+Math.sin(angle)*radius);
   const hit=this.ground(this.ray)[0];this.samples++;
   if(hit?.face){
    this.normal.copy(hit.face.normal).applyNormalMatrix(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld));
    this.impacts.setXYZW(index,hit.point.x,hit.point.y,hit.point.z,this.normal.y>.3?1:0);
    this.normals.setXYZ(index,this.normal.x,this.normal.y,this.normal.z);
   }else this.impacts.setW(index,0);
  }
  this.impacts.needsUpdate=true;this.normals.needsUpdate=true;
 }
 get diagnostics(){return {visible:this.group.visible,streaks:DROP_COUNT,impactCapacity:IMPACT_COUNT,activeImpacts:Array.from({length:IMPACT_COUNT},(_,i)=>this.impacts.getW(i)).filter(Boolean).length,samples:this.samples,time:this.uniforms.uTime.value,span:SPAN,intensity:this.uniforms.uIntensity.value,wind:this.uniforms.uWind.value.toArray()};}
 dispose():void {this.group.removeFromParent();this.rainGeometry.dispose();this.splashGeometry.dispose();for(const material of this.materials)material.dispose();}
}
