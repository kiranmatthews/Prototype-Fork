import * as THREE from 'three';

export interface GhostClockwork {
  group: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

/** An original clockwork stage prop. Y-up, +Z-facing, foot at Y=0; yaw is
 * expressed in the level toolkit's degrees. All resources belong to this prop. */
export function createGhostClockwork(size:[number,number,number]=[6,7,3],yaw=0):GhostClockwork {
  const group=new THREE.Group();group.name='Ghost castle bronze clockwork tableau';
  group.userData.ghostClockwork=true;
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  const makeMaterial=(color:number,metalness:number,roughness:number)=>{
    const material=new THREE.MeshStandardMaterial({color,metalness,roughness,flatShading:true});
    materials.add(material);return material;
  };
  const bronze=makeMaterial(0xc49b56,.58,.40),edge=makeMaterial(0x745030,.46,.65);
  const steel=makeMaterial(0xb9c5ca,.64,.35),iron=makeMaterial(0x343c47,.40,.69);
  const wornGold=makeMaterial(0xe1c381,.51,.42);
  const own=(shape:THREE.BufferGeometry)=>{geometry.add(shape);return shape;};
  const mesh=(shape:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],parent:THREE.Object3D,name:string)=>{
    const result=new THREE.Mesh(own(shape),material);result.name=name;result.castShadow=true;result.receiveShadow=true;parent.add(result);return result;
  };
  const box=(parent:THREE.Object3D,dimensions:[number,number,number],p:[number,number,number],material:THREE.Material,name:string)=>{
    const result=mesh(new THREE.BoxGeometry(...dimensions),material,parent,name);result.position.set(...p);return result;
  };
  const cylinder=(parent:THREE.Object3D,radius:number,length:number,p:[number,number,number],material:THREE.Material,name:string,axis:'y'|'z'='z')=>{
    const result=mesh(new THREE.CylinderGeometry(radius,radius,length,12),material,parent,name);
    if(axis==='z')result.rotation.x=Math.PI/2;result.position.set(...p);return result;
  };
  const beam=(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,width:number,depth:number,material:THREE.Material,name:string)=>{
    const result=mesh(new THREE.BoxGeometry(width,a.distanceTo(b),depth),material,parent,name);
    result.position.copy(a).add(b).multiplyScalar(.5);result.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return result;
  };
  function gear(radius:number,teeth:number,p:[number,number,number],spokes:number,name:string):THREE.Group {
    const root=new THREE.Group();root.name=name;root.position.set(...p);group.add(root);
    const shape=new THREE.Shape(),step=Math.PI*2/teeth;
    for(let tooth=0;tooth<teeth;tooth++)for(const [fraction,r]of [[0,.89],[.21,1],[.73,1],[.94,.89]] as const){
      const angle=(tooth+fraction)*step,x=Math.cos(angle)*radius*r,y=Math.sin(angle)*radius*r;
      if(tooth===0&&fraction===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
    shape.closePath();const hole=new THREE.Path();hole.absarc(0,0,radius*.65,0,Math.PI*2,true);shape.holes.push(hole);
    const ring=mesh(new THREE.ExtrudeGeometry(shape,{depth:.31,bevelEnabled:true,bevelThickness:.026,bevelSize:.035,bevelSegments:1,curveSegments:16}),[bronze,edge],root,'Chunky individually cut bronze gear teeth');ring.position.z=-.155;
    cylinder(root,radius*.205,.46,[0,0,.04],iron,'Iron bearing hub');
    cylinder(root,radius*.155,.48,[0,0,.085],wornGold,'Raised bronze bearing collar');
    cylinder(root,radius*.075,.62,[0,0,.12],steel,'Polished exposed axle');
    for(let i=0;i<spokes;i++){
      const angle=i*Math.PI*2/spokes,spoke=box(root,[radius*.65,radius*.09,.22],[Math.cos(angle)*radius*.445,Math.sin(angle)*radius*.445,.01],i%2?bronze:wornGold,'Faceted open wheel spoke');spoke.rotation.z=angle;
    }
    const bolts=own(new THREE.CylinderGeometry(radius*.026,radius*.026,.075,6));bolts.rotateX(Math.PI/2);
    const instances=new THREE.InstancedMesh(bolts,steel,spokes);instances.name='Hexagonal spoke rivets';instances.castShadow=true;root.add(instances);
    for(let i=0;i<spokes;i++){
      const angle=i*Math.PI*2/spokes;instances.setMatrixAt(i,new THREE.Matrix4().makeTranslation(Math.cos(angle)*radius*.74,Math.sin(angle)*radius*.74,.19));
    }
    instances.instanceMatrix.needsUpdate=true;return root;
  }

  const main=gear(2.5,20,[-.55,3.38,.15],6,'Slow indexed bronze great wheel');
  const companion=gear(1.25,10,[1.85,6.06,.10],5,'Counter-rotating upper gear');
  // Open dark iron supports make the teeth and spokes read as a silhouette.
  box(group,[6.25,.28,2.5],[0,.14,-.22],iron,'Heavy clockwork bedplate');
  box(group,[6.35,.08,2.6],[0,.32,-.22],edge,'Bronze bedplate edge');
  for(const side of [-1,1]){
    box(group,[.22,6.9,.30],[side*2.92,3.79,-.77],iron,'Riveted clockwork vertical frame');
    box(group,[.45,.48,.55],[side*2.92,.58,-.77],bronze,'Bronze frame foot socket');
    box(group,[.42,.36,.53],[side*2.92,7.08,-.77],bronze,'Upper frame joint');
  }
  box(group,[6.0,.23,.34],[0,7.12,-.77],iron,'Counterweight suspension crosshead');
  box(group,[5.9,.20,.32],[0,1.13,-.77],iron,'Lower bearing frame tie');
  beam(group,new THREE.Vector3(-2.82,1.22,-.78),new THREE.Vector3(-1.75,2.15,-.78),.16,.24,edge,'Lower diagonal frame brace');
  beam(group,new THREE.Vector3(2.82,1.22,-.78),new THREE.Vector3(1.78,2.15,-.78),.16,.24,edge,'Lower diagonal frame brace');
  cylinder(group,.20,1.9,[-.55,3.38,-.52],steel,'Long great-wheel driveshaft');
  cylinder(group,.24,.45,[-.55,3.38,-1.12],iron,'Rear driveshaft bearing');
  const crank=new THREE.Group();crank.name='Indexed drive crank';crank.position.set(-.55,3.38,.72);group.add(crank);
  box(crank,[.18,1.02,.12],[0,-.43,0],wornGold,'Drive crank arm');cylinder(crank,.11,.16,[0,-.88,.05],steel,'Crank pin');

  const pistons:{rod:THREE.Mesh;head:THREE.Mesh;base:number;offset:number}[]=[];
  for(const side of [-1,1]){
    const x=side*2.50;
    cylinder(group,.20,1.0,[x,.92,.92],iron,'Heavy vertical piston sleeve','y');
    cylinder(group,.235,.12,[x,1.43,.92],bronze,'Piston sleeve collar','y');
    const rod=cylinder(group,.075,.85,[x,1.85,.92],steel,'Telescoping steel piston rod','y');
    const head=box(group,[.33,.16,.32],[x,2.27,.92],bronze,'Piston crosshead');
    pistons.push({rod,head,base:1.43,offset:side<0?0:.5});
  }
  const weight=new THREE.Group();weight.name='Slow lifting iron counterweight';weight.position.set(2.55,2.30,-.12);group.add(weight);
  box(weight,[.70,1.10,.67],[0,0,0],iron,'Suspended iron counterweight block');
  for(const y of [-.40,0,.40])box(weight,[.74,.08,.71],[0,y,0],edge,'Counterweight bronze binding');
  const suspension=cylinder(group,.035,3.8,[2.55,5.0,-.12],steel,'Taut counterweight cable','y');
  for(const x of [2.05,2.97])box(group,[.065,5.85,.10],[x,3.93,-.17],steel,'Counterweight guide rail');
  group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group),span=bounds.getSize(new THREE.Vector3());
  group.scale.set(size[0]/span.x,size[1]/span.y,size[2]/span.z);
  group.rotation.y=THREE.MathUtils.degToRad(yaw);
  group.userData.ghostClockworkDimensions={size:[...size],greatWheelRadius:2.5,teeth:[20,10],motion:'Finite indexed gear advances, opposed piston holds and lifting counterweight'};

  const ease=(value:number)=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};
  const lift=(phase:number)=>phase<.22?ease(phase/.22):phase<.53?1:phase<.76?1-ease((phase-.53)/.23):0;
  let released=false;
  function update(time:number):void {
    if(released)return;const t=Math.max(0,Number.isFinite(time)?time:0),index=t/1.90;
    const turn=(Math.floor(index)+ease((index%1)/.16))*Math.PI*2/20;
    main.rotation.z=-turn;companion.rotation.z=turn*2+Math.PI/10;crank.rotation.z=-turn;
    for(const piston of pistons){
      const extension=.62+lift((t/4.4+piston.offset)%1)*.95;
      piston.rod.scale.y=extension/.85;piston.rod.position.y=piston.base+extension/2;piston.head.position.y=piston.base+extension;
    }
    weight.position.y=2.1+lift((t/7.6+.17)%1)*2.3;
    const lower=weight.position.y+.55,upper=7.0; suspension.position.y=(lower+upper)/2;suspension.scale.y=(upper-lower)/3.8;
  }
  update(0);
  return {group,update,dispose(){if(released)return;released=true;for(const owned of geometry)owned.dispose();for(const material of materials)material.dispose();group.removeFromParent();group.clear();}};
}
