// Local HUD review, reusing the no-save interaction fixture.
import './interaction-browser-review';
const g=(window as any).__game,p=g.player,ui=g.ui;
const panel=document.querySelector('[data-testid="interaction-review"]')!;
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='fruit-status';
status.style.cssText='white-space:pre-wrap';panel.prepend(controls,status);
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:2px;padding:7px';b.onclick=fn;controls.append(b);};
for(const count of [0,1,25,50,75,99])add(`Fruit ${count}`,()=>{
  p.fruit=count;ui.resetHudTransients(p.fruitCollectionRevision,false);
});
add('Collect one fruit',()=>p.collectFruit());
function report(){status.textContent=JSON.stringify({fruit:p.fruit,label:ui.wumpaIcon.getAttribute('aria-label'),lives:p.lives});requestAnimationFrame(report);}report();
