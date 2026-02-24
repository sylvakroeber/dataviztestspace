# CLAUDE.md — Shared Chart Infrastructure

## Overview

All charts in this repo share three files that live here. Chart-specific code (data fetching, series definitions, annotations) lives in each chart's own directory and calls `TBL_CHART.run()`. Nothing chart-specific belongs in `shared/`.

```
shared/theme-v1.js   → window.TBL_THEME   visual constants
shared/chart-core.js → window.TBL_CORE    infrastructure + D3 helpers
shared/chart.js      → window.TBL_CHART   unified renderer (bar, line, combo)
```

**Load order for every chart:**
```html
<script src="../shared/theme-v1.js"></script>   <!-- optional but recommended -->
<script src="../shared/chart-core.js"></script>
<script src="../shared/chart.js"></script>
<script src="chart.js"></script>                <!-- chart-specific logic -->
```

`chart-core.js` reads every theme value with `|| fallback`, so `theme-v1.js` is optional and the chart still works without it (useful for local development without a server).

---

## Files

| File | Sets | Purpose |
|------|------|---------|
| `theme-v1.js` | `window.TBL_THEME` | All visual constants — colors, typography, spacing, chart defaults |
| `chart-core.js` | `window.TBL_CORE` | HTML/CSS injection, dep loading, resize debounce, shared D3 helpers |
| `chart.js` | `window.TBL_CHART` | Unified renderer — bar, line, combo; calls TBL_CORE |
| `tbl-logo-blue.svg` | — | Budget Lab logo, navy text on transparent background (primary) |
| `tbl-logo-white.svg` | — | Alternate logo variant with white text — use on dark backgrounds |

---

## `theme-v1.js` — TBL_THEME

Sets `window.TBL_THEME`. Full structure:

```javascript
window.TBL_THEME = {
  colors: {
    background, titleText, secondaryText, axisText,
    axisStroke, gridline, tooltip, cursor,
    annotationBright,   // orange #f28e2b — prominent annotation lines/labels
    annotationDim,      // gray   #bbb    — subtle/secondary annotation lines
    palettes: {
      categorical: [...],  // 7 maximally distinct colors — unrelated series
      blue:        [...],  // 5-shade monochromatic scale, darkest→lightest
      lime, violet, green, rose, teal, orange  // same structure
    }
  },
  typography: {
    fontFamily,     // Mallory with system-ui fallback stack
    titleSize,      // '18px'
    titleMinSize,   // '12px' — floor when title shrinks to fit
    titleWeight,    // 600
    bodySize,       // '13px' — legend, tooltip, unit label, error
    axisSize,       // '11px' — axis tick labels, y-axis label
    annotationSize, // '12px' — annotation text
    smallSize       // '11px' — footnote, credit
  },
  spacing: {
    containerPadding, maxWidth, borderRadius,
    logoHeight,     // '32px'
    logoOpacity     // 0.85
  },
  defaults: {
    creditText,     // default credit line ('' = none)
    footnoteText    // default footnote ('' = none)
  },
  chart: {
    // Line charts
    aspectRatio:     0.45,   // height/width for line charts
    margin:          { top: 20, right: 30, bottom: 50, left: 60 },
    lineStrokeWidth: '2.5px',
    lineCurve:       'monotoneX',  // d3.curve* name without prefix
    axisTickMinSpacing: 65,        // min px gap between time axis ticks
    axisTickIntervals:  [6, 12, 24], // tick interval snap points (months)
    yDomainPadding:  1.1,  // multiplier on max for y-axis upper bound
    yTickCount:      6,
    tooltipOffsetX:  16,   // px right of cursor (flips when near right edge)
    tooltipOffsetY:  36,   // px above cursor
    legendHiddenOpacity:     0.15,  // series opacity when toggled off
    legendHiddenItemOpacity: 0.4,   // legend item opacity when toggled off

    // Bar charts
    barPadding:      0.25,  // scaleBand padding (0=touch, 1=invisible)
    groupPadding:    0.10,  // inner-band padding for grouped bars
    barAspectRatio:  0.50,  // height/width for bar/combo charts
    barCornerRadius: 3,     // px, top corners on vertical bars / right on horizontal
    barLabelOffset:  4      // px gap for value-on-bar labels (future use)
  }
}
```

### Palette selection

Pass a palette name as the third argument to `TBL_CHART.run()`:

