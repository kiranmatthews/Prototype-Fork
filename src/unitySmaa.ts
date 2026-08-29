// Unity 6 URP SMAA High port.
//
// Source parity targets:
// - Universal/Runtime/Passes/PostProcess/StopNanPostProcessPass.cs
// - Universal/Shaders/PostProcessing/SubpixelMorphologicalAntialiasingBridge.hlsl
// - Universal/Shaders/PostProcessing/SubpixelMorphologicalAntialiasing.hlsl
//
// Unity runs StopNaN before SMAA on the linear HDR camera buffer. The PC
// renderer normally stores that buffer as unsigned B10G11R11, so this port's
// sanitize stage also removes negative RGB before writing to signed RGBA16F.
// Edge detection alone evaluates PositivePow(linear, 1 / 2.2). Neighborhood
// blending stays linear HDR; there is deliberately no display-gamma wrapper.

import * as THREE from "three";
import {
  FullScreenQuad,
  Pass,
} from "three/examples/jsm/postprocessing/Pass.js";

export const UNITY_SMAA_PROFILE = Object.freeze({
  quality: "high" as const,
  threshold: 0.1,
  maxSearchSteps: 16,
  maxDiagonalSearchSteps: 8,
  cornerRounding: 25,
  localContrastAdaptationFactor: 2,
});

const FULLSCREEN_VERTEX = /* glsl */ `
  precision highp float;
  in vec3 position;
  in vec2 uv;
  out vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SANITIZE_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler2D;

  uniform sampler2D tSource;
  out vec4 outColor;

  void main() {
    ivec2 sourceSize = textureSize(tSource, 0);
    ivec2 pixel = clamp(
      ivec2(gl_FragCoord.xy),
      ivec2(0),
      sourceSize - ivec2(1)
    );
    vec4 color = texelFetch(tSource, pixel, 0);

    // Unity's Stop NaN pass zeros the whole pixel when any channel is NaN or
    // Inf. Its active PC HDR target is normally unsigned R11G11B10, whose
    // write conversion also clamps negative RGB and caps finite magnitude.
    if (any(isnan(color)) || any(isinf(color))) {
      outColor = vec4(0.0);
      return;
    }

    outColor = vec4(clamp(color.rgb, 0.0, 65024.0), 1.0);
  }
`;

const EDGE_VERTEX = /* glsl */ `
  precision highp float;
  in vec3 position;
  in vec2 uv;

  uniform vec2 uResolution;
  out vec2 vUv;
  out vec4 vOffset[3];

  void main() {
    vUv = uv;
    // WebGL's texture Y axis is the inverse of Unity's canonical SMAA source.
    vOffset[0] = uv.xyxy + uResolution.xyxy
      * vec4(-1.0, 0.0, 0.0, 1.0);
    vOffset[1] = uv.xyxy + uResolution.xyxy
      * vec4(1.0, 0.0, 0.0, -1.0);
    vOffset[2] = uv.xyxy + uResolution.xyxy
      * vec4(-2.0, 0.0, 0.0, 2.0);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const EDGE_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler2D;

  uniform sampler2D tColor;
  in vec2 vUv;
  in vec4 vOffset[3];
  out vec4 outColor;

  vec3 samplePoint(vec2 uv) {
    ivec2 size = textureSize(tColor, 0);
    ivec2 pixel = clamp(ivec2(uv * vec2(size)), ivec2(0), size - 1);
    return texelFetch(tColor, pixel, 0).rgb;
  }

  vec3 edgeSpace(vec3 linearColor) {
    // SubpixelMorphologicalAntialiasingBridge.hlsl, linear project:
    // GAMMA_FOR_EDGE_DETECTION == 1 / 2.2.
    return pow(max(linearColor, vec3(0.0)), vec3(1.0 / 2.2));
  }

  void main() {
    vec3 C = edgeSpace(samplePoint(vUv));
    vec3 Cleft = edgeSpace(samplePoint(vOffset[0].xy));
    vec3 Ctop = edgeSpace(samplePoint(vOffset[0].zw));

    vec4 delta;
    vec3 difference = abs(C - Cleft);
    delta.x = max(difference.r, max(difference.g, difference.b));
    difference = abs(C - Ctop);
    delta.y = max(difference.r, max(difference.g, difference.b));

    vec2 edges = step(vec2(0.1), delta.xy);
    if (dot(edges, vec2(1.0)) == 0.0) {
      outColor = vec4(0.0);
      return;
    }

    vec3 Cright = edgeSpace(samplePoint(vOffset[1].xy));
    vec3 Cbottom = edgeSpace(samplePoint(vOffset[1].zw));
    difference = abs(C - Cright);
    delta.z = max(difference.r, max(difference.g, difference.b));
    difference = abs(C - Cbottom);
    delta.w = max(difference.r, max(difference.g, difference.b));

    vec2 maxDelta = max(delta.xy, delta.zw);
    vec3 Cleftleft = edgeSpace(samplePoint(vOffset[2].xy));
    vec3 Ctoptop = edgeSpace(samplePoint(vOffset[2].zw));
    difference = abs(Cleft - Cleftleft);
    delta.z = max(difference.r, max(difference.g, difference.b));
    difference = abs(Ctop - Ctoptop);
    delta.w = max(difference.r, max(difference.g, difference.b));

    maxDelta = max(maxDelta, delta.zw);
    float finalDelta = max(maxDelta.x, maxDelta.y);
    edges *= step(vec2(finalDelta), 2.0 * delta.xy);
    outColor = vec4(edges, 0.0, 0.0);
  }
`;

