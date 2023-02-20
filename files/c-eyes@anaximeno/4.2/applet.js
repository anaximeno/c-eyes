/* applet.js
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

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;

const { Atspi, GLib, Gio, St } = imports.gi;

const { EyeModeFactory } = require("./eyeModes.js");
const { ClickAnimationModeFactory } = require("./clickAnimationModes.js");
const { debounce } = require("./helper.js");


const EYE_AREA_WIDTH = 34;
const EYE_AREA_HEIGHT = 16;


class Eye extends Applet.Applet {
	_getMouseCircleIcon(dir, mode, click_type, color) {
		let key = `${dir}${mode}${click_type}${color}`;
		let path = `${dir}/icons/${mode}_${click_type}_${color}.svg`;

		if (this._file_mem_cache[key]) {
			return this._file_mem_cache[key];
		}

		this._file_mem_cache[key] = Gio.icon_new_for_string(path);
		return this._file_mem_cache[key];
	}

	_initDataDir() {
		let data_dir = `${GLib.get_user_cache_dir()}/${this.metadata.uuid}`;

		if (GLib.mkdir_with_parents(`${data_dir}/icons`, 0o777) < 0)
			throw new Error(`Failed to create cache dir at ${data_dir}`);

		return data_dir;
	}

	_setupSettings(uuid, instanceId) {
		this.settings = new Settings.AppletSettings(this, uuid, instanceId);

		this.settings.bind(
			"eye-repaint-interval",
			"eye_repaint_interval",
			debounce((e) => this.setActive(true), 300)
		);

		this.settings.bind(
			"fade-timeout",
			"fade_timeout",
			debounce((e) => this.on_property_updated(e), 300)
		);

		this.settings.bind(
			"eye-mode",
			"eye_mode",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-click-mode",
			"mouse_click_mode",
			this.on_property_updated
		);

		this.settings.bind(
			"eye-line-width",
			"eye_line_width",
			debounce((e) => this.on_property_updated(e), 300)
		);

		this.settings.bind(
			"eye-margin",
			"eye_margin",
			debounce((e) => this.on_property_updated(e), 300)
		);

		this.settings.bind(
			"eye-clicked-color",
			"eye_clicked_color",
			this.on_property_updated
		);

		this.settings.bind(
			"iris-clicked-color",
			"iris_clicked_color",
			this.on_property_updated
		);

		this.settings.bind(
			"pupil-clicked-color",
			"pupil_clicked_color",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-click-image-size",
			"mouse_click_image_size",
			debounce((e) => this.on_property_updated(e), 300)
		);

		this.settings.bind(
			"mouse-click-enable",
			"mouse_click_enable",
			this.on_mouse_click_enable_updated
		);

		this.settings.bind(
			"mouse-left-click-enable",
			"mouse_left_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-right-click-enable",
			"mouse_right_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-middle-click-enable",
			"mouse_middle_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-left-click-color",
			"mouse_left_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-middle-click-color",
			"mouse_middle_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-right-click-color",
			"mouse_right_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"mouse-click-opacity",
			"mouse_click_opacity",
			debounce((e) => this.on_property_updated(e), 300)
		);
	}

	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);

		this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);
		this._setupSettings(metadata.uuid, instanceId);

		this.metadata = metadata;
		this.data_dir = this._initDataDir();
		this.img_dir = `${metadata.path}/../circle`;

		if (!Gio.File.new_for_path(this.img_dir).query_exists(null)) {
			this.img_dir = `${GLib.get_home_dir()}/.local/share/cinnamon/applets/${this.metadata.uuid}/circle`;
		}

		this.area = new St.DrawingArea();
		this.actor.add(this.area);

		this._mouseListener = Atspi.EventListener.new(this._mouseCircleClick.bind(this));

		this.setActive(true);
		this.setMouseCirclePropertyUpdate();

		this._file_mem_cache = {};
		this._last_mouse_x = undefined;
		this._last_mouse_y = undefined;
	}

	on_applet_removed_from_panel(deleteConfig) {
		this.destroy();
	}

	on_applet_clicked(event) {
		if (this.mouse_click_enable) {
			this.mouse_click_show = !this.mouse_click_show;
			this.setMouseCircleActive(this.mouse_click_show);
			this.area.queue_repaint();
		}
	}

	on_property_updated(event) {
		this.setMouseCirclePropertyUpdate();
		this.setEyePropertyUpdate();
	}

	on_mouse_click_enable_updated(event) {
		if (this.mouse_click_enable === false)
			this.mouse_click_show = false;
		this.setMouseCircleActive(this.mouse_click_show);
		this.on_property_updated(event);
		this.area.queue_repaint();
	}

	destroy() {
		this.setMouseCircleActive(false);
		this.setActive(false);
		this.area.destroy();
	}

	setActive(enabled) {
		this.setEyePropertyUpdate();

		if (this._repaint_handler) {
			this.area.disconnect(this._repaint_handler);
			this._repaint_handler = null;
		}

		if (this._eye_update_handler) {
			Mainloop.source_remove(this._eye_update_handler);
			this._eye_update_handler = null;
		}

		if (enabled) {
			this._repaint_handler = this.area.connect("repaint", this._eyeDraw.bind(this));

			this._eye_update_handler = Mainloop.timeout_add(
				this.eye_repaint_interval, this._eyeTimeout.bind(this)
			);

			this.area.queue_repaint();
		}
	}

	setMouseCirclePropertyUpdate() {
		this._mouseCircleCreateDataIcon('left_click', this.mouse_left_click_color);
		this._mouseCircleCreateDataIcon('right_click', this.mouse_right_click_color);
		this._mouseCircleCreateDataIcon('middle_click', this.mouse_middle_click_color);
	}

	setEyePropertyUpdate() {
		const margin = 2 * this.eye_margin;
		this.area.set_width(EYE_AREA_WIDTH + margin);
		this.area.set_height(EYE_AREA_HEIGHT + margin);
		this.area.queue_repaint();
	}

	setMouseCircleActive(enabled) {
		if (enabled == null) {
			enabled = this.mouse_click_show;
		}

		if (enabled) {
			this.setMouseCirclePropertyUpdate();
			this._mouseListener.register('mouse');
		} else {
			this._mouseListener.deregister('mouse');
		}
	}

	_mouseCircleCreateDataIcon(name, color) {
		let source = Gio.File.new_for_path(`${this.img_dir}/${this.mouse_click_mode}.svg`);
		let [l_success, contents] = source.load_contents(null);
		contents = contents.toString();

		// Replace to new color
		contents = contents.replace('fill="#000000"', `fill="${color}"`);

		// Save content to cache dir
		let dest = Gio.File.new_for_path(`${this.data_dir}/icons/${this.mouse_click_mode}_${name}_${color}.svg`);
		if (!dest.query_exists(null)) {
			dest.create(Gio.FileCreateFlags.NONE, null);
		}
		let [r_success, tag] = dest.replace_contents(contents, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
	}

	_clickAnimation(clickType, color) {
		let icon = this._getMouseCircleIcon(this.data_dir, this.mouse_click_mode, clickType, color);
		ClickAnimationModeFactory.createClickAnimationMode(this, "expansion").animateClick(icon);
	}

	_eyeDraw(area) {
		const foreground_color = this.area.get_theme_node().get_foreground_color();

		let options = {
			eye_color: foreground_color,
			iris_color: foreground_color,
			pupil_color: foreground_color
		};

		if (this.mouse_click_show) {
			let [ok, color] = Clutter.Color.from_string(this.eye_clicked_color);
			options.eye_color = ok ? color : options.eye_color;

			[ok, color] = Clutter.Color.from_string(this.iris_clicked_color);
			options.iris_color = ok ? color : options.iris_color;

			[ok, color] = Clutter.Color.from_string(this.pupil_clicked_color);
			options.pupil_color = ok ? color : options.pupil_color;
		}

		EyeModeFactory.createEyeMode(this, this.eye_mode).drawEye(area, options);
	}

	_mouseCircleClick(event) {
		switch (event.type) {
			case 'mouse:button:1p':
				if (this.mouse_left_click_enable)
					this._clickAnimation('left_click', this.mouse_left_click_color);
				break;
			case 'mouse:button:2p':
				if (this.mouse_middle_click_enable)
					this._clickAnimation('middle_click', this.mouse_middle_click_color);
				break;
			case 'mouse:button:3p':
				if (this.mouse_right_click_enable)
					this._clickAnimation('right_click', this.mouse_right_click_color);
				break;
		}
	}

	_eyeTimeout() {
		let [mouse_x, mouse_y, _] = global.get_pointer();

		if (mouse_x !== this._last_mouse_x || mouse_y !== this._last_mouse_y) {
			this._last_mouse_x = mouse_x;
			this._last_mouse_y = mouse_y;
			this.area.queue_repaint();
		}

		return true;
	}
}

function main(metadata, orientation, instanceId) {
	return new Eye(metadata, orientation, instanceId);
}
