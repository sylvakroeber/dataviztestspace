/**
 * TBL Theme v1 — Budget Lab house style
 * --------------------------------------
 * Sets window.TBL_THEME with all visual constants used by chart.js.
 * chart.js reads these values with fallbacks, so it works standalone
 * even if this file is not loaded.
 *
 * Versioning rule:
 *   - Bug fix / typo  → edit this file in place (intentional for all charts)
 *   - Visual change   → create theme-v2.js; update new embeds to point there
 */
window.TBL_THEME = {

  colors: {
    background:    '#fff',
    titleText:     '#1a1a2e',
    secondaryText: '#888',
    axisText:      '#666',
    axisStroke:    '#e0e0e0',
    gridline:      '#f0f0f0',
    tooltip:       'rgba(20,20,40,0.65)',
    cursor:        '#999',
    annotationBright: '#f28e2b',  // orange — prominent annotation lines and labels
    annotationDim:    '#bbb',     // gray   — subtle / secondary annotation lines

    // Named palettes — charts select by name; multiple palettes can be used simultaneously
    palettes: {
      // Maximally distinct colors — unrelated series that must be told apart at a glance
      // Hue gaps: 128° | 177° | 121° | 123° | 173° | 145° — min gap 121°
      // All ≥ 3:1 on white. CVD note: lime(1)+orange(3) moderate deuteranopia risk; add markers if paired.
      // ForestGreen(4)+teal(6) 42° apart — B-channel distinguishes under deuteranopia.
      categorical: ['#286dc0', '#5e9e00', '#7040c8', '#c86020', '#00A846', '#c04880', '#1890a0'],
      //             Blue H=212  Lime H=84  Violet H=261  Orange H=22  FrstGrn H=145  Rose H=332  Teal H=187

      // Monochromatic 5-shade scales — darkest to lightest
      // Base color (position 2) matches the corresponding categorical slot
      blue:     ['#101f5b', '#1b3499', '#286dc0', '#63aaff', '#d9eaff'],
      lime:   ['#243600', '#3d5e00', '#5e9e00', '#93c843', '#b4dc78'],
      violet: ['#2a1060', '#4a2498', '#7040c8', '#9068d8', '#b89ee8'],
      green:  ['#00401b', '#00702f', '#00a846', '#3ca869', '#73be92'],
      rose:   ['#481528', '#7a2848', '#c04880', '#d888b0', '#ecc0d4'],
      teal:   ['#083238', '#0e5660', '#1890a0', '#74bcc6', '#badee3'],
      orange: ['#50260d', '#823e15', '#c86020', '#d3804d', '#e8a880']
    }
  },

  typography: {
    fontFamily:     "'Mallory', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    titleSize:      '18px',
    titleMinSize:   '12px',  // floor when title scales down to fit on one line
    titleWeight:    600,
    bodySize:       '13px',  // legend, tooltip, unit label, error
    axisSize:       '11px',  // axis tick labels, y-axis label
    annotationSize: '12px',  // annotation text labels
    smallSize:      '11px'   // footnote, credit line
  },

  spacing: {
    containerPadding: '24px 24px 15px',
    maxWidth:         '900px',
    borderRadius:     '8px',
    logoHeight:       '32px',
    logoOpacity:      0.85
  },

  defaults: {
    creditText:   '',
    footnoteText: ''
  },

  chart: {
    aspectRatio:     0.45,
    margin:          { top: 20, right: 30, bottom: 50, left: 60 },
    lineStrokeWidth: '2.5px',

    // ── X-axis tick label density ─────────────────────────────────────────────
    // Minimum pixel gap between tick marks before the interval steps up.
    // Tick interval snaps through axisTickIntervals (values in months).
    axisTickMinSpacing: 65,
    axisTickIntervals:  [6, 12, 24],
    // ─────────────────────────────────────────────────────────────────────────

    yDomainPadding:          1.1,    // multiplier on d3.max for y-axis upper bound
    yTickCount:              6,      // y-axis tick count passed to d3.axisLeft.ticks(N)
    lineCurve:               'monotoneX',  // d3.curve* name (without 'curve' prefix)
    tooltipOffsetX:          16,     // px right of cursor (flips left near viewport edge)
    tooltipOffsetY:          36,     // px above cursor
    legendHiddenOpacity:     0.15,   // line opacity when series toggled off
    legendHiddenItemOpacity: 0.4,    // legend label/swatch opacity when toggled off

    barPadding:       0.25,   // scaleBand outer/inner padding (0 = bars touch, 1 = no bars)
    groupPadding:     0.10,   // inner-band padding for grouped bars
    barAspectRatio:   0.50,   // height/width ratio for bar/combo charts
    barCornerRadius:  3,      // px, rounded top corners on vertical bars
    barLabelOffset:   4       // px gap for optional value-on-bar labels (future)
  }

};
