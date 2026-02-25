# Chart Author Guide — `config.yaml`

Charts built with the config-driven system need two files in their directory:

| File | Purpose |
|------|---------|
| `config.yaml` | Declarative chart specification — everything in this guide |
| `data.csv` | Tidy data file — one row per observation, headers in the first row |

No JavaScript is required for standard line and bar charts. For charts that need custom data transforms or computed series, add a `chart.js` alongside — if it exists, the runner skips the config path entirely (escape hatch).

---

## Minimal example

```yaml
title:  "Monthly Revenue"
unit:   "Billions USD"
data:   data.csv

series:
  - name:   "Nominal"
    type:   line
    column: revenue_nominal_bn
```

---

## Full option reference

### Top-level metadata

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `figure` | string | `""` | Optional figure label shown above the title (e.g. `"Figure 1"`) |
| `title` | string | `"Chart"` | Chart title displayed above the plot |
| `unit` | string | `""` | Y-axis unit label shown below the title (e.g. `"Billions USD"`) |
| `footnote` | string | `""` | Small text below the chart; overrides the theme default |
| `credit` | string | `""` | Source/credit line below footnote; overrides the theme default |
| `palette` | string | `"categorical"` | Named palette from `TBL_THEME.colors.palettes` — e.g. `blue`, `categorical` |
| `legend` | boolean | `true` (when >1 series) | Set `false` to suppress the legend |

---

### Data source

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `data` | string | `"data.csv"` | Filename of the CSV data file, relative to the chart directory |
| `dateColumn` | string | `"date"` | Header name of the date column (for line charts) |
| `categoryColumn` | string | — | Header name of the category column (for bar charts where categories are rows rather than positional) |
| `categories` | string[] | `[]` | Ordered list of category labels for bar charts (required when `type: bar`) |

**Date formats accepted in the date column:** `YYYY-MM-DD`, `YYYY-MM-DD HH:MM:SS`, `YYYY-MM`, `YYYY/MM/DD`. All are normalised to `YYYY-MM` internally.

---

### Series

`series` is a list. Each entry describes one data series.

```yaml
series:
  - name:   "Series display name"
    type:   line           # or: bar
    column: col_header     # CSV column header for this series' values
    color:  "#286dc0"      # optional; falls back to palette[i]
    yAxis:  left           # optional; 'left' (default) or 'right'
    divide: 1000           # optional; divide raw values by this number
    multiply: 1            # optional; multiply raw values by this number

    # Bar-only options:
    stack:  true           # optional; true or a string key to group stacks
```

#### `type: line`

Requires the date column to be present. Each row becomes a `{date, value}` point. Rows where the date or value is empty are dropped.

#### `type: bar`

Requires `categories` (or `categoryColumn`) at the top level. Values are mapped to categories either positionally (default) or by matching the `categoryColumn` value.

#### `divide` and `multiply`

Applied as: `value = raw_value * multiply / divide`. Use `divide: 1000` to convert millions to billions, `multiply: 100` to convert a decimal proportion to a percentage.

---

### Horizontal bars

```yaml
horizontal: true   # swaps axes; band scale becomes the Y axis
```

---

### Dual Y axes

```yaml
yAxis:
  left:
    label: "Volume (units)"
  right:
    label: "Margin (%)"
```

Series assigned to the right axis must set `yAxis: right`. The right axis is only drawn when at least one series uses it.

---

### Horizontal annotation (average / reference line)

A dashed horizontal line with a label. Specify either a column (value read from the first non-null row — use this for a constant stored in your data) or a literal number.

```yaml
# Option A — value from a CSV column:
avgColumn:    avg_2022_2024_bn   # column header
avgDivide:    1000               # optional, same as series divide
avgMultiply:  1                  # optional

# Option B — literal value:
avgValue: 4.2

# Label (applies to both options):
avgLabel:     "2022–2024 avg"
avgLabelDate: "2023-02-01"       # YYYY-MM-DD; sets the x position of the label
```

---

### Vertical annotations

Dotted vertical lines, typically marking policy events.

```yaml
verticalAnnotations:
  - date:  "2025-01-01"   # YYYY-MM-DD
    color: dim             # 'dim' (gray) or 'bright' (orange)
  - date:  "2017-01-20"
    color: bright
    label: "Policy enacted"   # optional — adds a text label at this line
    side:  above              # 'above' (default) or 'below'
```

When `label` is present the text is placed at the top (or bottom) of the vertical line using the collision-avoidance engine, so it will not overlap rendered series.

