import * as THREE from 'three';
/** Visible, dodgeable gold tracer. World motion and swept cover checks remain
 * level-owned; the flash and tail share the projectile's finite lifetime. */
export class KookBullet extends THREE.Group {
 private meshes:THREE.Mesh[]=[];
 constructor(direction:THREE.Vector3){
  super();this.name='Kook brass tracer';
  const core=new THREE.Mesh(new THREE.SphereGeometry(.14,16,10),new THREE.MeshBasicMaterial({color:0xfff4d5,toneMapped:false}));
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,1.4,16),new THREE.MeshBasicMaterial({color:0xffcb62,transparent:true,opacity:.72,depthWrite:false,toneMapped:false}));
  tail.rotation.x=-Math.PI/2;tail.position.z=-.6;this.add(core,tail);this.meshes=[core,tail];
  this.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.clone().normalize());
 }
 update(_dt:number):void {}
 dispose():void {this.removeFromParent();for(const m of this.meshes){m.geometry.dispose();(m.material as THREE.Material).dispose();}this.meshes=[];}
}
