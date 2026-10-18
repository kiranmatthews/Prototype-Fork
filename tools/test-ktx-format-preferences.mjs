import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {ktxFormatPreferences,separateKtxFormatPreferences} from './ktx-format-preferences.mjs';
const source=await readFile(new URL('../node_modules/three/examples/jsm/loaders/KTX2Loader.js',import.meta.url),'utf8');
const fixed=separateKtxFormatPreferences(source);
const desktopWorker=separateKtxFormatPreferences(KTX2Loader.BasisWorker.toString());
assert.equal(separateKtxFormatPreferences(fixed),fixed,'watch builds may see an already corrected module');
assert.throws(()=>separateKtxFormatPreferences('upstream source changed'),/format selection changed/);
const plugin=ktxFormatPreferences();
assert.deepEqual(plugin.config().optimizeDeps.exclude,['three/examples/jsm/loaders/KTX2Loader.js']);
assert.equal(plugin.transform(source,'/unrelated/KTX2Loader.js'),null);
assert.equal(plugin.transform(source,'/work/node_modules/three/examples/jsm/loaders/KTX2Loader.js?v=1').code,fixed);
const start='const FORMAT_OPTIONS = [';
function select(code,capabilities){
 const section=code.slice(code.indexOf(start),code.indexOf('/** Concatenates N byte arrays. */'));
 assert.ok(section.length>1000&&section.length<10000,'exercise the installed decoder’s format-selection implementation');
 return new Function('BasisFormat','TranscoderFormat','EngineFormat','config',section+'\nreturn {getTranscoderFormat,ETC1S_OPTIONS,UASTC_OPTIONS};')(
  KTX2Loader.BasisFormat,KTX2Loader.TranscoderFormat,KTX2Loader.EngineFormat,capabilities);
}
const all={astcSupported:true,bptcSupported:true,dxtSupported:true,etc1Supported:true,etc2Supported:true,pvrtcSupported:true};
const before=select(source,all),after=select(fixed,all);
assert.equal(before.ETC1S_OPTIONS,before.UASTC_OPTIONS,'reproduce the upstream shared-array regression');
assert.notEqual(after.ETC1S_OPTIONS,after.UASTC_OPTIONS);
const desktop=select(desktopWorker,all);
assert.notEqual(desktop.ETC1S_OPTIONS,desktop.UASTC_OPTIONS,'the separately generated desktop worker receives the same fix');
const B=KTX2Loader.BasisFormat,T=KTX2Loader.TranscoderFormat,E=KTX2Loader.EngineFormat;
assert.equal(before.getTranscoderFormat(B.ETC1S,1024,1024,false).engineFormat,E.RGBA_BPTC_Format);
assert.deepEqual(after.getTranscoderFormat(B.ETC1S,1024,1024,false),{transcoderFormat:T.ETC1,engineFormat:E.RGB_ETC2_Format});
assert.deepEqual(after.getTranscoderFormat(B.ETC1S,1024,1024,true),{transcoderFormat:T.ETC2,engineFormat:E.RGBA_ETC2_EAC_Format});
for(const format of [B.ETC1S,B.UASTC_4x4])for(const alpha of [false,true])assert.deepEqual(desktop.getTranscoderFormat(format,1024,1024,alpha),after.getTranscoderFormat(format,1024,1024,alpha));
for(const alpha of [false,true])assert.deepEqual(after.getTranscoderFormat(B.UASTC_4x4,1024,1024,alpha),before.getTranscoderFormat(B.UASTC_4x4,1024,1024,alpha),'UASTC retains its preferred ASTC format');
for(const caps of [{bptcSupported:true,dxtSupported:true},{dxtSupported:true},{etc2Supported:true},{pvrtcSupported:true}]){
 const a=select(fixed,caps),b=select(source,caps);
 for(const format of [B.ETC1S,B.UASTC_4x4])for(const alpha of [false,true])assert.deepEqual(a.getTranscoderFormat(format,1024,1024,alpha),b.getTranscoderFormat(format,1024,1024,alpha),'single-family GPU fallback remains compatible');
}
assert.equal(select(fixed,{etc1Supported:true,bptcSupported:true}).getTranscoderFormat(B.ETC1S,1024,1024,false).engineFormat,E.RGB_ETC1_Format);
assert.equal(select(fixed,{etc1Supported:true,bptcSupported:true}).getTranscoderFormat(B.ETC1S,1024,1024,true).engineFormat,E.RGBA_BPTC_Format,'alpha skips the opaque ETC1 format');
const warn=console.warn;let warnings=0;console.warn=()=>warnings++;
try{
 assert.equal(select(fixed,{}).getTranscoderFormat(B.ETC1S,1024,1024,false).transcoderFormat,T.RGBA32);
 assert.equal(select(fixed,{pvrtcSupported:true}).getTranscoderFormat(B.UASTC_4x4,1000,1024,false).transcoderFormat,T.RGBA32);
 assert.equal(warnings,2);
}finally{console.warn=warn;}
console.log('PASS independent ETC1S/UASTC format priorities, native ETC, alpha, ASTC, BC7, DXT, PVRTC, RGBA fallback and dependency-change guard');
