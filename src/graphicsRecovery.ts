/** Keep simulation stopped while the browser has revoked the WebGL context.
 * This cannot recover an OS-killed tab, but an ordinary context reset must not
 * silently advance the player through a level behind an unpainted canvas. */
export class GraphicsRecovery {
  lost=false;
  private losses=0;
  private restores=0;
  private overlay:HTMLElement|null=null;
  private waiting=new Set<()=>void>();
  constructor(private canvas:HTMLCanvasElement,private onLost:()=>void,private onRestored:()=>void){
    canvas.addEventListener('webglcontextlost',this.handleLost);
    canvas.addEventListener('webglcontextrestored',this.handleRestored);
  }
  get diagnostics(){return {lost:this.lost,losses:this.losses,restores:this.restores};}
  ready():Promise<void>{return this.lost?new Promise(resolve=>this.waiting.add(resolve)):Promise.resolve();}
  private handleLost=(event:Event):void=>{
    event.preventDefault();
    if(this.lost)return;
    this.lost=true;this.losses++;this.canvas.dataset.graphicsState='lost';this.onLost();
    const doc=this.canvas.ownerDocument,overlay=doc.createElement('div');
    overlay.setAttribute('role','status');overlay.dataset.graphicsRecovery='';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#101923;color:#fff;display:grid;place-content:center;gap:20px;text-align:center;padding:24px;font:18px system-ui';
    const message=doc.createElement('p');message.textContent='Graphics interrupted. Waiting for the browser to reconnect…';
    const reload=doc.createElement('button');reload.textContent='Reload game';reload.style.cssText='padding:12px;font:inherit';
    reload.onclick=()=>doc.defaultView?.location.reload();
    overlay.append(message,reload);doc.body.append(overlay);this.overlay=overlay;
  };
  private handleRestored=():void=>{
    if(!this.lost)return;
    this.onRestored();this.lost=false;this.restores++;this.canvas.dataset.graphicsState='ready';
    this.overlay?.remove();this.overlay=null;
    for(const resolve of this.waiting)resolve();this.waiting.clear();
  };
}
