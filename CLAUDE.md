# CLAUDE.md — Chart Project Notes

## Overview

This project is a D3 line chart that reads data from an Excel file (`.xlsx`) in the browser using SheetJS. The logic lives entirely in `chart.js`, which is shared by two consumers:

- **`chart.html`** — a minimal standalone preview page for development
- **`embed.js`** — a minimal loader (~8 lines) that host sites include; it fetches `chart.js` from GitHub and runs it, injecting the chart into any `[data-tbl-chart]` placeholder div on the page

Fonts are intentionally omitted from chart styles — inherited from the host page.

---

## Files

| File | Purpose |
|------|---------|
| `chart.html` | Standalone preview page — thin shell that loads `chart.js` |
| `chart.js` | All chart logic — used by both `chart.html` and the embed system |
| `theme-v1.js` | Budget Lab house style — sets `window.TBL_THEME`; versioned filename |
| `embed.js` | Loader for host sites; fetches `theme-v1.js` then `chart.js` from GitHub |
| `tariff_impacts_results_20260216.xlsx` | Data source — read client-side via SheetJS |
| `TBL_ID_Graph_BrightBlue_KO.svg` | Budget Lab logo (blue graph, navy text on transparent background) |
| `TBL_ID_Graph_BrightBlue_K.svg` | Alternate logo variant with black text (not currently used in chart) |

---

## House Stylesheet: `theme-v1.js`

`theme-v1.js` sets `window.TBL_THEME` — a plain object grouping all Budget Lab visual constants. `chart.js` reads every value with an `|| fallback`, so the chart works standalone even when no theme file is loaded (e.g. `chart.html` in local development without a server).

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
  chart:      { aspectRatio, margin, lineStrokeWidth }
}
```

### Palette selection

**Simple chart (one palette):** set `data-palette="blues"` on the placeholder div — `chart.js` resolves it automatically via the fallback chain: named palette → `blues` → hardcoded defaults.

**Complex chart (multiple palettes):** reference `TC.palettes.blues`, `TC.palettes.oranges`, etc. directly in `chartN.js`. The `data-palette` shorthand is bypassed; palette mapping lives in code where the logic warrants it.

### Versioning rule — protecting existing embeds

`theme-v1.js` is referenced by a **versioned filename**. Each embed file pins to a specific version:

- `embed.js` (current chart) → loads `theme-v1.js` → frozen forever
- `embed2.js` (next chart) → loads `theme-v1.js` (or `theme-v2.js` if style changes)

**Rule of thumb:**
- **Bug fix / typo** → edit `theme-v1.js` in place (safe, intentional for all charts pinned to it)
- **Visual change** → create `theme-v2.js`; point new embeds there; never touch `theme-v1.js`

### Pattern for future charts

Each new chart needs only:
1. A `chartN.js` — `seriesDefs`, sheet config, data transforms; no style definitions
2. An `embedN.js` — loads the pinned theme version, then `chartN.js`
3. All styling inherited from the theme

---

## chart.html Structure

A minimal standalone preview page — no logic of its own. Pre-loads D3 and SheetJS from CDN (so `chart.js` skips its dynamic injection step), then hands off to `chart.js` via a `[data-tbl-chart]` placeholder div.

```html
<div data-tbl-chart
     data-src="tariff_impacts_results_20260216.xlsx"
     data-logo="TBL_ID_Graph_BrightBlue_KO.svg">
</div>
<script src="chart.js"></script>
```

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

`embed.js` is a small loader kept on the host site. It injects `theme-v1.js` first (setting `window.TBL_THEME`), then injects `chart.js` in its `onload` callback so the theme is guaranteed to be present when the chart initialises. All chart logic, CSS, and HTML injection live in `chart.js`.

The one value that needs to be set in `embed.js` is `BASE` — the GitHub Pages base URL:

```javascript
var BASE = 'https://YOUR-USERNAME.github.io/YOUR-REPO/';
```

Once set, `embed.js` never needs to change again — future chart updates are deployed by pushing new files to GitHub.

### Usage on a host page

```html
<div data-tbl-chart
     data-src="https://raw.githubusercontent.com/YOUR-ORG/YOUR-REPO/main/tariff_impacts_results_20260216.xlsx"
     data-logo="https://YOUR-DOMAIN/TBL_ID_Graph_BrightBlue_KO.svg">
