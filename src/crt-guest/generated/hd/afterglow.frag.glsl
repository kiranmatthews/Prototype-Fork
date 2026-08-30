#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of hd/afterglow0.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: 9fe82bb9763b9c5991d92ab6f1b423ca578a1d258a8b8e9ba64cd23e80c55c96
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
uniform highp float uParams_PR;
uniform highp float uParams_PG;
uniform highp float uParams_PB;
uniform highp float uParams_esrc;
uniform highp float uParams_bth;

uniform highp sampler2D OriginalHistory0;
uniform highp sampler2D Source;
uniform highp sampler2D AfterglowPassFeedback;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;

void main()
{
    highp vec2 dx = vec2(uParams_OriginalSize.z, 0.0);
    highp vec2 dy = vec2(0.0, uParams_OriginalSize.w);
    highp vec3 color0 = crtGuestSamplePointBorder(OriginalHistory0, vTexCoord, 0.0).xyz;
    highp vec3 color1 = crtGuestSamplePointBorder(OriginalHistory0, vTexCoord - dx, 0.0).xyz;
    highp vec3 color2 = crtGuestSamplePointBorder(OriginalHistory0, vTexCoord + dx, 0.0).xyz;
    highp vec3 color3 = crtGuestSamplePointBorder(OriginalHistory0, vTexCoord - dy, 0.0).xyz;
    highp vec3 color4 = crtGuestSamplePointBorder(OriginalHistory0, vTexCoord + dy, 0.0).xyz;
    if (uParams_esrc > 1.5)
    {
        color0 = crtGuestSamplePointBorder(Source, vTexCoord, 0.0).xyz;
        color1 = crtGuestSamplePointBorder(Source, vTexCoord - dx, 0.0).xyz;
        color2 = crtGuestSamplePointBorder(Source, vTexCoord + dx, 0.0).xyz;
        color3 = crtGuestSamplePointBorder(Source, vTexCoord - dy, 0.0).xyz;
        color4 = crtGuestSamplePointBorder(Source, vTexCoord + dy, 0.0).xyz;
    }
    highp vec3 color = (((((color0 * 2.5) + color1) + color2) + color3) + color4) / vec3(6.5);
    highp vec3 accumulate = crtGuestSamplePointBorder(AfterglowPassFeedback, vTexCoord, 0.0).xyz;
    highp float w = 1.0;
    highp float b = uParams_bth / 255.0;
    highp float c = max(max(color0.x, color0.y), color0.z);
    w = smoothstep(b, 2.0 * b, c);
    highp vec3 result = mix(max(mix(color, accumulate, vec3(0.4900000095367431640625) + vec3(uParams_PR, uParams_PG, uParams_PB)) - vec3(0.0049019609577953815460205078125), vec3(0.0)), color, vec3(w));
    FragColor = vec4(result, w);
}

