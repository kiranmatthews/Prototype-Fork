// Shader adaptations: Copyright (C) 2018-2025 guest(r), GPL-2.0-or-later.
// See public/crt-guest/provenance/THIRD-PARTY-NOTICES.md.
import type { CrtGuestSettingsLike } from './pass';
import { getCrtGuestParameter, getCrtGuestRange, type CrtGuestVariant } from './settings';

/** Dependencies, not quality approximations: an unconsumed surface is absent. */
export function planCrt(s: CrtGuestSettingsLike, height: number, width = 0, outputWidth = -1) {
  const v = (id: string) => s.getValue(id, s.variant);
  const afterglow = v('AS') !== 0;
  const average = s.variant === 'advanced' && v('BLOOM') !== 0;
  const edges = s.variant === 'advanced' && v('smart_ei') > .01 && v('TATE') < .5;
  const glow = v('glow') !== 0;
  const bloom = Math.abs(v('bloom')) > .025 || Math.abs(v('halation')) > .01 ||
    (v('shadowMask') > -.5 && Math.abs(v('mask_bloom')) > .025);
  const interlaced = v('inter') <= height / (v('intres') > 1.25 ? v('intres') : 1) &&
    v('interm') > .5 && v('intres') !== 1 && v('intres') !== .5 && v('vga_mode') < .5;
  const singleSample = !interlaced || v('interm') === 4 || v('hiscan') > .5 || v('vga_mode') > .5;
  const fusePre = !average && !edges && v('vigstr') === 0 && singleSample &&
    (s.variant === 'hd' || v('downsample_levelx') + v('downsample_levely') <= .025);
  // With a 1:1 horizontal raster and this narrow positive kernel, adjacent
  // weights are below 2e-22. Interlaced/no-scanline output doesn't consume the
  // reconstruction's peak-alpha channel, so the linear surface is sufficient.
  const interb = v('hiscan') < .5 && (v('no_scanlines') > .025 || (interlaced && v('interm') !== 5));
  const auto = height < 375 ? 1 + .85 * Math.max(0, Math.min(1, v('auto_res') * Math.round(width/300) - 1)) : 1;
  const reconstruction = s.variant === 'hd' && !(width === outputWidth && interb &&
    v('S_SHARP') === 0 && v('SIGMA_HOR') * v('internal_res') * auto <= .100001);
  return { afterglow, average, edges, glow, bloom, fusePre, fuseInput: fusePre && !afterglow && v('oimage') === 0,
    reconstruction,
    mipmaps: s.variant === 'advanced' && v('BLOOM') !== 0,
    scalarAverage: average,
  };
}
export type CrtPlan = ReturnType<typeof planCrt>;

export type CrtHalfFloatRounding = 'truncate' | 'nearest';

/** The relevant values are positive, normal half floats (1 / gamma, 0.2..1).
 * Keep float32 reciprocal and the device's render-target rounding convention. */
export function crtHalfFloat(value: number, rounding: CrtHalfFloatRounding): number {
  const step = 2 ** (Math.floor(Math.log2(value)) - 10);
  const scaled = Math.fround(value) / step, lower = Math.floor(scaled);
  const up = scaled - lower > .5 || (scaled - lower === .5 && lower % 2 === 1);
  return (rounding === 'nearest' && up ? lower + 1 : lower) * step;
}

export function crtFrameMetadata(s: CrtGuestSettingsLike, height: number, rounding: CrtHalfFloatRounding | null) {
  const v = (id: string) => s.getValue(id);
  const interlaced = v('inter') <= height / (v('intres') > 1.25 ? v('intres') : 1) &&
    v('interm') > .5 && v('intres') !== 1 && v('intres') !== .5 && v('vga_mode') < .5;
  let interlace = interlaced || v('hiscan') > .5 ? .25 : 1;
  if (v('vga_mode') > .5) interlace = v('inter') <= height ? .75 : .5;
  const gamma = v('GAMMA_INPUT');
  const inverseGamma = gamma === 1 ? 1 : rounding && Number.isFinite(gamma) && gamma >= 1 && gamma <= 5
    ? crtHalfFloat(Math.fround(1 / Math.fround(gamma)), rounding) : null;
  return { interlace, inverseGamma };
}

