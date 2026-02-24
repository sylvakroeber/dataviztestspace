# CLAUDE.md — Chart Project Notes

## Overview

This project is a D3 line chart that reads data from an Excel file (`.xlsx`) in the browser using SheetJS. The architecture is split into three layers:

- **`../shared/chart-core.js`** — universal infrastructure shared by all chart types; sets `window.TBL_CORE`
- **`../shared/linechart.js`** — line chart rendering engine; sets `window.TBL_LINE`
- **`chart.js`** — Chart 1 data logic only (~70 lines); calls `TBL_LINE.run(...)`

Two consumers:
- **`chart.html`** — minimal standalone preview page for development
- **`embed.js`** — minimal loader that host sites include; fetches scripts from GitHub and injects the chart into any `[data-tbl-chart]` placeholder div

Fonts are intentionally omitted from chart styles — inherited from the host page.

---

## Files

| File | Purpose |
|------|---------|
| `chart.html` | Standalone preview page — thin shell that loads the script stack |
| `../shared/linechart.js` | Line chart rendering engine — sets `window.TBL_LINE`; depends on chart-core.js |
| `chart.js` | Chart 1 data logic only — seriesDefs, transforms, annotations; calls `TBL_LINE.run()` |
| `embed.js` | Loader for host sites; fetches theme + core + line + chart from GitHub |
| `tariff_impacts_results_20260216.xlsx` | Data source — read client-side via SheetJS |
| `TBL_ID_Graph_BrightBlue_KO.svg` | Budget Lab logo (blue graph, navy text on transparent background) |
| `TBL_ID_Graph_BrightBlue_K.svg` | Alternate logo variant with black text (not currently used in chart) |

Shared infrastructure (repo-wide, lives in `../shared/`):

| File | Purpose |
|------|---------|
| `../shared/theme-v1.js` | Budget Lab house style — sets `window.TBL_THEME`; versioned filename |
| `../shared/chart-core.js` | Universal infrastructure — sets `window.TBL_CORE`; shared across all chart types |

---

## House Stylesheet: `theme-v1.js`

`theme-v1.js` sets `window.TBL_THEME` — a plain object grouping all Budget Lab visual constants. `chart-core.js` reads every value with an `|| fallback`, so the chart works standalone even when no theme file is loaded (e.g. `chart.html` in local development without a server).

### TBL_THEME structure

```javascript
window.TBL_THEME = {
  colors: {
    background, titleText, secondaryText, axisText,
    axisStroke, gridline, tooltip, cursor,
    annotationBright,  // orange — prominent annotation lines and labels
    annotationDim,     // gray   — subtle / secondary annotation lines
    palettes: {
      blues:       [...],  // graduated shades — related/similar series
      categorical: [...],  // maximally distinct — unrelated series
      // add more families here as needed (oranges, greens, …)
    }
  },
  typography: { titleSize, titleWeight, bodySize, axisSize, annotationSize, smallSize },
  spacing:    { containerPadding, maxWidth, borderRadius, logoHeight, logoOpacity },
  defaults: {
    creditText,    // default credit line text
    footnoteText,  // default footnote text (empty string = no footnote)
  },
  chart: {
    aspectRatio, margin, lineStrokeWidth,
    axisTickMinSpacing, axisTickIntervals,
    yDomainPadding,          // multiplier on d3.max for y-axis upper bound (default 1.1)
    yTickCount,              // y-axis tick count (default 6)
    lineCurve,               // d3.curve* name without prefix, e.g. 'monotoneX'
    tooltipOffsetX,          // px right of cursor; flips left near viewport edge (default 16)
    tooltipOffsetY,          // px above cursor (default 36)
    legendHiddenOpacity,     // line opacity when series toggled off (default 0.15)
    legendHiddenItemOpacity, // legend label/swatch opacity when toggled off (default 0.4)
  }
}
```

### Palette selection

Palette is passed as the optional third argument to `TBL_LINE.run()` in `chartN.js`:

```javascript
TBL_LINE.run('data.xlsx', makeChartFn, 'blues');
```

