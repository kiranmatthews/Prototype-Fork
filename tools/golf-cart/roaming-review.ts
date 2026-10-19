/** Local-only UI fixture: real race stepping, cart physics and renderer. */
if(!import.meta.env.DEV)throw new Error('Traffic review is development-only');
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
g.input.pollGamepad=()=>null;
const race=g.getSkateRace();race.onFinish=()=>{};let pilot=false,watch=-1,seed=0;
const nativeStep=race.step.bind(race);race.step=(dt:number,input:any)=>nativeStep(dt,pilot&&race.phase==='running'?race.drive(0):input);
const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args:any[])=>{
  const cart=g.getGolfCarts()?.physics.carts[watch];
  if(cart&&args[1]===g.camera){g.camera.position.set(cart.x+30,cart.y+34,cart.z+32);g.camera.lookAt(cart.x,cart.y,cart.z);g.camera.updateMatrixWorld(true);}
  return render(...args);
};
const panel=document.createElement('section');panel.setAttribute('aria-label','Fairway traffic review');panel.style.cssText='position:fixed;z-index:999999;left:10px;top:10px;padding:10px;background:#10291fea;color:#fff;font:12px monospace;max-width:400px;border-radius:10px';
const title=document.createElement('strong');title.textContent='FAIRWAY TRAFFIC · LOCAL REVIEW';panel.append(title,document.createElement('br'));
const trails:{x:number;z:number}[][]=Array.from({length:10},()=>[]);
function start(){race.start('race',seed);pilot=true;trails.forEach(t=>t.length=0);}
function button(label:string,action:()=>void){const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:8px;margin:3px';b.onclick=action;panel.append(b);}
button('Start race',start);button('New traffic pattern',()=>{seed++;start();});button('Follow skater',()=>{watch=-1;});
const select=document.createElement('select');select.setAttribute('aria-label','Watch cart');select.style.cssText='padding:8px;margin:3px';
for(let i=0;i<10;i++){const option=document.createElement('option');option.value=String(i);option.textContent=`Cart ${i+1}`;select.append(option);}select.onchange=()=>{watch=Number(select.value);};panel.append(select);
button('Watch selected cart',()=>{watch=Number(select.value);});button('Hide controls',()=>{panel.hidden=true;map.hidden=true;});
const status=document.createElement('output');status.style.cssText='display:block;white-space:pre-wrap;font-size:11px';panel.append(status);document.body.append(panel);
const map=document.createElement('canvas');map.width=280;map.height=405;map.setAttribute('aria-label','Course map: orange carts and trails, green racers, white race track');map.style.cssText='position:fixed;right:10px;bottom:10px;z-index:999998;background:#10291fed;border:1px solid #9bba8a;border-radius:10px';document.body.append(map);
const ctx=map.getContext('2d')!,sx=(x:number)=>(x+390)/804*260+10,sz=(z:number)=>(126-z)/1194*365+30;
let last=0;
function frame(now:number){
  panel.inert=false;
  if(now-last>250){last=now;const fleet=g.getGolfCarts(),carts=fleet?.physics.carts??[];
    const offroad=carts.filter((c:any)=>{const near=race.course.project({x:c.x,y:c.y,z:c.z});return near.distance>race.course.width(near.s)/2+5;}).length;
    const stats=fleet?.root.userData.traffic??{},riders=race.riders.slice(0,race.count);
    status.textContent=`Seed ${seed} · ${race.phase} · ${Math.round(race.elapsed)}s\n${carts.length} carts · ${offroad} on grass · ${stats.contacts??0} contacts · ${stats.knockdowns??0} knockdowns\n${Math.round(g.player.speed)} m/s · ${Math.round(riders[0]?.progress??0)} m\n${riders.filter((r:any)=>r.finish!==null).length}/${race.count} finished · ${riders.reduce((n:number,r:any)=>n+r.falls,0)} falls · ${carts.reduce((n:number,c:any)=>n+c.respawns,0)} cart resets`;
    ctx.clearRect(0,0,map.width,map.height);ctx.font='11px monospace';ctx.fillStyle='#f7f9d0';ctx.fillText('CARTS ROAM ACROSS THE ESTATE',10,17);
    ctx.strokeStyle='#e1e8ce';ctx.lineWidth=2;ctx.beginPath();race.course.knots.forEach((p:any,i:number)=>{if(i)ctx.lineTo(sx(p[0]),sz(p[2]));else ctx.moveTo(sx(p[0]),sz(p[2]));});ctx.stroke();
    carts.forEach((c:any,i:number)=>{const trail=trails[i];trail.push({x:c.x,z:c.z});if(trail.length>100)trail.shift();ctx.strokeStyle='#fbc55b77';ctx.lineWidth=1;ctx.beginPath();trail.forEach((p,j)=>{if(j)ctx.lineTo(sx(p.x),sz(p.z));else ctx.moveTo(sx(p.x),sz(p.z));});ctx.stroke();ctx.fillStyle=watch===i?'#fffc85':'#ffb541';ctx.beginPath();ctx.arc(sx(c.x),sz(c.z),4,0,Math.PI*2);ctx.fill();ctx.fillText(String(i+1),sx(c.x)+5,sz(c.z)-4);});
    for(const r of race.riders.slice(0,race.count)){ctx.fillStyle=r.id===0?'#6df8ff':'#94f271';ctx.fillRect(sx(r.player.pos.x)-2,sz(r.player.pos.z)-2,4,4);}
  }
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
