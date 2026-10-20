import type {BufferGeometry, MeshPhongMaterial} from 'three';

const treated = new WeakSet<MeshPhongMaterial>();

/** Cream coping and glazed aqua sides from the pool paintover. Object-space
 * metres keep joints attached to moving slabs without stretching box UVs.
 * The approved fiberglass painting supplies wear; no new maps or geometry. */
export function addWaterparkDeckLook(material: MeshPhongMaterial, geometry: BufferGeometry, seed = 0): void {
  if (!material.map || treated.has(material)) return;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box || box.isEmpty()) return;
  treated.add(material);
  const half = box.getSize(box.min.clone()).multiplyScalar(.5);
  const centre = box.getCenter(box.min.clone());
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.specular.set('#789590');
  material.shininess = 48;
  material.userData.waterparkDeck = {version:1, tileWidth:.48, tileHeight:.3, copingWidth:.38};
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.waterparkHalf = {value:half};
    shader.uniforms.waterparkCentre = {value:centre};
    shader.uniforms.waterparkSeed = {value:seed};
    shader.vertexShader = `varying vec3 vWaterparkP;
varying vec3 vWaterparkN;
varying vec3 vWaterparkHalf;
uniform vec3 waterparkHalf;
uniform vec3 waterparkCentre;
` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 waterparkScale = max(vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)), vec3(.0001));
      vWaterparkP = (transformed - waterparkCentre) * waterparkScale;
      vWaterparkN = normal / waterparkScale;
      vWaterparkHalf = waterparkHalf * waterparkScale;
    `);
    shader.fragmentShader = `varying vec3 vWaterparkP;
varying vec3 vWaterparkN;
varying vec3 vWaterparkHalf;
uniform float waterparkSeed;
` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 parkN = normalize(vWaterparkN);
      vec3 parkWeights = pow(abs(parkN), vec3(8.0));
      parkWeights /= max(dot(parkWeights, vec3(1.0)), .0001);
      vec2 parkOffset = vec2(fract(waterparkSeed * .137), fract(waterparkSeed * .271));
      vec3 parkTexture = texture2D(map, vWaterparkP.zy / 5.0 + parkOffset).rgb * parkWeights.x
        + texture2D(map, vWaterparkP.xz / 5.0 + parkOffset).rgb * parkWeights.y
        + texture2D(map, vWaterparkP.xy / 5.0 + parkOffset).rgb * parkWeights.z;
      float parkLuma = dot(parkTexture, vec3(.2126, .7152, .0722));
      float parkFootprint = max(length(dFdx(vWaterparkP)),length(dFdy(vWaterparkP)));
      float parkTileDetail = 1.0 - smoothstep(.09,.45,parkFootprint);
      float parkTop = max(parkN.y, 0.0);
      float parkSide = 1.0 - abs(parkN.y);
      float parkEdge = min(vWaterparkHalf.x - abs(vWaterparkP.x), vWaterparkHalf.z - abs(vWaterparkP.z));
      float parkBelowTop = vWaterparkHalf.y - vWaterparkP.y;
      float parkAA = max(fwidth(parkEdge), .002);
      float parkCoping = parkTop * (1.0 - smoothstep(.36 - parkAA, .38 + parkAA, parkEdge))
        + parkSide * (1.0 - smoothstep(.19 - parkAA, .21 + parkAA, parkBelowTop));
      vec2 parkTileP = vec2(vWaterparkP.z * parkWeights.x + vWaterparkP.x * parkWeights.z, vWaterparkP.y) / vec2(.48, .3);
      vec2 parkTileEdge = (.5 - abs(fract(parkTileP + .5) - .5)) * vec2(.48, .3);
      vec2 parkTileAA = max(fwidth(parkTileP) * vec2(.48, .3), vec2(.001));
      float parkJoint = 1.0 - min(smoothstep(.006, .006 + parkTileAA.x, parkTileEdge.x), smoothstep(.006, .006 + parkTileAA.y, parkTileEdge.y));
      float parkTileVariation = fract(sin(dot(floor(parkTileP), vec2(127.1, 311.7)) + waterparkSeed) * 43758.5453);
      parkJoint *= parkTileDetail;
      vec3 parkTile = parkTexture * mix(.94, mix(.76, 1.12, parkTileVariation), parkTileDetail);
      parkTile = mix(parkTile, vec3(.19,.26,.22), parkJoint * .7);
      vec3 parkCream = vec3(.75,.665,.46) * clamp(.78 + parkLuma * .55, .78, 1.12);
      float parkAlong = vWaterparkHalf.x-abs(vWaterparkP.x)<vWaterparkHalf.z-abs(vWaterparkP.z) ? vWaterparkP.z : vWaterparkP.x;
      float parkCapEdge = abs(fract(parkAlong/.9 + .5)-.5)*.9;
      float parkCapJoint = (1.0-smoothstep(.006,.006+max(fwidth(parkAlong),.002),parkCapEdge)) * (1.0-smoothstep(.15,.6,parkFootprint));
      parkCream *= 1.0-parkCapJoint*.24;
      vec3 parkColor = mix(parkTexture * 1.06, parkTile, parkSide);
      parkColor = mix(parkColor, parkCream, parkCoping);
      // A damp seam under the coping grounds the glazed tile without muddying
      // the walking surface or adding a second edge/collision mesh.
      float parkDamp = parkSide * (1.0-parkCoping) * exp(-abs(parkBelowTop-.24)*16.0);
      parkColor *= 1.0 - parkDamp * .2;
      diffuseColor.rgb *= parkColor;
      float parkHeight = parkSide * (1.0-parkCoping) * (1.0-parkJoint) * .006
        + parkTop * parkCoping * smoothstep(0.0,.12,parkEdge) * .025;
      vec2 parkSlope = vec2(dFdx(parkHeight),dFdy(parkHeight));
      float parkRelief = 1.0 - smoothstep(.025,.14,parkFootprint);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 parkDx=dFdx(-vViewPosition),parkDy=dFdy(-vViewPosition);
      vec3 parkRx=cross(parkDy,normal),parkRy=cross(normal,parkDx);
      float parkDet=dot(parkDx,parkRx)*faceDirection;
      vec3 parkGradient=sign(parkDet)*(parkSlope.x*parkRx+parkSlope.y*parkRy)/max(abs(parkDet),1e-10);
      parkGradient*=min(1.0,.55/max(length(parkGradient),.0001));
      normal=normalize(normal-parkRelief*parkGradient);
      specularStrength *= mix(.8,.32,parkCoping) * (1.0-parkSide*parkJoint*.65);
    `);
  };
  material.customProgramCacheKey = () => previousKey + '|waterpark-pool-deck-v1';
  material.needsUpdate = true;
}
