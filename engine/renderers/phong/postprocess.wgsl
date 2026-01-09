struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texcoords : vec2f,
}

@group(0) @binding(0) var screenTexture: texture_2d<f32>;
@group(0) @binding(1) var screenSampler: sampler;

@vertex
fn vertex(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    var output : VertexOutput;
    
    // A standard trick to create a full-screen triangle from 3 vertices
    var pos = array<vec2f, 3>(
        vec2f(-1.0, -1.0), // Bottom left
        vec2f( 3.0, -1.0), // Bottom right
        vec2f(-1.0,  3.0)  // Top left
    );

    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    
    // Convert clip space (-1 to 1) to UV space (0 to 1)
    var uv = pos[vertexIndex] * 0.5 + 0.5;
    
    // Flip Y because WebGPU texture coordinates (0,0) are Top-Left
    output.texcoords = vec2f(uv.x, 1.0 - uv.y); 

    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    let dims = vec2f(textureDimensions(screenTexture));
    // Calculate size of one pixel (texel)
    let pixelSize = 1.0 / dims; 
    
    var color = vec3f(0.0);
    
    let count = 9.0;
    
    let offsets = array<vec2f, 9>(
        vec2f(-1, -1), vec2f(0, -1), vec2f(1, -1),
        vec2f(-1,  0), vec2f(0,  0), vec2f(1,  0),
        vec2f(-1,  1), vec2f(0,  1), vec2f(1,  1)
    );

    for (var i = 0; i < 9; i++) {
        let sampleUV = input.texcoords + offsets[i] * pixelSize * 2.0;
        color += textureSample(screenTexture, screenSampler, sampleUV).rgb;
    }

    return vec4f(color / count, 1.0);
}