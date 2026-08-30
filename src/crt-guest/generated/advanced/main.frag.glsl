#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of advanced/crt-guest-advanced.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: 713bf7cee57c41ebf54d6d4f9bd153715e5ef315cc313b9521e1220fc4f48320
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
uniform highp float uGlobal_bloom;
uniform highp float uGlobal_halation;
uniform highp float uGlobal_scans;
uniform highp float uGlobal_gamma_c;
uniform highp float uGlobal_gamma_c2;
uniform highp float uGlobal_smart_ei;
uniform highp float uGlobal_ei_limit;
uniform highp float uGlobal_sth;
uniform highp float uGlobal_overscanX;
uniform highp float uGlobal_overscanY;
uniform highp float uGlobal_VShift;
uniform highp float uGlobal_c_shape;
uniform highp float uGlobal_intres;
uniform highp float uGlobal_prescalex;
uniform highp float uGlobal_scan_falloff;
uniform highp float uGlobal_bloom_dist;
uniform highp float uGlobal_scangamma;
uniform highp float uGlobal_bmask1;
uniform highp float uGlobal_hmask1;
uniform highp float uGlobal_interm;

uniform highp float uParams_TATE;
uniform highp float uParams_IOS;
uniform highp float uParams_OS;
uniform highp float uParams_BLOOM;
uniform highp float uParams_brightboost;
uniform highp float uParams_brightboost1;
uniform highp float uParams_gsl;
uniform highp float uParams_scanline1;
uniform highp float uParams_scanline2;
uniform highp float uParams_beam_min;
uniform highp float uParams_beam_max;
uniform highp float uParams_beam_size;
uniform highp float uParams_h_sharp;
uniform highp float uParams_s_sharp;
uniform highp float uParams_csize;
uniform highp float uParams_bsize1;
uniform highp float uParams_warpX;
uniform highp float uParams_warpY;
uniform highp float uParams_glow;
uniform highp float uParams_spike;
uniform highp float uParams_ring;
uniform highp float uParams_no_scanlines;
uniform highp float uParams_tds;
uniform highp float uParams_clips;
uniform highp float uParams_hiscan;
uniform highp float uParams_rolling_scan;

uniform highp sampler2D LinearizePass;
uniform highp sampler2D AvgLumPass;
uniform highp sampler2D PrePass;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;

highp vec2 Overscan(inout highp vec2 pos, highp float dx, highp float dy)
{
    pos = (pos * 2.0) - vec2(1.0);
    pos *= vec2(dx, dy);
    return (pos * 0.5) + vec2(0.5);
}

highp vec2 Warp(inout highp vec2 pos)
{
    pos = (pos * 2.0) - vec2(1.0);
    pos = mix(pos, vec2(pos.x * inversesqrt(1.0 - ((uGlobal_c_shape * pos.y) * pos.y)), pos.y * inversesqrt(1.0 - ((uGlobal_c_shape * pos.x) * pos.x))), vec2(uParams_warpX, uParams_warpY) / vec2(uGlobal_c_shape));
    return (pos * 0.5) + vec2(0.5);
}

highp float st(highp float x)
{
    return exp2(((-10.0) * x) * x);
}

highp vec3 sw0(highp float x, highp float color, highp float scanline, highp vec3 c)
{
    highp float tmp = mix(uParams_beam_min, uParams_beam_max, color);
    highp vec3 sat = mix(vec3(1.0) + vec3(1.5 * uGlobal_scans), vec3(1.0), c);
    highp float ex = x * tmp;
    highp float _105;
    if (uParams_gsl > (-0.5))
    {
        _105 = ex * ex;
    }
    else
    {
        _105 = mix(ex * ex, (ex * ex) * ex, 0.4000000059604644775390625);
    }
    ex = _105;
    return exp2(sat * ((-scanline) * ex));
}

