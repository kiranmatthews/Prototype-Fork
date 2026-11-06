import './playtest.css';
import * as THREE from 'three';
import {Player} from '../player';
import {Input} from '../input';
import {Level, type CustomLevelData} from '../level';
import {CONST} from '../tuning';
import {RigBinding, createPlayerStarterAnimationSuite} from '../animation';
import {createCharacterAnimationRuntime} from '../characterAnimationRuntime';
import {createJakDirectSuite, JAK_DIRECT_PHYSICS, type JakMotionBank} from '../../tools/jak-direct-motion';
import {PlayableSkateMotion} from './playableMotion';
import {BoardScribbleEffect} from './boardScribble';
import type {MotionData} from './retarget';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export const SKATE_PLAYTEST_LEVEL: CustomLevelData = {
  v:1, name:'Skate motion plaza',spawn:[0,.03,6],killY:-12,
  components:[
    {t:'platform',p:[0,-.5,-100],s:[90,1,260],tex:'solid',color:'#bbc8ac'},
    {t:'ramp',p:[-10,0,-16],len:8,rise:1.4,w:6,tex:'solid',color:'#d2d8c9'},
    {t:'platform',p:[-10,.7,-23],s:[6,1.4,6],tex:'solid',color:'#d2d8c9'},
    {t:'ramp',p:[10,0,-36],len:10,rise:2.3,w:6,tex:'solid',color:'#c6cebe'},
    {t:'platform',p:[10,1.15,-44],s:[6,2.3,6],tex:'solid',color:'#c6cebe'},
    {t:'checkpoint',p:[-20,.05,-70]},
    {t:'gate',p:[0,0,-215]},
  ],
};

