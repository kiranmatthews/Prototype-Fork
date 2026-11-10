import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const bank=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [jak,skate]=await Promise.all([bank('jak'),bank('skate')]);
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {GameplayAnimationPresentation,gameplayAnimationDocument}=await server.ssrLoadModule('/src/gameplayAnimationScheme.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const assets={jak,skate,ink:new THREE.Texture()},camera=new THREE.PerspectiveCamera(50,16/9,.1,1000);
  const create=()=>{
    const p=new Player(scene),rig=RigBinding.fromSculptRuntime(p.animationRig.root).definition;
    const base=createPlayerStarterAnimationSuite(rig),doc=gameplayAnimationDocument(base,rig,jak);
    const runtime=createCharacterAnimationRuntime(p,doc),presentation=new GameplayAnimationPresentation(p,scene,assets);
    // Uncovered native families must survive adopting the default scheme.
    // It keys its own slide and slide jump; the downhill shoe glide stays native.
    for(const clip of base.clips.filter(c=>/bail|death|rope|grind|crawl|crouch|slope-slide|swim|roll-land|launch/.test(c.id)))
      assert.deepEqual(doc.clips.find(c=>c.id===clip.id),clip,`default scheme replaced ${clip.id}`);
    assert.equal(p.rawInput,undefined);
    p.respawn(level,true,true);
    assert.doesNotThrow(()=>p.prepareStartPresentation(level),'cold startup required input before animation could render');
    p.freeSkate=true;
    assert.doesNotThrow(()=>p.prepareStartPresentation(level),'mounted cold startup required input');
    p.freeSkate=false;
    for(const [id,flag] of [['player.slide','jakSlide'],['player.slide-jump','jakSlideJump']])
      assert.equal(doc.clips.find(c=>c.id===id)?.metadata?.[flag],true,`default scheme lost its keyed ${id}`);
    p.rawInput=makeInput();return {p,runtime,presentation};
  };
  const first=create(),second=create(),{p,runtime,presentation}=first,motion=presentation.skate;
  const nodes=()=>[p.bodyGroup,p.riderG,p.boardG.parent,...p.animationRig.joints.map(j=>j.node),p.boardG];
  const pose=()=>nodes().flatMap(n=>[...n.position,...n.quaternion,...n.scale,Number(n.visible)]);
  const reset=()=>{
    p.enterLevel('default-lifecycle');p.respawn(level,true,true);runtime.restart();p.rawInput=makeInput();
    for(let f=0;f<3;f++){p.step(1/60,p.rawInput,level);p.commitRenderStep(level);}
  };
  const cases=[
    ['grind',p=>p.state='grind'],['rope',p=>p.state='rope'],['hang',p=>p.state='hang'],
    ['dead',p=>p.state='dead'],['gameover',p=>p.state='gameover'],['finished',p=>p.state='finished'],
    ['ragdoll',p=>p.ragActive=true],['recovery',p=>p.bailRiseAge=.2],
    ['spin',p=>p.spinTimer=.2],['deck trick',p=>p.flipT=.2],['grab release',p=>p.grabPose=.2],
    ['manual',p=>p.manualing=1],['revert',p=>p.revertPoseT=.2],
    ['wallride',p=>p.wallridePose=.5],['lip stall',p=>p.lipStallT=.2],
    ['vert',p=>p.vertAir=true],['pipe hang',p=>p.pipeHang=true],
    ['special launch',p=>{p.state='air';p.bounceJump=true;}],['kite',p=>p.kiteDock={}],
    ['slide',p=>p.slidePose=.4],['crawl',p=>p.crawlPose=.4],['slam',p=>p.slamFlatT=.3],
    ['split jump',p=>p.starPose=.4],['teeter',p=>p.teeterPose=.4],['sketchy landing',p=>p.sketchyT=.2],
    ['competition finish',p=>p.competitionFinishT=.2],['results',p=>p.resultsPose='rest'],
    ['world map',p=>p.worldMapBaseScale=new THREE.Vector3(1,1,1)],
    ['swim',p=>p.state='swim'],
  ];
  for(const [name,setup]of cases){
    reset();const saved={...p};setup(p);const assigned=Object.keys(p).filter(key=>p[key]!==saved[key]),before=pose();
    motion.update({deltaSeconds:1/60,applyDeformations:v=>p.playerAnimationBridge.applyDeformations(v)});
    assert.ok(motion.diagnostics.nativeOwner,`${name} had no native animation owner`);
    const after=pose();assert.ok(Math.max(...after.map((v,i)=>Math.abs(v-before[i])))<1e-8,`${name} was overwritten by Skate`);
    assert.equal(motion.boardScribble.active,false,`${name} invented equipment ink`);
    for(const key of assigned)p[key]=saved[key];
  }
  // Preview, hidden map/vehicle bodies and split-screen cameras must never
  // display a stale gameplay scribble. Reset is independent for each player.
  reset();motion.boardScribble.start(true,.3,8);p.group.visible=false;presentation.prepareRender(camera);
  assert.equal(presentation.ink.sprite.visible,false);p.group.visible=true;
  p.enterAnimationPreview();presentation.prepareRender(camera);assert.equal(presentation.ink.sprite.visible,false);p.exitAnimationPreview();
  second.presentation.skate.boardScribble.start(true,.3,8);
  p.respawn(level,true,true);p.step(1/60,makeInput(),level);p.commitRenderStep(level);
  assert.equal(motion.boardScribble.active,false);assert.equal(second.presentation.skate.boardScribble.active,true);
  assert.notEqual(presentation.ink.sprite,second.presentation.ink.sprite);
  assert.notEqual(presentation.ink.sprite.material,second.presentation.ink.sprite.material);
  for(const item of [first,second]){item.presentation.dispose();item.runtime.dispose();}
  assets.ink.dispose();console.log(JSON.stringify({status:'pass',nativeOwners:cases.map(([name])=>name),coldStartPlayers:2,independentReset:true,preview:true}));
},{levelEntry:{id:'default-lifecycle',name:'Default animation lifecycle',data:{v:1,name:'Default animation lifecycle',spawn:[0,.02,6],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[100,1,100]},{t:'gate',p:[0,0,-40]}]}}});
