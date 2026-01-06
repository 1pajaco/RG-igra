import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';
import { Renderer } from './engine/renderers/phong/Renderer.js';
import { Light } from './engine/core/Light.js';

import { ThirdPersonController } from './engine/controllers/ThirdPersonController.js';

import { Camera, Model, Entity, Transform, Primitive, Material, Texture, Sampler } from 'engine/core/core.js';

import {
    calculateAxisAlignedBoundingBox,
    mergeAxisAlignedBoundingBoxes,
} from 'engine/core/MeshUtils.js';

import { Physics } from './Physics.js';

const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas);
await renderer.initialize();

const loader = new GLTFLoader();
await loader.load(new URL('./firstScene/scene.gltf', import.meta.url));

const scene = loader.loadScene();
const camera = loader.loadNode('Camera');
camera.aabb = {
    min: [-0.8, -0.8, -0.8],
    max: [0.8, 0.8, 0.8],
};

const chickenEntity = loader.loadNode('Object_218');
const transform = chickenEntity.getComponentOfType(Transform);
transform.translation = [5, 10, -5];

chickenEntity.addComponent(new ThirdPersonController(chickenEntity, camera, canvas));

const light00 = new Entity();
light00.addComponent(new Transform({
    translation: [0, 2, 2],
}));
light00.addComponent(new Light({
    intensity: 3,
}));
light00.name = "chickenLight";
scene.push(light00);

const physics = new Physics(scene);
// // // izpis objektov
// for (const entity of scene) {
//     console.log(entity);
// }

for (const entity of scene) {
    const model = entity.getComponentOfType(Model);
    if (!model) {
        continue;
    }

    for (const primitive of model.primitives) {
        const material = primitive.material;
        if (material.diffuse === undefined) material.diffuse = 1.0;
        if (material.specular === undefined) material.specular = 0.0;
        if (material.shininess === undefined) material.shininess = 1.0;
    }

    const boxes = model.primitives.map(primitive => calculateAxisAlignedBoundingBox(primitive.mesh));
    entity.aabb = mergeAxisAlignedBoundingBoxes(boxes);
}

const startScreen = document.getElementById('start');
const instructions = document.getElementById('instructions');
const overlay = document.getElementById('frontPageSquare');
const options = document.getElementById('options');

let gameStarted = false; // comment when working and in css
// let gameStarted = true; // comment when presenting and in css

document.getElementById('btnInstructions').onclick = () => {
    startScreen.classList.add('hidden');
    instructions.classList.remove('hidden');
};

document.getElementById('btnBack').onclick = () => {
    instructions.classList.add('hidden');
    startScreen.classList.remove('hidden');
};

document.getElementById('btnOptions').onclick = () => {
    startScreen.classList.add('hidden');
    options.classList.remove('hidden');
};

document.getElementById('btnBackOptions').onclick = () => {
    options.classList.add('hidden');
    startScreen.classList.remove('hidden');
};

document.getElementById('btnStart').onclick = () => {
    overlay.classList.add('hidden');
    gameStarted = true;
    canvas.requestPointerLock();
};

const blurCheckbox = document.getElementById('blurCheckbox');
if (blurCheckbox) {
    blurCheckbox.addEventListener('change', (e) => {
        const enabled = !!e.target.checked;

        if (renderer && typeof renderer.setBlurEnabled === 'function') {
            renderer.setBlurEnabled(enabled);
        }
    });
}

function update(time, dt) {
    if (!gameStarted) {
        return;
    }

    const chickenPos = chickenEntity.getComponentOfType(Transform).translation;
    const lightTransform = light00.getComponentOfType(Transform);

    lightTransform.translation = [
        chickenPos[0],
        chickenPos[1] + 3,
        chickenPos[2],
    ];

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

// Resize in sistemi ostanejo zunaj, da se canvas pravilno prilagodi takoj ob nalaganju
function resize({ displaySize: { width, height } }) {
    const camComponent = camera.getComponentOfType(Camera);
    if (camComponent) {
        camComponent.aspect = width / height;
    }
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
