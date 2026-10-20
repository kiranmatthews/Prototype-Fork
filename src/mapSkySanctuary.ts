import * as THREE from 'three';
import {CAMPAIGN_ISLANDS} from './campaign';
import {MapScenery} from './mapDioramas';

/** Photoreal cloud banks drift at different depths around the elevated sanctuary. */
export class MapSkySanctuary {
  readonly root=new THREE.Group();
  readonly ready:Promise<void>;
  private texture:THREE.Texture|null=null;
  private clouds:{sprite:THREE.Sprite;angle:number;radius:number;baseY:number;speed:number}[]=[];
  private time=0;private disposed=false;
  constructor(scenery:MapScenery){
    const centre=CAMPAIGN_ISLANDS.find(i=>i.id==='hidden-shores')!.centre;
    this.root.name='world map heavenly tiki sanctuary';this.root.position.set(...centre);
    const temple=new THREE.Group();temple.position.set(0,10,0);temple.name='Meshy sky sanctuary centre';this.root.add(temple);
    const statue=scenery.addPiece(temple,{asset:'sky-tiki-sanctuary',p:[0,0,0],extent:35,yaw:-80});
    // A full-detail Meshy mesa gives the floating land a substantial rock underside.
    const underside=new THREE.Group();this.root.add(underside);
    const stone=scenery.addPiece(underside,{asset:'sanctuary-mesa',p:[0,-43,0],extent:1,yaw:18,size:[118,45,106]});
    const cloudLoad=new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+'map-landmarks/cloud-bank.png').then(texture=>{
      if(this.disposed){texture.dispose();return;}
      this.texture=texture;texture.colorSpace=THREE.SRGBColorSpace;
      for(let i=0;i<24;i++){
        const angle=i*2.399963,radius=66+(i%5)*8,baseY=-18+(i%4)*5;
        const material=new THREE.SpriteMaterial({map:texture,color:0xffffff,transparent:true,depthWrite:false,opacity:.7,fog:false,toneMapped:false});
        const sprite=new THREE.Sprite(material);sprite.name='drifting photoreal cloud bank';sprite.userData.visualOnly=true;
        const width=72+(i%5)*13;sprite.scale.set(width,width*.405,1);this.root.add(sprite);
        this.clouds.push({sprite,angle,radius,baseY,speed:(i%2?1:-1)*(.006+(i%3)*.002)});
      }
      this.update(0);
    });
    this.ready=Promise.all([statue,stone,cloudLoad]).then(()=>{});
    this.ready.catch(()=>{});
  }
  update(dt:number,selected?:THREE.Vector3):void{
    this.time+=Math.min(dt,.1);
    const toward=selected?.clone().sub(this.root.position).setY(0).normalize();
    for(const c of this.clouds){
      const angle=c.angle+this.time*c.speed;
      c.sprite.position.set(Math.sin(angle)*c.radius,c.baseY+Math.sin(this.time*.12+c.angle)*2.2,Math.cos(angle)*c.radius);
      const front=toward?Math.max(0,toward.dot(c.sprite.position.clone().setY(0).normalize())):0;
      c.sprite.material.opacity=.7-front*.35;
    }
  }
  dispose():void{this.disposed=true;this.root.removeFromParent();for(const c of this.clouds)c.sprite.material.dispose();this.texture?.dispose();this.root.clear();}
}
