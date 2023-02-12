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
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Tweener = imports.ui.tweener;

const Gettext = imports.gettext;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const { Atspi, Clutter, GLib, Gio, St, Gdk } = imports.gi;

const Keymap = Gdk.Keymap.get_for_display(Gdk.Display.get_default());
const { debounce } = require("./helper.js");

const UUID = "c-eyes@anaximeno"; // used for translations; must keep in sync with metadata.uuid !
const EYE_AREA_WIDTH = 34;
const EYE_AREA_HEIGHT = 16;

const MBL = _("left");
const MBM = _("middle");
const MBR = _("right");
const BTN = _("button");
const BTNS = _("buttons");
const NOBTNS = _("no buttons");
const HINT = _("(Press <b>Ctrl</b> to temporarily\ndisable pointer tracker)");
const HINTOFF = _("(<b>Ctrl</b>/<b>Shift</b>/<b>Ctrl</b>+<b>Shift</b> + <b>click</b>\nto toggle tracker functions)");
const CTRK = _("Click tracker is");
const PTRK = _("Pointer tracker is");
const ILOC = _("Idle locator is");
const ENA = _("enabled"); // singular, according to CTRK/PTRK/ILOC gender, if any
const DISS = _("disabled"); // idem above
const FOR = _("for");
const AMTRK = _("<b>All</b> mouse tracking <b>disabled</b>");

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
	let locText = Gettext.dgettext(UUID, text);
	if (locText == text) {
		locText = window._(text);
	}
	return locText;
}