const WEIGHTS_VERTEX = /* glsl */ `
  precision highp float;
  in vec3 position;
  in vec2 uv;

  uniform vec2 uResolution;
  out vec2 vUv;
  out vec2 vPixcoord;
  out vec4 vOffset[3];

  void main() {
    vUv = uv;
    vPixcoord = uv / uResolution;
    vOffset[0] = uv.xyxy + uResolution.xyxy
      * vec4(-0.25, 0.125, 1.25, 0.125);
    vOffset[1] = uv.xyxy + uResolution.xyxy
      * vec4(-0.125, 0.25, -0.125, -1.25);
    // Canonical directions are transformed from Unity's Y-down SMAA space to
    // WebGL texture space: up searches toward +Y and down toward -Y.
    vOffset[2] = vec4(vOffset[0].xz, vOffset[1].yw)
      + vec4(-2.0, 2.0, 2.0, -2.0)
      * uResolution.xxyy * 16.0;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const WEIGHTS_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler2D;

  uniform sampler2D tEdges;
  uniform sampler2D tArea;
  uniform sampler2D tSearch;
  uniform vec2 uResolution;
  in vec2 vUv;
  in vec2 vPixcoord;
  in vec4 vOffset[3];
  out vec4 outColor;

  const float AREA_MAX_DISTANCE = 16.0;
  const float AREA_MAX_DISTANCE_DIAG = 20.0;
  const vec2 AREA_PIXEL_SIZE = 1.0 / vec2(160.0, 560.0);
  const float AREA_SUBTEX_SIZE = 1.0 / 7.0;
  const vec2 SEARCH_SIZE = vec2(66.0, 33.0);
  const vec2 SEARCH_PACKED_SIZE = vec2(64.0, 16.0);

  vec4 sampleOffset(sampler2D source, vec2 uv, ivec2 offset) {
    return texture(source, uv + vec2(offset) * uResolution);
  }

  vec2 decodeDiag(vec2 edge) {
    edge.r *= abs(5.0 * edge.r - 3.75);
    return round(edge);
  }

  vec4 decodeDiag(vec4 edge) {
    edge.r *= abs(5.0 * edge.r - 3.75);
    edge.b *= abs(5.0 * edge.b - 3.75);
    return round(edge);
  }

  vec2 searchDiag1(vec2 texcoord, vec2 direction, out vec2 edge) {
    vec4 coord = vec4(texcoord, -1.0, 1.0);
    for (int i = 0; i < 8; i += 1) {
      if (!(coord.z < 7.0 && coord.w > 0.9)) break;
      coord.xy += uResolution * direction;
      coord.z += 1.0;
      edge = texture(tEdges, coord.xy).rg;
      coord.w = dot(edge, vec2(0.5));
    }
    return coord.zw;
  }

  vec2 searchDiag2(vec2 texcoord, vec2 direction, out vec2 edge) {
    vec4 coord = vec4(texcoord, -1.0, 1.0);
    coord.x += 0.25 * uResolution.x;
    for (int i = 0; i < 8; i += 1) {
      if (!(coord.z < 7.0 && coord.w > 0.9)) break;
      coord.xy += uResolution * direction;
      coord.z += 1.0;
      edge = decodeDiag(texture(tEdges, coord.xy).rg);
      coord.w = dot(edge, vec2(0.5));
    }
    return coord.zw;
  }

  vec2 areaDiag(vec2 distance, vec2 crossingEdges, float subpixelOffset) {
    vec2 uv = AREA_MAX_DISTANCE_DIAG * crossingEdges + distance;
    uv = AREA_PIXEL_SIZE * uv + 0.5 * AREA_PIXEL_SIZE;
    uv.x += 0.5;
    uv.y += AREA_SUBTEX_SIZE * subpixelOffset;
    return texture(tArea, uv).rg;
  }

  vec2 calculateDiagWeights(vec2 texcoord, vec2 edge) {
    vec2 weights = vec2(0.0);
    vec4 distance;
    vec2 end;

    if (edge.r > 0.0) {
      // Canonical (-1,+1) transformed to WebGL (-1,-1).
      distance.xz = searchDiag1(texcoord, vec2(-1.0, -1.0), end);
      distance.x += float(end.y > 0.9);
    } else {
      distance.xz = vec2(0.0);
    }
    distance.yw = searchDiag1(texcoord, vec2(1.0, 1.0), end);

    if (distance.x + distance.y > 2.0) {
      vec4 coords = texcoord.xyxy + vec4(
        -distance.x + 0.25,
        -distance.x,
        distance.y,
        distance.y + 0.25
      ) * uResolution.xyxy;
      vec4 crossing;
      crossing.xy = sampleOffset(tEdges, coords.xy, ivec2(-1, 0)).rg;
      crossing.zw = sampleOffset(tEdges, coords.zw, ivec2(1, 0)).rg;
      crossing = decodeDiag(crossing).yxwz;
      vec2 merged = 2.0 * crossing.xz + crossing.yw;
      if (distance.z >= 0.9) merged.x = 0.0;
      if (distance.w >= 0.9) merged.y = 0.0;
      weights += areaDiag(distance.xy, merged, 0.0);
    }

    // Canonical (-1,-1)/(+1,+1), transformed for WebGL.
    distance.xz = searchDiag2(texcoord, vec2(-1.0, 1.0), end);
    if (sampleOffset(tEdges, texcoord, ivec2(1, 0)).r > 0.0) {
      distance.yw = searchDiag2(texcoord, vec2(1.0, -1.0), end);
      distance.y += float(end.y > 0.9);
    } else {
      distance.yw = vec2(0.0);
    }

    if (distance.x + distance.y > 2.0) {
      vec4 coords = texcoord.xyxy + vec4(
        -distance.x,
        distance.x,
        distance.y,
        -distance.y
      ) * uResolution.xyxy;
      vec4 crossing;
      crossing.x = sampleOffset(tEdges, coords.xy, ivec2(-1, 0)).g;
      crossing.y = sampleOffset(tEdges, coords.xy, ivec2(0, 1)).r;
      crossing.zw = sampleOffset(tEdges, coords.zw, ivec2(1, 0)).gr;
      vec2 merged = 2.0 * crossing.xz + crossing.yw;
      if (distance.z >= 0.9) merged.x = 0.0;
      if (distance.w >= 0.9) merged.y = 0.0;
      weights += areaDiag(distance.xy, merged, 0.0).gr;
    }

    return weights;
  }

  float searchLength(vec2 edge, float offset) {
    vec2 scale = SEARCH_SIZE * vec2(0.5, -1.0);
    vec2 bias = SEARCH_SIZE * vec2(offset, 1.0);
    scale += vec2(-1.0, 1.0);
    bias += vec2(0.5, -0.5);
    scale /= SEARCH_PACKED_SIZE;
    bias /= SEARCH_PACKED_SIZE;
    return texture(tSearch, scale * edge + bias).r;
  }

  float searchXLeft(vec2 texcoord, float end) {
    vec2 edge = vec2(0.0, 1.0);
    for (int i = 0; i < 16; i += 1) {
      if (!(texcoord.x > end && edge.g > 0.8281 && edge.r == 0.0)) break;
      edge = texture(tEdges, texcoord).rg;
      texcoord -= vec2(2.0 * uResolution.x, 0.0);
    }
    float offset = -(255.0 / 127.0) * searchLength(edge, 0.0) + 3.25;
    return texcoord.x + uResolution.x * offset;
  }

  float searchXRight(vec2 texcoord, float end) {
    vec2 edge = vec2(0.0, 1.0);
    for (int i = 0; i < 16; i += 1) {
      if (!(texcoord.x < end && edge.g > 0.8281 && edge.r == 0.0)) break;
      edge = texture(tEdges, texcoord).rg;
      texcoord += vec2(2.0 * uResolution.x, 0.0);
    }
    float offset = -(255.0 / 127.0) * searchLength(edge, 0.5) + 3.25;
    return texcoord.x - uResolution.x * offset;
  }

  float searchYUp(vec2 texcoord, float end) {
    vec2 edge = vec2(1.0, 0.0);
    for (int i = 0; i < 16; i += 1) {
      if (!(texcoord.y < end && edge.r > 0.8281 && edge.g == 0.0)) break;
      edge = texture(tEdges, texcoord).rg;
      texcoord += vec2(0.0, 2.0 * uResolution.y);
    }
    float offset = -(255.0 / 127.0) * searchLength(edge.gr, 0.0) + 3.25;
    return texcoord.y - uResolution.y * offset;
  }

  float searchYDown(vec2 texcoord, float end) {
    vec2 edge = vec2(1.0, 0.0);
    for (int i = 0; i < 16; i += 1) {
      if (!(texcoord.y > end && edge.r > 0.8281 && edge.g == 0.0)) break;
      edge = texture(tEdges, texcoord).rg;
      texcoord -= vec2(0.0, 2.0 * uResolution.y);
    }
    float offset = -(255.0 / 127.0) * searchLength(edge.gr, 0.5) + 3.25;
    return texcoord.y + uResolution.y * offset;
  }

  vec2 area(vec2 distance, float edge1, float edge2, float subpixelOffset) {
    vec2 uv = AREA_MAX_DISTANCE * round(4.0 * vec2(edge1, edge2))
      + distance;
    uv = AREA_PIXEL_SIZE * uv + 0.5 * AREA_PIXEL_SIZE;
    uv.y += AREA_SUBTEX_SIZE * subpixelOffset;
    return texture(tArea, uv).rg;
  }

  void detectHorizontalCorners(
    inout vec2 weights,
    vec4 texcoord,
    vec2 distance
  ) {
    vec2 leftRight = step(distance.xy, distance.yx);
    vec2 rounding = 0.75 * leftRight / (leftRight.x + leftRight.y);
    vec2 factor = vec2(1.0);
    factor.x -= rounding.x
      * sampleOffset(tEdges, texcoord.xy, ivec2(0, -1)).r;
    factor.x -= rounding.y
      * sampleOffset(tEdges, texcoord.zw, ivec2(1, -1)).r;
    factor.y -= rounding.x
      * sampleOffset(tEdges, texcoord.xy, ivec2(0, 2)).r;
    factor.y -= rounding.y
      * sampleOffset(tEdges, texcoord.zw, ivec2(1, 2)).r;
    weights *= clamp(factor, 0.0, 1.0);
  }

  void detectVerticalCorners(
    inout vec2 weights,
    vec4 texcoord,
    vec2 distance
  ) {
    vec2 leftRight = step(distance.xy, distance.yx);
    vec2 rounding = 0.75 * leftRight / (leftRight.x + leftRight.y);
    vec2 factor = vec2(1.0);
    factor.x -= rounding.x
      * sampleOffset(tEdges, texcoord.xy, ivec2(1, 0)).g;
    factor.x -= rounding.y
      * sampleOffset(tEdges, texcoord.zw, ivec2(1, -1)).g;
    factor.y -= rounding.x
      * sampleOffset(tEdges, texcoord.xy, ivec2(-2, 0)).g;
    factor.y -= rounding.y
      * sampleOffset(tEdges, texcoord.zw, ivec2(-2, -1)).g;
    weights *= clamp(factor, 0.0, 1.0);
  }

  void main() {
    vec4 weights = vec4(0.0);
    vec2 edge = texture(tEdges, vUv).rg;

    if (edge.g > 0.0) {
      weights.rg = calculateDiagWeights(vUv, edge);

      // Canonical SMAA uses r == -g as an exact zero test because the area
      // weights are non-negative.
      if (weights.r == -weights.g) {
        vec2 distance;
        vec3 coords;
        coords.x = searchXLeft(vOffset[0].xy, vOffset[2].x);
        coords.y = vOffset[1].y;
        distance.x = coords.x;
        float edge1 = texture(tEdges, coords.xy).r;

        coords.z = searchXRight(vOffset[0].zw, vOffset[2].y);
        distance.y = coords.z;
        distance = abs(round(
          distance / uResolution.x - vPixcoord.xx
        ));
        float edge2 = sampleOffset(tEdges, coords.zy, ivec2(1, 0)).r;
        weights.rg = area(sqrt(distance), edge1, edge2, 0.0);

        coords.y = vUv.y;
        detectHorizontalCorners(weights.rg, coords.xyzy, distance);
      } else {
        edge.r = 0.0;
      }
    }

    if (edge.r > 0.0) {
      vec2 distance;
      vec3 coords;
      coords.y = searchYUp(vOffset[1].xy, vOffset[2].z);
      coords.x = vOffset[0].x;
      distance.x = coords.y;
      float edge1 = texture(tEdges, coords.xy).g;

      coords.z = searchYDown(vOffset[1].zw, vOffset[2].w);
      distance.y = coords.z;
      distance = abs(round(
        distance / uResolution.y - vPixcoord.yy
      ));
      float edge2 = sampleOffset(tEdges, coords.xz, ivec2(0, -1)).g;
      weights.ba = area(sqrt(distance), edge1, edge2, 0.0);

      coords.x = vUv.x;
      detectVerticalCorners(weights.ba, coords.xyxz, distance);
    }

    outColor = weights;
  }
`;

