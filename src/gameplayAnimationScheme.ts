import * as THREE from 'three';
import type {Player} from './player';
import type {AnimationSuiteDocument,RigDefinition} from './animation';
import {createJakDirectSuite,JAK_DIRECT_PHYSICS,type JakMotionBank} from './animation/jakDirectMotion';
import {loadMotionStudyJson} from './motionStudyAssets';
import {PlayableSkateMotion} from './skateReferenceLab/playableMotion';
import {BoardScribbleEffect} from './skateReferenceLab/boardScribble';
import type {MotionData} from './skateReferenceLab/retarget';

export const GAMEPLAY_ANIMATION_SCHEME = 'bone-man-jak-hybrid-v1';
export interface GameplayAnimationAssets {jak:JakMotionBank;skate:MotionData;ink:THREE.Texture}
let pending:Promise<GameplayAnimationAssets>|null=null;

/** One shared download/parse for both local players. Load before the course's
 * reveal so a first jump cannot silently start with the old animation scheme. */
export function prepareGameplayAnimationAssets():Promise<GameplayAnimationAssets> {
  return pending??=Promise.all([
    loadMotionStudyJson<JakMotionBank>('jak-motion'),
    loadMotionStudyJson<MotionData>('skate-motion'),
    new THREE.TextureLoader().loadAsync(new URL('./skateReferenceLab/assets/board-scribble.png',import.meta.url).href),
  ]).then(([jak,skate,ink])=>({jak,skate,ink})).catch(error=>{pending=null;throw error;});
}

/** Adopt D once. Subsequent saved edits remain editable rather than being
 * overwritten or repeatedly retargeted each time the game starts. */
export function gameplayAnimationDocument(base:AnimationSuiteDocument,rig:RigDefinition,bank:JakMotionBank):AnimationSuiteDocument {
  if(base.metadata?.gameplayAnimationScheme===GAMEPLAY_ANIMATION_SCHEME)return base;
  const suite=createJakDirectSuite(base,rig,bank);
  suite.metadata={...suite.metadata,gameplayAnimationScheme:GAMEPLAY_ANIMATION_SCHEME};
  return suite;
}

export class GameplayAnimationPresentation {
  readonly skate:PlayableSkateMotion;
  readonly ink:BoardScribbleEffect;
  constructor(readonly player:Player,scene:THREE.Scene,assets:GameplayAnimationAssets){
    player.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
    this.skate=new PlayableSkateMotion(player,assets.skate,{continuousTransitions:true});
    this.ink=new BoardScribbleEffect(assets.ink,player.group,this.skate.retarget.board,this.skate.boardScribble);
    scene.add(this.ink.sprite);
  }
  prepareRender(camera:THREE.Camera):void {this.skate.prepareRender(camera,this.ink);}
  dispose():void {this.skate.dispose();this.ink.dispose();}
}
