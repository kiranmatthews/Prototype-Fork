import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

/** Fixed, textureless asset cache: twelve silhouettes, one opaque draw per item.
 * Instances never mutate these buffers; removing a projectile cannot dispose a
 * second rider's model. The bounded cache lives as long as the other game assets. */
const models = new Map<string, THREE.BufferGeometry>();
const shared = new Set<THREE.BufferGeometry | THREE.Material>();
function gouraud(glass=false):THREE.MeshBasicMaterial {
  const material=new THREE.MeshBasicMaterial({vertexColors:!glass,color:glass?0x79e7ff:0xffffff,
    side:glass?THREE.FrontSide:THREE.DoubleSide,transparent:glass,opacity:glass?.8:1,depthWrite:!glass});
  material.name=glass?'Power-up / Gouraud bubble':'Power-up / Gouraud enamel';
  material.userData.gouraud=true;material.forceSinglePass=true;
  material.onBeforeCompile=shader=>{
    // Key, sky fill, specular and glass rim are evaluated only at vertices.
    // The fragment shader merely interpolates/multiplies colour; no lights,
    // textures, normal maps, bloom or screen-sized passes are needed.
    shader.vertexShader='varying vec3 vItemLight;\nvarying float vItemRim;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 itemN = normalize(normalMatrix * normal);
      vec3 itemV = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);
      float itemKey = max(0.0, dot(itemN, normalize(vec3(-0.45, 0.8, 0.7))));
      float itemSky = itemN.y * 0.5 + 0.5;
      float itemShine = pow(max(0.0, dot(itemN, normalize(vec3(-0.4, 0.9, 1.8)))), 18.0);
      vItemLight = mix(vec3(0.38, 0.43, 0.59), vec3(0.74, 0.79, 0.86), itemSky) + vec3(0.5, 0.43, 0.31) * itemKey + itemShine * 0.42;
      vItemRim = pow(1.0 - abs(dot(itemN, itemV)), 2.0);
    `);
    shader.fragmentShader='varying vec3 vItemLight;\nvarying float vItemRim;\n'+shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb *= vItemLight;'+(glass?'\ndiffuseColor.a *= 0.045 + vItemRim * 0.9;':''));
  };
  material.customProgramCacheKey=()=>glass?'race-gouraud-glass-v1':'race-gouraud-enamel-v1';
  return material;
}
const enamel=gouraud();shared.add(enamel);
let bubbleGeometry:THREE.SphereGeometry|undefined;

function sculpt(kind:string):THREE.BufferGeometry {
  const pieces:THREE.BufferGeometry[]=[];
  const cream=0xfff2c8,ink=0x202637,gold=0xffcf31,white=0xf5ffff;
  const add=(geometry:THREE.BufferGeometry,color:number,x=0,y=0,z=0,scale:[number,number,number]=[1,1,1],rotation:[number,number,number]=[0,0,0])=>{
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));
    geometry.applyMatrix4(matrix);let g=geometry;
    if(g.index){g=geometry.toNonIndexed();geometry.dispose();}
    g.deleteAttribute('uv');const rgb=new THREE.Color(color),positions=g.getAttribute('position'),values=new Float32Array(positions.count*3);
    // Very gentle baked underside occlusion retains depth in an unlit scene.
    for(let i=0;i<positions.count;i++){const shade=.9+.1*THREE.MathUtils.clamp((positions.getY(i)+.65)/1.8,0,1);values[i*3]=rgb.r*shade;values[i*3+1]=rgb.g*shade;values[i*3+2]=rgb.b*shade;}
    g.setAttribute('color',new THREE.BufferAttribute(values,3));pieces.push(g);
  };
  const sphere=(r:number,color:number,x=0,y=0,z=0,scale:[number,number,number]=[1,1,1])=>add(new THREE.SphereGeometry(r,12,8),color,x,y,z,scale);
  const ring=(r:number,tube:number,color:number,x=0,y=0,z=0,rotation:[number,number,number]=[Math.PI/2,0,0])=>add(new THREE.TorusGeometry(r,tube,5,24),color,x,y,z,[1,1,1],rotation);
  const extrude=(shape:THREE.Shape,depth=.2)=>new THREE.ExtrudeGeometry(shape,{depth,curveSegments:6,bevelEnabled:true,bevelSize:.045,bevelThickness:.04,bevelSegments:1});
  const eyes=(y:number,z:number,separation=.19)=>{for(const side of [-1,1]){sphere(.095,ink,side*separation,y,z,[.62,1.55,.48]);sphere(.029,white,side*separation-.015,y+.045,z+.04,[.8,1,1]);}};
  if(kind.startsWith('rally-coconut-')){
    const band=kind.endsWith('red')?0xf2484b:kind.endsWith('blue')?0x3b9bff:0x7adf46;
    add(new THREE.SphereGeometry(.9,28,18),0x975726,0,.1,0,[1,1.06,1]);
    for(let i=0;i<7;i++)ring(.89,.018,0x613a20,0,.1,0,[Math.PI/2,i*Math.PI/7,0]);
    ring(.9,.09,band,0,.2);eyes(.36,.86,.23);
    sphere(.11,ink,0,.02,.88,[1.7,.55,.4]);
    add(new THREE.CylinderGeometry(.045,.05,.5,8),cream,.06,1.25,0,[1,1,1],[0,0,-.3]);
    sphere(.13,0xffa125,.14,1.5,0);sphere(.07,0xfff6a7,.15,1.53,.04);
    if(kind.endsWith('blue'))for(const side of [-1,1]){
      add(new THREE.ConeGeometry(.42,1.1,12),cream,side*1.1,.55,0,[1,.5,1],[0,0,side*-1]);
    }
  }else if(kind==='banana'){
    for(let petal=0;petal<3;petal++){
      const angle=petal*Math.PI*2/3,vertices:number[]=[],indices:number[]=[];
      // Four vertices across each petal form an actual curved, thick peel,
      // with a raised pale inner ridge instead of intersecting flat ribbons.
      for(let i=0;i<=10;i++){
        const t=i/10,r=.07+t*1.14,y=.7*(1-t)**2+.045+.18*t**5,w=.018+.3*Math.sin(Math.PI*t)**.7;
        for(const [side,height] of [[-1,0],[0,.08*Math.sin(Math.PI*t)],[1,0],[0,-.07]])vertices.push(Math.cos(angle)*r-Math.sin(angle)*w*side,y+height,Math.sin(angle)*r+Math.cos(angle)*w*side);
        if(i)for(let j=0;j<4;j++){const a=(i-1)*4+j,b=(i-1)*4+(j+1)%4;indices.push(a,a+4,b,b,a+4,b+4);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();add(geometry,petal===1?0xffe76a:gold);
      sphere(.07,0x84512b,Math.cos(angle)*1.2,.225,Math.sin(angle)*1.2,[1,.6,1]);
    }
    add(new THREE.CylinderGeometry(.1,.19,.48,10),gold,0,.77);sphere(.115,0x68452d,0,1.02,0,[1,.4,1]);eyes(.75,.15,.075);
  }else if(kind==='mushroom'){
    sphere(.48,cream,0,-.06,0,[.84,1.05,.8]);
    add(new THREE.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI/2),0xef403b,0,.25,0,[1,.77,1]);
    add(new THREE.CylinderGeometry(.98,.88,.12,20),0xffe3ac,0,.25);
    ring(.92,.045,0xbd2735,0,.32);
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5,x=Math.sin(a)*.7,z=Math.cos(a)*.7;
      const g=new THREE.SphereGeometry(.23,10,6);g.scale(1,.13,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(x,1,z).normalize()));add(g,white,x,.79,z);
    }
    sphere(.24,cream,0,1.02,0,[1,.1,1]);eyes(-.04,.36,.14);
  }else if(kind==='water-bomb'){
    add(new THREE.SphereGeometry(.76,16,10),0x35cbe7,0,-.04,0,[1,1.08,1]);
    add(new THREE.ConeGeometry(.19,.3,8),0xfc9056,0,.88,0,[1,1,1],[0,0,Math.PI]);ring(.14,.045,cream,0,.99);
    sphere(.21,white,-.28,.43,.58,[.42,1.15,.13]);sphere(.085,0xc6fcff,.38,-.24,.65,[.65,1.2,.18]);
    for(const side of [-1,1])add(new THREE.ConeGeometry(.13,.32,6),0xffba64,side*.15,.99,0,[1,1,.55],[0,0,side*.9]);
  }else if(kind==='boomerang'){
    const shape=new THREE.Shape();shape.moveTo(-1,.6);shape.lineTo(-.72,.82);shape.quadraticCurveTo(-.2,.12,0,.03);shape.quadraticCurveTo(.2,.12,.72,.82);shape.lineTo(1,.6);shape.quadraticCurveTo(.25,-.48,0,-.4);shape.quadraticCurveTo(-.25,-.48,-1,.6);
    add(extrude(shape,.12),0xa75a2c,0,0,0,[1,1,1],[-Math.PI/2,0,0]);
    add(extrude(shape,.035),0xf5b94e,0,.13,0,[.93,.93,1],[-Math.PI/2,0,0]);
    for(const side of [-1,1]){
      add(new THREE.BoxGeometry(.23,.04,.34),0xef553b,side*.74,.215,-.59,[1,1,1],[0,side*-.6,0]);
      add(new THREE.BoxGeometry(.085,.045,.31),cream,side*.58,.216,-.39,[1,1,1],[0,side*-.6,0]);
    }
    sphere(.1,0x1d838e,0,.22,.07,[1,.3,1]);
  }else if(kind==='star'){
    const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.45:1,x=Math.sin(a)*r,y=Math.cos(a)*r;if(i)shape.lineTo(x,y);else shape.moveTo(x,y);}shape.closePath();
    add(extrude(shape,.24),0xffad1e,0,0,-.16);
    add(extrude(shape,.04),0xffe56a,0,0,.12,[.88,.88,1]);eyes(.05,.23,.18);
  }else if(kind==='tidal-wave'){
    const wave=new THREE.Shape();wave.moveTo(-1.05,-.55);wave.bezierCurveTo(-1.3,.65,-.4,1.15,.35,1.05);wave.bezierCurveTo(1.1,.96,1.15,.3,.75,.06);wave.quadraticCurveTo(.88,.73,.3,.62);wave.quadraticCurveTo(-.2,.39,.3,-.33);wave.lineTo(1.05,-.55);wave.closePath();
    add(extrude(wave,.42),0x087fba,0,0,-.22);
    add(extrude(wave,.045),0x35d9dc,0,.02,.24,[.92,.94,1]);
    for(let i=0;i<8;i++){const a=-.55+i*.31;sphere(.16,white,.28+Math.sin(a)*.66,.38+Math.cos(a)*.65,.29,[1.2,.7,1]);}
    for(let i=0;i<3;i++)sphere(.065,0xd0fdff,.7+i*.16,.8-i*.19,.33);
  }else if(kind==='horn'){
    add(new THREE.CylinderGeometry(.4,.43,.77,12),0xde3b3f,-.38,-.16);
    ring(.4,.065,cream,-.38,-.52);ring(.38,.045,0xff9865,-.38,.16);
    add(new THREE.CylinderGeometry(.73,.19,1.05,16,1,true),0xf7ab35,.19,.3,0,[1,1,1],[0,0,-Math.PI/2]);
    add(new THREE.CylinderGeometry(.54,.13,.68,16,1,true),0xb66a28,.31,.3,0,[1,1,1],[0,0,-Math.PI/2]);
    add(new THREE.CircleGeometry(.14,12),ink,-.04,.3,0,[1,1,1],[0,Math.PI/2,0]);
    ring(.72,.085,cream,.72,.3,0,[0,Math.PI/2,0]);
    add(new THREE.CylinderGeometry(.16,.12,.16,10),ink,-.38,.3);sphere(.14,0x74e1de,-.38,.4,0,[1,.32,1]);
    add(new THREE.BoxGeometry(.32,.19,.04),cream,-.38,-.17,.4);
  }else if(kind==='shock-shell'){
    for(const [x,y,r,color] of [[-.48,.57,.4,0x61758e],[0,.78,.53,0x8293ab],[.48,.56,.4,0x526782]])sphere(r,color,x,y,0,[1,.85,.8]);
    const bolt=new THREE.Shape();bolt.moveTo(.24,.63);bolt.lineTo(-.55,-.18);bolt.lineTo(-.08,-.18);bolt.lineTo(-.35,-1.03);bolt.lineTo(.64,.05);bolt.lineTo(.14,.05);bolt.closePath();
    add(extrude(bolt,.13),gold,0,0,.33);add(extrude(bolt,.025),0xfff5b0,0,0,.51,[.72,.84,1]);
  }else if(kind==='shield'){
    ring(.89,.033,0xc1faff,0,0,0,[.25,-.35,0]);
    ring(.88,.024,0x4eb8ef,0,0,0,[1.25,.55,.4]);
    sphere(.13,white,-.36,.46,.65,[.4,1.5,.17]);sphere(.055,white,-.48,.21,.71);
  }else{
    const colors:Record<string,number>={'green-shell':0x34bb66,'red-shell':0xf04443,'blue-shell':0x287cec};
    const color=colors[kind];if(color===undefined)throw new Error(`Unknown race item model: ${kind}`);
    const dark=new THREE.Color(color).multiplyScalar(.46).getHex();
    add(new THREE.CylinderGeometry(.87,.92,.18,18),0xd0a667,0,-.08);ring(.9,.1,cream,0,.025);
    add(new THREE.SphereGeometry(.91,18,10,0,Math.PI*2,0,Math.PI/2),dark,0,.08,0,[1,.74,1]);
    // Conform hexagonal panels to the dome. Flat caps intersect the curved
    // surface and produce broken checkerboard shapes at racing distance.
    for(let panel=0;panel<7;panel++){
      const angle=(panel-1)*Math.PI/3,polar=panel?.8:0;
      const n=new THREE.Vector3(Math.sin(angle)*Math.sin(polar),Math.cos(polar),Math.cos(angle)*Math.sin(polar));
      const u=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle)),v=new THREE.Vector3().crossVectors(n,u);
      const vertices:number[]=[],indices:number[]=[];
      const point=(x:number,y:number,lift:number)=>{const d=n.clone().addScaledVector(u,x).addScaledVector(v,y).normalize();vertices.push(d.x*(.91+lift),.08+d.y*(.6734+lift),d.z*(.91+lift));};
      point(0,0,.035);
      for(let ring=0;ring<2;ring++)for(let corner=0;corner<6;corner++){const a=corner*Math.PI/3+Math.PI/6,r=ring?.42:.375;point(Math.cos(a)*r,Math.sin(a)*r,ring?.009:.035);}
      for(let i=0;i<6;i++){const a=1+i,b=1+(i+1)%6;indices.push(0,a,b,a,a+6,b+6,a,b+6,b);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();add(g,color);
      if(kind==='blue-shell'&&panel){const spike=new THREE.ConeGeometry(.115,.34,6);spike.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n));add(spike,cream,n.x*1.02,.08+n.y*.85,n.z*1.02);}
    }
    if(kind==='blue-shell')for(const side of [-1,1]){
      const wing=new THREE.Shape();wing.moveTo(0,0);wing.quadraticCurveTo(.3,.6,1,.85);wing.lineTo(.68,.43);wing.lineTo(.93,.48);wing.lineTo(.54,.19);wing.lineTo(.7,.18);wing.quadraticCurveTo(.3,-.17,0,0);
      add(extrude(wing,.06),cream,side*.75,.4,-.08,[side,1,1],[0,side*.22,0]);
    }
  }
  const geometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();
  if(!geometry)throw new Error(`Could not combine ${kind} model`);
  geometry.computeBoundingSphere();geometry.computeBoundingBox();shared.add(geometry);return geometry;
}

/** Same asset for the moving projectile, world aura and baked inventory image. */
export function createRaceItemModel(kind:string):THREE.Group {
  const root=new THREE.Group();root.name=`race item / ${kind}`;
  let geometry=models.get(kind);if(!geometry){geometry=sculpt(kind);models.set(kind,geometry);}
  root.add(new THREE.Mesh(geometry,enamel));
  if(kind==='shield'){
    if(!bubbleGeometry){bubbleGeometry=new THREE.SphereGeometry(.9,24,14);shared.add(bubbleGeometry);}
    root.add(new THREE.Mesh(bubbleGeometry,gouraud(true)));
  }
  root.updateMatrixWorld(true);return root;
}

/** Rally projectiles share the normal lifecycle and keep other courses' art intact. */
export function createRallyItemModel(kind:string):THREE.Group {
  return createRaceItemModel(kind.endsWith('-shell')&&kind!=='shock-shell'?`rally-coconut-${kind.split('-')[0]}`:kind);
}

export function disposeRaceItemModel(root:THREE.Object3D):void {
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(object=>{if(object instanceof THREE.Mesh){geometry.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});
  root.removeFromParent();for(const g of geometry)if(!shared.has(g))g.dispose();for(const m of materials)if(!shared.has(m))m.dispose();
}
