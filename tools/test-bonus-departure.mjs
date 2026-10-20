import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

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
 fn(departure,'bonusDeparturePose'),fn(loading,'runLoadingTransition'),
 `class FlowForTest { ${['blocksGameplay','loadingPhase','transition'].map(method).join('\n')} }`,
 fn(main,'enterBonusRound'),fn(main,'advanceFrame'),
 'globalThis.FlowForTest=FlowForTest; globalThis.loadingSequence=runLoadingTransition;',
].join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const noop=()=>{};
const classes=()=>({add:noop,remove:noop,toggle:noop});
function fixture(reducedMotion=false){
 const events=[],frames=[];
 const pos={x:3,y:1.05,z:-20};
 const player={
  pos:{...pos},group:{position:{...pos}},vVel:0,grounded:true,state:'ride',runTime:18.25,
  lives:4,fruit:90,masks:2,uberTimer:9,bonusMode:false,hubMode:false,competitionMode:false,ttActive:false,
  captureRunState(){return {pos:{...this.pos},runTime:this.runTime,lives:this.lives,fruit:this.fruit,masks:this.masks,uberTimer:this.uberTimer};},
  captureIdleFruit:()=>[],bankFlyingFruit:noop,
  collapseRenderInterpolation(){Object.assign(this.group.position,this.pos);},
  prepareStartPresentation(){Object.assign(this.group.position,this.pos);},
  step(){throw new Error('departure advanced gameplay physics');},
  respawn(){events.push('respawn');},
 };
 const parent={allowsBonus:true,bonusRoundCompleted:false,timeTrial:false,bonusPlatformDiagnostics:{},
  bonusReturnPoint:()=>({x:0,y:.1,z:-24}),setActive(on){events.push(['parentActive',on]);},
  update(){throw new Error('departure advanced the parent simulation');}};
 const input={pausePressed:false,restartPressed:true,jumpPressed:true,update:noop,
  consumeEdges(flush){assert.equal(flush,true);this.jumpPressed=false;this.restartPressed=false;events.push('edges');}};
 const context={
  performance:{now:()=>0},Promise,console,document:{body:{classList:classes()}},window:{matchMedia:()=>({matches:reducedMotion})},
  player,level:parent,current:{id:'jungle',name:'Jungle'},bonusSession:null,bonusDeparture:null,competition:null,
  isCampaignLevel:()=>true,campaignLevelById:()=>({name:'Jungle'}),resolveBonusLevel:()=>({}),
  Level:class {constructor(){this.hudMode='bonus';}},scene:{},loadedLevelId:'jungle',
  ui:{hideMessage:noop,setEndlessDeaths:noop,setLevel:noop,setHUD(_state,dt){assert.equal(dt,0);}},
  competitionUI:{render:noop,setInputBlocked:noop,updateInput:noop},competitionPresentationSuppressed:()=>false,
  puffs:{clear:noop,attach:noop},swirls:{clear:noop},fieldSwirls:{clear:noop},
  input,recorder:{start:noop},endlessDeathsOn:false,
  applyRunModes:noop,applyTheme:noop,applyShadowFlags:noop,prepareActivePresentationAssets:async()=>{},currentHudState:()=>({}),
  reportedPresentationStage:'',recordPresentationStage:noop,graphicsRecovery:{lost:false},allowRenderFrame:()=>true,
  renderer:{info:{reset:noop}},clock:{getDelta:()=>1/60},animationStudio:null,characterLab:null,
  split2p:false,bossUI:{render:noop},editor:{active:false},paused:false,acc:7,sfx:{stopLoops:noop},
  renderGameplayScene(){frames.push({renderY:player.group.position.y,physicalY:player.pos.y,time:player.runTime,uber:player.uberTimer,
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
console.log('PASS bonus departure: real entry/frame/transition functions hold landing, freeze physics/timers/input, lift render only, reject duplicates and ineligible entries, respect reduced motion and clean up on arrival');
