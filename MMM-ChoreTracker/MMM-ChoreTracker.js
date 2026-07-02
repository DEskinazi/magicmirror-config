/* global Module, Log */
/* MagicMirror Module: MMM-ChoreTracker
 * Custom household chore tracker.
 * - Parent-only checkoff (PIN required to toggle any chore)
 * - Daily chores + weekly chores with per-kid completion % vs allowance threshold
 * - Data persists on disk via node_helper.js
 */

Module.register("MMM-ChoreTracker", {

	defaults: {
		pin: "1234",              // Parent PIN required to check/uncheck any chore
		updateInterval: 60 * 1000, // Re-render clock/midnight checks every minute
		kids: []                  // Supplied in config.js — see README block in chat
	},

	requiresVersion: "2.1.0",

	start: function () {
		Log.info("Starting module: " + this.name);
		this.data_ = null;
		this.pendingToggle = null; // { kidId, choreId, scope }
		this.sendSocketNotification("CT_GET_DATA", { kids: this.config.kids });

		var self = this;
		setInterval(function () {
			self.sendSocketNotification("CT_GET_DATA", { kids: self.config.kids });
		}, this.config.updateInterval);
	},

	getStyles: function () {
		return ["MMM-ChoreTracker.css"];
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification === "CT_DATA") {
			this.data_ = payload;
			this.updateDom(300);
		}
	},

	// ---- Rendering ----

	getDom: function () {
		var wrapper = document.createElement("div");
		wrapper.className = "chore-tracker";

		if (!this.data_) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "chore-tracker dimmed light small";
			return wrapper;
		}

		var self = this;
		this.config.kids.forEach(function (kidConfig) {
			wrapper.appendChild(self.buildKidCard(kidConfig, self.data_[kidConfig.id]));
		});

		return wrapper;
	},

	buildKidCard: function (kidConfig, kidData) {
		var self = this;
		var card = document.createElement("div");
		card.className = "ct-card";

		// Header
		var header = document.createElement("div");
		header.className = "ct-header";

		var nameEl = document.createElement("span");
		nameEl.className = "ct-name bright";
		nameEl.innerHTML = kidConfig.name;
		header.appendChild(nameEl);

		var zoneEl = document.createElement("span");
		zoneEl.className = "ct-zone dimmed";
		zoneEl.innerHTML = kidConfig.zone || "";
		header.appendChild(zoneEl);

		card.appendChild(header);

		// Daily chores
		var dailyList = document.createElement("div");
		dailyList.className = "ct-list";
		(kidConfig.dailyChores || []).forEach(function (chore) {
			var checked = kidData && kidData.today && kidData.today[chore.id];
			dailyList.appendChild(self.buildChoreRow(kidConfig.id, chore.id, chore.label, checked, "daily"));
		});
		card.appendChild(dailyList);

		// Weekly chores (shown with x/target instead of a checkbox)
		if (kidConfig.weeklyChores && kidConfig.weeklyChores.length) {
			var weeklyList = document.createElement("div");
			weeklyList.className = "ct-list ct-weekly-list";

			kidConfig.weeklyChores.forEach(function (chore) {
				var count = (kidData && kidData.weeklyChoreCounts && kidData.weeklyChoreCounts[chore.id]) || 0;
				var row = document.createElement("div");
				row.className = "ct-row ct-weekly-row";
				row.setAttribute("data-kid", kidConfig.id);
				row.setAttribute("data-chore", chore.id);
				row.setAttribute("data-scope", "weekly");

				var box = document.createElement("span");
				box.className = "ct-box " + (count >= chore.timesPerWeek ? "ct-checked" : "");
				box.innerHTML = count >= chore.timesPerWeek ? "&#10003;" : "";
				row.appendChild(box);

				var label = document.createElement("span");
				label.className = "ct-label";
				label.innerHTML = chore.label + " (" + count + "/" + chore.timesPerWeek + ")";
				row.appendChild(label);

				row.addEventListener("click", function () {
					self.requestToggle(kidConfig.id, chore.id, "weekly");
				});

				weeklyList.appendChild(row);
			});
			card.appendChild(weeklyList);
		}

		// Weekly completion bar
		var pct = (kidData && typeof kidData.weeklyPct === "number") ? kidData.weeklyPct : 0;
		var threshold = kidConfig.allowanceThreshold || 0;
		var meets = pct >= threshold;

		var barWrap = document.createElement("div");
		barWrap.className = "ct-bar-wrap";

		var bar = document.createElement("div");
		bar.className = "ct-bar-bg";
		var fill = document.createElement("div");
		fill.className = "ct-bar-fill " + (meets ? "ct-meets" : "ct-under");
		fill.style.width = Math.min(pct, 100) + "%";
		bar.appendChild(fill);

		var marker = document.createElement("div");
		marker.className = "ct-bar-marker";
		marker.style.left = Math.min(threshold, 100) + "%";
		bar.appendChild(marker);

		barWrap.appendChild(bar);

		var barLabel = document.createElement("div");
		barLabel.className = "ct-bar-label small " + (meets ? "ct-meets-text" : "ct-under-text");
		var weeklyAllowance = kidConfig.weeklyAllowance || 0;
		barLabel.innerHTML = Math.round(pct) + "% this week &middot; needs " + threshold + "% &middot; $" +
			(meets ? weeklyAllowance : 0) + " of $" + weeklyAllowance;
		barWrap.appendChild(barLabel);

		card.appendChild(barWrap);

		return card;
	},

	buildChoreRow: function (kidId, choreId, label, checked, scope) {
		var self = this;
		var row = document.createElement("div");
		row.className = "ct-row";
		row.setAttribute("data-kid", kidId);
		row.setAttribute("data-chore", choreId);
		row.setAttribute("data-scope", scope);

		var box = document.createElement("span");
		box.className = "ct-box " + (checked ? "ct-checked" : "");
		box.innerHTML = checked ? "&#10003;" : "";
		row.appendChild(box);

		var labelEl = document.createElement("span");
		labelEl.className = "ct-label";
		labelEl.innerHTML = label;
		row.appendChild(labelEl);

		row.addEventListener("click", function () {
			self.requestToggle(kidId, choreId, scope);
		});

		return row;
	},

	// ---- PIN-gated toggle ----

	requestToggle: function (kidId, choreId, scope) {
		this.pendingToggle = { kidId: kidId, choreId: choreId, scope: scope };
		this.showPinModal();
	},

	showPinModal: function () {
		var self = this;
		this.removePinModal();

		var overlay = document.createElement("div");
		overlay.id = "ct-pin-overlay";
		overlay.className = "ct-pin-overlay";

		var modal = document.createElement("div");
		modal.className = "ct-pin-modal";

		var title = document.createElement("div");
		title.className = "ct-pin-title";
		title.innerHTML = "Parent PIN";
		modal.appendChild(title);

		var display = document.createElement("div");
		display.className = "ct-pin-display";
		display.id = "ct-pin-display";
		modal.appendChild(display);

		var entered = "";

		var pad = document.createElement("div");
		pad.className = "ct-pin-pad";
		["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].forEach(function (key) {
			var btn = document.createElement("div");
			btn.className = "ct-pin-key";
			btn.innerHTML = key;
			btn.addEventListener("click", function () {
				if (key === "C") {
					entered = "";
				} else if (key === "OK") {
					if (entered === self.config.pin) {
						self.confirmToggle();
					} else {
						display.innerHTML = "Wrong PIN";
						entered = "";
						setTimeout(function () { display.innerHTML = ""; }, 900);
						return;
					}
				} else {
					entered = (entered + key).slice(0, 6);
				}
				display.innerHTML = entered.replace(/./g, "&#9679; ");
			});
			pad.appendChild(btn);
		});
		modal.appendChild(pad);

		var cancel = document.createElement("div");
		cancel.className = "ct-pin-cancel";
		cancel.innerHTML = "Cancel";
		cancel.addEventListener("click", function () {
			self.pendingToggle = null;
			self.removePinModal();
		});
		modal.appendChild(cancel);

		overlay.appendChild(modal);
		document.body.appendChild(overlay);
	},

	removePinModal: function () {
		var existing = document.getElementById("ct-pin-overlay");
		if (existing) {
			existing.parentNode.removeChild(existing);
		}
	},

	confirmToggle: function () {
		if (this.pendingToggle) {
			this.sendSocketNotification("CT_TOGGLE", {
				kids: this.config.kids,
				kidId: this.pendingToggle.kidId,
				choreId: this.pendingToggle.choreId,
				scope: this.pendingToggle.scope
			});
		}
		this.pendingToggle = null;
		this.removePinModal();
	}
});
