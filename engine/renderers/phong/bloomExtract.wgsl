struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texcoords : vec2f,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

@vertex
fn vertex(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    // Standard full-screen triangle code
    var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f( 3.0, -1.0), vec2f(-1.0,  3.0));
    var output : VertexOutput;
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    var uv = pos[vertexIndex] * 0.5 + 0.5;
    output.texcoords = vec2f(uv.x, 1.0 - uv.y);
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    let color = textureSample(inputTexture, inputSampler, input.texcoords).rgb;
    
    // Calculate how bright the pixel is (Luminance)
    let brightness = dot(color, vec3f(0.2126, 0.7152, 0.0722));
    
    // Threshold: Only keep pixels brighter than 0.8
    if (brightness > 0.8) {
        return vec4f(color, 1.0);
    }
    return vec4f(0.0, 0.0, 0.0, 1.0);
}