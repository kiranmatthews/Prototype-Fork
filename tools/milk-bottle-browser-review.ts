// Local HUD review, reusing the no-save interaction fixture.
import './interaction-browser-review';
const g=(window as any).__game,p=g.player,ui=g.ui;
const panel=document.querySelector('[data-testid="interaction-review"]')!;
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='bottle-status';
status.style.cssText='white-space:pre-wrap';panel.prepend(controls,status);
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:2px;padding:7px';b.onclick=fn;controls.append(b);};
let holdFull=false;
for(const count of [0,1,25,50,75,99,100])add(`Bottle ${count}`,()=>{
  holdFull=false;p.fruit=count;ui.resetHudTransients(p.fruitCollectionRevision,false);
});
add('Collect one milk',()=>p.collectFruit());
add('Hold full bottle',()=>holdFull=true);add('Resume bottle',()=>holdFull=false);
const nativeHud=ui.setHUD.bind(ui);
ui.setHUD=(state:any,dt:number)=>nativeHud(state,holdFull&&ui.milkBottle.fill.frame===100?0:dt);
function report(){status.textContent=JSON.stringify({milk:p.fruit,frame:ui.wumpaIcon.dataset.milkFrame,lives:p.lives,holdFull});requestAnimationFrame(report);}report();
