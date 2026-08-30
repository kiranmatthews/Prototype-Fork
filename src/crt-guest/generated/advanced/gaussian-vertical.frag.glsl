#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of advanced/gaussian_vertical.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: 869e6d0eb1b630ab8e5b3ff9868df3cf9a7a6ba33d768dcc9ecc0ea93b36b359
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
uniform highp float uParams_SIZEV;
uniform highp float uParams_SIGMA_V;
uniform highp float uParams_FINE_GLOW;

uniform highp sampler2D Source;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;
highp float FINE_GLOW;
highp float invsqrsigma;

highp float gaussian(highp float x)
{
    return exp(((-x) * x) * invsqrsigma);
}

void main()
{
    highp float _27;
    if (uParams_FINE_GLOW > 0.5)
    {
        _27 = uParams_FINE_GLOW;
    }
    else
    {
        _27 = mix(0.75, 0.5, -uParams_FINE_GLOW);
    }
    FINE_GLOW = _27;
    invsqrsigma = 1.0 / ((2.0 * uParams_SIGMA_V) * uParams_SIGMA_V);
    highp vec4 SourceSize1 = vec4(uParams_SourceSize.x, uParams_OriginalSize.y, uParams_SourceSize.z, uParams_OriginalSize.w) * vec4(FINE_GLOW, FINE_GLOW, 1.0 / FINE_GLOW, 1.0 / FINE_GLOW);
    highp float f = fract(SourceSize1.y * vTexCoord.y);
    f = 0.5 - f;
    highp vec2 tex = (floor(SourceSize1.xy * vTexCoord) * SourceSize1.zw) + (SourceSize1.zw * 0.5);
    highp vec3 color = vec3(0.0);
    highp vec2 dy = vec2(0.0, SourceSize1.w);
    highp float wsum = 0.0;
    highp float n = -uParams_SIZEV;
    for (int crtGuestLoop0 = 0; crtGuestLoop0 < 512; crtGuestLoop0++)
    {
        highp vec3 pixel = crtGuestSampleLinearBorder(Source, tex + (dy * n), 0.0).xyz;
        highp float param = n + f;
        highp float w = gaussian(param);
        color += (pixel * w);
        wsum += w;
        n += 1.0;
        if (!(n <= uParams_SIZEV))
        {
            break;
        }
    }
    color /= vec3(wsum);
    FragColor = vec4(color, 1.0);
}

