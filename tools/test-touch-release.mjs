import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
class Surface {
 listeners=new Map();children=[];style={};classes=new Set();
 classList={add:k=>this.classes.add(k),remove:k=>this.classes.delete(k),contains:k=>this.classes.has(k),toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k)};
 addEventListener(t,f){const a=this.listeners.get(t)??[];a.push(f);this.listeners.set(t,a)}
 emit(t,e={}){for(const f of this.listeners.get(t)??[])f(e)}
 appendChild(e){this.children.push(e)}setAttribute(){}setPointerCapture(){throw Error('capture unavailable')}
 getBoundingClientRect(){return this.rect??{left:0,top:0,width:100,height:100}}
}
const window=new Surface();window.location={search:'?touch'};
const document=new Surface();document.body=new Surface();document.head=new Surface();document.createElement=()=>new Surface();document.querySelector=()=>null;
const observers=[];class MutationObserver{constructor(f){observers.push(f)}observe(){}}
const source=await readFile(new URL('../src/touch.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('require','exports','window','document','MutationObserver',output)(()=>({sfx:{play(){}}}),exports,window,document,MutationObserver);
const tc=new exports.TouchControls();
const left=document.body.children.find(e=>e.className==='tc-zone tc-left'),right=document.body.children.find(e=>e.className==='tc-zone tc-right');
for(const [i,el] of [...tc.btnEls.values()].entries())el.rect={left:200+i*120,top:200,width:80,height:80};
const down=(zone,id,x,y,primary=false)=>{const e={pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:primary,preventDefault(){}};window.emit('pointerdown',e);zone.emit('pointerdown',e)};
const button=(key,id)=>{const r=tc.btnEls.get(key).rect;down(right,id,r.left+40,r.top+40)};
const neutral=()=>{assert.equal(tc.moveX,0);assert.equal(tc.moveY,0);for(const k of ['jumpHeld','grabHeld','spinHeld','grindHeld'])assert.equal(tc[k],false);for(const el of [...Object.values(tc.arrowEls),...tc.btnEls.values()])assert.equal(el.classList.contains('on'),false)};
for(const type of ['pointerup','pointercancel','lostpointercapture']) {
 down(left,1,50,0);button('x',2);button('o',3);
 window.emit(type,{pointerId:1});assert.equal(tc.moveY,0);assert.equal(tc.jumpHeld,true);
 window.emit(type,{pointerId:2});assert.equal(tc.jumpHeld,false);assert.equal(tc.grabHeld,true);
 window.emit(type,{pointerId:3});neutral();tc.releaseAll(true);
}
down(left,20,50,0);button('tri',30);
document.emit('touchend',{touches:[{identifier:999}]});assert.equal(tc.moveY,1);assert.equal(tc.grindHeld,true);
document.emit('touchend',{touches:[]});neutral();assert.equal(tc.consumeButtonPress('tri'),true,'quick tap lost');
button('x',2);window.emit('pointerup',{pointerId:2});window.emit('lostpointercapture',{pointerId:2});assert.equal(tc.consumeButtonPress('x'),true);
button('x',2);window.emit('pointercancel',{pointerId:2});assert.equal(tc.consumeButtonPress('x'),false);
for(const type of ['blur','pagehide','orientationchange','visibilitychange','touchcancel']) {
 down(left,1,50,0);button('sq',2);tc.transferUntil=tc.inventoryUntil=Infinity;
 if(type==='visibilitychange'){document.hidden=true;document.emit(type);document.hidden=false}
 else if(type==='touchcancel')document.emit(type,{touches:[]});else window.emit(type);
 neutral();assert.equal(tc.consumeButtonPress('sq'),false);assert.equal(tc.transferActive(),false);assert.equal(tc.inventoryActive(),false);
}
down(left,1,50,0);button('o',2);document.body.classList.add('game-shell-modal');observers.forEach(f=>f());neutral();
down(left,3,50,0);button('x',4);neutral();document.body.classList.remove('game-shell-modal');
down(left,1,50,0);button('o',2);tc.setMapMode(true);neutral();tc.setMapMode(false);
down(left,1,50,0);button('tri',2);down(left,10,0,50,true);assert.equal(tc.moveX,-1);assert.equal(tc.grindHeld,false);
window.emit('pointerup',{pointerId:10});neutral();
console.log('PASS per-finger touch release outside capture, lost capture, quick taps, native zero-contact fallback, lifecycle, modal/map and fresh-touch recovery');
