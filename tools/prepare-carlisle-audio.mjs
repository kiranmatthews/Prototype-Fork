// Decode the licensed originals with the same native decoder used by the game.
// Run through the shared heavy-job lease. The Python mastering step consumes
// these temporary planar float files and retains the original downloads.
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const root='art/carlisle-shipyard/harbour-sound/source';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 for(const [file,id,offset,duration]of [['vistula-short.mp3','water',38,49],['wind1.wav','wind',0,59.9]]){
  const input=await readFile(root+'/'+file);
  const data=await page.evaluate(async({input,offset,duration})=>{
   const ctx=new OfflineAudioContext(2,32000,32000),bytes=Uint8Array.from(atob(input),c=>c.charCodeAt(0)),buffer=await ctx.decodeAudioData(bytes.buffer);
   const start=Math.round(offset*buffer.sampleRate),end=Math.min(buffer.length,start+Math.round(duration*buffer.sampleRate));
   return{rate:buffer.sampleRate,originalDuration:buffer.duration,channels:Array.from({length:buffer.numberOfChannels},(_,i)=>Array.from(buffer.getChannelData(i).slice(start,end)))};
  },{input:input.toString('base64'),offset,duration});
  for(const [i,channel]of data.channels.entries())await writeFile(`/tmp/carlisle-${id}-${i}.f32`,Buffer.from(new Float32Array(channel).buffer));
  await writeFile(`/tmp/carlisle-${id}.json`,JSON.stringify({file,rate:data.rate,originalDuration:data.originalDuration,offset,duration,channels:data.channels.length,frames:data.channels[0].length}));
  console.log(JSON.stringify({file,rate:data.rate,originalDuration:data.originalDuration,channels:data.channels.length,frames:data.channels[0].length}));
 }
}finally{await browser.close();}
