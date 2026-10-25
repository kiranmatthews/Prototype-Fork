import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5267',out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/storm-sky/local';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>{
 const g=window.__game,sky=g.scene.getObjectByName('Distant sky backdrop'),probe={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <map_fragment>'};sky.material.onBeforeCompile(probe,g.renderer);
 const data=sky.material.map?.source?.data;return{level:g.getCurrentLevel().id,preset:g.getLevel().skyPreset,skyVisible:sky.visible,image:data?[data.width,data.height]:null,haze:probe.uniforms.uSkyHazeStrength.value,hazeElevation:probe.uniforms.uSkyHazeElevation.value,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],camera:g.camera.rotation.toArray(),stamp:document.querySelector('.hud-build')?.textContent};
});
try{
 await page.goto(base+'/?playtest&level=rooftop-relay',{timeout:180000});await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);window.stormSkyLook=[0,0];g.input.pollGamepad=()=>({id:'Storm sky review controller',index:0,connected:true,mapping:'standard',axes:[0,0,...window.stormSkyLook],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))});});
 await page.waitForFunction(()=>window.__game.scene.getObjectByName('Distant sky backdrop').material.map?.source.data.width===1774,null,{timeout:30000});
 await page.waitForTimeout(800);const normal=await state();assert.equal(normal.preset,'coastal-storm');assert.equal(normal.skyVisible,true);assert.equal(normal.hazeElevation,.065);assert.deepEqual(normal.buffer,[2560,1440]);await page.screenshot({path:out+'/normal.png'});
 const views=[];for(const [name,axes]of [['look-up',[0,-1]],['look-left',[-1,-1]],['look-right',[1,-1]]]){
  await page.evaluate(v=>window.stormSkyLook=v,axes);await page.waitForTimeout(1600);views.push({name,...await state()});await page.screenshot({path:out+'/'+name+'.png'});
 }
 await page.evaluate(()=>{window.stormSkyLook=[0,0];return window.__game.switchLevel('codex-lab');});await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const dry=await state();assert.equal(dry.hazeElevation,.26,'Ordinary skies retain their original horizon treatment');
 await page.evaluate(()=>window.__game.switchLevel('rooftop-relay'));await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.waitForFunction(()=>window.__game.scene.getObjectByName('Distant sky backdrop').material.map?.source.data.width===1774,null,{timeout:30000});
 const revisited=await state();assert.equal(revisited.hazeElevation,.065);assert.equal(revisited.skyVisible,true);assert.deepEqual(errors,[]);
 await writeFile(out+'/sky-browser.json',JSON.stringify({base,normal,views,dry,revisited,errors},null,2)+'\n');console.log('PASS storm sky, native look controls, horizon haze and dry-level restoration',JSON.stringify({normal,dry,revisited,errors}));
}finally{await browser.close();}
