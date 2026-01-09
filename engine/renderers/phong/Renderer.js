import { vec3, mat4 } from 'glm';

import * as WebGPU from 'engine/WebGPU.js';

import * as SceneUtils from 'engine/core/SceneUtils.js';

import { Camera, Model, Parent } from 'engine/core/core.js';
import { BaseRenderer } from 'engine/renderers/BaseRenderer.js';

import {
    getLocalModelMatrix,
    getGlobalModelMatrix,
    getGlobalViewMatrix,
    getProjectionMatrix,
} from 'engine/core/SceneUtils.js';

import { Light } from '../../core/Light.js';

const vertexBufferLayout = {
    arrayStride: 32,
    attributes: [
        {
            name: 'position',
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3',
        },
        {
            name: 'texcoords',
            shaderLocation: 1,
            offset: 12,
            format: 'float32x2',
        },
        {
            name: 'normal',
            shaderLocation: 2,
            offset: 20,
            format: 'float32x3',
        },
    ],
};

const cameraBindGroupLayout = {
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
    ],
};

const MAX_LIGHTS = 16;

const lightBindGroupLayout = {
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
        {
            binding: 1,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
    ],
};

const modelBindGroupLayout = {
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
    ],
};

const materialBindGroupLayout = {
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
        },
        {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
        },
    ],
};
const postProcessBindGroupLayout = {
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      texture: {},
    },
    {
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {},
    },
  ],
};

export class Renderer extends BaseRenderer {
  constructor(canvas) {
    super(canvas);
    this.perFragment = true;
    this.postProcessBlur = false;
    this.effectsState = {
      blur: 0,
      vignette: 0,
    };
  }

  setEffect(name, enabled) {
    if (this.effectsState.hasOwnProperty(name)) {
      this.effectsState[name] = enabled ? 1 : 0;
      console.log(`Effect ${name} set to ${this.effectsState[name]}`);
    } else {
      console.warn(`Effect ${name} does not exist`);
    }
  }
  isPostProcessEnabled() {
    return (
      this.effectsState.blur === 1 ||
      this.effectsState.ao === 1 ||
      this.effectsState.vignette === 1
    );
  }

