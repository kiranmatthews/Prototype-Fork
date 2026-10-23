import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {makeInput} from './jungle-cup-harness.mjs';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
  const {TUNING,TUNING_RANGES,TUNING_SECTIONS,TUNING_LABELS}=await server.ssrLoadModule('/src/tuning.ts');
  const {Recorder,Replayer,isReplayFile}=await server.ssrLoadModule('/src/replay.ts');
  const original={...TUNING},key='boardAbandonSteering';
  try{
    assert.equal(TUNING[key],25);
    assert.deepEqual(TUNING_RANGES[key],{min:0,max:100,step:1});
    assert.equal(TUNING_SECTIONS.flatMap(s=>s.keys).filter(k=>k===key).length,1);
    assert.ok(TUNING_SECTIONS.find(s=>s.title==='JUMPS & AIR').keys.includes(key));
    assert.equal(TUNING_LABELS[key],'Board Abandon Steering (%)');
    const recorder=new Recorder();recorder.start('rolling-bones');recorder.record(makeInput());
    TUNING[key]=40;recorder.record(makeInput({moveX:1}));
    const take=recorder.export();assert.ok(isReplayFile(take));
    assert.equal(take.tuning[key],25);assert.deepEqual(take.tuningChanges,[[1,key,40]]);
    TUNING[key]=15;
    const replay=new Replayer(),input=makeInput();replay.begin(take);
    assert.equal(TUNING[key],25);replay.feed(input);replay.feed(input);assert.equal(TUNING[key],40);
    replay.end();assert.equal(TUNING[key],15,'ending playback restores the live slider');
    const legacy={...take,tuning:{...take.tuning},tuningChanges:[]};delete legacy.tuning[key];
    replay.begin(legacy);assert.equal(TUNING[key],100,'older recordings retain their original strong steering');
    replay.end();assert.equal(TUNING[key],15);
    console.log('PASS board-abandon slider defaults/section, recorded live changes, legacy steering and restored live tuning.');
  }finally{Object.assign(TUNING,original);}
}finally{await server.close();}
