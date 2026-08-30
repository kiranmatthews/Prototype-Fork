#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of hd/deconvergence-hd.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: 3b0b652740d7b66d1f33146d3bd6225924f02a326b98495a2d743b0dd8eefc70
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

const float _1803[15] = float[](2.0, 3.0, 3.0, 6.0, 6.0, 2.400000095367431640625, 3.400000095367431640625, 2.400000095367431640625, 3.25, 3.400000095367431640625, 4.400000095367431640625, 4.25, 7.400000095367431640625, 6.25, 5.25);

uniform highp mat4 uGlobal_MVP;
uniform highp vec4 uGlobal_SourceSize;
uniform highp vec4 uGlobal_OriginalSize;
uniform highp vec4 uGlobal_OutputSize;
uniform highp float uGlobal_FrameCount;
uniform highp float uGlobal_bloom;
uniform highp float uGlobal_halation;
uniform highp float uGlobal_slotms;
uniform highp float uGlobal_mask_gamma;
uniform highp float uGlobal_gamma_out;
uniform highp float uGlobal_overscanX;
uniform highp float uGlobal_overscanY;
uniform highp float uGlobal_VShift;
uniform highp float uGlobal_intres;
uniform highp float uGlobal_prescalex;
uniform highp float uGlobal_c_shape;
uniform highp float uGlobal_barspeed;
uniform highp float uGlobal_barintensity;
uniform highp float uGlobal_bardir;
uniform highp float uGlobal_sborder;
uniform highp float uGlobal_bloom_dist;
uniform highp float uGlobal_deconr;
uniform highp float uGlobal_decons;
uniform highp float uGlobal_addnoised;
uniform highp float uGlobal_noiseresd;
uniform highp float uGlobal_noisetype;
uniform highp float uGlobal_deconrr;
uniform highp float uGlobal_deconrg;
uniform highp float uGlobal_deconrb;
uniform highp float uGlobal_deconrry;
uniform highp float uGlobal_deconrgy;
uniform highp float uGlobal_deconrby;
uniform highp float uGlobal_dctypex;
uniform highp float uGlobal_dctypey;
uniform highp float uGlobal_post_br;
uniform highp float uGlobal_maskboost;
uniform highp float uGlobal_smoothmask;
uniform highp float uGlobal_gamma_c;
uniform highp float uGlobal_gamma_c2;
uniform highp float uGlobal_m_glow;
uniform highp float uGlobal_m_glow_low;
uniform highp float uGlobal_m_glow_high;
uniform highp float uGlobal_m_glow_dist;
uniform highp float uGlobal_m_glow_mask;
uniform highp float uGlobal_smask_mit;
uniform highp float uGlobal_mask_zoom;
uniform highp float uGlobal_no_scanlines;
uniform highp float uGlobal_bmask;
uniform highp float uGlobal_bmask1;
uniform highp float uGlobal_hmask1;
uniform highp float uGlobal_mzoom_sh;
uniform highp float uGlobal_mclip;
uniform highp float uGlobal_edgemask;
uniform highp float uGlobal_oimage;
uniform highp float uGlobal_interm;

uniform highp float uParams_IOS;
uniform highp float uParams_brightboost;
uniform highp float uParams_brightboost1;
uniform highp float uParams_csize;
uniform highp float uParams_bsize1;
uniform highp float uParams_warpX;
uniform highp float uParams_warpY;
uniform highp float uParams_glow;
uniform highp float uParams_shadowMask;
uniform highp float uParams_masksize;
uniform highp float uParams_slotmask;
uniform highp float uParams_slotmask1;
uniform highp float uParams_slotwidth;
uniform highp float uParams_double_slot;
uniform highp float uParams_mcut;
uniform highp float uParams_maskDark;
uniform highp float uParams_maskLight;
uniform highp float uParams_maskstr;
uniform highp float uParams_mshift;
uniform highp float uParams_mask_layout;
uniform highp float uParams_mask_bloom;
uniform highp float uParams_hiscan;
uniform highp float uParams_pr_scan;

uniform highp sampler2D Source;
uniform highp sampler2D BloomPass;
uniform highp sampler2D GlowPass;
uniform highp sampler2D LinearizePass;
uniform highp sampler2D PrePass;
uniform highp sampler2D StockPass;

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

