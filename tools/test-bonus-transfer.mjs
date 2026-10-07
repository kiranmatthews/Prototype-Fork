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
}finally{await server.close();}