// Class to create the Eye
class Eye extends Applet.Applet {
	_get_icon(dir, mode, click_type) {
		let color = this[click_type + '_color'];
		let key = `${dir}${mode}${click_type}${color}`;
		let path = `${dir}/icons/${mode}_${click_type}_${color}.svg`;

		if (this._file_mem_cache[key]) {
			return this._file_mem_cache[key];
		}

		this._file_mem_cache[key] = Gio.icon_new_for_string(path);
		if (!Gio.File.new_for_path(path).query_exists(null)) {
			this._file_mem_cache[key] = null;
			global.logError("Error creating icon for: " + path);
		}

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
/* EYE PAGE - General Configuration */
		this.settings.bind(
			"eye-mode",
			"eye_mode",
			this.on_property_updated
		);

		this.settings.bind(
			"eye-line-width",
			"eye_line_width",
			debounce((e) => this.on_property_updated(e), 200)
		);

		this.settings.bind(
			"eye-margin",
			"eye_margin",
			debounce((e) => this.on_property_updated(e), 200)
		);

		this.settings.bind(
			"eye-repaint-interval",
			"eye_repaint_interval",
			debounce((e) => this.setActive(true), 200)
		);
/* EYE- Events */
		this.settings.bind(
			"start-mode",
			"start_mode",
			null
		);
/* EYE - Colors */
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
/* CLICK TRACKER PAGE - Generic */
		this.settings.bind(
			"click-enable",
			"click_enable",
			this.on_click_enable_updated
		);

		this.settings.bind(
			"click-image",
			"click_image",
			this.on_property_updated
		);

		this.settings.bind(
			"click-tween-mode",
			"click_tween_mode",
			null
		);

		this.settings.bind(
			"click-min-size",
			"click_min_size",
			debounce((e) => this.on_property_updated(e), 200)
		);
		this.settings.bind(
			"click-image-size",
			"click_image_size",
			debounce((e) => this.on_property_updated(e), 200)
		);
/* CLICK TRACKER - Events */
		this.settings.bind(
			"left-click-enable",
			"left_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"right-click-enable",
			"right_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"middle-click-enable",
			"middle_click_enable",
			this.on_property_updated
		);

		this.settings.bind(
			"click-duration",
			"click_duration",
			debounce((e) => this.on_property_updated(e), 200)
		);
/* CLICK TRACKER - Colors */
		this.settings.bind(
			"left-click-color",
			"left_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"middle-click-color",
			"middle_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"right-click-color",
			"right_click_color",
			this.on_property_updated
		);

		this.settings.bind(
			"click-opacity",
			"click_opacity",
			debounce((e) => this.on_property_updated(e), 200)
		);
/* POINTER TRACKER PAGE - Generic */
		this.settings.bind(
			"pointer-enable",
			"pointer_enable",
			this.on_pointer_enable_updated
		);

		this.settings.bind(
			"pointer-image",
			"pointer_image",
			this.on_property_updated
		);

		this.settings.bind(
			"pointer-image-size",
			"pointer_image_size",
			debounce((e) => this.on_property_updated(e), 200)
		);
/* POINTER TRACKER- Events */
		this.settings.bind(
			"pointer-repaint-interval",
			"pointer_repaint_interval",
			debounce((e) => this.setPointerActive(null), 200)
		);
/* POINTER TRACKER- Colors */
		this.settings.bind(
			"pointer-color",
			"pointer_color",
			this.on_property_updated
		);

		this.settings.bind(
			"pointer-opacity",
			"pointer_opacity",
			debounce((e) => this.on_property_updated(e), 200)
		);
/* IDLE TRACKER PAGE - Generic */
		this.settings.bind(
			"idle-enable",
			"idle_enable",
			this.on_idle_enable_updated
		);

		this.settings.bind(
			"idle-image",
			"idle_image",
			this.on_property_updated
		);

		this.settings.bind(
			"idle-tween-mode",
			"idle_tween_mode",
			null
		);

		this.settings.bind(
			"idle-image-size",
			"idle_image_size",
			debounce((e) => this.on_property_updated(e), 200)
		);
/* IDLE TRACKER - Events */
		this.settings.bind(
			"idle-delay",
			"idle_delay",
			null
		);

		this.settings.bind(
			"idle-duration",
			"idle_duration",
			null
		);

		this.settings.bind(
			"idle-frequency",
			"idle_frequency",
			null
		);
/* IDLE TRACKER - Colors */
		this.settings.bind(
			"idle-color",
			"idle_color",
			this.on_property_updated
		);

		this.settings.bind(
			"idle-opacity",
			"idle_opacity",
			debounce((e) => this.on_property_updated(e), 200)
		);
/* PRIVATE SETTINGS */
		this.settings.bind(
			"mouse-enable",
			"mouse_enable",
			this.on_property_updated
		);
	}

	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);

		this.setAllowedLayout(Applet.AllowedLayout.BOTH);
		this._setupSettings(metadata.uuid, instanceId);

		this.metadata = metadata;
		this.data_dir = this._initDataDir();
		this.img_dir = `${metadata.path}/../circle`;

		if (!Gio.File.new_for_path(this.img_dir).query_exists(null)) {
			this.img_dir = `${GLib.get_home_dir()}/.local/share/cinnamon/applets/${this.metadata.uuid}/circle`;
		}
		this.area = new St.DrawingArea();
		this.actor.add(this.area);
//		Atspi.init();
		this.lastState = 0; this.track_hide = false;
		this._kbdState = Keymap.connect('state-changed', (e) => this._onKey(e));
		global.screen.connect('in-fullscreen-changed', () => this._onFSChange());
		this._mouseListener = Atspi.EventListener.new(this._mouseEvents.bind(this));
		this._mouseListener.synchronous=true;
		this._mouseListener.preeemptive=true;
		this._mouseListener.register('mouse');

		this.idle_timeout = this.idle_repeat = null;
		this.setActive(true);
		this.setClickPropertyUpdate();
		this.setPointerPropertyUpdate();
		this.setIdlePropertyUpdate();

		this._file_mem_cache = {};
		this._last_mouse_x_pos = undefined;
		this._last_mouse_y_pos = undefined;
		[this._mx, this._my] = global.get_pointer();
		if (this.start_mode < 2) this.mouse_enable = !!this.start_mode;
		this.toggle(this.mouse_enable);
		this._applet_tooltip._tooltip.set_style("text-align: left;");
		this.setTooltip();
	}

	_onFSChange() {
		let mIdx = global.screen.get_current_monitor();
		this.state = global.screen.get_monitor_in_fullscreen(mIdx);
		if (this.state) {
			this._killTween();
			this.lastState = this.idle_enable;
			this.idle_enable = false;
			this.on_idle_enable_updated(true);
		} else {
			this.idle_enable = this.lastState;
			this.on_idle_enable_updated(true);
		}
	}

	on_applet_removed_from_panel(deleteConfig) {
		this.destroy();
	}

	on_applet_reloaded(deleteConfig) {
		this._file_mem_cache = {};
		this._last_mouse_x_pos = undefined;
		this._last_mouse_y_pos = undefined;
	}

	on_applet_clicked(event) {
		let mod = event.get_state() & 5;	// test for <Shift>(1)/<Ctrl>(4) down
		if (mod==1) {						// Shift+click => toggle click tracker
			this.click_enable = !this.click_enable;
			this.on_click_enable_updated(event);
		} else if (mod==4) {				// Ctrl+click => toggle pointer tracker
			this.pointer_enable = !this.pointer_enable;
			this.on_pointer_enable_updated(event);
		} else if (mod==5) {				// Ctrl+Shift+click => toggle idle tracker
			this.idle_enable = !this.idle_enable;
			this.on_idle_enable_updated(event);
		}
		if ((mod!=0 && !this.mouse_enable) ||
			(mod==0 && (this.click_enable || this.pointer_enable || this.idle_enable))) {
			this.mouse_enable = !this.mouse_enable;
			this.toggle(this.mouse_enable);
		} else if (!(this.click_enable || this.pointer_enable || this.idle_enable)) {
			this.mouse_enable = false;
			this.toggle(this.mouse_enable);
		}
		this.setTooltip(true);
	}