```javascript
TBL_CHART.run(src, makeChartFn, 'blue');   // monochromatic blue shades
TBL_CHART.run(src, makeChartFn);            // defaults to 'categorical'
```

Resolution order: named palette → `categorical` → hardcoded `['#286dc0', '#bc8c00']`.

For charts that need different palettes per series, reference `TBL_THEME.colors.palettes.blue` etc. directly in `chartN.js` and assign colors explicitly on each series object.

### Versioning rule

`theme-v1.js` is pinned by filename in every embed. Never make visual changes to it — create `theme-v2.js` instead and update new embeds to reference it. Bug fixes and typo corrections are safe to make in place.

---

## `chart-core.js` — TBL_CORE

Universal infrastructure. Handles everything that isn't rendering: HTML injection, CSS injection, dep loading, resize debounce. Also exports shared D3 helpers that `chart.js` calls during rendering.

### Public API

```javascript
window.TBL_CORE = {
  // ── Infrastructure ──────────────────────────────────────────────────────
  run(drawChartFactory, makeChartFn, dataSource, palette),
  initChart(placeholder, drawChartFactory, makeChartFn, dataSource, palette),
  ensureDeps(opts),        // opts: { xlsx: false } to skip SheetJS
  excelDateToYYYYMM(serial),

  // ── Shared D3 helpers (require d3 to be loaded) ─────────────────────────
  fitTitle(ctx, totalWidth),
  drawGridlines(g, scale, size, opts),
  buildLinearYAxis(g, yScale, ctx, opts),
  buildTimeXAxis(g, xScale, ctx, height, opts),
  buildBandXAxis(g, xScale, height, ctx, opts),
  buildBandScales(categories, seriesNames, size, ctx, opts),
  positionTooltip(ttEl, event, ctx),
  buildLegend(legendEl, series, ctx, onToggle),
}
```

### `run(drawChartFactory, makeChartFn, dataSource, palette)`

Queries all `[data-tbl-chart]` elements and calls `initChart` for each. Has a `DOMContentLoaded` guard so it works whether called from `<head>` or end of `<body>`.

### `initChart(placeholder, drawChartFactory, makeChartFn, dataSource, palette)`

Called once per placeholder div. Reads `TBL_THEME`, generates a unique UID (`tbl-xxxxxx`), injects HTML and scoped CSS, calls `ensureDeps()`, then:

1. Calls `drawChartFactory(ctx)` → returns `drawChart(data)`
2. Calls `makeChartFn(tools)` → returns `fetchAndRender()`
3. Calls `fetchAndRender()` immediately
4. Wires a 200ms debounced resize listener that re-calls `fetchAndRender()`

### `ctx` — passed to `drawChartFactory`

All resolved theme values plus instance state. Key properties:

| Property | Type | Description |
|----------|------|-------------|
| `uid` | `string` | Unique instance prefix, e.g. `tbl-a3f2` |
| `el(suffix)` | `fn` | `getElementById` shorthand: `el('title')` → `#tbl-a3f2-title` |
| `ttEl` | `Element` | Tooltip `<div>` on `<body>` |
| `palette` | `string[]` | Resolved color array |
| `fontFamily` | `string` | Resolved font stack |
| `aspectRatio` | `number` | Line chart aspect ratio |
| `barAspectRatio` | `number` | Bar/combo chart aspect ratio |
| `barCornerRadius` | `number` | px, bar rounded corners |
| `barPadding` | `number` | scaleBand padding |
| `groupPadding` | `number` | Inner band padding for grouped bars |
| `margin` | `object` | `{ top, right, bottom, left }` |
| `yDomainPadding` | `number` | Multiplier on y max |
| `yTickCount` | `number` | Tick count for y axis |
| `axisTickMinSpacing` | `number` | Min px between time axis ticks |
| `axisTickIntervals` | `number[]` | Time tick interval snap points (months) |
| `lineCurve` | `string` | d3.curve name |
| `tooltipOffsetX/Y` | `number` | Tooltip position offsets |
| `legendHiddenOpacity` | `number` | Series opacity when toggled off |
| `legendHiddenItemOpacity` | `number` | Legend item opacity when toggled off |
| `annotationBright/Dim` | `string` | Annotation line colors |
| `showError(msg)` | `fn` | Show error banner |
| `clearError()` | `fn` | Hide error banner |
| `DATA_SOURCE` | `string` | Resolved data URL |
| `placeholder` | `Element` | The `[data-tbl-chart]` div |
| *(all color/typography/spacing values)* | | `bg`, `titleColor`, `secondary`, `axisColor`, etc. |

