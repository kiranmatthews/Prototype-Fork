// One supported placement per case, followed only by ordinary controller input.
export const mallSourceBoxFixtures=[
 {name:'Raised platform through both box stacks',start:[12095,-1440,5780],heading:[0,0,-1],frames:130,minimumHits:2},
 {name:'Exit descent beneath the stacks',start:[11900,-1800,5780],heading:[0,0,-1],frames:155,minimumHits:0},
];

export function mallSourceBoxInput(p,m,f){
 const q=m.mallPoint(14200,0,f.start[2]),dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,forward=p.axisF;
 return {moveX:Math.max(-1,Math.min(1,3*(dx*-forward.z+dz*forward.x)/n)),moveY:(dx*forward.x+dz*forward.z)/n,jumpHeld:true};
}