const NEIGHBOR_VERTEX = /* glsl */ `
  precision highp float;
  in vec3 position;
  in vec2 uv;

  uniform vec2 uResolution;
  out vec2 vUv;
  out vec4 vOffset;

  void main() {
    vUv = uv;
    // Right and canonical "top" (bottom in WebGL texture coordinates).
    vOffset = uv.xyxy + uResolution.xyxy
      * vec4(1.0, 0.0, 0.0, -1.0);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const NEIGHBOR_FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler2D;

  uniform sampler2D tColor;
  uniform sampler2D tBlend;
  uniform vec2 uResolution;
  in vec2 vUv;
  in vec4 vOffset;
  out vec4 outColor;

  void main() {
    vec4 blend;
    blend.x = texture(tBlend, vOffset.xy).a;
    blend.y = texture(tBlend, vOffset.zw).g;
    blend.wz = texture(tBlend, vUv).xz;

    if (dot(blend, vec4(1.0)) < 1e-5) {
      outColor = texture(tColor, vUv);
      return;
    }

    bool horizontal = max(blend.x, blend.z) > max(blend.y, blend.w);
    vec4 blendingOffset = vec4(0.0, blend.y, 0.0, blend.w);
    vec2 blendingWeight = blend.yw;
    if (horizontal) {
      blendingOffset = vec4(blend.x, 0.0, blend.z, 0.0);
      blendingWeight = blend.xz;
    }
    blendingWeight /= dot(blendingWeight, vec2(1.0));

    // Unity's canonical offset vector transformed into WebGL texture space.
    vec4 coordinate = vUv.xyxy + blendingOffset
      * vec4(uResolution.x, -uResolution.y,
             -uResolution.x, uResolution.y);
    outColor = blendingWeight.x * texture(tColor, coordinate.xy)
      + blendingWeight.y * texture(tColor, coordinate.zw);
  }
`;