/** Frame-wide alpha metadata was being fetched twice for every output pixel.
 * Its exact value is known from settings; baking the interlace state also
 * removes entire unselected reconstruction/scanline branches on the GPU. */
export function specializeFrameMetadata(source: string, s: CrtGuestSettingsLike, width: number,
  height: number, rounding: CrtHalfFloatRounding | null): string {
  // Tiny textures can interpolate across the two metadata bands.
  if (width < 4) return source;
  const metadata = crtFrameMetadata(s,height,rounding);
  source = source.replace('crtGuestSampleLinearBorder(LinearizePass, vec2(0.75, 0.25), 0.0).w', literal(metadata.interlace));
  if (metadata.inverseGamma !== null) {
    source = source.replace('uniform highp sampler2D LinearizePass;',
      'uniform highp sampler2D LinearizePass;\nuniform highp float uCrtInverseGamma;');
    source = source.replace('crtGuestSampleLinearBorder(LinearizePass, vec2(0.25), 0.0).w',
      metadata.inverseGamma === 1 ? '1.0' : 'uCrtInverseGamma');
  }
  return source;
}

/** At a native, unwarped raster a narrow positive vertical kernel has only
 * its centre above half-float precision. Preserve the original centre-coordinate
 * calculation, gamma/peak math and all non-native/curved/filtering paths. */
export function optimizeNativeVertical(source: string, s: CrtGuestSettingsLike, height: number, outputHeight: number): string {
  const v = (id: string) => s.getValue(id);
  const interlace = crtFrameMetadata(s,height,null).interlace;
  if (s.variant !== 'hd' || height !== outputHeight || interlace !== .25 ||
      v('interm') === 5 || v('hiscan') !== 0 || v('no_scanlines') !== 0 || v('intres') !== 0 ||
      v('S_SHARP') !== 0 || v('SIGMA_VER') * v('internal_res') > .100001 ||
      // Very small exponents amplify otherwise negligible tails in peak alpha.
      v('scangamma') / v('GAMMA_INPUT') < .41 ||
      ['warpX','warpY','overscanX','overscanY','VShift'].some(id=>v(id)!==0)) return source;
  const start = source.indexOf('highp vec3 v_resample('), end = source.indexOf('\nhighp float st(',start);
  if (start < 0 || end < 0) throw new Error('HD vertical reconstruction function changed');
  return source.slice(0,start) + `highp vec3 v_resample(highp vec2 tex0, highp vec4 Size) {
    vec2 tex = tex0;
    tex.y = (floor(Size.y * tex.y) * Size.w) + (0.5 * Size.w);
    return crtGuestSampleLinearBorder(Pass1, tex, 0.0).rgb;
}\n` + source.slice(end);
}

// Integer neighbours replace six UV->texel conversions and repeated size
// queries. The two legacy esrc inputs both name this same stock surface.
export const CRT_AFTERGLOW_SHADER = `precision highp float;
precision highp int;
uniform sampler2D OriginalHistory0;
uniform sampler2D AfterglowPassFeedback;
uniform vec4 uParams_OriginalSize;
uniform highp float uParams_PR;
uniform highp float uParams_PG;
uniform highp float uParams_PB;
uniform highp float uParams_bth;
out vec4 FragColor;
ivec2 extent;
vec3 neighbour(ivec2 p) {
  if(any(lessThan(p,ivec2(0))) || any(greaterThanEqual(p,extent))) return vec3(0.0);
  return texelFetch(OriginalHistory0,p,0).rgb;
}
void main() {
  extent=ivec2(uParams_OriginalSize.xy);
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec3 centre=texelFetch(OriginalHistory0,p,0).rgb;
  vec3 colour=((((centre*2.5+neighbour(p-ivec2(1,0)))+neighbour(p+ivec2(1,0)))+
    neighbour(p-ivec2(0,1)))+neighbour(p+ivec2(0,1)))/6.5;
  vec3 previous=texelFetch(AfterglowPassFeedback,p,0).rgb;
  float b=uParams_bth/255.0;
  float w=smoothstep(b,2.0*b,max(max(centre.r,centre.g),centre.b));
  vec3 result=mix(max(mix(colour,previous,vec3(0.49)+vec3(uParams_PR,uParams_PG,uParams_PB))-
    vec3(0.0049019609577953815),vec3(0.0)),colour,vec3(w));
  FragColor=vec4(result,w);
}`;

