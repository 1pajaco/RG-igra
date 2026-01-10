struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texcoords : vec2f,
}

@group(0) @binding(0) var sceneTexture: texture_2d<f32>;
@group(0) @binding(1) var glowTexture: texture_2d<f32>;
@group(0) @binding(2) var baseSampler: sampler;

@vertex
fn vertex(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f( 3.0, -1.0), vec2f(-1.0,  3.0));
    var output : VertexOutput;
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    var uv = pos[vertexIndex] * 0.5 + 0.5;
    output.texcoords = vec2f(uv.x, 1.0 - uv.y);
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    let scene = textureSample(sceneTexture, baseSampler, input.texcoords).rgb;
    let glow = textureSample(glowTexture, baseSampler, input.texcoords).rgb;
    
    // Additive Blending: Scene + Glow
    return vec4f(scene + glow, 1.0);
}