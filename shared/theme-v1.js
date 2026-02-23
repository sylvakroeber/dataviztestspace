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
      // Graduated shades within the blue family — related/similar series
      blues:       ['#286dc0', '#63aaff', '#d9eaff'],
      // Maximally distinct colors — unrelated series that must be told apart at a glance
      categorical: ['#286dc0', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7']
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
    legendHiddenItemOpacity: 0.4     // legend label/swatch opacity when toggled off
  }

};
