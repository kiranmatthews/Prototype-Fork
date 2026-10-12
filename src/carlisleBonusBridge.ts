import * as THREE from 'three';
import type {CustomComponent} from './level';
import {JungleAssetKit} from './jungleAssets';
import bridgeManifest from '../public/carlisle-bonus/revealed-bridge-manifest.json';

/** A Meshy skin follows the original switch-owned collider. The simple gold
 * ghost remains readable before activation; the textured rock appears with
 * the same switch and disappears on reset. All model leases are level-owned. */
export class CarlisleBonusBridgeVisual {
 readonly ready:Promise<void>;
 private readonly kit=new JungleAssetKit(false,false,false,false,'painterly');
 private active=false;
 private loaded=false;
 private disposed=false;
 private readonly material:THREE.Material;
 constructor(private readonly collider:THREE.Mesh,c:CustomComponent){
  this.material=collider.material as THREE.Material;
  const height=3/(c.s?.[1]??.9);
  const top=bridgeManifest.broadTopPlaneNormalizedY??1;
  this.kit.add({dkind:'coastbonusbridge',p:[0,0,0],s:[1,1,1]});
  const root=this.kit.root;root.name='Meshy sandstone exclamation bridge';
  root.scale.set(12.8/(c.s?.[0]??12),height,6.4/(c.s?.[2]??6.4));
  root.position.y=.5-height*top;root.visible=false;
  root.userData.visualOnly=true;collider.add(root);
  this.active=!c.outline;
  this.ready=this.kit.ready().then(()=>{
   if(this.disposed)return;
   this.loaded=this.kit.diagnostics.ready===1&&this.kit.errors.length===0;
   root.traverse(o=>{o.userData.visualOnly=true;o.userData.edgeGrinding=false;});
   this.sync();
  });
 }
 private sync():void {
  if(this.disposed)return;
  this.kit.root.visible=this.loaded&&this.active;
  this.material.visible=!(this.loaded&&this.active);
  this.collider.userData.carlisleBridgeReady=this.loaded;
  this.collider.userData.carlisleBridgeActive=this.active;
 }
 setActive(active:boolean):void {this.active=active;this.sync();}
 update(dt:number):void {this.kit.update(dt);}
 get diagnostics(){return {...this.kit.diagnostics,active:this.active,loaded:this.loaded};}
 dispose():void {if(this.disposed)return;this.disposed=true;this.material.visible=true;this.kit.dispose();}
}
