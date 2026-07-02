# MagicMirror Config

Custom MagicMirror² setup running on a Raspberry Pi 5, including one module built from scratch and patches on top of several community modules.

## Modules

### MMM-ChoreTracker (original)
Built from scratch. A household chore tracker with PIN-gated parent-only checkoff (kids can't self-mark chores as done). Tracks daily and weekly chores per person, calculates weekly completion percentage against an allowance threshold, and displays a live payout amount.

### MMM-GoogleTasks-src (patched)
Based on [spydersoft-consulting/MMM-GoogleTasks](https://github.com/spydersoft-consulting/MMM-GoogleTasks). Changes made:
- Fixed due-date sorting so tasks without a due date sort to the bottom instead of the top
- Added a `displayLimit` config option to cap the total number of tasks shown across all lists combined (the built-in `maxResults` only capped per-list, not total)
- Added `!`-prefix priority marking — prefixing a task title with `!` in Google Tasks pins it to the top of the sorted list, with the marker itself hidden from display

To use: clone the original module, replace its `src/` folder with the one here, then run `npm install && npm run build`.

### MMM-shabbat (patched)
Based on [sheyabernstein/MMM-shabbat](https://github.com/sheyabernstein/MMM-shabbat). Changes made:
- Filtered the display to only show Candle Lighting, Havdalah, and Parashat entries
- Renamed "Shabbos" label to "Shabbat"

### MMM-JewishDate (patched)
Based on [yohaybn/MMM-JewishDate](https://github.com/yohaybn/MMM-JewishDate). Changes made:
- Fixed a bug where `this.loaded` was never set to `true`, causing the module to display "Loading" indefinitely
- Changed the date display from Hebrew script to English transliteration (day, month name, year)

### MMM-MyGCalendar (patched)
Based on a module originally shared by user johnster000 on the MagicMirror forum. Changes made:
- Adjusted the display window to start at the current week instead of including one week in the past

## Setup

1. Copy `config.js.example` to `config/config.js` and fill in your own values (coordinates, PIN, calendar URLs, task list names).
2. Never commit `config.js`, `credentials.json`, or `token.json` — these are excluded via `.gitignore` and contain private data / OAuth secrets.
3. For MMM-GoogleTasks, follow the [original module's setup instructions](https://github.com/spydersoft-consulting/MMM-GoogleTasks) for Google Cloud OAuth setup.
