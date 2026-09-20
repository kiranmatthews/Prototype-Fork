import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {runtimeAsset} from './offline-build.mjs';
const html=await readFile(new URL('../public/update-game.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.equal(runtimeAsset('update-game.html',{bonus:10,counter:10}),false);
assert.doesNotMatch(script,/localStorage|sessionStorage|indexedDB|caches\.delete/,'updating must not reset player data');
for(const scope of ['https://example.test/Prototype-Fork/','https://example.test/',null])for(const online of [true,false]){
 const elements={update:{disabled:false},status:{textContent:''}};let unregistered=0,target=null;
 const location={href:'https://example.test/Prototype-Fork/update-game.html?level=treehouse-trail&playtest',replace:url=>target=url};
 runInNewContext(script,{URL,Date,Error,location,document:{getElementById:id=>elements[id]},
  navigator:{serviceWorker:{getRegistration:async()=>scope?{scope,unregister:async()=>{unregistered++;}}:undefined}},
  fetch:async url=>{assert.ok(String(url).includes('/update-game.html?check='));if(!online)throw Error('offline');return{ok:true,body:{cancel:async()=>{}}};}});
 await elements.update.onclick();
 assert.equal(unregistered,online&&scope==='https://example.test/Prototype-Fork/'?1:0,'only this exact application scope may be detached');
 if(online){const url=new URL(target);assert.equal(url.origin,'https://example.test');assert.equal(url.pathname,'/Prototype-Fork/');assert.equal(url.searchParams.get('level'),'treehouse-trail');assert.ok(url.searchParams.has('playtest'));}
 else{assert.equal(target,null);assert.equal(elements.update.disabled,false);}
}
console.log('PASS save-preserving update: exact worker scope, live connectivity guard, offline fallback and same-origin navigation.');