highp vec3 sw1(inout highp float x, highp float color, highp float scanline, highp vec3 c)
{
    x = mix(x, uParams_beam_min * x, max(x - (0.4000000059604644775390625 * color), 0.0));
    highp vec3 sat = mix(vec3(1.0) + vec3(1.5 * uGlobal_scans), vec3(1.0), c);
    highp float tmp = mix(1.2000000476837158203125 * uParams_beam_min, uParams_beam_max, color);
    highp float ex = x * tmp;
    return exp2(sat * (((-scanline) * ex) * ex));
}

highp vec3 sw2(highp float x, highp float color, highp float scanline, highp vec3 c)
{
    highp float tmp = mix((2.5 - (0.5 * color)) * uParams_beam_min, uParams_beam_max, color);
    highp vec3 sat = mix(vec3(1.0) + vec3(1.5 * uGlobal_scans), vec3(1.0), c);
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
    highp float mg = pow(mc, 1.0 / uGlobal_gamma_c);
    return (c * mg) / vec3(mc + 1.0000000133514319600180897396058e-10);
}

void main()
{
    highp vec2 prescalex = vec2(textureSize(LinearizePass, 0)) / uGlobal_OriginalSize.xy;
    highp vec4 SourceSize = uGlobal_OriginalSize * mix(vec4(prescalex.x, 1.0, 1.0 / prescalex.x, 1.0), vec4(1.0, prescalex.y, 1.0, 1.0 / prescalex.y), vec4(uParams_TATE));
    highp float lum = crtGuestSampleLinearBorder(AvgLumPass, vec2(0.5), 0.0).w;
    highp float gamma_in = 1.0 / crtGuestSampleLinearBorder(LinearizePass, vec2(0.25), 0.0).w;
    highp float intera = crtGuestSampleLinearBorder(LinearizePass, vec2(0.75, 0.25), 0.0).w;
    bool hscan = uParams_hiscan > 0.5;
    bool _402 = intera < 0.3499999940395355224609375;
    bool _409;
    if (_402)
    {
        _409 = uGlobal_interm == 6.0;
    }
    else
    {
        _409 = _402;
    }
    bool inter6 = _409;
    bool _415 = (intera < 0.3499999940395355224609375) && (!inter6);
    bool _424;
    if (!_415)
    {
        _424 = uParams_no_scanlines > 0.02500000037252902984619140625;
    }
    else
    {
        _424 = _415;
    }
    bool interb = _424 && (!hscan);
    bool notate = uParams_TATE < 0.5;
    bool _437 = abs(intera - 0.5) < 0.0500000007450580596923828125;
    bool _443;
    if (_437)
    {
        _443 = uParams_no_scanlines == 0.0;
    }
    else
    {
        _443 = _437;
    }
    bool vgascan = _443;
    highp float SourceY = mix(SourceSize.y, SourceSize.x, uParams_TATE);
    highp float sy = 1.0;
    if (uGlobal_intres == 1.0)
    {
        sy = max(round(SourceY / 224.0), 1.0);
    }
    bool _465 = uGlobal_intres > 0.25;
    bool _471;
    if (_465)
    {
        _471 = uGlobal_intres != 1.0;
    }
    else
    {
        _471 = _465;
    }
    if (_471)
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
    if (notate)
    {
        SourceSize *= vec4(1.0, 1.0 / sy, 1.0, sy);
    }
    else
    {
        SourceSize *= vec4(1.0 / sy, 1.0, sy, 1.0);
    }
    highp vec2 texcoord = vTexCoord;
    if ((uParams_IOS > 0.0) && (!interb))
    {
        highp vec2 ofactor = uGlobal_OutputSize.xy / uGlobal_OriginalSize.xy;
        highp vec2 _533;
        if (uParams_IOS < 2.5)
        {
            _533 = floor(ofactor);
        }
        else
        {
            _533 = ceil(ofactor);
        }
        highp vec2 intfactor = _533;
        highp vec2 diff = ofactor / intfactor;
        highp float scan = mix(diff.y, diff.x, uParams_TATE);
        highp vec2 param = texcoord;
        highp float param_1 = scan;
        highp float param_2 = scan;
        highp vec2 _560 = Overscan(param, param_1, param_2);
        texcoord = _560;
        bool _563 = uParams_IOS == 1.0;
        bool _571;
        if (!_563)
        {
            _571 = uParams_IOS == 3.0;
        }
        else
        {
            _571 = _563;
        }
        if (_571)
        {
            texcoord = mix(vec2(vTexCoord.x, texcoord.y), vec2(texcoord.x, vTexCoord.y), vec2(uParams_TATE));
        }
    }
    highp float factor = (1.0 + (((1.0 - (0.5 * uParams_OS)) * uParams_BLOOM) / 100.0)) - ((lum * uParams_BLOOM) / 100.0);
    highp vec2 param_3 = texcoord;
    highp float param_4 = factor;
    highp float param_5 = factor;
    highp vec2 _612 = Overscan(param_3, param_4, param_5);
    texcoord = _612;
    texcoord.y -= (uGlobal_VShift * uGlobal_OriginalSize.w);
    highp vec2 param_6 = texcoord;
    highp float param_7 = (uGlobal_OriginalSize.x - uGlobal_overscanX) / uGlobal_OriginalSize.x;
    highp float param_8 = (uGlobal_OriginalSize.y - uGlobal_overscanY) / uGlobal_OriginalSize.y;
    highp vec2 _645 = Overscan(param_6, param_7, param_8);
    texcoord = _645;
    highp vec2 param_9 = texcoord;
    highp vec2 _649 = Warp(param_9);
    highp vec2 pos = _649;
    bool smarte = (uGlobal_smart_ei > 0.00999999977648258209228515625) && notate;
    highp float ii = float(inter6) * floor(mod(float(uGlobal_FrameCount), 2.0));
    highp vec2 coffset = vec2(0.5, 0.5 + (0.5 * ii));
    highp vec2 ps = SourceSize.zw;
    highp vec2 OGL2Pos = (pos * SourceSize.xy) - coffset;
    highp vec2 fp = fract(OGL2Pos);
    highp vec2 dx = vec2(ps.x, 0.0);
    highp vec2 dy = vec2(0.0, ps.y);
    highp vec2 x2 = dx * 2.0;
    highp vec2 y2 = dy * 2.0;
    highp vec2 offx = dx;
    highp vec2 off2 = x2;
    highp vec2 offy = dy;
    highp float fpx = fp.x;
    if (!notate)
    {
        offx = dy;
        off2 = y2;
        offy = dx;
        fpx = fp.y;
    }
    highp float _720;
    if (notate)
    {
        _720 = fp.y;
    }
    else
    {
        _720 = fp.x;
    }
    highp float f = _720;
    highp vec2 pC4 = (floor(OGL2Pos) * ps) + (ps * 0.5);
    pC4.y += ((float(inter6) * 0.25) * dy.y);
    bool _751 = (uGlobal_intres == 0.5) && notate;
    bool _757;
    if (_751)
    {
        _757 = prescalex.y < 1.5;
    }
    else
    {
        _757 = _751;
    }
    if (_757 || vgascan)
    {
        pC4.y = (floor(pC4.y * uGlobal_OriginalSize.y) * uGlobal_OriginalSize.w) + (0.5 * uGlobal_OriginalSize.w);
    }
    bool _781 = (uGlobal_intres == 0.5) && (!notate);
    bool _787;
    if (_781)
    {
        _787 = prescalex.x < 1.5;
    }
    else
    {
        _787 = _781;
    }
    bool _795;
    if (!_787)
    {
        _795 = vgascan && (!notate);
    }
    else
    {
        _795 = _787;
    }
    if (_795)
    {
        pC4.x = (floor(pC4.x * uGlobal_OriginalSize.x) * uGlobal_OriginalSize.z) + (0.5 * uGlobal_OriginalSize.z);
    }
    bool _818;
    if (interb)
    {
        _818 = uParams_no_scanlines < 0.02500000037252902984619140625;
    }
    else
    {
        _818 = interb;
    }
    if (_818 && (!hscan))
    {
        pC4.y = pos.y;
    }
    else
    {
        if (interb)
        {
            pC4.y += (smoothstep(0.4000000059604644775390625 - (0.5 * uParams_no_scanlines), 0.60000002384185791015625 + (0.5 * uParams_no_scanlines), f) * mix(SourceSize.w, SourceSize.z, uParams_TATE));
        }
    }
    if (hscan)
    {
        pC4 = mix(vec2(pC4.x, pos.y), vec2(pos.x, pC4.y), vec2(uParams_TATE));
    }
    highp float zero = exp2(-uParams_h_sharp);
    highp float sharp1 = uParams_s_sharp * zero;
    highp float idiv = clamp(mix(SourceSize.x, SourceSize.y, uParams_TATE) / 400.0, 1.0, 2.0);
    highp float fdivider = max(min(mix(prescalex.x, prescalex.y, uParams_TATE), 2.0), idiv * float(interb));
    fdivider = 1.0 / max(fdivider, 1.0);
    highp float wl3 = (2.0 + fpx) * fdivider;
    highp float wl2 = (1.0 + fpx) * fdivider;
    highp float wl1 = fpx * fdivider;
    highp float wr1 = (1.0 - fpx) * fdivider;
    highp float wr2 = (2.0 - fpx) * fdivider;
    highp float wr3 = (3.0 - fpx) * fdivider;
    wl3 *= wl3;
    wl3 = exp2((-uParams_h_sharp) * wl3);
    wl2 *= wl2;
    wl2 = exp2((-uParams_h_sharp) * wl2);
    wl1 *= wl1;
    wl1 = exp2((-uParams_h_sharp) * wl1);
    wr1 *= wr1;
    wr1 = exp2((-uParams_h_sharp) * wr1);
    wr2 *= wr2;
    wr2 = exp2((-uParams_h_sharp) * wr2);
    wr3 *= wr3;
    wr3 = exp2((-uParams_h_sharp) * wr3);
    highp float fp1 = 1.0 - fpx;
    highp float twl3 = max(wl3 - sharp1, 0.0);
    highp float twl2 = max(wl2 - sharp1, mix(-0.119999997317790985107421875, 0.0, 1.0 - (fp1 * fp1)));
    highp float twl1 = max(wl1 - sharp1, -0.119999997317790985107421875);
    highp float twr1 = max(wr1 - sharp1, -0.119999997317790985107421875);
    highp float twr2 = max(wr2 - sharp1, mix(-0.119999997317790985107421875, 0.0, 1.0 - (fpx * fpx)));
    highp float twr3 = max(wr3 - sharp1, 0.0);
    bool sharp = sharp1 > 0.0;
    highp vec3 c1;
    highp vec3 c2;
    if (smarte)
    {
        twl3 = 0.0;
        twr3 = 0.0;
        c1 = crtGuestSampleLinearBorder(AvgLumPass, pC4, 0.0).xyz;
        c2 = crtGuestSampleLinearBorder(AvgLumPass, pC4 + offy, 0.0).xyz;
        c1 = max(c1 - vec3(uGlobal_sth), vec3(0.0));
        c2 = max(c2 - vec3(uGlobal_sth), vec3(0.0));
    }
    highp vec3 l3 = crtGuestSampleLinearBorder(LinearizePass, pC4 - off2, 0.0).xyz;
    highp vec3 l2 = crtGuestSampleLinearBorder(LinearizePass, pC4 - offx, 0.0).xyz;
    highp vec3 l1 = crtGuestSampleLinearBorder(LinearizePass, pC4, 0.0).xyz;
    highp vec3 r1 = crtGuestSampleLinearBorder(LinearizePass, pC4 + offx, 0.0).xyz;
    highp vec3 r2 = crtGuestSampleLinearBorder(LinearizePass, pC4 + off2, 0.0).xyz;
    highp vec3 r3 = crtGuestSampleLinearBorder(LinearizePass, (pC4 + offx) + off2, 0.0).xyz;
    highp vec3 colmin = min(min(l1, r1), min(l2, r2));
    highp vec3 colmax = max(max(l1, r1), max(l2, r2));
    if (smarte)
    {
        highp float pc = min(uGlobal_smart_ei * c1.y, uGlobal_ei_limit);
        highp float pl = min(uGlobal_smart_ei * max(c1.y, c1.x), uGlobal_ei_limit);
        highp float pr = min(uGlobal_smart_ei * max(c1.y, c1.z), uGlobal_ei_limit);
        twl1 = max(wl1 - pc, 0.00999999977648258209228515625 * wl1);
        twr1 = max(wr1 - pc, 0.00999999977648258209228515625 * wr1);
        twl2 = max(wl2 - pl, 0.00999999977648258209228515625 * wl2);
        twr2 = max(wr2 - pr, 0.00999999977648258209228515625 * wr2);
    }
    highp vec3 color1 = ((((((l3 * twl3) + (l2 * twl2)) + (l1 * twl1)) + (r1 * twr1)) + (r2 * twr2)) + (r3 * twr3)) / vec3(((((twl3 + twl2) + twl1) + twr1) + twr2) + twr3);
    if (sharp)
    {
        color1 = clamp(mix(clamp(color1, colmin, colmax), color1, vec3(uParams_ring)), vec3(0.0), vec3(1.0));
    }
    highp float ts = 0.02500000037252902984619140625;
    highp vec3 luma = vec3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875);
    highp float lm2 = max(max(l2.x, l2.y), l2.z);
    highp float lm1 = max(max(l1.x, l1.y), l1.z);
    highp float rm1 = max(max(r1.x, r1.y), r1.z);
    highp float rm2 = max(max(r2.x, r2.y), r2.z);
    highp float swl2 = max(twl2, 0.0) * (dot(l2, luma) + ts);
    highp float swl1 = max(twl1, 0.0) * (dot(l1, luma) + ts);
    highp float swr1 = max(twr1, 0.0) * (dot(r1, luma) + ts);
    highp float swr2 = max(twr2, 0.0) * (dot(r2, luma) + ts);
    highp float fscolor1 = ((((lm2 * swl2) + (lm1 * swl1)) + (rm1 * swr1)) + (rm2 * swr2)) / (((swl2 + swl1) + swr1) + swr2);
    highp vec3 scolor1 = vec3(clamp(mix(max(max(color1.x, color1.y), color1.z), fscolor1, uParams_spike), 0.0, 1.0));
    if (!interb)
    {
        color1 = pow(color1, vec3(uGlobal_scangamma / gamma_in));
    }
    highp vec3 color2;
    highp vec3 scolor2;
    if ((!interb) && (!hscan))
    {
        pC4 += offy;
        bool _1384 = (uGlobal_intres == 0.5) && notate;
        bool _1390;
        if (_1384)
        {
            _1390 = prescalex.y < 1.5;
        }
        else
        {
            _1390 = _1384;
        }
        if (_1390 || vgascan)
        {
            pC4.y = (floor((pos.y + (0.3300000131130218505859375 * offy.y)) * uGlobal_OriginalSize.y) * uGlobal_OriginalSize.w) + (0.5 * uGlobal_OriginalSize.w);
        }
        bool _1419 = (uGlobal_intres == 0.5) && (!notate);
        bool _1425;
        if (_1419)
        {
            _1425 = prescalex.x < 1.5;
        }
        else
        {
            _1425 = _1419;
        }
        bool _1433;
        if (!_1425)
        {
            _1433 = vgascan && (!notate);
        }
        else
        {
            _1433 = _1425;
        }
        if (_1433)
        {
            pC4.x = (floor((pos.x + (0.3300000131130218505859375 * offy.x)) * uGlobal_OriginalSize.x) * uGlobal_OriginalSize.z) + (0.5 * uGlobal_OriginalSize.z);
        }
        l3 = crtGuestSampleLinearBorder(LinearizePass, pC4 - off2, 0.0).xyz;
        l2 = crtGuestSampleLinearBorder(LinearizePass, pC4 - offx, 0.0).xyz;
        l1 = crtGuestSampleLinearBorder(LinearizePass, pC4, 0.0).xyz;
        r1 = crtGuestSampleLinearBorder(LinearizePass, pC4 + offx, 0.0).xyz;
        r2 = crtGuestSampleLinearBorder(LinearizePass, pC4 + off2, 0.0).xyz;
        r3 = crtGuestSampleLinearBorder(LinearizePass, (pC4 + offx) + off2, 0.0).xyz;
        colmin = min(min(l1, r1), min(l2, r2));
        colmax = max(max(l1, r1), max(l2, r2));
        if (smarte)
        {
            highp float pc_1 = min(uGlobal_smart_ei * c2.y, uGlobal_ei_limit);
            highp float pl_1 = min(uGlobal_smart_ei * max(c2.y, c2.x), uGlobal_ei_limit);
            highp float pr_1 = min(uGlobal_smart_ei * max(c2.y, c2.z), uGlobal_ei_limit);
            twl1 = max(wl1 - pc_1, 0.00999999977648258209228515625 * wl1);
            twr1 = max(wr1 - pc_1, 0.00999999977648258209228515625 * wr1);
            twl2 = max(wl2 - pl_1, 0.00999999977648258209228515625 * wl2);
            twr2 = max(wr2 - pr_1, 0.00999999977648258209228515625 * wr2);
        }
        color2 = ((((((l3 * twl3) + (l2 * twl2)) + (l1 * twl1)) + (r1 * twr1)) + (r2 * twr2)) + (r3 * twr3)) / vec3(((((twl3 + twl2) + twl1) + twr1) + twr2) + twr3);
        if (sharp)
        {
            color2 = clamp(mix(clamp(color2, colmin, colmax), color2, vec3(uParams_ring)), vec3(0.0), vec3(1.0));
        }
        lm2 = max(max(l2.x, l2.y), l2.z);
        lm1 = max(max(l1.x, l1.y), l1.z);
        rm1 = max(max(r1.x, r1.y), r1.z);
        rm2 = max(max(r2.x, r2.y), r2.z);
        swl2 = max(twl2, 0.0) * (dot(l2, luma) + ts);
        swl1 = max(twl1, 0.0) * (dot(l1, luma) + ts);
        swr1 = max(twr1, 0.0) * (dot(r1, luma) + ts);
        swr2 = max(twr2, 0.0) * (dot(r2, luma) + ts);
        highp float fscolor2 = ((((lm2 * swl2) + (lm1 * swl1)) + (rm1 * swr1)) + (rm2 * swr2)) / (((swl2 + swl1) + swr1) + swr2);
        scolor2 = vec3(clamp(mix(max(max(color2.x, color2.y), color2.z), fscolor2, uParams_spike), 0.0, 1.0));
        color2 = pow(color2, vec3(uGlobal_scangamma / gamma_in));
    }
    highp vec3 ctmp = color1;
    highp vec3 sctmp = color1;
    highp float w3 = 1.0;
    highp vec3 color = color1;
    highp vec3 one = vec3(1.0);
    if (hscan)
    {
        color2 = color1;
        scolor2 = scolor1;
    }
    if (!interb)
    {
        highp float shape1 = mix(uParams_scanline1, uParams_scanline2, f);
        highp float shape2 = mix(uParams_scanline1, uParams_scanline2, 1.0 - f);
        highp float param_10 = f;
        highp float wt1 = st(param_10);
        highp float param_11 = 1.0 - f;
        highp float wt2 = st(param_11);
        highp vec3 color00 = (color1 * wt1) + (color2 * wt2);
        highp vec3 scolor0 = (scolor1 * wt1) + (scolor2 * wt2);
        ctmp = color00 / vec3(wt1 + wt2);
        sctmp = scolor0 / vec3(wt1 + wt2);
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
        highp float scanpix = mix(uGlobal_OriginalSize.x / uGlobal_OutputSize.x, uGlobal_OriginalSize.y / uGlobal_OutputSize.y, float(notate));
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
            highp float param_12 = f1;
            highp float param_13 = creff1;
            highp float param_14 = shape1;
            highp vec3 param_15 = cref1;
            w1 = sw0(param_12, param_13, param_14, param_15);
            highp float param_16 = f2;
            highp float param_17 = creff2;
            highp float param_18 = shape2;
            highp vec3 param_19 = cref2;
            w2 = sw0(param_16, param_17, param_18, param_19);
        }
        else
        {
            if (uParams_gsl == 1.0)
            {
                highp float param_20 = f1;
                highp float param_21 = creff1;
                highp float param_22 = shape1;
                highp vec3 param_23 = cref1;
                highp vec3 _1957 = sw1(param_20, param_21, param_22, param_23);
                w1 = _1957;
                highp float param_24 = f2;
                highp float param_25 = creff2;
                highp float param_26 = shape2;
                highp vec3 param_27 = cref2;
                highp vec3 _1966 = sw1(param_24, param_25, param_26, param_27);
                w2 = _1966;
            }
            else
            {
                highp float param_28 = f1;
                highp float param_29 = creff1;
                highp float param_30 = shape1;
                highp vec3 param_31 = cref1;
                w1 = sw2(param_28, param_29, param_30, param_31);
                highp float param_32 = f2;
                highp float param_33 = creff2;
                highp float param_34 = shape2;
                highp vec3 param_35 = cref2;
                w2 = sw2(param_32, param_33, param_34, param_35);
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
            bvec3 _2024 = bvec3(uParams_clips > 0.0);
            one = vec3(_2024.x ? w1.x : vec3(1.0).x, _2024.y ? w1.y : vec3(1.0).y, _2024.z ? w1.z : vec3(1.0).z);
            highp float sat = 1.00010001659393310546875 - min(min(cref1.x, cref1.y), cref1.z);
            highp vec3 param_36 = pow(color1, vec3(0.699999988079071044921875) - vec3(0.324999988079071044921875 * sat));
            highp float param_37 = sy;
            color1 = mix(color1, plant(param_36, param_37), (one * pow(sat, 0.33329999446868896484375)) * abs(uParams_clips));
            sy = mc2;
            bvec3 _2066 = bvec3(uParams_clips > 0.0);
            one = vec3(_2066.x ? w2.x : vec3(1.0).x, _2066.y ? w2.y : vec3(1.0).y, _2066.z ? w2.z : vec3(1.0).z);
            sat = 1.00010001659393310546875 - min(min(cref2.x, cref2.y), cref2.z);
            highp vec3 param_38 = pow(color2, vec3(0.699999988079071044921875) - vec3(0.324999988079071044921875 * sat));
            highp float param_39 = sy;
            color2 = mix(color2, plant(param_38, param_39), (one * pow(sat, 0.33329999446868896484375)) * abs(uParams_clips));
        }
        highp vec3 param_40 = color1;
        highp vec3 param_41 = color2;
        color = (gc(param_40) * w1) + (gc(param_41) * w2);
        color = min(color, vec3(1.0));
    }
    if (interb)
    {
        highp vec3 param_42 = color1;
        color = gc(param_42);
    }
    highp float colmx = max(max(ctmp.x, ctmp.y), ctmp.z);
    if (!interb)
    {
        color = pow(color, vec3(gamma_in / uGlobal_scangamma));
    }
    FragColor = vec4(color, colmx);
}

