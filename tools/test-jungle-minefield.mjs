import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
const source=await readFile(new URL('./test-life-multihit-crates.mjs',import.meta.url),'utf8');
new Function('noop',source.slice(source.indexOf('function installHeadlessDom()'),source.indexOf('const held ='))+'installHeadlessDom();')(()=>{});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn;console.warn=()=>{};const levels=[];
try {
 const {Level,normalizeCustomLevelData,setEditorBuild}=await server.ssrLoadModule('/src/level.ts');
 const {Player}=await server.ssrLoadModule('/src/player.ts');
 const m=await server.ssrLoadModule('/src/levels/jungle-minefield.ts');
 const data=m.JUNGLE_MINEFIELD_LEVEL;
 assert.ok(normalizeCustomLevelData(data),'new level must survive editor validation');
 assert.ok(m.MINEFIELD_MINES.length>900,'the jungle must be densely mined');
 assert.equal(data.components.filter(c=>c.t==='gate').length,1);
 for(const [x,,z] of m.MINEFIELD_MINES){
  assert.ok(Math.abs(x-m.minefieldTrail(-z))>=1.85,'safe trail overlaps a pressure plate');
  assert.ok(m.MINEFIELD_CHECKPOINTS.every(s=>Math.abs(s+z)>5.3),'checkpoint clearing is mined');
 }
 const make=(editor=false)=>{
  setEditorBuild(editor);
  const fixture={v:1,name:'Buried mine fixture',spawn:[0,.1,3],killY:-12,components:[
   {t:'platform',p:[0,-.5,0],s:[20,1,20]},
   {t:'crate',kind:'nitro',invisible:true,p:[0,-.88,0]},
   {t:'crate',kind:'nitro',invisible:true,p:[1.23,-.88,0]},
   {t:'crate',kind:'nitro',p:[-5,0,0]},
   {t:'checkpoint',p:[6,0,0]},{t:'gate',p:[0,0,-8]}]};
  const l=new Level(new THREE.Scene(),{id:'mine-fixture',name:fixture.name,data:fixture});levels.push(l);return l;
 };
 const l=make(),[mine,neighbor,ordinary]=l.crates;
 assert.equal(mine.concealed,true);assert.equal(mine.mesh.visible,false);
 assert.ok(Math.abs(mine.box.max.y-.08)<1e-6,'pressure contact must sit at ground level');
 assert.ok(Math.abs(mine.box.min.y+.88)<1e-6,'floor repair unearthed the mine');
 assert.equal(mine.explosiveBundle,undefined,'hidden mines should not allocate visible dynamite assemblies');
 assert.equal(ordinary.mesh.visible,true);assert.ok(ordinary.explosiveBundle);
 for(let i=0;i<60;i++)l.update(1/60);
 assert.equal(mine.mesh.visible,false);assert.ok(Math.abs(mine.mesh.position.y+.4)<1e-6,'mine bobbed out of burial');
 l.detonate(mine);assert.ok(l.explosions[0].center.y>=0,'burst must emerge above ground');
 for(let i=0;i<20;i++)l.update(1/60);
 assert.equal(neighbor.alive,false,'nearby mines did not chain');
 l.activateCheckpoint(l.checkpoints[0],2);
 l.reset(false);assert.equal(mine.alive,false,'banked explosion restored after checkpoint');
 l.reset(true);assert.equal(mine.alive,true);assert.equal(mine.mesh.visible,false);
 l.activateCheckpoint(l.checkpoints[0],0);l.detonate(mine);l.reset(false);
 assert.equal(mine.alive,true);assert.equal(mine.mesh.visible,false,'soft reset revealed the mine');
 assert.equal(l.captureData().components.filter(c=>c.kind==='nitro'&&c.invisible).length,2);
 const player=new Player(l.scene);player.respawn(l,true);player.pos.set(0,.01,0);player.invulnTimer=0;
 const input={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,consumeEdges(){}};
 for(let i=0;i<8&&player.state!=='dead';i++){player.step(1/60,input,l);l.update(1/60);}
 assert.equal(player.state,'dead','stepping on the buried contact must cause a blast death');
 const editor=make(true);assert.equal(editor.crates[0].mesh.visible,true,'editor cannot locate buried mines');
 assert.ok(normalizeCustomLevelData(editor.captureData()));setEditorBuild(false);
 console.log(`PASS jungle minefield: ${m.MINEFIELD_MINES.length} concealed mines, safe trail/clearings, native contact death, chain blasts, editor capture and hard/soft checkpoint restoration.`);
}finally{for(const l of levels)l.dispose();await new Promise(r=>setTimeout(r,30));console.warn=warn;await server.close();}
