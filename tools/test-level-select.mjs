import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import ts from 'typescript';
const fixture=await readFile(new URL('./test-game-flow-results.mjs',import.meta.url),'utf8');
const support=fixture.slice(fixture.indexOf('class FakeClassList'),fixture.indexOf('function findClass'));
const FakeElement=new Function('noop',support+'installHeadlessDom();return FakeElement;')(()=>{});
FakeElement.prototype.click=function(){if(!this.disabled)for(const listener of this.listeners.get('click')??[])listener({target:this});};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
 const {GameFlowUI}=await server.ssrLoadModule('/src/gameFlowUI.ts');
 const {CampaignStore,CAMPAIGN_LEVELS:levels,CAMPAIGN_ISLANDS:islands,CAMPAIGN_BOSSES:bosses,campaignLevelById}=await server.ssrLoadModule('/src/campaign.ts');
 const {inputPrompts}=await server.ssrLoadModule('/src/inputPrompts.ts');
 const campaign=new CampaignStore();campaign.startEphemeral();const calls=[];
 const ui=new GameFlowUI(campaign,{onResume:()=>calls.push('resume'),onLevelSelect:id=>calls.push(id),getLevelSelectFocus:()=> 'treehouse-trail',getPlayMode:()=> 'classic',onAudioOptions(){}},{sfxMuted:false,musicMuted:false});
 const rowKeys=()=>ui.navButtons.filter(b=>b.dataset.levelKey).map(b=>b.dataset.levelKey);
 ui.showMapSection('level-select');
 assert.deepEqual(rowKeys(),['treehouse-trail']);
 assert.deepEqual(ui.levelSelectIslands().map(i=>i.id),['island-1']);
 assert.ok(ui.panel.querySelectorAll('.game-island-arrow').every(button=>button.disabled));
 ui.changeLevelSelectIsland(1);assert.equal(ui.levelSelectIsland,'island-1');
 ui.updateLevelSelectChoice('beachside-run',true);assert.equal(ui.levelSelectKey,'treehouse-trail','locked name entered the detail panel');
 ui.levelSelectKey='beachside-run';ui.playSelectedLevel();assert.deepEqual(calls,[]);
 campaign.commitClear('treehouse-trail',{crystal:false,boxGem:false,comboGem:false});
 ui.showMapSection('level-select');assert.deepEqual(rowKeys(),['treehouse-trail','beachside-run']);
 ui.updateLevelSelectChoice('beachside-run',true);ui.playSelectedLevel();assert.deepEqual(calls,['beachfront']);
 ui.showPause({levelName:'Treehouse Trail',inWarpRoom:false});ui.openLevelSelect();ui.playSelectedLevel();assert.equal(ui.currentScreen,'confirm-level-select');
 ui.goBack();assert.equal(ui.currentScreen,'level-select');ui.goBack();assert.equal(ui.currentScreen,'pause');
 // A cup finish cannot reveal the next island; its victory can.
 for(const key of islands[0].levelKeys)campaign.active.levels[key].cleared=true;
 campaign.recordLevelFinished('jungle-cup');
 assert.deepEqual(ui.levelSelectIslands().map(i=>i.id),['island-1']);
 campaign.commitCompetitionWin('jungle-cup');
 ui.showMapSection('level-select');ui.changeLevelSelectIsland(1);
 assert.deepEqual(rowKeys(),['custard-creek']);
 campaign.commitClear('custard-creek',{crystal:false,boxGem:false,comboGem:false});
 ui.render();assert.deepEqual(rowKeys(),['custard-creek','tribal-run','waterfall-climb','test-course']);
 // Secret discovery is per slot: five clear gems reveal slot 2, not slot 1.
 campaign.startEphemeral();
 for(const key of islands[0].levelKeys.slice(0,5))campaign.active.levels[key].boxGem=true;
 assert.ok(!ui.levelSelectIslands().some(i=>i.id==='hidden-shores'));
 for(const d of bosses)Object.assign(campaign.active.levels[d.progressKey],{cleared:true,cup:true,raceWon:true});
 ui.showMapSection('level-select');ui.changeLevelSelectIsland(-1);
 assert.equal(ui.levelSelectIsland,'hidden-shores');assert.deepEqual(rowKeys(),['secret-2']);
 ui.levelSelectKey='secret-1';ui.render();assert.equal(ui.levelSelectKey,'secret-2','locked remembered selection leaked its preview');
 // Fully progressed fixtures expose every satisfied destination; the finale
 // stays hidden until an authored coloured-gem challenge actually exists.
 for(const d of levels)Object.assign(campaign.active.levels[d.progressKey],{cleared:true,boxGem:true,timeMedal:'silver',cup:true,raceWon:true});
 calls.length=0;ui.showMapSection('level-select');
 assert.equal(ui.levelSelectIslands().length,6);
 for(const island of islands) {
  const expected=island.levelKeys.filter(key=>key!=='secret-8');
  assert.equal(ui.levelSelectIsland,island.id);assert.deepEqual(rowKeys(),expected);
  for(const key of expected){
   ui.updateLevelSelectChoice(key,true);assert.equal(ui.levelSelectKey,key);
   const def=levels.find(d=>d.progressKey===key);
   assert.equal(ui.levelSelectPlay.disabled,!campaign.levelPlayable(key));
   if(def.placeholder){assert.match(ui.levelSelectDetail.textContent,/COMING SOON/);assert.match(ui.levelSelectPreview.src,/coming-soon.svg$/);}
   if(!campaign.levelPlayable(key)){ui.playSelectedLevel();assert.deepEqual(calls,[],'placeholder destination launched');}
  }
  ui.changeLevelSelectIsland(1);
 }
 assert.equal(ui.levelSelectIsland,'island-1');
 // Completion and tier-owned reward models remain tied to stable IDs.
 for(const d of levels.filter(d=>!d.placeholder))Object.assign(campaign.active.levels[d.progressKey],{cleared:true,crystal:true,boxGem:true,timeMedal:'silver',bestTime:64.15,trialTimes:[64.15,68.3],cup:true,raceWon:true});
 ui.showMapSection('level-select');ui.updateLevelSelectChoice('jungle',true);
 assert.match(ui.levelSelectDetail.textContent,/1:04.15/);assert.equal(ui.levelSelectDetail.querySelectorAll('.game-reward-slot').length,3);
 assert.ok(ui.levelSelectDetail.querySelectorAll('.game-reward-slot').some(slot=>slot.dataset.medal==='silver'));
 ui.updateLevelSelectChoice('jungle-cup',true);assert.match(ui.levelSelectDetail.textContent,/MOTU BEACH INVITATIONAL/);assert.doesNotMatch(ui.levelSelectDetail.textContent,/BEST TIMES/);
 ui.changeLevelSelectIsland(1);ui.updateLevelSelectChoice('test-course',true);ui.changeLevelSelectIsland(1);ui.changeLevelSelectIsland(-1);assert.equal(ui.levelSelectKey,'test-course');
 // Confirm edge and transition lock work on the new roster.
 const pad={id:'DualSense',mapping:'standard',connected:true,index:0,axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};
 inputPrompts.update(pad,false);calls.length=0;pad.buttons[0].pressed=true;
 ui.showMapSection('level-select');ui.update();assert.deepEqual(calls,[]);
 pad.buttons[0].pressed=false;ui.update();pad.buttons[0].pressed=true;ui.update();ui.update();assert.deepEqual(calls,['treehouse-trail']);
 ui.transitionActive=true;ui.playSelectedLevel();assert.equal(calls.length,1);ui.transitionActive=false;
 pad.buttons[0].pressed=false;ui.update();
 const {Input}=await server.ssrLoadModule('/src/input.ts');
 ui.showMapSection('level-select');assert.equal(ui.liveMapBackground,true);
 pad.buttons[17].pressed=true;ui.update();assert.equal(calls.at(-1),'resume','Touchpad did not close the map list');
 pad.buttons[17].pressed=false;ui.update();
 assert.equal(inputPrompts.resolve('mapLevelSelect').label,'Touchpad');
 assert.match(inputPrompts.resolve('mapLevelSelect').url,/P5_Touch_Pad/);
 inputPrompts.update({...pad,id:'DualShock 4'},false);assert.match(inputPrompts.resolve('mapLevelSelect').url,/P4_Touch_Pad_Stylized/);
 inputPrompts.update({...pad,id:'Xbox'},false);assert.equal(inputPrompts.resolve('mapLevelSelect').label,'View');
 // Gameplay input owns the Touchpad edge, including map travel and modal release guards.
 const input=new Input(true);input.pollGamepad=()=>pad;
 document.body.classList.add('world-map-active');
 pad.buttons[17].pressed=true;input.update();assert.equal(input.mapLevelSelectPressed,true);
 input.consumeEdges();input.update();assert.equal(input.mapLevelSelectPressed,false,'Touchpad repeats while held');
 input.armMenuReleaseGuard();input.update();assert.equal(input.mapLevelSelectPressed,false);
 pad.buttons[17].pressed=false;input.update();pad.buttons[17].pressed=true;input.update();assert.equal(input.mapLevelSelectPressed,true);
 input.consumeEdges();pad.buttons[17].pressed=false;input.update();document.body.classList.remove('world-map-active');pad.buttons[17].pressed=true;input.update();assert.equal(input.mapLevelSelectPressed,false,'map shortcut leaks into gameplay');
 // Touch an unlocked planned row to inspect it, then touch a built course to launch.
 inputPrompts.update(null,true);calls.length=0;ui.showMapSection('level-select');ui.changeLevelSelectIsland(1);
 const planned=ui.navButtons.find(b=>b.dataset.levelKey==='tribal-run');planned.click();
 assert.equal(ui.levelSelectKey,'tribal-run');assert.match(ui.levelSelectDetail.textContent,/COMING SOON/);assert.deepEqual(calls,[]);
 ui.navButtons.find(b=>b.dataset.levelKey==='test-course').click();assert.deepEqual(calls,['test']);
 ui.showMapSection('level-select');ui.panel.querySelector('.game-map-close').click();assert.equal(calls.at(-1),'resume');
 ui.levelSelectKey='nightworks';ui.levelSelectIsland='island-5';campaign.startEphemeral();ui.playSelectedLevel();assert.equal(calls.at(-1),'resume','stale completion launched a locked level after replacing save');
 ui.render();assert.equal(ui.levelSelectIsland,'island-1');assert.deepEqual(rowKeys(),['treehouse-trail']);assert.equal(ui.levelSelectKey,'treehouse-trail');assert.match(ui.levelSelectPreview.src,/treehouse-trail.jpg$/);
 // A touch switch out of gameplay still requires confirmation and supports cancel.
 calls.length=0;ui.showPause({levelName:'Treehouse Trail',inWarpRoom:false});ui.openLevelSelect();
 ui.navButtons.find(b=>b.dataset.levelKey==='treehouse-trail').click();
 assert.equal(ui.currentScreen,'confirm-level-select');assert.deepEqual(calls,[]);
 ui.navButtons.find(b=>b.textContent==='CANCEL').click();assert.equal(ui.currentScreen,'level-select');
 ui.navButtons.find(b=>b.dataset.levelKey==='treehouse-trail').click();
 ui.navButtons.find(b=>b.textContent==='SWITCH LEVEL').click();assert.deepEqual(calls,['treehouse-trail']);
 inputPrompts.update(null,false);
 // Execute the real host callback: locked levels cannot launch, and a
 // gameplay switch carries the run-forfeit flag into the existing transition.
 const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('main.ts',main,ts.ScriptTarget.Latest,true);
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='selectLevelFromMenu');
 const code=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const unlocked of [false,true])for(const isCampaignMap of [false,true]){
   const events=[];
   const handler=new Function('campaignLevelById','campaign','guardGameplayFromMenu','level','current','enterCampaignLevel',code+';return selectLevelFromMenu;')(
     campaignLevelById,{levelPlayable:()=>unlocked},()=>events.push('guard'),{isCampaignMap},{id:isCampaignMap?'warproom':'treehouse-trail'},(id,forfeit)=>events.push([id,forfeit]));
   handler('treehouse-trail');
   assert.deepEqual(events,unlocked?['guard',['treehouse-trail',!isCampaignMap]]:[]);
 }
 console.log('PASS unlock-based level/island discovery, independent secret slots, save-switch concealment, unlocked placeholders, reward previews, launch guards, remembered pages, controller and touch entry.');
} finally {await server.close();}

process.exit(0);