Resolution order: named palette → `blues` → hardcoded defaults. `chart-core.js` resolves the palette and makes it available to both `drawChart` (via `ctx.palette`) and the data factory (via `tools.palette`).

**Complex chart (multiple palettes):** reference `TBL_THEME.colors.palettes.blues`, etc. directly in `chartN.js`. The palette argument is bypassed; palette mapping lives in code where the logic warrants it.

### Versioning rule — protecting existing embeds

`theme-v1.js` is referenced by a **versioned filename**. Each embed file pins to a specific version:

- `embed.js` (current chart) → loads `theme-v1.js` → frozen forever
- `embed2.js` (next chart) → loads `theme-v1.js` (or `theme-v2.js` if style changes)

**Rule of thumb:**
- **Bug fix / typo** → edit `theme-v1.js` in place (safe, intentional for all charts pinned to it)
- **Visual change** → create `theme-v2.js`; point new embeds there; never touch `theme-v1.js`

### Pattern for future charts

**New line chart** (same rendering engine, different data):
1. A `chartN.js` — `TBL_LINE.run(src, makeChartFn, palette?)` with seriesDefs, transforms, annotations (~70 lines)
2. An `embedN.js` — four-stage load: theme → core → linechart → chartN
3. All styling inherited from the theme; no style definitions in chartN.js

**New chart type** (new rendering engine):
1. A `barchart.js` (or similar) — rendering engine that calls `TBL_CORE.run(barChartDrawFactory, fn, src, pal)` and sets `window.TBL_BAR`
2. A `chartN.js` — data logic that calls `TBL_BAR.run(...)`
3. An `embedN.js` — loads theme → core → barchart → chartN

**`tools` API** (passed to `makeChartFn` by `TBL_CORE`):

| Property | Type | Description |
|----------|------|-------------|
| `drawChart` | `fn(data)` | Render function — call with the data object |
| `palette` | `string[]` | Resolved color array for the chart's series |
| `showError` | `fn(msg)` | Display an error banner in the chart container |
| `clearError` | `fn()` | Hide the error banner |
| `excelDateToYYYYMM` | `fn(serial)` | Convert Excel serial date to `"YYYY-MM"` |
| `el` | `fn(suffix)` | `getElementById` shorthand with UID prefix |
| `uid` | `string` | Unique instance prefix (e.g. `tbl-a3f2`) |
| `DATA_SOURCE` | `string` | Resolved xlsx URL/path |
| `placeholder` | `Element` | The `[data-tbl-chart]` div |

---

## `drawChart` data interface

`drawChart(data)` is called by `fetchAndRender` in `chartN.js`. All fields except `title`, `unit`, and `series` are optional.

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Chart title (fallback: `'Chart'`) |
| `unit` | `string` | Y-axis unit label (e.g. `'Billions USD'`) |
| `series` | `Array<{name, color, data}>` | Line series; each `data` item is `{date: 'YYYY-MM', value: number}` |
| `footnote` | `string` | Per-render footnote override (uses theme default if omitted) |
| `credit` | `string` | Per-render credit line override (uses theme default if omitted) |
| `avgValue` | `number` | Y-value for horizontal dashed annotation line |
| `avgLabel` | `string` | Text label for horizontal annotation |
| `avgLabelDate` | `string` | Date (`'YYYY-MM-DD'`) for horizontal label x-position |
| `verticalAnnotations` | `Array<{date, color}>` | Vertical dotted lines; `color` is `'dim'` or `'bright'` |
| `tooltipFormatter` | `fn(seriesName, value)` | Custom tooltip value string; default: `'$X billion'` |

---

## chart.html Structure

A minimal standalone preview page — no logic of its own. Pre-loads D3, SheetJS, and the theme from CDN/local, then loads the script stack.

```html
<head>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
  <script src="../shared/theme-v1.js"></script>
</head>
<body>
  <div data-tbl-chart data-logo="TBL_ID_Graph_BrightBlue_KO.svg"></div>
  <script src="../shared/chart-core.js"></script>
  <script src="../shared/linechart.js"></script>
  <script src="chart.js"></script>
</body>
```

