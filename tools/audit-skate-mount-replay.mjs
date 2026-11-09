import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const [file,out,limit='1450']=process.argv.slice(2);
if(!file||!out)throw new Error('Usage: node tools/audit-skate-mount-replay.mjs replay.json report.json [frames]');
const replay=JSON.parse(await readFile(file,'utf8'));
if(replay.level!=='tribal-run')throw new Error('This audit reproduces the reported Tribal Run mount; supply a tribal-run replay.');
const bank=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [skate,jak]=await Promise.all([bank('skate'),bank('jak')]);
await withBlockworksRuntime(async r=>{
  const {Replayer}=await r.server.ssrLoadModule('/src/replay.ts');
  const {PlayableSkateMotion}=await r.server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {BoardScribbleEffect}=await r.server.ssrLoadModule('/src/skateReferenceLab/boardScribble.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await r.server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await r.server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await r.server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const p=r.p,binding=RigBinding.fromSculptRuntime(p.animationRig.root);
  p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
  const runtime=createCharacterAnimationRuntime(p,createJakDirectSuite(createPlayerStarterAnimationSuite(binding.definition),binding.definition,jak));
  const motion=new PlayableSkateMotion(p,skate,{continuousTransitions:true});
  const ink=new BoardScribbleEffect(new r.THREE.Texture(),p.group,motion.retarget.board,motion.boardScribble);
  const camera=new r.THREE.PerspectiveCamera(49,16/9,.1,100),take=new Replayer(),input={},samples=[],events=[];
  const world=id=>p.animationRig.jointsById.get(id).node.getWorldPosition(new r.THREE.Vector3());
  let previous='';take.begin(replay);
  try{for(let f=0;f<Math.min(replay.frames,Number(limit));f++){
    take.feed(input,p.camDir);r.tick(input);
    const state=motion.phase+'/'+motion.boardScribble.stage;
    if(state!==previous){events.push({f,state,source:motion.sourceName,pos:p.pos.toArray()});previous=state;}
    if(motion.boardScribble.active||motion.phase==='mount'){
      camera.position.copy(p.pos).addScaledVector(p.camDir,-6).add(new r.THREE.Vector3(0,4.5,0));
      camera.lookAt(p.pos.clone().add(new r.THREE.Vector3(0,1,0)));camera.updateMatrixWorld(true);
      ink.update(camera,new r.THREE.Plane().setFromNormalAndCoplanarPoint(p.groundHit?.normal??new r.THREE.Vector3(0,1,0),p.pos));
      const hips=world('hips'),board=motion.retarget.board.getWorldPosition(new r.THREE.Vector3()),delta=ink.sprite.position.clone().sub(hips);
      samples.push({f,state,time:motion.time,source:motion.sourceName,grounded:p.grounded,speed:p.speed,charge:p.chargeTimer,inkFrame:motion.boardScribble.frame,inkActive:motion.boardScribble.active,
        board:board.toArray(),hips:hips.toArray(),ink:ink.sprite.position.toArray(),inkRelativeToHips:delta.toArray(),
        forward:delta.dot(p.axisF),belowHips:hips.y-ink.sprite.position.y,boardVisible:motion.retarget.board.visible});
    }
  }}finally{take.end();motion.dispose();ink.dispose();runtime.dispose();}
  await writeFile(out,JSON.stringify({replay:file,frames:Math.min(replay.frames,Number(limit)),events,samples},null,2));
  console.log(JSON.stringify({frames:Math.min(replay.frames,Number(limit)),events,inkSamples:samples.filter(s=>s.inkActive).length,minInkBelowHips:Math.min(...samples.filter(s=>s.inkActive).map(s=>s.belowHips))},null,2));
},{modulePath:'/src/levels/tribal-run.ts',source:m=>m.TRIBAL_RUN_LEVEL,levelId:'tribal-run',endlessDeaths:replay.endlessDeaths,maxFrames:Number(limit)+1});
