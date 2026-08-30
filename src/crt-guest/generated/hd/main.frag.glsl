#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of hd/crt-guest-advanced-hd-pass2.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: f48a4ab1a8b800107630d0828e516e998bf5cd546e004d70e1604ba24c7a496a
// Copyright (C) 2018-2025 guest(r), GPL-2.0-or-later.
// See /crt-guest/provenance/THIRD-PARTY-NOTICES.md.
precision highp float;
precision highp int;


float crtGuestInsideUv(vec2 uv)
{
    vec2 insideLow = step(vec2(0.0), uv);
    vec2 insideHigh = step(uv, vec2(1.0));
    return insideLow.x * insideLow.y * insideHigh.x * insideHigh.y;
}

vec4 crtGuestSamplePointBorder(sampler2D textureObject, vec2 uv, float lod)
{
    int lodLevel = max(int(floor(lod + 0.5)), 0);
    ivec2 levelSize = textureSize(textureObject, lodLevel);
    ivec2 texel = ivec2(floor(clamp(uv, 0.0, 1.0) * vec2(levelSize)));
    texel = clamp(texel, ivec2(0), levelSize - ivec2(1));
    return texelFetch(textureObject, texel, lodLevel) * crtGuestInsideUv(uv);
}

vec4 crtGuestSampleLinearBorder(sampler2D textureObject, vec2 uv, float lod)
{
    return textureLod(textureObject, clamp(uv, 0.0, 1.0), lod)
        * crtGuestInsideUv(uv);
}

uniform highp mat4 uGlobal_MVP;
uniform highp vec4 uGlobal_SourceSize;
uniform highp vec4 uGlobal_OriginalSize;
uniform highp vec4 uGlobal_OutputSize;
uniform highp float uGlobal_FrameCount;
uniform highp float uGlobal_warpX;
uniform highp float uGlobal_warpY;
uniform highp float uGlobal_csize;
uniform highp float uGlobal_bsize1;
uniform highp float uGlobal_intres;
uniform highp float uGlobal_c_shape;
uniform highp float uGlobal_barspeed;
uniform highp float uGlobal_barintensity;
uniform highp float uGlobal_bardir;
uniform highp float uGlobal_internal_res;
uniform highp float uGlobal_scangamma;
uniform highp float uGlobal_sborder;
uniform highp float uGlobal_scan_falloff;
uniform highp float uGlobal_overscanX;
uniform highp float uGlobal_overscanY;
uniform highp float uGlobal_VShift;
uniform highp float uGlobal_bloom_dist;
uniform highp float uGlobal_bmask1;
uniform highp float uGlobal_hmask1;
uniform highp float uGlobal_interm;

uniform highp float uParams_IOS;
uniform highp float uParams_brightboost;
uniform highp float uParams_brightboost1;
uniform highp float uParams_gsl;
uniform highp float uParams_scanline1;
uniform highp float uParams_scanline2;
uniform highp float uParams_beam_min;
uniform highp float uParams_beam_max;
uniform highp float uParams_beam_size;
uniform highp float uParams_glow;
uniform highp float uParams_inters;
uniform highp float uParams_bloom;
uniform highp float uParams_halation;
uniform highp float uParams_scans;
uniform highp float uParams_gamma_c;
uniform highp float uParams_gamma_c2;
uniform highp float uParams_no_scanlines;
uniform highp float uParams_MAXS;
uniform highp float uParams_tds;
uniform highp float uParams_clips;
uniform highp float uParams_hiscan;
uniform highp float uParams_SIGMA_VER;
uniform highp float uParams_VSHARPNESS;
uniform highp float uParams_HARNG;
uniform highp float uParams_HSHARP;
uniform highp float uParams_S_SHARP;
uniform highp float uParams_rolling_scan;

uniform highp sampler2D Pass1;
uniform highp sampler2D LinearizePass;
uniform highp sampler2D BloomPass;
uniform highp sampler2D PrePass;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;
highp float invsqrsigma;

highp vec2 Overscan(inout highp vec2 pos, highp float dx, highp float dy)
{
    pos = (pos * 2.0) - vec2(1.0);
    pos *= vec2(dx, dy);
    return (pos * 0.5) + vec2(0.5);
}

highp vec2 Warp(inout highp vec2 pos)
{
    pos = (pos * 2.0) - vec2(1.0);
    pos = mix(pos, vec2(pos.x * inversesqrt(1.0 - ((uGlobal_c_shape * pos.y) * pos.y)), pos.y * inversesqrt(1.0 - ((uGlobal_c_shape * pos.x) * pos.x))), vec2(uGlobal_warpX, uGlobal_warpY) / vec2(uGlobal_c_shape));
    return (pos * 0.5) + vec2(0.5);
}

