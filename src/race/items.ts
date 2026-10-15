import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

/** The same small models appear in the world and in the existing menu model slots. */
export function createRaceItemModel(kind:string):THREE.Group {
  const root=new THREE.Group();root.name=`race item / ${kind}`;
  const material=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.72});
  const cream=material(0xffefbd),ink=material(0x34291b);
  const mesh=(geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{
    const object=new THREE.Mesh(geometry,mat);object.position.set(x,y,z);root.add(object);return object;
  };
  if(kind==='banana'){
    const yellow=material(0xffd733);yellow.side=cream.side=THREE.DoubleSide;
    for(let petal=0;petal<3;petal++){
      const angle=petal*Math.PI*2/3,vertices:number[]=[],indices:number[]=[];
      for(let i=0;i<=12;i++){
        const t=i/12,r=.1+t*1.16,y=.68*(1-t)**2+.04+.13*t**5,w=.035+.29*Math.sin(Math.PI*t)**.65;
        for(const side of [-1,1])vertices.push(Math.cos(angle)*r-Math.sin(angle)*w*side,y,Math.sin(angle)*r+Math.cos(angle)*w*side);
        if(i){const a=(i-1)*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      mesh(geometry,yellow);mesh(geometry.clone(),cream,0,.022,0).scale.set(.82,1,.82);
    }
    mesh(new THREE.CylinderGeometry(.11,.18,.42,8),yellow,0,.78,0);
    mesh(new THREE.CylinderGeometry(.115,.11,.07,8),ink,0,1.01,0);
  }else if(kind==='mushroom'){
    const red=material(0xef4940);
    mesh(new THREE.CylinderGeometry(.36,.45,.8,12),cream,0,-.06,0);
    mesh(new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI/2),red,0,.3,0).scale.y=.68;
    for(let i=0;i<5;i++){
      const angle=i*Math.PI*2/5,x=Math.sin(angle)*.7,z=Math.cos(angle)*.7;
      const spot=mesh(new THREE.SphereGeometry(.22,8,6),cream,x,.76,z);spot.scale.y=.12;
      spot.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(x,.7,z).normalize());
    }
    mesh(new THREE.SphereGeometry(.24,8,6),cream,0,.99,0).scale.y=.12;
  }else if(kind==='shield'){
    const glass=new THREE.MeshPhongMaterial({color:0x77daef,transparent:true,opacity:.55,shininess:85,depthWrite:false});
    mesh(new THREE.SphereGeometry(.9,16,10),glass);
    const rim=mesh(new THREE.TorusGeometry(.87,.065,6,20),cream);rim.rotation.x=.25;rim.rotation.y=-.4;
    const shine=mesh(new THREE.SphereGeometry(.16,8,6),cream,-.36,.45,.63);shine.scale.set(.5,1.4,.2);
  }else{
    const colors:Record<string,number>={'green-shell':0x48b457,'red-shell':0xe95447,'blue-shell':0x418cde,'shock-shell':0xe8ac25};
    const color=colors[kind];if(color===undefined)throw new Error(`Unknown race item model: ${kind}`);
    const shell=material(color),panel=material(new THREE.Color(color).multiplyScalar(1.22).getHex());
    mesh(new THREE.CylinderGeometry(.89,.94,.17,16),cream,0,-.04,0);
    mesh(new THREE.SphereGeometry(.95,16,10,0,Math.PI*2,0,Math.PI/2),shell,0,.04,0).scale.y=.69;
    mesh(new THREE.TorusGeometry(.9,.105,6,20),cream,0,.07,0).rotation.x=Math.PI/2;
    mesh(new THREE.CylinderGeometry(.32,.35,.065,6),panel,0,.7,0);
    for(let i=0;i<6;i++){
      const angle=i*Math.PI/3,normal=new THREE.Vector3(Math.sin(angle)*.7,.65,Math.cos(angle)*.7).normalize();
      const plate=mesh(new THREE.CylinderGeometry(.25,.28,.055,6),panel,Math.sin(angle)*.64,.5,Math.cos(angle)*.64);
      plate.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
      if(kind==='blue-shell'||kind==='shock-shell'){
        const spike=mesh(new THREE.ConeGeometry(.11,kind==='shock-shell'?.4:.3,6),cream,Math.sin(angle)*.66,.66,Math.cos(angle)*.66);spike.quaternion.copy(plate.quaternion);
      }
    }
    if(kind==='blue-shell')for(const side of [-1,1]){
      const wing=new THREE.Shape();wing.moveTo(0,0);wing.quadraticCurveTo(.3,.6,1,.85);wing.lineTo(.68,.43);wing.lineTo(.93,.48);wing.lineTo(.54,.19);wing.lineTo(.7,.18);wing.quadraticCurveTo(.3,-.17,0,0);
      const feather=mesh(new THREE.ExtrudeGeometry(wing,{depth:.07,bevelEnabled:false}),cream,side*.75,.35,-.1);feather.scale.x=side;feather.rotation.y=side*.22;
    }
    if(kind==='shock-shell'){
      const bolt=new THREE.Shape();bolt.moveTo(.12,1.2);bolt.lineTo(-.35,.52);bolt.lineTo(-.06,.52);bolt.lineTo(-.22,-.02);bolt.lineTo(.42,.7);bolt.lineTo(.13,.7);bolt.closePath();
      mesh(new THREE.ExtrudeGeometry(bolt,{depth:.08,bevelEnabled:false}),cream,0,.1,.88);
    }
  }
  if(kind!=='shield'){
    // Solid items have no articulated parts or textures: bake colour into one draw.
    const pieces:THREE.BufferGeometry[]=[],materials=new Set<THREE.Material>();
    for(const child of root.children){
      const m=child as THREE.Mesh;m.updateMatrix();let g=m.geometry.clone().applyMatrix4(m.matrix);
      if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}g.deleteAttribute('uv');
      const color=(m.material as THREE.MeshStandardMaterial).color,values=new Float32Array(g.getAttribute('position').count*3);
      for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b;}
      g.setAttribute('color',new THREE.BufferAttribute(values,3));pieces.push(g);materials.add(m.material as THREE.Material);m.geometry.dispose();
    }
    const geometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();for(const m of materials)m.dispose();root.clear();
    if(!geometry)throw new Error(`Could not combine ${kind} model`);
    root.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,side:kind==='banana'?THREE.DoubleSide:THREE.FrontSide})));
  }
  root.updateMatrixWorld(true);return root;
}

export function disposeRaceItemModel(root:THREE.Object3D):void {
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(object=>{if(object instanceof THREE.Mesh){geometry.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});
  root.removeFromParent();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();
}
