#version 300 es
precision highp float;
precision highp int;

in vec3 position;
in vec2 uv;
out vec2 vTexCoord;

void main()
{
    vTexCoord = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
