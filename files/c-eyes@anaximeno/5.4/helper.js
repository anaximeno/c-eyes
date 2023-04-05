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

const Util = imports.misc.util;

class Debouncer {
    _sourceId;

    constructor() {
        this._sourceId = 0;
    }

    clearSource() {
        if (this._sourceId > 0) {
            Util.clearTimeout(this._sourceId);
            this._sourceId = 0;
        }
    }

    debounce(fn, timeout) {
        return ((...args) => {
            this.clearSource();
            this._sourceId = Util.setTimeout(() => {
                this.clearSource();
                fn.apply(this, args);
            }, timeout);
        }).bind(this);
    }
}

class Point2D {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	/**
	 * Returns the distance between this point and the given one
	 * @param {Point2D} point The point calculating the distance from
	 */
	distance_from(point) {
		return Math.sqrt(Math.pow(this.x - point.x, 2) + Math.pow(this.y - point.y, 2));
	}

    /**
	 * Returns the distance between this point and the origin at (0, 0)
     */
    distance_from_origin() {
        return this.distance_from(new Point2D(0, 0));
    }

	/**
	 * Returns the dot (inner) product between two points
	 * @param {Point2D} point The point calculating the dor prod with
	 */
    dot_prod(point) {
        return this.x * point.x + this.y * point.y;
    }

	/**
	 * Returns the angle between this point and the given one in reference to the origin (0, 0)
	 * @param {Point2D} point The point calculating the angle from
	 */
	angle_between(point) {
        const distProd = this.distance_from_origin() * point.distance_from_origin();
        return distProd > 0 ? Math.acos(this.dot_prod(point) / distProd) : 0;
    }
}