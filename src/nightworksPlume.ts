import * as THREE from 'three';
import { PuffSystem, type PuffPreset } from './puffs';

/** A small level-owned use of the game's existing Gouraud puff renderer.
 * Its isolated budget cannot consume player-impact or torch particles. */
export class NightworksPlume {
  readonly root=new THREE.Group();
  private readonly system=new PuffSystem(96);
  private readonly direction=new THREE.Vector3(.35,.94,.025);
  private readonly soot:PuffPreset;
  private readonly embers:PuffPreset;
  private pending=0;
  private carry=0;
  private serial=1;

  constructor(private readonly anchor:THREE.Vector3,private readonly scale:number){
    this.root.name='Distant Gouraud caldera smoke';
    this.root.userData.nightworksGouraud=true;
    this.system.attach(this.root);
    this.system.wind.set(2.5*scale,0,0);
    this.soot={blend:'alpha',orient:'billboardY',ring:[7,8],multiCentre:0,halo:0,
      size:[75*scale,100*scale],aspect:[1.05,1.3],grow:[2.4,3.2],growY:[2.2,2.8],growCurve:.68,
      wobble:[.16,.24],swirl:[.05,.11],wobbleRate:[.14,.25],neighbour:.95,centreDrift:0,spin:[-.04,.04],
      speed:[4*scale,7*scale],spread:.18,up:[7*scale,11*scale],gravity:-.12*scale,
      buoyancy:.45*scale,drag:.025,wind:.7,turbulence:[4*scale,8*scale],turbRate:[.12,.22],
      life:[30,38],centre:0x56435f,inner:0x302f49,outer:0x192238,fadeTo:0x242b44,
      alpha:[.44,.58],fadeIn:.12,outerAlpha:0,haloAlpha:.48};
    this.embers={...this.soot,blend:'softAdd',multiCentre:0,halo:0,
      size:[43*scale,65*scale],grow:[1.6,2.2],growY:[1.5,2],life:[7,11],
      centre:0xb84119,inner:0x78262c,outer:0x281c2e,fadeTo:0x251c2b,alpha:[.20,.30],fadeIn:.14};
    // Begin with a mature column, not thirty seconds of an empty crater.
    const camera=new THREE.PerspectiveCamera();
    for(let i=0;i<320;i++)this.step(.1,camera);
    this.pending=.001;
  }

  advance(dt:number):void {this.pending=Math.min(.1,this.pending+Math.max(0,dt));}
  render(camera:THREE.Camera):void {
    if(this.pending<=0)return;
    this.step(this.pending,camera);this.pending=0;
  }
  private step(dt:number,camera:THREE.Camera):void {
    this.carry+=dt;
    while(this.carry>=.55){
      this.carry-=.55;
      const n=this.serial++,x=Math.sin(n*2.399)*55*this.scale,z=Math.cos(n*1.7)*16*this.scale;
      this.system.spawn(this.soot,this.anchor.x+x,this.anchor.y+8*this.scale,this.anchor.z+z,
        {dir:this.direction,seed:4973+n*7919});
      if(n%2===0)this.system.spawn(this.embers,this.anchor.x+x*.6,this.anchor.y+3*this.scale,this.anchor.z+z+12*this.scale,
        {dir:this.direction,seed:179+n*104729});
    }
    this.system.update(dt,camera);
    // These world-space puffs are behind the gameplay fog horizon. Their
    // own colour/alpha gradients provide the distant atmosphere instead.
    for(const object of this.root.children){
      const mesh=object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
      if(!mesh.isMesh)continue;
      if(mesh.material.fog){mesh.material.fog=false;mesh.material.needsUpdate=true;}
      mesh.material.toneMapped=false;
      mesh.name='Caldera Gouraud puff batch';
    }
  }
  get diagnostics(){return {live:this.system.liveCount,drawCalls:this.system.drawCalls,anchor:this.anchor.toArray(),scale:this.scale};}
  dispose():void {
    this.system.clear();
    for(const object of this.root.children){
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)continue;
      mesh.geometry.dispose();
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();
    }
    this.root.removeFromParent();this.root.clear();
  }
}
