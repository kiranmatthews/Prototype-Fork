#version 300 es
// AUTO-GENERATED. DO NOT HAND EDIT.
// WebGL2 translation of hd/pre-shaders-afterglow.slang
// libretro/slang-shaders @ a62d9cda9140294d22b6da5e4ff4187365890d42
// Source SHA-256: 1906f72720142e9eb4757e4c440c7146ece993517778d85a08c624f93293a8f7
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
uniform highp float uParams_TNTC;
uniform highp float uParams_LS;
uniform highp float uParams_LUTLOW;
uniform highp float uParams_LUTBR;
uniform highp float uParams_CP;
uniform highp float uParams_CS;
uniform highp float uParams_WP;
uniform highp float uParams_wp_saturation;
uniform highp float uParams_AS;
uniform highp float uParams_agsat;
uniform highp float uParams_BP;
uniform highp float uParams_vigstr;
uniform highp float uParams_vigdef;
uniform highp float uParams_sega_fix;
uniform highp float uParams_pre_bb;
uniform highp float uParams_contr;
uniform highp float uParams_pre_gc;

uniform highp sampler2D StockPass;
uniform highp sampler2D AfterglowPass;
uniform highp sampler2D SamplerLUT1;
uniform highp sampler2D SamplerLUT2;
uniform highp sampler2D SamplerLUT3;
uniform highp sampler2D SamplerLUT4;

in highp vec2 vTexCoord;
layout(location = 0) out highp vec4 FragColor;

highp vec3 fix_lut(highp vec3 lutcolor, inout highp vec3 ref)
{
    highp float r = length(ref);
    highp float l = length(lutcolor);
    highp float m = max(max(ref.x, ref.y), ref.z);
    ref = normalize(lutcolor + vec3(1.0000000116860974230803549289703e-07)) * mix(r, l, pow(m, 1.25));
    return mix(lutcolor, ref, vec3(1.0));
}

highp vec3 plant(highp vec3 tar, highp float r)
{
    highp float t = max(max(tar.x, tar.y), tar.z) + 9.9999997473787516355514526367188e-06;
    return (tar * r) / vec3(t);
}

highp float contrast(highp float x)
{
    return max(mix(x, smoothstep(0.0, 1.0, x), uParams_contr), 0.0);
}

highp vec3 pgc(highp vec3 c)
{
    highp float mc = max(max(c.x, c.y), c.z);
    highp float mg = pow(mc, 1.0 / uParams_pre_gc);
    return (c * mg) / vec3(mc + 9.9999999392252902907785028219223e-09);
}

highp float vignette(inout highp vec2 pos)
{
    highp vec2 b = (vec2(uParams_vigdef, uParams_vigdef) * vec2(1.0, uParams_OriginalSize.x / uParams_OriginalSize.y)) * 0.125;
    pos = clamp(pos, vec2(0.0), vec2(1.0));
    pos = abs((pos - vec2(0.5)) * 2.0);
    highp vec2 res = mix(vec2(0.0), vec2(1.0), smoothstep(vec2(1.0), vec2(1.0) - b, sqrt(pos)));
    res = pow(res, vec2(0.699999988079071044921875));
    return max(mix(1.0, sqrt(res.x * res.y), uParams_vigstr), 0.0);
}

