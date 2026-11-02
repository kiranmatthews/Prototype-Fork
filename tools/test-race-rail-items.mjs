import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {RaceItemDeck}=await server.ssrLoadModule('/src/race/itemOdds.ts');
 const removed=['tnt','nitro','banana','horn','water-bomb','boomerang'],reports=[];
 for(const rank of [1,4,8]){
  const a=new RaceItemDeck(),b=new RaceItemDeck(),counts={},recent=[];a.reset(87557);b.reset(87557);
  for(let i=0;i<10000;i++){
   const item=a.draw(rank,120,true,true,false,'rail');
   assert.equal(item,b.draw(rank,120,true,true,false,'rail'),'Replay seed retains the exact roulette sequence');
   assert.ok(!removed.includes(item)&&!recent.includes(item));
   counts[item]=(counts[item]??0)+1;recent.push(item);if(recent.length>2)recent.shift();
  }
  assert.ok(counts['perfect-balance']>1500&&counts['perfect-balance']<3500,'Balance is useful but cannot dominate the roulette');
  reports.push({rank,counts});
 }
 for(const rally of [false,true]){
  const deck=new RaceItemDeck(),seen=new Set();deck.reset(42);
  for(let i=0;i<1000;i++)seen.add(deck.draw(4,120,true,true,rally));
  assert.ok(removed.every(item=>seen.has(item))&&!seen.has('perfect-balance'),'Other race pools retain their existing items');
 }
 console.log(JSON.stringify({reports,removed}));
}finally{await server.close();}
