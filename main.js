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
await loader.load(new URL('./testScene/scene.gltf', import.meta.url));

const scene = loader.loadScene();
const camera = loader.loadNode('Camera');
camera.aabb = {
    min: [-0.2, -0.2, -0.2],
    max: [0.2, 0.2, 0.2],
};

const chickenEntity = loader.loadNode('Object_218');
const transform = chickenEntity.getComponentOfType(Transform);
transform.translation = [5, 10, -5];

chickenEntity.addComponent(new ThirdPersonController(chickenEntity, camera, canvas));

const physics = new Physics(scene);
// izpis objektov
for (const entity of scene) {
    console.log(entity);
}


for (const entity of scene) {
    const model = entity.getComponentOfType(Model);
    if (!model) {
        continue;
    }

    const boxes = model.primitives.map(primitive => calculateAxisAlignedBoundingBox(primitive.mesh));
    entity.aabb = mergeAxisAlignedBoundingBoxes(boxes);
}

const startScreen = document.getElementById('start');
const instructionsScreen = document.getElementById('instructions');
const overlay = document.getElementById('frontPageSquare');

let gameStarted = false; // comment when working and in css
// let gameStarted = true; // comment when presenting and in css

document.getElementById('btnInstructions').onclick = () => {
    startScreen.classList.add('hidden');
    instructionsScreen.classList.remove('hidden');
};

document.getElementById('btnBack').onclick = () => {
    instructionsScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
};

document.getElementById('btnStart').onclick = () => {
    overlay.classList.add('hidden');
    gameStarted = true;
    canvas.requestPointerLock();
};

function update(time, dt) {
    if (!gameStarted) {
        return;
    }

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
