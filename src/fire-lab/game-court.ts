import * as THREE from 'three';
import {SpriteFire,type FireCycle,type FireCycleData,type FireFamily} from '../spriteFire';
import {FireCourtyard} from './courtyard';
import {COURT_FIRES,COURT_EXTRA_TORCHES} from './court-layout';
import {EXHIBITS} from './exhibits';

/** Level-owned art only. Player, collision, camera, input and post effects are
 * all owned by the ordinary game runtime. */
export class EmberCourtPresentation {
  readonly group=new THREE.Group();
  readonly ready:Promise<void>;
  private readonly court=new FireCourtyard({drawSolids:false,includeLights:false,gameCamera:true});
  private readonly fires:SpriteFire[]=[];
  private readonly textures=new Set<THREE.Texture>();
  private disposed=false;
  constructor(parent:THREE.Group){
    this.group.name='Ember Court fire exhibition';this.group.add(this.court);parent.add(this.group);
    // A fixed small light set avoids recompiling every surface as textures load.
    for(const [index,intensity,distance] of [[0,7,8],[1,10,10],[2,12,12],[3,7,8],[4,7,8],[6,7,8]]){
      const light=new THREE.PointLight(EXHIBITS[index].colour,intensity,distance,2);
      light.position.set(...COURT_FIRES[index].p).y+=.6;this.group.add(light);
    }
    this.ready=this.load();
    // Readiness remains rejected for the loading screen to report; suppress an
    // unhandled rejection if a level is disposed before its warm-up begins.
    void this.ready.catch(()=>{});
  }
  private async load(){
    const base=new URL(`${import.meta.env.BASE_URL}fire-sprites/v5/`,location.href);
    const response=await fetch(new URL('cycles.json',base));
    if(!response.ok)throw new Error(`Fire cycle manifest: ${response.status}`);
    const data=await response.json() as Record<FireFamily,FireCycleData>;
    const loader=new THREE.TextureLoader(),shared=new Map<string,Promise<THREE.Texture>>();
    const loadTexture=(file:string)=>{
      let pending=shared.get(file);
      if(!pending){pending=loader.loadAsync(new URL(file,base).href).then(texture=>{
        texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;
        texture.generateMipmaps=false;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
        if(this.disposed)texture.dispose();else this.textures.add(texture);
        return texture;
      });shared.set(file,pending);}
      return pending;
    };
    const cycles={} as Record<FireFamily,FireCycle>;
    await Promise.all((Object.keys(data) as FireFamily[]).map(async family=>{
      const cycle=data[family];cycles[family]={...cycle,textures:await Promise.all(cycle.pages.map(p=>loadTexture(p.file)))};
    }));
    if(this.disposed)return;
    EXHIBITS.forEach((spec,i)=>{
      const placement=COURT_FIRES[i],fire=new SpriteFire(cycles[spec.family],{...spec,seed:i+1});
      fire.position.set(...placement.p);fire.scale.setScalar(placement.scale);this.fires.push(fire);this.group.add(fire);
    });
    COURT_EXTRA_TORCHES.forEach(([x,y,z],i)=>{
      const fire=new SpriteFire(cycles.narrow,{...EXHIBITS[0],seed:20+i,phase:Math.floor(((i+1)*.61803398875%1)*cycles.narrow.frameCount)});
      fire.position.set(x,y+2.1,z);fire.scale.setScalar(.43);this.fires.push(fire);this.group.add(fire);
    });
  }
  view(time:number,camera:THREE.Camera){for(const fire of this.fires)fire.update(time,camera);}
  dispose(){
    this.disposed=true;this.group.removeFromParent();this.court.dispose();
    this.fires.forEach(fire=>fire.dispose());this.textures.forEach(texture=>texture.dispose());this.textures.clear();
  }
}
