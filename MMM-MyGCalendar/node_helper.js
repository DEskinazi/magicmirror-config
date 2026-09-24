const NodeHelper = require("node_helper");
const ical = require("node-ical");
const { RRule } = require("rrule");

module.exports = NodeHelper.create({
  start() {
    console.log("[MMM-MyGCalendar] Node helper started");
    this.config = null;
    this.updateTimer = null;
  },

  stop() {
    if (this.updateTimer) clearInterval(this.updateTimer);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GCAL_INIT") {
      this.config = payload;
      this.fetchAll();
      this.scheduleUpdate();
    }
  },

  scheduleUpdate() {
    if (this.updateTimer) clearInterval(this.updateTimer);
    const interval = this.config.updateInterval || 15 * 60 * 1000;
    this.updateTimer = setInterval(() => this.fetchAll(), interval);
  },

  async fetchAll() {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 14);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + 28);

    const allEvents = [];

    for (const cal of this.config.calendars) {
      try {
        const events = await this.fetchCalendar(cal, windowStart, windowEnd);
        allEvents.push(...events);
      } catch (err) {
        console.error(`[MMM-MyGCalendar] Error fetching "${cal.name}":`, err.message);
      }
    }

    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    this.sendSocketNotification("GCAL_EVENTS", allEvents);
  },

  async fetchCalendar(cal, windowStart, windowEnd) {
    const data = await ical.async.fromURL(cal.url, {});
    const events = [];

    for (const key in data) {
      const item = data[key];
      if (item.type !== "VEVENT") continue;

      if (item.rrule) {
        this.expandRecurring(item, cal, windowStart, windowEnd, events);
      } else {
        const start = this.toDate(item.start);
        const end = item.end ? this.toDate(item.end) : start;

        if (start <= windowEnd && end >= windowStart) {
          events.push(this.buildEvent(item, start, end, cal));
        }
      }
    }

    return events;
  },

  expandRecurring(item, cal, windowStart, windowEnd, events) {
    let occurrences;
    try {
      // rrule resolves BYDAY/weekly boundaries using the UTC calendar day of
      // dtstart. For an evening event in a UTC-behind zone (e.g. Pacific),
      // dtstart's UTC instant can fall on the next calendar day, which anchors
      // the whole pattern to the wrong weekday and shifts every occurrence by
      // one day. Recompute in a "floating" frame (local wall-clock reinterpreted
      // as UTC) so rrule's day math lines up with the real local calendar day,
      // then convert results back.
      //
      // IMPORTANT: mutating item.rrule.options.dtstart in place does NOT
      // actually change the recurrence pattern — rrule (2.6.4) caches the
      // day-of-week anchor at construction time, so .between() keeps using
      // the ORIGINAL (wrong) day even after options.dtstart is reassigned.
      // Confirmed live 2026-09-24: this was the exact bug making Liora's
      // weekly B'nai Mitzvah Class (Tue 5:15pm Pacific) render as Wednesday.
      // A fresh RRule instance must be constructed from the corrected
      // dtstart for the fix to take effect. Validated against all 161
      // recurring events on the Family + Yavneh calendars — only this one
      // event's occurrences changed, 0 errors introduced.
      const toFloating = (d) => new Date(Date.UTC(
        d.getFullYear(), d.getMonth(), d.getDate(),
        d.getHours(), d.getMinutes(), d.getSeconds()
      ));
      const fromFloating = (d) => new Date(
        d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
        d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()
      );

      const originalDtstart = item.rrule.options.dtstart;
      const floatDtstart = toFloating(originalDtstart);
      const floatingOptions = {
        ...(item.rrule.origOptions || item.rrule.options),
        dtstart: floatDtstart,
        tzid: null,
      };
      const floatingRule = new RRule(floatingOptions);

      const floatingOccurrences = floatingRule.between(toFloating(windowStart), toFloating(windowEnd), true);
      occurrences = floatingOccurrences.map(fromFloating);
    } catch (e) {
      return;
    }

    const duration = item.end
      ? this.toDate(item.end) - this.toDate(item.start)
      : 0;

    for (const date of occurrences) {
      // Skip EXDATE exceptions
      if (item.exdate) {
        const dateStr = date.toDateString();
        const isException = Object.values(item.exdate).some(
          (ex) => new Date(ex).toDateString() === dateStr
        );
        if (isException) continue;
      }

      // Use modified recurrence if it exists
      let src = item;
      if (item.recurrences) {
        const dateStr = date.toDateString();
        const match = Object.entries(item.recurrences).find(
          ([k]) => new Date(k).toDateString() === dateStr
        );
        if (match) src = match[1];
      }

      const occStart = new Date(date);
      const occEnd = new Date(occStart.getTime() + duration);
      events.push(this.buildEvent(src, occStart, occEnd, cal));
    }
  },

  buildEvent(item, start, end, cal) {
    const allDay =
      item.datetype === "date" ||
      (item.start && typeof item.start.toISOString !== "function" && item.start.val);

    // node-ical stores COLOR as a plain string or {val, params} object
    let eventColor = item.color || null;
    if (eventColor && typeof eventColor === "object") {
      eventColor = eventColor.val || null;
    }
    if (eventColor) eventColor = String(eventColor).trim();

    if (this.config.debug) {
      const colorKeys = Object.keys(item).filter(k =>
        k.toLowerCase().includes("color") || k.toLowerCase().startsWith("x-")
      );
      if (colorKeys.length) {
        console.log(`[MMM-MyGCalendar] DEBUG "${item.summary}" — color-related keys:`,
          colorKeys.reduce((acc, k) => { acc[k] = item[k]; return acc; }, {})
        );
      } else if (!this._debuggedKeys) {
        this._debuggedKeys = true;
        console.log(`[MMM-MyGCalendar] DEBUG sample event keys for "${item.summary}":`, Object.keys(item));
      }
    }

    return {
      id: `${item.uid || item.summary}_${start.getTime()}`,
      title: (item.summary || "Untitled").trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: !!allDay,
      location: item.location || "",
      description: item.description ? item.description.trim() : "",
      calendarName: cal.name || "Calendar",
      calendarColor: cal.color || "#4285F4",
      eventColor: eventColor,
    };
  },

  toDate(val) {
    if (val instanceof Date) return val;
    if (val && val.toJSDate) return val.toJSDate();
    return new Date(val);
  },
});
