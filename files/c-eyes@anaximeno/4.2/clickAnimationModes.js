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
const Tweener = imports.ui.tweener;
const St = imports.gi.St;

class ClickAnimationMode {
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
        let [mouse_x, mouse_y, _] = global.get_pointer();
        let actor_scale = this.eye.mouse_click_image_size > 20 ? 1.5 : 3;

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

        Tweener.addTween(actor, {
            x: mouse_x - (this.eye.mouse_click_image_size * actor_scale / 2),
            y: mouse_y - (this.eye.mouse_click_image_size * actor_scale / 2),
            scale_x: actor_scale,
            scale_y: actor_scale,
            opacity: 0,
            time: this.eye.fade_timeout / 1000,
            transition: "easeOutQuad",
            onComplete: () => {
                Main.uiGroup.remove_child(actor);
                actor.destroy();
                actor = null;
            },
            onCompleteScope: this
        });
    }
}

class ClickAnimationModeFactory {
    /**
     * Returns an click animation mode depending on the given name
     * @param {Eye} eye An instance of the class eye
     * @param {String} mode Click Animation mode name to create
     * @returns ClickAnimationMode subclass
     */
    static createClickAnimationMode(eye, mode) {
        switch (mode) {
            case "expansion":
            default:
                return new ExpansionClickAnimationMode(eye);
        }
    }
}
