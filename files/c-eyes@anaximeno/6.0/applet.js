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

const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const SignalManager = imports.misc.signalManager;
const { GLib, St, Clutter } = imports.gi;

const { EyeModeFactory } = require("./eyeModes.js");
const { Debouncer } = require("./helpers.js");


const UUID = "c-eyes@anaximeno";
const LOC_DIR = GLib.get_home_dir() + "/.local/share/locale";

Gettext.bindtextdomain(UUID, LOC_DIR);

function _(text) {
	let loc = Gettext.dgettext(UUID, text);
	return loc != text ? loc : window._(text);
}


class Eye extends Applet.Applet {
	constructor(metadata, orientation, panelHeight, instanceId, areaHeight, areaWidth) {
		super(orientation, panelHeight, instanceId);
		this.settings = this._setup_settings(metadata.uuid, instanceId);
		this.metadata = metadata;
		this.area_height = areaHeight;
		this.area_width = areaWidth;

		this.setAllowedLayout(Applet.AllowedLayout.BOTH);

		this.area = new St.DrawingArea();
		this.actor.add(this.area);

		this.signals = new SignalManager.SignalManager(null);
		this.signals.connect(global.screen, 'in-fullscreen-changed', this.on_fullscreen_changed, this);

		this._last_mouse_x = undefined;
		this._last_mouse_y = undefined;

		this.activated = this.activate_by_default;

		this.set_active(true);
		this.update_tooltip();
	}

	_setup_settings(uuid, instanceId) {
		const d = new Debouncer();
		const bindings = [
			{
				key: "repaint-interval",
				value: "repaint_interval",
				cb: d.debounce(e => this.set_active(true), 400),
			},
			{
				key: "repaint-angle",
				value: "repaint_angle",
				cb: null,
			},
			{
				key: "mode",
				value: "mode",
				cb: this.on_property_updated,
			},
			{
				key: "line-width",
				value: "line_width",
				cb: d.debounce(e => this.on_property_updated(e), 400),
			},
			{
				key: "margin",
				value: "margin",
				cb: d.debounce(e => this.on_property_updated(e), 400),
			},
			{
				key: "eye-clicked-color",
				value: "eye_clicked_color",
				cb: this.on_property_updated,
			},
			{
				key: "iris-clicked-color",
				value: "iris_clicked_color",
				cb: this.on_property_updated,
			},
			{
				key: "pupil-clicked-color",
				value: "pupil_clicked_color",
				cb: this.on_property_updated,
			},
			{
				key: "fill-lids-color-painting",
				value: "fill_lids_color_painting",
				cb: this.on_property_updated
			},
			{
				key: "fill-bulb-color-painting",
				value: "fill_bulb_color_painting",
				cb: this.on_property_updated
			},
			{
				key: "activate-by-default",
				value: "activate_by_default",
				cb: this.on_activated_by_default_updated,
			},
			{
				key: "deactivate-on-fullscreen",
				value: "deactivate_on_fullscreen",
				cb: null,
			},
			{
				key: "vertical-padding",
				value: "vertical_padding",
				cb: d.debounce(e => this.on_property_updated(e)),
			},
		];

		let settings = new Settings.AppletSettings(this, uuid, instanceId);

		bindings.forEach(
			s => settings.bind(
				s.key, s.value, s.cb ? (...args) => s.cb.call(this, ...args) : null
			)
		);

		return settings;
	}

	on_applet_removed_from_panel(deleteConfig) {
		this.destroy();
	}

	on_applet_clicked(event) {
		this.activated = !this.activated;
		this.area.queue_repaint();
		this.update_tooltip();
	}

	on_property_updated(event) {
		this.set_property_update();
		this.update_tooltip();
	}

	on_activated_by_default_updated(event) {
		this.on_property_updated(event);

		if (this.activate_by_default) {
			this.activated = this.activate_by_default;
			this.area.queue_repaint();
		}
	}

	on_fullscreen_changed() {
		const monitor = global.screen.get_current_monitor();
		const monitorIsInFullscreen = global.screen.get_monitor_in_fullscreen(monitor);
		const panelsInMonitor = Main.panelManager.getPanelsInMonitor(monitor);

		let panelIsInCurrentMonitor = false;
		if (panelsInMonitor !== null && panelsInMonitor !== undefined) {
			panelIsInCurrentMonitor = panelsInMonitor.includes(this.panel);
		}

		if (this.deactivate_on_fullscreen) {
			this.set_active(!monitorIsInFullscreen && panelIsInCurrentMonitor);
		}
	}

