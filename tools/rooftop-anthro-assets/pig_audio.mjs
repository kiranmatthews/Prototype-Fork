// Edit licensed field recordings. No synthesized animal voice or runtime fetches.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const sourceDir=root+'/.img2threejs/rooftop-anthro/pig-audio',out=root+'/public/sfx/enemies';
await mkdir(sourceDir,{recursive:true});await mkdir(out,{recursive:true});
const sources=[
 {file:'pig-oink.wav',title:'Pig Oink',author:'qubodup',originalAuthor:'Jofae (formerly josepharaoh99)',
  source:'https://freesound.org/people/qubodup/sounds/442906/',originalSource:'https://freesound.org/people/Jofae/sounds/352698/',
  preview:'https://cdn.freesound.org/previews/442/442906_71257-hq.mp3',start:0,duration:.7435,fadeOut:.045},
 {file:'pig-squeal.wav',title:'Pig Squealing.mp3',author:'TheAcidRomance',
  source:'https://freesound.org/people/TheAcidRomance/sounds/260640/',
  preview:'https://cdn.freesound.org/previews/260/260640_2362629-hq.mp3',start:.45,duration:.84,fadeOut:.09},
];
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
const records=[];const hash=b=>createHash('sha256').update(b).digest('hex');
try{for(const source of sources){
 const original=sourceDir+'/'+source.file.replace('.wav','-hq.mp3');let bytes;
 try{bytes=await readFile(original);}catch{const response=await fetch(source.preview);if(!response.ok)throw Error('Audio download '+response.status);bytes=Buffer.from(await response.arrayBuffer());await writeFile(original,bytes);}
 const samples=await page.evaluate(async bytes=>{const ctx=new OfflineAudioContext(1,1,32000),buffer=await ctx.decodeAudioData(Uint8Array.from(bytes).buffer);const result=new Float32Array(buffer.length);for(let channel=0;channel<buffer.numberOfChannels;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<result.length;i++)result[i]+=data[i]/buffer.numberOfChannels;}return Array.from(result);},Array.from(bytes));
 const rate=32000,start=Math.round(source.start*rate),audio=Float32Array.from(samples.slice(start,start+Math.round(source.duration*rate)));
 const mean=audio.reduce((a,b)=>a+b,0)/audio.length;let peak=0;
 for(let i=0;i<audio.length;i++){audio[i]=(audio[i]-mean)*Math.min(1,i/(rate*.012),(audio.length-1-i)/(rate*source.fadeOut));peak=Math.max(peak,Math.abs(audio[i]));}
 const wav=Buffer.alloc(44+audio.length*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(audio.length*2,40);
 for(let i=0;i<audio.length;i++)wav.writeInt16LE(Math.round(audio[i]/peak*.86*32767),44+i*2);
 await writeFile(out+'/'+source.file,wav);records.push({...source,license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',verified:'2026-10-26',changes:'Excerpt, mono 32 kHz PCM, DC removal, 12 ms fade-in, stated fade-out, peak normalized to 0.86. Pitch variation is applied at playback.',sourceSha256:hash(bytes),sha256:hash(wav),bytes:wav.length});
}}
finally{await browser.close();}
await writeFile(out+'/pig-audio-license.json',JSON.stringify({sources:records},null,2)+'\n');console.log(JSON.stringify(records.map(({file,duration,bytes})=>({file,duration,bytes}))));
