/**
 * TBL Chart Runner — config-driven chart initialiser
 * ---------------------------------------------------
 * Reads config.yaml + data.csv from a chart directory and calls
 * TBL_CHART's drawChart() automatically. No per-chart JavaScript required
 * for standard line/bar charts.
 *
 * Activated by [data-tbl-chart][data-chart-base] elements:
 *   data-chart-base  — URL of the chart directory (trailing slash required)
 *                      e.g. "https://example.com/charts/tariff-tracker-f1/"
 *                      or relative "./" when chart.html lives in the same folder
 *
 * Sets window.TBL_RUNNER = { run, initChart }
 */
(function () {
  'use strict';

  var CDN_JSYAML = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';

  // Deduplicated script loader (same pattern as chart-core.js)
  var _loading = {};
  function loadScript(src) {
    if (_loading[src]) return _loading[src];
    _loading[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
    return _loading[src];
  }

  function ensureJsYaml() {
    return window.jsyaml ? Promise.resolve() : loadScript(CDN_JSYAML);
  }

  // ── Date utilities ──────────────────────────────────────────────────────────

  // Normalise any common date string to "YYYY-MM".
  // Handles: "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS", "YYYY-MM", "YYYY/MM/DD"
  function normalizeDate(raw) {
    if (!raw) return null;
    var s = String(raw).trim();
    // Already YYYY-MM
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    // YYYY-MM-DD (with optional time component or slashes)
    var m = s.replace(/\//g, '-').match(/^(\d{4}-\d{2})/);
    if (m) return m[1];
    return null;
  }

  // ── Tooltip formatter builder ───────────────────────────────────────────────
  // Config fields: tooltipPrefix, tooltipSuffix, tooltipPrecision
  // tooltipPrecision omitted → auto (1 decimal unless value is near-integer)
  function buildFormatter(config) {
    var prefix    = config.tooltipPrefix != null ? String(config.tooltipPrefix) : '';
    var suffix    = config.tooltipSuffix != null ? String(config.tooltipSuffix) : '';
    var precision = config.tooltipPrecision; // number | undefined

    return function (name, v) {
      var str;
      if (precision != null) {
        str = Math.abs(v).toFixed(precision);
      } else {
        // Auto: show one decimal place unless the fractional part is negligible
        var frac = Math.abs(v) % 1;
        str = (frac >= 0.05 && frac <= 0.95) ? v.toFixed(1) : Math.round(v).toString();
      }
      // Thousands separator on the integer part
      var parts = str.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      // Handle negative prefix ordering: -$5 not $-5
      if (v < 0 && prefix) {
        return '-' + prefix + parts.join('.') + suffix;
      }
      return prefix + parts.join('.') + suffix;
    };
  }

  // ── Build the drawChart data object from config + parsed CSV rows ───────────
  function buildDrawData(config, rows) {
    var dateCol = config.dateColumn || 'date';

    // Palette resolution
    var T        = window.TBL_THEME || {};
    var palettes = ((T.colors || {}).palettes) || {};
    var palette  = palettes[config.palette] || palettes.categorical || ['#286dc0', '#bc8c00'];

    // Series
    var series = (config.series || []).map(function (s, i) {
      var color = s.color || palette[i % palette.length];
      var divide   = s.divide   || 1;
      var multiply = s.multiply || 1;

      if (s.type === 'line') {
        var data = rows
          .filter(function (r) { return r[dateCol] && r[s.column] !== '' && r[s.column] != null; })
          .map(function (r) {
            return {
              date:  normalizeDate(r[dateCol]),
              value: parseFloat(r[s.column]) * multiply / divide,
            };
          })
          .filter(function (d) { return d.date && !isNaN(d.value); });

        return {
          type:       'line',
          name:       s.name,
          color:      color,
          yAxis:      s.yAxis      || undefined,
          marker:     s.marker     != null ? s.marker     : undefined,
          markerSize: s.markerSize != null ? s.markerSize : undefined,
          data:       data,
        };
      }

      if (s.type === 'bar') {
        var cats = config.categories || [];
        var catCol = config.categoryColumn || null;
        var data;

        if (catCol) {
          // Rows contain a category column — look up value by category label
          data = cats.map(function (cat) {
            var row = rows.find(function (r) { return r[catCol] === cat; });
            if (!row || row[s.column] === '' || row[s.column] == null) return 0;
            return parseFloat(row[s.column]) * multiply / divide;
          });
        } else {
          // Rows are in category order — use positional mapping
          data = cats.map(function (cat, j) {
            var row = rows[j];
            if (!row || row[s.column] === '' || row[s.column] == null) return 0;
            return parseFloat(row[s.column]) * multiply / divide;
          });
        }

        return {
          type:  'bar',
          name:  s.name,
          color: color,
          yAxis: s.yAxis  || undefined,
          stack: s.stack  != null ? s.stack : undefined,
          data:  data,
        };
      }

      // Unknown type — skip with a warning
      console.warn('[TBL_RUNNER] Unknown series type:', s.type);
      return null;
    }).filter(Boolean);

    // avgValue — from a column (first non-NaN row) or a literal value
    var avgValue = null;
    if (config.avgColumn) {
      var divide = config.avgDivide || 1;
      var mult   = config.avgMultiply || 1;
      for (var i = 0; i < rows.length; i++) {
        var raw = parseFloat(rows[i][config.avgColumn]);
        if (!isNaN(raw)) { avgValue = raw * mult / divide; break; }
      }
    } else if (config.avgValue != null) {
      avgValue = config.avgValue;
    }

    // Vertical annotations: accept strings or objects; optional label field
    var vertAnnotations = (config.verticalAnnotations || []).map(function (a) {
      if (typeof a === 'string') return { date: a, color: 'dim' };
      var entry = { date: a.date, color: a.color || 'dim' };
      if (a.label) { entry.label = String(a.label); entry.side = a.side || 'above'; }
      return entry;
    });

    // Freeform annotations list
    var annotations = (config.annotations || []).map(function (a) {
      return {
        text:  String(a.text || ''),
        x:     a.x  != null ? String(a.x)  : undefined,
        y:     a.y  != null ? +a.y          : undefined,
        side:  a.side  || undefined,
        color: a.color || undefined,
      };
    });

    return {
      figure:              config.figure   || '',
      title:               config.title    || 'Chart',
      unit:                config.unit     || '',
      footnote:            config.footnote || '',
      credit:              config.credit   || '',
      series:              series,
      categories:          config.categories || [],
      horizontal:          config.horizontal  || false,
      yAxis:               config.yAxis || undefined,
      legend:              config.legend,
      avgValue:            avgValue,
      avgLabel:            config.avgLabel     || null,
      avgLabelDate:        config.avgLabelDate || null,
      verticalAnnotations: vertAnnotations,
      annotations:         annotations,
      tooltipFormatter:    buildFormatter(config),
      exportFilename:      config.exportFilename || null,
      exportButton:        config.exportButton   != null ? config.exportButton : undefined,
    };
  }

  // ── Factory passed to TBL_CHART.initChart ───────────────────────────────────
  function makeRunnerFn(baseUrl) {
    return function (tools) {
      return function fetchAndRender() {
        ensureJsYaml()
          .then(function () {
            return fetch(baseUrl + 'config.yaml');
          })
          .then(function (res) {
            if (!res.ok) throw new Error('Could not load config.yaml (HTTP ' + res.status + ')');
            return res.text();
          })
          .then(function (cfgText) {
            var config = jsyaml.load(cfgText);
            var dataFile = config.data || 'data.csv';
            return d3.csv(baseUrl + dataFile).then(function (rows) {
              return { config: config, rows: rows };
            });
          })
          .then(function (result) {
            var data = buildDrawData(result.config, result.rows);
            tools.drawChart(data);
          })
          .catch(function (err) {
            tools.showError(err.message);
          });
      };
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  // Initialise a single placeholder element.
  // The element must have data-chart-base set before this is called.
  function initChart(placeholder) {
    var baseUrl = placeholder.dataset.chartBase;
    if (!baseUrl) {
      console.error('[TBL_RUNNER] Element is missing data-chart-base attribute:', placeholder);
      return;
    }
    // Ensure trailing slash
    if (baseUrl[baseUrl.length - 1] !== '/') baseUrl += '/';
    placeholder.dataset.chartBase = baseUrl;

    // Signal chart-core to skip SheetJS (runner uses CSV + d3.csv)
    placeholder.dataset.noXlsx = '';

    TBL_CHART.initChart(placeholder, null, makeRunnerFn(baseUrl), null);
  }

  // Scan for all [data-tbl-chart][data-chart-base] elements and init each.
  function run() {
    function doRun() {
      document.querySelectorAll('[data-tbl-chart][data-chart-base]').forEach(initChart);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doRun);
    } else {
      doRun();
    }
  }

  window.TBL_RUNNER = { run: run, initChart: initChart };

  // Auto-run when loaded (embed.js loads this last, after the DOM is ready)
  run();

}());
