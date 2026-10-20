import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true}});
try{
 const {lazySource,lazySourceField}=await server.ssrLoadModule('/src/levels/lazy-source.ts');
 let attempts=0;
 const geometry=lazySource(()=>{if(++attempts===1)throw Error('retry');return {vertices:[1,2,3],indices:[0]};});
 const component={t:'mesh',vertices:[],indices:[]};
 lazySourceField(component,'vertices',()=>geometry().vertices);
 lazySourceField(component,'indices',()=>geometry().indices);
 assert.deepEqual(Object.keys(component),['t','vertices','indices']);assert.equal(attempts,0,'listing source fields must not build geometry');
 assert.throws(()=>component.vertices,/retry/);
 const copy=structuredClone(component);
 assert.deepEqual(copy,{t:'mesh',vertices:[1,2,3],indices:[0]});assert.equal(attempts,2,'one successful build must supply every geometry field');
 assert.equal(component.vertices,component.vertices);assert.equal(Object.getOwnPropertyDescriptor(component,'vertices').writable,true);
 component.vertices=[4,5,6];assert.deepEqual(component.vertices,[4,5,6],'materialized source fields retain ordinary editor assignment');
 const replaced={components:[]};let built=0;
 lazySourceField(replaced,'components',()=>{built++;return [{t:'gate'}];});
 replaced.components=[{t:'platform'}];assert.deepEqual(structuredClone(replaced),{components:[{t:'platform'}]});assert.equal(built,0,'explicit replacement must not build discarded source geometry');
 const undefinedValue=lazySource(()=>{built++;return undefined;});undefinedValue();undefinedValue();assert.equal(built,1,'undefined is still a successfully cached result');
 const c=await server.ssrLoadModule('/src/levels/country-club.ts'),h=await server.ssrLoadModule('/src/levels/hollowwake-descent.ts');
 assert.equal(c.COUNTRY_CLUB_LEVEL.name,'Country Club Circuit');assert.equal(typeof Object.getOwnPropertyDescriptor(c.COUNTRY_CLUB_LEVEL,'components').get,'function','course metadata must leave terrain deferred');
 const tunnels=h.HOLLOWWAKE_LEVEL.components.filter(c=>c.nm==='Seamless circular tunnel collision · no exposed coping');
 assert.equal(tunnels.length,h.HOLLOWWAKE_TUNNELS.length);
 assert.ok(tunnels.every(c=>typeof Object.getOwnPropertyDescriptor(c,'vertices').get==='function'),'route metadata must leave tunnel geometry deferred');
 assert.equal(typeof Object.getOwnPropertyDescriptor(h.HOLLOWWAKE_LEVEL.boulderChase,'path').get,'function');
 assert.equal(typeof Object.getOwnPropertyDescriptor(h.HOLLOWWAKE_LEVEL.boulderChase,'forks').get,'function');
 // Moving an unmaterialized source component must translate its existing
 // shape, not rebuild local vertices around the edited origin.
 const original=await server.ssrLoadModule('/src/levels/hollowwake-descent.ts?source-move-reference');
 const expected=original.HOLLOWWAKE_LEVEL.components.find(c=>c.nm==='Seamless circular tunnel collision · no exposed coping').vertices;
 const x=tunnels[0].p[0];tunnels[0].p[0]+=10;
 assert.deepEqual(tunnels[0].vertices,expected);tunnels[0].p[0]=x;
 for(const level of [c.COUNTRY_CLUB_LEVEL,h.HOLLOWWAKE_LEVEL]){
  const cloned=structuredClone(level);assert.deepEqual(level,cloned);assert.ok(cloned.components.length>0);
  assert.ok(cloned.components.some(c=>c.t==='gate'));
 }
 console.log('Lazy source data: metadata deferral, shared first use, failure retry, writable replacement, pre-build translation, structured clone and real course serialization passed.');
}finally{await server.close();}