`data-src` and `data-palette` are not on the div — they are declared in `chart.js` via `TBL_LINE.run(src, fn, palette)`.

Fonts are intentionally omitted — inherited from the host page.

---

## Data Source: `tariff_impacts_results_20260216.xlsx`, sheet `F1`

| Row | Content |
|-----|---------|
| 1 | Chart title string (e.g. "Figure 1. Customs Duty Revenue (Inflation-Adjusted)") |
| 2–5 | Blank / metadata (skipped) |
| 6 | Column headers (skipped — hardcoded in `seriesDefs`) |
| 7–79 | Data rows |

**Columns used:**

| Col | Content | Treatment |
|-----|---------|-----------|
| A (index 0) | Date as Excel serial number | Converted via `excelDateToYYYYMM()` |
| B (index 1) | Customs duties, nominal USD (millions) | Divided by 1000 → billions |
| C (index 2) | Customs duties, 2025 USD (millions) | Divided by 1000 → billions |
| D (index 3) | 2022–2024 avg, 2025 USD (millions, constant) | Divided by 1000 → billions; drawn as horizontal annotation, not a series |

---

## Chart Features

- **Two line series**: nominal USD (#4e79a7 blue), 2025 USD (#72A4D7 lighter blue)
- **Horizontal dashed annotation**: 2022–2024 average in orange (#f28e2b), labeled at August 2021
- **Vertical dotted annotation**: Jan 1, 2025 in gray (#bbb)
- **Legend** above the chart; clicking a swatch toggles that series to 15% opacity
- **Interactive tooltip**: vertical cursor snaps to nearest monthly point; tooltip flips left when near the right edge of the viewport
- **Responsive**: SVG uses `viewBox` + `width: 100%`; chart re-renders on window resize

---

## embed.js — Script-Based Embed

`embed.js` is a small loader kept on the host site. It loads scripts in four stages — theme → core → line chart engine → chart — so each layer is guaranteed to be present before the next one initialises. All chart logic, CSS, and HTML injection live in the shared layers.

The one value that needs to be set in `embed.js` is `SITE` — the GitHub Pages root URL:

```javascript
var SITE = 'https://YOUR-USERNAME.github.io/YOUR-REPO/';
```

Once set, `embed.js` never needs to change again — future chart updates are deployed by pushing new files to GitHub.

### Usage on a host page

```html
<div data-tbl-chart
     data-logo="https://YOUR-DOMAIN/TBL_ID_Graph_BrightBlue_KO.svg">
</div>
<script src="https://YOUR-DOMAIN/embed.js"></script>
```

The xlsx URL and palette name are declared in `chart.js` (passed to `TBL_LINE.run`), not on the div. `data-logo` remains a div attribute because the logo URL varies by host environment.

Alternatively, if there is no need for a local relay file, the host page can reference the script stack from GitHub directly and skip `embed.js` entirely.

Multiple charts per page are supported — each `[data-tbl-chart]` placeholder gets its own isolated instance. `chart-core.js` uses a `DOMContentLoaded` guard so the stack works whether loaded in `<head>` or at the end of `<body>`.

### Attributes on the placeholder `<div>`

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-tbl-chart` | Yes | Marks the element as a chart placeholder |
| `data-logo` | No | URL to the SVG logo; defaults to the relative path `TBL_ID_Graph_BrightBlue_KO.svg` |

`data-src` and `data-palette` are no longer used — the data source and palette are declared in `chart.js`.

### Isolation design

The main reason not to simply reference `chart.html` via a `<script>` tag is that `chart.html` uses generic element IDs (`#tooltip`, `#legend`, etc.) and unscoped CSS class names (`.axis`, `.dot`) that would collide with or bleed into the host page. `embed.js` solves this:

| Problem | Solution |
|---------|----------|
| ID collisions | Every element gets a random UID prefix (e.g. `tbl-a3f2-tooltip`) generated at init time |
| CSS bleed | All rules scoped to `#tbl-{uid}-container`; legend classes renamed `tbl-legend-item` / `tbl-legend-swatch` |
| Tooltip isolation | `position:fixed` tooltip appended directly to `<body>` so it escapes any overflow clipping |
| D3 / XLSX conflicts | Dynamic CDN load guarded by `window.d3` / `window.XLSX` check; concurrent loads deduplicated by a promise cache |

### JavaScript structure

**`chart-core.js`** (`window.TBL_CORE`):
1. **`loadScript(src)` / `ensureDeps()`** — dynamically inject D3 v7 and SheetJS CDN scripts if not already present; deduplicated with a module-level promise cache.
2. **`excelDateToYYYYMM(serial)`** — converts Excel serial date numbers to `"YYYY-MM"` strings.
3. **`initChart(placeholder, drawChartFactory, makeChartFn, dataSource, palette)`** — chart factory called once per `[data-tbl-chart]` element. Reads `window.TBL_THEME`, generates UID, injects HTML and scoped CSS, then calls `ensureDeps()`. After deps load, calls `drawChartFactory(ctx)` → `drawChart`, then `makeChartFn(tools)` → `fetchAndRender`. Boots chart and wires 200ms resize debounce.
4. **`run(drawChartFactory, makeChartFn, dataSource, palette)`** — queries all `[data-tbl-chart]`, calls `initChart` for each, with `DOMContentLoaded` guard.

**`linechart.js`** (`window.TBL_LINE`):
1. **`lineChartDrawFactory(ctx)`** — receives full `ctx` from core; returns instance-bound `drawChart(data)` with the complete D3 rendering block.
2. **`TBL_LINE.run(src, fn, pal)`** — calls `TBL_CORE.run(lineChartDrawFactory, fn, src, pal)`.

**`chart.js`** (Chart 1):
- Calls `TBL_LINE.run(dataSource, makeChartFn, palette)`.
- `makeChartFn` receives `tools` and returns `fetchAndRender` — an async function that fetches the xlsx, parses it, and calls `drawChart(data)`.

---

## Hosting Requirements

- The xlsx **cannot** be loaded via `file://` protocol (browser CORS blocks it). It must be served over HTTP/HTTPS.
- The xlsx URL is the first argument to `TBL_LINE.run(...)` in `chart.js`. `raw.githubusercontent.com` sends `Access-Control-Allow-Origin: *`, so cross-origin fetches work without a proxy:
  ```javascript
  TBL_LINE.run('https://raw.githubusercontent.com/your-org/your-repo/main/data.xlsx', fn, 'blues');
  ```
- The SVG logo is set via `data-logo` on the placeholder div. Use an absolute URL when the logo and the host page are on different servers.
- No Python, Node, or server-side runtime is required.

---

## Errors Encountered and Fixes

### 1. Invalid CSS selector — parentheses in series names
**Error**: `Element.querySelectorAll: '.dot-Customs-duties-(nominal-USD)' is not a valid selector`

**Cause**: Series names like `"Customs duties (nominal USD)"` were being used to build CSS class/ID selectors using only `replace(/\s+/g, "-")`, which left parentheses in the string.

**Fix**: Changed all three occurrences to `replace(/[^a-zA-Z0-9]+/g, "-")`, stripping any non-alphanumeric character before using the name as a selector.

---

### 2. Chart not loading after removing the auto-refresh timer
**Error**: `ReferenceError: setStatus is not defined`

**Cause**: When the live-update polling and status UI were removed, a call to `setStatus("fetching", "Fetching…")` at the top of `fetchAndRender()` was overlooked. The function had been deleted but the call site remained.

**Fix**: Removed the orphaned `setStatus(...)` call from `fetchAndRender()`.

---

## SVG Logo Notes

- `TBL_ID_Graph_BrightBlue_KO.svg`: white/KO variant — text fill changed from `#FFFFFF` to `#101f5b` (navy) to work on a white background without a colored backing rectangle.
- `viewBox` on both SVGs was tightened from `0 0 252 108` to `15 24 222 60` to remove excess whitespace around the artwork.
- The `K` variant (`*K.svg`) has black text and is kept as an alternate but is not currently referenced in `chart.html`.