void fetch_pixel(inout highp vec3 c, inout highp vec3 b, inout highp vec3 g, highp vec2 coord, highp vec2 bcoord)
{
    highp float stepx = uGlobal_OutputSize.z;
    highp float stepy = uGlobal_OutputSize.w;
    highp float ds = uGlobal_decons;
    highp vec2 dx = vec2(stepx, 0.0);
    highp vec2 dy = vec2(0.0, stepy);
    highp float posx = (2.0 * coord.x) - 1.0;
    highp float posy = (2.0 * coord.y) - 1.0;
    if (uGlobal_dctypex > 0.02500000037252902984619140625)
    {
        posx = sign(posx) * pow(abs(posx), 1.0499999523162841796875 - uGlobal_dctypex);
        dx *= posx;
    }
    if (uGlobal_dctypey > 0.02500000037252902984619140625)
    {
        posy = sign(posy) * pow(abs(posy), 1.0499999523162841796875 - uGlobal_dctypey);
        dy *= posy;
    }
    highp vec2 rc = (dx * uGlobal_deconrr) + (dy * uGlobal_deconrry);
    highp vec2 gc = (dx * uGlobal_deconrg) + (dy * uGlobal_deconrgy);
    highp vec2 bc = (dx * uGlobal_deconrb) + (dy * uGlobal_deconrby);
    highp float r1 = crtGuestSampleLinearBorder(Source, coord + rc, 0.0).x;
    highp float g1 = crtGuestSampleLinearBorder(Source, coord + gc, 0.0).y;
    highp float b1 = crtGuestSampleLinearBorder(Source, coord + bc, 0.0).z;
    highp vec3 d = vec3(r1, g1, b1);
    c = clamp(mix(c, d, vec3(ds)), vec3(0.0), vec3(1.0));
    r1 = crtGuestSampleLinearBorder(BloomPass, bcoord + rc, 0.0).x;
    g1 = crtGuestSampleLinearBorder(BloomPass, bcoord + gc, 0.0).y;
    b1 = crtGuestSampleLinearBorder(BloomPass, bcoord + bc, 0.0).z;
    d = vec3(r1, g1, b1);
    highp vec3 _1422 = mix(b, d, vec3(min(ds, 1.0)));
    g = _1422;
    b = _1422;
    r1 = crtGuestSampleLinearBorder(GlowPass, bcoord + rc, 0.0).x;
    g1 = crtGuestSampleLinearBorder(GlowPass, bcoord + gc, 0.0).y;
    b1 = crtGuestSampleLinearBorder(GlowPass, bcoord + bc, 0.0).z;
    d = vec3(r1, g1, b1);
    g = mix(g, d, vec3(min(ds, 1.0)));
}

highp float igc(highp float mc)
{
    return pow(mc, uGlobal_gamma_c);
}

