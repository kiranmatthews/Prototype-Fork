import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';
import {createServer} from 'vite';
import {makeInput} from './jungle-cup-harness.mjs';

// Reproduce a supplied take against its historical Player/course without
// checking out old files or changing the current authoring workspace.
const file=process.argv[2],ref=process.argv[3],out=process.env.CARLISLE_REPLAY_OUT??'/private/tmp/carlisle-replay-audit.json';
if(!file)throw Error('Provide a replay JSON path and optional historical git ref');
const raw=await readFile(file,'utf8'),replay=JSON.parse(raw),overrides=new Map();
if(ref)for(const path of ['src/player.ts','src/levels/carlisle-tidal-relay.ts'])
 overrides.set(resolve(path),execFileSync('git',['show',`${ref}:${path}`],{encoding:'utf8',maxBuffer:8e6}));
const fixture=await readFile(new URL('./test-campaign-death-flow.mjs',import.meta.url),'utf8');
const ast=ts.createSourceFile('fixture.mjs',fixture,ts.ScriptTarget.Latest,true);
const dom=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='installHeadlessDom');
new Function('noop',dom.getText(ast)+';installHeadlessDom();')(()=>{});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false},
 plugins:[{name:'historical-replay-source',enforce:'pre',transform(code,id){return overrides.get(id.split('?')[0]);}}]});
const warn=console.warn,error=console.error;
console.warn=(...args)=>{if(!/failed|GLB|procedural skateboard/i.test(String(args[0])))warn(...args);};
console.error=(...args)=>{if(!/failed|GLB/i.test(String(args[0])))error(...args);};
let level,take;
try{
 const {Level}=await server.ssrLoadModule('/src/level.ts'),{Player}=await server.ssrLoadModule('/src/player.ts');
 const {Replayer,isReplayFile}=await server.ssrLoadModule('/src/replay.ts');assert.ok(isReplayFile(replay));
 const {CONST}=await server.ssrLoadModule('/src/tuning.ts');
 const api=await server.ssrLoadModule('/src/levels/carlisle-tidal-relay.ts');
 const data=api.CARLISLE_TIDAL_RELAY_LEVEL,scene=new THREE.Scene();
 level=new Level(scene,{id:replay.level,name:data.name,data});level.update(0);scene.updateMatrixWorld(true);
 const p=new Player(scene);p.enterLevel(replay.level);p.endlessDeaths=replay.endlessDeaths===true;p.rawInput=makeInput();p.respawn(level,true);
 // Replay v2 omits starting campaign inventory. Optional diagnostic reserve
 // prevents an assumed four-life start from ending an otherwise longer take.
 const livesOverride=process.env.CARLISLE_REPLAY_LIVES?Number(process.env.CARLISLE_REPLAY_LIVES):null;
 if(livesOverride!==null){assert.ok(Number.isInteger(livesOverride)&&livesOverride>0);p.lives=livesOverride;}
 take=new Replayer();take.begin(replay);const input=makeInput(),samples=[],jumps=[],events=[];
 const points=Array.from({length:801},(_,i)=>({s:i*5,p:api.carlislePoint(i*5,0)}));
 const progress=()=>points.reduce((best,q)=>{const d=(p.pos.x-q.p[0])**2+(p.pos.z-q.p[2])**2;return d<best.d?{s:q.s,d}:best;},{s:0,d:Infinity}).s;
 let previousState='',maxProgress=0,previous=p.pos.clone(),previousSnap=p.renderSnapVersion;
 const sample=f=>({f,seconds:+(f/60).toFixed(2),s:progress(),position:p.pos.toArray(),state:p.state,grounded:p.grounded,
  deaths:p.totalDeaths,lives:p.lives,speed:p.speed,vy:p.vVel,bail:p.isBailing,board:p.freeSkate,
  ground:p.groundHit?{name:p.groundHit.name,y:p.groundHit.y,mover:p.groundHit.moverId}:null,
  checkpoint:level.checkpoints.findIndex(c=>c.active),input:[input.moveX,input.moveY,replay.b[f]]});
 for(let f=0;f<replay.frames;f++){
  assert.ok(take.feed(input,p.camDir));previous.copy(p.pos);previousSnap=p.renderSnapVersion;p.rawInput=input;
  p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);p.flushLevelCrateRewards(level);p.commitRenderStep(level);
  const state=[p.state,p.grounded,p.groundHit?.name,p.totalDeaths].join('/');
  if(f%15===0||f>=replay.frames-600){const row=sample(f);samples.push(row);maxProgress=Math.max(maxProgress,row.s);}
  if(state!==previousState){events.push(sample(f));previousState=state;}
  if(p.pos.y-previous.y>1.2&&p.vVel<20&&p.renderSnapVersion===previousSnap)jumps.push({...sample(f),delta:p.pos.clone().sub(previous).toArray()});
  if(f%7200===0)console.log(JSON.stringify(sample(f)));
  input.consumeEdges();
 }
 const result={replaySha256:createHash('sha256').update(raw).digest('hex'),sourceRef:ref??'working tree',livesOverride,frames:replay.frames,
  maxProgress,last:sample(replay.frames-1),events,jumps,samples};
 await mkdir(resolve(out,'..'),{recursive:true});await writeFile(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,events:events.slice(-35),jumps:jumps.slice(-15),samples:undefined},null,2));
}finally{take?.end();level?.dispose();await server.close();console.warn=warn;console.error=error;}
