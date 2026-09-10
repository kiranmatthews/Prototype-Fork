import * as THREE from "three";

const PROFILE: readonly (readonly [number,number])[] = [
  [0,-.17],[.045,.22],[.18,.92],[.42,1.28],[.72,1.38],[1.2,1.14],[2.2,.68],[3.4,.36],[4.2,.3],
];
export function jungleShoulderHeight(distanceFromInner: number, z: number): number {
  let height=.3;
  for(let i=0;i<PROFILE.length-1;i++) {
    const a=PROFILE[i],b=PROFILE[i+1];
    if(distanceFromInner<=b[0]) {height=THREE.MathUtils.lerp(a[1],b[1],THREE.MathUtils.clamp((distanceFromInner-a[0])/(b[0]-a[0]),0,1));break;}
  }
  return height + (Math.sin(z*.61)*.085+Math.sin(z*1.19)*.035)*Math.max(0,1-Math.abs(distanceFromInner-.8)/2.5);
}

/** Rounded earthen shoulder. Gameplay retains the established berm collision/rail path. */
export function createJungleShoulder(z0:number,z1:number,baseY:number,width:number,cx:number,
    spine:(z:number)=>{dx:number;dy:number},side:number):THREE.BufferGeometry {
  const near=Math.max(z0,z1),depth=Math.abs(z1-z0),rows=Math.max(2,Math.ceil(depth/1.75));
  const pos:number[]=[],uv:number[]=[],idx:number[]=[],trail:number[]=[];
  for(let row=0;row<=rows;row++) {
    const z=near-depth*row/rows,sp=spine(z);
    const edge=Math.min(1,Math.min(row,rows-row)*.5);
    for(const [offset,height] of PROFILE) {
      const rounded=jungleShoulderHeight(offset,z);
      pos.push(cx+sp.dx+side*(width/2-.9+offset),baseY+sp.dy+THREE.MathUtils.lerp(height,rounded,edge),z);
      uv.push(offset/7,z/7);
      trail.push(side*(width/2-.9+offset),width/2);
    }
  }
  const columns=PROFILE.length;
  for(let row=0;row<rows;row++)for(let c=0;c<columns-1;c++) {
    const a=row*columns+c,b=a+1,d=a+columns+1,e=a+columns;
    if(side>0)idx.push(a,b,e,b,d,e);else idx.push(a,e,b,b,e,d);
  }
  // Close the exposed ends at cuts in the ground, with no open mesh edge.
  for(const row of [0,rows]) {
    const start=row*columns,z=pos[start*3+2],sp=spine(z),anchor=pos.length/3;
    pos.push(cx+sp.dx+side*(width/2+3.3),baseY+sp.dy-.2,z);uv.push(0,0);
    trail.push(side*(width/2+3.3),width/2);
    for(let c=0;c<columns-1;c++) {
      if((row===0)===(side>0))idx.push(anchor,start+c,start+c+1);else idx.push(anchor,start+c+1,start+c);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('aJungleTrail',new THREE.Float32BufferAttribute(trail,2));
  geometry.setIndex(idx);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

/** Fade the deep scenery after fog so the bottom of a death pit stays black. */
export function addJungleDepthFade(material: THREE.Material): void {
  if(material.userData.levelDepthFade === false || material.userData.jungleDepthFade)return;
  material.userData.jungleDepthFade=true;
  const previous=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader='varying float vJungleDepthY;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 jungleDepthPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        jungleDepthPosition = instanceMatrix * jungleDepthPosition;
      #endif
      vJungleDepthY = (modelMatrix * jungleDepthPosition).y;
      #include <project_vertex>
    `);
    shader.fragmentShader='varying float vJungleDepthY;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`
      #include <fog_fragment>
      gl_FragColor.rgb *= smoothstep(-10.0, -4.2, vJungleDepthY);
    `);
  };
  material.customProgramCacheKey=()=>previousKey()+'|jungle-depth-v1';
}