function makeHdrTarget(
  width: number,
  height: number,
  name: string,
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.name = name;
  target.texture.generateMipmaps = false;
  target.texture.colorSpace = THREE.NoColorSpace;
  return target;
}

function makeUnormTarget(
  width: number,
  height: number,
  name: string,
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.name = name;
  target.texture.generateMipmaps = false;
  target.texture.colorSpace = THREE.NoColorSpace;
  return target;
}

function makeMaterial(
  name: string,
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
): THREE.RawShaderMaterial {
  return new THREE.RawShaderMaterial({
    name,
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader,
    fragmentShader,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function loadLookupTexture(file: string, name: string): THREE.Texture {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const texture = new THREE.TextureLoader().load(`${base}unity/smaa/${file}`);
  texture.name = name;
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  return texture;
}

/**
 * Unity URP's active StopNaN + SMAA High sequence.
 *
 * The pass consumes and produces linear HDR. Edge and blend weights use the
 * same 8-bit UNorm precision as URP. The lookup textures are losslessly
 * converted from URP 17.5.0's AreaTex.tga and SearchTex.tga.
 */
export class UnitySmaaPass extends Pass {
  private readonly sanitized: THREE.WebGLRenderTarget;
  private readonly edges: THREE.WebGLRenderTarget;
  private readonly weights: THREE.WebGLRenderTarget;
  private readonly areaTexture: THREE.Texture;
  private readonly searchTexture: THREE.Texture;

  private readonly sanitizeMaterial: THREE.RawShaderMaterial;
  private readonly edgeMaterial: THREE.RawShaderMaterial;
  private readonly weightsMaterial: THREE.RawShaderMaterial;
  private readonly neighborMaterial: THREE.RawShaderMaterial;
  private readonly fsQuad: FullScreenQuad;
  private readonly resolution = new THREE.Vector2(1, 1);
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(width = 1, height = 1) {
    super();
    this.needsSwap = true;

    this.sanitized = makeHdrTarget(1, 1, "UnitySMAA.StopNaN");
    this.edges = makeUnormTarget(1, 1, "UnitySMAA.EdgesRGBA8");
    this.weights = makeUnormTarget(1, 1, "UnitySMAA.WeightsRGBA8");
    this.areaTexture = loadLookupTexture("area.png", "Unity SMAA AreaTex");
    this.searchTexture = loadLookupTexture(
      "search.png",
      "Unity SMAA SearchTex",
    );

    this.sanitizeMaterial = makeMaterial(
      "UnitySMAA.StopNaNAndUnsignedHDR",
      FULLSCREEN_VERTEX,
      SANITIZE_FRAGMENT,
      { tSource: { value: null as THREE.Texture | null } },
    );
    this.edgeMaterial = makeMaterial(
      "UnitySMAA.High.EdgeDetection",
      EDGE_VERTEX,
      EDGE_FRAGMENT,
      {
        tColor: { value: this.sanitized.texture },
        uResolution: { value: this.resolution },
      },
    );
    this.weightsMaterial = makeMaterial(
      "UnitySMAA.High.BlendingWeights",
      WEIGHTS_VERTEX,
      WEIGHTS_FRAGMENT,
      {
        tEdges: { value: this.edges.texture },
        tArea: { value: this.areaTexture },
        tSearch: { value: this.searchTexture },
        uResolution: { value: this.resolution },
      },
    );
    this.neighborMaterial = makeMaterial(
      "UnitySMAA.High.LinearNeighborhood",
      NEIGHBOR_VERTEX,
      NEIGHBOR_FRAGMENT,
      {
        tColor: { value: this.sanitized.texture },
        tBlend: { value: this.weights.texture },
        uResolution: { value: this.resolution },
      },
    );
    this.fsQuad = new FullScreenQuad(this.sanitizeMaterial);
    this.setSize(width, height);
  }

  override setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.sanitized.setSize(this.width, this.height);
    this.edges.setSize(this.width, this.height);
    this.weights.setSize(this.width, this.height);
    this.resolution.set(1 / this.width, 1 / this.height);
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime: number,
    maskActive: boolean,
  ): void {
    if (this.disposed) return;
    if (readBuffer.width !== this.width || readBuffer.height !== this.height) {
      this.setSize(readBuffer.width, readBuffer.height);
    }

    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    const stencil = renderer.state.buffers.stencil;
    if (maskActive) stencil.setTest(false);

    try {
      this.sanitizeMaterial.uniforms.tSource.value = readBuffer.texture;
      this.draw(renderer, this.sanitized, this.sanitizeMaterial);
      this.draw(renderer, this.edges, this.edgeMaterial);
      this.draw(renderer, this.weights, this.weightsMaterial);

      if (maskActive) stencil.setTest(true);
      this.fsQuad.material = this.neighborMaterial;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    } finally {
      if (maskActive) stencil.setTest(true);
      renderer.autoClear = oldAutoClear;
    }
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sanitized.dispose();
    this.edges.dispose();
    this.weights.dispose();
    this.areaTexture.dispose();
    this.searchTexture.dispose();
    this.sanitizeMaterial.dispose();
    this.edgeMaterial.dispose();
    this.weightsMaterial.dispose();
    this.neighborMaterial.dispose();
    this.fsQuad.dispose();
  }

  private draw(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget,
    material: THREE.Material,
  ): void {
    this.fsQuad.material = material;
    renderer.setRenderTarget(target);
    this.fsQuad.render(renderer);
  }
}