---

### Freeform annotations

Point or line labels with automatic collision avoidance. Three modes:

| Mode | Required fields | Behavior |
|------|-----------------|----------|
| **A** — x-anchored | `text`, `x` | Label floats on y (top/bottom); no leader line |
| **B** — y-anchored | `text`, `y` | Label floats on x (left/right); no leader line |
| **C** — x+y anchored | `text`, `x`, `y` | Label placed freely; thin leader line to anchor |

```yaml
annotations:
  # Mode A — x-anchored: label floats on y, flips above↔below if blocked
  - text:  "Policy enacted"
    x:     "2023-06"          # YYYY-MM for time series; category name for bar charts
    side:  above              # 'above' (default) or 'below'
    color: dim                # 'dim' (gray), 'bright' (orange), or any hex color

  # Mode B — y-anchored: label floats on x, flips left↔right if blocked
  - text:  "Target: 115"
    y:     115                # data-space value on the left Y axis
    side:  right              # 'right' (default) or 'left'
    color: bright

  # Mode C — x+y anchored: label placed freely with a leader line
  - text:  "Peak: $4.2B"
    x:     "2023-08"
    y:     42.5
    side:  above              # preferred direction hint (above/below/left/right)
    color: bright
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `text` | string | yes | Label text |
| `x` | string | one of `x`/`y` | `YYYY-MM` for time series; category name for categorical |
| `y` | number | one of `x`/`y` | Data-space value on left Y axis |
| `side` | string | no | Preferred placement direction. Defaults to `above`. |
| `color` | string | no | `dim` (gray), `bright` (orange, default), or a hex color string |

The placement engine collects obstacles from rendered line paths, markers, and bars, then finds the first clear position starting from the preferred side. If no clear position exists the label is placed at the least-overlapping candidate.

---

### Tooltip formatting

The tooltip shows values for all series at the hovered point. Use `tooltipPrefix` and `tooltipSuffix` to add currency symbols or units. `tooltipPrecision` controls decimal places; omit it for auto (1 decimal unless the value is effectively an integer).

```yaml
tooltipPrefix:    "$"         # prepended to the formatted number
tooltipSuffix:    " billion"  # appended after the number
tooltipPrecision: 1           # decimal places; omit for auto
```

**Common patterns:**

| Display | Config |
|---------|--------|
| `$4.2 billion` | `prefix: "$"`, `suffix: " billion"` |
| `$3,610` | `prefix: "$"`, precision auto or `0` |
| `18%` | `suffix: "%"`, precision `0` |
| `1.3x` | `suffix: "x"`, precision `1` |
| `104.2` (index) | no prefix/suffix, precision `1` |

---

### PNG export

A "↓ PNG" button is automatically shown in the chart header after the chart renders. Use these fields to customise or suppress it.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `exportFilename` | string | slugified title | Base filename for the downloaded PNG (without `.png` extension) |
| `exportButton` | boolean | `true` | Set `false` to hide the download button entirely |

```yaml
exportFilename: "tariff-tracker-jan-2025"  # → tariff-tracker-jan-2025.png
exportButton:   true                        # set false to hide the button
```

---

## Embedding on an external page

```html
<script data-chart="your-chart-folder-name"
        src="https://sylvakroeber.github.io/dataviztestspace/shared/embed.js">
</script>
```

That's it. The loader creates the placeholder div, loads the script stack, and `chart-runner.js` fetches `config.yaml` and `data.csv` from the GitHub Pages URL automatically.

---

## Adding a new chart

1. Create a folder `chartN/` (e.g. `tariff-tracker-f2/`)
2. Add `data.csv` — one header row, one row per observation
3. Add `config.yaml` using this guide
4. Add `export_data.R` — the R script that generates `data.csv` from the source xlsx
5. Optionally add `chart.html` for local preview (copy from an existing chart)

The chart is live as soon as the files are pushed to the repo.

---

## Escape hatch — custom JavaScript

If a chart needs logic that can't be expressed in config (complex transforms, computed series, a calculator widget), add a `chart.js` in the chart folder. The runner will detect it and skip the config path — the chart behaves exactly like the pre-runner `TBL_CHART.run()` pattern.

The `chart.html` for a custom-code chart loads the script stack plus `chart.js`:

```html
<script src="../shared/chart-core.js"></script>
<script src="../shared/chart-renderer.js"></script>
<script src="chart.js"></script>   <!-- custom logic; no chart-runner.js -->
```