  async initialize() {
    await super.initialize();

    const codePerFragment = await fetch(
      "./engine/renderers/phong/phongPerFragment.wgsl"
    ).then((response) => response.text());
    const codePerVertex = await fetch(
      "./engine/renderers/phong/phongPerVertex.wgsl"
    ).then((response) => response.text());
    const codePostProcess = await fetch(
      "./engine/renderers/phong/postprocess.wgsl"
    ).then((response) => response.text());
    const codeVignette = await fetch(
      "./engine/renderers/phong/vignette.wgsl"
    ).then((r) => r.text());

    const modulePerFragment = this.device.createShaderModule({
      code: codePerFragment,
    });
    const modulePerVertex = this.device.createShaderModule({
      code: codePerVertex,
    });
    const modulePostProcess = this.device.createShaderModule({
      code: codePostProcess,
    });
    const moduleVignette = this.device.createShaderModule({
      code: codeVignette,
    });

    this.cameraBindGroupLayout = this.device.createBindGroupLayout(
      cameraBindGroupLayout
    );
    this.lightBindGroupLayout =
      this.device.createBindGroupLayout(lightBindGroupLayout);
    this.modelBindGroupLayout =
      this.device.createBindGroupLayout(modelBindGroupLayout);
    this.materialBindGroupLayout = this.device.createBindGroupLayout(
      materialBindGroupLayout
    );
    this.postProcessBindGroupLayout = this.device.createBindGroupLayout(
      postProcessBindGroupLayout
    );

    const layout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.cameraBindGroupLayout,
        this.lightBindGroupLayout,
        this.modelBindGroupLayout,
        this.materialBindGroupLayout,
      ],
    });

    this.pipelinePerFragment = await this.device.createRenderPipelineAsync({
      vertex: {
        module: modulePerFragment,
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: modulePerFragment,
        targets: [{ format: this.format }],
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
      layout,
    });

    this.pipelinePerVertex = await this.device.createRenderPipelineAsync({
      vertex: {
        module: modulePerVertex,
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: modulePerVertex,
        targets: [{ format: this.format }],
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
      layout,
    });
    const postProcessLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.postProcessBindGroupLayout],
    });
    this.pipelinePostProcess = await this.device.createRenderPipelineAsync({
      layout: postProcessLayout,
      vertex: { module: modulePostProcess, entryPoint: "vertex" },
      fragment: {
        module: modulePostProcess,
        entryPoint: "fragment",
        targets: [{ format: this.format }],
      },
    });
    this.pipelineVignette = await this.device.createRenderPipelineAsync({
      layout: postProcessLayout,
      vertex: { module: moduleVignette, entryPoint: "vertex" },
      fragment: {
        module: moduleVignette,
        entryPoint: "fragment",
        targets: [{ format: this.format }],
      },
    });

    // POST-PROCESS: Create a sampler for reading the scene texture
    this.postProcessSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
    this.postProcessFlagBuffer = this.device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.recreateRenderTarget();
    this.lightArrayBuffer = this.device.createBuffer({
      size: MAX_LIGHTS * 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.lightCountBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.lightBindGroup = this.device.createBindGroup({
      layout: this.lightBindGroupLayout,
      entries: [
        { binding: 0, resource: this.lightArrayBuffer },
        { binding: 1, resource: this.lightCountBuffer },
      ],
    });
  }

  recreateRenderTarget() {
    this.depthTexture?.destroy();
    this.sceneTexture?.destroy();

    const size = [this.canvas.width, this.canvas.height];
    this.depthTexture = this.device.createTexture({
      format: "depth24plus",
      size,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.sceneTexture = this.device.createTexture({
      format: this.format,
      size,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.intermediateTexture?.destroy();
    this.intermediateTexture = this.device.createTexture({
        format: this.format,
        size: [this.canvas.width, this.canvas.height],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
}

  recreateDepthTexture() {
    this.depthTexture?.destroy();
    this.depthTexture = this.device.createTexture({
      format: "depth24plus",
      size: [this.canvas.width, this.canvas.height],
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  prepareEntity(entity) {
    if (this.gpuObjects.has(entity)) {
      return this.gpuObjects.get(entity);
    }

    const modelUniformBuffer = this.device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const modelBindGroup = this.device.createBindGroup({
      layout: this.modelBindGroupLayout,
      entries: [{ binding: 0, resource: modelUniformBuffer }],
    });

    const gpuObjects = { modelUniformBuffer, modelBindGroup };
    this.gpuObjects.set(entity, gpuObjects);
    return gpuObjects;
  }

  prepareCamera(camera) {
    if (this.gpuObjects.has(camera)) {
      return this.gpuObjects.get(camera);
    }

    const cameraUniformBuffer = this.device.createBuffer({
      size: 144,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const cameraBindGroup = this.device.createBindGroup({
      layout: this.cameraBindGroupLayout,
      entries: [{ binding: 0, resource: cameraUniformBuffer }],
    });

    const gpuObjects = { cameraUniformBuffer, cameraBindGroup };
    this.gpuObjects.set(camera, gpuObjects);
    return gpuObjects;
  }

  prepareLight(light) {
    if (this.gpuObjects.has(light)) {
      return this.gpuObjects.get(light);
    }

    const lightUniformBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const lightBindGroup = this.device.createBindGroup({
      layout: this.lightBindGroupLayout,
      entries: [{ binding: 0, resource: lightUniformBuffer }],
    });

    const gpuObjects = { lightUniformBuffer, lightBindGroup };
    this.gpuObjects.set(light, gpuObjects);
    return gpuObjects;
  }

  prepareTexture(texture) {
    if (this.gpuObjects.has(texture)) {
      return this.gpuObjects.get(texture);
    }

    const { gpuTexture } = this.prepareImage(texture.image, texture.isSRGB);
    const { gpuSampler } = this.prepareSampler(texture.sampler);

    const gpuObjects = { gpuTexture, gpuSampler };
    this.gpuObjects.set(texture, gpuObjects);
    return gpuObjects;
  }

  prepareMaterial(material) {
    if (this.gpuObjects.has(material)) {
      return this.gpuObjects.get(material);
    }

    const baseTexture = this.prepareTexture(material.baseTexture);

    const materialUniformBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const materialBindGroup = this.device.createBindGroup({
      layout: this.materialBindGroupLayout,
      entries: [
        { binding: 0, resource: materialUniformBuffer },
        { binding: 1, resource: baseTexture.gpuTexture },
        { binding: 2, resource: baseTexture.gpuSampler },
      ],
    });

    const gpuObjects = { materialUniformBuffer, materialBindGroup };
    this.gpuObjects.set(material, gpuObjects);
    return gpuObjects;
  }

  render(scene, camera) {
    if (
      this.depthTexture.width !== this.canvas.width ||
      this.depthTexture.height !== this.canvas.height
    ) {
      this.recreateRenderTarget();
    }

    const encoder = this.device.createCommandEncoder();
    const blurOn = this.effectsState.blur === 1;
    const vignetteOn = this.effectsState.vignette === 1;
    const usePostProcess = blurOn || vignetteOn;
    const targetView = usePostProcess
      ? this.sceneTexture.createView()
      : this.context.getCurrentTexture().createView();
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          clearValue: [0.5, 0.5, 0.5, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    });
    scenePass.setPipeline(
      this.perFragment ? this.pipelinePerFragment : this.pipelinePerVertex
    );
    //this.renderPass = encoder.beginRenderPass({
    //    colorAttachments: [
    //        {
    //            view: this.context.getCurrentTexture(),
    //            clearValue: [1, 1, 1, 1],
    //            loadOp: 'clear',
    //            storeOp: 'store',
    //        }
    //    ],
    //    depthStencilAttachment: {
    //        view: this.depthTexture,
    //        depthClearValue: 1,
    //        depthLoadOp: 'clear',
    //        depthStoreOp: 'discard',
    //    },
    //});
    //this.renderPass.setPipeline(this.perFragment ? this.pipelinePerFragment : this.pipelinePerVertex);

    const cameraComponent = camera.getComponentOfType(Camera);
    const viewMatrix = getGlobalViewMatrix(camera);
    const projectionMatrix = getProjectionMatrix(camera);
    const cameraPosition = mat4.getTranslation(
      vec3.create(),
      getGlobalModelMatrix(camera)
    );
    const { cameraUniformBuffer, cameraBindGroup } =
      this.prepareCamera(cameraComponent);
    this.device.queue.writeBuffer(cameraUniformBuffer, 0, viewMatrix);
    this.device.queue.writeBuffer(cameraUniformBuffer, 64, projectionMatrix);
    this.device.queue.writeBuffer(cameraUniformBuffer, 128, cameraPosition);
    scenePass.setBindGroup(0, cameraBindGroup);

    const lights = scene.filter((e) => e.getComponentOfType(Light));
    const lightsData = new Float32Array(MAX_LIGHTS * 16);
    let count = 0;
    for (let i = 0; i < Math.min(lights.length, MAX_LIGHTS); i++) {
      const e = lights[i];
      const lc = e.getComponentOfType(Light);
      const m = getGlobalModelMatrix(e);
      const pos = mat4.getTranslation(vec3.create(), m);
      const base = i * 16;
      const lightColor = vec3.scale(
        vec3.create(),
        lc.color,
        lc.intensity / 255
      );
      lightsData[base + 0] = lightColor[0];
      lightsData[base + 1] = lightColor[1];
      lightsData[base + 2] = lightColor[2];
      lightsData[base + 3] = lc.intensity ?? 1.0;
      const typeId = lc.type === "directional" ? 1 : lc.type === "spot" ? 2 : 0;
      lightsData[base + 4] = pos[0];
      lightsData[base + 5] = pos[1];
      lightsData[base + 6] = pos[2];
      lightsData[base + 7] = typeId;
      const transformedDirPoint = vec3.transformMat4(
        vec3.create(),
        [0, 0, 1],
        m
      );
      const forward = vec3.sub(vec3.create(), transformedDirPoint, pos);
      vec3.normalize(forward, forward);
      const innerCos = Math.cos(lc.innerConeAngle ?? 0.0);
      lightsData[base + 8] = forward[0];
      lightsData[base + 9] = forward[1];
      lightsData[base + 10] = forward[2];
      lightsData[base + 11] = innerCos;
      const outerCos = Math.cos(lc.outerConeAngle ?? Math.PI / 4);
      const att = lc.attenuation ?? [1.0, 0.0, 0.0];
      lightsData[base + 12] = outerCos;
      lightsData[base + 13] = att[0];
      lightsData[base + 14] = att[1];
      lightsData[base + 15] = att[2] ?? 0.0;
      count++;
    }
    this.device.queue.writeBuffer(this.lightArrayBuffer, 0, lightsData);
    const countBuf = new Uint32Array([count]);
    this.device.queue.writeBuffer(this.lightCountBuffer, 0, countBuf);
    scenePass.setBindGroup(1, this.lightBindGroup);

    for (const entity of scene) {
      const parent = entity.getComponentOfType(Parent);
      if (entity.customProperties?.used) {
        continue;
      }
      if (
        parent &&
        parent.entity?.customProperties?.used &&
        SceneUtils.isTriggerRecursive(entity)
      ) {
        continue;
      }

      this.renderEntity(entity, scenePass);
    }

    scenePass.end();
    if (usePostProcess) {
        let currentInputView = this.sceneTexture.createView();
        if(blurOn){
            const targetView = vignetteOn 
                ? this.intermediateTexture.createView() 
                : this.context.getCurrentTexture().createView();

            const blurPass = encoder.beginRenderPass({
                colorAttachments: [{ view: targetView, loadOp: 'clear', storeOp: 'store', clearValue: [0,0,0,1] }]
            });
            
            blurPass.setPipeline(this.pipelinePostProcess); 
            const bg = this.device.createBindGroup({
                layout: this.postProcessBindGroupLayout,
                entries: [
                    { binding: 0, resource: currentInputView },
                    { binding: 1, resource: this.postProcessSampler },
                ]
            });
            blurPass.setBindGroup(0, bg);
            blurPass.draw(3);
            blurPass.end();

            // The input for the next effect is now the texture we just wrote to
            currentInputView = this.intermediateTexture.createView();
        }
        if(vignetteOn){
            const targetView = this.context.getCurrentTexture().createView();

            const vigPass = encoder.beginRenderPass({
                colorAttachments: [{ view: targetView, loadOp: 'clear', storeOp: 'store', clearValue: [0,0,0,1] }]
            });

            vigPass.setPipeline(this.pipelineVignette);
            const bg = this.device.createBindGroup({
                layout: this.postProcessBindGroupLayout,
                entries: [
                    { binding: 0, resource: currentInputView },
                    { binding: 1, resource: this.postProcessSampler },
                ]
            });
            vigPass.setBindGroup(0, bg);
            vigPass.draw(3);
            vigPass.end();
        
        }
    }
    this.device.queue.submit([encoder.finish()]);
  }

  renderEntity(entity, pass) {
    const modelMatrix = getGlobalModelMatrix(entity);
    const normalMatrix = mat4.normalFromMat4(mat4.create(), modelMatrix);

    const { modelUniformBuffer, modelBindGroup } = this.prepareEntity(entity);
    this.device.queue.writeBuffer(modelUniformBuffer, 0, modelMatrix);
    this.device.queue.writeBuffer(modelUniformBuffer, 64, normalMatrix);
    pass.setBindGroup(2, modelBindGroup);

    for (const model of entity.getComponentsOfType(Model)) {
      this.renderModel(model, pass);
    }
  }

  renderModel(model, pass) {
    for (const primitive of model.primitives) {
      this.renderPrimitive(primitive, pass);
    }
  }

  renderPrimitive(primitive, pass) {
    const material = primitive.material;
    const { materialUniformBuffer, materialBindGroup } =
      this.prepareMaterial(material);
    this.device.queue.writeBuffer(
      materialUniformBuffer,
      0,
      new Float32Array([
        ...material.baseFactor,
        material.diffuse,
        material.specular,
        material.shininess,
      ])
    );
    pass.setBindGroup(3, materialBindGroup);

    const { vertexBuffer, indexBuffer } = this.prepareMesh(
      primitive.mesh,
      vertexBufferLayout
    );
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, "uint32");

    pass.drawIndexed(primitive.mesh.indices.length);
  }
}
