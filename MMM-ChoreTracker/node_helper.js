/* MagicMirror node_helper for MMM-ChoreTracker
 * Stores chore check-off data as JSON on disk and computes
 * daily + weekly completion stats per kid.
 */

var NodeHelper = require("node_helper");
var fs = require("fs");
var path = require("path");

module.exports = NodeHelper.create({

	dataFile: path.join(__dirname, "data", "chores.json"),

	start: function () {
		console.log("Starting node_helper for: MMM-ChoreTracker");
		var dataDir = path.join(__dirname, "data");
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}
		if (!fs.existsSync(this.dataFile)) {
			fs.writeFileSync(this.dataFile, JSON.stringify({}), "utf8");
		}
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification === "CT_GET_DATA") {
			this.sendSocketNotification("CT_DATA", this.computeAll(payload.kids));
		} else if (notification === "CT_TOGGLE") {
			this.toggle(payload.kidId, payload.choreId, payload.scope);
			this.sendSocketNotification("CT_DATA", this.computeAll(payload.kids));
		}
	},

	// ---- Storage helpers ----

	readStore: function () {
		try {
			var raw = fs.readFileSync(this.dataFile, "utf8");
			return JSON.parse(raw || "{}");
		} catch (e) {
			return {};
		}
	},

	writeStore: function (store) {
		fs.writeFileSync(this.dataFile, JSON.stringify(store, null, 2), "utf8");
	},

	todayKey: function () {
		return this.dateKey(new Date());
	},

	dateKey: function (d) {
		var y = d.getFullYear();
		var m = String(d.getMonth() + 1).padStart(2, "0");
		var day = String(d.getDate()).padStart(2, "0");
		return y + "-" + m + "-" + day;
	},

	// Returns array of the 7 date keys for this calendar week, Sun..Sat
	weekKeys: function () {
		var now = new Date();
		var dow = now.getDay(); // 0 = Sunday
		var sunday = new Date(now);
		sunday.setDate(now.getDate() - dow);

		var keys = [];
		for (var i = 0; i < 7; i++) {
			var d = new Date(sunday);
			d.setDate(sunday.getDate() + i);
			keys.push(this.dateKey(d));
		}
		return keys;
	},

	toggle: function (kidId, choreId, scope) {
		var store = this.readStore();
		if (!store[kidId]) {
			store[kidId] = {};
		}

		var key = this.todayKey();
		if (!store[kidId][key]) {
			store[kidId][key] = {};
		}

		var current = !!store[kidId][key][choreId];
		store[kidId][key][choreId] = !current;

		this.writeStore(store);
	},

	// ---- Computation ----

	computeAll: function (kidsConfig) {
		var store = this.readStore();
		var result = {};
		var self = this;

		(kidsConfig || []).forEach(function (kidConfig) {
			result[kidConfig.id] = self.computeKid(kidConfig, store[kidConfig.id] || {});
		});

		return result;
	},

	computeKid: function (kidConfig, kidStore) {
		var todayKey = this.todayKey();
		var weekKeys = this.weekKeys();

		var today = kidStore[todayKey] || {};

		var dailyChores = kidConfig.dailyChores || [];
		var weeklyChores = kidConfig.weeklyChores || [];

		// Weekly chore counts: how many days this week each weekly chore was checked
		var weeklyChoreCounts = {};
		weeklyChores.forEach(function (chore) {
			var count = 0;
			weekKeys.forEach(function (dk) {
				var day = kidStore[dk] || {};
				if (day[chore.id]) {
					count++;
				}
			});
			weeklyChoreCounts[chore.id] = count;
		});

		// Total possible points this week: (daily chores * 7) + sum(timesPerWeek)
		var dailyPossible = dailyChores.length * 7;
		var weeklyPossible = weeklyChores.reduce(function (sum, c) {
			return sum + (c.timesPerWeek || 0);
		}, 0);
		var totalPossible = dailyPossible + weeklyPossible;

		// Achieved: sum of daily checks across the week + capped weekly chore counts
		var dailyAchieved = 0;
		weekKeys.forEach(function (dk) {
			var day = kidStore[dk] || {};
			dailyChores.forEach(function (chore) {
				if (day[chore.id]) {
					dailyAchieved++;
				}
			});
		});

		var weeklyAchieved = 0;
		weeklyChores.forEach(function (chore) {
			var count = weeklyChoreCounts[chore.id] || 0;
			weeklyAchieved += Math.min(count, chore.timesPerWeek || 0);
		});

		var totalAchieved = dailyAchieved + weeklyAchieved;
		var weeklyPct = totalPossible > 0 ? (totalAchieved / totalPossible) * 100 : 0;

		return {
			today: today,
			weeklyChoreCounts: weeklyChoreCounts,
			weeklyPct: weeklyPct
		};
	}
});
