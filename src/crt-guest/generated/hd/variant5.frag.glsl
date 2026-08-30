#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of hd/crt-guest-advanced-hd-pass1.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: da202cae6930a4d1a8519ec31ca77277c5d25d7b5a67c96281d7400738436dfa
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
uniform highp float uParams_SIGMA_HOR;
uniform highp float uParams_HSHARPNESS;
uniform highp float uParams_S_SHARP;
uniform highp float uParams_HARNG;
uniform highp float uParams_HSHARP;
uniform highp float uParams_spike;
uniform highp float uParams_SIGMA_VER;
uniform highp float uParams_VSHARPNESS;
uniform highp float uParams_internal_res;
uniform highp float uParams_auto_res;
uniform highp float uParams_MAXS;

uniform highp sampler2D LinearizePass;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;
highp float internal_res;
highp float invsqrsigma;

highp float gaussian(highp float x)
{
    return exp(((-x) * x) * invsqrsigma);
}

void main()
{
    highp float _28;
    if (uParams_OriginalSize.y < 375.0)
    {
        _28 = mix(uParams_internal_res, 1.85000002384185791015625 * uParams_internal_res, clamp((uParams_auto_res * round(uParams_OriginalSize.x / 300.0)) - 1.0, 0.0, 1.0));
    }
    else
    {
        _28 = uParams_internal_res;
    }
    internal_res = _28;
    invsqrsigma = 1.0 / ((((2.0 * uParams_SIGMA_HOR) * uParams_SIGMA_HOR) * internal_res) * internal_res);
    highp vec2 prescalex = vec2(textureSize(LinearizePass, 0)) / uParams_OriginalSize.xy;
    highp vec4 SourceSize = uParams_OriginalSize * vec4(prescalex.x, prescalex.y, 1.0 / prescalex.x, 1.0 / prescalex.y);
    highp float f = fract(SourceSize.x * vTexCoord.x);
    f = 0.5 - f;
    highp vec2 tex = (floor(SourceSize.xy * vTexCoord) * SourceSize.zw) + (SourceSize.zw * 0.5);
    highp vec3 color = vec3(0.0);
    highp float scolor = 0.0;
    highp vec2 dx = vec2(SourceSize.z, 0.0);
    highp float w = 0.0;
    highp float swsum = 0.0;
    highp float wsum = 0.0;
    highp float hsharpness = uParams_HSHARPNESS * internal_res;
    highp vec3 cmax = vec3(0.0);
    highp vec3 cmin = vec3(1.0);
    highp float param = hsharpness;
    highp float sharp = gaussian(param) * uParams_S_SHARP;
    highp float maxsharp = uParams_MAXS;
    highp float FPR = hsharpness;
    highp float FPRi = 1.0 / hsharpness;
    highp float fpx = 0.0;
    highp float sp = 0.0;
    highp float sw = 0.0;
    highp float ts = 0.02500000037252902984619140625;
    highp vec3 luma = vec3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875);
    highp float LOOPSIZE = ceil(2.0 * FPR);
    highp float n = -LOOPSIZE;
    for (int crtGuestLoop0 = 0; crtGuestLoop0 < 512; crtGuestLoop0++)
    {
        highp vec3 pixel = crtGuestSampleLinearBorder(LinearizePass, tex + (dx * n), 0.0).xyz;
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
            sw = w * (dot(pixel, luma) + ts);
            sp = max(max(pixel.x, pixel.y), pixel.z);
            scolor += (sw * sp);
            swsum += sw;
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
    scolor /= swsum;
    color = clamp(mix(clamp(color, cmin, cmax), color, vec3(uParams_HARNG)), vec3(0.0), vec3(1.0));
    scolor = clamp(mix(max(max(color.x, color.y), color.z), scolor, uParams_spike), 0.0, 1.0);
    FragColor = vec4(color, scolor);
}

