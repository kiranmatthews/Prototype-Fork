import type {ParticleHost} from './particleMotion';
import type {ScreenHudLayer} from './screenHud';
import type {FirstPersonHudDefinition,ScreenHudProfile} from './types';

/** Original first-person host. Position changes made by callbacks are consumed
 * by the following spawn/post, retaining the source's one-frame origin delay. */
export class FirstPersonHud {
  profile:ScreenHudProfile;
  phase:'waiting'|'arriving'|'in'|'leaving'|'hidden'='waiting';
  hold=true;
  clock=0;
  offset=0;
  movie=false;
  progressState:'absent'|'open'|'going-out'|'gone'='absent';
  readonly context:NonNullable<ParticleHost['firstPerson']>;
  private carry=0;
  private waited=false;
  constructor(readonly definition:FirstPersonHudDefinition,readonly layers:ScreenHudLayer[]) {
    this.profile=definition.profiles.find(profile=>profile.id==='4:3')!;
    if(!this.profile)throw new Error('Missing source first-person HUD format');
    this.context={offset:definition.maximumOffset,movie:false,xScale:0,yScale:0,xOffset:0,positions:[]};
    for(const {motion} of layers) {
      motion.host.firstPerson=this.context;motion.issues.delete('Screen-space host layout');
    }
    this.restart();
  }
  get aspect():number{return this.profile.id==='4:3'?4/3:16/9;}
  select(id:string):void {
    const profile=this.definition.profiles.find(profile=>profile.id===id);
    if(!profile)throw new Error(`Unknown first-person HUD format ${id}`);
    this.profile=profile;
  }
  show():void {this.restart();}
  hide(quick=false):void {
    this.phase=quick?'hidden':'leaving';
    if(quick){this.offset=this.definition.maximumOffset;for(const {motion} of this.layers)motion.reset();}
  }
  restart():void {
    this.clock=this.carry=0;this.offset=this.definition.maximumOffset;this.phase='waiting';this.waited=false;
    this.context.positions=this.profile.layers.map(layer=>[...layer.position]);
    for(const {motion} of this.layers){motion.reset();motion.hostEmission='held';}
  }
  update(dt:number):void {
    this.carry+=dt;
    while(this.carry>=1/60){this.step();this.carry-=1/60;}
  }
  private step():void {
    this.clock+=5;
    // hud-waiting allocates the three origins and suspends before coming-in.
    if(this.phase==='waiting') {
      if(!this.waited){this.waited=true;return;}
      this.phase='arriving';
    }
    if(this.phase==='hidden')return;
    const {rates,maximumOffset}=this.definition;
    if(this.phase==='arriving') {
      this.offset=Math.max(0,this.offset-rates.arrival);
      if(!this.offset)this.phase='in';
    } else if(this.phase==='leaving') {
      this.offset=Math.min(maximumOffset,this.offset+rates.departure);
      if(this.offset===maximumOffset){this.phase='hidden';for(const {motion} of this.layers)motion.reset();return;}
    } else if(this.progressState==='open')this.offset=Math.min(maximumOffset,this.offset+rates.suppress);
    else this.offset=Math.max(0,this.offset-rates.restore);
    const scales=this.profile.scales;
    Object.assign(this.context,{offset:this.offset,movie:this.movie,xScale:scales['sides-x-scale'],
      yScale:scales['sides-y-scale'],xOffset:scales['x-offset']});
    for(const {origin,sourceIndex} of this.layers) {
      const position=this.context.positions[sourceIndex];
      origin.set(-256+position[0],Math.fround(.5*(position[1]-224)),position[2]);
    }
    for(const {motion} of this.layers)motion.update(1/60);
  }
}