highp float gaussian(highp float x)
{
    return exp(((-x) * x) * invsqrsigma);
}

highp vec3 v_resample(highp vec2 tex0, highp vec4 Size)
{
    highp float f = fract(Size.y * tex0.y);
    f = 0.5 - f;
    highp vec2 tex = tex0;
    tex.y = (floor(Size.y * tex.y) * Size.w) + (0.5 * Size.w);
    highp vec3 color = vec3(0.0);
    highp vec2 dy = vec2(0.0, Size.w);
    highp float w = 0.0;
    highp float wsum = 0.0;
    highp vec3 cmax = vec3(0.0);
    highp vec3 cmin = vec3(1.0);
    highp float vsharpness = max((uParams_VSHARPNESS * uGlobal_internal_res) * (1.0 / (1.0 + uParams_hiscan)), 0.60000002384185791015625);
    highp float param = vsharpness;
    highp float sharp = gaussian(param) * uParams_S_SHARP;
    highp float maxsharp = uParams_MAXS;
    highp float FPR = vsharpness;
    highp float FPRi = 1.0 / vsharpness;
    highp float fpx = 0.0;
    highp float LOOPSIZE = ceil(2.0 * FPR);
    highp float n = -LOOPSIZE;
    for (int crtGuestLoop0 = 0; crtGuestLoop0 < 512; crtGuestLoop0++)
    {
        highp vec3 pixel = crtGuestSampleLinearBorder(Pass1, tex + (dy * n), 0.0).xyz;
        highp float param_1 = n + f;
        w = gaussian(param_1) - sharp;
        fpx = (abs(n + f) - FPR) * FPRi;
        if (w < 0.0)
        {
            w = max(w, mix(-maxsharp, 0.0, pow(clamp(fpx, 0.0, 1.0), uParams_HSHARP)));
        }
        else
        {
            cmax = max(cmax, pixel);
            cmin = min(cmin, pixel);
        }
        color += (pixel * w);
        wsum += w;
        n += 1.0;
        if (!(n <= LOOPSIZE))
        {
            break;
        }
    }
    color /= vec3(wsum);
    color = clamp(mix(clamp(color, cmin, cmax), color, vec3(uParams_HARNG)), vec3(0.0), vec3(1.0));
    return color;
}

highp float st(highp float x)
{
    return exp2(((-10.0) * x) * x);
}

highp vec3 sw0(highp float x, highp float color, highp float scanline, highp vec3 c)
{
    highp float tmp = mix(uParams_beam_min, uParams_beam_max, color);
    highp vec3 sat = mix(vec3(1.0) + vec3(1.5 * uParams_scans), vec3(1.0), c);
    highp float ex = x * tmp;
    highp float _143;
    if (uParams_gsl > (-0.5))
    {
        _143 = ex * ex;
    }
    else
    {
        _143 = mix(ex * ex, (ex * ex) * ex, 0.4000000059604644775390625);
    }
    ex = _143;
    return exp2(sat * ((-scanline) * ex));
}

highp vec3 sw1(inout highp float x, highp float color, highp float scanline, highp vec3 c)
{
    x = mix(x, uParams_beam_min * x, max(x - (0.4000000059604644775390625 * color), 0.0));
    highp vec3 sat = mix(vec3(1.0) + vec3(1.5 * uParams_scans), vec3(1.0), c);
    highp float tmp = mix(1.2000000476837158203125 * uParams_beam_min, uParams_beam_max, color);
    highp float ex = x * tmp;
    return exp2(sat * (((-scanline) * ex) * ex));
}

highp vec3 sw2(highp float x, highp float color, highp float scanline, highp vec3 c)
{
    highp float tmp = mix((2.5 - (0.5 * color)) * uParams_beam_min, uParams_beam_max, color);
    highp vec3 sat = mix(vec3(1.0) + vec3(1.5 * uParams_scans), vec3(1.0), c);
    tmp = mix(uParams_beam_max, tmp, pow(x, color + 0.300000011920928955078125));
    highp float ex = x * tmp;
    return exp2(sat * (((-scanline) * ex) * ex));
}

highp vec3 plant(highp vec3 tar, highp float r)
{
    highp float t = max(max(tar.x, tar.y), tar.z) + 9.9999997473787516355514526367188e-06;
    return (tar * r) / vec3(t);
}

highp vec3 gc(highp vec3 c)
{
    highp float mc = max(max(c.x, c.y), c.z);
    highp float mg = pow(mc, 1.0 / uParams_gamma_c);
    return (c * mg) / vec3(mc + 1.0000000133514319600180897396058e-10);
}

