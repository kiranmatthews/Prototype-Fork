import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {bonusTransferFrame,bonusTransferFlights,BONUS_TRANSFER_SECONDS}=await server.ssrLoadModule('/src/bonusTransfer.ts');
 for(const modern of [false,true])for(const fruit of [0,6,26,99,145])for(const lives of [0,3,7])for(const boxes of [0,6,21]){
  const receipt=Object.freeze({parent:Object.freeze({fruit:92,lives:4,boxes:12,totalBoxes:80,deaths:5,modern}),bonus:Object.freeze({fruit,lives,boxes,totalBoxes:21})});
  let previous=bonusTransferFrame(receipt,-1),maximumFlights=0;
  for(let t=0;t<=BONUS_TRANSFER_SECONDS+.1;t+=1/60){
   const f=bonusTransferFrame(receipt,t);
   for(const kind of ['fruit','lives','boxes']){
    assert.ok(f.paid[kind]>=previous.paid[kind]&&f.paid[kind]<=receipt.bonus[kind]);
    assert.ok(f.remaining[kind]<=previous.remaining[kind]&&f.remaining[kind]>=0);
    assert.ok(f.paid[kind]+f.remaining[kind]<=receipt.bonus[kind],'flight credits before launch');
   }
   assert.ok(f.parent.fruit>=0&&f.parent.fruit<100);assert.ok(f.parent.lives>=0);
   const flights=bonusTransferFlights(f);maximumFlights=Math.max(maximumFlights,flights.length);
   assert.ok(flights.every(x=>x.progress>=0&&x.progress<1));
   previous=f;
  }
  assert.ok(maximumFlights<=9,'unbounded per-frame mesh copies');
  const end=bonusTransferFrame(receipt,BONUS_TRANSFER_SECONDS);
  assert.deepEqual(end.remaining,{fruit:0,lives:0,boxes:0});
  assert.equal(end.parent.fruit,(92+fruit)%100);
  const awards=lives+Math.floor((92+fruit)/100);
  assert.equal(end.parent.lives,modern?Math.max(0,5-awards):4+awards);
  assert.equal(end.parent.boxes,12+boxes);assert.ok(end.complete);
  assert.equal(bonusTransferFlights(bonusTransferFrame(receipt,1,true)).length,0);
 }
 console.log('PASS 90 reward receipts: count-down/count-up conservation, flight latency/bounds, fruit rollover, classic/Modern inventory and reduced motion');

 // Exercise the actual reward painter, including a late load from the old
 // character. Both the total and each flying life must use the selected face.
 const painted=[], images=[];let precrt=false;
 const noop=()=>{};
 const ctx=new Proxy({drawImage:image=>painted.push(image.src)}, {get:(o,k)=>o[k]??noop});
 const element=()=>({style:{},append:noop,setAttribute:noop,getContext:()=>ctx,closest:()=>precrt?{}:null});
 globalThis.document={createElement:element};
 globalThis.window={innerWidth:1280,innerHeight:720,devicePixelRatio:1,dispatchEvent:noop,addEventListener:noop};
 globalThis.Image=class {
  listeners=new Map();complete=false;naturalWidth=0;naturalHeight=0;
  constructor(){images.push(this);}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  set src(value){this.url=value;if(value.includes('/fonts/'))queueMicrotask(()=>this.finish());}
  get src(){return this.url;}
  finish(){this.complete=true;this.naturalWidth=256;this.naturalHeight=256;this.onload?.();this.listeners.get('load')?.();}
 };
 const {BonusTransferHud}=await server.ssrLoadModule('/src/bonusTransferHud.ts');
 const {lifePortraitUrl,setLifePortraitStyle}=await server.ssrLoadModule('/src/lifePortrait.ts');
 const receipt={parent:{fruit:12,lives:4,boxes:5,totalBoxes:80,deaths:2,modern:false},bonus:{fruit:26,lives:3,boxes:18,totalBoxes:18}};
 const frame=bonusTransferFrame(receipt,1.1);
 const sources=Object.fromEntries(['fruit','boxes','lives'].map((kind,i)=>[kind,{x:100+i*420,y:620,width:70,height:70}]));
 for(const initial of ['skull','alternate']){
  setLifePortraitStyle(initial);
  const hud=new BonusTransferHud(element());
  hud.painter.draw=()=>false; // Text rendering is independently covered by the HUD checks.
  const original=images.findLast(image=>image.src===lifePortraitUrl(initial));
  assert.ok(original,'reward painter ignored the current character at construction');
  const selected=initial==='skull'?'alternate':'skull';
  hud.setLifeFaceUrl(lifePortraitUrl(selected));
  const current=images.at(-1);current.finish();original.finish();
  const imageCount=images.length;
  hud.setLifeFaceUrl(lifePortraitUrl(selected));
  assert.equal(images.length,imageCount,'unchanged portrait reloaded every HUD update');
  for(precrt of [false,true]){
   painted.length=0;hud.update(frame,sources);
   if(precrt)hud.paint(ctx,2560,1440);
   assert.ok(painted.length>=2,'reward total or flying life disappeared');
   assert.ok(painted.every(url=>url===lifePortraitUrl(selected)),'old head leaked into bonus rewards');
   assert.ok(hud.icons.some(icon=>icon.slot===0)&&hud.icons.some(icon=>icon.slot===1),'reward flight lost the shared crate/fruit model slots');
  }
  hud.update(null);assert.equal(hud.icons.length,0,'reward icons survived the return to normal play');
 }
 setLifePortraitStyle('skull');
 console.log('PASS bonus reward portraits: current head at construction, live switches, late old loads, DOM/pre-CRT totals and flights, shared crate/fruit slots and return cleanup');
}finally{await server.close();}
