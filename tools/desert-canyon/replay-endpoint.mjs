import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,relative} from 'node:path';
import {build} from 'esbuild';
import {withSkateRuntime,makeInput} from '../jungle-cup-harness.mjs';

const file=process.argv[2];
assert.ok(file,'Provide the user replay JSON');
const raw=await readFile(file,'utf8'),replay=JSON.parse(raw);
// v2 omitted debug checkpoint inputs. Supply the recovered stop count and
// final warp frame explicitly; the original take defaults to frame 1145.
const restoredWarps=Number(process.argv[3]??0);
const sourceRef=process.argv[4];
const restoredWarpFrame=Number(process.argv[5]??1145);
const output=process.argv[6]??'docs/desert-canyon/cartoon/replay-endpoint.json';
const historical=path=>execFileSync('git',['show',`${sourceRef}:${path}`],{maxBuffer:16e6});
const bundle=await build({entryPoints:['src/levels/desert-canyon.ts'],bundle:true,format:'esm',platform:'node',write:false,
  plugins:sourceRef?[{name:'published-canyon',setup(build){build.onLoad({filter:/src\/(levels\/desert-(canyon|vista)|desertVistaCatalog)\.ts$/},args=>({contents:historical(relative(process.cwd(),args.path)).toString(),loader:'ts'}));}}]:[]});
const {DESERT_CANYON_LEVEL:data}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
await withSkateRuntime(async({level,player:p,server,CONST})=>{
  const {Replayer,isReplayFile}=await server.ssrLoadModule('/src/replay.ts');
  assert.ok(isReplayFile(replay));assert.equal(replay.level,'bryce-canyon');
  await level.jungleAssets.ready();level.root.updateMatrixWorld(true);level.prepareWorldSolids();
  const take=new Replayer();take.begin(replay);
  p.competitionMode=false;p.endlessDeaths=replay.endlessDeaths===true;p.enterLevel(replay.level);p.respawn(level,true);
  const input=makeInput(),samples=[];let finishFrame=null;
  try{
    for(let frame=0;frame<replay.frames;frame++){
      if(frame===restoredWarpFrame)for(let i=0;i<restoredWarps;i++)assert.ok(p.warpCheckpoint(level,1));
      assert.ok(take.feed(input,p.camDir));p.rawInput=input;
      p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);p.flushLevelCrateRewards(level);p.commitRenderStep(level);
      if(p.state==='finished'&&finishFrame===null)finishFrame=frame;
      if(frame%600===0||frame>=replay.frames-120)samples.push({frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,ground:p.groundHit?.name,deaths:p.totalDeaths,lives:p.lives});
      input.consumeEdges();
    }
    const result={replaySha256:createHash('sha256').update(raw).digest('hex'),sourceRef:sourceRef??'working tree',frames:replay.frames,restoredWarps,restoredWarpFrame,finishFrame,last:samples.at(-1),samples};
    await mkdir(dirname(output),{recursive:true});
    await writeFile(output,JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({...result,samples:undefined}));
  }finally{take.end();}
},{levelEntry:{id:'bryce-canyon',name:data.name,data},prepareRuntime(){
  globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
  globalThis.self=globalThis;navigator.userAgent='Headless canyon replay';
  const NativeRequest=globalThis.Request;
  globalThis.Request=class extends NativeRequest{constructor(input,init){super(typeof input==='string'?new URL(input,'http://headless.invalid'):input,init);}};
  globalThis.fetch=async input=>{
    const path=new URL(typeof input==='string'?input:input.url,'http://headless.invalid').pathname;
    const match=path.match(/\/desert-canyon\/vista\/(terrain-\d+\.glb)$/);
    return match?new Response(sourceRef?historical('public/desert-canyon/vista/'+match[1]):await readFile(new URL('../../public/desert-canyon/vista/'+match[1],import.meta.url))):new Response('',{status:404});
  };
}});
