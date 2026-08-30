#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of advanced/avg-lum.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: a486df346043dc4d5d21b38b6f364b7a5f0b430e4a8220869a6adeb6ae9e7328
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

uniform highp float uParams_FrameCount;
uniform highp vec4 uParams_SourceSize;
uniform highp float uParams_lsmooth;
uniform highp float uParams_lsdev;

uniform highp sampler2D Source;
uniform highp sampler2D AvgLumPassFeedback;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;

highp float dist(highp vec3 A, highp vec3 B)
{
    highp float r = 0.5 * (A.x + B.x);
    highp vec3 d = A - B;
    highp vec3 c = vec3(2.0 + r, 4.0, 3.0 - r);
    return sqrt(dot(c * d, d)) / 3.0;
}

void main()
{
    highp float m = max(log2(uParams_SourceSize.x), log2(uParams_SourceSize.y));
    m = floor(max(m, 1.0)) - 1.0;
    highp vec2 dx = vec2(1.0 / uParams_SourceSize.x, 0.0);
    highp vec2 dy = vec2(0.0, 1.0 / uParams_SourceSize.y);
    highp vec2 y2 = dy * 2.0;
    highp vec2 x2 = dx * 2.0;
    highp float ltotal = 0.0;
    ltotal += length(crtGuestSampleLinearBorder(Source, vec2(0.300000011920928955078125), m).xyz);
    ltotal += length(crtGuestSampleLinearBorder(Source, vec2(0.300000011920928955078125, 0.699999988079071044921875), m).xyz);
    ltotal += length(crtGuestSampleLinearBorder(Source, vec2(0.699999988079071044921875, 0.300000011920928955078125), m).xyz);
    ltotal += length(crtGuestSampleLinearBorder(Source, vec2(0.699999988079071044921875), m).xyz);
    ltotal *= 0.25;
    ltotal = pow(0.57735025882720947265625 * ltotal, 0.699999988079071044921875);
    highp float lhistory = crtGuestSampleLinearBorder(AvgLumPassFeedback, vec2(0.5), 0.0).w;
    ltotal = mix(ltotal, lhistory, min(mix(uParams_lsmooth, uParams_lsmooth + uParams_lsdev, ltotal), 0.9900000095367431640625));
    highp vec3 l1 = crtGuestSampleLinearBorder(Source, vTexCoord, 0.0).xyz;
    highp vec3 r1 = crtGuestSampleLinearBorder(Source, vTexCoord + dx, 0.0).xyz;
    highp vec3 l2 = crtGuestSampleLinearBorder(Source, vTexCoord - dx, 0.0).xyz;
    highp vec3 r2 = crtGuestSampleLinearBorder(Source, vTexCoord + x2, 0.0).xyz;
    highp vec3 param = l2;
    highp vec3 param_1 = l1;
    highp float c1 = dist(param, param_1);
    highp vec3 param_2 = l1;
    highp vec3 param_3 = r1;
    highp float c2 = dist(param_2, param_3);
    highp vec3 param_4 = r2;
    highp vec3 param_5 = r1;
    highp float c3 = dist(param_4, param_5);
    FragColor = vec4(c1, c2, c3, ltotal);
}

