import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// Compile the vetted balance statements directly from the pinned research
// checkout. Keep third-party C++ in /tmp, not copied into the game repository.
const sourcePath=process.env.THPS_PHYSICS_CPP||'/private/tmp/mall-recreation/research/decomp/game_src_physics.cpp';
const source=await readFile(sourcePath,'utf8');
const sourceSHA256=createHash('sha256').update(source).digest('hex');
const catchStart=source.indexOf('\tif (mRailStart != m6E4)');
const catchEnd=source.indexOf('\n\tmGrinds++;',catchStart);
const catchBody=source.slice(catchStart,catchEnd);
const balanceStart=source.indexOf('\tmBalance += mBalance / (GetStat(3) * 3 + 28)');
const balanceEnd=source.indexOf('\n\t{\n\t\tMATRIX Rail_RotMatrix;',balanceStart);
assert.ok(catchStart>0&&catchEnd>catchStart&&balanceStart>0&&balanceEnd>balanceStart);
const dir='/private/tmp/mall-recreation/balance-oracle24';await mkdir(dir,{recursive:true});
const cpp=`#include <iostream>\n#include <cstdint>\n#include <cstdlib>\n#define ABS(x) std::abs(x)
uint32_t seed=1; int Rnd(int n){seed=seed*1664525u+1013904223u;return int((uint64_t(seed)*n)>>32);}
int Cheat_L2KillsBaddies=0;
struct Button{int Pressed=0;};struct Pad{Button Left,Right;};
struct Skater{int mBalance=0,mBalanceVel=0,mRailTime=0,m204=0,mAX=0,mRailBails=0,mRailStart=-1,m6E4=-2,stat=5;Pad pad;Pad*mpPad=&pad;
int GetStat(int){return stat;}int GetBalanceVel(){return mBalanceVel;}void Bail(int){mRailBails++;}
void Catch(int id){m204=0;mRailStart=id;${catchBody}}
void Tick(char mode,int axis){mRailTime++;mAX=axis;if(mode=='g'){mBalance=mBalanceVel=mRailTime=0;}else if(mode=='r'){${source.slice(balanceStart,balanceEnd)}}}
};
int main(){Skater s;char mode;int a,b;while(std::cin>>mode>>a>>b){if(mode=='n'){s.mBalance=s.mBalanceVel=s.mRailTime=s.m204=s.mRailBails=0;s.mRailStart=-1;s.m6E4=-2;s.stat=a;seed=uint32_t(b);}else if(mode=='c')s.Catch(a);else s.Tick(mode,a);std::cout<<s.mBalance<<' '<<s.mBalanceVel<<' '<<s.mRailTime<<' '<<s.m204<<' '<<s.mRailBails<<'\\n';}}
`;
// Original Bail() already increments mRailBails separately after the call.
const compilerSource=cpp.replace('void Bail(int){mRailBails++;}','void Bail(int){}');
await writeFile(`${dir}/oracle.cpp`,compilerSource);
execFileSync('c++',['-std=c++17','-O2',`${dir}/oracle.cpp`,'-o',`${dir}/oracle`]);
await withSkateRuntime(async({server,THREE,Player,Level,scene,CONST})=>{
 const {ReferenceRailBalance,validSkateReference,createSkateReference}=await server.ssrLoadModule('/src/skateReferencePhysics.ts');
 const base={kind:'thps1',metresPerUnit:.01808,stats:{ollie:4,speed:8,air:8}};
 assert.equal(createSkateReference(base).balanceStat,undefined);
 for(const v of [-1,11,1.5,NaN,'5',null])assert.equal(validSkateReference({...base,stats:{...base.stats,balance:v}}),false);
 assert.equal(validSkateReference({...base,stats:{...base.stats,balance:5}}),true);
 const scenarios=[];
 for(const stat of [1,5,8])for(const seed of [1,1789]){
  const commands=[['n',stat,seed],...Array.from({length:45},()=>['g',0,0]),...Array.from({length:48},()=>['a',0,0]),['c',1,0],
   ...Array.from({length:12},()=>['r',128,0]), // held catch direction stays unarmed
   ['r',0,0],...Array.from({length:5},()=>['r',128,0]),...Array.from({length:6},()=>['r',-128,0]),
   ...Array.from({length:7},()=>['a',0,0]),['c',1,0], // same-rail difficulty penalty
   ['r',0,0],...Array.from({length:5},()=>['r',-128,0]),...Array.from({length:8},()=>['a',0,0]),['c',2,0],
   ...Array.from({length:4},()=>['r',0,0]),...Array.from({length:3},()=>['g',0,0]),...Array.from({length:5},()=>['a',0,0]),['c',2,0], // nonzero balance resets on supported ground
   ...Array.from({length:240},(_,i)=>['r',i<180?(i%24<12?64:-64):0,0])];
  const expected=execFileSync(`${dir}/oracle`,[],{input:commands.map(c=>c.join(' ')).join('\n')+'\n',encoding:'utf8'}).trim().split('\n').map(line=>line.split(' ').map(Number));
  for(const hz of [30,60,120]){
   const model=new ReferenceRailBalance();let rng=seed,last=-2,bails=0,neutralArmVerified=false,heldCatchVerified=false,comparedCommands=0,final;
   const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
   for(let i=0;i<commands.length;i++){
    const [cmd,a]=commands[i];
    if(cmd==='c'){model.catchRail(a===last,stat);last=a;}
    else if(cmd!=='n'){
     for(let j=0;j<hz/30;j++){if(model.advance(1/hz,cmd==='g'?'ground':cmd==='r'?'grind':'air',a/128,stat,random))bails++;}
     if(cmd==='r'&&i<107&&a===128&&!model.armed)heldCatchVerified=true;
     if(cmd==='r'&&a===0&&model.armed)neutralArmVerified=true;
    }
    assert.deepEqual([model.position,model.velocity,model.railTicks,Number(model.armed),bails],expected[i],`source recurrence: stat=${stat},seed=${seed},hz=${hz},command=${i}`);
    comparedCommands=i+1;final=expected[i];if(bails)break; // Bail changes native state: no further grinding recurrence is reachable.
   }
   assert.ok(heldCatchVerified&&neutralArmVerified);
   scenarios.push({stat,seed,hz,comparedCommands,final,heldCatchVerified,neutralArmVerified});
  }
 }
 const model=new ReferenceRailBalance();model.position=4000;model.velocity=-92;assert.equal(model.advance(1/30,'grind',0,5,()=>.5),false);assert.equal(model.position,4000);
 model.position=-4001;assert.equal(model.advance(1/30,'grind',0,5,()=>.5),true);
 const {Rail}=await server.ssrLoadModule('/src/rails.ts');
 const data={v:1,name:'Source balance integration',skatepark:true,skateReference:{...base,stats:{...base.stats,balance:5}},spawn:[0,.1,10],killY:-40,components:[{t:'platform',p:[0,-.5,0],s:[100,1,2200],edgeGrinding:false},{t:'gate',p:[40,0,-1050]}]};
 const l=new Level(scene,{id:'reference-balance',name:data.name,data});l.update(0);scene.updateMatrixWorld(true);
 const p=new Player(scene);p.enterLevel('reference-balance');p.endlessDeaths=true;
 const rail=new Rail([new THREE.Vector3(0,15,0),new THREE.Vector3(0,15,-1000)],false);l.rails.push(rail);
 const integration=[];
 try{
  for(const controlled of [false,true]){
   p.rawInput=makeInput();p.respawn(l,true,false,{position:rail.pointAt(20),heading:new THREE.Vector3(0,0,-1)});
   p.state='air';p.grounded=false;p.speed=18;p.vVel=0;p.enterGrind(rail,rail.closest(rail.pointAt(20)),l);
   let peak=0,frames=0;
   for(;frames<480;frames++){
    const moveX=controlled?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0;
    p.step(CONST.fixedStep,makeInput({moveX,grindHeld:true,jumpHeld:true}),l);l.update(CONST.fixedStep);
    if(p.state==='grind')peak=Math.max(peak,Math.abs(p.balance));
    if(p.isBailing||p.state!=='grind')break;
   }
   const result={controlled,frames,peak,bail:p.isBailing,state:p.state,distance:p.grindT-20};integration.push(result);
   if(controlled)assert.ok(frames===480&&!p.isBailing&&p.state==='grind','Countersteering must sustain the complete eight-second line');
   else assert.ok(p.isBailing&&frames<480,'An unattended source balance meter must reach its native bail threshold');
  }
 }finally{l.dispose();}
 const report={integration,sourcePath,sourceSHA256,sourceRevision:'d9319c8d5b42c431de02bec0f02f0cf955f2fbae',oracle:'Compiled unmodified source balance/catch statements with deterministic RNG and state stubs.',scenarios,optionalOnExistingProfiles:true,invalidStatsRejected:true};
 await writeFile('/private/tmp/mall-recreation/measured/reference-balance.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
});