async function start() {
  const [sourceResponse,jakResponse] = await Promise.all([fetch('/__skate_reference/motion.json'),fetch('/__jak-reference-motion/motion.json')]);
  if (!sourceResponse.ok || !jakResponse.ok) throw new Error('Local motion files are missing. Start with the private Skate and Jak data directories.');
  const [data,jak] = await Promise.all([sourceResponse.json() as Promise<MotionData>,jakResponse.json() as Promise<JakMotionBank>]);
  const canvas=$<HTMLCanvasElement>('viewport');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(devicePixelRatio); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dce2d5');scene.fog=new THREE.Fog('#dce2d5',45,110);
  scene.add(new THREE.HemisphereLight(0xedf5ff,0x97a77e,2.5));
  const sun=new THREE.DirectionalLight(0xfff3d9,3.3);sun.position.set(3,9,4);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-12;sun.shadow.camera.right=sun.shadow.camera.top=12;sun.shadow.normalBias=.025;
  scene.add(sun,sun.target);const rim=new THREE.DirectionalLight(0xf2fff7,1.5);rim.position.set(-3,3,-5);scene.add(rim);
  const level=new Level(scene,{id:'skate-playtest',name:SKATE_PLAYTEST_LEVEL.name,data:SKATE_PLAYTEST_LEVEL});
  const grid=new THREE.GridHelper(260,130,0x809375,0xaaba9d);grid.position.set(0,.006,-100);scene.add(grid);
  const p=new Player(scene);p.setCharacterHeadStyle('skull');p.setCharacterRenderBatching(false);
  const motion=new PlayableSkateMotion(p,data);
  const ink = await new THREE.TextureLoader().loadAsync(new URL('./assets/board-scribble.png', import.meta.url).href);
  const scribble = new BoardScribbleEffect(ink,p.group,motion.retarget.board,motion.boardScribble);
  ink.dispose(); scene.add(scribble.sprite);
  const binding=RigBinding.fromSculptRuntime(p.animationRig.root);
  const runtime=createCharacterAnimationRuntime(p,createJakDirectSuite(createPlayerStarterAnimationSuite(binding.definition),binding.definition,jak));
  p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};p.endlessDeaths=true;
  p.group.traverse(n=>{if(n instanceof THREE.Mesh){n.castShadow=true;n.receiveShadow=true;}});
  const input=new Input(false,()=>true);
  const camera=new THREE.PerspectiveCamera(38,1,.03,200);
  const target=new THREE.Vector3(),offset=new THREE.Vector3(),cameraTarget=new THREE.Vector3();
  const views={three:[4.8,2.6,7.6],side:[8,1.9,0],back:[0,2.8,8.8],front:[0,2.2,-8.8]};
  let paused=false,frameStep=false,rate=1,demoTime=-1,previousDemoJump=false,accumulator=0,last=0,reportAt=0,bailRequested=false;
  const reset=()=>{p.enterLevel('skate-playtest');p.respawn(level,true);level.setRunModesEnabled(false);(p as any).freeSkate=false;motion.reset();runtime.restart();accumulator=0;paused=false;bailRequested=false;$('pause').textContent='Pause';};
  reset();
  const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};resize();addEventListener('resize',resize);
  $<HTMLButtonElement>('reset').onclick=()=>{demoTime=-1;reset();canvas.focus();};
  $<HTMLButtonElement>('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';};
  $<HTMLButtonElement>('step').onclick=()=>{paused=true;frameStep=true;$('pause').textContent='Resume';};
  $<HTMLButtonElement>('demo').onclick=()=>{reset();demoTime=0;previousDemoJump=false;paused=false;$('pause').textContent='Pause';canvas.focus();};
  $<HTMLButtonElement>('return').onclick=()=>{demoTime=-1;previousDemoJump=false;paused=false;$('pause').textContent='Pause';$<HTMLSelectElement>('stop').value='none';canvas.focus();};
  const version = (value: string) => {motion.scribbles=value==='on';$<HTMLSelectElement>('ink').value=value;canvas.focus();};
  $<HTMLSelectElement>('motion').onchange=event=>{motion.enabled=(event.target as HTMLSelectElement).value==='source';version($<HTMLSelectElement>('ink').value);};
  $<HTMLSelectElement>('ink').onchange=event=>version((event.target as HTMLSelectElement).value);
  $<HTMLSelectElement>('style').onchange=event=>{motion.style=(event.target as HTMLSelectElement).value as typeof motion.style;canvas.focus();};
  $<HTMLSelectElement>('rate').onchange=event=>{rate=+(event.target as HTMLSelectElement).value;canvas.focus();};
  $<HTMLSelectElement>('quality').onchange=event=>{renderer.setPixelRatio((event.target as HTMLSelectElement).value==='native'?devicePixelRatio:Math.min(1,devicePixelRatio));resize();};
  addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||(event.target as HTMLElement).closest('input,select,textarea'))return;
    if(event.code==='Digit1'||event.code==='Digit2'){event.preventDefault();version(event.code==='Digit1'?'off':'on');}
    if(event.code==='KeyR'){demoTime=-1;reset();}
    if(event.code==='KeyB'&&!event.repeat){bailRequested=true;demoTime=-1;paused=false;$('pause').textContent='Pause';}
  });
  canvas.addEventListener('pointerdown',()=>canvas.focus());
  function tick() {
    if(bailRequested){bailRequested=false;(p as any).bail(false,Math.abs(p.speed),'trip');}
    const activeInput=demoTime<0 ? input : Object.assign(Object.create(Object.getPrototypeOf(input)),input,{
      moveX:0,moveY:demoTime<4.8?1:0,jumpHeld:demoTime>.4&&demoTime<3.5,
      jumpPressed:demoTime>.4&&demoTime<3.5&&!previousDemoJump,
      jumpReleased:!(demoTime>.4&&demoTime<3.5)&&previousDemoJump,
      grabHeld:demoTime>4.8&&demoTime<8.4,grabPressed:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,restartPressed:false,
    });
    if(demoTime>=0){previousDemoJump=activeInput.jumpHeld;demoTime+=CONST.fixedStep;if(demoTime>11)demoTime=-1;}
    (p as any).rawInput=activeInput;p.camDir.set(0,0,-1);p.step(CONST.fixedStep,activeInput,level);level.update(CONST.fixedStep);activeInput.consumeEdges();
    const stop = $<HTMLSelectElement>('stop').value, effect = motion.boardScribble;
    if((stop===motion.phase && motion.time>=.3) || (effect.active && effect.frame===0 && stop===(effect.targetVisible?'board-in':'board-out'))) {
      paused=true;$('pause').textContent='Resume';$<HTMLSelectElement>('stop').value='none';
    }
    input.consumeEdges();
  }
  function render(now:number) {
    const dt=Math.min(.06,(now-(last||now))/1000);last=now;input.update();
    accumulator+=paused?0:dt*rate;
    if(frameStep){tick();frameStep=false;}
    while(accumulator>=CONST.fixedStep){tick();accumulator-=CONST.fixedStep;if(paused){accumulator=0;break;}}
    target.copy(p.pos).add(new THREE.Vector3(0,1,0));
    offset.fromArray(views[$<HTMLSelectElement>('view').value as keyof typeof views]);
    cameraTarget.copy(target);cameraTarget.x-=1.15;
    camera.position.copy(cameraTarget).add(offset);camera.lookAt(cameraTarget);
    sun.position.copy(p.pos).add(new THREE.Vector3(3,9,4));sun.target.position.copy(p.pos);
    scene.updateMatrixWorld(true);camera.updateMatrixWorld();scribble.update(camera);renderer.render(scene,camera);
    if(now-reportAt>80){reportAt=now;$('phase').textContent=motion.enabled?motion.phase.replace(/-/g,' ').toUpperCase():'ORIGINAL D SKATING';
      $('diagnostics').textContent=JSON.stringify({...motion.diagnostics,demoTime:+demoTime.toFixed(2),paused,nativeState:p.state,
        comparison:motion.scribbles?'B · Scribble':'A · Pre-scribble',bailing:Boolean((p as any).isBailing),
        scribble:{active:motion.boardScribble.active,frame:motion.boardScribble.frame+1,appearances:motion.boardScribble.appearances,disappearances:motion.boardScribble.disappearances,quad:scribble.sprite.scale.toArray()}},null,2);
      $('hint').textContent=demoTime>=0?'Control demo running · Take control at any time':'WASD · Hold Space to mount · Release to jump · Q brake · R reset';}
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
void start().catch(error=>{$('phase').textContent=String(error);console.error(error);});
