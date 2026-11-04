import {Matrix4,Quaternion,Vector3} from 'three';
import type {ParticleMotion} from './particleMotion';
import type {EffectDefinition,SourceAssemblyKind} from './types';

export const sourceAssemblyDefinitions:EffectDefinition[]=[
  {id:30001,name:'eco-beam-source-assembly',source:{file:'engine/common-obs/generic-obs.gc',line:1483},
    sourceAssembly:'eco-beam',items:[{particle:2528,flags:['is-3d','start-dead']}]},
  {id:30002,name:'citadel-sagecage-bars-source-assembly',source:{file:'levels/citadel/citadel-sages.gc',line:34},
    sourceAssembly:'sage-cage',items:[{particle:2473,flags:['is-3d','start-dead']}]},
];

/** Host draw calls missing from an isolated launcher. Positions and dimensions
 * use GOAL units; gallery fitting happens outside the source emission path. */
export class SourceAssembly {
  enabled=true;
  length=12; slope=0; heading=0;
  readonly camera=new Vector3(10,8,12).multiplyScalar(4096);
  readonly jointMatrix=new Matrix4();
  readonly rootPosition=new Vector3();
  readonly centre=new Vector3();
  calls=0;
  private readonly direction=new Vector3();
  private readonly right=new Vector3();
  private readonly up=new Vector3();
  private readonly point=new Vector3();
  private readonly rotation=new Quaternion();
  private readonly turn=new Quaternion();
  private readonly basis=new Matrix4();
  constructor(readonly kind:SourceAssemblyKind) {
    if(kind==='sage-cage')this.centre.y=20766.72/4096;
  }
  get radius():number {return this.kind==='eco-beam'?Math.hypot(this.length*.5,1.25):6;}
  get note():string {return this.kind==='eco-beam'?
    'Three source planes, renewed each frame. Length, slope and heading are inspection inputs. The Jungle power-beam camera gate and player interactions are not simulated.':
    'Twelve source bar positions, renewed each frame. Heading sets the inspection joint pose; the bars face a shared comparison camera. Cage animation and sound are not included in this isolated effect.';}
  emit(motion:ParticleMotion):void {
    this.calls=0;if(!this.enabled)return;
    if(this.kind==='eco-beam') {
      const slope=this.slope*Math.PI/180,heading=this.heading*Math.PI/180;
      this.direction.set(Math.cos(slope)*Math.cos(heading),Math.sin(slope),Math.cos(slope)*Math.sin(heading));
      // forward-down->inv-matrix: row/column basis +Z forward, +Y up.
      this.right.crossVectors(this.direction,new Vector3(0,-1,0)).normalize();
      this.up.crossVectors(this.direction,this.right).normalize();
      this.basis.makeBasis(this.right,this.up,this.direction);
      this.rotation.setFromRotationMatrix(this.basis);
      this.turn.setFromAxisAngle(new Vector3(0,0,1),10922.667*Math.PI*2/65536);
      for(let i=0;i<3;i++) {
        this.rotation.multiply(this.turn).normalize();
        motion.emitSource(2528,this.rootPosition,true,this.rotation,{'scale-y':this.length*4096});this.calls++;
      }
    } else {
      this.jointMatrix.makeRotationY(this.heading*Math.PI/180);
      this.rotation.setFromRotationMatrix(this.jointMatrix);
      const elements=this.jointMatrix.elements;
      const offset=-Math.atan2(elements[8],elements[10]);
      this.point.copy(this.camera).sub(this.rootPosition);
      this.rotation.multiply(this.turn.setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
      this.rotation.multiply(this.turn.setFromAxisAngle(new Vector3(0,0,1),offset+Math.atan2(this.point.x,this.point.z))).normalize();
      // citb-sagecage-method-21's exact twelve coordinates, including its
      // authored 5.07 m centre height and 1.8 m spacing along each side.
      for(const [x,z] of [[14745.6,-7372.8],[14745.6,0],[14745.6,7372.8],
        [-14745.6,-7372.8],[-14745.6,0],[-14745.6,7372.8],
        [-7372.8,14745.6],[0,14745.6],[7372.8,14745.6],
        [-7372.8,-14745.6],[0,-14745.6],[7372.8,-14745.6]]) {
        this.point.set(x,20766.72,z).applyMatrix4(this.jointMatrix).add(this.rootPosition);
        motion.emitSource(2473,this.point,true,this.rotation);this.calls++;
      }
    }
  }
}
