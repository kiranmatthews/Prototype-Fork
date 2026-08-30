#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of hd/gaussian_horizontal.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: a74c7251b0cd71092611b2b696fd737e9f635525dbce7d8b5da10a664af1f225
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

uniform highp vec4 uParams_LinearizePassSize;
uniform highp vec4 uParams_OriginalSize;
uniform highp vec4 uParams_OutputSize;
uniform highp float uParams_FrameCount;
uniform highp float uParams_SIZEH;
uniform highp float uParams_SIGMA_H;
uniform highp float uParams_FINE_GLOW;
uniform highp float uParams_m_glow;
uniform highp float uParams_m_glow_cutoff;
uniform highp float uParams_m_glow_low;
uniform highp float uParams_m_glow_high;
uniform highp float uParams_m_glow_dist;
uniform highp float uParams_m_glow_mask;
uniform highp float uParams_auto_res;

uniform highp sampler2D LinearizePass;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;
highp float auto_rez;
highp float FINE_GLOW;
highp float invsqrsigma;

highp vec3 plant(highp vec3 tar, highp float r)
{
    highp float t = max(max(tar.x, tar.y), tar.z) + 9.9999997473787516355514526367188e-06;
    return (tar * r) / vec3(t);
}

highp float gaussian(highp float x)
{
    return exp(((-x) * x) * invsqrsigma);
}

void main()
{
    highp float _35;
    if (uParams_OriginalSize.y < 375.0)
    {
        _35 = mix(1.0, 2.0, clamp((uParams_auto_res * round(uParams_OriginalSize.x / 300.0)) - 1.0, 0.0, 1.0));
    }
    else
    {
        _35 = 1.0;
    }
    auto_rez = _35;
    highp float _62;
    if (uParams_FINE_GLOW > 0.5)
    {
        _62 = uParams_FINE_GLOW;
    }
    else
    {
        _62 = mix(0.75, 0.5, -uParams_FINE_GLOW);
    }
    FINE_GLOW = _62;
    invsqrsigma = 1.0 / ((((2.0 * uParams_SIGMA_H) * uParams_SIGMA_H) * auto_rez) * auto_rez);
    highp vec4 SourceSize1 = uParams_OriginalSize * vec4(FINE_GLOW, FINE_GLOW, 1.0 / FINE_GLOW, 1.0 / FINE_GLOW);
    highp float f = fract(SourceSize1.x * vTexCoord.x);
    f = 0.5 - f;
    highp vec2 tex = (floor(SourceSize1.xy * vTexCoord) * SourceSize1.zw) + (SourceSize1.zw * 0.5);
    highp vec3 color = vec3(0.0);
    highp vec2 dx = vec2(SourceSize1.z, 0.0);
    highp float wsum = 0.0;
    highp float n = (-uParams_SIZEH) * auto_rez;
    for (int crtGuestLoop0 = 0; crtGuestLoop0 < 512; crtGuestLoop0++)
    {
        highp vec3 pixel = crtGuestSampleLinearBorder(LinearizePass, tex + (dx * n), 0.0).xyz;
        if (uParams_m_glow > 0.5)
        {
            pixel = max(pixel - vec3(uParams_m_glow_cutoff), vec3(0.0));
            highp vec3 param = pixel;
            highp float param_1 = max(max(max(pixel.x, pixel.y), pixel.z) - uParams_m_glow_cutoff, 0.0);
            pixel = plant(param, param_1);
        }
        highp float param_2 = n + f;
        highp float w = gaussian(param_2);
        color += (pixel * w);
        wsum += w;
        n += 1.0;
        if (!(n <= (uParams_SIZEH * auto_rez)))
        {
            break;
        }
    }
    color /= vec3(wsum);
    FragColor = vec4(color, 1.0);
}

