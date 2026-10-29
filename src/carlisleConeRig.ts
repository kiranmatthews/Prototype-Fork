import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { characterElasticityAmplitudes } from './animation/elasticity';

const rest:Record<string,[number,number,number]>={
  Cone:[0,.36,0],
  LeftArm:[.161,.548,0],LeftForearm:[.266,.548,0],LeftHand:[.374,.535,0],
  RightArm:[-.161,.548,0],RightForearm:[-.266,.548,0],RightHand:[-.374,.535,0],
  LeftThigh:[.078,.335,0],LeftShin:[.125,.225,.006],LeftFoot:[.182,.105,0],
  RightThigh:[-.078,.335,0],RightShin:[-.125,.225,.006],RightFoot:[-.182,.105,0],
};
const vector=(p:readonly number[])=>new THREE.Vector3(...p as [number,number,number]);
const smooth=(a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);

/** Tailored to the original cone-shaped P1 surface. No torso, neck or humanoid
 * replacement mesh. Every source triangle and texture is retained. */
export function rigLiteralCone(asset:GLTF) {
  let original:THREE.Mesh|undefined;
  asset.scene.traverse(n=>{if((n as THREE.Mesh).isMesh)original=n as THREE.Mesh;});
  if(!original)throw new Error('Literal cone surface is missing');
  const geometry=original.geometry.clone();
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI/2));
  geometry.translate(0,.4677734375,0);
  const names=Object.keys(rest),bones=names.map(name=>{
    const bone=new THREE.Bone();bone.name=name;bone.position.copy(vector(rest[name]));bone.userData.literalConeRig=true;return bone;
  });
  const joints=new Uint16Array(geometry.attributes.position.count*4),weights=new Float32Array(joints.length),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),side=x>0?'Left':'Right',ax=Math.abs(x);
    let blend:Record<string,number>={Cone:1};
    if(y>.455&&ax>.143){
      const arm=smooth(.145,.181,ax),fore=smooth(.248,.282,ax),hand=smooth(.352,.39,ax);
      blend={Cone:1-arm,[side+'Arm']:arm*(1-fore),[side+'Forearm']:arm*fore*(1-hand),[side+'Hand']:arm*fore*hand};
    }else if(y<.344){
      const thigh=smooth(.316,.345,y),shin=1-smooth(.205,.247,y),foot=1-smooth(.105,.156,y);
      blend={Cone:thigh,[side+'Thigh']:(1-thigh)*(1-shin),[side+'Shin']:(1-thigh)*shin*(1-foot),[side+'Foot']:(1-thigh)*shin*foot};
    }
    Object.entries(blend).forEach(([name,weight],j)=>{joints[i*4+j]=names.indexOf(name);weights[i*4+j]=weight;});
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,original.material);mesh.name='Original cone with direct arms and legs';
  const scene=new THREE.Group();scene.name='Literal cone rig';scene.add(...bones,mesh);scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));asset.scene=scene;
  asset.animations=([['idle',3.2],['walk',1.25],['slash',2.8]] as const).map(([name,duration])=>bake(name,duration,names));
  original.geometry.dispose();
  return asset;
}

