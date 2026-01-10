import { vec3, mat4 } from 'glm';
import { getGlobalModelMatrix } from 'engine/core/SceneUtils.js';
import { Transform, Parent } from 'engine/core/core.js';
import { ThirdPersonController } from '../controllers/ThirdPersonController.js';
import { isTriggerRecursive } from './SceneUtils.js';
import { checkTrigger } from './Trigger.js';
export class Physics {

    constructor(scene) {
        this.scene = scene;
    }

    update(t, dt) {
        const uiElement = document.getElementById('interactionUi');
        if (uiElement) {
            uiElement.style.display = 'none';
        }
        for (const entity of this.scene) {
            const controller = entity.getComponentOfType(ThirdPersonController)
            if (!controller) {
                continue;
            }

            if (entity.customProperties?.isDynamic) {
                let transform = entity.getComponentOfType(Transform);
                if (transform) {
                    controller.verticalVelocity += controller.playerGravity * dt;
                    transform.translation[1] += controller.verticalVelocity * dt;
                }

                controller.onGround = false;
                for (const other of this.scene) {
                    if (entity === other) continue;

                    if (isTriggerRecursive(other)) {
                        checkTrigger(this, entity, other, controller, uiElement);
                    }
                    if (other.customProperties?.isStatic) {
                        this.resolveCollisionOBB(entity, other, controller);
                    }

                }
                if (controller.camera) {
                    this.resolveCameraCollisionOBB(controller.camera, entity, this.scene);
                }

            }
        }
    }
    //https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/OBB.js
    getOBB(entity) {
        const matrix = getGlobalModelMatrix(entity);
        const { min, max } = entity.aabb;

        const localCentre = vec3.add(vec3.create(), min, max);
        vec3.scale(localCentre, localCentre, 0.5);
        const center = vec3.transformMat4(vec3.create(), localCentre, matrix);

        const axisX = vec3.fromValues(matrix[0], matrix[1], matrix[2]);
        const axisY = vec3.fromValues(matrix[4], matrix[5], matrix[6]);
        const axisZ = vec3.fromValues(matrix[8], matrix[9], matrix[10]);

        const scaleX = vec3.length(axisX);
        const scaleY = vec3.length(axisY);
        const scaleZ = vec3.length(axisZ);

        vec3.normalize(axisX, axisX);
        vec3.normalize(axisY, axisY);
        vec3.normalize(axisZ, axisZ);

        const halfExtents = [
            ((max[0] - min[0]) / 2) * scaleX,
            ((max[1] - min[1]) / 2) * scaleY,
            ((max[2] - min[2]) / 2) * scaleZ
        ];

        return { center, axes: [axisX, axisY, axisZ], halfExtents };
    }
    testAxis(axis, obbA, obbB) {
        const distVec = vec3.sub(vec3.create(), obbB.center, obbA.center);
        const dist = Math.abs(vec3.dot(distVec, axis));

        const rA = obbA.halfExtents[0] * Math.abs(vec3.dot(obbA.axes[0], axis)) +
            obbA.halfExtents[1] * Math.abs(vec3.dot(obbA.axes[1], axis)) +
            obbA.halfExtents[2] * Math.abs(vec3.dot(obbA.axes[2], axis));

        const rB = obbB.halfExtents[0] * Math.abs(vec3.dot(obbB.axes[0], axis)) +
            obbB.halfExtents[1] * Math.abs(vec3.dot(obbB.axes[1], axis)) +
            obbB.halfExtents[2] * Math.abs(vec3.dot(obbB.axes[2], axis));

        return (rA + rB) - dist;
    }
    getIntersection(obbA, obbB) {
        const axes = [...obbA.axes, ...obbB.axes];
        // Cross products for edge cases
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const cross = vec3.cross(vec3.create(), obbA.axes[i], obbB.axes[j]);
                if (vec3.length(cross) > 0.001) {
                    vec3.normalize(cross, cross);
                    axes.push(cross);
                }
            }
        }

        let minOverlap = Infinity;
        let smallestAxis = null;

        for (const axis of axes) {
            const overlap = this.testAxis(axis, obbA, obbB);
            if (overlap < 0) return; // Gap found
            if (overlap < minOverlap) {
                minOverlap = overlap;
                smallestAxis = axis;
            }
        }
        return { overlap: minOverlap, axis: smallestAxis };
    }
    obbIntersection(obbA, obbB) {
    return this.getIntersection(obbA, obbB) !== undefined;
}
    resolveCollisionOBB(a, b, controller) {
        const obbA = this.getOBB(a);
        const obbB = this.getOBB(b);

        const intersection = this.getIntersection(this.getOBB(a), this.getOBB(b));
        if (!intersection) return;

        let { overlap, axis } = intersection;
        if (!intersection) return;

        const transform = a.getComponentOfType(Transform);
        const d = vec3.sub(vec3.create(), obbA.center, obbB.center);
        if (vec3.dot(d, axis) < 0) vec3.negate(axis, axis);

        const pushOut = vec3.scale(vec3.create(), axis, overlap);

        const upward = axis[1];

        //if (pushOut[1] > 0 && controller.verticalVelocity < 0) {
        //    controller.onGround = true;
        //    controller.verticalVelocity = 0;
        //}
        if (upward > 0.7 && controller.verticalVelocity <= 0) {
            controller.onGround = true;
            controller.verticalVelocity = 0;

            // Snap to floor height to prevent micro-stuttering
            transform.translation[1] += pushOut[1];
        }
        else if (upward < -0.7 && controller.verticalVelocity > 0) {
            controller.verticalVelocity = 0;
            transform.translation[1] += pushOut[1];
        }

        // Always push out horizontally to prevent clipping into walls
        transform.translation[0] += pushOut[0];
        transform.translation[2] += pushOut[2];

        //vec3.add(transform.translation, transform.translation, pushOut);
    }
    resolveCameraCollisionOBB(camera, player, scene) {
        const transform = camera.getComponentOfType(Transform);
        const playerTransform = player.getComponentOfType(Transform);
        const playerHead = vec3.add(
            vec3.create(),
            playerTransform.translation,
            [0, 4, 0]
        );
        for (let i = 0; i < 5; i++) {
            const cameraOBB = this.getOBB(camera);
            let collided = false;

            for (const other of scene) {
                if (!other.customProperties?.isStatic || isTriggerRecursive(other))
                    continue;

                const otherOBB = this.getOBB(other);
                const intersection = this.getIntersection(cameraOBB, otherOBB);

                if (intersection) {
                    collided = true;
                    let { overlap, axis } = intersection;
                    const toCamera = vec3.sub(vec3.create(), cameraOBB.center, otherOBB.center);
                    const toHead = vec3.sub(vec3.create(), playerHead, cameraOBB.center);
                    //const d = vec3.sub(
                    //  vec3.create(),
                    //  cameraOBB.center,
                    //  otherOBB.center
                    //);
                    if (vec3.dot(toCamera, axis) < 0) vec3.negate(axis, axis); const camToHead = vec3.sub(vec3.create(), playerHead, cameraOBB.center);
                    if (vec3.dot(axis, toHead) < -0.2) {
                        // This usually happens when the OBB center is more than 50% inside a thin floor/wall
                        vec3.negate(axis, axis);
                    }

                    // Push camera out of the object
                    const pushOut = vec3.scale(vec3.create(), axis, overlap);
                    vec3.add(transform.translation, transform.translation, pushOut);

                    // Update cameraOBB position for next potential collision in same frame
                    vec3.add(cameraOBB.center, cameraOBB.center, pushOut);
                }
            }
            if (!collided) break;
        }
    }
}