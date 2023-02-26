/* clickAnimationModes.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
'use strict';

const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

class ClickAnimationMode {
    /** @type Eye */
    eye;

    /**
     * Create a new instance of the eye mode
     * @param {Eye} eye An instance of the class eye
     */
    constructor(eye) {
        this.eye = eye;
    }

    /**
     * Animates the click into the screen
     * @param {GIcon} icon The icon that will be animated
     * @param {object} options Additional options used while during the animation
     */
    animateClick(icon, options = {}) {
        // Implemented by sub-classes
    }
}

class ExpansionClickAnimationMode extends ClickAnimationMode {
    animateClick(icon, options = {}) {
        let actor_scale = this.eye.mouse_click_image_size > 20 ? 1.5 : 3;
        let [mouse_x, mouse_y, _] = global.get_pointer();

        let actor = new St.Icon({
            x: mouse_x - (this.eye.mouse_click_image_size / 2),
            y: mouse_y - (this.eye.mouse_click_image_size / 2),
            reactive: false,
            can_focus: false,
            track_hover: false,
            icon_size: this.eye.mouse_click_image_size,
            opacity: this.eye.mouse_click_opacity,
            gicon: icon
        });

        Main.uiGroup.add_child(actor);

        actor.ease({
            opacity: 0,
            x: mouse_x - (this.eye.mouse_click_image_size * actor_scale / 2),
            y: mouse_y - (this.eye.mouse_click_image_size * actor_scale / 2),
            scale_x: actor_scale,
            scale_y: actor_scale,
            duration: this.eye.fade_timeout,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                Main.uiGroup.remove_child(actor);
                actor.destroy();
                actor = null;
            }
        });
    }
}

class RetractionClickAnimationMode extends ClickAnimationMode {
    animateClick(icon, options = {}) {
        let [mouse_x, mouse_y, _] = global.get_pointer();

        let actor = new St.Icon({
            x: mouse_x - (this.eye.mouse_click_image_size / 2),
            y: mouse_y - (this.eye.mouse_click_image_size / 2),
            reactive: false,
            can_focus: false,
            track_hover: false,
            icon_size: this.eye.mouse_click_image_size,
            opacity: this.eye.mouse_click_opacity,
            gicon: icon
        });

        Main.uiGroup.add_child(actor);

        actor.ease({
            opacity: 0,
            x: mouse_x,
            y: mouse_y,
            scale_x: 0,
            scale_y: 0,
            duration: this.eye.fade_timeout,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                Main.uiGroup.remove_child(actor);
                actor.destroy();
                actor = null;
            }
        });
    }
}

class BounceBackClickAnimationMode extends ClickAnimationMode {
    animateClick(icon, options = {}) {
        let [mouse_x, mouse_y, mask] = global.get_pointer();

        let actor = new St.Icon({
            x: mouse_x,
            y: mouse_y,
            scale_x: 0.1,
            scale_y: 0.1,
            reactive: false,
            can_focus: false,
            track_hover: false,
            icon_size: this.eye.mouse_click_image_size,
            opacity: 0,
            gicon: icon
        });

        Main.uiGroup.add_child(actor);

        actor.ease({
            x: mouse_x - (this.eye.mouse_click_image_size / 2),
            y: mouse_y - (this.eye.mouse_click_image_size / 2),
            scale_x: 1,
            scale_y: 1,
            opacity: this.eye.mouse_click_opacity,
            duration: this.eye.fade_timeout / 2,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                actor.ease({
                    opacity: 0,
                    x: mouse_x,
                    y: mouse_y,
                    scale_x: 0,
                    scale_y: 0,
                    duration: this.eye.fade_timeout / 2,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        Main.uiGroup.remove_child(actor);
                        actor.destroy();
                        actor = null;
                    }
                });
            }
        });
    }
}

class BlinkClickAnimationMode extends ClickAnimationMode {
    animateClick(icon, options = {}) {
        let [mouse_x, mouse_y, mask] = global.get_pointer();

        let actor = new St.Icon({
            x: mouse_x - (this.eye.mouse_click_image_size / 2),
            y: mouse_y - (this.eye.mouse_click_image_size / 2),
            reactive: false,
            can_focus: false,
            track_hover: false,
            icon_size: this.eye.mouse_click_image_size,
            opacity: this.eye.mouse_click_opacity,
            gicon: icon
        });

        Main.uiGroup.add_child(actor);

        actor.ease({
            opacity: 0,
            duration: this.eye.fade_timeout,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                Main.uiGroup.remove_child(actor);
                actor.destroy();
                actor = null;
            }
        });
    }
}

class ClickAnimationModeFactory {
    /**
     * Returns an click animation mode depending on the given name
     * @param {Eye} eye An instance of the class Eye
     * @param {String} mode Click Animation mode name to create
     * @returns ClickAnimationMode subclass
     */
    static createClickAnimationMode(eye, mode) {
        switch (mode) {
            case "bounce-back":
                return new BounceBackClickAnimationMode(eye);
            case "retract":
                return new RetractionClickAnimationMode(eye);
            case "expand":
                return new ExpansionClickAnimationMode(eye);
            case "blink":
            default:
                return new BlinkClickAnimationMode(eye);
        }
    }
}
