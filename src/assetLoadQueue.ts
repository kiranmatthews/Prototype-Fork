/** Bound encoded buffers and decoder scratch memory during a level load. */
export class AssetLoadQueue {
  private active=0;
  private queued:(()=>void)[]=[];
  constructor(private limit=2){}
  run<T>(load:()=>Promise<T>,wanted=()=>true):Promise<T>{
    return new Promise<T>((resolve,reject)=>{
      this.queued.push(()=>{
        if(!wanted()){reject(new Error('Asset owner was released before loading'));return;}
        this.active++;
        Promise.resolve().then(load).then(resolve,reject).finally(()=>{this.active--;this.pump();});
      });
      this.pump();
    });
  }
  private pump():void{while(this.active<this.limit&&this.queued.length)this.queued.shift()!();}
}
export const sceneryLoads=new AssetLoadQueue(2);
