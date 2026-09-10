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
 assert.equal(rows.length,7);assert.equal(rows.filter(b=>!b.disabled).length,1);
 ui.changeLevelSelectIsland(1);assert.equal(ui.levelSelectIsland,'island-1');
 ui.levelSelectKey='test-course';ui.playSelectedLevel();assert.deepEqual(calls,[],'locked level launched');
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
 pad.buttons[0].pressed=true;ui.openLevelSelect();ui.update();assert.deepEqual(calls,[],'opening press launched a level');
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
 // Execute the real host callback with bounded spies: locks and bonus inventory must be preserved.
 const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('main.ts',main,ts.ScriptTarget.Latest,true);
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='selectLevelFromMenu');
 const code=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const unlocked of [false,true])for(const bonus of [false,true]){
   const events=[],player={lives:0,fruit:0,bankFlyingFruit(){events.push('bank');}};
   const handler=new Function('campaignLevelById','campaign','guardGameplayFromMenu','bonusSession','player','restoreCommittedRunRewards','enterCampaignLevel',code+';return selectLevelFromMenu;')(
     campaignLevelById,{levelUnlocked:()=>unlocked},()=>events.push('guard'),bonus?{parentState:{lives:3,fruit:47}}:null,player,()=>events.push('restore'),id=>events.push(id));
   handler('jungle');
   assert.deepEqual(events,unlocked?(bonus?['guard','restore','jungle']:['guard','bank','restore','jungle']):[]);
   if(unlocked&&bonus)assert.deepEqual([player.lives,player.fruit],[3,47]);
 }
 console.log('PASS Level Select: pause/map access, island/level locks, remembered paging, saved stats, held confirm, PS4/PS5 Touchpad and View prompts, release guards and bonus inventory handoff.');
}finally{await server.close();}
