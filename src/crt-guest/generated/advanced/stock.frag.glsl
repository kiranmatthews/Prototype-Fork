#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of advanced/stock.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: fa7d346e3706a351aa77dc8e77bd049b8bfde635baf4376fedcf81f38d9a4008
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

uniform highp sampler2D Source;

layout(location = 0) out highp vec4 FragColor;
in highp vec2 vTexCoord;

void main()
{
    FragColor = vec4(crtGuestSamplePointBorder(Source, vTexCoord, 0.0).xyz, 1.0);
}

