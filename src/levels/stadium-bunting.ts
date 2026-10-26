import type {CustomComponent} from '../level';
import {stadiumPoint} from './cart-stadium-layout';

/** Full cloth topology, with the entire top seam fixed to the sagging rope.
 * UV y is free length (0 = attached, 1 = tip); rope UV y is -1. */
export function stadiumBunting(s:number,span:number):CustomComponent{
 const vertices:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[];
 const palette=['#f5bd46','#e66543','#32aaa1','#90be52'];
 const point=(u:number,down=0)=>stadiumPoint(s,u,21-4.5*(1-(u/28)**2)-down);
 const linear=(n:number)=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4;
 const vertex=(p:number[],u:number,v:number,colour:string)=>{
  vertices.push(...p.map(n=>Math.round(n*1e6)/1e6));uvs.push(u,v);
  colors.push(...[1,3,5].map(i=>linear(parseInt(colour.slice(i,i+2),16)/255)));return vertices.length/3-1;
 };
 for(let left=-28,flag=0;left<28;left+=2,flag++){
  const rope=[point(left),point(left+2),point(left+2,.055),point(left,.055)].map(p=>vertex(p,0,-1,'#72664a'));
  indices.push(rope[0],rope[1],rope[2],rope[0],rope[2],rope[3]);
  const rows=8,columns=4,start=vertices.length/3,height=1.55+(flag%3)*.15,colour=palette[(flag+span)%palette.length];
  for(let row=0;row<rows;row++)for(let col=0;col<=columns;col++){
   const u=col/columns,v=row/rows,lateral=left+.985+(u-.5)*1.53*(1-v),p=point(lateral,v*height);
   // Broad sewn folds, retained at every distance. Motion is a GPU offset.
   p[2]+=.11*Math.sin(u*Math.PI*3+flag*.7)*Math.sin(v*Math.PI);
   vertex(p,u,v,colour);
  }
  const tip=vertex(point(left+.985,height),.5,1,colour);
  for(let row=0;row<rows-1;row++)for(let col=0;col<columns;col++){
   const a=start+row*(columns+1)+col,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);
  }
  for(let col=0;col<columns;col++){const a=start+(rows-1)*(columns+1)+col;indices.push(a,tip,a+1);}
 }
 return {t:'mesh',nm:'Faded festival bunting',p:[0,0,0],vertices,indices,uvs,colors,doubleSided:true,color:'#ffffff',tex:'rally-cloth',solid:false,castShadow:false};
}
