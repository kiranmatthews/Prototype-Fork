import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {createServer} from 'vite';

const parse=async path=>ts.createSourceFile(path,await readFile(new URL(`../${path}`,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const main=await parse('src/main.ts'),flow=await parse('src/gameFlowUI.ts'),departure=await parse('src/bonusDeparture.ts'),loading=await parse('src/presentationLoading.ts');
const fn=(source,name)=>{
 const node=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
 assert.ok(node,`missing production function ${name}`);return node.getText(source).replace(/^export /,'');
};
const flowClass=flow.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='GameFlowUI');
const method=name=>{
 const node=flowClass.members.find(node=>node.name?.getText(flow)===name);
 assert.ok(node,`missing production flow method ${name}`);return node.getText(flow);
};
const code=ts.transpileModule([
 ...departure.statements.filter(ts.isVariableStatement).map(node=>node.getText(departure).replace(/^export /,'')),
 'const MINIMUM_VORTEX_MS=2000;',
 fn(departure,'bonusAlignmentPose'),fn(departure,'bonusDeparturePose'),fn(loading,'runLoadingTransition'),
 `class FlowForTest { ${['blocksGameplay','loadingPhase','transition'].map(method).join('\n')} }`,
 ...['clearBonusDeparture','clearBonusArrival','beginBonusArrival','startBonusDeparture','renderBonusDeparture','enterBonusRound','checkCampaignEntrances','advanceFrame'].map(name=>fn(main,name)),
 'globalThis.FlowForTest=FlowForTest; globalThis.loadingSequence=runLoadingTransition;',
].join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false}});
const {bonusTransferFrame,BONUS_TRANSFER_SECONDS}=await server.ssrLoadModule('/src/bonusTransfer.ts');
await server.close();
const noop=()=>{};
const classes=()=>({add:noop,remove:noop,toggle:noop});
function fixture(reducedMotion=false){
 const events=[],frames=[];
 const pos={x:3,y:1.05,z:-20};
 const player={
  pos:new THREE.Vector3(pos.x,pos.y,pos.z),group:new THREE.Group(),vVel:0,grounded:true,state:'ride',runTime:18.25,
  lives:4,fruit:90,masks:2,uberTimer:9,bonusMode:false,hubMode:false,competitionMode:false,ttActive:false,
  captureRunState(){return {pos:{...this.pos},runTime:this.runTime,lives:this.lives,fruit:this.fruit,masks:this.masks,uberTimer:this.uberTimer};},
  captureIdleFruit:()=>[],bankFlyingFruit:noop,
  collapseRenderInterpolation(){Object.assign(this.group.position,this.pos);},
  prepareStartPresentation(){Object.assign(this.group.position,this.pos);},
  prepareBonusAlignmentPresentation(){Object.assign(this.group.position,this.pos);},
  step(){throw new Error('departure advanced gameplay physics');},
  respawn(){events.push('respawn');},
 };
 const parent={allowsBonus:true,bonusRoundCompleted:false,timeTrial:false,bonusPlatformDiagnostics:{x:3,topY:1.05,z:-20},
  finishBox:new THREE.Box3(new THREE.Vector3(-4,0,-20),new THREE.Vector3(10,30,-18)),bonusReturnPoint:()=>({x:0,y:.1,z:-24}),setActive(on){events.push(['parentActive',on]);},
  updateSceneryPresentation:noop,update(){throw new Error('departure advanced the parent simulation');}};
 const input={pausePressed:false,restartPressed:true,jumpPressed:true,update:noop,
  consumeEdges(flush){assert.equal(flush,true);this.jumpPressed=false;this.restartPressed=false;events.push('edges');}};
 const context={
  bonusTransferFrame,THREE,camera:new THREE.PerspectiveCamera(),WARP_PAD_TOP:.733,bonusArrival:null,bonusTravelReviewRate:1,BONUS_TRANSFER_SECONDS:2.8,
  BonusWarpEffect:class {group=new THREE.Group();update(){}dispose(){}},updateWaterPresentation:noop,
  performance:{now:()=>0},Promise,console,document:{body:{classList:classes()}},window:{matchMedia:()=>({matches:reducedMotion})},
  player,level:parent,current:{id:'jungle',name:'Jungle'},bonusSession:null,bonusDeparture:null,competition:null,
  isCampaignLevel:()=>true,isCompetitionLevel:()=>false,campaignLevelById:()=>({name:'Jungle'}),resolveBonusLevel:()=>({}),
  Level:class {constructor(){this.hudMode='bonus';}},scene:{},loadedLevelId:'jungle',
  ui:{setBonusTransfer(frame){if(frame)events.push(['receipt',frame]);},hideMessage:noop,setEndlessDeaths:noop,setLevel:noop,setHUD(_state,dt){assert.equal(dt,0);}},
  competitionUI:{render:noop,setInputBlocked:noop,updateInput:noop},competitionPresentationSuppressed:()=>false,
  puffs:{clear:noop,attach:noop},swirls:{clear:noop},fieldSwirls:{clear:noop},
  input,recorder:{start:noop},endlessDeathsOn:false,
  applyRunModes:noop,applyTheme:noop,applyShadowFlags:noop,prepareActivePresentationAssets:async()=>{},currentHudState:()=>({}),
  reportedPresentationStage:'',recordPresentationStage:noop,graphicsRecovery:{lost:false},allowRenderFrame:()=>true,
  renderer:{info:{reset:noop}},clock:{getDelta:()=>1/60},animationStudio:null,characterLab:null,
  split2p:false,bossUI:{render:noop},editor:{active:false},paused:false,acc:7,sfx:{stopLoops:noop,play:noop},
  renderGameplayScene(){frames.push({renderX:player.group.position.x,renderY:player.group.position.y,physicalY:player.pos.y,time:player.runTime,uber:player.uberTimer,
    active:context.gameFlow.transitionActive,phase:context.gameFlow.loadingPhase});},
 };
 runInNewContext(code,context);
 const originalLoading=context.loadingSequence;
 context.runLoadingTransition=(hooks,reduced,vortex)=>originalLoading({...hooks,
  phase(phase){events.push(phase);hooks.phase(phase);},wait:async()=>{},paint:async()=>{},now:()=>0},reduced,vortex);
 const instance=new context.FlowForTest();
 Object.assign(instance,{transitionActive:false,startupLoading:false,screen:null,transitionPhase:null,reducedMotion,
  cursor:{classList:classes()},invalidatePreCrt:noop,requestGameplayFrame:noop,syncVortexBodyClass:noop,
  transitionCurtain:{hidden:true,classList:classes(),offsetWidth:0,querySelectorAll:()=>[],replaceChildren:noop},
  callbacks:{onTransitionComplete(){events.push('complete');}},setWarpRoom:noop,hide:noop,update:noop,
 });
 const transition=instance.transition.bind(instance);
 instance.transition=(...args)=>context.pending=transition(...args);
 context.gameFlow=instance;
 return {context,events,frames,player,parent,input};
}

