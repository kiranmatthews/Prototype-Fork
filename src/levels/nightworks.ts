import type { CustomComponent, CustomLevelData } from "../level";

// Original Nightworks route and exact sine timings; terrain is a fitted Meshy kit.
export function createNightworksLevel(): CustomLevelData {
  const components: CustomComponent[] = [];
  const add = (c: CustomComponent): void => { components.push(c); };
  const stoneMat = null;
  const b = {
    slab(_name:string,z0:number,z1:number,top:number,w:number,_mat:unknown,_grind:boolean,x:number,_tex:string) {
      const d=Math.abs(z1-z0),h=Math.min(12,Math.min(w,d)*.7);
      add({t:"platform",dkind:Math.max(w,d)/Math.min(w,d)>1.35?"nightlongisland":"nightplateau",p:[x,top-h/2,(z0+z1)/2],s:[w,h,d]});
    },
    torch(x:number,y:number,z:number,h=2.2,scale=1) { add({t:"torch",p:[x,y,z],rise:h,w:scale}); },
    phasePad(x:number,y:number,z:number,w:number,d:number,cycle:number,phase:number,duty:number) {
      add({t:"phasepad",dkind:"nightphaserock",p:[x,y,z],s:[w,3.8,d],cycle,phase,amp:duty});
    },
    mover(x:number,y:number,z:number,w:number,d:number,axis:"x"|"y"|"z",amp:number,speed:number,phase:number,_fire:boolean) {
      add({t:"mover",dkind:"nightsteppingrock",p:[x,y,z],s:[w,Math.min(w,d)*.82,d],axis,amp,speed,phase,lit:true});
    },
    pickup(x:number,y:number,z:number) {add({t:"wumpa",p:[x,y,z]});},
    checkpoint(y:number,z:number,x=0) {add({t:"checkpoint",p:[x,y,z]});},
    movingRail(x:number,y:number,z:number,len:number,yaw:number,axis:"x"|"y"|"z",amp:number,speed:number,phase:number) {
      add({t:"rail",dkind:"nightrockridge",p:[x,y,z],len,yaw,axis,amp,speed,phase});
    },
    ropeSwing(x:number,y:number,z:number,len:number,amp:number,speed:number,phase:number,yaw:number,axis?:"x"|"y"|"z",range?:number,cycle?:number,travelPhase?:number) {
      add({t:"ropeswing",dkind:"nightanchorrock",p:[x,y,z],len,amp,speed,phase,yaw,axis,range,cycle,travelPhase});
    },
    crystal(x:number,y:number,z:number) {add({t:"crystal",p:[x,y,z]});},
    finishGate(y:number,z:number,x:number) {add({t:"gate",p:[x,y,z]});},
  };
    const isle = (
      z: number,
      w: number,
      d: number,
      x = 0,
      y = 0,
      torchH = 2.2,
    ): void => {
      b.slab("platform", z + d / 2, z - d / 2, y, w, stoneMat, false, x, "stone");
      b.torch(x - w * .28, y, z + d * .26, torchH);
      b.torch(x + w * .28, y, z - d * .26, torchH);
    };
    const ledge = (x: number, z: number, y = 3, s = 4.5): void => {
      b.slab("platform", z + s / 2, z - s / 2, y, s, stoneMat, false, x, "stone");
      b.torch(x + s * .22, y, z + s * .22, 1.5, 0.8);
    };

    const padA = (x: number, y: number, z: number, s = 5): void =>
      b.phasePad(x, y, z, s, s, 4.4, 0, 0.5);
    const padB = (x: number, y: number, z: number, s = 5): void =>
      b.phasePad(x, y, z, s, s, 4.4, 0.5, 0.5);
    const fmover = (
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      axis: "x" | "y" | "z",
      amp: number,
      speed: number,
      phase = 0,
    ): void => b.mover(x, y, z, w, d, axis, amp, speed, phase, true);

    isle(2, 11, 12, 0, 0, 2.6);


    b.torch(-3.5, 0, 5.8, 2.6);
    b.torch(3.5, 0, 5.8, 2.6);

    fmover(0, 0, -10, 5, 5, "x", 5.5, 0.5, 0);
    fmover(0, 0, -19, 5, 5, "x", 6, 0.55, Math.PI);
    fmover(0, 0, -28, 4.5, 4.5, "x", 6, 0.6, Math.PI / 2);
    b.pickup(0, 1.3, -19);

    isle(-41, 16, 20, 0, 0, 2.6);
    b.checkpoint(0, -44);

    fmover(-11, 1, -45, 4.5, 4.5, "y", 3.2, 0.7, 0);
    fmover(-19, 4, -51, 4.5, 4.5, "y", 3.4, 0.7, Math.PI);
    fmover(-27, 7, -45, 4.5, 4.5, "y", 3.2, 0.75, Math.PI / 2);
    fmover(-35, 10, -51, 4.5, 4.5, "y", 3.0, 0.65, 0);
    b.pickup(-27, 9, -45);
    isle(-51, 16, 16, -47, 12);
    b.checkpoint(12, -48, -47);

    padA(-47, 12, -64);
    padB(-47, 12, -72);
    padA(-47, 12, -80);
    b.pickup(-47, 13.3, -72);
    ledge(-47, -87, 12, 5);
    padA(-50.2, 12, -95, 4.4);
    padB(-43.8, 12, -95, 4.4);
    padB(-50.2, 12, -103, 4.4);
    padA(-43.8, 12, -103, 4.4);
    isle(-112, 24, 14, -43, 12);
    b.checkpoint(12, -112, -47);

    b.torch(-33.8, 12, -109, 1.5, 0.8);

    b.movingRail(-29, 13.7, -112, 22, 90, "z", 6.5, 0.6, 0);
    b.movingRail(-7, 13.7, -112, 22, 90, "z", 6.5, 0.6, Math.PI);
    b.pickup(-18, 15.4, -112);
    isle(-112, 12, 20, 10, 12);
    b.checkpoint(12, -112, 10);

    fmover(10, 12, -130, 5, 5, "z", 6, 0.55, 0);
    b.movingRail(10, 13.7, -147, 14, 0, "x", 5, 0.55, Math.PI / 2);
    b.pickup(10, 15.4, -147);
    fmover(10, 12, -159, 5, 5, "z", 4.5, 0.5, Math.PI);
    isle(-170, 12, 10, 10, 12);
    b.checkpoint(12, -170, 10);
    fmover(10, 14, -180, 4.5, 4.5, "y", 3, 0.7, 0);
    fmover(10, 17.5, -185, 4.5, 4.5, "y", 3, 0.7, Math.PI);
    fmover(10, 21, -190, 4.5, 4.5, "y", 3, 0.75, Math.PI / 2);
    fmover(10, 24.5, -195, 4.5, 4.5, "y", 3, 0.65, 0);
    isle(-202, 20, 10, 8, 26);
    b.checkpoint(26, -202, 10);

    b.ropeSwing(-8, 34.6, -202, 7, 0.7, 0, 0, 0, "x", 5.5, 0.45, 0);
    b.ropeSwing(-22, 34.6, -202, 7, 0.7, 0, Math.PI, 0, "x", 5.5, 0.45, Math.PI);
    b.ropeSwing(-36, 34.6, -202, 7, 0.75, 0, 0, 0, "x", 5.5, 0.4, Math.PI / 2);
    b.torch(-8, 32.2, -204.6, 1.0, 0.8);
    b.torch(-22, 32.2, -204.6, 1.0, 0.8);
    b.torch(-36, 32.2, -204.6, 1.0, 0.8);
    b.pickup(-22, 29.5, -202);
    isle(-202, 12, 16, -48, 26);
    b.checkpoint(26, -202, -48);

    padA(-48, 26, -216);
    padB(-48, 26, -224);
    b.pickup(-48, 27.3, -224);
    fmover(-48, 26, -233, 4.5, 4.5, "z", 5, 0.5, 0);
    padA(-51.2, 26, -246, 4.4);
    padB(-44.8, 26, -246, 4.4);
    padB(-51.2, 26, -254, 4.4);
    padA(-44.8, 26, -254, 4.4);
    fmover(-48, 28, -262, 4.5, 4.5, "y", 3, 0.7, 0);
    fmover(-48, 32.5, -268, 4.5, 4.5, "y", 3, 0.7, Math.PI);
    isle(-278, 12, 12, -48, 34);
    b.checkpoint(34, -278, -48);

    fmover(-41, 36, -275, 4.5, 4.5, "y", 2.75, 0.7, 0);
    fmover(-35, 38.75, -281, 4.5, 4.5, "y", 2.75, 0.7, Math.PI);
    fmover(-29, 41.5, -275, 4.5, 4.5, "y", 2.75, 0.75, Math.PI / 2);
    fmover(-23, 44.25, -281, 4.5, 4.5, "y", 2.75, 0.65, 0);
    fmover(-17, 47, -275, 4.5, 4.5, "y", 2.75, 0.7, Math.PI / 2);
    fmover(-11, 49.75, -281, 4.5, 4.5, "y", 2.75, 0.7, Math.PI);
    fmover(-5, 52.5, -275, 4.5, 4.5, "y", 2.75, 0.75, 0);
    fmover(1, 55.25, -281, 4.5, 4.5, "y", 2.75, 0.65, Math.PI / 2);
    b.pickup(-17, 51, -275);
    isle(-278, 12, 16, 9, 56);
    b.checkpoint(56, -278, 9);

    b.movingRail(9, 57.7, -296, 24, 0, "x", 6, 0.5, 0);
    b.pickup(9, 59.4, -296);
    fmover(9, 56, -314, 6, 6, "x", 7, 0.4, Math.PI / 2);
    isle(-324, 12, 10, 9, 56);
    b.checkpoint(56, -324, 9);

    padB(-2, 56, -324);
    fmover(-9.5, 56, -324, 4.5, 4.5, "x", 4, 0.6, 0);
    b.movingRail(-19, 57.7, -324, 10, 90, "z", 4, 0.6, Math.PI / 2);
    b.pickup(-19, 59.4, -324);
    fmover(-29, 58, -324, 4.5, 4.5, "y", 2, 0.7, Math.PI);
    fmover(-35, 62, -324, 4.5, 4.5, "y", 2.5, 0.7, 0);
    isle(-324, 10, 14, -43, 64);
    b.checkpoint(64, -324, -43);

    fmover(-43, 68, -334, 4.5, 4.5, "y", 2.5, 1.0, 0);
    b.ropeSwing(-43, 75.8, -338.5, 7.4, 0.8, 0, 0, 90);

    isle(-353, 14, 12, -43, 70, 3.2);
    b.torch(-48, 70, -356, 3.2);
    b.torch(-38, 70, -356, 3.2);
    b.crystal(-43, 70.6, -350);
    b.finishGate(70, -353, -43);

    // Stable default view/input frame across switchbacks. Following the route's
    // X bends made the camera steer held input, then side-scroll zones snapped
    // it back again at the same landing. The player supplies the turn instead.
    const laneNodes: [number, number, number, number][] = [
      [0, 10, 0, 0],
      [0, -363, 0, 70],
    ];
  // Forward view along both travelling rails, including their full sideways
  // cycle. Boundary blends sit over the approach/landing rock islands.
  add({t:"camnode",cameraView:true,nm:"Moving rails: forward view",p:[-18.25,15,-112],s:[23,60,52.5],yaw:-90,radius:4});
  for (const x of [-8,-22,-36]) add({t:"decor",dkind:"nightanchorrock",p:[x,30.2,-204.6],s:[2,2,2]});
  for (const [x,z,radius,y] of laneNodes) add({t:"camnode",p:[x,y,z],radius});
  // Far silhouettes frame each height band without occupying traversal space.
  const backdrops: [number,number,number,number][] = [[-28,-20,-25,15],[32,-6,-68,-20],[-85,2,-119,25],[38,17,-190,-18],[-85,21,-230,10],[35,28,-275,-12],[-75,50,-355,18]];
  for (const [x,y,z,yaw] of backdrops) add({t:"decor",dkind:"nightdistantarch",p:[x,y,z],s:[25,34,11],yaw,color:"#7588ac"});
  return {v:1,name:"The Nightworks",spawn:[0,.1,4],killY:-26,sky:"night",keepPlayFog:true,components};
}
export const NIGHTWORKS_LEVEL = createNightworksLevel();
