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
  }else if(kind==='water-bomb'){
    const blue=material(0x39c9ed),orange=material(0xf38a25);
    mesh(new THREE.SphereGeometry(.76,16,12),blue,0,-.04,0).scale.y=1.08;
    mesh(new THREE.ConeGeometry(.18,.3,8),orange,0,.85,0).rotation.z=Math.PI;
    mesh(new THREE.TorusGeometry(.14,.045,5,12),orange,0,1.01,0).rotation.x=Math.PI/2;
  }else if(kind==='boomerang'){
    const wood=material(0xe9ad48),red=material(0xe95b40);
    const shape=new THREE.Shape();shape.moveTo(-1,.6);shape.lineTo(-.72,.82);shape.quadraticCurveTo(-.2,.12,0,.03);shape.quadraticCurveTo(.2,.12,.72,.82);shape.lineTo(1,.6);shape.quadraticCurveTo(.25,-.48,0,-.4);shape.quadraticCurveTo(-.25,-.48,-1,.6);
    mesh(new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelSize:.04,bevelThickness:.03,bevelSegments:1}),wood).rotation.x=-Math.PI/2;
    for(const side of [-1,1])mesh(new THREE.SphereGeometry(.15,8,6),red,side*.84,.12,-.62).scale.set(1.25,.5,1);
  }else if(kind==='star'){
    const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.45:1,x=Math.sin(a)*r,y=Math.cos(a)*r;if(i)shape.lineTo(x,y);else shape.moveTo(x,y);}shape.closePath();
    mesh(new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:1}),material(0xffdc5b));
  }else if(kind==='tidal-wave'){
    const shape=new THREE.Shape();shape.moveTo(-1.1,-.6);shape.quadraticCurveTo(-1.2,.9,.25,1.1);shape.quadraticCurveTo(1.2,1.12,1.15,.15);shape.quadraticCurveTo(.6,.76,.15,.35);shape.quadraticCurveTo(-.15,0,.4,-.35);shape.lineTo(1.1,-.6);shape.closePath();
    mesh(new THREE.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:true,bevelSize:.05,bevelThickness:.04,bevelSegments:1}),material(0x34c5de),0,0,-.2);
    for(let i=0;i<7;i++){const a=i/6*Math.PI*.8;mesh(new THREE.SphereGeometry(.18,8,6),cream,-.1+Math.sin(a)*.88,.35+Math.cos(a)*.7,.15);}
  }else if(kind==='horn'){
    const brass=material(0xf6b34b),red=material(0xd74734);
    mesh(new THREE.BoxGeometry(.8,.75,.7),red,-.25,-.12,0);
    const bell=mesh(new THREE.CylinderGeometry(.77,.22,1.1,16,1,true),brass,.28,.27,0);bell.rotation.z=-Math.PI/2;
    mesh(new THREE.TorusGeometry(.76,.085,6,20),cream,.83,.27,0).rotation.y=Math.PI/2;
    mesh(new THREE.CylinderGeometry(.15,.15,.3,8),ink,-.35,.4,0);
  }else if(kind==='shock-shell'){
    // A storm silhouette, never another recoloured projectile.
    const cloud=material(0x586b89),gold=material(0xffdc37);
    for(const [x,y,r] of [[-.45,.65,.45],[0,.85,.56],[.5,.62,.4]])mesh(new THREE.SphereGeometry(r,10,8),cloud,x,y,0);
    const bolt=new THREE.Shape();bolt.moveTo(.24,.63);bolt.lineTo(-.55,-.18);bolt.lineTo(-.08,-.18);bolt.lineTo(-.35,-1.03);bolt.lineTo(.64,.05);bolt.lineTo(.14,.05);bolt.closePath();
    mesh(new THREE.ExtrudeGeometry(bolt,{depth:.16,bevelEnabled:false}),gold,0,0,.34);
  }else if(kind==='shield'){
    const glass=new THREE.MeshPhongMaterial({color:0x77daef,transparent:true,opacity:.55,shininess:85,depthWrite:false});
    mesh(new THREE.SphereGeometry(.9,16,10),glass);
    const rim=mesh(new THREE.TorusGeometry(.87,.065,6,20),cream);rim.rotation.x=.25;rim.rotation.y=-.4;
    const shine=mesh(new THREE.SphereGeometry(.16,8,6),cream,-.36,.45,.63);shine.scale.set(.5,1.4,.2);
  }else{
    const colors:Record<string,number>={'green-shell':0x48b457,'red-shell':0xe95447,'blue-shell':0x418cde};
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
      if(kind==='blue-shell'){
        const spike=mesh(new THREE.ConeGeometry(.11,.3,6),cream,Math.sin(angle)*.66,.66,Math.cos(angle)*.66);spike.quaternion.copy(plate.quaternion);
      }
    }
    if(kind==='blue-shell')for(const side of [-1,1]){
      const wing=new THREE.Shape();wing.moveTo(0,0);wing.quadraticCurveTo(.3,.6,1,.85);wing.lineTo(.68,.43);wing.lineTo(.93,.48);wing.lineTo(.54,.19);wing.lineTo(.7,.18);wing.quadraticCurveTo(.3,-.17,0,0);
      const feather=mesh(new THREE.ExtrudeGeometry(wing,{depth:.07,bevelEnabled:false}),cream,side*.75,.35,-.1);feather.scale.x=side;feather.rotation.y=side*.22;
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
