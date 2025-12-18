import { vec3, mat4 } from 'glm';
import { getGlobalModelMatrix } from 'engine/core/SceneUtils.js';
import { Transform, Parent } from 'engine/core/core.js';
import { ThirdPersonController } from './engine/controllers/ThirdPersonController.js';
import { isTriggerRecursive } from './engine/core/SceneUtils.js';
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
                    if (entity !== other && isTriggerRecursive(other)) {
                        this.checkTrigger(entity, other, controller, uiElement);
                    }
                    if (entity !== other && other.customProperties?.isStatic) {
                        this.resolveCollision(entity, other, controller);
                    }

                }
            }
        }
    }

    intervalIntersection(min1, max1, min2, max2) {
        return !(min1 > max2 || min2 > max1);
    }

    aabbIntersection(aabb1, aabb2) {
        return this.intervalIntersection(aabb1.min[0], aabb1.max[0], aabb2.min[0], aabb2.max[0])
            && this.intervalIntersection(aabb1.min[1], aabb1.max[1], aabb2.min[1], aabb2.max[1])
            && this.intervalIntersection(aabb1.min[2], aabb1.max[2], aabb2.min[2], aabb2.max[2]);
    }

    getTransformedAABB(entity) {
        // Transform all vertices of the AABB from local to global space.
        const matrix = getGlobalModelMatrix(entity);
        const { min, max } = entity.aabb;
        const vertices = [
            [min[0], min[1], min[2]],
            [min[0], min[1], max[2]],
            [min[0], max[1], min[2]],
            [min[0], max[1], max[2]],
            [max[0], min[1], min[2]],
            [max[0], min[1], max[2]],
            [max[0], max[1], min[2]],
            [max[0], max[1], max[2]],
        ].map(v => vec3.transformMat4(v, v, matrix));

        // Find new min and max by component.
        const xs = vertices.map(v => v[0]);
        const ys = vertices.map(v => v[1]);
        const zs = vertices.map(v => v[2]);
        const newmin = [Math.min(...xs), Math.min(...ys), Math.min(...zs)];
        const newmax = [Math.max(...xs), Math.max(...ys), Math.max(...zs)];
        return { min: newmin, max: newmax };
    }

    resolveCollision(a, b, controller) {
        // Get global space AABBs.
        const aBox = this.getTransformedAABB(a);
        const bBox = this.getTransformedAABB(b);

        // Check if there is collision.
        const isColliding = this.aabbIntersection(aBox, bBox);
        if (!isColliding) {
            return;
        }

        const transform = a.getComponentOfType(Transform);
        if (!transform) {
            return;
        }

        // Move entity A minimally to avoid collision.
        const diffa = vec3.sub(vec3.create(), bBox.max, aBox.min);
        const diffb = vec3.sub(vec3.create(), aBox.max, bBox.min);

        let minDiff = Infinity;
        let minDirection = [0, 0, 0];
        // +x push-out 
        if (diffa[0] >= 0 && diffa[0] < minDiff) {
            minDiff = diffa[0];
            minDirection = [minDiff, 0, 0];
        }
        // +y push-out
        if (diffa[1] >= 0 && diffa[1] < minDiff) {
            minDiff = diffa[1];
            minDirection = [0, minDiff, 0];

        }
        // +z push-out
        if (diffa[2] >= 0 && diffa[2] < minDiff) {
            minDiff = diffa[2];
            minDirection = [0, 0, minDiff];
        }

        // -x push-out
        if (diffb[0] >= 0 && diffb[0] < minDiff) {
            minDiff = diffb[0];
            minDirection = [-minDiff, 0, 0];
        }
        // -y push-out
        if (diffb[1] >= 0 && diffb[1] < minDiff) {
            minDiff = diffb[1];
            minDirection = [0, -minDiff, 0];
            controller.verticalVelocity = 0;

        }
        // -z push-out 
        if (diffb[2] >= 0 && diffb[2] < minDiff) {
            minDiff = diffb[2];
            minDirection = [0, 0, -minDiff];
        }

        if (minDirection[1] > 0 && controller.verticalVelocity < 0) {
            transform.translation[1] = bBox.max[1];

            controller.onGround = true;
            controller.verticalVelocity = 0;

            return;
        }

        vec3.add(transform.translation, transform.translation, minDirection);
    }

    checkTrigger(player, trigger, controller, uiElement) {
        const playerBox = this.getTransformedAABB(player);
        const triggerBox = this.getTransformedAABB(trigger);

        const isColliding = this.aabbIntersection(playerBox, triggerBox);
        if (!isColliding) {
            return
        }
        if (!trigger.customProperties.used) {
            if (uiElement) {
                uiElement.style.display = 'block';
            }

            if (controller.keys['KeyE']) {
                trigger.customProperties.used = true;
                trigger.customProperties.isStatic = false;
                uiElement.style.display = 'none';
                console.log("Good job you pecked the box and it vanished!");
            }
        }


    }

}
