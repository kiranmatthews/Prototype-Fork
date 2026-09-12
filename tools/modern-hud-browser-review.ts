// Local-only HUD fixture. Never changes the player's saved play mode/counts.
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
let modern=true,count=3;
const native=g.ui.setHUD.bind(g.ui);
g.ui.setHUD=(state:any,dt:number)=>native({...state,endlessDeaths:modern,deaths:count,lives:count},dt);
const panel=document.createElement('div');panel.style.cssText='position:fixed;left:12px;bottom:16px;z-index:999999;background:#14212def;color:white;padding:10px;font:13px monospace';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='modern-hud-status';status.style.whiteSpace='pre-wrap';panel.style.maxWidth='calc(100vw - 44px)';panel.append(controls,status);document.body.append(panel);
for(const [name,m,n]of [['Modern 3',true,3],['Classic 3',false,3],['Modern 0',true,0],['Modern 123',true,123]]as const){
 const b=document.createElement('button');b.textContent=name;b.onclick=()=>{modern=m;count=n;};controls.append(b);
}
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');const value=document.querySelector<HTMLElement>('.hud-lives'),face=document.querySelector<HTMLElement>('.hud-life-face-wrap');
 const v=value?.getBoundingClientRect(),f=face?.getBoundingClientRect();
 status.textContent=JSON.stringify({modern,count,text:value?.querySelector('text')?.textContent,cap:value?getComputedStyle(value).fontSize:null,pngGlyphs:value?.querySelectorAll('image').length,
  below:v&&f?v.top>=f.bottom:false,inside:v?v.left>=0&&v.right<=innerWidth&&v.bottom<=innerHeight:false,composited:document.querySelector('.game-hud-layer')?.classList.contains('precrt-composited')});requestAnimationFrame(report);
}report();
export {};
