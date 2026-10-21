import * as THREE from 'three';

/** Paint only the two disconnected eye surfaces of the existing Meshy turtle.
 * Bind-space coordinates keep the ink attached through skinning and elasticity.
 * The original mesh, texture maps and living face remain untouched. */
function eyeCoordinates(geometry:THREE.BufferGeometry):THREE.BufferAttribute|null {
  const cached=geometry.getAttribute('turtleEye') as THREE.BufferAttribute|undefined;
  if(cached)return cached;
  const p=geometry.getAttribute('position'),index=geometry.index;
  if(!p||!index)return null;
  const parent=Array.from({length:p.count},(_,i)=>i),weld=new Map<string,number>();
  const find=(v:number):number=>{while(parent[v]!==v){parent[v]=parent[parent[v]];v=parent[v];}return v;};
  const join=(a:number,b:number)=>{parent[find(a)]=find(b);};
  for(let i=0;i<p.count;i++){
    const key=`${Math.round(p.getX(i)*1e5)},${Math.round(p.getY(i)*1e5)},${Math.round(p.getZ(i)*1e5)}`;
    const other=weld.get(key);if(other!==undefined)join(i,other);else weld.set(key,i);
  }
  for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
  const pieces=new Map<number,number[]>();
  for(let i=0;i<p.count;i++){const key=find(i),part=pieces.get(key);if(part)part.push(i);else pieces.set(key,[i]);}
  const data=new Float32Array(p.count*3);let eyes=0;
  for(const vertices of pieces.values()){
    const bounds=new THREE.Box3(),point=new THREE.Vector3();
    for(const i of vertices)bounds.expandByPoint(point.fromBufferAttribute(p,i));
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    // Measured original eyeballs: X ±.09, Y .411, Z .514, about .137 m wide.
    if(vertices.length<150||vertices.length>300||Math.abs(Math.abs(center.x)-.09)>.015||
      Math.abs(center.y-.411)>.015||Math.abs(center.z-.514)>.015||size.x>.15)continue;
    // Centre on the visible original pupils, not the partly buried globe.
    const pupilX=center.x>0?.108:-.104,pupilY=center.x>0?.402:.404;
    for(const i of vertices){
      data[i*3]=(p.getX(i)-pupilX)/(.5*size.x);
      data[i*3+1]=(p.getY(i)-pupilY)/(.5*size.y);
      data[i*3+2]=1;
    }
    eyes++;
  }
  if(eyes!==2)return null; // Custom fixture/art: never paint unrelated surfaces.
  const attribute=new THREE.BufferAttribute(data,3);geometry.setAttribute('turtleEye',attribute);
  return attribute;
}

export function createTurtleShellEyes(model:THREE.Object3D):{setDefeated(value:boolean):void}|undefined {
  const enabled={value:0},patched=new Set<THREE.Material>();
  model.traverse(object=>{
    const mesh=object as THREE.Mesh;
    if(!mesh.isMesh||!eyeCoordinates(mesh.geometry))return;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      if(patched.has(material))continue;patched.add(material);
      const before=material.onBeforeCompile,key=material.customProgramCacheKey();
      material.onBeforeCompile=(shader,renderer)=>{
        before.call(material,shader,renderer);shader.uniforms.turtleDefeated=enabled;
        shader.vertexShader='attribute vec3 turtleEye; varying vec3 vTurtleEye;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvTurtleEye=turtleEye;');
        shader.fragmentShader='uniform float turtleDefeated; varying vec3 vTurtleEye;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec2 eye=abs(vTurtleEye.xy);
          float aa=max(fwidth(eye.x)+fwidth(eye.y),.015);
          float crossInk=(1.-smoothstep(.135-aa,.135+aa,abs(eye.x-eye.y)))
            *(1.-smoothstep(.58-aa,.58+aa,max(eye.x,eye.y)));
          vec3 eyePaint=mix(vec3(.88,.85,.73),vec3(.012,.008,.006),crossInk);
          diffuseColor.rgb=mix(diffuseColor.rgb,eyePaint,turtleDefeated*step(.5,vTurtleEye.z));
        `);
      };
      material.customProgramCacheKey=()=>key+'|turtle-x-eyes-v1';material.needsUpdate=true;
      material.userData.turtleDefeatedEyes=enabled;
    }
  });
  return patched.size?{setDefeated(value){enabled.value=value?1:0;}}:undefined;
}
