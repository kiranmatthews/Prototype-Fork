import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createServer } from 'vite';
const fixture=await readFile(new URL('./test-campaign-death-flow.mjs',import.meta.url),'utf8');
const ast=ts.createSourceFile('fixture.mjs',fixture,ts.ScriptTarget.Latest,true);
const dom=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='installHeadlessDom');
new Function('noop',dom.getText(ast)+';installHeadlessDom();')(()=>{});
const storageListeners=[];
window.addEventListener=(type,listener)=>{if(type==='storage')storageListeners.push(listener)};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn;console.warn=(...args)=>{if(!/failed|procedural skateboard/i.test(String(args[0])))warn(...args)};
try {
 const {SkateboardSettings,DEFAULT_SKATEBOARD_SETTINGS}=await server.ssrLoadModule('/src/skateboard/settings.ts');
 const {DEFAULT_MAP_SKATEBOARD_SETTINGS:mapDefaults,MAP_SKATEBOARD_STORAGE_KEY}=await server.ssrLoadModule('/src/skateboard/mapSettings.ts');
 const {MapLevelPresentation}=await server.ssrLoadModule('/src/mapLevelPresentation.ts');
 assert.equal(mapDefaults.deckHalfWidth,.283);assert.equal(mapDefaults.topWear,0);
 const {evaluateSkateboardHalfWidth:width,evaluateSkateboardSurfaceHeight:height,createSkateboardPresentation}=await server.ssrLoadModule('/src/skateboard/model.ts');
 assert.equal(mapDefaults.deckTailLength,mapDefaults.deckNoseLength);
 assert.equal(mapDefaults.frontTruckLocalZ,-mapDefaults.rearTruckLocalZ);
 for(let i=0;i<=100;i++) {
  const u=i/100;
  assert.ok(Math.abs(width(mapDefaults,u)-width(mapDefaults,-u))<1e-10,'outline must mirror nose/tail');
  for(const across of [0,.5,1]) {
   const x=width(mapDefaults,u)*across,z=u*mapDefaults.deckNoseLength;
   assert.ok(Math.abs(height(mapDefaults,x,z)-height(mapDefaults,x,-z))<1e-10,'kick/concave must mirror nose/tail');
  }
 }
 assert.ok(MAP_SKATEBOARD_STORAGE_KEY.startsWith('solProto'));
 const game=new SkateboardSettings({storageKey:'solProtoBoardTestGame'});
 const map=new SkateboardSettings({storageKey:'solProtoBoardTestMap',defaults:mapDefaults});
 const host={getBoundingClientRect:()=>({x:0,y:0,width:500,height:180})};
 const card=new MapLevelPresentation(host,host,map);
 // Compare the actual painted sockets with the models in the print plane's
 // coordinates. Matching scales alone misses a stale slot offset or count.
 const assertRewardAlignment=()=>{
  const canvas=card.faceTexture.image,ctx=canvas.getContext('2d'),sockets=[];
  const ellipse=ctx.ellipse;
  ctx.ellipse=(x,y)=>sockets.push({x,y});
  try { card.paint({name:'ALIGNMENT',earned:[true,true,true],medal:'gold'},false); }
  finally { ctx.ellipse=ellipse; }
  assert.equal(sockets.length,card.rewards.length);
  card.scene.updateMatrixWorld(true);
  const {width,height}=card.face.geometry.parameters;
  card.rewards.forEach((reward,i)=>{
   const centre=card.face.worldToLocal(reward.getWorldPosition(reward.position.clone()));
   const x=(centre.x/width+.5)*canvas.width,y=(.5-centre.y/height)*canvas.height;
   assert.ok(Math.abs(x-sockets[i].x)<1e-7,`reward ${i} misses its printed socket horizontally by ${x-sockets[i].x} texture pixels`);
   assert.ok(Math.abs(y-sockets[i].y)<1e-7,`reward ${i} misses its printed socket vertically by ${y-sockets[i].y} texture pixels`);
   assert.ok(centre.z>0,'earned model must remain raised above the deck');
  });
 };
 assertRewardAlignment();
 assert.equal(card.board.userData.settings.deckHalfWidth,.283);
 const grip=card.board.getObjectByName('Deck_ContinuousRoundedKick').material[0].map;
 assert.equal(grip.name,'SkateboardDeck_Grip_Map_Plain');
 const pixels=grip.image.data;
 for(let i=0;i<pixels.length;i+=4) assert.ok(pixels[i]<=55,'map grip contains a bright centre stripe');
 const rider=createSkateboardPresentation(game.value);
 assert.equal(rider.getObjectByName('Deck_ContinuousRoundedKick').material[0].map.name,'SkateboardDeck_Grip_Default_Web');
 map.patch({mapTitleSize:110});
 assert.equal(card.boardDirty,false,'text-only edit rebuilt geometry');
 assert.equal(card.inkKey,'');
 assert.equal(new SkateboardSettings({storageKey:'solProtoBoardTestMap',defaults:mapDefaults}).value.mapTitleSize,110);
 assert.equal(JSON.parse(map.serialize()).settings.mapTitleSize,110);
 assert.equal(game.value.mapTitleSize,undefined);
 map.importJson(JSON.stringify({version:1,settings:{mapTitleSize:999}}));assert.equal(map.value.mapTitleSize,190);
 map.importJson(JSON.stringify({version:1,settings:{mapTitleSize:-1}}));assert.equal(map.value.mapTitleSize,48);
 map.reset();card.updateBoard();
 game.patch({deckHalfWidth:.42,topWear:.2});
 assert.equal(map.value.deckHalfWidth,.283);assert.equal(card.boardDirty,false,'rider edit dirtied the map board');
 map.patch({deckHalfWidth:.24,topWear:.9,overallScale:1.2});
 assert.equal(game.value.deckHalfWidth,.42);assert.equal(game.value.topWear,.2);
 assert.equal(card.boardDirty,true);card.updateBoard();
 assert.equal(card.board.userData.settings.deckHalfWidth,.24);
 assert.ok(Math.abs(card.board.userData.geometryStats.width-.48)<1e-5);
 assert.equal(card.face.scale.x,card.face.scale.y,'map print was stretched');
 assert.ok(card.rewards.every(p=>p.scale.x===card.face.scale.x),'icons drifted from their printed sockets');
 assertRewardAlignment();
 map.patch({deckTailLength:.75,deckNoseLength:1.1});card.updateBoard();
 card.anchor.rotation.z=.085;card.deckPivot.rotation.set(1.7,.05,0);
 assertRewardAlignment();
 card.deckPivot.rotation.set(0,0,0);
 const reloaded=new SkateboardSettings({storageKey:'solProtoBoardTestMap',defaults:mapDefaults});
 assert.equal(reloaded.value.deckHalfWidth,.24);assert.equal(reloaded.value.topWear,.9);
 map.reset();assert.equal(map.value.deckHalfWidth,.283);assert.equal(game.value.deckHalfWidth,.42);
 assert.equal(map.value.mapTitleSize,156);
 game.reset();assert.equal(game.value.deckHalfWidth,DEFAULT_SKATEBOARD_SETTINGS.deckHalfWidth);
 map.importJson(JSON.stringify({version:1,settings:{artworkScale:.8}}));
 assert.equal(map.value.artworkScaleX,.8);assert.equal(map.value.artworkScaleY,.8);
 assert.equal(map.value.deckHalfWidth,.283,'partial map import inherited gameplay defaults');
 assert.equal(map.value.mapTitleSize,156,'legacy JSON must inherit map text default');
 assert.equal(map.value.gripCenterStripe,false);
 const gameSnapshot=JSON.stringify(game.value);
 localStorage.setItem('solProtoBoardTestMap',JSON.stringify({version:1,settings:{deckHalfWidth:.51}}));
 for(const listener of storageListeners)listener({key:'solProtoBoardTestMap'});
 assert.equal(map.value.deckHalfWidth,.51);assert.equal(JSON.stringify(game.value),gameSnapshot);
 card.updateBoard();assert.equal(card.board.userData.settings.deckHalfWidth,.51);
 localStorage.removeItem('solProtoBoardTestMap');for(const listener of storageListeners)listener({key:'solProtoBoardTestMap'});
 assert.equal(map.value.deckHalfWidth,.283);
 const flow=await readFile(new URL('../src/gameFlowUI.ts',import.meta.url),'utf8');
 assert.doesNotMatch(flow,/SKATEBOARD TUNING|onSkateboardTuning|game-skateboard-tuning-open/,'mistaken main-menu entry remains');
 const lab=await readFile(new URL('../src/skateboard/lab.ts',import.meta.url),'utf8');
 assert.match(lab,/new MapLevelPresentation\(/,'lab does not preview the actual map card');
 console.log('PASS independent map/game board defaults, edits, reset, import, reload, cross-tab sync, fitted print/icons and menu correction.');
} finally { await server.close();console.warn=warn; }