highp vec3 Mask(inout highp vec2 pos, highp float mx, highp float mb)
{
    highp vec3 mask = vec3(uParams_maskDark, uParams_maskDark, uParams_maskDark);
    highp vec3 one = vec3(1.0);
    if (uParams_shadowMask == 0.0)
    {
        highp float mc = 1.0 - max(uParams_maskstr, 0.0);
        pos.x = fract(pos.x * 0.5);
        if (pos.x < 0.4900000095367431640625)
        {
            mask.x = 1.0;
            mask.y = mc;
            mask.z = 1.0;
        }
        else
        {
            mask.x = mc;
            mask.y = 1.0;
            mask.z = mc;
        }
    }
    else
    {
        if (uParams_shadowMask == 1.0)
        {
            highp float line = uParams_maskLight;
            highp float odd = 0.0;
            if (fract(pos.x / 6.0) < 0.4900000095367431640625)
            {
                odd = 1.0;
            }
            if (fract((pos.y + odd) / 2.0) < 0.4900000095367431640625)
            {
                line = uParams_maskDark;
            }
            pos.x = floor(mod(pos.x, 3.0));
            if (pos.x < 0.5)
            {
                mask.x = uParams_maskLight;
            }
            else
            {
                if (pos.x < 1.5)
                {
                    mask.y = uParams_maskLight;
                }
                else
                {
                    mask.z = uParams_maskLight;
                }
            }
            mask *= line;
        }
        else
        {
            if (uParams_shadowMask == 2.0)
            {
                pos.x = floor(mod(pos.x, 3.0));
                if (pos.x < 0.5)
                {
                    mask.x = uParams_maskLight;
                }
                else
                {
                    if (pos.x < 1.5)
                    {
                        mask.y = uParams_maskLight;
                    }
                    else
                    {
                        mask.z = uParams_maskLight;
                    }
                }
            }
            else
            {
                if (uParams_shadowMask == 3.0)
                {
                    pos.x += (pos.y * 3.0);
                    pos.x = fract(pos.x / 6.0);
                    if (pos.x < 0.300000011920928955078125)
                    {
                        mask.x = uParams_maskLight;
                    }
                    else
                    {
                        if (pos.x < 0.60000002384185791015625)
                        {
                            mask.y = uParams_maskLight;
                        }
                        else
                        {
                            mask.z = uParams_maskLight;
                        }
                    }
                }
                else
                {
                    if (uParams_shadowMask == 4.0)
                    {
                        pos = floor(pos * vec2(1.0, 0.5));
                        pos.x += (pos.y * 3.0);
                        pos.x = fract(pos.x / 6.0);
                        if (pos.x < 0.300000011920928955078125)
                        {
                            mask.x = uParams_maskLight;
                        }
                        else
                        {
                            if (pos.x < 0.60000002384185791015625)
                            {
                                mask.y = uParams_maskLight;
                            }
                            else
                            {
                                mask.z = uParams_maskLight;
                            }
                        }
                    }
                    else
                    {
                        if (uParams_shadowMask == 5.0)
                        {
                            mask = vec3(0.0);
                            pos.x = fract(pos.x / 2.0);
                            if (pos.x < 0.4900000095367431640625)
                            {
                                mask.x = 1.0;
                                mask.z = 1.0;
                            }
                            else
                            {
                                mask.y = 1.0;
                            }
                            mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                        }
                        else
                        {
                            if (uParams_shadowMask == 6.0)
                            {
                                mask = vec3(0.0);
                                pos.x = floor(mod(pos.x, 3.0));
                                if (pos.x < 0.5)
                                {
                                    mask.x = 1.0;
                                }
                                else
                                {
                                    if (pos.x < 1.5)
                                    {
                                        mask.y = 1.0;
                                    }
                                    else
                                    {
                                        mask.z = 1.0;
                                    }
                                }
                                mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                            }
                            else
                            {
                                if (uParams_shadowMask == 7.0)
                                {
                                    mask = vec3(0.0);
                                    pos.x = fract(pos.x / 2.0);
                                    if (pos.x < 0.4900000095367431640625)
                                    {
                                        mask = vec3(0.0);
                                    }
                                    else
                                    {
                                        mask = vec3(1.0);
                                    }
                                    mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                                }
                                else
                                {
                                    if (uParams_shadowMask == 8.0)
                                    {
                                        mask = vec3(0.0);
                                        pos.x = fract(pos.x / 3.0);
                                        if (pos.x < 0.300000011920928955078125)
                                        {
                                            mask = vec3(0.0);
                                        }
                                        else
                                        {
                                            if (pos.x < 0.60000002384185791015625)
                                            {
                                                mask = vec3(1.0);
                                            }
                                            else
                                            {
                                                mask = vec3(1.0);
                                            }
                                        }
                                        mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                                    }
                                    else
                                    {
                                        if (uParams_shadowMask == 9.0)
                                        {
                                            mask = vec3(0.0);
                                            pos.x = fract(pos.x / 3.0);
                                            if (pos.x < 0.300000011920928955078125)
                                            {
                                                mask = vec3(0.0);
                                            }
                                            else
                                            {
                                                if (pos.x < 0.60000002384185791015625)
                                                {
                                                    mask.x = 1.0;
                                                    mask.z = 1.0;
                                                }
                                                else
                                                {
                                                    mask.y = 1.0;
                                                }
                                            }
                                            mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                                        }
                                        else
                                        {
                                            if (uParams_shadowMask == 10.0)
                                            {
                                                mask = vec3(0.0);
                                                pos.x = fract(pos.x * 0.25);
                                                if (pos.x < 0.20000000298023223876953125)
                                                {
                                                    mask = vec3(0.0);
                                                }
                                                else
                                                {
                                                    if (pos.x < 0.4000000059604644775390625)
                                                    {
                                                        mask.x = 1.0;
                                                    }
                                                    else
                                                    {
                                                        if (pos.x < 0.699999988079071044921875)
                                                        {
                                                            mask.y = 1.0;
                                                        }
                                                        else
                                                        {
                                                            mask.z = 1.0;
                                                        }
                                                    }
                                                }
                                                mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                                            }
                                            else
                                            {
                                                if (uParams_shadowMask == 11.0)
                                                {
                                                    mask = vec3(0.0);
                                                    pos.x = fract(pos.x * 0.25);
                                                    if (pos.x < 0.20000000298023223876953125)
                                                    {
                                                        mask.x = 1.0;
                                                    }
                                                    else
                                                    {
                                                        if (pos.x < 0.4000000059604644775390625)
                                                        {
                                                            mask.x = 1.0;
                                                            mask.y = 1.0;
                                                        }
                                                        else
                                                        {
                                                            if (pos.x < 0.699999988079071044921875)
                                                            {
                                                                mask.y = 1.0;
                                                                mask.z = 1.0;
                                                            }
                                                            else
                                                            {
                                                                mask.z = 1.0;
                                                            }
                                                        }
                                                    }
                                                    mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                                                }
                                                else
                                                {
                                                    if (uParams_shadowMask == 12.0)
                                                    {
                                                        mask = vec3(0.0);
                                                        pos.x = floor(mod(pos.x, 7.0));
                                                        if (pos.x < 0.5)
                                                        {
                                                            mask = vec3(0.0);
                                                        }
                                                        else
                                                        {
                                                            if (pos.x < 2.5)
                                                            {
                                                                mask.x = 1.0;
                                                            }
                                                            else
                                                            {
                                                                if (pos.x < 4.5)
                                                                {
                                                                    mask.y = 1.0;
                                                                }
                                                                else
                                                                {
                                                                    mask.z = 1.0;
                                                                }
                                                            }
                                                        }
                                                        mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                                                    }
                                                    else
                                                    {
                                                        if (uParams_shadowMask == 13.0)
                                                        {
                                                            mask = vec3(0.0);
                                                            pos.x = floor(mod(pos.x, 6.0));
                                                            if (pos.x < 0.5)
                                                            {
                                                                mask = vec3(0.0);
                                                            }
                                                            else
                                                            {
                                                                if (pos.x < 1.5)
                                                                {
                                                                    mask.x = 1.0;
                                                                }
                                                                else
                                                                {
                                                                    if (pos.x < 2.5)
                                                                    {
                                                                        mask.x = 1.0;
                                                                        mask.y = 1.0;
                                                                    }
                                                                    else
                                                                    {
                                                                        if (pos.x < 3.5)
                                                                        {
                                                                            mask = vec3(1.0);
                                                                        }
                                                                        else
                                                                        {
                                                                            if (pos.x < 4.5)
                                                                            {
                                                                                mask.y = 1.0;
                                                                                mask.z = 1.0;
                                                                            }
                                                                            else
                                                                            {
                                                                                mask.z = 1.0;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                                                        }
                                                        else
                                                        {
                                                            mask = vec3(0.0);
                                                            pos.x = floor(mod(pos.x, 5.0));
                                                            if (pos.x < 0.5)
                                                            {
                                                                mask = vec3(0.0);
                                                            }
                                                            else
                                                            {
                                                                if (pos.x < 1.5)
                                                                {
                                                                    mask.x = 1.0;
                                                                }
                                                                else
                                                                {
                                                                    if (pos.x < 2.5)
                                                                    {
                                                                        mask.x = 1.0;
                                                                        mask.y = 1.0;
                                                                    }
                                                                    else
                                                                    {
                                                                        if (pos.x < 3.5)
                                                                        {
                                                                            mask.y = 1.0;
                                                                            mask.z = 1.0;
                                                                        }
                                                                        else
                                                                        {
                                                                            mask.z = 1.0;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            mask = clamp(mix(mix(one, mask, vec3(uParams_mcut)), mix(one, mask, vec3(uParams_maskstr)), vec3(mx)), vec3(0.0), vec3(1.0));
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (uParams_mask_layout > 0.5)
    {
        mask = mask.xzy;
    }
    highp float maskmin = min(min(mask.x, mask.y), mask.z);
    return ((mask - vec3(maskmin)) * (1.0 + ((uGlobal_maskboost - 1.0) * mb))) + vec3(maskmin);
}

highp float SlotMask(inout highp vec2 pos, highp float m, highp float swidth)
{
    if ((uParams_slotmask + uParams_slotmask1) == 0.0)
    {
        return 1.0;
    }
    else
    {
        pos.y = floor(pos.y / uGlobal_slotms);
        highp float mlen = swidth * 2.0;
        highp float px = floor(mod(pos.x, 0.999989986419677734375 * mlen));
        highp float py = floor((fract(pos.y / (2.0 * uParams_double_slot)) * 2.0) * uParams_double_slot);
        highp float slot_dark = mix(1.0 - uParams_slotmask1, 1.0 - uParams_slotmask, m);
        highp float slot = 1.0;
        if ((py == 0.0) && (px < swidth))
        {
            slot = slot_dark;
        }
        else
        {
            if ((py == uParams_double_slot) && (px >= swidth))
            {
                slot = slot_dark;
            }
        }
        return slot;
    }
}

highp vec3 plant(highp vec3 tar, highp float r)
{
    highp float t = max(max(tar.x, tar.y), tar.z) + 9.9999997473787516355514526367188e-06;
    return (tar * r) / vec3(t);
}

highp vec3 gc2(highp vec3 c, highp float w3)
{
    highp float mc = max(max(c.x, c.y), c.z);
    highp float gp = 1.0 / (1.0 + ((uGlobal_gamma_c2 - 1.0) * mix(0.375, 1.0, w3)));
    highp float mg = pow(mc, gp);
    return (c * mg) / vec3(mc + 1.0000000133514319600180897396058e-10);
}

highp vec3 _noise(inout highp vec3 v)
{
    if (uGlobal_addnoised < 0.0)
    {
        v.z = -uGlobal_addnoised;
    }
    else
    {
        v.z = mod(v.z, 6001.0) / 1753.0;
    }
    v = (fract(v) + fract(v * 10000.0)) + fract(v * 9.9999997473787516355514526367188e-05);
    v += vec3(0.123450003564357757568359375, 0.6789000034332275390625, 0.3141590058803558349609375);
    v = fract((v * dot(v, v)) * 123.45600128173828125);
    v = fract((v * dot(v, v)) * 123.45600128173828125);
    v = fract((v * dot(v, v)) * 123.45600128173828125);
    v = fract((v * dot(v, v)) * 123.45600128173828125);
    return v;
}

highp float humbar(inout highp float pos)
{
    if (uGlobal_barintensity == 0.0)
    {
        return 1.0;
    }
    else
    {
        highp float _1002;
        if (uGlobal_barintensity >= 0.0)
        {
            _1002 = pos;
        }
        else
        {
            _1002 = 1.0 - pos;
        }
        pos = _1002;
        pos = fract(pos + (mod(float(uGlobal_FrameCount), uGlobal_barspeed) / (uGlobal_barspeed - 1.0)));
        highp float _1028;
        if (uGlobal_barintensity < 0.0)
        {
            _1028 = pos;
        }
        else
        {
            _1028 = 1.0 - pos;
        }
        pos = _1028;
        return (1.0 - uGlobal_barintensity) + (uGlobal_barintensity * pos);
    }
}

highp float corner(inout highp vec2 pos)
{
    pos = abs((pos - vec2(0.5)) * 2.0);
    highp vec2 aspect = vec2(1.0, uGlobal_OutputSize.x / uGlobal_OutputSize.y);
    highp float b = (uParams_bsize1 * 0.0500000007450580596923828125) + 0.0005000000237487256526947021484375;
    pos.y += (b * (aspect.y - 1.0));
    highp vec2 crn = max(vec2(uParams_csize), vec2((2.0 * b) + 0.00150000001303851604461669921875));
    highp vec2 cp = max(pos - (vec2(1.0) - (crn * aspect)), vec2(0.0)) / aspect;
    highp float cd = sqrt(dot(cp, cp));
    pos = max(pos, (vec2(1.0) - crn) + vec2(cd));
    highp float res = mix(1.0, 0.0, smoothstep(1.0 - b, 1.0, sqrt(max(pos.x, pos.y))));
    return pow(res, uGlobal_sborder);
}

void main()
{
    highp vec4 SourceSize = uGlobal_OriginalSize;
    highp float gamma_in = 1.0 / crtGuestSampleLinearBorder(LinearizePass, vec2(0.25), 0.0).w;
    highp float intera = crtGuestSampleLinearBorder(LinearizePass, vec2(0.75, 0.25), 0.0).w;
    bool _1475 = intera < 0.3499999940395355224609375;
    bool _1482;
    if (_1475)
    {
        _1482 = uGlobal_interm == 5.0;
    }
    else
    {
        _1482 = _1475;
    }
    bool inter6 = _1482;
    bool _1488 = (intera < 0.3499999940395355224609375) && (!inter6);
    bool _1496;
    if (!_1488)
    {
        _1496 = uGlobal_no_scanlines > 0.02500000037252902984619140625;
    }
    else
    {
        _1496 = _1488;
    }
    bool _1503;
    if (_1496)
    {
        _1503 = uParams_hiscan < 0.5;
    }
    else
    {
        _1503 = _1496;
    }
    bool interb = _1503;
    highp vec2 texcoord = vTexCoord;
    if ((uParams_IOS > 0.0) && (!interb))
    {
        highp vec2 ofactor = uGlobal_OutputSize.xy / uGlobal_OriginalSize.xy;
        highp vec2 _1529;
        if (uParams_IOS < 2.5)
        {
            _1529 = floor(ofactor);
        }
        else
        {
            _1529 = ceil(ofactor);
        }
        highp vec2 intfactor = _1529;
        highp vec2 diff = ofactor / intfactor;
        highp float scan = diff.y;
        highp vec2 param = texcoord;
        highp float param_1 = scan;
        highp float param_2 = scan;
        highp vec2 _1551 = Overscan(param, param_1, param_2);
        texcoord = _1551;
        bool _1554 = uParams_IOS == 1.0;
        bool _1561;
        if (!_1554)
        {
            _1561 = uParams_IOS == 3.0;
        }
        else
        {
            _1561 = _1554;
        }
        if (_1561)
        {
            texcoord = vec2(vTexCoord.x, texcoord.y);
        }
    }
    texcoord.y -= (uGlobal_VShift * uGlobal_OriginalSize.w);
    highp vec2 param_3 = texcoord;
    highp float param_4 = (uGlobal_OriginalSize.x - uGlobal_overscanX) / uGlobal_OriginalSize.x;
    highp float param_5 = (uGlobal_OriginalSize.y - uGlobal_overscanY) / uGlobal_OriginalSize.y;
    highp vec2 _1600 = Overscan(param_3, param_4, param_5);
    texcoord = _1600;
    highp vec2 pos1 = vTexCoord;
    highp vec2 param_6 = texcoord;
    highp vec2 _1606 = Warp(param_6);
    highp vec2 pos = _1606;
    highp vec2 param_7 = vTexCoord;
    highp vec2 _1610 = Warp(param_7);
    highp vec2 pos0 = _1610;
    highp vec2 posb = (pos0 - vec2(0.5)) * 2.0;
    posb = max(abs(posb), abs((pos - vec2(0.5)) * 2.0)) * sign(posb);
    posb = (posb * 0.5) + vec2(0.5);
    highp vec3 color = crtGuestSampleLinearBorder(Source, pos1, 0.0).xyz;
    highp vec3 Bloom = crtGuestSampleLinearBorder(BloomPass, pos, 0.0).xyz;
    highp vec3 Glow = crtGuestSampleLinearBorder(GlowPass, pos, 0.0).xyz;
    if ((((((abs(uGlobal_deconrr) + abs(uGlobal_deconrry)) + abs(uGlobal_deconrg)) + abs(uGlobal_deconrgy)) + abs(uGlobal_deconrb)) + abs(uGlobal_deconrby)) > 0.20000000298023223876953125)
    {
        highp vec3 param_8 = color;
        highp vec3 param_9 = Bloom;
        highp vec3 param_10 = Glow;
        highp vec2 param_11 = pos1;
        highp vec2 param_12 = pos;
        fetch_pixel(param_8, param_9, param_10, param_11, param_12);
        color = param_8;
        Bloom = param_9;
        Glow = param_10;
    }
    highp float param_13 = max(max(color.x, color.y), color.z);
    highp float cm = igc(param_13);
    highp float mx1 = crtGuestSampleLinearBorder(Source, pos1, 0.0).w;
    highp float colmx = max(mx1, cm);
    highp float w3 = min((max((cm - 0.0005000000237487256526947021484375) * 1.0004999637603759765625, 0.0) + 9.9999997473787516355514526367188e-05) / (colmx + 0.0005000000237487256526947021484375), 1.0);
    if (interb)
    {
        w3 = 1.0;
    }
    highp vec2 dx = vec2(0.001000000047497451305389404296875, 0.0);
    highp float mx0 = crtGuestSampleLinearBorder(Source, pos1 - dx, 0.0).w;
    highp float mx2 = crtGuestSampleLinearBorder(Source, pos1 + dx, 0.0).w;
    highp float mxg = max(max(mx0, mx1), max(mx2, cm));
    highp float mx = pow(mxg, 1.39999997615814208984375 / gamma_in);
    highp float cx = pow(colmx, 1.39999997615814208984375 / gamma_in);
    highp vec3 one = vec3(1.0);
    dx = vec2(uGlobal_OriginalSize.z, 0.0) * 0.25;
    mx0 = crtGuestSampleLinearBorder(Source, pos1 - dx, 0.0).w;
    mx2 = crtGuestSampleLinearBorder(Source, pos1 + dx, 0.0).w;
    highp float mb = 1.0 - min(abs(mx0 - mx2) / (0.5 + mx1), 1.0);
    highp vec3 orig1 = color;
    highp vec3 cmask = one;
    highp vec3 cmask1 = one;
    highp vec3 cmask2 = one;
    highp float mwidth = _1803[int(uParams_shadowMask)];
    highp float mask_compensate = fract(mwidth);
    highp float mwidth1 = mwidth;
    if (uParams_shadowMask > (-0.5))
    {
        highp vec2 maskcoord = vTexCoord * uGlobal_OutputSize.xy;
        highp vec2 scoord = maskcoord;
        mwidth = floor(mwidth) * uParams_masksize;
        highp float swidth = mwidth;
        bool zoomed = abs(uGlobal_mask_zoom) > 0.75;
        highp float mscale = 1.0;
        highp vec2 maskcoord0 = maskcoord;
        maskcoord.y = floor(maskcoord.y / uParams_masksize);
        mwidth1 = max(mwidth + uGlobal_mask_zoom, 2.0);
        if (uParams_mshift > 0.25)
        {
            highp float stagg_lvl = 1.0;
            if (fract(uParams_mshift) > 0.25)
            {
                stagg_lvl = 2.0;
            }
            highp float next_line = float(floor(mod(maskcoord.y, 2.0 * stagg_lvl)) < stagg_lvl);
            maskcoord0.x += ((next_line * 0.5) * mwidth1);
        }
        maskcoord = maskcoord0 / vec2(uParams_masksize);
        if (!zoomed)
        {
            highp vec2 param_14 = floor(maskcoord);
            highp float param_15 = mx;
            highp float param_16 = mb;
            highp vec3 _1905 = Mask(param_14, param_15, param_16);
            cmask = _1905;
        }
        else
        {
            mscale = mwidth1 / mwidth;
            highp float mlerp = fract(maskcoord.x / mscale);
            if (uGlobal_mzoom_sh > 0.02500000037252902984619140625)
            {
                mlerp = clamp(((1.0 + uGlobal_mzoom_sh) * mlerp) - (0.5 * uGlobal_mzoom_sh), 0.0, 1.0);
            }
            highp float mcoord = floor(maskcoord.x / mscale);
            bool _1940 = uParams_shadowMask == 12.0;
            bool _1947;
            if (_1940)
            {
                _1947 = uGlobal_mask_zoom == (-2.0);
            }
            else
            {
                _1947 = _1940;
            }
            if (_1947)
            {
                mcoord = ceil(maskcoord.x / mscale);
            }
            highp vec2 param_17 = vec2(mcoord, maskcoord.y);
            highp float param_18 = mx;
            highp float param_19 = mb;
            highp vec3 _1964 = Mask(param_17, param_18, param_19);
            highp vec2 param_20 = vec2(mcoord + 1.0, maskcoord.y);
            highp float param_21 = mx;
            highp float param_22 = mb;
            highp vec3 _1975 = Mask(param_20, param_21, param_22);
            cmask = mix(_1964, _1975, vec3(mlerp));
        }
        highp float sm_offset = 0.0;
        bool _1983 = uParams_shadowMask == 0.0;
        bool _1990;
        if (!_1983)
        {
            _1990 = uParams_shadowMask == 2.0;
        }
        else
        {
            _1990 = _1983;
        }
        bool _1997;
        if (!_1990)
        {
            _1997 = uParams_shadowMask == 5.0;
        }
        else
        {
            _1997 = _1990;
        }
        bool _2004;
        if (!_1997)
        {
            _2004 = uParams_shadowMask == 6.0;
        }
        else
        {
            _2004 = _1997;
        }
        bool _2011;
        if (!_2004)
        {
            _2011 = uParams_shadowMask == 8.0;
        }
        else
        {
            _2011 = _2004;
        }
        bool _2018;
        if (!_2011)
        {
            _2018 = uParams_shadowMask == 11.0;
        }
        else
        {
            _2018 = _2011;
        }
        bool bsm_offset = _2018;
        if (zoomed)
        {
            if ((uParams_mask_layout < 0.5) && bsm_offset)
            {
                sm_offset = 1.0;
            }
            else
            {
                if (bsm_offset)
                {
                    sm_offset = -1.0;
                }
            }
        }
        swidth = round(mwidth1);
        if (uParams_slotwidth > 0.5)
        {
            swidth = uParams_slotwidth;
        }
        highp float smask = 1.0;
        highp vec2 param_23 = scoord + vec2(sm_offset, 0.0);
        highp float param_24 = mx;
        highp float param_25 = swidth;
        highp float _2053 = SlotMask(param_23, param_24, param_25);
        smask = _2053;
        smask = clamp(smask + mix(uGlobal_smask_mit, 0.0, w3 * pow(colmx, 0.300000011920928955078125)), 0.0, 1.0);
        cmask2 = cmask;
        cmask *= smask;
        cmask1 = cmask;
        if (abs(uParams_mask_bloom) > 0.02500000037252902984619140625)
        {
            highp float maxbl = max(max(max(Bloom.x, Bloom.y), Bloom.z), mxg);
            maxbl *= max(mix(1.0, 2.0 - colmx, uGlobal_bloom_dist), 0.0);
            if (uParams_mask_bloom > 0.02500000037252902984619140625)
            {
                cmask = max(min(cmask + vec3(maxbl * uParams_mask_bloom), vec3(1.0)), cmask);
            }
            else
            {
                highp vec3 param_26 = pow(Bloom, vec3(0.3499999940395355224609375));
                highp float param_27 = maxbl;
                cmask = max(mix(cmask, (cmask * (1.0 - (0.5 * maxbl))) + plant(param_26, param_27), vec3(-uParams_mask_bloom)), cmask);
            }
        }
        color = pow(color, vec3(uGlobal_mask_gamma / gamma_in));
        color *= cmask;
        color = min(color, vec3(1.0));
        color = pow(color, vec3(gamma_in / uGlobal_mask_gamma));
        cmask = min(cmask, vec3(1.0));
        cmask1 = min(cmask1, vec3(1.0));
    }
    highp float dark_compensate = mix(max((clamp(mix(uParams_mcut, uParams_maskstr, mx), 0.0, 1.0) - 1.0) + mask_compensate, 0.0) + 1.0, 1.0, mx);
    if (uParams_shadowMask < (-0.5))
    {
        dark_compensate = 1.0;
    }
    highp float bb = mix(uParams_brightboost, uParams_brightboost1, mx) * dark_compensate;
    color *= bb;
    highp vec3 Ref = crtGuestSampleLinearBorder(LinearizePass, pos, 0.0).xyz;
    highp float maxb = crtGuestSampleLinearBorder(BloomPass, pos, 0.0).w;
    highp float vig = crtGuestSampleLinearBorder(PrePass, clamp(pos, vec2(0.0) + (uGlobal_OriginalSize.zw * 0.5), vec2(1.0) - (uGlobal_OriginalSize.zw * 0.5)), 0.0).w;
    highp vec3 Bloom1 = Bloom;
    highp vec3 bcmask = mix(one, cmask1, vec3(uGlobal_bmask1));
    highp vec3 hcmask = mix(one, cmask1, vec3(uGlobal_hmask1));
    if (uParams_pr_scan > 0.02500000037252902984619140625)
    {
        highp float mbl = max(max(Bloom.x, Bloom.y), Bloom.z);
        highp vec3 param_28 = orig1;
        highp float param_29 = mbl;
        Bloom = mix(Bloom, mix(Bloom, plant(param_28, param_29), vec3(min(2.5 * (1.0 - w3), 1.0))), vec3(min(2.0 * uParams_pr_scan, 1.0)));
    }
    if (abs(uGlobal_bloom) > 0.02500000037252902984619140625)
    {
        if (uGlobal_bloom < (-0.00999999977648258209228515625))
        {
            highp vec3 param_30 = Bloom;
            highp float param_31 = maxb;
            Bloom1 = plant(param_30, param_31);
        }
        Bloom1 = min(Bloom1 * (orig1 + color), max(((vec3(colmx) + orig1) - color) * 0.5, Bloom1 * 0.001000000047497451305389404296875));
        Bloom1 = (Bloom1 + mix(Bloom1, mix(orig1 * colmx, Bloom1, vec3(0.5)), vec3(1.0) - color)) * 0.5;
        Bloom1 = (bcmask * Bloom1) * max(mix(1.0, 2.0 - colmx, uGlobal_bloom_dist), 0.0);
        color = pow(pow(color, vec3(uGlobal_mask_gamma / gamma_in)) + (pow(Bloom1, vec3(uGlobal_mask_gamma / gamma_in)) * abs(uGlobal_bloom)), vec3(gamma_in / uGlobal_mask_gamma));
    }
    if (uGlobal_halation > 0.00999999977648258209228515625)
    {
        Bloom = (Bloom + (Bloom * Bloom)) * 0.5;
        highp float mbl_1 = max(max(Bloom.x, Bloom.y), Bloom.z);
        highp float cmxh = 0.5 * (colmx + (colmx * colmx));
        mbl_1 = mix(mix(cmxh, mix(cmxh, mbl_1, mbl_1), colmx), mbl_1, mb);
        highp vec3 param_32 = Bloom;
        highp float param_33 = mix(sqrt(mbl_1 * cmxh), max(mbl_1 - (0.1500000059604644775390625 * (1.0 - colmx)), 0.4000000059604644775390625 * cmxh), pow(colmx, 0.25));
        Bloom = plant(param_32, param_33) * mix(0.425000011920928955078125, 1.0, colmx);
        highp vec3 param_34 = vec3(0.324999988079071044921875) + (orig1 / vec3(w3));
        highp float param_35 = 0.5 * (1.0 + w3);
        Bloom = (((vec3(3.0 - colmx) - color) * plant(param_34, param_35)) * hcmask) * Bloom;
        color = pow(pow(color, vec3(uGlobal_mask_gamma / gamma_in)) + (pow(Bloom, vec3(uGlobal_mask_gamma / gamma_in)) * uGlobal_halation), vec3(gamma_in / uGlobal_mask_gamma));
    }
    else
    {
        if (uGlobal_halation < (-0.00999999977648258209228515625))
        {
            highp float mbl_2 = max(max(Bloom.x, Bloom.y), Bloom.z);
            highp vec3 param_36 = ((Bloom + Ref) + orig1) + ((Bloom * Bloom) * Bloom);
            highp float param_37 = min(mbl_2 * mbl_2, 0.75);
            Bloom = plant(param_36, param_37);
            Bloom = (hcmask * (2.0 * mix(1.0, w3, 0.5 * colmx))) * Bloom;
            color -= (Bloom * uGlobal_halation);
        }
    }
    color = min(color, vec3(1.0));
    highp vec3 param_38 = color;
    highp float param_39 = w3;
    color = gc2(param_38, param_39);
    if (uGlobal_smoothmask > 0.125)
    {
        highp float w4 = pow(w3, 0.425000011920928955078125 + (0.300000011920928955078125 * uGlobal_smoothmask));
        w4 = max(w4 - ((0.17499999701976776123046875 * colmx) * uGlobal_smoothmask), 0.20000000298023223876953125);
        highp vec3 param_40 = orig1;
        highp float param_41 = 1.0 + ((0.17499999701976776123046875 * colmx) * uGlobal_smoothmask);
        color = mix(min(color / vec3(w4), plant(param_40, param_41)) * w4, color, vec3(w4));
    }
    if (uGlobal_m_glow < 0.5)
    {
        Glow = mix(Glow, color * 0.25, vec3(colmx));
    }
    else
    {
        maxb = max(max(Glow.x, Glow.y), Glow.z);
        highp vec3 param_42 = orig1 + (Ref * 0.001000000047497451305389404296875);
        highp float param_43 = 1.0;
        highp vec3 orig2 = plant(param_42, param_43);
        highp vec3 param_44 = Glow;
        highp float param_45 = 1.0;
        Bloom = plant(param_44, param_45);
        Ref = abs(orig2 - Bloom);
        mx0 = max(max(orig2.x, orig2.y), orig2.z) - min(min(orig2.x, orig2.y), orig2.z);
        mx2 = max(max(Bloom.x, Bloom.y), Bloom.z) - min(min(Bloom.x, Bloom.y), Bloom.z);
        Bloom = mix(min(Bloom, orig2) * maxb, mix(mix(Glow, Glow * max(max(Ref.x, Ref.y), Ref.z), vec3(max(mx, mx0))), mix(color, Glow, vec3(mx2)), Ref * max(mx0, mx2)), vec3(min(sqrt((1.10000002384185791015625 - mx0) * (0.100000001490116119384765625 + mx2)), 1.0)));
        if (uGlobal_m_glow > 1.5)
        {
            Glow = mix((Glow * 0.5) * Glow, Bloom, Bloom);
        }
        Glow = mix(Glow * uGlobal_m_glow_low, Bloom * uGlobal_m_glow_high, vec3(pow(colmx, uGlobal_m_glow_dist / gamma_in)));
    }
    if (uGlobal_m_glow < 0.5)
    {
        if (uParams_glow >= 0.0)
        {
            color += ((Glow * 0.5) * uParams_glow);
        }
        else
        {
            color += ((min(cmask2 * cmask2, vec3(1.0)) * abs(uParams_glow)) * Glow);
        }
    }
    else
    {
        highp vec3 cmaskg = clamp(mix(one, cmask1, vec3(uGlobal_m_glow_mask)), vec3(0.0), vec3(1.0));
        color += ((cmaskg * abs(uParams_glow)) * Glow);
    }
    color = min(color, vec3(1.0));
    if (uGlobal_edgemask > 0.0500000007450580596923828125)
    {
        mx0 = crtGuestSampleLinearBorder(Source, pos1 - dx, 0.0).w;
        mx0 = crtGuestSampleLinearBorder(Source, pos1 - (dx * (1.0 - (0.75 * sqrt(mx0)))), 0.0).w;
        mx2 = crtGuestSampleLinearBorder(Source, pos1 + dx, 0.0).w;
        mx2 = crtGuestSampleLinearBorder(Source, pos1 + (dx * (1.0 - (0.75 * sqrt(mx2)))), 0.0).w;
        highp float mx3 = crtGuestSampleLinearBorder(Source, pos1 - (dx * 4.0), 0.0).w;
        highp float mx4 = crtGuestSampleLinearBorder(Source, pos1 + (dx * 4.0), 0.0).w;
        mx4 = max(pow(abs(mx3 - mx4), 0.550000011920928955078125 - (0.4000000059604644775390625 * cx)), min(max(mx3, mx4) / min(0.100000001490116119384765625 + cx, 1.0), 1.0));
        mb = 1.0 - abs(pow(mx0, 1.0 - (0.64999997615814208984375 * mx2)) - pow(mx2, 1.0 - (0.64999997615814208984375 * mx0)));
        mb = (mx4 * uGlobal_edgemask) * (1.00010001659393310546875 - (mb * mb));
        highp vec3 temp = mix(color, orig1, vec3(mb));
        color = max(temp + mix(mix(temp * 1.625, temp, vec3(cx)) * (3.5 * mb), vec3(0.0), pow(color, vec3(0.75) - vec3(0.5 * colmx))), color);
    }
    color *= mix(1.0, mix(0.5 * (1.0 + w3), w3, mx), uParams_pr_scan);
    color = min(color, max(orig1, color) * mix(one, cmask1, vec3(uGlobal_mclip)));
    color = pow(color, vec3(1.0 / uGlobal_gamma_out));
    highp float rc = (0.60000002384185791015625 * sqrt(max(max(color.x, color.y), color.z))) + 0.4000000059604644775390625;
    if (abs(uGlobal_addnoised) > 0.00999999977648258209228515625)
    {
        highp vec3 param_46 = vec3(floor((uGlobal_OutputSize.xy * vTexCoord) / vec2(uGlobal_noiseresd)), float(uGlobal_FrameCount));
        highp vec3 _2957 = _noise(param_46);
        highp vec3 noise0 = _2957;
        if (uGlobal_noisetype < 0.5)
        {
            color = mix(color, noise0, vec3((0.25 * abs(uGlobal_addnoised)) * rc));
        }
        else
        {
            color = min(color * mix(1.0, 1.5 * noise0.x, 0.5 * abs(uGlobal_addnoised)), vec3(1.0));
        }
    }
    colmx = max(max(orig1.x, orig1.y), orig1.z);
    color += (mix(cmask2, color * (0.125 * (1.0 - colmx)), vec3(min(20.0 * colmx, 1.0))) * uGlobal_bmask);
    highp float param_47 = mix(pos.y, pos.x, uGlobal_bardir);
    highp float _3026 = humbar(param_47);
    highp vec2 param_48 = posb;
    highp float _3034 = corner(param_48);
    FragColor = mix(vec4((((color * vig) * _3026) * uGlobal_post_br) * _3034, 1.0), crtGuestSampleLinearBorder(StockPass, (floor(pos1 * uGlobal_OriginalSize.xy) + vec2(0.5)) * uGlobal_OriginalSize.zw, 0.0), vec4(step(pos1.x, uGlobal_oimage - 0.00025000001187436282634735107421875)));
}

