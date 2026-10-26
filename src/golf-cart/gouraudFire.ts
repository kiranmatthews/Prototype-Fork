import * as THREE from 'three';

type FireKind = 'fire' | 'jet' | 'ember';
interface Tongue {
  born:number; life:number; seed:number; kind:number; strength:number;
  x:number; y:number; z:number; vx:number; vy:number; vz:number;
  dx:number; dy:number; dz:number; radius:number; length:number;
}
const UP = new THREE.Vector3(0,1,0);
const HOT = new THREE.Color('#fff2a2'), GOLD = new THREE.Color('#ffcb36');
const ORANGE = new THREE.Color('#fa6810'), RED = new THREE.Color('#a92405');

/** A bounded batch of untextured, two-centre Gouraud tongues. The GPU only
 * deforms vertices and faces each tongue toward the current render camera;
 * interpolated vertex RGBA supplies all softness, including the torn rim.
 * Birth positions and velocities are retained, so cutoff never retracts fire. */
export class CartGouraudFire extends THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshBasicMaterial> {
  private particles:Tongue[];
  private cursor=0;
  private data:THREE.InstancedBufferAttribute;
  private dummy=new THREE.Object3D();
  private direction=new THREE.Vector3();
  private lastTime=-Infinity;
  readonly diagnostics={emitted:0,active:0,capacity:0};