</div>
<script src="https://YOUR-DOMAIN/embed.js"></script>
```

Alternatively, if there is no need for a local relay file, the host page can reference `chart.js` from GitHub directly and skip `embed.js` entirely.

Multiple charts per page are supported — each `[data-tbl-chart]` placeholder gets its own isolated instance. `chart.js` uses a `DOMContentLoaded` guard so it works whether loaded in `<head>` or at the end of `<body>`.

### Attributes on the placeholder `<div>`

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-tbl-chart` | Yes | Marks the element as a chart placeholder |
| `data-src` | Yes (for production) | URL to the `.xlsx` file (must be HTTP/HTTPS with CORS) |
| `data-logo` | No | URL to the SVG logo; defaults to the relative path `TBL_ID_Graph_BrightBlue_KO.svg` |
| `data-palette` | No | Named palette from `TBL_THEME.colors.palettes` (e.g. `"blues"`); defaults to `blues` |

### Isolation design

The main reason not to simply reference `chart.html` via a `<script>` tag is that `chart.html` uses generic element IDs (`#tooltip`, `#legend`, etc.) and unscoped CSS class names (`.axis`, `.dot`) that would collide with or bleed into the host page. `embed.js` solves this:

| Problem | Solution |
|---------|----------|
| ID collisions | Every element gets a random UID prefix (e.g. `tbl-a3f2-tooltip`) generated at init time |
| CSS bleed | All rules scoped to `#tbl-{uid}-container`; legend classes renamed `tbl-legend-item` / `tbl-legend-swatch` |
| Tooltip isolation | `position:fixed` tooltip appended directly to `<body>` so it escapes any overflow clipping |
| D3 / XLSX conflicts | Dynamic CDN load guarded by `window.d3` / `window.XLSX` check; concurrent loads deduplicated by a promise cache |

### JavaScript structure (`chart.js`)

1. **`loadScript(src)` / `ensureDeps()`** — dynamically inject D3 v7 and SheetJS CDN scripts if not already present; deduplicated with a module-level promise cache so multiple charts on the same page share one load. Skipped if `window.d3` / `window.XLSX` are already set (e.g. pre-loaded by `chart.html`).
2. **`excelDateToYYYYMM(serial)`** — converts Excel serial date numbers to `"YYYY-MM"` strings.
3. **`initChart(placeholder)`** — chart factory called once per `[data-tbl-chart]` element. Reads `window.TBL_THEME` (with `|| fallbacks`) into local constants, generates the UID, injects HTML and scoped CSS (using theme values), then calls `ensureDeps()`.
4. **`drawChart(data)`** — pure render function. Accepts `{ title, unit, series, avgValue, avgLabel }`. Clears and redraws from scratch on every call (supports resize). All `getElementById` / D3 selector calls use the UID-prefixed IDs. Uses theme variables via closure.
5. **`fetchAndRender()`** — fetches and parses the xlsx, calls `drawChart`. Re-called on window resize (debounced 200 ms).

---

## Hosting Requirements

- The xlsx **cannot** be loaded via `file://` protocol (browser CORS blocks it). It must be served over HTTP/HTTPS.
- The xlsx URL is set via the `data-src` attribute on the placeholder `<div>`. `raw.githubusercontent.com` sends `Access-Control-Allow-Origin: *`, so cross-origin fetches work without a proxy:
  ```html
  data-src="https://raw.githubusercontent.com/your-org/your-repo/main/tariff_impacts_results_20260216.xlsx"
  ```
- The SVG logo is set via `data-logo`. Use an absolute URL when the logo and the host page are on different servers.
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