function bake(name:'idle'|'walk'|'slash',duration:number,names:string[]) {
  const frames=Math.ceil(duration*45),times:number[]=[],tracks:THREE.KeyframeTrack[]=[];
  const data=names.map(()=>({position:[] as number[],quaternion:[] as number[],scale:[] as number[]}));
  for(let i=0;i<=frames;i++){
    const t=i/frames*duration;times.push(t);
    const pose=conePose(name,t,duration);
    names.forEach((key,j)=>{data[j].position.push(...pose[key].p.toArray());data[j].quaternion.push(...pose[key].q.toArray());data[j].scale.push(...pose[key].s.toArray());});
  }
  names.forEach((key,i)=>{
    tracks.push(new THREE.VectorKeyframeTrack(key+'.position',times,data[i].position),new THREE.QuaternionKeyframeTrack(key+'.quaternion',times,data[i].quaternion),new THREE.VectorKeyframeTrack(key+'.scale',times,data[i].scale));
  });
  return new THREE.AnimationClip(name,duration,tracks);
}
type Pose=Record<string,{p:THREE.Vector3;q:THREE.Quaternion;s:THREE.Vector3}>;
function conePose(name:'idle'|'walk'|'slash',time:number,duration:number):Pose {
  const phase=time/duration,theta=phase*Math.PI*2;
  const tantrum=name==='slash'?(smooth(0,.16,phase)*(1-smooth(.72,1,phase))):0;
  const pulse=name==='slash'?Math.sin(phase*18*Math.PI)*tantrum:Math.sin(theta*(name==='walk'?2:1));
  const amp=characterElasticityAmplitudes(name==='slash'?'jump':name);
  const ratio=1+amp[0]*pulse*(name==='slash'?.40:.65);
  const lift=name==='walk'?Math.sin(theta*2)*.004:name==='slash'?-Math.abs(pulse)*.008:Math.sin(theta)*.002;
  const lean=name==='walk'?Math.sin(theta)*.035:name==='slash'?Math.sin(phase*12*Math.PI)*tantrum*.06:Math.sin(theta)*.022;
  const cone={p:vector(rest.Cone).add(new THREE.Vector3(0,lift,0)),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(.01+tantrum*.05,0,lean)),s:new THREE.Vector3(1/Math.sqrt(ratio),ratio,1/Math.sqrt(ratio))};
  const pose:Pose={Cone:cone},restCone=vector(rest.Cone);
  const attached=(p:readonly number[])=>vector(p).sub(restCone).multiply(cone.s).applyQuaternion(cone.q).add(cone.p);
  for(const [side,sign]of [['Left',1],['Right',-1]] as const){
    const swing=name==='walk'?Math.sin(theta+(sign<0?Math.PI:0)):0;
    const shoulder=attached(rest[side+'Arm']);
    const hand=new THREE.Vector3(sign*(.283+tantrum*.035),.38+tantrum*.245,.04+tantrum*.055+swing*.055);
    hand.y+=Math.sin(theta+sign*.5)*.004*(1-tantrum);
    const elbow=joint(shoulder,hand,vector(rest[side+'Arm']).distanceTo(vector(rest[side+'Forearm'])),vector(rest[side+'Forearm']).distanceTo(vector(rest[side+'Hand'])),new THREE.Vector3(sign,0,.65));
    limb(pose,side+'Arm',side+'Forearm',shoulder,elbow,amp[1]*pulse*.35);
    limb(pose,side+'Forearm',side+'Hand',elbow,hand,amp[2]*pulse*.35);
    pose[side+'Hand']={p:hand,q:pose[side+'Forearm'].q.clone(),s:new THREE.Vector3(1,1,1)};
    const hip=attached(rest[side+'Thigh']),foot=vector(rest[side+'Foot']);
    if(name==='walk'){foot.z+=swing*.065;foot.y+=Math.max(0,swing)*.047;}
    if(name==='slash'){
      const start=sign>0?.25:.47,t=(phase-start)/.18;
      if(t>0&&t<1){foot.y+=Math.sin(t*Math.PI)*.065;foot.z+=Math.sin(t*Math.PI)*.025;}
    }
    const knee=joint(hip,foot,vector(rest[side+'Thigh']).distanceTo(vector(rest[side+'Shin'])),vector(rest[side+'Shin']).distanceTo(vector(rest[side+'Foot'])),new THREE.Vector3(sign*.15,0,1));
    limb(pose,side+'Thigh',side+'Shin',hip,knee,0);
    limb(pose,side+'Shin',side+'Foot',knee,foot,0);
    // Independent sole bones cancel parent rotation/scale and keep planted boots flat.
    pose[side+'Foot']={p:foot,q:new THREE.Quaternion(),s:new THREE.Vector3(1,1,1)};
  }
  return pose;
}
function joint(a:THREE.Vector3,b:THREE.Vector3,l1:number,l2:number,pole:THREE.Vector3) {
  const axis=b.clone().sub(a),distance=axis.length();axis.normalize();
  const reach=Math.min(distance,(l1+l2)*.999),along=(l1*l1-l2*l2+reach*reach)/(2*reach);
  const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
  return a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
}
function limb(pose:Pose,name:string,end:string,a:THREE.Vector3,b:THREE.Vector3,elastic:number) {
  const before=vector(rest[end]).sub(vector(rest[name])),after=b.clone().sub(a);
  const ratio=after.length()/before.length(),cross=1+elastic;
  // Non-inherited segment volume response; endpoints and soles are independent bones.
  pose[name]={p:a,q:new THREE.Quaternion().setFromUnitVectors(before.normalize(),after.normalize()),s:new THREE.Vector3(ratio*cross,ratio,ratio*cross)};
}
