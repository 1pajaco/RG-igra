struct VertexInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) texcoords: vec2f,
    @location(2) diffuseLight: vec3f,
    @location(3) specularLight: vec3f,
}

struct FragmentInput {
    @location(1) texcoords: vec2f,
    @location(2) diffuseLight: vec3f,
    @location(3) specularLight: vec3f,
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
    color: vec4f,
    position: vec4f,
    directionInner: vec4f,
    outerAtt: vec4f,
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

    let surfacePosition = (model.modelMatrix * vec4(input.position, 1)).xyz;
    let N = normalize(model.normalMatrix * input.normal);
    let V = normalize(camera.position - surfacePosition);

    var diffuseLight = vec3f(0.0);
    var specularLight = vec3f(0.0);
    for (var i: u32 = 0u; i < lightCount; i = i + 1u) {
        let l = lights[i];
        let typeId = i32(l.position.w + 0.5);
        var L = vec3f(0.0);
        var att: f32 = 1.0;
        if (typeId == 1) {
            L = normalize(-l.directionInner.xyz);
            att = 1.0;
        } else {
            L = normalize(l.position.xyz - surfacePosition);
            let dist: f32 = distance(l.position.xyz, surfacePosition);
            let a0: f32 = l.outerAtt.y;
            let a1: f32 = l.outerAtt.z;
            let a2: f32 = l.outerAtt.w;
            att = 1.0 / max(0.001, a0 + a1 * dist + a2 * dist * dist);
            if (typeId == 2) {
                let dir = normalize(-l.directionInner.xyz);
                let cosTheta: f32 = dot(L, dir);
                let inner: f32 = l.directionInner.w;
                let outer: f32 = l.outerAtt.x;
                var spot: f32 = 0.0;
                let f: f32 = 4.0;
                if (cosTheta >= inner) {
                    spot = 1.0;
                } else if (cosTheta <= outer) {
                    spot = 0.0;
                } else {
                    spot = pow(max(0.0, cosTheta), f); 
                }
                att = att * spot;
            }
        }
        var nDotL: f32 = max(0.0, dot(N, L));
        let R = normalize(reflect(-L, N));
        let lambert = nDotL * material.diffuse;
        let phong = pow(max(dot(V, R), 0.0), material.shininess) * material.specular;
        diffuseLight += lambert * att * l.color.xyz;
        specularLight += phong * att * l.color.xyz;
    }

    output.position = camera.projectionMatrix * camera.viewMatrix * model.modelMatrix * vec4(input.position, 1);
    output.texcoords = input.texcoords;

    output.diffuseLight = diffuseLight;
    output.specularLight = specularLight;

    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let baseColor = textureSample(baseTexture, baseSampler, input.texcoords) * material.baseFactor;
    let ambient = baseColor.rgb * 0.001;
    let finalColor = baseColor.rgb * input.diffuseLight + input.specularLight + ambient;

    output.color = pow(vec4(finalColor, 1), vec4(1 / 2.2));

    return output;
}
