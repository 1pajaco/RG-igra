import { quat, vec3, mat4 } from 'glm';

import { Transform } from '../core/Transform.js';
import { Light } from '../core/Light.js';

export class ThirdPersonController {

    constructor(entity, camera, domElement, {
        pitch = 0,
        initialYawOffset = Math.PI,
        yaw = 0,
        velocity = [0, 0, 0],
        acceleration = 50,
        maxSpeed = 5,
        decay = 0.99999,
        pointerSensitivity = 0.002,
        cameraOffset = [0, 1.5, 5],
        pitchOffset = -0.4,
        playerGravity = -15,
        lightEntity = null,

    } = {}) {
        this.entity = entity;
        this.camera = camera;
        this.domElement = domElement;

        this.keys = {};

        this.pitch = pitch;
        this.yaw = yaw;

        this.velocity = velocity;
        this.accelerationWalk = acceleration;
        this.maxWalkingSpeed = maxSpeed;
        this.maxRunningSpeed = maxSpeed * 2.5;
        this.accelerationRun = acceleration * 2;
        this.decay = decay;
        this.pointerSensitivity = pointerSensitivity;

        this.initialYawOffset = initialYawOffset;
        this.cameraOffset = cameraOffset;
        this.pitchOffset = pitchOffset;

        this.playerGravity = playerGravity;
        this.onGround = false;
        this.verticalVelocity = 0;

        this.initHandlers();
        this.lightEntity = lightEntity;
    }

    initHandlers() {
        this.pointermoveHandler = this.pointermoveHandler.bind(this);
        this.keydownHandler = this.keydownHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);

        const element = this.domElement;
        const doc = element.ownerDocument;

        doc.addEventListener('keydown', this.keydownHandler);
        doc.addEventListener('keyup', this.keyupHandler);

        element.addEventListener('click', e => element.requestPointerLock());
        doc.addEventListener('pointerlockchange', e => {
            if (doc.pointerLockElement === element) {
                doc.addEventListener('pointermove', this.pointermoveHandler);
            } else {
                doc.removeEventListener('pointermove', this.pointermoveHandler);
            }
        });
    }

    update(t, dt) {
        const currentYaw = this.yaw + this.initialYawOffset;
        const entityYaw = currentYaw + Math.PI;

        const cos = Math.cos(currentYaw);
        const sin = Math.sin(currentYaw);
        const forward = [-sin, 0, -cos];
        const right = [cos, 0, -sin];

        const acc = vec3.create();
        if (this.keys['KeyW']) {
            vec3.add(acc, acc, forward);
        }
        if (this.keys['KeyS']) {
            vec3.sub(acc, acc, forward);
        }
        if (this.keys['KeyD']) {
            vec3.add(acc, acc, right);
        }
        if (this.keys['KeyA']) {
            vec3.sub(acc, acc, right);
        }
        if (this.keys['Space'] && this.onGround) {
            this.verticalVelocity = 10;
            this.onGround = false;
        }
        if (this.keys['ShiftLeft']) {
            this.maxSpeed = this.maxRunningSpeed;
            this.acceleration = this.accelerationRun;
        }

        if (!this.keys['ShiftLeft']) {
            this.maxSpeed = this.maxWalkingSpeed;
            this.acceleration = this.accelerationWalk;
        }

        vec3.scaleAndAdd(this.velocity, this.velocity, acc, dt * this.acceleration);

        // If there is no user input, apply decay.
        if (!this.keys['KeyW'] &&
            !this.keys['KeyS'] &&
            !this.keys['KeyD'] &&
            !this.keys['KeyA']) {
            const decay = Math.exp(dt * Math.log(1 - this.decay));
            vec3.scale(this.velocity, this.velocity, decay);
        }

        // Limit speed to prevent accelerating to infinity and beyond.
        const speed = vec3.length(this.velocity);
        if (speed > this.maxSpeed) {
            vec3.scale(this.velocity, this.velocity, this.maxSpeed / speed);
        }

        this.verticalVelocity += this.playerGravity * dt;

        const transformEntity = this.entity.getComponentOfType(Transform);
        const transformCamera = this.camera.getComponentOfType(Transform);
        // Update translation based on velocity.
        vec3.scaleAndAdd(transformEntity.translation,
            transformEntity.translation, this.velocity, dt);

        if (!this.onGround) {
            transformEntity.translation[1] = transformEntity.translation[1] + (this.verticalVelocity * dt);
        }

        const entityRotation = quat.create();
        quat.rotateY(entityRotation, entityRotation, entityYaw);

        const cameraRotation = quat.create();
        quat.rotateY(cameraRotation, cameraRotation, currentYaw);
        quat.rotateX(cameraRotation, cameraRotation, this.pitch + this.pitchOffset);

        transformEntity.rotation = entityRotation;

        const entityModelMatrix = mat4.fromRotationTranslation(mat4.create(), cameraRotation, transformEntity.translation);
        const cameraPosition = vec3.clone(this.cameraOffset);
        vec3.transformMat4(cameraPosition, cameraPosition, entityModelMatrix);

        transformCamera.translation = cameraPosition;
        transformCamera.rotation = cameraRotation;
    }

    pointermoveHandler(e) {
        const dx = e.movementX;
        const dy = e.movementY;

        this.pitch -= dy * this.pointerSensitivity;
        this.yaw -= dx * this.pointerSensitivity;

        const twopi = Math.PI * 2;
        const halfpi = Math.PI / 2;

        this.pitch = Math.min(Math.max(this.pitch, -halfpi), halfpi);
        this.yaw = ((this.yaw % twopi) + twopi) % twopi;
    }

    keydownHandler(e) {
        if (e.code === 'KeyP' && window.gameStarted) {
            const overlay = document.getElementById('pauseOverlay');
            if (overlay) {
                if (overlay.style.display === 'flex') {
                    overlay.style.display = 'none';
                    overlay.classList.add('hidden');
                    try { window.gameStarted = true; } catch (err) { }
                } else {
                    overlay.style.display = 'flex';
                    overlay.classList.remove('hidden');
                    try { window.gameStarted = false; } catch (err) { }
                    try { document.exitPointerLock(); } catch (err) { }
                }
            }
        }

        if (e.code === 'KeyL') {
            const lightComp = this.lightEntity.getComponentOfType(Light);
            if (lightComp) {
                lightComp.type = (lightComp.type === 'spot') ? 'point' : 'spot';
            }
        }

        this.keys[e.code] = true;
    }

    keyupHandler(e) {
        this.keys[e.code] = false;
    }

}
