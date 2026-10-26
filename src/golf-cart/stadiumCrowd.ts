import * as THREE from 'three';
import { STADIUM,stadiumSections,stadiumPoint,cartRallyFrame } from '../levels/cart-stadium-layout';
import { coloured,merged,strut,placed } from './geometry';

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
  private seatMaterial=new THREE.MeshLambertMaterial({color:'#426d72'});
  constructor(){
    this.root.name='Stadium crowd · GPU cheering';
    const parts:THREE.BufferGeometry[]=[];
    const part=(g:THREE.BufferGeometry,color:string,cloth=0,arm=0)=>{
      g=coloured(g,color);g.setAttribute('crowdCloth',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(cloth),1));g.setAttribute('crowdArm',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(arm),1));parts.push(g);
    };
    part(placed(new THREE.CylinderGeometry(.23,.19,.55,6),[0,.79,0]),'#ffffff',1);
    part(placed(new THREE.IcosahedronGeometry(.205,1).scale(.84,1.13,.88),[0,1.27,-.04]),'#d9ac84');
    part(placed(new THREE.SphereGeometry(.21,8,4,0,Math.PI*2,0,Math.PI/2).scale(.9,.7,.95),[0,1.37,-.02]),'#403a33');
    for(const side of [-1,1]){
      part(strut([side*.12,.51,0],[side*.14,.47,-.28],.085,5),'#3e4551');
      part(strut([side*.14,.47,-.28],[side*.14,.10,-.32],.068,5),'#3e4551');
      part(placed(new THREE.BoxGeometry(.16,.12,.28),[side*.14,.065,-.38]),'#e9dfc5');
      part(strut([side*.22,1.02,0],[side*.39,1.30,-.02],.07,5),'#ffffff',1,side);
      part(strut([side*.39,1.30,-.02],[side*.43,1.59,-.07],.058,5),'#d9ac84',0,side);
      part(placed(new THREE.IcosahedronGeometry(.085,0),[side*.43,1.63,-.07]),'#d9ac84',0,side);
      part(placed(new THREE.BoxGeometry(.035,.038,.025),[side*.07,1.30,-.211]),'#302b2a');
    }
    this.geometry=merged(parts);this.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.9,0),1.2);
    this.material=new THREE.MeshLambertMaterial({vertexColors:true});
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.crowdTime=this.time;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nuniform float crowdTime; attribute float crowdCloth; attribute float crowdArm;`)
        .replace('#include <color_vertex>',`#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nvColor.rgb = color * mix(vec3(1.0), instanceColor, crowdCloth);\n#endif`)
        .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>\nfloat crowdPhase = dot(instanceMatrix[3].xz, vec2(.731,.193));\nfloat cheer = (.25*sin(crowdTime*3.4+crowdPhase)+.12*sin(crowdTime*5.1+crowdPhase*1.7))*abs(crowdArm);\nmat2 cheerRotation = mat2(cos(cheer),sin(cheer),-sin(cheer),cos(cheer));\nobjectNormal.xy = cheerRotation*objectNormal.xy;`)
        .replace('#include <begin_vertex>',`#include <begin_vertex>\nvec2 shoulder = vec2(crowdArm*.22,1.02);\ntransformed.xy = shoulder + cheerRotation*(transformed.xy-shoulder);`);
    };
    this.material.customProgramCacheKey=()=> 'stadium-spectators-v1';
    this.seatGeometry=merged([placed(new THREE.BoxGeometry(.67,.11,.5),[0,.45,.02]),placed(new THREE.BoxGeometry(.67,.48,.11),[0,.69,.26])]);
    const dummy=new THREE.Object3D(),palette=['#ed754a','#4bafb4','#edc35b','#799cda','#eee3c4','#a16dba','#e4979d'],color=new THREE.Color();let total=0;
    for(const {start,end,side}of stadiumSections()){
      const positions:{s:number;row:number;column:number}[]=[];
      for(let row=0;row<STADIUM.rows;row++)for(let col=0;col<Math.floor((end-start-2)/STADIUM.seatSpacing);col++)if(col%13!==12)positions.push({s:start+1+col*STADIUM.seatSpacing,row,column:col});
      const people=new THREE.InstancedMesh(this.geometry,this.material,positions.length),seats=new THREE.InstancedMesh(this.seatGeometry,this.seatMaterial,positions.length);
      people.name=`Cheering section ${side}:${start}`;seats.name=`Grandstand seats ${side}:${start}`;
      for(const [index,{s,row,column}]of positions.entries()){
        const f=cartRallyFrame(s),p=stadiumPoint(s,side*(STADIUM.standStart+(row+.5)*STADIUM.rowDepth),15.5+row*STADIUM.rowRise);
        dummy.position.set(...p);dummy.rotation.set(0,Math.atan2(side*f.nx,side*f.nz),0);dummy.scale.setScalar(1);dummy.updateMatrix();seats.setMatrixAt(index,dummy.matrix);
        const seed=Math.abs(Math.sin(s*12.989+row*78.233)*43758.5453)%1;
        dummy.scale.setScalar(.92+seed*.15);dummy.updateMatrix();people.setMatrixAt(index,dummy.matrix);people.setColorAt(index,color.set(palette[(column*3+row*5+Math.floor(seed*11))%palette.length]));
      }
      // Bounds include the full arm sweep; native frustum culling operates per
      // 48m stand section, including reflections, without changing silhouettes.
      people.computeBoundingSphere();seats.computeBoundingSphere();people.castShadow=false;seats.castShadow=false;
      this.root.add(people,seats);this.sections.push(people);this.seats.push(seats);total+=positions.length;
    }
    this.count=total;this.root.userData={spectators:total,sections:this.sections.length,animation:'GPU vertex arms',cpuPerFrame:'one time uniform',lod:false};
  }
  update(time:number){this.time.value=time;}
  dispose(){for(const mesh of [...this.sections,...this.seats])mesh.dispose();this.geometry.dispose();this.material.dispose();this.seatGeometry.dispose();this.seatMaterial.dispose();this.root.clear();this.root.removeFromParent();}
}
