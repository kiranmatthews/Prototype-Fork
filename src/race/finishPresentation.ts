import * as THREE from 'three';
import type { ResultsViewport } from '../resultsPresentation';
import type { SkateRace } from './runtime';

/** A live finish-line shot over the existing race world. No simulation ownership. */
export class RaceFinishPresentation {
  private elapsed=0;
  private course:SkateRace['course']=null;
  private saved:{position:THREE.Vector3;rotation:THREE.Quaternion;fov:number;view:THREE.PerspectiveCamera['view']}|null=null;
  private readonly shot=new THREE.PerspectiveCamera();

  /** Restore the chase rig before it computes its next frame or starts a retry. */
  restore(camera:THREE.PerspectiveCamera):void {
    if(!this.saved)return;
    camera.position.copy(this.saved.position);camera.quaternion.copy(this.saved.rotation);
    camera.fov=this.saved.fov;camera.view=this.saved.view;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();this.saved=null;
  }

  frame(camera:THREE.PerspectiveCamera,race:SkateRace,dt:number,width:number,height:number,viewport:ResultsViewport,reducedMotion=false):void {
    const course=race.course;
    if(!race.active||race.phase!=='finished'||!course){this.elapsed=0;this.course=null;return;}
    if(this.course!==course){this.elapsed=0;this.course=course;}
    this.saved={position:camera.position.clone(),rotation:camera.quaternion.clone(),fov:camera.fov,view:camera.view?{...camera.view}:null};
    this.elapsed+=dt;
    const blend=reducedMotion?1:THREE.MathUtils.smoothstep(this.elapsed,0,.8);
    const forward=course.tangent(course.length).setY(0).normalize();
    const side=new THREE.Vector3(-forward.z,0,forward.x);
    const finish=course.sample(course.length);
    const offset=course.project(race.riders[0].player.pos).offset;
    const kart=!!race.carts;
    const center=finish.clone().addScaledVector(forward,2).addScaledVector(side,kart?0:offset*.45);center.y+=2;
    // Look down the stadium straight from above the approach. The old side
    // angle placed the results camera inside the steep spectator stands.
    const look=kart?forward.clone().setY(-.65).normalize():forward.clone().negate().addScaledVector(side,-.65).setY(-.42).normalize();
    const right=new THREE.Vector3().crossVectors(look,new THREE.Vector3(0,1,0)).normalize();
    const up=new THREE.Vector3().crossVectors(right,look).normalize();
    const fov=42,tan=Math.tan(THREE.MathUtils.degToRad(fov/2));
    const tanX=tan*width/height*Math.max(.1,viewport.width/width)*.9;
    const tanY=tan*Math.max(.1,viewport.height/height)*.9;
    // Include the approach, timing plane and supported roll-out. Wide finish
    // lanes still retain the human; never follow a distant unfinished rider.
    const halfWidth=Math.max(8,Math.min(14,course.width(course.length)/2),Math.abs(offset)*.6+3);
    let distance=20;
    for(const x of [-halfWidth,halfWidth])for(const y of [-2,6])for(const z of [-12,12]){
      const corner=side.clone().multiplyScalar(x).addScaledVector(forward,z);corner.y=y;
      distance=Math.max(distance,Math.abs(corner.dot(right))/tanX-corner.dot(look),Math.abs(corner.dot(up))/tanY-corner.dot(look));
    }
    for(let pass=0;pass<(kart?4:1);pass++){
      this.shot.position.copy(center).addScaledVector(look,-distance);
      if(kart){
        const approach=course.sample(Math.max(0,course.length-distance/Math.hypot(1,.65)));
        this.shot.position.x=approach.x;this.shot.position.z=approach.z;
      }
      this.shot.lookAt(center);
      if(!kart)break;
      // The approach can bend. Stay on its centreline, then refit the subjects
      // to the resulting view instead of drifting sideways into a grandstand.
      const aim=center.clone().sub(this.shot.position),actual=aim.length();aim.normalize();
      right.crossVectors(aim,new THREE.Vector3(0,1,0)).normalize();up.crossVectors(right,aim).normalize();
      let needed=actual;
      for(const x of [-halfWidth,halfWidth])for(const y of [-2,6])for(const z of [-12,12]){
        const corner=side.clone().multiplyScalar(x).addScaledVector(forward,z);corner.y=y;
        needed=Math.max(needed,Math.abs(corner.dot(right))/tanX-corner.dot(aim),Math.abs(corner.dot(up))/tanY-corner.dot(aim));
      }
      if(needed<=actual+.01)break;distance*=needed/actual*1.02;
    }
    camera.position.lerp(this.shot.position,blend);camera.quaternion.slerp(this.shot.quaternion,blend);
    camera.fov=THREE.MathUtils.lerp(camera.fov,fov,blend);camera.aspect=width/height;
    const cx=(viewport.x+viewport.width/2)/width,cy=(viewport.y+viewport.height/2)/height;
    camera.setViewOffset(width,height,(.5-cx)*width*blend,(.5-cy)*height*blend,width,height);
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
}
