import * as THREE from 'three';
import type {CustomComponent} from './level';
import { SURF_GLSL, SWELL_GLSL } from './coastalSurf';

export const GHOST_EFFECT_KINDS=['ghoststeam','ghostgraffiti','ghostneon','ghostslime'] as const;
const fract=(n:number)=>n-Math.floor(n);
const random=(n:number)=>fract(Math.sin(n*127.13+31.7)*43758.5453);

/** Irregular fixture failure with a steady floor of usable light. */
export function ghostFlicker(time:number,seed:number):number {
  const beat=(time+seed*3.17)%7.9;
  const flutter=beat>5.9&&beat<6.5 ? .48+.27*Math.sin(time*31+seed) : .94;
  return THREE.MathUtils.clamp(flutter+.04*Math.sin(time*3.3+seed)+.03*Math.sin(time*11.7+seed*2),.22,1.02);
}

/** A camera-facing local glow, so emission has a visible halo without adding
 * lights or a second post-processing chain to every fixture. */
export function ghostGlow(color:THREE.ColorRepresentation,size:number):THREE.Mesh {
  const material=new THREE.ShaderMaterial({
    uniforms:{tint:{value:new THREE.Color(color)},opacity:{value:.65}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);
      p.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec2 vUv;uniform vec3 tint;uniform float opacity;void main(){
      float r=length(vUv*2.-1.);float a=pow(max(0.,1.-r),2.7)*opacity;
      gl_FragColor=vec4(tint,a);
      #include <colorspace_fragment>
    }`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size),material);
  mesh.name='Soft emerald light halo';mesh.renderOrder=4;return mesh;
}

interface Emitter {p:THREE.Vector3;width:number;height:number;density:number;seed:number;}
const CAPACITY=128;
const TAGS=['GHOSTS RIDE FREE','NO REFUNDS','RAIL RATS','BOO!','STAY DEAD','LAST RIDE','BATHS CLOSED','CHEW CREW'];
const SIGNS=['GHOST TRAIN','LAST DEPARTURE','TURKISH BATHS','DEAD END','THE DINNER SHOW','MIND THE GAP','STAFF ONLY','WAY OUT'];

export class GhostAtmosphere {
  private root=new THREE.Group();
  private emitters:Emitter[]=[];
  private smoke:THREE.InstancedMesh;
  private data=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*4),4);
  private fixtures:{material:THREE.MeshBasicMaterial;halo:THREE.ShaderMaterial;seed:number}[]=[];
  private textures=new Map<string,THREE.CanvasTexture>();
  private time=0;
  private activeEmitters=0;
  private matrix=new THREE.Matrix4();
  private quaternion=new THREE.Quaternion();
  private point=new THREE.Vector3();
  private scale=new THREE.Vector3();
  constructor(levelRoot:THREE.Group){
    this.root.name='Derelict ghost ride steam, graffiti and neon';levelRoot.add(this.root);
    const geometry=new THREE.PlaneGeometry(1,1);geometry.setAttribute('ghostData',this.data);
    const material=new THREE.ShaderMaterial({
      uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`attribute vec4 ghostData;varying vec2 vUv;varying vec4 vData;void main(){vUv=uv;vData=ghostData;
        vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*p;}`,
      fragmentShader:`varying vec2 vUv;varying vec4 vData;uniform float time;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
        void main(){vec2 uv=vUv*2.-1.;float a=vData.z+time*.025;
          uv=mat2(cos(a),-sin(a),sin(a),cos(a))*uv;
          float cloud=noise(uv*2.7+vec2(vData.x,time*.025));cloud+=.5*noise(uv*6.2-vec2(time*.02,vData.x));
          float rim=pow(max(0.,1.-dot(uv,uv)),1.1);
          float alpha=rim*smoothstep(.28,.94,cloud)*vData.y;
          if(alpha<.006)discard;
          vec3 tint=mix(vec3(.045,.19,.10),vec3(.25,.75,.32),smoothstep(.5,1.15,cloud));
          gl_FragColor=vec4(tint,alpha);
          #include <colorspace_fragment>
        }`,
    });
    this.smoke=new THREE.InstancedMesh(geometry,material,CAPACITY);this.smoke.count=0;
    this.smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.data.setUsage(THREE.DynamicDrawUsage);
    this.smoke.frustumCulled=false;this.smoke.renderOrder=3;this.smoke.name='Bounded drifting green steam';this.root.add(this.smoke);
  }
  private lettering(variant:number,neon:boolean,color:string):THREE.CanvasTexture {
    const key=`${variant}:${neon}:${color}`,cached=this.textures.get(key);if(cached)return cached;
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
    const c=canvas.getContext('2d')!;c.clearRect(0,0,512,256);c.scale(.5,.5);
    c.translate(512,256);c.rotate(neon?0:(random(variant+3)-.5)*.13);
    if(!neon&&variant>=8){
      const fade=c.createLinearGradient(0,-240,0,245);fade.addColorStop(0,color);fade.addColorStop(.68,color);fade.addColorStop(1,'transparent');
      c.fillStyle=fade;
      for(let i=0;i<48;i++){
        const x=-480+i*20,end=-20+random(i+variant*23)*265,w=10+random(i+48)*21;
        c.globalAlpha=.30+random(i+variant)*.5;c.beginPath();c.moveTo(x-w,-260);c.lineTo(x+w,-260);
        c.bezierCurveTo(x+w*.8,-60,x+w*.5,end-45,x,end);c.bezierCurveTo(x-w*.5,end-45,x-w*.8,-60,x-w,-260);c.fill();
      }
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;this.textures.set(key,texture);return texture;
    }
    const text=(neon?SIGNS:TAGS)[variant%(neon?SIGNS.length:TAGS.length)];
    c.font=`900 ${text.length>12?90:120}px ${neon?'sans-serif':'Impact, fantasy'}`;c.textAlign='center';c.textBaseline='middle';
    c.lineJoin='round';c.lineWidth=neon?9:22;c.strokeStyle=neon?'#122821':'#100d16';c.strokeText(text,neon?0:5,neon?0:7,960);
    c.shadowColor=color;c.shadowBlur=neon?19:6;c.strokeStyle=color;c.lineWidth=neon?5:9;c.strokeText(text,0,0,960);
    c.fillStyle=neon?'#e0ffc5':color;c.fillText(text,0,0,960);c.shadowBlur=0;
    if(!neon){
      c.strokeStyle=color;c.lineWidth=5;c.beginPath();c.moveTo(-450,100);c.quadraticCurveTo(-150,155,430,65);c.stroke();
      for(let i=0;i<24;i++){const x=-450+random(i+variant*7)*900,y=40+random(i+20)*70;c.globalAlpha=.35+random(i)*.5;c.fillRect(x,y,2+random(i+30)*4,12+random(i+40)*65);}
      for(let i=0;i<160;i++){c.globalAlpha=random(i+71)*.3;c.beginPath();c.arc(-480+random(i+14)*960,-110+random(i+36)*320,1+random(i+91)*3,0,Math.PI*2);c.fill();}
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    this.textures.set(key,texture);return texture;
  }
  add(c:CustomComponent):boolean {
    if(c.dkind==='ghoststeam'){
      this.emitters.push({p:new THREE.Vector3(...c.p),width:c.w??4,height:c.rise??2.4,density:c.amp??.38,seed:c.phase??this.emitters.length*.73});return true;
    }
    if(c.dkind==='ghostslime'){
      const width=c.s?.[0]??4,depth=c.s?.[2]??8;
      const shared=`uniform float time;uniform vec2 poolSize;varying vec2 vUv;varying vec2 vWaterXZ;varying float vWaterEdge;
        ${SURF_GLSL}\n${SWELL_GLSL}\n`;
      const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},tint:{value:new THREE.Color(c.color??'#31ce64')},
        poolSize:{value:new THREE.Vector2(width,depth)},uSurf:{value:new THREE.Vector4(.035,7.2,1.3,.18)}},
        vertexShader:shared+`void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);
          vWaterXZ=world.xz;vec2 edge=min(uv,1.-uv)*poolSize;vWaterEdge=min(edge.x,edge.y);
          vec3 disp=vec3(0.);vec2 slope=vec2(0.);
          coastSwells(world.xz,vWaterEdge*8.,time,vec4(6.,.018,.3,.4),vec2(.8,.6),
            vec4(2.7,.009,.36,.25),vec2(-.6,.8),disp,slope);
          world.y+=disp.y;gl_Position=projectionMatrix*viewMatrix*world;}`,
        fragmentShader:shared+`uniform vec3 tint;void main(){
          float ripple=sin(vUv.x*42.+sin(vUv.y*16.+time*.6)*2.)*.5+.5;
          float pool=smoothstep(0.,.08,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
          float foam=surfFoam(vWaterEdge,vWaterXZ,time,ripple);
          gl_FragColor=vec4(tint*(.14+ripple*.16+foam*.26),pool*.86);
          #include <colorspace_fragment>
        }`,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth,Math.min(64,Math.ceil(width)),Math.min(64,Math.ceil(depth))),material);
      mesh.rotation.set(-Math.PI/2,0,-THREE.MathUtils.degToRad(c.yaw??0));mesh.position.fromArray(c.p);mesh.name='Glowing stagnant bath water';this.root.add(mesh);return true;
    }
    if(c.dkind!=='ghostgraffiti'&&c.dkind!=='ghostneon')return false;
    const neon=c.dkind==='ghostneon',width=c.w??4,height=c.rise??(neon?1.5:2.2),color=c.color??(neon?'#9cff4c':'#ca53ef');
    const material=new THREE.MeshBasicMaterial({map:this.lettering(c.vr??0,neon,color),transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);mesh.position.fromArray(c.p);mesh.position.y+=height/2;
    mesh.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);mesh.name=neon?'Failing neon ride sign':(c.vr??0)>=8?'Bathhouse water damage':'Original spray-painted ride graffiti';this.root.add(mesh);
    if(neon){const glow=ghostGlow(color,width*1.15);glow.position.copy(mesh.position);this.root.add(glow);this.fixtures.push({material,halo:glow.material as THREE.ShaderMaterial,seed:c.phase??this.fixtures.length});}
    return true;
  }
  update(dt:number,player:THREE.Vector3):void {
    this.time+=Math.max(0,dt);let count=0;this.activeEmitters=0;
    (this.smoke.material as THREE.ShaderMaterial).uniforms.time.value=this.time;
    const near=this.emitters.filter(e=>e.p.distanceToSquared(player)<70*70).sort((a,b)=>a.p.distanceToSquared(player)-b.p.distanceToSquared(player));
    for(const e of near){if(count>=CAPACITY)break;this.activeEmitters++;const fade=1-THREE.MathUtils.smoothstep(e.p.distanceTo(player),42,70);
      for(let i=0;i<8&&count<CAPACITY;i++,count++){
        const seed=e.seed*11+i*1.71,life=fract(this.time*.085+random(seed)),angle=seed+this.time*.1;
        this.point.copy(e.p).add(new THREE.Vector3(Math.sin(angle)*e.width*.32,e.height*(.12+life*.78),Math.cos(angle*.73)*e.width*.38));
        const size=e.width*(.65+life*.75);this.scale.set(size,size*.7,1);this.matrix.compose(this.point,this.quaternion,this.scale);this.smoke.setMatrixAt(count,this.matrix);
        this.data.setXYZW(count,seed,e.density*fade*Math.sin(life*Math.PI),seed*.5,0);
      }
    }
    this.smoke.count=count;this.smoke.instanceMatrix.needsUpdate=true;this.data.needsUpdate=true;
    for(const f of this.fixtures){const flicker=ghostFlicker(this.time,f.seed);f.material.opacity=flicker;f.halo.uniforms.opacity.value=flicker*.65;}
    for(const child of this.root.children){if(child!==this.smoke)child.visible=child.position.distanceToSquared(player)<85*85;const m=(child as THREE.Mesh).material as THREE.ShaderMaterial;if(m?.uniforms?.time)m.uniforms.time.value=this.time;}
  }
  get diagnostics(){return{emitters:this.emitters.length,activeEmitters:this.activeEmitters,steamSprites:this.smoke.count,capacity:CAPACITY,neonSigns:this.fixtures.length,paintAtlases:this.textures.size};}
  dispose():void {
    this.smoke.dispose();this.root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;mesh.geometry.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();});
    for(const texture of this.textures.values())texture.dispose();this.textures.clear();this.root.removeFromParent();this.root.clear();this.emitters.length=0;this.fixtures.length=0;
  }
}