// This one may be more convenient for quick toggling the idle locator state
	on_applet_middle_clicked(event) {
		if (this.mouse_enable) {
			this.idle_enable = !this.idle_enable;
			this.on_idle_enable_updated(event);
		}
	}

	on_property_updated(event) {
		this._killTween();
		this.setClickPropertyUpdate();
		this.setPointerPropertyUpdate();
		this.setIdlePropertyUpdate();
		this.setEyePropertyUpdate();
		this.setTooltip();
	}

	on_click_enable_updated(event) {
		this._killTween();
		this.click_show = this.click_enable && this.mouse_enable;
		this.setClickActive(this.click_show);
		this.setClickPropertyUpdate();
		this.setTooltip();
	}

	on_pointer_enable_updated(event) {
		this._killTween();
		this.pointer_show = this.pointer_enable && this.mouse_enable;
		this.setPointerActive(this.pointer_show);
		this.setPointerPropertyUpdate();
		this.setTooltip();
	}

	on_idle_enable_updated(event) {
		this._killTween();
		this.idle_show = this.idle_enable && this.mouse_enable;
		this.setIdleActive(this.idle_show);
		this.setIdlePropertyUpdate();
		this.setTooltip();
	}

	destroy() {
		this.settings.finalize();
		this._mouseListener.deregister('mouse');
		this.setIdleActive(false);
		this.setPointerActive(false);
		this.setClickActive(false);
		this.setActive(false);
		this.area.destroy();
//		Atspi.exit();
	}

	setActive(enabled) {
		this._killTween();
		this.setEyePropertyUpdate();

		if (this._repaint_handler) {
			this.area.disconnect(this._repaint_handler);
			this._repaint_handler = null;
		}

		if (this._mouse_circle_update_handler) {
			Mainloop.source_remove(this._mouse_circle_update_handler);
			this._mouse_circle_update_handler = null;
		}

		if (enabled) {
			this._repaint_handler = this.area.connect("repaint", this._eyeDraw.bind(this));
			this.area.queue_repaint();
		}
	}

	_CreateDataIcon(name, img) {
		let source = Gio.File.new_for_path(`${this.img_dir}/${img}.svg`);
		let [l_success, contents] = source.load_contents(null);
		contents = contents.toString();
		let color = this[name + '_color'];
		// Replace to new color
		contents = contents.replace('fill="#000000"', `fill="${color}"`);

		// Save content to cache dir
		let dest = Gio.File.new_for_path(`${this.data_dir}/icons/${img}_${name}_${color}.svg`);
		if (!dest.query_exists(null)) {
			dest.create(Gio.FileCreateFlags.NONE, null);
		}
		let [r_success, tag] = dest.replace_contents(contents, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
	}

	_mouseCircleTimeout(event=false) {
		if (this.t) {
			Util.clearTimeout(this.t);
			this.t = null;
		}
		while (this.event) {
			if (this.idle_show)
				this._idleTimeout();
			this.event = false;
		}
		return true;
	}

	_idleTimeout() {
		if (!this.idle_show) { this._killTween(); return; }
		if (this._killIdle()) {
			if (this.circle_actor)
				this._killTween();
		}
		this.idle_timeout = Util.setTimeout(() => this._idleRepeat(), this.idle_delay*1000);
	}

	_idleRepeat() {
		Util.clearTimeout(this.idle_timeout);
		this.idle_timeout = null;
		let time = this.idle_duration + this.idle_frequency*1000;
		this.idle_repeat = Util.setInterval(() => this._clickAnimation('idle'), time);
	}

	_killIdle() {
		if (this.idle_timeout) {
			Util.clearTimeout(this.idle_timeout);
			this.idle_timeout = null;
		}
		if (this.idle_repeat) {
			Util.clearInterval(this.idle_repeat);
			this.idle_repeat = null;
			return true;
		}
		return false;
	}

	_killTween() {
		this._killIdle();
		if (this.circle_actor) {
			Tweener.removeTweens(this.circle_actor);
			Main.uiGroup.remove_child(this.circle_actor);
			this.circle_actor.destroy();
			this.circle_actor = null;
		}
	}

	_clickAnimation(click_type) {
		if (click_type != 'idle' && this.circle_actor) {
//			this._killTween();
			Tweener.removeTweens(this.circle_actor);
			Main.uiGroup.remove_child(this.circle_actor);
			this.circle_actor.destroy();
		}
		let imgsz = click_type === 'idle' ? this.idle_image_size : this.click_image_size;
		let p = click_type === 'idle' ? 2 : 1; let sz = this.click_min_size;
		let actor_scale = (imgsz > 20 ? 1.5*p : 3*p)*(imgsz/sz);
		let img = click_type === 'idle' ? this.idle_image : this.click_image;
		let icon = this._get_icon(this.data_dir, img, click_type);

		if (this.mouse_pointer)
			this.mouse_pointer.hide();
		this.circle_actor = new St.Icon({
			x: this._mx - (click_type === 'idle' ? imgsz / 2 : sz/2),
			y: this._my - (click_type === 'idle' ? imgsz / 2 : sz/2),
			reactive: false,
			can_focus: false,
			hover: false,
			track_hover: false,
			icon_size: click_type === 'idle' ? imgsz : sz,
			opacity: click_type === 'idle' ? this.idle_opacity : this.click_opacity,
			gicon: icon
		});

		Main.uiGroup.add_child(this.circle_actor);

		Tweener.addTween(this.circle_actor,
			{
				x: click_type === 'idle' ? this._mx : this._mx - (imgsz * actor_scale / 2),
				y: click_type === 'idle' ? this._my : this._my - (imgsz * actor_scale / 2),
				x: click_type === 'idle' ? this._mx : this._mx - (sz * actor_scale / 2),
				y: click_type === 'idle' ? this._my : this._my - (sz * actor_scale / 2),
				scale_x: click_type === 'idle' ? 0 : actor_scale,
				scale_y: click_type === 'idle' ? 0 : actor_scale,
				opacity: click_type === 'idle' ? this.idle_opacity/2 : 10,
				time: (click_type === 'idle' ? this.idle_duration : this.click_duration) / 1000,
				transition: click_type === 'idle' ? this.idle_tween_mode : this.click_tween_mode,
				onComplete: function () {
					Main.uiGroup.remove_child(this.circle_actor);
					this.circle_actor.destroy();
					this.circle_actor = null;

					if (this.mouse_pointer && this.pointer_show && !this.idle_repeat)
						this.st = Util.setTimeout(() => this._delay(this.pointer_show), 10);
				},
				onCompleteScope: this
		});
		return true;
	}

	_mouseEvents(event) {
		this.event = true;
		if (this.mouse_pointer) this.mouse_pointer.hide();
		switch (event.type) {
			case 'mouse:abs':
				this._mx = event.detail1; this._my = event.detail2;
				if (this._mx != this._last_mouse_x_pos || this._my != this._last_mouse_y_pos)
					this.area.queue_repaint();
				this._last_mouse_x_pos = this._mx; this._last_mouse_y_pos = this._my;
				if (this.mouse_pointer) {
					this.mouse_pointer.set_position(
						this._mx - (this.pointer_image_size / 2),
						this._my - (this.pointer_image_size / 2)
					);
					if (this.pointer_show)
						this.st = Util.setTimeout(() => this._delay(this.pointer_show), 1);
				}
				break;
			case 'mouse:button:1p':
				if (this.click_show && this.left_click_enable)
					this.c = Util.setTimeout(() => this._doClick('left_click'), 1);
				break;
			case 'mouse:button:2p':
				if (this.click_show && this.middle_click_enable)
					this.c = Util.setTimeout(() => this._doClick('middle_click'), 1);
				break;
			case 'mouse:button:3r':
				if (this.click_show && this.right_click_enable)
					this.c = Util.setTimeout(() => this._doClick('right_click'), 1);
				break;
			default:
				if (this.pointer_show && !this.track_hide) this.mouse_pointer.show();
				break;
		}
	}

	_doClick(type) {
		if (this.c) { Util.clearTimeout(this.c); this.c = null; }
		this._clickAnimation(type);
	}

	_delay(show) {
		Util.clearTimeout(this.st); this.st = null;
		if (!show || this.track_hide === true) return;
		this.mouse_pointer.show();
	}

	_onKey(event) {
// This function reacts to ALL modifier keys.
// Caps=2, Num=16, Scroll=32 | Shift=1, Ctrl=4, Alt=8, Win=64, AltGr=128
		let m = event.get_modifier_state();
		if (((m & 201) != 0) || (this.lastState === m)) return false;
		this.lastState = m;
		this.track_hide = ((m&4) != 0) ? true : false;
		if (this.circle_actor)
			this._killTween();
		if (this.pointer_show) {
			if (!this.track_hide) this.mouse_pointer.show();
			else this.mouse_pointer.hide();
		}
	}

	setClickPropertyUpdate() {
		this._CreateDataIcon('left_click', this.click_image);
		this._CreateDataIcon('right_click', this.click_image);
		this._CreateDataIcon('middle_click', this.click_image);
	}

	setPointerPropertyUpdate() {
		this._CreateDataIcon('pointer', this.pointer_image);
		if (this.mouse_pointer) {
			this.mouse_pointer.icon_size = this.pointer_image_size;
			this.mouse_pointer.opacity = this.pointer_opacity;
			this.mouse_pointer.gicon = this._get_icon(
				this.data_dir, this.pointer_image, 'pointer');
			if (this.pointer_show) this.mouse_pointer.show();
		}
	}

	setIdlePropertyUpdate() {
		this._CreateDataIcon('idle', this.idle_image);
	}

	setEyePropertyUpdate() {
		const margin = 2 * this.eye_margin;
		this.area.set_width(EYE_AREA_WIDTH + margin);
		this.area.set_height(EYE_AREA_HEIGHT + margin);
		this.area.queue_repaint();
	}

	setClickActive(enabled) {
		if (enabled == null)
			enabled = this.click_show;

		if (enabled)
			this.setClickPropertyUpdate();
	}

	setPointerActive(enabled) {
		if (enabled == null)
			enabled = this.pointer_show;

		if (!this._mouse_circle_update_handler)
			this._mouse_circle_update_handler = Util.setInterval(
				() => this._mouseCircleTimeout(), this.pointer_repaint_interval);

		if (enabled) {
			if (this.mouse_pointer) {
				Main.uiGroup.remove_child(this.mouse_pointer);
				this.mouse_pointer.destroy();
			}

			this.mouse_pointer = new St.Icon({
				reactive: false,
				can_focus: false,
				hover: false,
				track_hover: false,
				icon_size: this.pointer_image_size,
				opacity: this.pointer_opacity,
				gicon: this._get_icon(this.data_dir,
					this.pointer_image, 'pointer')
			});
			Main.uiGroup.add_child(this.mouse_pointer);
			this.mouse_pointer.set_important(false);

			this.setPointerPropertyUpdate();
			this._mouseCircleTimeout();
			this.mouse_pointer.set_position(
				this._mx - (this.pointer_image_size / 2),
				this._my - (this.pointer_image_size / 2)
			);
			if (this.pointer_show) this.mouse_pointer.show();
		} else {
			if (this.mouse_pointer) {
				Main.uiGroup.remove_child(this.mouse_pointer);
				this.mouse_pointer.destroy();
				this.mouse_pointer = null;
			}
			this._killIdle();
		}
	}

	setIdleActive(enabled) {
		if (enabled == null)
			enabled = this.idle_show;

		if (enabled) {
			this._idleTimeout();
		} else {
			if (this.idle_repeat) this._killTween();
			else this._killIdle();
		}
	}

	toggle(mode) {
		this.click_show = mode && this.click_enable;
		this.pointer_show = mode && this.pointer_enable;
		this.idle_show = mode && this.idle_enable;
		this.setClickActive(this.click_show);
		this.setPointerActive(this.pointer_show);
		this.setIdleActive(this.idle_show);
		this.area.queue_repaint();
	}

	setTooltip(show=false) {
		let b = "• "; // bullet char U+2022
		let c1 = this.left_click_enable ? `<b>${MBL}</b>` : "";
		let c2 = this.middle_click_enable ? (c1 ? ", " : "") + `<b>${MBM}</b>` : "";
		let c3 = this.right_click_enable ? (c1 || c2 ? ", " : "") + `<b>${MBR}</b>` : "";
		let bpl = (c1 && c2) || (c1 && c3) || (c2 && c3) ? ` ${BTNS}` : ` ${BTN}`;
		let p = `${c1}${c2}${c3}` == "" ? NOBTNS : bpl;
		let hint = this.pointer_show ? `\n\n<i>${HINT}</i>` : "", hint2 = `<i>${HINTOFF}</i>`;
		let mc = CTRK + (this.click_show ?
			` <b>${ENA}</b> ${FOR}:\n\t${c1}${c2}${c3}${p}` : ` <b>${DISS}</b>`);
		let ml = PTRK + (this.pointer_show ?
			` <b>${ENA}</b>` : ` <b>${DISS}</b>`);
		let mi = ILOC + (this.idle_show ?
			` <b>${ENA}</b>` : ` <b>${DISS}</b>`);
		let ttmsg = !this.mouse_enable ?
			`${AMTRK}\n\n${hint2}` : `${b}${mc}\n${b}${ml}\n${b}${mi}${hint}`;
		this._applet_tooltip._tooltip.get_clutter_text().set_markup(ttmsg);
		this._applet_tooltip._tooltip.clutter_text.set_markup(ttmsg); // yes, it has to be duplicated!
		if (!this.state && show)
			this.tt = Util.setTimeout(() => this.showTooltip(true), 300);
	}

	showTooltip(visible) {
		if (this.tt) { Util.clearTimeout(this.tt); this.tt = null; }
		if (visible === true) {
			this._applet_tooltip._tooltip.show();
		} else this.tt = Util.setTimeout(() => this.hideTooltip(), 10);
	}

	hideTooltip() {
		if (this.tt) { Util.clearTimeout(this.tt); this.tt = null; }
		this._applet_tooltip._tooltip.hide();
	}

	_eyeDraw(area) {
		let get_pos = function (self) {
			let area_x = 0;
			let area_y = 0;

			let obj = self.area;
			do {
				let tx = 0;
				let ty = 0;
				try {
					[tx, ty] = obj.get_position();
				} catch (e) {
				}
				area_x += tx;
				area_y += ty;
				obj = obj.get_parent();
			}
			while (obj);

			return [area_x, area_y];
		};

		let [area_width, area_height] = area.get_surface_size();
		let [area_x, area_y] = get_pos(this);
		area_x += area_width / 2;
		area_y += area_height / 2;

		let [mouse_x, mouse_y, mask] = global.get_pointer();
		mouse_x -= area_x;
		mouse_y -= area_y;

		let mouse_ang = Math.atan2(mouse_y, mouse_x);
		let mouse_rad = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);

		let eye_rad;
		let iris_rad;
		let pupil_rad;
		let max_rad;

		if (this.eye_mode === "bulb") {
			eye_rad = (area_height) / 2.3;
			iris_rad = eye_rad * 0.6;
			pupil_rad = iris_rad * 0.4;

			max_rad = eye_rad * Math.cos(Math.asin((iris_rad) / eye_rad)) - this.eye_line_width;
		} else if (this.eye_mode === "lids") {
			eye_rad = (area_height) / 2;
			iris_rad = eye_rad * 0.5;
			pupil_rad = iris_rad * 0.4;

			max_rad = eye_rad * (Math.pow(Math.cos(mouse_ang), 4) * 0.5 + 0.25)
		}

		if (mouse_rad > max_rad)
			mouse_rad = max_rad;

		let iris_arc = Math.asin(iris_rad / eye_rad);
		let iris_r = eye_rad * Math.cos(iris_arc);

		let eye_ang = Math.atan(mouse_rad / iris_r);

		let cr = area.get_context();
		let theme_node = this.area.get_theme_node();

		if (this.mouse_enable) {
			let [ok, color] = Clutter.Color.from_string(this.eye_clicked_color);
			Clutter.cairo_set_source_color(cr, ok ? color : theme_node.get_foreground_color());
		} else {
			Clutter.cairo_set_source_color(cr, theme_node.get_foreground_color());
		}

		cr.translate(area_width * 0.5, area_height * 0.5);
		cr.setLineWidth(this.eye_line_width);

		if (this.eye_mode === "bulb") {
			cr.arc(0, 0, eye_rad, 0, 2 * Math.PI);
			this.mouse_enable ? cr.fill() : cr.stroke();
		} else if (this.eye_mode === "lids") {
			let x_def = iris_rad * Math.cos(mouse_ang) * (Math.sin(eye_ang));
			let y_def = iris_rad * Math.sin(mouse_ang) * (Math.sin(eye_ang));
			let amp;

			let top_lid = 0.8;
			let bottom_lid = 0.6;

			amp = eye_rad * top_lid;
			cr.moveTo(-eye_rad, 0);
			cr.curveTo(x_def - iris_rad, y_def + amp,
				x_def + iris_rad, y_def + amp, eye_rad, 0);

			amp = eye_rad * bottom_lid;
			cr.curveTo(x_def + iris_rad, y_def - amp,
				x_def - iris_rad, y_def - amp, -eye_rad, 0);
			this.mouse_enable ? cr.fill() : cr.stroke();

			amp = eye_rad * top_lid;
			cr.moveTo(-eye_rad, 0);
			cr.curveTo(x_def - iris_rad, y_def + amp,
				x_def + iris_rad, y_def + amp, eye_rad, 0);

			amp = eye_rad * bottom_lid;
			cr.curveTo(x_def + iris_rad, y_def - amp,
				x_def - iris_rad, y_def - amp, -eye_rad, 0);
			cr.clip();
		}

		cr.rotate(mouse_ang);
		cr.setLineWidth(this.eye_line_width / iris_rad);

		if (this.mouse_enable) {
			let [ok, color] = Clutter.Color.from_string(this.iris_clicked_color);
			Clutter.cairo_set_source_color(cr, ok ? color : theme_node.get_foreground_color());
		}

		cr.translate(iris_r * Math.sin(eye_ang), 0);
		cr.scale(iris_rad * Math.cos(eye_ang), iris_rad);
		cr.arc(0, 0, 1.0, 0, 2 * Math.PI);
		this.mouse_enable ? cr.fill() : cr.stroke();
		cr.scale(1 / (iris_rad * Math.cos(eye_ang)), 1 / iris_rad);
		cr.translate(-iris_r * Math.sin(eye_ang), 0);

		if (this.mouse_enable) {
			let [ok, color] = Clutter.Color.from_string(this.pupil_clicked_color);
			Clutter.cairo_set_source_color(cr, ok ? color : theme_node.get_foreground_color());
		}

		cr.translate(eye_rad * Math.sin(eye_ang), 0);
		cr.scale(pupil_rad * Math.cos(eye_ang), pupil_rad);
		cr.arc(0, 0, 1.0, 0, 2 * Math.PI);
		cr.fill();

		cr.save();
		cr.restore();
		cr.$dispose();
	}
}

function main(metadata, orientation, instanceId) {
	return new Eye(metadata, orientation, instanceId);
}
