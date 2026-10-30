type Position={x:number;y:number;z:number};
type AudioLoops={setLoop(id:string,name:string,active:boolean,volume:number,rate?:number):void};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};

/** Read-only scenery mix. Native movement and the authored water profile are inputs. */
export class CarlisleHarbourSound{
  readonly diagnostics={waterGain:0,windGain:0,height:0,verticalSpeed:0,teleports:0};
  private previous:Position|null=null;
  private disposed=false;
  constructor(private audio:AudioLoops,private bonus=false){}
  update(dt:number,position:Position,waterY:number){
    if(this.disposed||!Number.isFinite(dt)||dt<=0||!Number.isFinite(waterY)||
      ![position.x,position.y,position.z].every(n=>Number.isFinite(n)&&Math.abs(n)<1e6))return;
    const d=this.diagnostics,height=Math.max(0,position.y-waterY),step=Math.min(dt,.1);
    let verticalSpeed=0;
    if(this.previous){
      const distance=Math.hypot(position.x-this.previous.x,position.y-this.previous.y,position.z-this.previous.z);
      // Checkpoints, restarts and bonus warps are not bursts of physical speed.
      if(distance>Math.max(8,dt*220))d.teleports++;
      else verticalSpeed=Math.abs(position.y-this.previous.y)/dt;
    }
    this.previous={...position};d.height=height;d.verticalSpeed=verticalSpeed;
    const exposure=smooth(10,85,height),rush=smooth(16,75,verticalSpeed)*exposure;
    const water=.34/(1+height/34),wind=(this.bonus?.042:.055)+.18*exposure+.09*rush;
    // Long sample beds hold their phase; only their gain moves. The one-second
    // water fade and faster wind fade keep apexes and respawns free of hard cuts.
    d.waterGain+=(water-d.waterGain)*(1-Math.exp(-step/.95));
    d.windGain+=(wind-d.windGain)*(1-Math.exp(-step/.6));
    this.audio.setLoop('carlisle-water','carlisleWater',true,d.waterGain);
    this.audio.setLoop('carlisle-wind','carlisleWind',true,d.windGain);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.audio.setLoop('carlisle-water','carlisleWater',false,0);
    this.audio.setLoop('carlisle-wind','carlisleWind',false,0);
    this.previous=null;
  }
}
