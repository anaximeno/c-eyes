/* helper.js
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

const GLib = imports.gi.GLib;

function debounce(fn, timeout, options = { priority: GLib.PRIORITY_DEFAULT }) {
    let sourceId = null;

    return function (...args) {
        const debouncedFunc = () => {
            sourceId = null;
            fn.apply(this, args);
        };

        if (sourceId) {
            GLib.Source.remove(sourceId);
        }

        sourceId = GLib.timeout_add(options.priority, timeout, debouncedFunc);
    }
}