  constructor(capacity:number,name:string){
    const geometry=new THREE.BufferGeometry(),positions:number[]=[],colors:number[]=[],indices:number[]=[];
    const sides=10;
    // Two off-centre heat pockets, an uneven orange body, a transparent rim.
    positions.push(-.07,-.22,0,.10,.24,0);
    colors.push(HOT.r,HOT.g,HOT.b,.91,GOLD.r,GOLD.g,GOLD.b,.78);
    for(let ring=0;ring<2;ring++)for(let s=0;s<sides;s++){
      const angle=s/sides*Math.PI*2,r=ring?1:.48;
      positions.push(Math.sin(angle)*r,Math.cos(angle)*r,0);
      const c=ring?RED:ORANGE;colors.push(c.r,c.g,c.b,ring?0:.61);
    }
    for(let s=0;s<sides;s++){
      const n=(s+1)%sides,owner=s<5?1:0,next=n<5?1:0;
      indices.push(owner,2+s,2+n);
      if(owner!==next)indices.push(owner,next,2+n);
      indices.push(2+s,2+sides+s,2+sides+n,2+s,2+sides+n,2+n);
    }
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
    geometry.setIndex(indices);
    const data=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('flameData',data);
    const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,
      side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
    material.name='Kart fire · Gouraud RGBA, untextured';material.userData.gouraud=true;
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nattribute vec4 flameData;')
        .replace('#include <color_vertex>',`#include <color_vertex>
          float flameAge = flameData.x;
          float flameEmber = step(1.5,flameData.w);
          float flameJet = 1.0-step(.5,flameData.w);
          float fade = smoothstep(0.0,.055,flameAge)*(1.0-smoothstep(.50,1.0,flameAge));
          vec3 cooling = vec3(${RED.r},${RED.g},${RED.b});
          // Yellow belongs to the mouth. Keeping every travelling packet hot
          // would produce a dotted chain instead of a connected orange jet.
          vColor.rgb = mix(vColor.rgb,vec3(${ORANGE.r},${ORANGE.g},${ORANGE.b}),flameJet*smoothstep(.04,.32,flameAge)*.94);
          vColor.rgb = mix(vColor.rgb,cooling,smoothstep(.16,1.0,flameAge)*.74);
          vColor.rgb = mix(vColor.rgb,vec3(${GOLD.r},${GOLD.g},${GOLD.b}),flameEmber*.65);
          vColor.a *= fade*flameData.z;`)
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          float wave=flameData.y+flameAge*9.0;
          float rim=abs(position.x)+abs(position.y);
          transformed.x *= 1.0+(.16*sin(wave+position.y*5.0)+.09*sin(wave*1.7-position.y*7.0))*rim;
          transformed.x += sin(wave*.73-position.y*3.6)*(.10+.15*flameAge)*max(0.0,position.y+.3)*(1.0-flameEmber);
          transformed.y += .09*sin(wave+position.x*8.0)*rim*(1.0-flameEmber);`)
        .replace('#include <project_vertex>',`
          vec4 mvPosition=modelViewMatrix*vec4(instanceMatrix[3].xyz,1.0);
          vec3 along=mat3(modelViewMatrix)*instanceMatrix[1].xyz;
          float extent=length(along);
          along=normalize(along);
          vec3 sight=normalize(-mvPosition.xyz);
          vec3 across=cross(along,sight);
          // A plume viewed down its axis still presents a soft round mouth.
          float endOn=1.0-smoothstep(.05,.32,length(across));
          across=length(across)>.001?normalize(across):vec3(1.0,0.0,0.0);
          vec3 faceUp=normalize(cross(sight,across));
          along=normalize(mix(along,faceUp,endOn));
          float width=length(instanceMatrix[0].xyz);
          extent=mix(extent,width,endOn);
          mvPosition.xyz+=across*transformed.x*width+along*transformed.y*extent;
          gl_Position=projectionMatrix*mvPosition;`);
    };
    material.customProgramCacheKey=()=> 'kart-gouraud-tongues-v1';
    super(geometry,material,capacity);
    this.name=name;this.data=data;this.count=0;this.visible=false;this.frustumCulled=false;this.renderOrder=5;
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particles=Array.from({length:capacity},()=>({born:-Infinity,life:0,seed:0,kind:0,strength:0,
      x:0,y:0,z:0,vx:0,vy:0,vz:0,dx:0,dy:1,dz:0,radius:0,length:0}));
    this.diagnostics.capacity=capacity;
  }

  emit(time:number,position:THREE.Vector3,velocity:THREE.Vector3,direction:THREE.Vector3,
    radius:number,length:number,life:number,seed:number,kind:FireKind,strength=1){
    const p=this.particles[this.cursor];this.cursor=(this.cursor+1)%this.particles.length;
    Object.assign(p,{born:time,life,seed,kind:kind==='jet'?0:kind==='fire'?1:2,strength,
      x:position.x,y:position.y,z:position.z,vx:velocity.x,vy:velocity.y,vz:velocity.z,
      dx:direction.x,dy:direction.y,dz:direction.z,radius,length});
    this.diagnostics.emitted++;this.lastTime=-Infinity;
  }

  present(time:number){
    if(time===this.lastTime)return;this.lastTime=time;
    let count=0;
    for(const p of this.particles){
      const age=time-p.born;if(age<0||age>=p.life)continue;
      const u=age/p.life,ember=p.kind===2,jet=p.kind===0,drag=jet?.65:ember?1.1:1.4;
      const travel=(1-Math.exp(-drag*age))/drag;
      const buoyancy=ember?-.7:jet?1.8:1.6;
      const swirl=(jet?.22:.19)*u*u;
      this.dummy.position.set(p.x+p.vx*travel+Math.sin(p.seed+age*8)*swirl,
        p.y+p.vy*travel+buoyancy*age*age,p.z+p.vz*travel+Math.cos(p.seed*.7+age*6)*swirl);
      this.direction.set(p.dx,p.dy+(jet?age*1.1:age*.3),p.dz).normalize();
      this.dummy.quaternion.setFromUnitVectors(UP,this.direction);
      const grow=ember?1-u*.7:1+u*(jet?2.8:1.15);
      this.dummy.scale.set(p.radius*grow,p.length*(ember?1:1+u*.7),1);this.dummy.updateMatrix();
      this.setMatrixAt(count,this.dummy.matrix);this.data.setXYZW(count,u,p.seed,p.strength,p.kind);count++;
    }
    this.count=this.diagnostics.active=count;this.visible=count>0;
    if(count){this.instanceMatrix.needsUpdate=true;this.data.needsUpdate=true;}
  }

  destroy(){this.geometry.dispose();this.material.dispose();this.dispose();this.removeFromParent();}
}
