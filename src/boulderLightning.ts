import * as THREE from 'three';

/** A short world-space strike. Shared geometry is reused and owned by the level. */
export class BoulderLightning {
 readonly group=new THREE.Group();
 private readonly geometry=new THREE.CylinderGeometry(1,1,1,6);
 private readonly core=new THREE.MeshBasicMaterial({color:0xf2fcff,toneMapped:false});
 private readonly glow=new THREE.MeshBasicMaterial({color:0x63bdff,transparent:true,opacity:.24,depthWrite:false,toneMapped:false});
 private readonly light=new THREE.PointLight(0x93d8ff,0,26,2);
 private readonly segments:THREE.Group[]=[];
 private readonly up=new THREE.Vector3(0,1,0);
 private age=1;
 strikes=0;
 constructor(){
  this.group.name='Boulder overtaking lightning';this.group.visible=false;
  for(let i=0;i<25;i++){
   const segment=new THREE.Group(),core=new THREE.Mesh(this.geometry,this.core),glow=new THREE.Mesh(this.geometry,this.glow);
   core.scale.set(.07,1,.07);glow.scale.set(.24,1,.24);segment.add(core,glow);this.group.add(segment);this.segments.push(segment);
  }
  this.light.position.y=2;this.group.add(this.light);
 }
 strike(at:THREE.Vector3):void {
  this.age=0;this.strikes++;this.group.position.copy(at);this.group.visible=true;
  const points=Array.from({length:19},(_,i)=>new THREE.Vector3(i===0?0:Math.sin(i*12.3+this.strikes)*(.4+i*.035),.8+i*2,
   i===0?0:Math.sin(i*7.7+this.strikes)*(.3+i*.025)));
  for(let i=0;i<this.segments.length;i++){
   const branch=i>=18,j=branch?5+(i-18)*2:i,a=points[j],b=branch?a.clone().add(new THREE.Vector3((i%2?1:-1)*3,3.8,1.4)):points[i+1];
   const segment=this.segments[i],direction=b.clone().sub(a);
   segment.position.copy(a).lerp(b,.5);segment.quaternion.setFromUnitVectors(this.up,direction.clone().normalize());
   segment.scale.set(branch?.55:1,direction.length(),branch?.55:1);
  }
  this.update(0);
 }
 update(dt:number):void {
  this.age+=dt;if(this.age>=.48){this.group.visible=false;this.light.intensity=0;return;}
  const fade=Math.max(0,1-this.age/.48);
  this.group.visible=true;this.core.color.setRGB(.7+.3*fade,.87+.13*fade,1);
  this.glow.opacity=.28*fade;this.light.intensity=30*fade*fade;
  for(const segment of this.segments)segment.visible=this.age<.16||this.age<.3&&Math.sin(this.age*75)>-.4;
 }
 reset():void {this.age=1;this.group.visible=false;this.light.intensity=0;}
 dispose():void {this.group.removeFromParent();this.geometry.dispose();this.core.dispose();this.glow.dispose();this.light.dispose();}
}
