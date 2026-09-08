/** Independent audit of the actual render buffers, welding only coincident positions. */
export function auditClosedGeometry(g){
 const p=g.attributes.position,ids=g.index?.array??Array.from({length:p.count},(_,i)=>i),parts=g.attributes.aClayPart;
 const edges=new Map(),vertices=new Map(),faces=new Set(),faceVolumes=[];let degenerate=0,duplicates=0;
 const key=i=>`${parts?.getX(i)??0}:${[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',')}`;
 for(let i=0;i<ids.length;i+=3){
  const a=ids[i],b=ids[i+1],c=ids[i+2],keys=[key(a),key(b),key(c)],face=i/3;
  const faceKey=[...keys].sort().join('|');if(faces.has(faceKey))duplicates++;faces.add(faceKey);
  if(new Set(keys).size<3)degenerate++;
  const ax=p.getX(a),ay=p.getY(a),az=p.getZ(a),bx=p.getX(b),by=p.getY(b),bz=p.getZ(b),cx=p.getX(c),cy=p.getY(c),cz=p.getZ(c);
  const area=Math.hypot((by-ay)*(cz-az)-(bz-az)*(cy-ay),(bz-az)*(cx-ax)-(bx-ax)*(cz-az),(bx-ax)*(cy-ay)-(by-ay)*(cx-ax));
  if(area<1e-11)degenerate++;
  faceVolumes.push((ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6);
  for(const k of keys){if(!vertices.has(k))vertices.set(k,{neighbors:new Set(),faces:new Set()});vertices.get(k).faces.add(face)}
  for(let j=0;j<3;j++){
   const x=keys[j],y=keys[(j+1)%3],k=x<y?x+'|'+y:y+'|'+x,e=edges.get(k)??{count:0,winding:0};
   e.count++;e.winding+=x<y?1:-1;edges.set(k,e);vertices.get(x).neighbors.add(y);vertices.get(y).neighbors.add(x);
  }
 }
 const unseen=new Set(vertices.keys()),components=[];
 while(unseen.size){
  const start=unseen.values().next().value;unseen.delete(start);const todo=[start],partFaces=new Set();let count=0,edgeCount=0;
  while(todo.length){const node=vertices.get(todo.pop());count++;edgeCount+=node.neighbors.size;for(const f of node.faces)partFaces.add(f);for(const n of node.neighbors)if(unseen.delete(n))todo.push(n)}
  components.push({vertices:count,faces:partFaces.size,euler:count-edgeCount/2+partFaces.size,volume:[...partFaces].reduce((n,f)=>n+faceVolumes[f],0)});
 }
 return {triangles:ids.length/3,degenerate,duplicates,boundaries:[...edges.values()].filter(e=>e.count!==2).length,winding:[...edges.values()].filter(e=>e.winding!==0).length,components,volumes:components.map(c=>c.volume)};
}