void main()
{
    highp vec4 imgColor = crtGuestSamplePointBorder(StockPass, vTexCoord, 0.0);
    highp vec4 aftglow = crtGuestSamplePointBorder(AfterglowPass, vTexCoord, 0.0);
    highp float w = 1.0 - aftglow.w;
    highp float l = length(aftglow.xyz);
    highp vec4 _218 = aftglow;
    highp vec3 _231 = (normalize(pow(_218.xyz + vec3(0.00999999977648258209228515625), vec3(uParams_agsat))) * (uParams_AS * w)) * l;
    aftglow.x = _231.x;
    aftglow.y = _231.y;
    aftglow.z = _231.z;
    highp float bp = (w * uParams_BP) / 255.0;
    if (uParams_sega_fix > 0.5)
    {
        highp vec4 _253 = imgColor;
        highp vec3 _256 = _253.xyz * 1.066945552825927734375;
        imgColor.x = _256.x;
        imgColor.y = _256.y;
        imgColor.z = _256.z;
    }
    highp vec4 _263 = imgColor;
    highp vec3 _266 = min(_263.xyz, vec3(1.0));
    imgColor.x = _266.x;
    imgColor.y = _266.y;
    imgColor.z = _266.z;
    highp vec3 color = imgColor.xyz;
    if (int(uParams_TNTC) == 0)
    {
        color = imgColor.xyz;
    }
    else
    {
        highp float lutlow = 0.01960784383118152618408203125;
        highp float invLS = 1.0 / uParams_LS;
        highp vec3 lut_ref = imgColor.xyz + ((vec3(1.0) - pow(imgColor.xyz, vec3(0.333000004291534423828125))) * lutlow);
        highp float lutb = lut_ref.z * (1.0 - (0.5 * invLS));
        highp vec3 _314 = lut_ref;
        highp vec2 _322 = (_314.xy * (1.0 - invLS)) + vec2(0.5 * invLS);
        lut_ref.x = _322.x;
        lut_ref.y = _322.y;
        highp float tile1 = ceil(lutb * (uParams_LS - 1.0));
        highp float tile0 = max(tile1 - 1.0, 0.0);
        highp float f = fract(lutb * (uParams_LS - 1.0));
        if (f == 0.0)
        {
            f = 1.0;
        }
        highp vec2 coord0 = vec2(tile0 + lut_ref.x, lut_ref.y) * vec2(invLS, 1.0);
        highp vec2 coord1 = vec2(tile1 + lut_ref.x, lut_ref.y) * vec2(invLS, 1.0);
        highp vec4 color1;
        highp vec4 color2;
        highp vec4 res;
        if (int(uParams_TNTC) == 1)
        {
            color1 = crtGuestSampleLinearBorder(SamplerLUT1, coord0, 0.0);
            color2 = crtGuestSampleLinearBorder(SamplerLUT1, coord1, 0.0);
            res = mix(color1, color2, vec4(f));
        }
        else
        {
            if (int(uParams_TNTC) == 2)
            {
                color1 = crtGuestSampleLinearBorder(SamplerLUT2, coord0, 0.0);
                color2 = crtGuestSampleLinearBorder(SamplerLUT2, coord1, 0.0);
                res = mix(color1, color2, vec4(f));
            }
            else
            {
                if (int(uParams_TNTC) == 3)
                {
                    color1 = crtGuestSampleLinearBorder(SamplerLUT3, coord0, 0.0);
                    color2 = crtGuestSampleLinearBorder(SamplerLUT3, coord1, 0.0);
                    res = mix(color1, color2, vec4(f));
                }
                else
                {
                    if (int(uParams_TNTC) == 4)
                    {
                        color1 = crtGuestSampleLinearBorder(SamplerLUT4, coord0, 0.0);
                        color2 = crtGuestSampleLinearBorder(SamplerLUT4, coord1, 0.0);
                        res = mix(color1, color2, vec4(f));
                    }
                }
            }
        }
        highp vec3 param = res.xyz;
        highp vec3 param_1 = imgColor.xyz;
        highp vec3 _457 = fix_lut(param, param_1);
        res.x = _457.x;
        res.y = _457.y;
        res.z = _457.z;
        color = mix(imgColor.xyz, res.xyz, vec3(min(uParams_TNTC, 1.0)));
    }
    highp vec3 c = clamp(color, vec3(0.0), vec3(1.0));
    highp float p;
    highp mat3 m_out;
    if (uParams_CS == 0.0)
    {
        p = 2.2000000476837158203125;
        m_out = mat3(vec3(3.2409698963165283203125, -0.9692440032958984375, 0.0556299984455108642578125), vec3(-1.53738296031951904296875, 1.87596797943115234375, -0.20397700369358062744140625), vec3(-0.4986110031604766845703125, 0.0415549986064434051513671875, 1.056972026824951171875));
    }
    else
    {
        if (uParams_CS == 1.0)
        {
            p = 2.2000000476837158203125;
            m_out = mat3(vec3(2.7917230129241943359375, -0.89476597309112548828125, 0.0416780002415180206298828125), vec3(-1.17316496372222900390625, 1.81558597087860107421875, -0.13088600337505340576171875), vec3(-0.4409730136394500732421875, 0.0320000015199184417724609375, 1.0020339488983154296875));
        }
        else
        {
            if (uParams_CS == 2.0)
            {
                p = 2.599999904632568359375;
                m_out = mat3(vec3(2.97342205047607421875, -0.8676049709320068359375, 0.0450309999287128448486328125), vec3(-1.11043298244476318359375, 1.84375703334808349609375, -0.09569700062274932861328125), vec3(-0.4802469909191131591796875, 0.02474300004541873931884765625, 1.2012150287628173828125));
            }
            else
            {
                if (uParams_CS == 3.0)
                {
                    p = 2.2000000476837158203125;
                    m_out = mat3(vec3(2.0415880680084228515625, -0.9692440032958984375, 0.013443999923765659332275390625), vec3(-0.5650069713592529296875, 1.87596797943115234375, -0.11835999786853790283203125), vec3(-0.3447310030460357666015625, 0.0415549986064434051513671875, 1.01517498493194580078125));
                }
                else
                {
                    if (uParams_CS == 4.0)
                    {
                        p = 2.400000095367431640625;
                        m_out = mat3(vec3(1.71665096282958984375, -0.666683971881866455078125, 0.01764000020921230316162109375), vec3(-0.355670988559722900390625, 1.61648094654083251953125, -0.0427710004150867462158203125), vec3(-0.253365993499755859375, 0.01576899923384189605712890625, 0.94210302829742431640625));
                    }
                }
            }
        }
    }
    if (uParams_CS == 5.0)
    {
        p = 2.2000000476837158203125;
        m_out = mat3(vec3(2.4935090541839599609375, -0.829473018646240234375, 0.0358511991798877716064453125), vec3(-0.93138802051544189453125, 1.762629985809326171875, -0.07618390023708343505859375), vec3(-0.40271198749542236328125, 0.0236239992082118988037109375, 0.9570295810699462890625));
    }
    color = pow(c, vec3(p));
    highp mat3 m_in = mat3(vec3(0.412391006946563720703125, 0.2126390039920806884765625, 0.019331000745296478271484375), vec3(0.3575839996337890625, 0.715169012546539306640625, 0.11919499933719635009765625), vec3(0.18048100173473358154296875, 0.07219199836254119873046875, 0.950532019138336181640625));
    if (uParams_CP == 0.0)
    {
        m_in = mat3(vec3(0.412391006946563720703125, 0.2126390039920806884765625, 0.019331000745296478271484375), vec3(0.3575839996337890625, 0.715169012546539306640625, 0.11919499933719635009765625), vec3(0.18048100173473358154296875, 0.07219199836254119873046875, 0.950532019138336181640625));
    }
    else
    {
        if (uParams_CP == 1.0)
        {
            m_in = mat3(vec3(0.4305540025234222412109375, 0.222003996372222900390625, 0.02018200047314167022705078125), vec3(0.34154999256134033203125, 0.706655025482177734375, 0.12955300509929656982421875), vec3(0.17835199832916259765625, 0.071341000497341156005859375, 0.939321994781494140625));
        }
        else
        {
            if (uParams_CP == 2.0)
            {
                m_in = mat3(vec3(0.3966859877109527587890625, 0.21029900014400482177734375, 0.006130999885499477386474609375), vec3(0.3725039958953857421875, 0.71376597881317138671875, 0.1153559982776641845703125), vec3(0.18126599490642547607421875, 0.075935997068881988525390625, 0.9675710201263427734375));
            }
            else
            {
                if (uParams_CP == 3.0)
                {
                    m_in = mat3(vec3(0.393521010875701904296875, 0.21237599849700927734375, 0.01873899996280670166015625), vec3(0.3652580082416534423828125, 0.701059997081756591796875, 0.111933998763561248779296875), vec3(0.1916770040988922119140625, 0.086563996970653533935546875, 0.958384990692138671875));
                }
                else
                {
                    if (uParams_CP == 4.0)
                    {
                        m_in = mat3(vec3(0.392257988452911376953125, 0.20940999686717987060546875, 0.016061000525951385498046875), vec3(0.3511349856853485107421875, 0.72567999362945556640625, 0.093635998666286468505859375), vec3(0.1666029989719390869140625, 0.064910002052783966064453125, 0.850323975086212158203125));
                    }
                    else
                    {
                        if (uParams_CP == 5.0)
                        {
                            m_in = mat3(vec3(0.37792301177978515625, 0.19567899405956268310546875, 0.01051400043070316314697265625), vec3(0.31736600399017333984375, 0.72231900691986083984375, 0.097825996577739715576171875), vec3(0.20773799717426300048828125, 0.08200199902057647705078125, 1.07695996761322021484375));
                        }
                    }
                }
            }
        }
    }
    color = m_in * color;
    color = m_out * color;
    color = clamp(color, vec3(0.0), vec3(1.0));
    color = pow(color, vec3(1.0 / p));
    if (uParams_CP == (-1.0))
    {
        color = c;
    }
    highp vec3 param_2 = pow(color, vec3(uParams_wp_saturation));
    highp float param_3 = max(max(color.x, color.y), color.z);
    highp vec3 scolor1 = plant(param_2, param_3);
    highp float luma = dot(color, vec3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    highp vec3 scolor2 = mix(vec3(luma), color, vec3(uParams_wp_saturation));
    bvec3 _778 = bvec3(uParams_wp_saturation > 1.0);
    color = vec3(_778.x ? scolor1.x : scolor2.x, _778.y ? scolor1.y : scolor2.y, _778.z ? scolor1.z : scolor2.z);
    highp float param_4 = max(max(color.x, color.y), color.z);
    highp vec3 param_5 = color;
    highp float param_6 = contrast(param_4);
    color = plant(param_5, param_6);
    p = 2.2000000476837158203125;
    color = clamp(color, vec3(0.0), vec3(1.0));
    color = pow(color, vec3(p));
    highp vec3 warmer = mat3(vec3(0.485033929347991943359375, 0.2500956058502197265625, 0.0227359645068645477294921875), vec3(0.348895728588104248046875, 0.69779145717620849609375, 0.11629857122898101806640625), vec3(0.13028235733509063720703125, 0.052112944424152374267578125, 0.68615376949310302734375)) * color;
    warmer = mat3(vec3(3.2409698963165283203125, -0.9692440032958984375, 0.0556299984455108642578125), vec3(-1.53738296031951904296875, 1.87596797943115234375, -0.20397700369358062744140625), vec3(-0.4986110031604766845703125, 0.0415549986064434051513671875, 1.056972026824951171875)) * warmer;
    highp vec3 cooler = mat3(vec3(0.341275393962860107421875, 0.175970137119293212890625, 0.01599728502333164215087890625), vec3(0.364617049694061279296875, 0.72923409938812255859375, 0.121539019048213958740234375), vec3(0.2369894087314605712890625, 0.094795763492584228515625, 1.24814426898956298828125)) * color;
    cooler = mat3(vec3(3.2409698963165283203125, -0.9692440032958984375, 0.0556299984455108642578125), vec3(-1.53738296031951904296875, 1.87596797943115234375, -0.20397700369358062744140625), vec3(-0.4986110031604766845703125, 0.0415549986064434051513671875, 1.056972026824951171875)) * cooler;
    highp float m = abs(uParams_WP) / 100.0;
    bvec3 _851 = bvec3(uParams_WP < 0.0);
    highp vec3 comp = vec3(_851.x ? cooler.x : warmer.x, _851.y ? cooler.y : warmer.y, _851.z ? cooler.z : warmer.z);
    color = mix(color, comp, vec3(m));
    color = pow(max(color, vec3(0.0)), vec3(1.0 / p));
    highp vec3 param_7 = color;
    color = pgc(param_7);
    if (uParams_BP > (-0.5))
    {
        color = (color + aftglow.xyz) + vec3(bp);
    }
    else
    {
        color = (max(color + vec3(uParams_BP / 255.0), vec3(0.0)) / vec3(1.0 + ((uParams_BP / 255.0) * step((-uParams_BP) / 255.0, max(max(color.x, color.y), color.z))))) + aftglow.xyz;
    }
    color = min(color * uParams_pre_bb, vec3(1.0));
    highp vec2 param_8 = vTexCoord;
    highp float _925 = vignette(param_8);
    FragColor = vec4(color, _925);
}

