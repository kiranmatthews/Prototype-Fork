// A fixed native-builder sentinel replaces the retired Descent menu ID.
// It exercises real capture, chunking, groups, rail/collision ownership and
// procedural pines independently of whichever course currently owns the menu.
export const NATIVE_SCENERY_PINE_COUNT = 8;
export function nativeSceneryFixture(api, THREE) {
  const level = new api.Level(new THREE.Scene(), {id:'native-scenery-fixture',name:'Native scenery fixture',
    data:{v:1,name:'Native scenery fixture',spawn:[0,1,0],killY:-30,components:[]}});
  level.builtFromData=null;
  const material = new THREE.MeshLambertMaterial({color:0x76858d,emissive:0x101820,side:THREE.DoubleSide,fog:false});
  const add = (name,geometry,p,group) => {
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...p);
    mesh.rotation.y=.31;mesh.userData.captureGroup=group;mesh.userData.solidSurface='none';
    level.root.add(mesh);level.capturedSceneryMeshes.push(mesh);return mesh;
  };
  for(let i=0;i<2;i++){
    const id=i+1,p=[20+i*45,0,-25-i*80];
    level.sceneryCaptureGroups.push({id,nm:`Mountain wall ${i+1}`,editorOnly:true});
    // Over 4k vertices forces the exact native mesh through multiple chunks.
    add('rock face',new THREE.SphereGeometry(10,72,48),[p[0],6,p[2]],id);
    const wall={t:'wall',p,s:[18,12,4],invisible:true,grp:id,edgeGrinding:false};
    level.decorLog.push(wall);
    level.walls.push(new THREE.Box3(new THREE.Vector3(p[0]-9,0,p[2]-2),new THREE.Vector3(p[0]+9,12,p[2]+2)));
  }
  for(let i=0;i<2;i++){
    const id=i+3,x=-10-i*15;
    level.sceneryCaptureGroups.push({id,nm:i?'Mountain-side guardrail':'Sea-side guardrail',editorOnly:true});
    add('barrier beam',new THREE.BoxGeometry(.5,.3,24),[x,2,-20],id);
    add('barrier post scenery',new THREE.CylinderGeometry(.2,.25,2,7),[x,1,-20],id);
    // Real rail construction provides the capture source and grind owner.
    level.buildCustom({v:1,name:'Rail sentinel',spawn:[0,1,0],killY:-30,
      components:[{t:'rail',p:[x,2,-20],pts:[[0,12],[1,0],[0,-12]],invisible:true}]});
    level.rails.at(-1).object.userData.captureGroup=id;
  }
  for(const [i,name]of ['centre line','edge line','hillside','crag','sea cliff','high ridge','bay island'].entries())
    add(name,i<2?new THREE.BoxGeometry(.25,.02,12):new THREE.IcosahedronGeometry(3+i,2),[i*13,4,-200-i*30]);
  level.builtFromData=null;level.batchDecor=true;
  for(let i=0;i<NATIVE_SCENERY_PINE_COUNT;i++)level.pine(100+i*17,2+i*.15,-350-i*31,.75+i*.13,i*29);
  level.bakeDecor();level.root.updateMatrixWorld(true);
  return level;
}
export function nativeOilFixture(api, THREE) {
  const level=new api.Level(new THREE.Scene(),{id:'native-oil-fixture',name:'Native oil fixture',
    data:{v:1,name:'Native oil fixture',spawn:[0,1,0],killY:-30,components:[]}});
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(3,48),new THREE.MeshLambertMaterial({
    color:0x17242f,emissive:0x14202a,side:THREE.DoubleSide,fog:false,transparent:true,opacity:.8}));
  mesh.name='oil slick';mesh.rotation.x=-Math.PI/2;mesh.position.set(4,.03,-10);
  mesh.userData.slippy=true;mesh.userData.edgeGrinding=false;
  level.root.add(mesh);level.groundMeshes.push(mesh);level.builtFromData=null;level.root.updateMatrixWorld(true);
  return level;
}
