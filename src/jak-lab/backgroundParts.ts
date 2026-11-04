import * as THREE from 'three';

export interface BackgroundPart {
  id: string; name: string; tree: string;
  kind: 'prop' | 'shrub' | 'wind-draw';
  path: number[]; sourceNode: number | null;
  meshes: number; triangles: number;
}
const sourceName=(node:THREE.Object3D):string=>String(node.userData.name??node.name);

/** The pinned exporter groups TIE/shrub draws by source prototype. A prototype
 * can contain all placements in the level; it is not one inferred instance.
 * Wind children are individual draw groups, not necessarily complete objects. */
export function collectBackgroundParts(root:THREE.Object3D):BackgroundPart[] {
  const parts:BackgroundPart[]=[];
  const visit=(node:THREE.Object3D,path:number[]):void=>{
    const tree=sourceName(node),match=tree.match(/-(tie|shrub)-\d+$/);
    if(match)node.children.forEach((child,index)=>{
      let meshes=0,triangles=0;
      child.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        meshes++;const g=object.geometry,total=g.index?.count??g.getAttribute('position')?.count??0;
        triangles+=Math.max(0,Math.min(total-g.drawRange.start,g.drawRange.count))/3;
      });
      if(!meshes)return;
      const childPath=[...path,index],sourceNode=Number.isInteger(child.userData.jakSourceNode)?Number(child.userData.jakSourceNode):null;
      const name=sourceName(child),kind=match[1]==='shrub'?'shrub':/^wind-group-\d+-\d+$/.test(name)?'wind-draw':'prop';
      parts.push({id:sourceNode===null?`path:${childPath.join('.')}`:`node:${sourceNode}`,name,tree,kind,
        path:childPath,sourceNode,meshes,triangles});
    });
    else node.children.forEach((child,index)=>visit(child,[...path,index]));
  };
  visit(root,[]);return parts;
}

/** Change visibility only. Original/derived hierarchy, geometry, source
 * placement matrices, material groups and pre-existing visibility survive. */
export class BackgroundPartSelection {
  readonly parts:BackgroundPart[];
  private readonly visibility=new Map<THREE.Object3D,boolean>();
  private selected:BackgroundPart|null=null;
  constructor(private readonly original:THREE.Object3D,private readonly alternative:THREE.Object3D) {
    this.parts=collectBackgroundParts(original);
    for(const root of [original,alternative])root.traverse(node=>this.visibility.set(node,node.visible));
  }
  get current():BackgroundPart|null{return this.selected;}
  select(id:string):void {
    const part=id?this.parts.find(candidate=>candidate.id===id):null;
    if(id&&!part)throw new Error(`Unknown source scene part: ${id}`);
    const paths=[this.original,this.alternative].map(root=>{
      const chain=[root];
      for(const index of part?.path??[]) {
        const node=chain[chain.length-1].children[index];
        if(!node)throw new Error('Original/Gouraud scene hierarchies do not match');
        chain.push(node);
      }
      return chain;
    });
    for(const [node,visible] of this.visibility)node.visible=visible;
    for(const chain of paths)for(let i=0;i<chain.length-1;i++)
      for(const child of chain[i].children)if(child!==chain[i+1])child.visible=false;
    this.selected=part??null;
  }
}
