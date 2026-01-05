struct VertexInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct FragmentInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

struct CameraUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    position: vec3f,
}

struct LightUniforms {
    color: vec3f,
    position: vec3f,
    attenuation: vec3f,
}

struct ModelUniforms {
    modelMatrix: mat4x4f,
    normalMatrix: mat3x3f,
}

struct MaterialUniforms {
    baseFactor: vec4f,
    diffuse: f32,
    specular: f32,
    shininess: f32,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
const MAX_LIGHTS: u32 = 16u;
@group(1) @binding(0) var<uniform> lights: array<LightUniforms, 16>;
@group(1) @binding(1) var<uniform> lightCount: u32;
@group(2) @binding(0) var<uniform> model: ModelUniforms;
@group(3) @binding(0) var<uniform> material: MaterialUniforms;
@group(3) @binding(1) var baseTexture: texture_2d<f32>;
@group(3) @binding(2) var baseSampler: sampler;

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = camera.projectionMatrix * camera.viewMatrix * model.modelMatrix * vec4(input.position, 1);
    output.position = (model.modelMatrix * vec4(input.position, 1)).xyz;
    output.texcoords = input.texcoords;
    output.normal = model.normalMatrix * input.normal;
    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let surfacePosition = input.position;
    let N = normalize(input.normal);
    let V = normalize(camera.position - surfacePosition);

    var diffuseLight = vec3f(0.0);
    var specularLight = vec3f(0.0);
    for (var i: u32 = 0u; i < lightCount; i = i + 1u) {
        let l = lights[i];
        let d = distance(surfacePosition, l.position);
        let att = 1 / dot(l.attenuation, vec3(1, d, d * d));
        let L = normalize(l.position - surfacePosition);
        let R = normalize(reflect(-L, N));
        let lambert = max(dot(N, L), 0.0) * material.diffuse;
        let phong = pow(max(dot(V, R), 0.0), material.shininess) * material.specular;
        diffuseLight += lambert * att * l.color;
        specularLight += specularLight + phong * att * l.color;
    }

    let baseColor = textureSample(baseTexture, baseSampler, input.texcoords) * material.baseFactor;
    let finalColor = baseColor.rgb * diffuseLight + specularLight;

    output.color = pow(vec4(finalColor, 1), vec4(1 / 2.2));

    return output;
}