### `tools` — passed to `makeChartFn`

```javascript
{ drawChart, palette, showError, clearError, excelDateToYYYYMM, el, uid, DATA_SOURCE, placeholder }
```

`makeChartFn(tools)` must return a `fetchAndRender` function that calls `tools.drawChart(data)` when ready. It is called immediately after init and again on resize.

### Shared D3 helpers

All require `d3` to be loaded. Called by `chart.js` during rendering.

**`fitTitle(ctx, totalWidth)`**
Measures the title element and scales `--tbl-title-size` CSS variable down if the title would otherwise wrap, floored at `ctx.titleMinSizePx`.

**`drawGridlines(g, scale, size, opts)`**
`opts: { axis: 'y'|'x', tickCount?, tickValues? }`
Appends a `<g class="gridline">`. Y-axis gridlines span horizontally across `size=width`; X-axis gridlines span vertically across `size=height`.

**`buildLinearYAxis(g, yScale, ctx, opts)`**
`opts: { tickCount?, tickFormat?, label?, marginLeft? }`
Appends `<g class="axis">`, removes `.domain`. Optionally appends a rotated label. Returns the axis `<g>`.

**`buildTimeXAxis(g, xScale, ctx, height, opts)`**
`opts: { tickFormat? }`
Auto-selects tick interval from `ctx.axisTickIntervals` based on available pixel width and `ctx.axisTickMinSpacing`.

**`buildBandXAxis(g, xScale, height, ctx, opts)`**
`opts: { tickFormat?, rotate?: boolean }`
Categorical X axis. `rotate: true` applies −35° for long labels.

**`buildBandScales(categories, seriesNames, size, ctx, opts)`**
`opts: { grouped?: boolean }`
Returns `{ xOuter, xInner?, catScale }`. `xOuter` spans `[0, size]`. When `grouped` and `seriesNames.length > 1`, also returns `xInner` spanning `[0, xOuter.bandwidth()]`. Pass `size=height` for horizontal bar charts.

**`positionTooltip(ttEl, event, ctx)`**
Sets `display: block` and positions the tooltip right of the cursor, flipping left when it would overflow the right viewport edge.

**`buildLegend(legendEl, series, ctx, onToggle)`**
`series: [{ name, color }]`, `onToggle(name, isVisible)`
Builds `.tbl-legend-item` divs with color swatches. Calls `onToggle` with the series name and new visibility on each click; the renderer is responsible for updating the SVG elements.

---

## `chart.js` — TBL_CHART

Unified chart renderer. Calls `TBL_CORE.run()` / `TBL_CORE.initChart()` with its own draw factory.

### Public API

```javascript
window.TBL_CHART = {
  run(dataSource, makeChartFn, palette?),
  initChart(element, dataSource, makeChartFn, palette?),
}
```

### `drawChart(data)` — full data contract

```javascript
{
  // ── Required ─────────────────────────────────────────────────────────────
  title:   string,
  series:  SeriesObj[],          // at least one required

  // ── Axis labels / metadata ────────────────────────────────────────────────
  unit:     string,              // left Y axis label (also shown below title)
  footnote: string,
  credit:   string,

  // ── Categorical X axis (required when any series is type 'bar') ───────────
  categories: string[],          // one label per bar position

  // ── Dual Y axes ───────────────────────────────────────────────────────────
  yAxis: {
    left?:  { label?: string, tickFormat?: fn, min?: number },
    right?: { label?: string, tickFormat?: fn },  // presence enables second axis
  },

  // ── Layout overrides ──────────────────────────────────────────────────────
  aspectRatio: number,           // overrides ctx.barAspectRatio or ctx.aspectRatio
  margin:      { top, right, bottom, left },

  // ── Line/annotation options ───────────────────────────────────────────────
  avgValue:            number,   // horizontal dashed annotation at this y value
  avgLabel:            string,
  avgLabelDate:        string,   // 'YYYY-MM-DD' — x position for the label
  verticalAnnotations: [{ date: string, color: 'dim'|'bright' }],

  // ── Bar options ────────────────────────────────────────────────────────────
  horizontal: boolean,           // default false — swap axes

  // ── Interaction ───────────────────────────────────────────────────────────
  tooltipFormatter: fn(seriesName, value, xLabel) => string,
  legend:           boolean,     // default true when series.length > 1
}
```

