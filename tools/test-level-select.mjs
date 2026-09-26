import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import ts from 'typescript';

const fixture=await readFile(new URL('./test-game-flow-results.mjs',import.meta.url),'utf8');
const support=fixture.slice(fixture.indexOf('class FakeClassList'),fixture.indexOf('function findClass'));
const FakeElement=new Function('noop',support+'installHeadlessDom();return FakeElement;')(()=>{});

FakeElement.prototype.click=function(){if(!this.disabled)for(const listener of this.listeners.get('click')??[])listener({target:this});};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {GameFlowUI}=await server.ssrLoadModule('/src/gameFlowUI.ts');
 const {CampaignStore,CAMPAIGN_LEVELS,campaignLevelById}=await server.ssrLoadModule('/src/campaign.ts');
 const {inputPrompts}=await server.ssrLoadModule('/src/inputPrompts.ts');
 const {Input}=await server.ssrLoadModule('/src/input.ts');
 const campaign=new CampaignStore();campaign.startEphemeral();
 const calls=[];
 const callbacks={onResume:()=>calls.push('resume'),onLevelSelect:id=>calls.push(id),getLevelSelectFocus:()=> 'jungle',getPlayMode:()=> 'classic',onAudioOptions(){}};
 const ui=new GameFlowUI(campaign,callbacks,{sfxMuted:false,musicMuted:false});
 ui.showPause({levelName:'Jungle Ruins',inWarpRoom:false});
 assert.ok(ui.navButtons.some(b=>b.textContent==='LEVEL SELECT'));
 ui.navButtons.find(b=>b.textContent==='LEVEL SELECT').click();
 assert.equal(ui.currentScreen,'level-select');
 assert.equal(ui.levelSelectIslands().length,1);
 const rows=ui.navButtons.filter(b=>b.dataset.levelKey);
 assert.equal(rows.length,8);assert.equal(rows.filter(b=>!b.disabled).length,1);
 assert.equal(rows[0].dataset.levelKey,'treehouse-trail');
 assert.match(rows[0].textContent,/01  TREEHOUSE TRAIL/);
 assert.equal(ui.levelSelectKey,'treehouse-trail');
 assert.match(ui.levelSelectPreview.src,/treehouse-trail\.jpg$/);
 ui.changeLevelSelectIsland(1);assert.equal(ui.levelSelectIsland,'island-1');
 ui.levelSelectKey='test-course';ui.playSelectedLevel();assert.deepEqual(calls,[],'locked level launched');
 ui.updateLevelSelectChoice('treehouse-trail',true);ui.playSelectedLevel();
 assert.equal(ui.currentScreen,'confirm-level-select','changing the active course bypassed confirmation');
 ui.goBack();assert.equal(ui.currentScreen,'level-select');
 ui.goBack();assert.equal(ui.currentScreen,'pause');
 for(const def of CAMPAIGN_LEVELS)campaign.active.levels[def.progressKey]={cleared:true,crystal:true,boxGem:false,comboGem:true,timeRelic:false,timeMedal:'silver',bestTime:64.15,trialTimes:[64.15,68.3,72.8],...(def.competition?{cup:true}:{})};
 ui.openLevelSelect();ui.moveLevelSelectRow(1);assert.equal(ui.levelSelectKey,'test-course');
 assert.match(ui.levelSelectDetail.textContent,/1:04.15/);assert.ok(ui.levelSelectDetail.querySelectorAll('.game-reward-slot').some(slot=>slot.dataset.medal==='silver'));
 assert.doesNotMatch(ui.levelSelectDetail.textContent,/NOT COLLECTED|NOT EARNED/);
 assert.match(ui.levelSelectPreview.src,/test-course\.jpg$/);
 ui.updateLevelSelectChoice('jungle-cup',true);assert.match(ui.levelSelectDetail.textContent,/JUNGLE CUP/);assert.doesNotMatch(ui.levelSelectDetail.textContent,/TIME TRIAL RECORDS/);
 ui.updateLevelSelectChoice('test-course',true);
 ui.changeLevelSelectIsland(1);assert.equal(ui.levelSelectIsland,'island-2');assert.equal(ui.navButtons.filter(b=>b.dataset.levelKey).length,5);
 ui.changeLevelSelectIsland(-1);assert.equal(ui.levelSelectKey,'test-course','island selection was not remembered');
 const pad={id:'DualSense',mapping:'standard',connected:true,index:0,axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};
 inputPrompts.update(pad,false);
 pad.buttons[0].pressed=true;ui.showMapSection('level-select');ui.update();assert.deepEqual(calls,[],'opening press launched a level');
 pad.buttons[0].pressed=false;ui.update();pad.buttons[0].pressed=true;ui.update();ui.update();
 assert.deepEqual(calls,['jungle'],'held confirm launched repeatedly');
 ui.transitionActive=true;ui.playSelectedLevel();assert.deepEqual(calls,['jungle'],'transition allowed another launch');ui.transitionActive=false;
 pad.buttons[0].pressed=false;ui.update();
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
 // Touch rows are the entry action when the keyboard/controller footer is hidden.
 // Exercise the real click handlers, including selection before launch and Back.
 inputPrompts.update(null,true);assert.equal(inputPrompts.family,'touch');
 const touchCampaign=new CampaignStore();touchCampaign.startEphemeral();
 const touchCalls=[];
 const touchUI=new GameFlowUI(touchCampaign,{
   ...callbacks,onResume:()=>touchCalls.push('resume'),onLevelSelect:id=>touchCalls.push(id),getLevelSelectFocus:()=> 'treehouse-trail',
 },{sfxMuted:false,musicMuted:false});
 const touchRow=key=>{
   const row=touchUI.navButtons.find(button=>button.dataset.levelKey===key);
   assert.ok(row,`missing touch level row ${key}`);return row;
 };
 const touchClose=()=>{
   const close=touchUI.panel.querySelector('.game-map-close');
   assert.ok(close,'touch menu has no corner Back action');
   assert.equal(close.getAttribute('aria-label'),'Back');close.click();
 };
 touchUI.showMapSection('level-select');
 assert.equal(touchRow('jungle').disabled,true);
 touchRow('jungle').click();
 assert.equal(touchUI.levelSelectKey,'treehouse-trail','locked touch row changed selection');
 assert.deepEqual(touchCalls,[],'locked touch row launched a level');
 touchCampaign.active.levels['treehouse-trail'].cleared=true;
 touchUI.showMapSection('level-select');
 assert.equal(touchRow('jungle').disabled,false);
 touchRow('jungle').click();touchUI.update();touchUI.update();
 assert.equal(touchUI.levelSelectKey,'jungle','touch tap did not select its destination');
 assert.equal(touchRow('jungle').getAttribute('aria-selected'),'true');
 assert.deepEqual(touchCalls,['jungle'],'one touch tap must launch its selected map level exactly once');
 touchUI.showMapSection('level-select');touchClose();
 assert.deepEqual(touchCalls,['jungle','resume'],'touch corner Back did not return to the map');
 touchCalls.length=0;
 touchUI.showPause({levelName:'Treehouse Trail',inWarpRoom:false});
 touchUI.navButtons.find(button=>button.textContent==='LEVEL SELECT').click();
 touchRow('jungle').click();
 assert.equal(touchUI.currentScreen,'confirm-level-select','touch course switching bypassed confirmation');
 assert.deepEqual(touchCalls,[],'touch course switching launched before confirmation');
 touchUI.navButtons.find(button=>button.textContent==='CANCEL').click();
 assert.equal(touchUI.currentScreen,'level-select','touch Cancel did not return to level selection');
 assert.equal(touchUI.levelSelectKey,'jungle','touch Cancel lost the selected destination');
 assert.deepEqual(touchCalls,[],'touch Cancel abandoned the paused run');
 touchClose();assert.equal(touchUI.currentScreen,'pause','touch corner Back did not return to pause');
 assert.deepEqual(touchCalls,[],'leaving touch level selection resumed or switched the paused run');
 touchUI.navButtons.find(button=>button.textContent==='LEVEL SELECT').click();
 touchRow('jungle').click();touchClose();
 assert.equal(touchUI.currentScreen,'level-select','touch corner Back did not cancel the switch confirmation');
 assert.deepEqual(touchCalls,[],'touch corner Back confirmed a level switch');
 touchRow('jungle').click();
 touchUI.navButtons.find(button=>button.textContent==='SWITCH LEVEL').click();
 assert.deepEqual(touchCalls,['jungle'],'touch confirmation did not launch the selected level once');
 touchUI.hide();inputPrompts.update(null,false);
 // Execute the real host callback: locked levels cannot launch, and a
 // gameplay switch carries the run-forfeit flag into the existing transition.
 const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('main.ts',main,ts.ScriptTarget.Latest,true);
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='selectLevelFromMenu');
 const code=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const unlocked of [false,true])for(const isCampaignMap of [false,true]){
   const events=[];
   const handler=new Function('campaignLevelById','campaign','guardGameplayFromMenu','level','current','enterCampaignLevel',code+';return selectLevelFromMenu;')(
     campaignLevelById,{levelUnlocked:()=>unlocked},()=>events.push('guard'),{isCampaignMap},{id:isCampaignMap?'warproom':'treehouse-trail'},(id,forfeit)=>events.push([id,forfeit]));
   handler('treehouse-trail');
   assert.deepEqual(events,unlocked?['guard',['treehouse-trail',!isCampaignMap]]:[]);
 }
 console.log('PASS Level Select: pause/map access, island/level locks, remembered paging, saved stats, held confirm, PS4/PS5 Touchpad and View prompts, touch row launch/locks/Back/confirmation, release guards, Treehouse artwork and confirmed course switching.');
}finally{await server.close();}
