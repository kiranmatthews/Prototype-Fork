import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {resizeRendererSurface}=await server.ssrLoadModule('/src/render-quality/surfaceSize.ts');
 let width=1280,height=720,ratio=1,writes=0;
 const renderer={getSize:v=>v.set(width,height),getPixelRatio:()=>ratio,setDrawingBufferSize(w,h,r){width=w;height=h;ratio=r;writes++;}};
 for(let i=0;i<20;i++)assert.equal(resizeRendererSurface(renderer,1280,720,1),false);
 assert.equal(writes,0);assert.equal(resizeRendererSurface(renderer,960,540,1),true);assert.equal(writes,1);
 assert.equal(resizeRendererSurface(renderer,390,844,2),true);assert.equal(writes,2,'DPR and dimensions change in one allocation');
 assert.equal(resizeRendererSurface(renderer,0,844,2),false);assert.equal(resizeRendererSurface(renderer,390,NaN,2),false);assert.equal(writes,2,'invalid transient viewport is ignored');
 const {AssetLoadQueue}=await server.ssrLoadModule('/src/assetLoadQueue.ts');
 const queue=new AssetLoadQueue(2),pending=[];let active=0,peak=0,started=0,wanted=true;
 const load=()=>{active++;started++;peak=Math.max(peak,active);return new Promise(resolve=>pending.push(()=>{active--;resolve(started);}));};
 const a=queue.run(load),b=queue.run(load),c=queue.run(load,()=>wanted),d=queue.run(load);
 const cancelled=assert.rejects(c,/released/);wanted=false;await Promise.resolve();assert.equal(started,2);
 pending.shift()();await a;await new Promise(resolve=>setTimeout(resolve,0));assert.equal(started,3);assert.equal(peak,2);
 while(pending.length)pending.shift()();await Promise.all([b,d,cancelled]);
 await assert.rejects(queue.run(async()=>{throw Error('decode failed');}),/decode failed/);
 assert.equal(await queue.run(async()=>42),42,'a failed decoder releases its slot');
 const {GraphicsRecovery}=await server.ssrLoadModule('/src/graphicsRecovery.ts');
 let lost=0,restored=0,removed=0;const overlayChildren=[];
 const canvas=new EventTarget();canvas.dataset={};canvas.ownerDocument={
  body:{append:node=>overlayChildren.push(node)},
  createElement:()=>({style:{},dataset:{},setAttribute(){},append(){},remove(){removed++;}}),
 };
 const recovery=new GraphicsRecovery(canvas,()=>lost++,()=>restored++);
 const event=new Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);assert.equal(recovery.lost,true);assert.equal(lost,1);
 let ready=false;const waiting=recovery.ready().then(()=>ready=true);await Promise.resolve();assert.equal(ready,false);
 canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));assert.equal(lost,1,'duplicate loss does not recreate resources');
 canvas.dispatchEvent(new Event('webglcontextrestored'));await waiting;
 assert.equal(recovery.lost,false);assert.equal(restored,1);assert.equal(removed,1);assert.equal(canvas.dataset.graphicsState,'ready');
 console.log('PASS no-op viewport events, atomic DPR/size changes, bounded decoder concurrency, cancellation and failure cleanup.');
}finally{await server.close();}