void main()
{
    invsqrsigma = 1.0 / ((((((2.0 * uParams_SIGMA_VER) * uParams_SIGMA_VER) * uGlobal_internal_res) * (1.0 / (1.0 + uParams_hiscan))) * uGlobal_internal_res) * (1.0 / (1.0 + uParams_hiscan)));
    highp vec2 prescalex = vec2(textureSize(LinearizePass, 0)) / uGlobal_OriginalSize.xy;
    highp vec4 SourceSize = vec4(uGlobal_SourceSize.x, uGlobal_OriginalSize.y, uGlobal_SourceSize.z, uGlobal_OriginalSize.w);
    highp float gamma_in = 1.0 / crtGuestSampleLinearBorder(LinearizePass, vec2(0.25), 0.0).w;
    highp float intera = crtGuestSampleLinearBorder(LinearizePass, vec2(0.75, 0.25), 0.0).w;
    bool hscan = uParams_hiscan > 0.5;
    bool _600 = intera < 0.3499999940395355224609375;
    bool _607;
    if (_600)
    {
        _607 = uGlobal_interm == 5.0;
    }
    else
    {
        _607 = _600;
    }
    bool inter6 = _607;
    bool _613 = (intera < 0.3499999940395355224609375) && (!inter6);
    bool _622;
    if (!_613)
    {
        _622 = uParams_no_scanlines > 0.02500000037252902984619140625;
    }
    else
    {
        _622 = _613;
    }
    bool interb = _622 && (!hscan);
    bool _631 = abs(intera - 0.5) < 0.0500000007450580596923828125;
    bool _637;
    if (_631)
    {
        _637 = uParams_no_scanlines == 0.0;
    }
    else
    {
        _637 = _631;
    }
    bool vgascan = _637;
    highp float SourceY = SourceSize.y;
    highp float sy = 1.0;
    if (uGlobal_intres == 1.0)
    {
        sy = max(round(SourceY / 224.0), 1.0);
    }
    bool _655 = uGlobal_intres > 0.25;
    bool _661;
    if (_655)
    {
        _661 = uGlobal_intres != 1.0;
    }
    else
    {
        _661 = _655;
    }
    if (_661)
    {
        sy = uGlobal_intres;
    }
    if (inter6)
    {
        sy *= 2.0;
    }
    if (vgascan)
    {
        sy = 0.5;
    }
    else
    {
        if (abs(intera - 0.75) < 0.0500000007450580596923828125)
        {
            sy = 1.0;
        }
    }
    SourceSize *= vec4(1.0, 1.0 / sy, 1.0, sy);
    highp vec2 texcoord = vTexCoord;
    if ((uParams_IOS > 0.0) && (!interb))
    {
        highp vec2 ofactor = uGlobal_OutputSize.xy / uGlobal_OriginalSize.xy;
        highp vec2 _711;
        if (uParams_IOS < 2.5)
        {
            _711 = floor(ofactor);
        }
        else
        {
            _711 = ceil(ofactor);
        }
        highp vec2 intfactor = _711;
        highp vec2 diff = ofactor / intfactor;
        highp float scan = diff.y;
        highp vec2 param = texcoord;
        highp float param_1 = scan;
        highp float param_2 = scan;
        highp vec2 _733 = Overscan(param, param_1, param_2);
        texcoord = _733;
        bool _736 = uParams_IOS == 1.0;
        bool _744;
        if (!_736)
        {
            _744 = uParams_IOS == 3.0;
        }
        else
        {
            _744 = _736;
        }
        if (_744)
        {
            texcoord = vec2(vTexCoord.x, texcoord.y);
        }
    }
    texcoord.y -= (uGlobal_VShift * uGlobal_OriginalSize.w);
    highp vec2 param_3 = texcoord;
    highp float param_4 = (uGlobal_OriginalSize.x - uGlobal_overscanX) / uGlobal_OriginalSize.x;
    highp float param_5 = (uGlobal_OriginalSize.y - uGlobal_overscanY) / uGlobal_OriginalSize.y;
    highp vec2 _784 = Overscan(param_3, param_4, param_5);
    texcoord = _784;
    highp vec2 param_6 = texcoord;
    highp vec2 _788 = Warp(param_6);
    highp vec2 pos = _788;
    highp float ii = float(inter6) * floor(mod(float(uGlobal_FrameCount), 2.0));
    highp float coffset = 0.5 + (0.5 * ii);
    highp vec2 ps = SourceSize.zw;
    highp float OGL2Pos = (pos.y * SourceSize.y) - coffset;
    highp float f = fract(OGL2Pos);
    highp vec2 dx = vec2(ps.x, 0.0);
    highp vec2 dy = vec2(0.0, ps.y);
    highp vec2 pC4;
    pC4.y = (floor(OGL2Pos) * ps.y) + (0.5 * ps.y);
    pC4.y += ((float(inter6) * 0.25) * dy.y);
    pC4.x = pos.x;
    bool _852 = uGlobal_intres == 0.5;
    bool _858;
    if (_852)
    {
        _858 = prescalex.y < 1.5;
    }
    else
    {
        _858 = _852;
    }
    if (_858 || vgascan)
    {
        pC4.y = (floor(pC4.y * uGlobal_OriginalSize.y) * uGlobal_OriginalSize.w) + (0.5 * uGlobal_OriginalSize.w);
    }
    bool _883;
    if (interb)
    {
        _883 = uParams_no_scanlines > 0.02500000037252902984619140625;
    }
    else
    {
        _883 = interb;
    }
    if (_883)
    {
        pC4.y += (smoothstep(0.4000000059604644775390625 - (0.5 * uParams_no_scanlines), 0.60000002384185791015625 + (0.5 * uParams_no_scanlines), f) * SourceSize.w);
    }
    highp vec3 color1 = crtGuestSampleLinearBorder(Pass1, pC4, 0.0).xyz;
    highp vec3 scolor1 = crtGuestSampleLinearBorder(Pass1, pC4, 0.0).www;
    highp float prescaley = float(textureSize(LinearizePass, 0).y) / uGlobal_OriginalSize.y;
    bool _928;
    if (interb)
    {
        _928 = uParams_no_scanlines < 0.0500000007450580596923828125;
    }
    else
    {
        _928 = interb;
    }
    bool _935;
    if (!_928)
    {
        _935 = hscan && vgascan;
    }
    else
    {
        _935 = _928;
    }
    if (_935 || hscan)
    {
        highp vec2 param_7 = pos;
        highp vec4 param_8 = SourceSize * vec4(1.0, prescaley, 1.0, 1.0 / prescaley);
        color1 = v_resample(param_7, param_8);
    }
    color1 = pow(color1, vec3(uGlobal_scangamma / gamma_in));
    pC4 += dy;
    bool _963 = uGlobal_intres == 0.5;
    bool _969;
    if (_963)
    {
        _969 = prescalex.y < 1.5;
    }
    else
    {
        _969 = _963;
    }
    if (_969 || vgascan)
    {
        pC4.y = (floor((pos.y + (0.3300000131130218505859375 * dy.y)) * uGlobal_OriginalSize.y) * uGlobal_OriginalSize.w) + (0.5 * uGlobal_OriginalSize.w);
    }
    highp vec3 color2 = crtGuestSampleLinearBorder(Pass1, pC4, 0.0).xyz;
    highp vec3 scolor2 = crtGuestSampleLinearBorder(Pass1, pC4, 0.0).www;
    color2 = pow(color2, vec3(uGlobal_scangamma / gamma_in));
    highp vec3 ctmp = color1;
    highp float w3 = 1.0;
    highp vec3 color = color1;
    highp vec3 one = vec3(1.0);
    if (hscan)
    {
        color2 = color1;
        scolor2 = scolor1;
    }
    if ((!interb) || hscan)
    {
        highp float shape1 = mix(uParams_scanline1, uParams_scanline2, f);
        highp float shape2 = mix(uParams_scanline1, uParams_scanline2, 1.0 - f);
        highp float param_9 = f;
        highp float wt1 = st(param_9);
        highp float param_10 = 1.0 - f;
        highp float wt2 = st(param_10);
        highp vec3 color00 = (color1 * wt1) + (color2 * wt2);
        highp vec3 scolor0 = (scolor1 * wt1) + (scolor2 * wt2);
        ctmp = color00 / vec3(wt1 + wt2);
        highp vec3 sctmp = max(scolor0 / vec3(wt1 + wt2), ctmp);
        if (abs(uParams_rolling_scan) > 0.004999999888241291046142578125)
        {
            color1 = ctmp;
            color2 = ctmp;
            scolor1 = sctmp;
            scolor2 = sctmp;
        }
        highp vec3 cref1 = mix(sctmp, scolor1, vec3(uParams_beam_size));
        highp float creff1 = pow(max(max(cref1.x, cref1.y), cref1.z), uGlobal_scan_falloff);
        highp vec3 cref2 = mix(sctmp, scolor2, vec3(uParams_beam_size));
        highp float creff2 = pow(max(max(cref2.x, cref2.y), cref2.z), uGlobal_scan_falloff);
        if (uParams_tds > 0.5)
        {
            shape1 = mix(uParams_scanline2, shape1, creff1);
            shape2 = mix(uParams_scanline2, shape2, creff2);
        }
        highp float scanpix = uGlobal_OriginalSize.y / uGlobal_OutputSize.y;
        highp float f1 = fract(f - ((uParams_rolling_scan * float(uGlobal_FrameCount)) * scanpix));
        highp float f2 = 1.0 - f1;
        highp float mc1 = max(max(color1.x, color1.y), color1.z) + 1.0000000133514319600180897396058e-10;
        highp float mc2 = max(max(color2.x, color2.y), color2.z) + 1.0000000133514319600180897396058e-10;
        cref1 = color1 / vec3(mc1);
        cref2 = color2 / vec3(mc2);
        highp vec3 w1;
        highp vec3 w2;
        if (uParams_gsl < 0.5)
        {
            highp float param_11 = f1;
            highp float param_12 = creff1;
            highp float param_13 = shape1;
            highp vec3 param_14 = cref1;
            w1 = sw0(param_11, param_12, param_13, param_14);
            highp float param_15 = f2;
            highp float param_16 = creff2;
            highp float param_17 = shape2;
            highp vec3 param_18 = cref2;
            w2 = sw0(param_15, param_16, param_17, param_18);
        }
        else
        {
            if (uParams_gsl == 1.0)
            {
                highp float param_19 = f1;
                highp float param_20 = creff1;
                highp float param_21 = shape1;
                highp vec3 param_22 = cref1;
                highp vec3 _1236 = sw1(param_19, param_20, param_21, param_22);
                w1 = _1236;
                highp float param_23 = f2;
                highp float param_24 = creff2;
                highp float param_25 = shape2;
                highp vec3 param_26 = cref2;
                highp vec3 _1245 = sw1(param_23, param_24, param_25, param_26);
                w2 = _1245;
            }
            else
            {
                highp float param_27 = f1;
                highp float param_28 = creff1;
                highp float param_29 = shape1;
                highp vec3 param_30 = cref1;
                w1 = sw2(param_27, param_28, param_29, param_30);
                highp float param_31 = f2;
                highp float param_32 = creff2;
                highp float param_33 = shape2;
                highp vec3 param_34 = cref2;
                w2 = sw2(param_31, param_32, param_33, param_34);
            }
        }
        highp vec3 w3_1 = w1 + w2;
        highp float wf1 = max(max(w3_1.x, w3_1.y), w3_1.z);
        if (wf1 > 1.0)
        {
            wf1 = 1.0 / wf1;
            w1 *= wf1;
            w2 *= wf1;
        }
        if (abs(uParams_clips) > 0.004999999888241291046142578125)
        {
            sy = mc1;
            bvec3 _1302 = bvec3(uParams_clips > 0.0);
            one = vec3(_1302.x ? w1.x : vec3(1.0).x, _1302.y ? w1.y : vec3(1.0).y, _1302.z ? w1.z : vec3(1.0).z);
            highp float sat = 1.00010001659393310546875 - min(min(cref1.x, cref1.y), cref1.z);
            highp vec3 param_35 = pow(color1, vec3(0.699999988079071044921875) - vec3(0.324999988079071044921875 * sat));
            highp float param_36 = sy;
            color1 = mix(color1, plant(param_35, param_36), (one * pow(sat, 0.33329999446868896484375)) * abs(uParams_clips));
            sy = mc2;
            bvec3 _1344 = bvec3(uParams_clips > 0.0);
            one = vec3(_1344.x ? w2.x : vec3(1.0).x, _1344.y ? w2.y : vec3(1.0).y, _1344.z ? w2.z : vec3(1.0).z);
            sat = 1.00010001659393310546875 - min(min(cref2.x, cref2.y), cref2.z);
            highp vec3 param_37 = pow(color2, vec3(0.699999988079071044921875) - vec3(0.324999988079071044921875 * sat));
            highp float param_38 = sy;
            color2 = mix(color2, plant(param_37, param_38), (one * pow(sat, 0.33329999446868896484375)) * abs(uParams_clips));
        }
        highp vec3 param_39 = color1;
        highp vec3 param_40 = color2;
        color = (gc(param_39) * w1) + (gc(param_40) * w2);
        color = min(color, vec3(1.0));
    }
    if (interb)
    {
        highp vec3 param_41 = color1;
        color = gc(param_41);
    }
    highp float colmx = max(max(ctmp.x, ctmp.y), ctmp.z);
    color = pow(color, vec3(gamma_in / uGlobal_scangamma));
    FragColor = vec4(color, colmx);
}

