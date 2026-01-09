let objective;
let flashEl;

export function showObjective() {
    objective = document.getElementById('objectiveText');
    objective.style.display = 'block';
}

function showFlash(text, duration) {
    flashEl = document.getElementById('flashMessage');
    flashEl.textContent = text;
    flashEl.style.display = 'block';
    clearTimeout(showFlash._timeout);
    showFlash._timeout = setTimeout(() => { flashEl.style.display = 'none'; }, duration);
}

export function checkTrigger(physics, player, trigger, controller, uiElement) {
    const playerBox = physics.getTransformedAABB(player);
    const triggerBox = physics.getTransformedAABB(trigger);

    const isColliding = physics.aabbIntersection(playerBox, triggerBox);
    if (!isColliding) {
        return;
    }

    if (trigger.name === 'exit') {
        console.log('EXIT TRIGGERED');
        trigger.customProperties.isStatic = false;
        for (const entity of physics.scene) {
            if (entity.name === "Door1.002") {
                entity.customProperties.used = false;
                entity.customProperties.isStatic = true;
            }
        }
        const content = document.getElementById('objectiveContent');
        content.textContent = 'Freedom?';
        flashEl = document.getElementById('flashMessage');
        flashEl.textContent = 'You Win?';
        flashEl.style.display = 'block';
    }

    if (!trigger.customProperties.used) {
        uiElement.style.display = 'block';

        if (controller.keys['KeyE']) {
            if (trigger.name === 'button.002') {
                const modal = document.getElementById('promptModal');
                const input = document.getElementById('promptInput');
                const submit = document.getElementById('promptSubmit');
                modal.style.display = 'flex';
                document.exitPointerLock();
                input.value = '';
                const cleanup = () => {
                    modal.style.display = 'none';
                    submit.removeEventListener('click', onSubmit);
                    const canvas = document.querySelector('canvas');
                    canvas.requestPointerLock();
                };
                const onSubmit = () => {
                    if (input.value === '321') {
                        trigger.customProperties.isTrigger = false;
                        for (const entity of physics.scene) {
                            if (entity.name === "Door1.002") {
                                entity.customProperties.used = true;
                                entity.customProperties.isStatic = false;
                            }
                        }
                        uiElement.style.display = 'none';
                        showFlash('DOOR HAS OPENED!', 3000);
                        objective = document.getElementById('objectiveText');

                        const content = document.getElementById('objectiveContent');
                        content.textContent = 'FIND THE EXIT!';
                    } else {
                        showFlash('INCORRECT CODE!', 3000);
                    }
                    cleanup();
                };
                submit.addEventListener('click', onSubmit);
            } else if (trigger.name === 'button') {
                trigger.customProperties.isTrigger = false;
                for (const entity of physics.scene) {
                    if (entity.name === "Door1") {
                        entity.customProperties.used = true;
                        entity.customProperties.isStatic = false;
                    }
                }
                showFlash('DOOR HAS OPENED!', 3000);
                objective = document.getElementById('objectiveText');

                const content = document.getElementById('objectiveContent');
                content.textContent = 'Find the next button and the second part of the code.';
            } else if (trigger.name === 'button.001') {
                trigger.customProperties.isTrigger = false;
                for (const entity of physics.scene) {
                    if (entity.name === "Door1.001") {
                        entity.customProperties.used = true;
                        entity.customProperties.isStatic = false;
                    }
                }
                showFlash('DOOR HAS OPENED!', 3000);
                objective = document.getElementById('objectiveText');

                const content = document.getElementById('objectiveContent');
                content.textContent = 'Find the final piece of the code and enter it in the final button.';
            } else {
                trigger.customProperties.used = true;
                trigger.customProperties.isStatic = false;
            }
        }
    }
}
