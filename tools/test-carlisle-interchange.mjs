// The detailed terrain must reopen through the actual public parser while
// preserving bounded allocation and rejection of opaque/hostile inputs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';

globalThis.window={location:{search:'?lite'},addEventListener(){}};
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {normalizeCustomLevelData:normalize,normalizeUserLevelEntries,parseCustomLevelJson:parse,levelJsonTextWithinLimits:bounded,MAX_LEVEL_FILE_BYTES,MAX_LEVEL_PACK_BYTES}=await server.ssrLoadModule('/src/level.ts');
 const {CARLISLE_COAST_LEVEL:data}=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 const text=JSON.stringify(data),bytes=Buffer.byteLength(text);
 assert.equal(MAX_LEVEL_FILE_BYTES,8*1024*1024,'explicit bounded detailed-level allowance');
 assert.equal(MAX_LEVEL_PACK_BYTES,16*1024*1024,'published pack allocation bound remains');
 assert.ok(bytes>5*1024*1024&&bytes<MAX_LEVEL_FILE_BYTES,'positive fixture exercises the former byte boundary');
 assert.ok(bounded(text),'actual detailed JSON fits the lexical preflight');
 assert.ok(JSON.stringify(parse(text))===text,'real detailed terrain parses and migrates without losing serialized geometry');
 assert.ok(JSON.stringify(normalize(data))===text,'real detailed terrain is editor portable; JSON treats signed zero as zero');
 const packText=await readFile(new URL('../public/levels.json',import.meta.url),'utf8'),pack=JSON.parse(packText);
 assert.ok(bounded(packText,MAX_LEVEL_PACK_BYTES,14),'actual combined published pack passes its distinct lexical budget');
 assert.ok(normalizeUserLevelEntries(pack.levels),'actual combined pack normalizes every independent entry');
 const base=()=>({v:1,name:'Bounded native course',spawn:[0,1,0],killY:-20,components:[{t:'platform',p:[0,0,0],s:[20,1,30]},{t:'gate',p:[0,.5,-10]}]});
 let checks=0;
 const reject=(d,label)=>{assert.equal(normalize(d),null,label);checks++;};
 const oversized=' '.repeat(MAX_LEVEL_FILE_BYTES+1);
 assert.equal(bounded(oversized),false,'reject >8MiB before parsing');
 assert.equal(parse(oversized),null,'parser rejects >8MiB input');checks+=2;
 assert.equal(bounded(' '.repeat(MAX_LEVEL_PACK_BYTES+1),MAX_LEVEL_PACK_BYTES,14),false,'pack retains its 16MiB byte bound');checks++;
 assert.equal(bounded('['.repeat(13)+'0'+']'.repeat(13)),false,'lexical nesting remains bounded');checks++;
 const deep=base();deep.extra={};let nested=deep.extra;for(let i=0;i<14;i++){nested.child={};nested=nested.child;}reject(deep,'decoded nesting remains bounded');
 const getter=base();let invoked=false;Object.defineProperty(getter,'name',{enumerable:true,get(){invoked=true;return 'opaque getter';}});reject(getter,'accessors rejected');assert.equal(invoked,false,'accessor is never invoked');checks++;
 const cyclic=base();cyclic.extra=cyclic;reject(cyclic,'cycles rejected');
 reject({...base(),extra:new URL('https://example.invalid')},'opaque prototype object rejected');
 reject({...base(),constructor:{polluted:true}},'prototype-bearing field rejected');
 reject({...base(),payload:'<script>opaque</script>'},'unknown payload field rejected');
 const triangle={t:'mesh',p:[0,0,0],vertices:[0,0,0,1,0,0,0,0,1],indices:[0,1,2]};
 const shadowDecor={t:'decor',dkind:'coastv2buttress',p:[0,0,0]};
 for(const castShadow of [false,true])assert.ok(normalize({...base(),components:[{...shadowDecor,castShadow}]}),'explicit scenery shadow flag is portable');
 reject({...base(),components:[{...shadowDecor,castShadow:'false'}]},'scenery shadow flag must remain boolean');
 for(const field of ['opacity','fog','materialStyle'])reject({...base(),components:[{...shadowDecor,[field]:field==='opacity'?.5:field==='fog'?false:'water'}]},'mesh-only material property cannot leak onto scenery');
 reject({...base(),components:[{t:'platform',p:[0,0,0],s:[10,1,10],castShadow:false}]},'shadow override does not broaden unrelated component fields');
 for(const t of ['platform','crumble','mover'])assert.ok(normalize({...base(),components:[{t,p:[0,0,0],s:[3.2,1,8],tex:'coast-timber'}]}),'small timber skins are portable');
 reject({...base(),components:[{t:'platform',p:[0,0,0],s:[3.2,1,20001],tex:'coast-timber'}]},'timber length remains bounded');
 reject({...base(),components:Array.from({length:600},()=>({t:'platform',p:[0,0,0],s:[3.2,1,20000],tex:'coast-timber'}))},'timber kit charges the aggregate generated-work budget');
 // Both independently exercise aggregate mesh work limits under the larger
 // scalar allowance; a per-component overflow would be a weaker proof.
 const vertexOwner={...triangle,vertices:Array(4096*3).fill(0)};
 reject({...base(),components:Array.from({length:25},()=>({...vertexOwner,vertices:[...vertexOwner.vertices]}))},'aggregate >100k vertices rejected');
 const triangleOwner={...triangle,indices:Array(4096*3).fill(0)};
 reject({...base(),components:Array.from({length:25},()=>({...triangleOwner,indices:[...triangleOwner.indices]}))},'aggregate >100k triangles rejected');
 reject({...base(),components:[{...triangle,vertices:Array(4096*3+3).fill(0)}]},'per-component vertex bound remains');
 reject({...base(),components:[{...triangle,indices:Array(4096*3+3).fill(0)}]},'per-component triangle bound remains');
 console.log(`PASS Carlisle interchange: ${bytes} bytes of actual detailed terrain reopen unchanged; ${checks} independent oversized/depth/accessor/cycle/prototype/payload/mesh-budget rejection checks. File8MiB, pack16MiB, generated mesh work bounds retained.`);
}finally{await server.close();}
