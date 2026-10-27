// Local review only: drive the actual Player into loaded palm scenery and
// recover with ordinary controls. The resolver observes, never changes, hits.
import * as THREE from 'three';

const controls=(overrides:Record<string,unknown>={})=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,
  grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,
  transferHeld:false,transferPressed:false,restartPressed:false,...overrides});

export class MotuPalmReview {
  readonly report:any={kind:'palm contact',done:false,passed:false,index:0,phase:'approach',frame:0,results:[]};
  private readonly cases:any[]=[];
  private readonly originalResolve:any;
  private active:any=null;
  private hits=0;
  private initialDeaths=0;
  private restored=false;
  constructor(private readonly player:any,private readonly level:any,private readonly playerStep:any){
    const trunks=level.carlisleScenery.meshes.filter((m:THREE.Mesh)=>m.name.includes('baytrunk'));
    for(const garden of level.captureData().components.filter((c:any)=>c.nm==='Motu / planted circular skate ledge')){
      const [x,y,z]=garden.vertices,r=Math.hypot(garden.vertices[3]-x,garden.vertices[5]-z);
      const trunk=trunks.find((m:THREE.Mesh)=>Math.hypot(m.position.x-x,m.position.z-z)<.01);
      if(!trunk)throw new Error('Missing native palm contact');
      const vertices=trunk.geometry.attributes.position,wood:THREE.Vector3[]=[];
      for(let i=0;i<vertices.count;i++)if(vertices.getY(i)>.1&&vertices.getY(i)<.2)wood.push(new THREE.Vector3().fromBufferAttribute(vertices,i));
      const target=new THREE.Box3().setFromPoints(wood).getCenter(new THREE.Vector3()).applyMatrix4(trunk.matrixWorld);target.y=y+.08;
      const from=new THREE.Vector3(x,y+.08,z+r-.65),heading=target.clone().sub(from).setY(0).normalize();
      for(const speed of [6,18])this.cases.push({palm:[x,y,z],from,heading,speed,away:from.clone().addScaledVector(heading,-2),
        box:trunk.geometry.boundingBox.clone().applyMatrix4(trunk.matrixWorld)});
    }
    const scenery=level.carlisleScenery;this.originalResolve=scenery.resolve;
    scenery.resolve=(...args:any[])=>{
      const hit=this.originalResolve.apply(scenery,args);
      if(hit&&this.active&&hit.box.min.distanceTo(this.active.box.min)<1e-4&&hit.box.max.distanceTo(this.active.box.max)<1e-4)this.hits++;
      return hit;
    };
  }
  cancel(){if(!this.restored){this.level.carlisleScenery.resolve=this.originalResolve;this.restored=true;}this.report.done=true;}
  step(dt:number){
    if(this.report.done)return;
    const p=this.player,r=this.report;
    if(!this.active){
      this.active=this.cases[r.index];this.hits=0;this.initialDeaths=p.totalDeaths;r.phase='approach';r.frame=0;
      const c=this.active;p.respawn(this.level,true,true,{position:c.from,heading:c.heading});p.freeSkate=true;p.speed=c.speed;
      p.axisF.copy(c.heading);p.axisL.set(c.heading.z,0,-c.heading.x);
    }
    const c=this.active;
    if(r.phase==='approach')this.playerStep(dt,controls({moveY:1,jumpHeld:true,jumpPressed:r.frame===0}),this.level);
    else{
      const angle=Math.atan2(c.away.x-p.pos.x,c.away.z-p.pos.z)-Math.atan2(p.axisF.x,p.axisF.z),delta=Math.atan2(Math.sin(angle),Math.cos(angle));
      this.playerStep(dt,controls({moveY:1,moveX:THREE.MathUtils.clamp(-delta*2,-1,1),jumpHeld:!p.isBailing}),this.level);
    }
    r.frame++;
    const valid=p.pos.toArray().every(Number.isFinite)&&p.pos.y>=-.08&&p.totalDeaths===this.initialDeaths;
    if(!valid){this.finish(false,'unsupported or invalid position');return;}
    if(r.phase==='approach'){
      if(this.hits){
        if(c.speed===18){r.phase='recovery';r.frame=0;}
        else this.finish(true,'wood contact');
      }else if(r.frame>=100)this.finish(false,'missed wood contact');
    }else if(!p.isBailing&&Math.hypot(p.pos.x-c.away.x,p.pos.z-c.away.z)<1.5)this.finish(true,'wood contact and steering recovery');
    else if(r.frame>=420)this.finish(false,'recovery timeout');
  }
  private finish(passed:boolean,reason:string){
    const r=this.report;r.results.push({palm:this.active.palm,speed:this.active.speed,passed,reason,hits:this.hits,phase:r.phase,frames:r.frame,position:this.player.pos.toArray()});
    r.index++;this.active=null;
    if(r.index===this.cases.length){r.passed=r.results.every((v:any)=>v.passed);this.cancel();}
  }
}
