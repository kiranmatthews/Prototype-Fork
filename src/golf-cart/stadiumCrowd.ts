import * as THREE from 'three';
import {indexCrowdGeometry} from './crowdGeometry';
import { STADIUM,stadiumSections,stadiumSeatPose } from '../levels/cart-stadium-layout';
import { coloured,merged,strut,placed } from './geometry';
import { characterElasticityAmplitudes } from '../animation/elasticity';

/** Static instance buffers + one GPU time uniform. No per-spectator objects,
 * skeletons, CPU animation, billboards or distance-dependent geometry swaps. */
export class StadiumCrowd {
  readonly root=new THREE.Group();
  readonly sections:THREE.InstancedMesh[]=[];
  readonly count:number;
  readonly time={value:0};
  private material:THREE.MeshLambertMaterial;
  private geometry:THREE.BufferGeometry;
  private seats:THREE.InstancedMesh[]=[];
  private seatGeometry:THREE.BufferGeometry;
  private seatMaterial=new THREE.MeshLambertMaterial({color:'#6b7057'});
  constructor(){
    this.root.name='Stadium crowd · GPU cheering';
    const parts:THREE.BufferGeometry[]=[];
    const part=(g:THREE.BufferGeometry,color:string,cloth=0,arm=0,segment=0,tint=0)=>{
      g=coloured(g,color);g.setAttribute('crowdCloth',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(cloth),1));g.setAttribute('crowdArm',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(arm),1));g.setAttribute('crowdSegment',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(segment),1));g.setAttribute('crowdTint',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(tint),1));parts.push(g);
    };
    part(placed(new THREE.CylinderGeometry(.23,.19,.55,6),[0,.79,0]),'#ffffff',1);
    part(placed(new THREE.IcosahedronGeometry(.205,1).scale(.84,1.13,.88),[0,1.27,-.04]),'#ffffff',0,0,1,1);
    part(placed(new THREE.SphereGeometry(.21,8,4,0,Math.PI*2,0,Math.PI/2).scale(.9,.7,.95),[0,1.37,-.02]),'#ffffff',0,0,1,2);
    for(const side of [-1,1]){
      part(strut([side*.12,.51,0],[side*.14,.47,-.28],.085,5),'#3e4551',0,0,4);
      part(strut([side*.14,.47,-.28],[side*.14,.10,-.32],.068,5),'#3e4551',0,0,5);
      part(placed(new THREE.BoxGeometry(.16,.12,.28),[side*.14,.065,-.38]),'#e9dfc5',0,0,6);
      part(strut([side*.22,1.02,0],[side*.39,1.30,-.02],.07,5),'#ffffff',1,side,2);
      part(strut([side*.39,1.30,-.02],[side*.43,1.59,-.07],.058,5),'#ffffff',0,side,3,1);
      part(placed(new THREE.IcosahedronGeometry(.085,0),[side*.43,1.63,-.07]),'#ffffff',0,side,3,1);
      part(placed(new THREE.BoxGeometry(.035,.038,.025),[side*.07,1.30,-.211]),'#302b2a',0,0,1);
    }
    this.geometry=indexCrowdGeometry(merged(parts));this.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1.25,0),1.9);
    this.material=new THREE.MeshLambertMaterial({vertexColors:true});
    const elasticity=characterElasticityAmplitudes('jump');
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.crowdTime=this.time;
      shader.uniforms.crowdElasticity={value:new THREE.Vector3(...elasticity.slice(0,3) as [number,number,number])};
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        uniform float crowdTime; uniform vec3 crowdElasticity;
        attribute float crowdCloth; attribute float crowdArm; attribute float crowdSegment; attribute float crowdTint;
        mat2 crowdTurn(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
        void crowdPose(inout vec3 p,inout vec3 n){
          float seed=fract(sin(dot(instanceMatrix[3].xz,vec2(.731,.193)))*43758.5453);
          float phase=seed*6.283185;
          float wave=pow(max(0.0,sin(crowdTime*2.3+instanceMatrix[3].z*.035)),4.0);
          // Each cheer has anticipation, a big hop, compression and a finite rest.
          float beat=fract(crowdTime*(.65+seed*.18)+seed);
          float crouch=sin(clamp(beat/.16,0.0,1.0)*3.141593);
          float flight=clamp((beat-.16)/.43,0.0,1.0);
          float hop=4.0*flight*(1.0-flight)*(.36+.30*wave);
          float settle=sin(clamp((beat-.59)/.17,0.0,1.0)*3.141593);
          float strain=-crouch+.65*sin(flight*3.141593)-.7*settle;
          float hipY=.51+.14*wave-.065*(crouch+settle);
          float stretch=1.0+crowdElasticity.x*strain;
          if(crowdSegment<3.5){
            if(crowdSegment<.5){p.y=.51+(p.y-.51)*stretch;n.y/=stretch;}
            else if(crowdSegment<1.5){p.y+=.55*(stretch-1.0);}
            else{
              vec2 shoulder=vec2(crowdArm*.22,1.02);
              vec2 elbow=vec2(crowdArm*.39,1.30);
              float armStretch=1.0+crowdElasticity.y*strain;
              if(crowdSegment>2.5){
                float forearmStretch=1.0+crowdElasticity.z*strain;
                mat2 flex=crowdTurn(crowdArm*(.25+.65*sin(crowdTime*6.2+phase)));
                p.xy=elbow+flex*(p.xy-elbow)*forearmStretch;
                n.xy=flex*n.xy/forearmStretch;
              }
              mat2 cheer=crowdTurn(crowdArm*(.15+1.1*sin(crowdTime*4.7+phase)+.35*wave));
              p.xy=shoulder+cheer*(p.xy-shoulder)*armStretch;
              n.xy=cheer*n.xy/armStretch;
              p.y+=.51*(stretch-1.0);
            }
            mat2 sway=crowdTurn(.22*sin(crowdTime*2.8+phase));
            p.xy=vec2(0,.51)+sway*(p.xy-vec2(0,.51));n.xy=sway*n.xy;
            p.y+=hipY-.51;
          }else if(crowdSegment<5.5){
            // Two-segment leg IK: soles stay on the step during anticipation and
            // landing; only the cheer's actual hop lifts them off the concrete.
            vec2 hip=vec2(hipY,0),ankle=vec2(.10,-.32),delta=ankle-hip;
            float distance=length(delta),upper=length(vec2(-.04,-.28)),lower=length(vec2(-.37,-.04));
            vec2 axis=delta/distance;
            float along=(upper*upper-lower*lower+distance*distance)/(2.0*distance);
            vec2 knee=hip+axis*along+vec2(-axis.y,axis.x)*sqrt(max(0.0,upper*upper-along*along));
            vec2 origin=crowdSegment<4.5?vec2(.51,0):vec2(.47,-.28);
            vec2 bind=crowdSegment<4.5?vec2(-.04,-.28):vec2(-.37,-.04);
            vec2 target=crowdSegment<4.5?knee-hip:ankle-knee;
            mat2 bend=crowdTurn(atan(target.y,target.x)-atan(bind.y,bind.x));
            p.yz=(crowdSegment<4.5?hip:knee)+bend*(p.yz-origin);n.yz=bend*n.yz;
          }
          p.y+=hop;
        }`)
        .replace('#include <color_vertex>',`#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.rgb = color * mix(vec3(1.0), instanceColor, crowdCloth);
float pigment=fract(sin(dot(instanceMatrix[3].xz,vec2(.317,.913)))*12997.371);
vec3 skin=mix(vec3(.16,.063,.028),vec3(.76,.48,.26),smoothstep(.05,.92,pigment));
if(crowdTint>.5&&crowdTint<1.5)vColor.rgb=skin;
if(crowdTint>1.5)vColor.rgb=mix(vec3(.035,.027,.019),instanceColor*.62,step(.53,pigment));
#endif`)
        .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
vec3 crowdPosition=position;crowdPose(crowdPosition,objectNormal);`)
        .replace('#include <begin_vertex>',`vec3 transformed=crowdPosition;`);
    };
    this.material.customProgramCacheKey=()=> 'stadium-spectators-v3';
    this.seatGeometry=indexCrowdGeometry(merged([placed(new THREE.BoxGeometry(.67,.11,.5),[0,.45,.02]),placed(new THREE.BoxGeometry(.67,.48,.11),[0,.69,.26])]));
    const dummy=new THREE.Object3D(),palette=['#f2b742','#3e9d9a','#e16c43','#4b80ac','#f1dfab','#a65b81','#8eb15a','#374d58'],color=new THREE.Color();let total=0;
    for(const {start,end,side}of stadiumSections()){
      const positions:{s:number;row:number;column:number}[]=[];
      for(let row=0;row<STADIUM.rows;row++)for(let col=0;col<Math.floor((end-start-2)/STADIUM.seatSpacing);col++)if(col%13!==12)positions.push({s:start+1+col*STADIUM.seatSpacing,row,column:col});
      const people=new THREE.InstancedMesh(this.geometry,this.material,positions.length),seats=new THREE.InstancedMesh(this.seatGeometry,this.seatMaterial,positions.length);
      people.name=`Cheering section ${side}:${start}`;seats.name=`Grandstand seats ${side}:${start}`;
      for(const [index,{s,row,column}]of positions.entries()){
        const pose=stadiumSeatPose({start,end,side},s,row);
        dummy.position.set(...pose.position);dummy.rotation.set(0,pose.yaw,0);dummy.scale.setScalar(1);dummy.updateMatrix();seats.setMatrixAt(index,dummy.matrix);
        const seed=Math.abs(Math.sin(s*12.989+row*78.233)*43758.5453)%1;
        dummy.scale.setScalar(.92+seed*.15);dummy.updateMatrix();people.setMatrixAt(index,dummy.matrix);people.setColorAt(index,color.set(palette[(column*3+row*5+Math.floor(seed*11))%palette.length]));
      }
      // Bounds include the full arm sweep; native frustum culling operates per
      // 48m stand section, including reflections, without changing silhouettes.
      people.computeBoundingSphere();seats.computeBoundingSphere();people.castShadow=false;seats.castShadow=false;
      this.root.add(people,seats);this.sections.push(people);this.seats.push(seats);total+=positions.length;
    }
    this.count=total;this.root.userData={spectators:total,sections:this.sections.length,animation:'GPU cheering hops, planted-leg IK, elastic arms and travelling stadium waves',cpuPerFrame:'one time uniform',lod:false};
  }
  update(time:number){this.time.value=time;}
  dispose(){for(const mesh of [...this.sections,...this.seats])mesh.dispose();this.geometry.dispose();this.material.dispose();this.seatGeometry.dispose();this.seatMaterial.dispose();this.root.clear();this.root.removeFromParent();}
}
