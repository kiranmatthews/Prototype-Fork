import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
  const {StabilityReport,STABILITY_REPORT_KEY}=await server.ssrLoadModule('/src/stabilityReport.ts');
  let saved=null,writes=0;const storage={getItem:()=>saved,setItem(key,value){assert.equal(key,STABILITY_REPORT_KEY);saved=value;writes++;}};
  const first=new StabilityReport(storage,'build-one',{touchPoints:5},()=> 'first');
  first.record('destination:first-frame',{level:'jungle-cup',resources:{textures:40}});
  const next=new StabilityReport(storage,'build-two',{},()=> 'second');
  assert.equal(JSON.parse(saved).sessions[0].events.at(-1).stage,'destination:first-frame','an abrupt restart retains the previous last stage');
  for(let i=0;i<200;i++)next.record('stage-'+i,{level:'jungle-cup'});
  assert.equal(JSON.parse(saved).sessions[1].events.length,48);
  new StabilityReport(storage,'three',{});new StabilityReport(storage,'four',{});
  assert.deepEqual(JSON.parse(saved).sessions.map(s=>s.build),['build-two','three','four']);
  assert.ok(saved.length<16000,'diagnostics stay small');
  let denied=0;const unavailable=new StabilityReport({getItem(){throw Error('denied')},setItem(){denied++;throw Error('quota')}},'private',{});
  for(let i=0;i<100;i++)unavailable.record('play');assert.equal(denied,1,'storage failure cannot repeatedly interrupt the frame');
  new StabilityReport({getItem:()=>'{broken',setItem(){}},'recovery',{}).record('play');
  assert.ok(writes>200);console.log('PASS bounded local session history, last-stage survival, corrupt data and unavailable/quota-limited storage.');
}finally{await server.close();}