/** Remove identity colour-space round trips before the preserved RGBA8 write.
 * EBU/sRGB -> sRGB is the same gamut; WP=0 has no temperature transform. */
export function optimizePreColour(source: string, settings: CrtGuestSettingsLike): string {
  if (settings.getValue('AS') === 0 && settings.getValue('BP') > 0) {
    // Only threshold alpha is consumed. Reproduce its RGBA8 quantization from
    // the already-fetched stock pixel; no spatial/temporal history is needed.
    source = source.replace('uniform highp sampler2D AfterglowPass;',
      `uniform highp sampler2D AfterglowPass;
uniform highp float uParams_bth;
float crtBlackThreshold(vec3 c) {
  float b=uParams_bth/255.0;
  float w=smoothstep(b,2.0*b,max(max(c.r,c.g),c.b));
  return floor(w*255.0+0.5)/255.0;
}`);
    source = source.replace('crtGuestSamplePointBorder(AfterglowPass, vTexCoord, 0.0)',
      'vec4(0.0,0.0,0.0,crtBlackThreshold(imgColor.rgb))');
  }
  if (settings.getValue('CP') === 0 && settings.getValue('CS') === 0)
    source = source.replace('uniform highp float uParams_CP;', 'const highp float uParams_CP = -1.0;');
  if (settings.getValue('WP') === 0) {
    const start = source.lastIndexOf('    p = 2.2000000476837158203125;');
    const tail = '    color = pow(max(color, vec3(0.0)), vec3(1.0 / p));';
    const end = source.indexOf(tail, start);
    if (start < 0 || end < 0) throw new Error('CRT neutral white-point block changed');
    source = source.slice(0,start) + '    color = clamp(color, vec3(0.0), vec3(1.0));' + source.slice(end+tail.length);
  }
  return source;
}

/** Compose the two reciprocal mask transfers analytically. The original
 * min(...,1) is retained after the equivalent multiplication in colour space. */
export function optimizeMaskTransfer(source: string): string {
  const pattern = /color = pow\(color, vec3\(uGlobal_mask_gamma \/ gamma_in\)\);\s*color \*= cmask;\s*color = min\(color, vec3\(1\.0\)\);\s*color = pow\(color, vec3\(gamma_in \/ uGlobal_mask_gamma\)\);/;
  if (!pattern.test(source)) throw new Error('CRT mask transfer sequence changed');
  return source.replace(pattern,'color = min(color * pow(cmask, vec3(gamma_in / uGlobal_mask_gamma)), vec3(1.0));');
}

const literal = (value: number) => Number.isInteger(value) ? `${value}.0` : String(value);
// Keep raster-coordinate arithmetic in the original evaluation order. Folding
// a nominally neutral warp changes which side of floor() a scanline centre hits.
const RASTER_UNIFORMS = new Set(['warpX','warpY','c_shape','IOS','overscanX','overscanY','VShift','BLOOM','OS','TATE','intres']);

/** Specialize only discrete choices and exact neutral values. Continuous
 * controls remain uniforms, so dragging them doesn't compile a shader/frame.
 * The driver can eliminate inactive texture reads, pow chains and mask branches. */
export function specializeCrt(source: string, settings: CrtGuestSettingsLike, variant: CrtGuestVariant): string {
  return source.replace(/uniform highp float ((?:uParams_|uGlobal_)(\w+));/g, (declaration, name, id) => {
    const parameter = getCrtGuestParameter(id);
    if (!parameter) return declaration;
    if (RASTER_UNIFORMS.has(id)) return declaration;
    const range = getCrtGuestRange(parameter, variant);
    if (!range) return declaration;
    const value = settings.getValue(id, variant);
    if (range.step >= 1 || value === 0 || value === 1 || id === 'LS')
      return `const highp float ${name} = ${literal(value)};`;
    return declaration;
  });
}

