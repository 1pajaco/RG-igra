import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';
import { OBJLoader } from 'engine/loaders/OBJLoader.js';
import { UnlitRenderer } from 'engine/renderers/UnlitRenderer.js';


import { FirstPersonController } from 'engine/controllers/FirstPersonController.js';
import { MonkeController } from './engine/controllers/MonkeController.js';
import { ThirdPersonController } from './engine/controllers/ThirdPersonController.js';

import { Camera, Model, Entity, Transform, Primitive, Material, Texture, Sampler } from 'engine/core/core.js';

import {
    calculateAxisAlignedBoundingBox,
    mergeAxisAlignedBoundingBoxes,
} from 'engine/core/MeshUtils.js';

import { Physics } from './Physics.js';

const canvas = document.querySelector('canvas');
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();

const loader = new GLTFLoader();
await loader.load(new URL('./scene/scene.gltf', import.meta.url));

const objLoader = new OBJLoader();
const monkeyMesh = await objLoader.load(new URL('../../../models/monkey/monkey.obj', import.meta.url));
import { loadResources } from 'engine/loaders/resources.js';
const resources = await loadResources({
    'mesh': new URL('../../../models/monkey/monkey.json', import.meta.url),
    'image': new URL('../../../models/monkey/normal.webp', import.meta.url),
});

const defaultTexture = new Texture({
                    image: resources.image,
                    sampler: new Sampler({
                        // minFilter: 'nearest',
                        // magFilter: 'nearest',
                        // addressModeU: 'repeat',
                        // addressModeV: 'repeat',
                    }),

});
const defaultMaterial = new Material({ baseTexture: defaultTexture });
const monkeyPrimitive = new Primitive({ mesh: monkeyMesh, material: defaultMaterial });
const monkeyModel = new Model({ primitives: [monkeyPrimitive] });


const monkeyEntity = new Entity(); 
monkeyEntity.name = 'MonkeyObstacle';
monkeyEntity.addComponent(new Transform({ translation: [0, 0.5, 0], scale: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 0] }));
monkeyEntity.addComponent(monkeyModel);
monkeyEntity.customProperties = { isDynamic: true };

const scene = loader.loadScene();
const camera = loader.loadNode('Camera');
camera.addComponent(new ThirdPersonController(monkeyEntity, camera, canvas));
camera.aabb = {
    min: [-0.2, -0.2, -0.2],
    max: [0.2, 0.2, 0.2],
};

scene.push(monkeyEntity);

const physics = new Physics(scene);
for (const entity of scene) {
    const model = entity.getComponentOfType(Model);
    console.log(entity)
    if (!model) {
        continue;
    }

    const boxes = model.primitives.map(primitive => calculateAxisAlignedBoundingBox(primitive.mesh));
    entity.aabb = mergeAxisAlignedBoundingBoxes(boxes);
}

function update(time, dt) {
    for (const entity of scene) {
        for (const component of entity.components) {
            component.update?.(time, dt);
        }
    }

    physics.update(time, dt);
}

function render() {
    renderer.render(scene, camera);
}

function resize({ displaySize: { width, height }}) {
    camera.getComponentOfType(Camera).aspect = width / height;
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
