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
**Config-level customization (see `config.js.example`, no code change):** the module's built-in `colorRules` option is used to give each family member a distinct event color, matched by keyword against the event title (e.g. a rule matching a specific name colors any event containing that name in its title). This is name-based text matching, not a per-person calendar assignment — an event only gets colored if the person's name literally appears in its title.

## Other Modules Used (Unmodified)

These modules are used as-is, with no code changes — only configuration (see `config.js.example`):

- [MMM-NOAAForecast](https://github.com/supermem613/MMM-NOAAForecast) — weather forecast, no API key required (US only)
- [MMM-NewsFeedTicker](https://github.com/justjim1220/MMM-NewsFeedTicker) — scrolling news ticker

## Layout & Styling (`custom.css`)

`custom.css` is where visual tweaks go that don't need a code or config change — widths, fonts, colors, spacing, borders, hiding an element entirely. MagicMirror loads it last (after `main.css` and every module's own CSS), so its rules win without needing to touch any module source. Copy it to `config/custom.css` on the Pi; the mirror needs a restart to pick up any change (`systemctl --user restart magicmirror.service`, or whatever run mechanism you're using).

Kinds of changes this file is good for, and where to look:
- **Region/module width** — MagicMirror's regions (`top_left`, `top_center`, `bottom_right`, etc.) shrink-wrap to their content by default. To make a module occupy a fixed share of the screen, target `.region.<position>` (e.g. `.region.top.center`) with `width`/`max-width`/`flex`, and usually also the `.module` and `.module-content` inside it, since those can have their own width constraints.
- **Font sizes** — each module renders its own DOM with its own classes; inspect the module's CSS file (or its rendered output) to find the right selector, then override `font-size` in `custom.css`. Watch for fixed-height containers (row heights, badge sizes) sized around the *original* font — bumping text size often means bumping a paired `height`/`line-height` too, or the text clips.
- **Spacing between regions** — MagicMirror exposes `--gap-body-top/right/bottom/left` (margin from each screen edge) and `--gap-modules` (spacing between stacked modules in the same region) as CSS custom properties on `:root`. Override just the ones you need; the defaults are 60px/30px. Two regions can visually collide if their content grows tall/wide enough — moving or resizing one directly (a `transform`, explicit `max-width`, etc.) is usually more reliable than trying to reason about the regions' independent positioning math.
- **Borders/frames around a module** — a plain `border` + `border-radius` on the module's wrapper element is reliable and cheap. Decorative/wavy borders (SVG `border-image`, background-image tricks) are possible but fragile in practice — they're sensitive to the exact aspect ratio of the box and don't always render as expected across Chromium versions. Prefer plain borders unless you're prepared to iterate visually.
- **Hiding part of a module** — `display: none` on the specific inner element (not the whole module) if you want to keep the rest of its layout. Check whether the hidden data still feeds into any calculation elsewhere in the module (e.g. a percentage or total) — hiding the display doesn't stop the underlying computation.

**Note:** some modules set their own CSS custom properties via inline styles from JS (e.g. `element.style.setProperty("--some-var", ...)`), typically driven by a config option. An inline style always wins over a same-specificity rule in a stylesheet for that same property on that same element — so a `custom.css` override of that variable will silently do nothing. If a color/value won't budge no matter what you put in `custom.css`, check the module's source for a matching config option (a `backgroundColor`, `accentColor`, etc.) and set it there instead.

## Setup

1. Copy `config.js.example` to `config/config.js` and fill in your own values (coordinates, PIN, calendar URLs, task list names).
2. Copy `custom.css` to `config/custom.css` for the layout/styling customizations described above.
3. Never commit `config.js`, `credentials.json`, or `token.json` — these are excluded via `.gitignore` and contain private data / OAuth secrets.
4. For MMM-GoogleTasks, follow the [original module's setup instructions](https://github.com/spydersoft-consulting/MMM-GoogleTasks) for Google Cloud OAuth setup.
