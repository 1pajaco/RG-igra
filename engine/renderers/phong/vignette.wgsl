struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texcoords : vec2f,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

@vertex
fn vertex(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    var output : VertexOutput;
    var pos = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f( 3.0, -1.0),
        vec2f(-1.0,  3.0)
    );
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    var uv = pos[vertexIndex] * 0.5 + 0.5;
    output.texcoords = vec2f(uv.x, 1.0 - uv.y);
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    var color = textureSample(inputTexture, inputSampler, input.texcoords).rgb;

    // --- Vignette Logic ---
    let center = vec2f(0.5, 0.5);
    let dist = distance(input.texcoords, center);
    
    // Smoothstep creates a smooth gradient between radius 0.4 and 0.8
    // Pixels further than 0.8 will be black.
    let vignette = 1.0 - smoothstep(0.2, 0.7, dist);

    return vec4f(color * vignette, 1.0);
}