for(const reducedMotion of [false,true]){
 const f=fixture(reducedMotion),{context:c,events,frames,player,input}=f;
 c.enterBonusRound(true);
 assert.equal(c.gameFlow.blocksGameplay,true,'input lock must begin before departure');
 assert.equal(c.gameFlow.loadingPhase,null,'landing must remain uncovered');
 const original=c.bonusDeparture;
 assert.ok(original);
 c.enterBonusRound(true);
 await Promise.resolve();
 assert.equal(c.bonusDeparture,original,'a duplicate trigger cancelled the active departure');
 assert.equal(events.includes('cover'),false,'the screen covered before any landing frame');
 for(let frame=0;frame<100&&c.bonusDeparture;frame++){
  c.advanceFrame(frame*1000/60);
  assert.equal(player.pos.y,1.05,'visible lift moved the collision body');
  assert.equal(player.group.position.y,player.pos.y,'render transform leaked after drawing');
  assert.equal(player.runTime,18.25,'departure advanced the run clock');
  assert.equal(player.uberTimer,9,'departure consumed carried invincibility');
  assert.equal(c.acc,0,'frozen time accumulated for later physics catch-up');
  await Promise.resolve();
  if(c.gameFlow.loadingPhase)break;
 }
 await c.pending;
 assert.equal(input.jumpPressed,false);assert.equal(input.restartPressed,false);
 assert.ok(frames.length>=39,'landing beat was shorter than 650ms at 60Hz');
 const held=frames.slice(0,38);
 assert.ok(held.every(frame=>frame.renderY===1.05),'character lifted before landing could read');
 assert.ok(frames.every(frame=>frame.physicalY===1.05&&frame.active&&frame.phase===null),'departure escaped its frozen uncovered phase');
 if(reducedMotion)assert.ok(frames.every(frame=>frame.renderY===1.05),'reduced motion still translated the character');
 else {
  assert.ok(frames.at(-1).renderY>=8.04,'character did not complete the visible upward warp');
  assert.ok(frames.slice(39).every((frame,index,all)=>!index||frame.renderY>=all[index-1].renderY),'upward warp reversed');
 }
 assert.ok(events.indexOf('cover')>events.indexOf('edges'),'cover started before the landing was presented');
 assert.ok(events.indexOf('respawn')>events.indexOf('cover'),'destination loaded before black covered the departure');
 assert.equal(c.bonusDeparture,null,'completed transition retained a stale departure');
 assert.equal(c.current.id,'bonus:jungle');
 assert.equal(c.gameFlow.blocksGameplay,false,'completion retained the input lock');
}
for(const reduced of [false,true]){
 const {context:c,player,frames}=fixture(reduced);player.pos.x=4.45;
 c.enterBonusRound(true);
 for(let frame=0;frame<100&&!c.gameFlow.loadingPhase;frame++){
  c.advanceFrame(frame*1000/60);await Promise.resolve();
  assert.equal(player.pos.x,4.45,'centering moved the physical player');
  assert.equal(player.group.position.x,4.45,'centering transform leaked after the render');
 }
 await c.pending;
 assert.ok(frames.slice(0,5).every(f=>f.renderX===4.45),'assist skipped the brief landing pause');
 assert.ok(frames.slice(28,38).every(f=>Math.abs(f.renderX-3)<1e-8&&Math.abs(f.renderY-1.05)<1e-8),'hop did not settle at the center before warp');
 const alignmentFrames=frames.slice(6,27);
 if(reduced)assert.ok(alignmentFrames.every(f=>f.renderY===1.05));
 else assert.ok(Math.max(...alignmentFrames.map(f=>f.renderY))>1.45,'off-center landing slid instead of hopping');
}
{
 const {context:c,player,parent}=fixture();
 const enabled=[];parent.consumeBonusLanding=(_position,state)=>{enabled.push(state.enabled);return false;};
 player.skateCameraBailing=true;c.checkCampaignEntrances();
 player.skateCameraBailing=false;c.checkCampaignEntrances();
 assert.deepEqual(enabled,[false,true],'wipeout state did not disable the landing gate');
}
for(const invalid of ['disallowed','completed','trial','levelTrial','competition','countdown']){
 const {context:c}=fixture();
 if(invalid==='disallowed')c.level.allowsBonus=false;
 if(invalid==='completed')c.level.bonusRoundCompleted=true;
 if(invalid==='trial')c.player.ttActive=true;
 if(invalid==='levelTrial')c.level.timeTrial=true;
 if(invalid==='competition')c.competition={simulating:true};
 if(invalid==='countdown')c.competition={phase:'countdown'};
 c.enterBonusRound(true);
 assert.equal(c.bonusDeparture,null,`${invalid} entry started a departure`);
 assert.equal(c.gameFlow.blocksGameplay,false,`${invalid} entry captured input`);
}
{
 const {context:c,frames}=fixture();c.enterBonusRound();await c.pending;
 assert.equal(frames.length,0,'direct/test entry played a false landing');
 assert.equal(c.current.id,'bonus:jungle');
}
{
 const {context:c,player,frames,events}=fixture();
 const receipt={parent:{fruit:90,lives:4,boxes:12,totalBoxes:80,deaths:2,modern:false},bonus:{fruit:26,lives:3,boxes:9,totalBoxes:9}};
 c.gameFlow.transitionActive=true;
 let complete=false;const pending=c.startBonusDeparture('exit',receipt).then(()=>complete=true);
 for(let frame=0;frame<245;frame++){
  c.advanceFrame(frame*1000/60);await Promise.resolve();
  assert.equal(complete,false,'return covered the scene before the complete receipt');
  assert.equal(player.fruit,90,'visual tally mutated gameplay inventory');
  assert.equal(player.lives,4,'visual tally credited a life early');
  assert.equal(player.runTime,18.25);assert.equal(player.uberTimer,9);
 }
 for(let frame=245;frame<250&&!complete;frame++){c.advanceFrame(frame*1000/60);await Promise.resolve();}
 await pending;assert.equal(complete,true);
 const receiptFrames=events.filter(e=>Array.isArray(e)&&e[0]==='receipt').map(e=>e[1]);
 assert.equal(receiptFrames.at(-1).parent.fruit,16);assert.equal(receiptFrames.at(-1).parent.lives,8);
 assert.equal(receiptFrames.at(-1).parent.boxes,21);assert.equal(receiptFrames.at(-1).complete,true);
 assert.ok(frames.length>=246,'exit missed the readable before-fade receipt');
 c.clearBonusDeparture();assert.equal(c.bonusDeparture,null);
}
console.log('PASS bonus departure: real entry/frame/transition functions hold landing, freeze physics/timers/input, lift render only, reject duplicates and ineligible entries, respect reduced motion and clean up on arrival');
