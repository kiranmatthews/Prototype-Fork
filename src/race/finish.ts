import * as THREE from 'three';
/** A broad timing line and checkerboard gantry; all decoration stays non-solid. */
export function createRaceFinish(width: number): THREE.Group {
  const group = new THREE.Group(); group.name = 'skate race finish line';
  const cream = new THREE.MeshLambertMaterial({color:0xfff3cb});
  const ink = new THREE.MeshLambertMaterial({color:0x163747});
  const gold = new THREE.MeshLambertMaterial({color:0xffbd51});
  const box = (x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);group.add(mesh);
  };
  for(const x of [-width/2,width/2]){ box(x,4,0,.55,8,.55,gold);box(x,8,0,1,.35,1,cream); }
  for(let row=0;row<2;row++)for(let col=0;col<28;col++){
    const x=-width/2+(col+.5)*width/28;
    box(x,6.4+row*.65,0,width/28,.65,.3,(row+col)%2?ink:cream);
    box(x,.025,(row-.5)*.75,width/28,.05,.75,(row+col)%2?ink:cream);
  }
  return group;
}
