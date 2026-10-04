import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true}});
try {
 const {Recorder,Replayer,isReplayFile}=await server.ssrLoadModule('/src/replay.ts');
 const keys=['jumpHeld','grindHeld','spinHeld','grabHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferHeld','transferPressed'];
 const input=()=>Object.fromEntries([['moveX',0],['moveY',0],...keys.map(k=>[k,false])]);
 const recorder=new Recorder();recorder.start('codex-lab');
 const source=input();source.jumpHeld=true;recorder.record(source);
 source.jumpHeld=false;source.jumpCancelled=true;recorder.record(source);
 const take=recorder.export();assert.ok(isReplayFile(take));assert.deepEqual(take.b,[1,1<<12]);
 const player=new Replayer(),out=input();player.begin(take);player.feed(out);assert.equal(out.jumpCancelled,false);
 player.feed(out);assert.equal(out.jumpCancelled,true);assert.equal(out.jumpReleased,false);player.end();
 const legacy={...take,b:[1,1<<5]};assert.ok(isReplayFile(legacy));player.begin(legacy);player.feed(out);assert.equal(out.jumpCancelled,false);
 player.feed(out);assert.equal(out.jumpCancelled,false);assert.equal(out.jumpReleased,true);player.end();
 assert.equal(isReplayFile({...take,b:[0,1<<13]}),false,'undeclared channel accepted');
 console.log('PASS append-only cancellation replay bit, faithful abort playback, legacy lift semantics and unknown-bit rejection');
} finally {await server.close();}
