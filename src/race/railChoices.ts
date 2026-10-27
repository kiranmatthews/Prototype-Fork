import * as THREE from 'three';
import type { Rail } from '../rails';
import { RaceCourse } from './course';
import type { RaceKnot, RailNavigationData } from './types';

export interface RailChoiceCursor { s:number; route?:number; along?:number }
export interface RailChoicePath {
  index:number; section:number; choice:number; start:number; end:number;
  course:RaceCourse;
  rails:{rail:Rail;start:number;end:number}[];
}
export interface RailChoiceProjection {
  s:number; distance:number; offset:number; route:number; along:number;
}

/** Navigation over the real editor rails. Alternatives share race progress at
 * platform junctions, while their own arc lengths own steering and the camera.
 * This never moves a rider or changes the native rail/collision physics. */
export class RailChoices {
  readonly paths:RailChoicePath[]=[];
  readonly mapLines:(readonly RaceKnot[])[]=[];
  private bindings=new Map<Rail,{path:RailChoicePath;start:number}[]>();
  private position=new THREE.Vector3();
  constructor(readonly course:RaceCourse,data:RailNavigationData,rails:readonly Rail[]) {
    const byName=new Map(rails.map(rail=>[rail.object.userData.sourceName as string,rail]));
    for(const [section,group]of (data.railChoices??[]).entries()) {
      const start=course.project(new THREE.Vector3(...group.from)).s,end=course.project(new THREE.Vector3(...group.to)).s;
      if(end<=start)continue;
      for(const [choice,names]of group.paths.entries()) {
        const strand=names.map(name=>byName.get(name));
        if(strand.some(rail=>!rail))continue;
        const knots:RaceKnot[]=[[...group.from,28]],spans:RailChoicePath['rails']=[];
        let length=0;
        const append=(p:THREE.Vector3)=>{
          const previous=knots[knots.length-1],d=Math.hypot(p.x-previous[0],p.y-previous[1],p.z-previous[2]);
          if(d<1e-6)return;
          length+=d;knots.push([p.x,p.y,p.z,12]);
        };
        for(const rail of strand as Rail[]) {
          append(rail.points[0]);const begin=length;
          for(const p of rail.points.slice(1))append(p);
          spans.push({rail,start:begin,end:length});
        }
        append(new THREE.Vector3(...group.to));
        const path:RailChoicePath={index:this.paths.length,section,choice,start,end,course:new RaceCourse(knots),rails:spans};
        this.paths.push(path);
        this.mapLines.push(path.course.knots);
        for(const span of spans){const list=this.bindings.get(span.rail)??[];list.push({path,start:span.start});this.bindings.set(span.rail,list);}
      }
    }
  }
  private progress(path:RailChoicePath,along:number):number {
    return path.start+(path.end-path.start)*THREE.MathUtils.clamp(along/path.course.length,0,1);
  }
  /** Identify a supported grind from public world position. The movement
   * model keeps ownership of its private attachment state. */
  caught(position:THREE.Vector3,cursor?:RailChoiceCursor):{rail:Rail;t:number}|null {
    let best=1.25,winner:Rail|null=null;
    for(const [rail,bindings]of this.bindings){
      if(rail.distanceLowerBound(position)>best)continue;
      const distance=rail.closestDistance(position);
      if(distance<best||Math.abs(distance-best)<1e-4&&bindings.some(({path})=>path.index===cursor?.route)){best=distance;winner=rail;}
    }
    return winner?{rail:winner,t:winner.closest(position).t}:null;
  }
  project(position:THREE.Vector3,cursor?:RailChoiceCursor,rail?:Rail|null,railT?:number):RailChoiceProjection {
    const previous=cursor&&cursor.s>=0?cursor.s:undefined;
    // A close native rail is stronger evidence than the old route's progress.
    // This lets a real catch across an over/under crossing move the camera and
    // progress onto that thread, even halfway through a different alternative.
    if(!rail){const near=this.caught(position,cursor);if(near){rail=near.rail;railT=near.t;}}
    const bindings=rail?this.bindings.get(rail):undefined;
    const binding=bindings?.find(({path})=>previous===undefined||previous>=path.start-80&&previous<=path.end+80)??bindings?.[0];
    if(binding){
      const along=binding.start+(railT??rail!.closest(position).t),path=binding.path;
      return {s:this.progress(path,along),distance:rail!.closestDistance(position),offset:0,route:path.index,along};
    }
    const base=this.course.project(position,previous,80);
    let best:RailChoiceProjection={...base,route:-1,along:base.s},cost=base.distance**2+.2;
    for(const path of this.paths){
      if(previous!==undefined&&(path.end<previous-80||path.start>previous+80))continue;
      const same=cursor?.route===path.index&&cursor.along!==undefined;
      const at=path.course.project(position,same?cursor!.along:undefined,80);
      const s=this.progress(path,at.s),leap=previous===undefined?0:Math.max(0,Math.abs(s-previous)-60);
      const score=at.distance**2+leap*leap*.25+(same?0:.1);
      if(score<cost){cost=score;best={s,distance:at.distance,offset:at.offset,route:path.index,along:at.s};}
    }
    return best;
  }
  update(position:THREE.Vector3,cursor:RailChoiceCursor,rail?:Rail|null,railT?:number):RailChoiceProjection {
    const at=this.project(position,cursor,rail,railT);Object.assign(cursor,at);return at;
  }
  /** Choose an outgoing rail on a shared deck, then follow whichever native
   * branch the rider actually catches (including a deliberate mid-air switch). */
  guide(position:THREE.Vector3,cursor:RailChoiceCursor,choice:number,rail?:Rail|null,railT?:number):RailChoicePath|null {
    this.update(position,cursor,rail,railT);
    if(!rail)for(const path of this.paths){
      if(path.choice!==choice||Math.abs(cursor.s-path.start)>35)continue;
      const from=path.course.sample(0,0,this.position);
      if(position.distanceToSquared(from)>35*35)continue;
      const along=path.course.project(position,0,45).s;
      cursor.route=path.index;cursor.along=along;cursor.s=this.progress(path,along);break;
    }
    return this.paths[cursor.route??-1]??null;
  }
  tangent(cursor:RailChoiceCursor,target=new THREE.Vector3()):THREE.Vector3 {
    const path=this.paths[cursor.route??-1];
    return path?path.course.tangent(cursor.along??0,target):this.course.tangent(cursor.s,target);
  }
  ahead(cursor:RailChoiceCursor,distance:number,target=new THREE.Vector3()):THREE.Vector3 {
    const path=this.paths[cursor.route??-1];
    return path?path.course.sample((cursor.along??0)+distance,0,target):this.course.sample(cursor.s+distance,0,target);
  }
  /** Move a scenery/item guide through connected junctions in world metres. */
  advance(cursor:RailChoiceCursor,metres:number):void {
    let path=this.paths[cursor.route??-1];
    while(path){
      const available=path.course.length-(cursor.along??0);
      if(metres<=available){cursor.along=(cursor.along??0)+metres;cursor.s=this.progress(path,cursor.along);return;}
      metres-=available;
      const next=this.paths.find(candidate=>candidate.section===path.section+1&&candidate.choice===path.choice);
      if(!next){cursor.route=-1;cursor.s=path.end;break;}
      path=next;cursor.route=next.index;cursor.along=0;cursor.s=next.start;
    }
    cursor.s=Math.min(this.course.length,cursor.s+metres);cursor.along=cursor.s;
  }
}
