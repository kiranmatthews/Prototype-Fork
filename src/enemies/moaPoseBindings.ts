import * as THREE from 'three';

/** Bind the replacement surface to the original animation controls, without
 * changing their transforms, planted feet, procedural timing or attack tip. */
export function moaPoseBindings(body:THREE.Group):()=>Record<string,THREE.Matrix4> {
  const part=(name:string)=>body.getObjectByName(name)!;
  const nodes:Record<string,THREE.Object3D>={torso:part('Moa_TorsoSurface'),rump:part('Moa_Rump'),
    head:part('Moa_Head'),jaw:part('Moa_Jaw'),footLeft:part('Moa_FootLeft'),footRight:part('Moa_FootRight')};
  for(const [prefix,name]of [['upper','Moa_Thigh'],['lower','Moa_Shin'],['hock','Moa_Hock']] as const){
    const pair=body.children.filter(n=>n.name===name);nodes[`${prefix}Left`]=pair[0];nodes[`${prefix}Right`]=pair[1];
  }
  const brows:THREE.Object3D[]=[];body.traverse(n=>{if(n.name==='Heavy unimpressed brow')brows.push(n);});
  nodes.browLeft=brows[0];nodes.browRight=brows[1];
  const neck=(part('Moa_FlexibleNeck') as THREE.Mesh).geometry.attributes.position;
  const result:Record<string,THREE.Matrix4>={};for(const key of Object.keys(nodes))result[key]=new THREE.Matrix4();
  for(let i=0;i<8;i++)result[`neck${i}`]=new THREE.Matrix4();
  const inverse=new THREE.Matrix4(),centre=new THREE.Vector3(),next=new THREE.Vector3(),
    x=new THREE.Vector3(),y=new THREE.Vector3(),z=new THREE.Vector3(),sample=new THREE.Vector3();
  function ring(j:number,target:THREE.Vector3){target.set(0,0,0);for(let k=0;k<12;k++)target.add(sample.fromBufferAttribute(neck,j*13+k));return target.multiplyScalar(1/12);}
  return ()=>{
    inverse.copy(body.matrixWorld).invert();
    for(const [key,node]of Object.entries(nodes))result[key].multiplyMatrices(inverse,node.matrixWorld);
    for(let i=0;i<8;i++){
      const j=i*4;ring(j,centre);ring(i===7?j-4:j+4,next);
      y.subVectors(next,centre).normalize().multiplyScalar(i===7?-1:1);
      z.fromBufferAttribute(neck,j*13).sub(centre);const radius=z.length();z.normalize();
      x.crossVectors(y,z).normalize();y.crossVectors(z,x).normalize();x.multiplyScalar(radius);z.multiplyScalar(radius);
      result[`neck${i}`].makeBasis(x,y,z).setPosition(centre);
    }
    return result;
  };
}
