import * as THREE from 'three';
import {HudScreen,type HudCrop} from './hudScreen';
import {ParticleMotion} from './particleMotion';
import {ScreenHud,screenHudDefinition} from './screenHud';
import {FirstPersonHud} from './firstPersonHud';
import type {Catalogue,EffectDefinition,RenderingMode,ScreenHudKind} from './types';

const crops:Record<ScreenHudKind,HudCrop>={health:[-236,-116,112,38],power:[104,252,-26,-112],
  buzzers:[-248,-140,-40,-112],'first-person':[-256,256,112,-112]};

export class ScreenHudExhibit {
  readonly screen:HudScreen;
  readonly hud:ScreenHud|FirstPersonHud;
  get root(){return this.screen.root;}
  get original(){return this.screen.original;}
  get alternative(){return this.screen.alternative;}
  get fullFrame(){return this.screen.fullFrame;}
  get clock(){return this.hud.clock;}
  get issues(){return new Set(this.hud.layers.flatMap(layer=>[...layer.motion.issues]));}
  private constructor(readonly definition:EffectDefinition,readonly catalogue:Catalogue) {
    const host=screenHudDefinition(definition,catalogue);
    if(!host||host.id!=='first-person'&&!catalogue.screenHud)throw new Error('Missing source HUD host');
    this.screen=new HudScreen(crops[host.id]);
    const particles=new Map(catalogue.particles.map(p=>[p.id,p]));
    const layers=host.profiles[0].layers.flatMap((layer,sourceIndex)=>{
      if(!definition.screenHud&&layer.group!==definition.name)return [];
      const group=catalogue.groups.find(group=>group.name===layer.group);
      if(!group)throw new Error(`Missing HUD group ${layer.group}`);
      return [{motion:new ParticleMotion(group,particles,12000,group.id+1,catalogue.callbackPrograms),
        origin:new THREE.Vector3(),sourceIndex}];
    });
    this.hud=host.id==='first-person'?new FirstPersonHud(catalogue.firstPersonHud!,layers):
      new ScreenHud(host,catalogue.screenHud!.ecoFullTicks,layers);
    if(host.id==='first-person')this.screen.setFullFrame(true);
  }
  static async load(definition:EffectDefinition,catalogue:Catalogue):Promise<ScreenHudExhibit> {
    const exhibit=new ScreenHudExhibit(definition,catalogue);
    try {
      await exhibit.screen.loadTextures(new Set(exhibit.hud.layers.flatMap(layer=>[...layer.motion.textureIds])),catalogue);
      exhibit.update(.5);return exhibit;
    } catch(error){exhibit.dispose();throw error;}
  }
  get scale():number{return 1;}
  get inspectionSize():THREE.Vector3{return this.screen.inspectionSize;}
  get particles():number{return this.hud.layers.reduce((n,layer)=>n+layer.motion.particles.length,0);}
  get dropped():number{return this.hud.layers.reduce((n,layer)=>n+layer.motion.dropped,0);}
  setNativeScale(_native:boolean):void {/* Source screen pixels, not world metres. */}
  setRendering(mode:RenderingMode):void {this.screen.setRendering(mode);}
  setFormat(id:string):void {this.hud.select(id);this.screen.setFormat(this.hud.aspect);this.restart();}
  setFullFrame(value:boolean):void {this.screen.setFullFrame(value);}
  restart():void {this.hud.restart();this.update(1/60);}
  update(dt:number):void {
    const before=this.hud.clock;this.hud.update(dt);if(before===this.hud.clock)return;
    for(const {motion,origin,sourceIndex} of this.hud.layers)this.screen.write(String(sourceIndex),motion,origin);
  }
  render(renderer:THREE.WebGLRenderer):void {this.screen.render(renderer);}
  get diagnostics(){return {kind:this.hud.definition.id,phase:this.hud.phase,hold:this.hud.hold,offset:this.hud.offset,
    format:this.hud.profile.id,fullFrame:this.fullFrame,clock:this.hud.clock,particles:this.particles,
    ...(this.hud instanceof ScreenHud?{health:this.hud.health,eco:this.hud.ecoType,ecoTicks:this.hud.remaining}:
      {movie:this.hud.movie,progressState:this.hud.progressState}),
    layers:this.hud.layers.map(({sourceIndex,origin,motion})=>({sourceIndex,origin:origin.toArray(),
      particles:motion.particles.map(p=>({id:p.id,definition:p.definitionId,position:p.position.toArray(),values:{...p.values}}))})),
    issues:[...this.issues]};}
  dispose():void {this.screen.dispose();}
}
