#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of advanced/bloom_vertical.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: e7992b156937ce826572ae72e7e379d4e548b1de8315d82c4de625ba5f9e8b6b
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

uniform highp vec4 uParams_SourceSize;
uniform highp vec4 uParams_OriginalSize;
uniform highp vec4 uParams_OutputSize;
uniform highp float uParams_FrameCount;
uniform highp float uParams_SIZEVB;
uniform highp float uParams_SIGMA_VB;
uniform highp float uParams_FINE_BLOOM;

uniform highp sampler2D Source;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;
highp float FINE_BLOOM;
highp float invsqrsigma;

highp float gaussian(highp float x)
{
    return exp(((-x) * x) * invsqrsigma);
}

void main()
{
    highp float _27;
    if (uParams_FINE_BLOOM > 0.5)
    {
        _27 = uParams_FINE_BLOOM;
    }
    else
    {
        _27 = mix(0.75, 0.5, -uParams_FINE_BLOOM);
    }
    FINE_BLOOM = _27;
    invsqrsigma = 1.0 / ((2.0 * uParams_SIGMA_VB) * uParams_SIGMA_VB);
    highp vec4 SourceSize1 = uParams_SourceSize;
    SourceSize1.y = uParams_OriginalSize.yw.x;
    SourceSize1.w = uParams_OriginalSize.yw.y;
    SourceSize1 *= vec4(FINE_BLOOM, FINE_BLOOM, 1.0 / FINE_BLOOM, 1.0 / FINE_BLOOM);
    highp float f = fract(SourceSize1.y * vTexCoord.y);
    f = 0.5 - f;
    highp vec2 tex = (floor(SourceSize1.xy * vTexCoord) * SourceSize1.zw) + (SourceSize1.zw * 0.5);
    highp vec4 color = vec4(0.0);
    highp vec2 dy = vec2(0.0, SourceSize1.w);
    highp float wsum = 0.0;
    highp float n = -uParams_SIZEVB;
    for (int crtGuestLoop0 = 0; crtGuestLoop0 < 512; crtGuestLoop0++)
    {
        highp vec4 pixel = crtGuestSampleLinearBorder(Source, tex + (dy * n), 0.0);
        highp float param = n + f;
        highp float w = gaussian(param);
        pixel.w *= (pixel.w * pixel.w);
        color += (pixel * w);
        wsum += w;
        n += 1.0;
        if (!(n <= uParams_SIZEVB))
        {
            break;
        }
    }
    color /= vec4(wsum);
    FragColor = vec4(color.xyz, pow(color.w, 0.17499999701976776123046875));
}