### `SeriesObj`

```javascript
{
  type:   'line' | 'bar',        // required
  name:   string,                // required
  color?: string,                // falls back to ctx.palette[i]
  yAxis?: 'left' | 'right',      // default 'left'

  // type: 'line' — time series
  data:   [{ date: 'YYYY-MM', value: number }],

  // type: 'line' — categorical (plots at band center, one value per category)
  data:   number[],

  // type: 'bar'
  data:   number[],              // one value per categories[] entry
  stack?: boolean | string,      // true or named key groups stacks; absent = grouped/simple
}
```

### X axis type inference

No `xType` field required — inferred automatically:

- **Categorical** — any bar series has `data: number[]` and `categories[]` is non-empty
- **Time series** — line series with `data: [{date, value}]` and no categorical bars

Mixed-type rule: categorical bars always win. Line series on a categorical chart use `data: number[]` and plot at band centers.

### Rendering order

Bars are always rendered before lines so lines sit on top. Series are sorted by type (`bar` → `line`) before render dispatch.

### Stacking

Bar series with `stack: true` are grouped into a default stack. `stack: 'keyName'` groups into named stacks, enabling multiple independent stacks on one chart. `d3.stack()` offsets are pre-computed before any bars are drawn.

### Tooltips

- **Time-series charts** — invisible overlay rect + bisector snaps to nearest date across all line series; cursor line follows mouse
- **Categorical charts** — per-element `mousemove`/`mouseout` on each `.tbl-bar`

### CSS classes used in SVG

| Class | Element | Notes |
|-------|---------|-------|
| `.tbl-line-path` | `<path>` | One per line series; ID = `uid-line-safeName` |
| `.tbl-bar` | `<rect>` or `<path>` | One per bar per category; `data-series` attribute holds series name; ID = `uid-bar-safeName-i` |
| `.tbl-bar-series` | `<g>` | Wrapper group per bar series |
| `.tbl-cursor` | `<line>` | Vertical cursor line on time charts |
| `.axis` | `<g>` | Axis groups; `.domain` removed; tick lines removed on band axes |
| `.gridline` | `<g>` | Gridline groups; `.domain` removed |

All scoped to `#uid-container` via CSS injected by both `chart-core.js` (structural) and `chart.js` (chart-element-specific).

---

## Isolation design

Multiple charts on the same page are fully isolated.

| Problem | Solution |
|---------|----------|
| ID collisions | Random UID prefix on every element: `tbl-a3f2-title`, `tbl-a3f2-legend`, etc. |
| CSS bleed | All rules scoped to `#tbl-{uid}-container` |
| Tooltip | `position:fixed` div appended to `<body>` — escapes overflow clipping |
| D3 / XLSX double-load | `ensureDeps()` uses a module-level promise cache keyed by CDN URL |
| Resize thrash | 200ms debounce on `window.resize`; only fires if wrapper has content |

---

## Adding a new chart

1. Create `chartN/` directory
2. Write `chartN/chart.js` — calls `TBL_CHART.run(dataSource, makeChartFn, palette?)`. The `makeChartFn` receives `tools` and returns `fetchAndRender`.
3. Write `chartN/chart.html` — thin preview shell:
   ```html
   <script src="https://d3js.org/d3.v7.min.js"></script>
   <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
   <script src="../shared/theme-v1.js"></script>
   ...
   <div data-tbl-chart data-logo="../shared/tbl-logo-blue.svg"></div>
   <script src="../shared/chart-core.js"></script>
   <script src="../shared/chart.js"></script>
   <script src="chart.js"></script>
   ```
4. Write `chartN/embed.js` — loads theme → core → chart → chartN from `SITE`. Set `data-logo` to `SITE + 'shared/tbl-logo-blue.svg'`.
5. Set `data-logo` to an absolute URL when the logo and host page are on different servers.

Charts that don't use Excel data can pass `{ xlsx: false }` to `ensureDeps()` by calling `TBL_CORE.initChart()` directly with a custom factory, or by pre-loading D3 and skipping SheetJS entirely.
