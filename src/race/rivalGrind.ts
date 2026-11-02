/** A rider makes discrete corrections and occasionally holds one too
 * long. Only stick input is produced: native balance, bails and recovery decide
 * the outcome. Each rival has an independent, replayable attention pattern. */
export class RivalGrindControl {
  private seed:number;
  private previous=0;
  private riding=0;
  private nextSample=0;
  private nextHesitation:number;
  private delayedUntil=0;
  private held=0;
  constructor(seed:number,private readonly skill?:'club'){
    this.seed=seed||1;
    this.nextHesitation=skill==='club'?10+this.random()*8:35+this.random()*35;
  }
  private random():number {let n=this.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;this.seed=n;return(n>>>0)/4294967296;}
  sample(now:number,grinding:boolean,balance:number,velocity:number):number {
    const dt=Math.max(0,Math.min(.1,now-this.previous));this.previous=now;
    if(!grinding){this.nextSample=now;this.delayedUntil=0;this.held=0;return 0;}
    this.riding+=dt;
    if(this.riding>=this.nextHesitation){
      this.delayedUntil=now+(this.skill==='club'?.6+this.random()*.4:.20+this.random()*.24);
      this.nextHesitation=this.riding+(this.skill==='club'?14+this.random()*14:45+this.random()*45);
    }
    if(now>=this.nextSample&&now>=this.delayedUntil){
      const club=this.skill==='club';
      const correction=Math.abs(balance)>(club?.75:.62)?-Math.sign(balance): -balance*2.8-velocity*(club?.24:.3);
      const steps=club?4:10;
      this.held=Math.max(-1,Math.min(1,Math.round((correction+(this.random()-.5)*(club?.18:.10))*steps)/steps));
      this.nextSample=now+(club?.18+this.random()*.10:.09+this.random()*.055);
    }
    return this.held;
  }
}
