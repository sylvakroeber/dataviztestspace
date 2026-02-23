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
      blues:       ['#4e79a7', '#72A4D7', '#a8c8e8', '#c6ddf0'],
      // Maximally distinct colors — unrelated series that must be told apart at a glance
      categorical: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7']
    }
  },

  typography: {
    titleSize:      '18px',
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

  chart: {
    aspectRatio:     0.45,
    margin:          { top: 20, right: 30, bottom: 50, left: 60 },
    lineStrokeWidth: '2.5px'
  }

};
