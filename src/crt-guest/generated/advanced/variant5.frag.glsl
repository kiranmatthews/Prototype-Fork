#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of advanced/linearize.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: a17af1c157c730583e11a9306d737a60eb80a880ed1edc51c3b5aa29155d7e39
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

uniform highp vec4 uGlobal_SourceSize;
uniform highp mat4 uGlobal_MVP;

uniform highp vec4 uParams_OriginalSize;
uniform highp vec4 uParams_OutputSize;
uniform highp float uParams_FrameCount;
uniform highp float uParams_GAMMA_INPUT;
uniform highp float uParams_inter;
uniform highp float uParams_interm;
uniform highp float uParams_iscan;
uniform highp float uParams_intres;
uniform highp float uParams_iscans;
uniform highp float uParams_downsample_levelx;
uniform highp float uParams_downsample_levely;
uniform highp float uParams_gamma_out;
uniform highp float uParams_vga_mode;
uniform highp float uParams_hiscan;

uniform highp sampler2D PrePass;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;

highp vec3 fetch_pixel(highp vec2 coord)
{
    highp vec2 dx = vec2(uGlobal_SourceSize.z, 0.0) * uParams_downsample_levelx;
    highp vec2 dy = vec2(0.0, uGlobal_SourceSize.w) * uParams_downsample_levely;
    highp vec2 d1 = dx + dy;
    highp vec2 d2 = dx - dy;
    highp float sum = 15.0;
    highp vec3 result = ((((((((crtGuestSampleLinearBorder(PrePass, coord, 0.0).xyz * 3.0) + (crtGuestSampleLinearBorder(PrePass, coord + dx, 0.0).xyz * 2.0)) + (crtGuestSampleLinearBorder(PrePass, coord - dx, 0.0).xyz * 2.0)) + (crtGuestSampleLinearBorder(PrePass, coord + dy, 0.0).xyz * 2.0)) + (crtGuestSampleLinearBorder(PrePass, coord - dy, 0.0).xyz * 2.0)) + crtGuestSampleLinearBorder(PrePass, coord + d1, 0.0).xyz) + crtGuestSampleLinearBorder(PrePass, coord - d1, 0.0).xyz) + crtGuestSampleLinearBorder(PrePass, coord + d2, 0.0).xyz) + crtGuestSampleLinearBorder(PrePass, coord - d2, 0.0).xyz;
    return result / vec3(sum);
}

highp vec3 plant(highp vec3 tar, highp float r)
{
    highp float t = max(max(tar.x, tar.y), tar.z) + 9.9999997473787516355514526367188e-06;
    return (tar * r) / vec3(t);
}

void main()
{
    highp vec3 c1 = crtGuestSampleLinearBorder(PrePass, vTexCoord, 0.0).xyz;
    highp vec3 c2 = crtGuestSampleLinearBorder(PrePass, vTexCoord + vec2(0.0, uParams_OriginalSize.w), 0.0).xyz;
    if ((uParams_downsample_levelx + uParams_downsample_levely) > 0.02500000037252902984619140625)
    {
        highp vec2 param = vTexCoord;
        c1 = fetch_pixel(param);
        highp vec2 param_1 = vTexCoord + vec2(0.0, uParams_OriginalSize.w);
        c2 = fetch_pixel(param_1);
    }
    highp vec3 c = c1;
    highp float intera = 1.0;
    highp float gamma_in = uParams_GAMMA_INPUT;
    highp float m1 = max(max(c1.x, c1.y), c1.z);
    highp float m2 = max(max(c2.x, c2.y), c2.z);
    highp vec3 df = abs(c1 - c2);
    highp float d = max(max(df.x, df.y), df.z);
    if (uParams_interm == 2.0)
    {
        d = mix(0.100000001490116119384765625 * d, 10.0 * d, step(m1 / (m2 + 9.9999997473787516355514526367188e-05), m2 / (m1 + 9.9999997473787516355514526367188e-05)));
    }
    highp float r = m1;
    highp float yres_div = 1.0;
    if (uParams_intres > 1.25)
    {
        yres_div = uParams_intres;
    }
    bool hscan = uParams_hiscan > 0.5;
    bool _287 = uParams_inter <= (uParams_OriginalSize.y / yres_div);
    bool _293;
    if (_287)
    {
        _293 = uParams_interm > 0.5;
    }
    else
    {
        _293 = _287;
    }
    bool _299;
    if (_293)
    {
        _299 = uParams_intres != 1.0;
    }
    else
    {
        _299 = _293;
    }
    bool _305;
    if (_299)
    {
        _305 = uParams_intres != 0.5;
    }
    else
    {
        _305 = _299;
    }
    bool _312;
    if (_305)
    {
        _312 = uParams_vga_mode < 0.5;
    }
    else
    {
        _312 = _305;
    }
    if (_312 || hscan)
    {
        intera = 0.25;
        highp float line_no = floor(mod(uParams_OriginalSize.y * vTexCoord.y, 2.0));
        highp float frame_no = floor(mod(float(uParams_FrameCount), 2.0));
        highp float ii = abs(line_no - frame_no);
        bool _343 = uParams_interm < 3.5;
        bool _351;
        if (!_343)
        {
            _351 = uParams_interm > 5.5;
        }
        else
        {
            _351 = _343;
        }
        if (_351)
        {
            if (uParams_interm == 6.0)
            {
                c = mix(c2, c1, vec3(ii));
            }
            else
            {
                highp vec3 param_2 = mix(c2, c2 * c2, vec3(uParams_iscans));
                highp float param_3 = max(max(c2.x, c2.y), c2.z);
                c2 = plant(param_2, param_3);
                r = max(m1 * ii, (1.0 - uParams_iscan) * min(m1, m2));
                highp vec3 param_4 = mix(mix(c1, c2, vec3(min(mix(m1, 1.0 - m2, min(m1, 1.0 - m1)) / (d + 9.9999997473787516355514526367188e-06), 1.0))), c1, vec3(ii));
                highp float param_5 = r;
                c = plant(param_4, param_5);
                if (uParams_interm == 3.0)
                {
                    c = mix(c2, c1, vec3(ii)) * (1.0 - (0.5 * uParams_iscan));
                }
            }
        }
        if (uParams_interm == 4.0)
        {
            highp vec3 param_6 = mix(c, c * c, vec3(0.5 * uParams_iscans));
            highp float param_7 = max(max(c.x, c.y), c.z);
            c = plant(param_6, param_7) * (1.0 - (0.5 * uParams_iscan));
        }
        if (uParams_interm == 5.0)
        {
            c = mix(c2, c1, vec3(0.5));
            highp vec3 param_8 = mix(c, c * c, vec3(0.5 * uParams_iscans));
            highp float param_9 = max(max(c.x, c.y), c.z);
            c = plant(param_8, param_9) * (1.0 - (0.5 * uParams_iscan));
        }
        if (hscan)
        {
            c = c1;
        }
    }
    if (uParams_vga_mode > 0.5)
    {
        c = c1;
        if (uParams_inter <= uParams_OriginalSize.y)
        {
            intera = 0.75;
        }
        else
        {
            intera = 0.5;
        }
    }
    c = pow(c, vec3(gamma_in));
    if (vTexCoord.x > 0.5)
    {
        gamma_in = intera;
    }
    else
    {
        gamma_in = 1.0 / gamma_in;
    }
    FragColor = vec4(c, gamma_in);
}