	on_refresh_timeout() {
		if (this.should_redraw())
			this.area.queue_repaint();
		return true;
	}

	destroy() {
		this.set_active(false);
		this.signals.disconnectAllSignals();
		this.area.destroy();
		this.settings.finalize();
	}

	set_active(enabled) {
		this.set_property_update();

		if (this._update_handler) {
			Mainloop.source_remove(this._update_handler);
			this._update_handler = null;
		}

		this.signals.disconnect('repaint', this.area);

		if (enabled) {
			this.signals.connect(this.area, 'repaint', this.paint_eye, this);

			this._update_handler = Mainloop.timeout_add(
				this.repaint_interval, this.on_refresh_timeout.bind(this)
			);

			this.area.queue_repaint();
		}
	}

	set_property_update() {
		this.area.set_width((this.area_width + 2 * this.margin) * global.ui_scale);
		this.area.set_height(this.area_height * global.ui_scale);
		this.area.queue_repaint();
	}

	update_tooltip() {
		let tip = this.activated ? _("click to deactivate the eye") : _("click to activate the eye");
		this.set_applet_tooltip(`<b>${_('TIP')}:</b> ` + tip, true);
	}

	get_area_position() {
		let obj = this.area;

		let area_x = 0;
		let area_y = 0;

		do {
			let pos = obj.get_position();

			if (pos) {
				let [tx, ty] = pos;

				area_x += tx;
				area_y += ty;
			}

			obj = obj.get_parent();
		} while (obj);

		return [area_x, area_y];
	}

	paint_eye(area) {
		const foreground_color = this.area.get_theme_node().get_foreground_color();
		const [mouse_x, mouse_y, _] = global.get_pointer();
		const [area_x, area_y] = this.get_area_position();

		let options = {
			area_x: area_x,
			area_y: area_y,
			mouse_x: mouse_x,
			mouse_y: mouse_y,
			eye_color: foreground_color,
			iris_color: foreground_color,
			pupil_color: foreground_color,
			is_eye_active: this.activated,
			line_width: (this.line_width * global.ui_scale),
			padding: (this.vertical_padding * global.ui_scale),
			lids_fill: this.fill_lids_color_painting,
			bulb_fill: this.fill_bulb_color_painting,
		};

		if (this.activated) {
			let [ok, color] = Clutter.Color.from_string(this.eye_clicked_color);
			options.eye_color = ok ? color : options.eye_color;

			[ok, color] = Clutter.Color.from_string(this.iris_clicked_color);
			options.iris_color = ok ? color : options.iris_color;

			[ok, color] = Clutter.Color.from_string(this.pupil_clicked_color);
			options.pupil_color = ok ? color : options.pupil_color;
		}

		EyeModeFactory.createEyeMode(this.mode).drawEye(area, options);
	}

	should_redraw() {
		const [mouse_x, mouse_y, _] = global.get_pointer();

		let should_redraw = true;
		if (this._last_mouse_x == mouse_x && this._last_mouse_y == mouse_y) {
			should_redraw = false;
		} else if (this._last_mouse_x == undefined || this._last_mouse_y == undefined) {
			should_redraw = true;
		} else {
			const dist = (x, y) => Math.sqrt(x * x + y * y);
			const [ox, oy] = this.get_area_position();
			const [last_x, last_y] = [this._last_mouse_x - ox, this._last_mouse_y - oy];
			const [current_x, current_y] = [mouse_x - ox, mouse_y - oy];
			const dist_prod = dist(last_x, last_y) * dist(current_x, current_y);

			if (dist_prod == 0) {
				should_redraw = true;
			} else {
				const dot_prod = current_x * last_x + current_y * last_y;
				const angle = Math.acos(dot_prod / dist_prod);
				should_redraw = angle >= this.repaint_angle;
			}
		}

		if (should_redraw) {
			this._last_mouse_x = mouse_x;
			this._last_mouse_y = mouse_y;
		}

		return should_redraw;
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Eye(metadata, orientation, panelHeight, instanceId, 16, 28);
}