/** A source-pixel colour transform and linearization can share one draw when
 * no consumer needs the pre surface or its neighbours. Keep its UNORM8 rounding. */
export function fusePreLinear(pre: string, linear: string, fuseInput = false): string {
  // Namespace the two translated programs, retaining common stage uniforms.
  const namespace = (source: string, prefix: string) => source
    .replace(/^#version[^\n]*\n/m, '')
    .replace(/\b(plant|FragColor|main|crtGuestInsideUv|crtGuestSamplePointBorder|crtGuestSampleLinearBorder)\b/g, `${prefix}$1`)
    .replace(/layout\(location = 0\) out highp vec4 (\w+);/, 'highp vec4 $1;');
  let first = namespace(pre, 'pre_');
  let second = namespace(linear, 'lin_');
  if (fuseInput) {
    first = first.replace('pre_crtGuestSamplePointBorder(StockPass, vTexCoord, 0.0)', 'crtEncodedInput()');
    first = `precision highp float;
precision highp int;
uniform highp sampler2D Source;
in highp vec2 vTexCoord;
vec4 crtEncodedInput() {
  vec3 c = max(textureLod(Source, clamp(vTexCoord,0.0,1.0),0.0).rgb,0.0);
  vec3 encoded = mix(1.055*pow(c,vec3(1.0/2.4))-0.055,c*12.92,vec3(lessThanEqual(c,vec3(0.0031308))));
  return vec4(floor(clamp(encoded,0.0,1.0)*255.0+0.5)/255.0,1.0);
}
${first}`;
  }
  // On the single-sample path c2 is dead. Giving it c1 also permits the compiler
  // to eliminate its sample; the graph planner excludes all two-line modes.
  second = second.replace(/lin_crtGuestSampleLinearBorder\((?:Source|PrePass), vTexCoord(?: \+ vec2\([^;]*?\))?, 0\.0\)/g, 'pre_FragColor');
  const declarations = new Set<string>();
  const dedupe = (source: string) => source.replace(/^(?:uniform[^;]+;|in highp vec2 vTexCoord;)$/gm, line => {
    if (declarations.has(line)) return '';
    declarations.add(line); return line;
  });
  first = dedupe(first); second = dedupe(second);
  return `${first}\n${second}\nlayout(location = 0) out highp vec4 FragColor;
void main() {
  pre_main();
  pre_FragColor = floor(clamp(pre_FragColor, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  lin_main();
  FragColor = lin_FragColor;
}`;
}

/** Bound HD reconstruction loops to their actual support. Keep every original
 * sample: even tiny weights can affect the alpha peak's later nonlinear math. */
export function optimizeHdFilter(source: string, horizontal: boolean, s: CrtGuestSettingsLike,
  width: number, height: number): string {
  const v = (id: string) => s.getValue(id, 'hd');
  const auto = horizontal && height < 375 ? 1 + .85 * Math.max(0, Math.min(1,v('auto_res')*Math.round(width/300)-1)) : 1;
  const scale = v('internal_res') * auto / (horizontal ? 1 : 1+v('hiscan'));
  const support = v(horizontal ? 'HSHARPNESS' : 'VSHARPNESS')*scale;
  const radius = Math.ceil(2 * (horizontal ? support : Math.max(support,.6)));
  // A spare iteration keeps the GPU's own ceil()/float rounding authoritative
  // at fractional slider boundaries. Its original break still ends the loop.
  return source.replace('crtGuestLoop0 < 512', `crtGuestLoop0 < ${Math.min(512,2*radius+3)}`);
}

/** Separable Gaussian recurrence: three exponentials per fragment instead of
 * one per tap. Positive/negative sequences start at the centre to avoid the
 * underflow/overflow of recurrences starting at a far tail. Tails beyond 5.5σ
 * are below RGBA16F precision; clipping them also bounds huge user radii.
 * Ordinary glow combines adjacent source texels with hardware linear filtering.
 * Nonlinear magic-glow and bloom-alpha transforms retain individual samples.
 * Adapted from guest(r)'s Gaussian passes, GPL-2.0-or-later; see provenance. */
export function gaussianShader(options: {
  horizontal: boolean; bloom: boolean; radius: number; sigma: number;
  fine: number; auto: number; pair: boolean; magic: boolean;
}): string {
  const { horizontal, bloom, fine, auto, pair, magic } = options;
  const radius = Math.min(Math.round(options.radius * auto), Math.ceil(5.5 * options.sigma * auto + .5));
  const size = horizontal ? 'uParams_OriginalSize' : 'vec4(uParams_SourceSize.x, uParams_OriginalSize.y, uParams_SourceSize.z, uParams_OriginalSize.w)';
  const sigmaId = bloom ? (horizontal ? 'SIGMA_HB' : 'SIGMA_VB') : (horizontal ? 'SIGMA_H' : 'SIGMA_V');
  const sampler = horizontal ? 'LinearizePass' : 'Source';
  const axis = horizontal ? 'x' : 'y';
  return `precision highp float;
precision highp int;
uniform sampler2D ${sampler};
uniform vec4 uParams_SourceSize;
uniform vec4 uParams_OriginalSize;
uniform float uParams_${sigmaId};
uniform float uParams_m_glow_cutoff;
in vec2 vTexCoord;
out vec4 FragColor;
float inside(vec2 p) { return step(0.0,p.x)*step(p.x,1.0)*step(0.0,p.y)*step(p.y,1.0); }
vec4 samplePixel(vec2 p) {
  vec4 c = textureLod(${sampler}, clamp(p,0.0,1.0),0.0)*inside(p);
  ${magic ? `c.rgb = max(c.rgb-vec3(uParams_m_glow_cutoff),0.0);
  float m = max(max(c.r,c.g),c.b);
  c.rgb *= max(m-uParams_m_glow_cutoff,0.0)/(m+0.00001);` : ''}
  ${bloom ? `c.a = ${horizontal ? 'max(max(c.r,c.g),c.b)' : 'c.a'}; c.a *= c.a*c.a;` : ''}
  return c;
}
void main() {
  vec4 size = ${size} * vec4(${literal(fine)},${literal(fine)},${literal(1/fine)},${literal(1/fine)});
  vec2 tex = (floor(size.xy*vTexCoord)+0.5)*size.zw;
  vec2 delta = ${horizontal ? 'vec2(size.z,0.0)' : 'vec2(0.0,size.w)'};
  float f = 0.5-fract(size.${axis}*vTexCoord.${axis});
  float sigma = uParams_${sigmaId}*${literal(auto)};
  float inv = 1.0/(2.0*sigma*sigma);
  float q = exp(-2.0*inv);
  float rp = exp(-(1.0+2.0*f)*inv), rn = exp(-(1.0-2.0*f)*inv);
  float wp = 1.0, wn = 1.0, sum = 1.0;
  vec4 color = samplePixel(tex);
  for (int i=1; i<=${radius}; i+=${pair ? 2 : 1}) {
    wp *= rp; wn *= rn; rp *= q; rn *= q;
    ${pair ? `float wp2 = i<${radius} ? wp*rp : 0.0, wn2 = i<${radius} ? wn*rn : 0.0;
    sum += wp+wn+wp2+wn2;
    vec2 pp = tex+delta*float(i), pn = tex-delta*float(i);
    float a=wp*inside(pp), b=wp2*inside(pp+delta);
    float c=wn*inside(pn), d=wn2*inside(pn-delta);
    color += textureLod(${sampler},clamp(pp+delta*(b/max(a+b,1e-30)),0.0,1.0),0.0)*(a+b);
    color += textureLod(${sampler},clamp(pn-delta*(d/max(c+d,1e-30)),0.0,1.0),0.0)*(c+d);
    wp=wp2; wn=wn2; rp*=q; rn*=q;` : `sum += wp+wn;
    color += samplePixel(tex+delta*float(i))*wp + samplePixel(tex-delta*float(i))*wn;`}
  }
  color /= sum;
  FragColor = ${bloom ? `vec4(color.rgb,pow(max(color.a,0.0),${horizontal ? '0.33333298563957214' : '0.17499999701976776'}))` : 'vec4(color.rgb,1.0)'};
}`;
}
