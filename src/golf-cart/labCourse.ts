import * as THREE from 'three';
import type { CartGround, CartObstacle, CartRoute, CartSpawn } from './physics';
import { bevelBox, placed, coloured, merged, strut } from './geometry';

export const LAB_OBSTACLES:CartObstacle[]=[
  {x:0,z:-25,radius:1.4,height:1.15,id:'impact-barrel'},{x:19,z:13,radius:.5,height:1.05,id:'cone-a'},{x:22,z:12,radius:.5,height:1.05,id:'cone-b'},
  ...[-27.5,-25.5,-23.5,-21.5,-19.5,-18.5].flatMap((x,i)=>[-28,-31.5].map((z,j)=>({x,z,radius:1.1,id:`clubhouse-${i}-${j}`}))),
  ...[[-18,-9],[11,-14],[-39,9],[38,-14],[-26,28],[33,25],[6,-34]].map(([x,z],i)=>({x,z,radius:.7,id:`tree-${i}`})),
];
const hill=(x:number,z:number)=>.55*Math.sin(x*.07)*Math.cos(z*.07)+.35*Math.sin(z*.14);
export const labGround:CartGround=(x,z)=>{
  const water=Math.hypot((x+6)/6,(z+4)/7)<1,sand=Math.hypot((x-12)/7,(z+7)/5)<1;
  const ramp=Math.abs(x-28)<4&&z>-5&&z<6?(6-z)*.16:0;
  return {height:hill(x,z)+ramp,grip:sand?.48:1,drag:sand?1.8:.06,safe:Math.abs(x)<55&&Math.abs(z)<43&&!water};
};
export const LAB_ROUTES:CartRoute[]=Array.from({length:5},(_,i)=>({speed:7.0+i*.65,points:Array.from({length:48},(_,j)=>{
  const a=j/48*Math.PI*2;return [Math.cos(a)*(29+(i%2)*1.5),Math.sin(a)*22] as const;
})}));
export const LAB_SPAWNS:CartSpawn[]=Array.from({length:5},(_,i)=>({x:-7+i*3.2,z:20+(i%2)*.5,yaw:0}));

export function buildLabCourse(scene:THREE.Scene){
  const root=new THREE.Group();root.name='CartTestCourse';scene.add(root);
  const terrain=new THREE.PlaneGeometry(114,90,114,90);terrain.rotateX(-Math.PI/2);const pos=terrain.attributes.position,colors=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),g=labGround(x,z);pos.setY(i,g.height-.018);
    const road=Math.abs(Math.hypot(x/29,z/22)-1)<.14,parking=Math.abs(x)<17&&z>15&&z<26,sand=g.drag>1,green=Math.hypot((x-4)/8,(z-6)/6)<1;
    const c=new THREE.Color(sand?'#e5bd75':road||parking?'#c5c28d':green?'#75b05a':Math.floor((x+z*.2)/4)%2===0?'#72a35a':'#6a9b53');
    colors.set([c.r,c.g,c.b],i*3);
  }
  terrain.setAttribute('color',new THREE.BufferAttribute(colors,3));terrain.computeVertexNormals();
  const turf=new THREE.Mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));turf.receiveShadow=true;root.add(turf);
  const pond=new THREE.Mesh(new THREE.CircleGeometry(1,36),new THREE.MeshStandardMaterial({color:'#3ca4af',roughness:.27,metalness:.12}));pond.rotation.x=-Math.PI/2;pond.scale.set(6.25,7.2,1);pond.position.set(-6,hill(-6,-4)+.08,-4);root.add(pond);
  const shore=new THREE.Mesh(new THREE.RingGeometry(.98,1.08,36),new THREE.MeshStandardMaterial({color:'#f2cd85',side:THREE.DoubleSide}));shore.rotation.copy(pond.rotation);shore.scale.copy(pond.scale);shore.position.copy(pond.position);shore.position.y-=.01;root.add(shore);
  const treeParts:THREE.BufferGeometry[]=[],propParts:THREE.BufferGeometry[]=[];
  for(const obstacle of LAB_OBSTACLES){
    const {x,z}=obstacle,y=labGround(x,z).height;
    if(obstacle.id.startsWith('clubhouse'))continue;
    if(obstacle.id.startsWith('tree')){
      treeParts.push(coloured(strut([x,y,z],[x+.25,y+3.2,z],.20,6),'#916947'));
      for(let i=0;i<3;i++)treeParts.push(coloured(new THREE.IcosahedronGeometry(1.75-i*.25,1).scale(1,.85,1).translate(x+(i%2?.45:-.25),y+2.7+i*.8,z+(i%2?-.25:.2)),['#3c7956','#539557','#72ab5c'][i]));
    }else if(obstacle.id.startsWith('cone')){
      propParts.push(coloured(new THREE.ConeGeometry(.4,1.05,6).translate(x,y+.525,z),'#ed7542'),coloured(placed(bevelBox(.85,.08,.85),[x,y+.04,z]),'#fff0bc'));
    }else{
      propParts.push(coloured(new THREE.CylinderGeometry(1.4,1.4,1.15,10).translate(x,y+.575,z),'#eb9450'));
      for(const h of [.2,.9])propParts.push(coloured(new THREE.CylinderGeometry(1.415,1.415,.10,10).translate(x,y+h,z),'#4c6663'));
    }
  }
  // A putting green, flag and clubhouse veranda make the playground read as a golf course.
  propParts.push(coloured(strut([4,labGround(4,6).height,6],[4,labGround(4,6).height+3,6],.035),'#fff0c9'));
  const flag=new THREE.BufferGeometry();flag.setAttribute('position',new THREE.Float32BufferAttribute([4,3.5,6,5.1,3.25,6,4,3,6],3));flag.computeVertexNormals();propParts.push(coloured(flag,'#ed6840'));
  propParts.push(coloured(placed(bevelBox(11,.35,6),[-23,labGround(-23,-29).height+.1,-29]),'#e0c99c'));
  propParts.push(coloured(placed(bevelBox(10.7,3.8,4.4),[-23,labGround(-23,-29).height+2,-30]),'#f3d7a3'));
  propParts.push(coloured(placed(bevelBox(12,.55,6.6),[-23,labGround(-23,-29).height+4.2,-29.5],[0,0,-.02]),'#ca6844'));
  for(const x of [-27,-24,-21,-18]){propParts.push(coloured(placed(bevelBox(1.4,1.6,.10),[x,2.3,-27.74]),'#396965'));}
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,flatShading:true});
  for(const parts of [treeParts,propParts]){const mesh=new THREE.Mesh(merged(parts),material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
  return root;
}
