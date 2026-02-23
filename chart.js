/**
 * TBL Chart — core logic
 * ----------------------
 * Finds every <div data-tbl-chart> on the page and renders an isolated
 * D3 chart instance into each one. Used by both chart.html (standalone
 * preview) and embed.js (third-party embeds).
 *
 * Attributes on the placeholder <div>:
 *   data-src  — URL to the .xlsx file (HTTP/HTTPS + CORS required)
 *   data-logo — URL to the SVG logo (falls back to relative path)
 *
 * Visual values are read from window.TBL_THEME (set by theme-v1.js or
 * a later version). Every read uses an || fallback so the chart works
 * standalone even when no theme file is loaded.
 */
(function () {
  'use strict';

  const CDN_D3   = 'https://d3js.org/d3.v7.min.js';
  const CDN_XLSX = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';

  // Cache in-flight loads so multiple charts on the same page don't double-load
  const _loading = {};

  function loadScript(src) {
    if (_loading[src]) return _loading[src];
    _loading[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
    return _loading[src];
  }

  function ensureDeps() {
    const needed = [];
    if (!window.d3)   needed.push(loadScript(CDN_D3));
    if (!window.XLSX) needed.push(loadScript(CDN_XLSX));
    return Promise.all(needed);
  }

  // ── Excel serial date → "YYYY-MM" ──────────────────────────────────────────
  function excelDateToYYYYMM(serial) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  // ── Chart factory — one call per placeholder div ────────────────────────────
  function initChart(placeholder) {
    const uid         = 'tbl-' + Math.random().toString(36).slice(2, 8);
    const DATA_SOURCE = placeholder.dataset.src  || 'tariff_impacts_results_20260216.xlsx';
    const LOGO_SRC    = placeholder.dataset.logo || 'TBL_ID_Graph_BrightBlue_KO.svg';

    // ── Theme values (window.TBL_THEME if loaded, else hardcoded fallbacks) ──
    const T   = window.TBL_THEME || {};
    const TC  = T.colors     || {};
    const TY  = T.typography || {};
    const TS  = T.spacing    || {};
    const TCH = T.chart      || {};

    const bg            = TC.background      || '#fff';
    const titleColor    = TC.titleText       || '#1a1a2e';
    const secondary     = TC.secondaryText   || '#888';
    const axisColor     = TC.axisText        || '#666';
    const axisStroke    = TC.axisStroke      || '#e0e0e0';
    const gridColor     = TC.gridline        || '#f0f0f0';
    const tooltipBg     = TC.tooltip         || 'rgba(20,20,40,0.65)';
    const annotation    = TC.annotation      || '#f28e2b';
    const annotLine     = TC.annotationLine  || '#bbb';
    const cursorColor   = TC.cursor          || '#999';
    const seriesPalette = TC.series          || ['#4e79a7', '#72A4D7'];

    const titleSize    = TY.titleSize       || '18px';
    const titleWeight  = TY.titleWeight     || 600;
    const bodySize     = TY.bodySize        || '13px';
    const axisSize     = TY.axisSize        || '11px';
    const annotSize    = TY.annotationSize  || '12px';
    const smallSize    = TY.smallSize       || '11px';

    const contPadding  = TS.containerPadding || '24px 24px 15px';
    const maxWidth     = TS.maxWidth         || '900px';
    const contRadius   = TS.borderRadius     || '8px';
    const logoHeight   = TS.logoHeight       || '32px';
    const logoOpacity  = TS.logoOpacity != null ? TS.logoOpacity : 0.85;

    const aspectRatio  = TCH.aspectRatio     || 0.45;
    const margin       = TCH.margin          || { top: 20, right: 30, bottom: 50, left: 60 };
    const strokeWidth  = TCH.lineStrokeWidth || '2.5px';

    // ── Inject HTML ───────────────────────────────────────────────────────────
    placeholder.innerHTML = `
      <div id="${uid}-container">
        <div id="${uid}-header">
          <div>
            <div id="${uid}-title">Loading\u2026</div>
            <div id="${uid}-unit"></div>
          </div>
        </div>
        <div id="${uid}-legend"></div>
        <div id="${uid}-wrapper"></div>
        <div id="${uid}-error"></div>
        <div id="${uid}-footnote">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.</div>
        <div id="${uid}-credit">Chart: The Budget Lab &middot; Source: The Budget Lab Analysis</div>
        <img id="${uid}-logo" src="${LOGO_SRC}" alt="The Budget Lab">
      </div>`;

    // Tooltip must live on <body> because it uses position:fixed relative to viewport
    const ttEl = document.createElement('div');
    ttEl.id = `${uid}-tooltip`;
    document.body.appendChild(ttEl);

    // ── Inject CSS scoped to this instance ────────────────────────────────────
    // Every rule is prefixed with the unique container ID or the UID-prefixed
    // element ID, so nothing leaks to or from the host page.
    const c = `#${uid}-container`;   // shorthand scope prefix for SVG classes

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      ${c} {
        background: ${bg};
        border-radius: ${contRadius};
        padding: ${contPadding};
        max-width: ${maxWidth};
        margin: 0 auto;
        position: relative;
      }
      #${uid}-logo {
        position: absolute;
        bottom: 16px; right: 20px;
        height: ${logoHeight}; width: auto;
        opacity: ${logoOpacity};
      }
      #${uid}-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      #${uid}-title { font-size: ${titleSize}; font-weight: ${titleWeight}; color: ${titleColor}; }
      #${uid}-unit  { font-size: ${bodySize}; color: ${secondary}; margin-top: 2px; }
      #${uid}-wrapper svg { display: block; width: 100%; }
      ${c} .axis text { font-size: ${axisSize}; fill: ${axisColor}; }
      ${c} .axis path, ${c} .axis line { stroke: ${axisStroke}; stroke-width: 1px; fill: none; }
      ${c} .gridline line { stroke: ${gridColor}; stroke-width: 1px; stroke-dasharray: 3,3; }
      ${c} .line-path { fill: none; stroke-width: ${strokeWidth}; transition: opacity 0.3s; }
      ${c} .dot { transition: r 0.15s; cursor: pointer; }
      #${uid}-tooltip {
        position: fixed;
        pointer-events: none;
        background: ${tooltipBg};
        color: #fff;
        border-radius: 6px;
        padding: 9px 13px;
        font-size: ${bodySize};
        line-height: 1.6;
        display: none;
        z-index: 9999;
      }
      #${uid}-legend {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        margin-bottom: 14px;
        justify-content: center;
      }
      ${c} .tbl-legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: ${bodySize};
        cursor: pointer;
        user-select: none;
      }
      ${c} .tbl-legend-swatch { width: 14px; height: 14px; border-radius: 3px; }
      #${uid}-footnote {
        font-size: ${smallSize}; color: ${secondary};
        line-height: 1.5; margin-top: 10px; padding-right: 160px;
      }
      #${uid}-credit {
        font-size: ${smallSize}; color: ${secondary};
        margin-top: 4px; padding-right: 160px;
      }
      #${uid}-error {
        display: none;
        background: #fff3f3; border: 1px solid #f5c6cb;
        border-radius: 6px; padding: 10px 14px;
        color: #721c24; font-size: ${bodySize}; margin-top: 12px;
      }`;
    document.head.appendChild(styleEl);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const el = suffix => document.getElementById(`${uid}-${suffix}`);

    function showError(msg) {
      const banner = el('error');
      banner.style.display = 'block';
      banner.textContent = 'Error: ' + msg;
    }
    function clearError() { el('error').style.display = 'none'; }

    // ── Load D3 + SheetJS, then wire up the chart ─────────────────────────────
    ensureDeps().then(() => {

      // These rely on d3 being present, so they live inside the .then()
      const parseMonth  = d3.timeParse('%Y-%m');
      const formatMonth = d3.timeFormat('%b %Y');

      // ── Draw ───────────────────────────────────────────────────────────────
      function drawChart(data) {
        clearError();
        el('title').textContent = data.title || 'Chart';
        el('unit').textContent  = data.unit  || '';

        const wrapper = el('wrapper');
        wrapper.innerHTML = '';

        const totalWidth  = wrapper.clientWidth || 800;
        const totalHeight = Math.round(totalWidth * aspectRatio);
        const width  = totalWidth  - margin.left - margin.right;
        const height = totalHeight - margin.top  - margin.bottom;

        const svg = d3.select(`#${uid}-wrapper`)
          .append('svg')
          .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
          .attr('preserveAspectRatio', 'xMidYMid meet');

        const g = svg.append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);

        const series = data.series.map(s => ({
          ...s,
          parsed: s.data.map(d => ({ date: parseMonth(d.date), value: +d.value }))
        }));

        const allDates  = series.flatMap(s => s.parsed.map(d => d.date));
        const allValues = series.flatMap(s => s.parsed.map(d => d.value));

        const x = d3.scaleTime()
          .domain(d3.extent(allDates))
          .range([0, width]);

        const y = d3.scaleLinear()
          .domain([0, d3.max(allValues) * 1.1])
          .nice()
          .range([height, 0]);

        // Gridlines
        g.append('g').attr('class', 'gridline')
          .call(d3.axisLeft(y).tickSize(-width).tickFormat(''))
          .select('.domain').remove();

        // Vertical annotation — Jan 1 2025
        g.append('line')
          .attr('x1', x(new Date('2025-01-01'))).attr('x2', x(new Date('2025-01-01')))
          .attr('y1', 0).attr('y2', height)
          .attr('stroke', annotLine).attr('stroke-width', 1).attr('stroke-dasharray', '4,4');

        // Axes
        g.append('g').attr('class', 'axis')
          .attr('transform', `translate(0,${height})`)
          .call(d3.axisBottom(x).ticks(d3.timeMonth.every(6)).tickFormat(formatMonth))
          .selectAll('text').attr('dy', '1.2em').style('text-anchor', 'middle');

        g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6));

        // Y-axis label
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', -margin.left + 12).attr('x', -height / 2)
          .attr('text-anchor', 'middle').attr('font-size', axisSize).attr('fill', secondary)
          .text(data.unit || '');

        const line = d3.line()
          .x(d => x(d.date))
          .y(d => y(d.value))
          .curve(d3.curveMonotoneX);

        // Lines
        series.forEach(s => {
          g.append('path')
            .datum(s.parsed)
            .attr('class', 'line-path')
            .attr('id', `${uid}-line-${s.name.replace(/[^a-zA-Z0-9]+/g, '-')}`)
            .attr('stroke', s.color || seriesPalette[0])
            .attr('d', line);
        });

        // Horizontal avg annotation
        if (data.avgValue != null) {
          const ay = y(data.avgValue);
          g.append('line')
            .attr('x1', 0).attr('x2', width).attr('y1', ay).attr('y2', ay)
            .attr('stroke', annotation).attr('stroke-width', 1.5).attr('stroke-dasharray', '5,4');
          g.append('text')
            .attr('x', x(new Date('2023-02-01'))).attr('y', ay - 10)
            .attr('text-anchor', 'start').attr('font-size', annotSize).attr('fill', annotation)
            .text(data.avgLabel || 'Avg');
        }

        // Cursor line (sits above series, below overlay)
        const cursorLine = g.append('line')
          .attr('y1', 0).attr('y2', height)
          .attr('stroke', cursorColor).attr('stroke-width', 1)
          .attr('pointer-events', 'none').style('display', 'none');

        // Legend
        const legendEl = el('legend');
        legendEl.innerHTML = '';
        series.forEach(s => {
          const item   = document.createElement('div');
          item.className = 'tbl-legend-item';
          const swatch = document.createElement('div');
          swatch.className = 'tbl-legend-swatch';
          swatch.style.background = s.color || seriesPalette[0];
          const label  = document.createElement('span');
          label.textContent = s.name;
          item.appendChild(swatch);
          item.appendChild(label);

          let visible = true;
          item.addEventListener('click', () => {
            visible = !visible;
            d3.select(`#${uid}-line-${s.name.replace(/[^a-zA-Z0-9]+/g, '-')}`)
              .style('opacity', visible ? 1 : 0.15);
            item.style.opacity = visible ? 1 : 0.4;
          });
          legendEl.appendChild(item);
        });

        // Invisible overlay — captures mouse events; must be last (on top)
        const bisect = d3.bisector(d => d.date).left;

        g.append('rect')
          .attr('width', width).attr('height', height)
          .attr('fill', 'none').attr('pointer-events', 'all')
          .on('mousemove', function (event) {
            const [mx]    = d3.pointer(event);
            const hovDate = x.invert(mx);
            const ref     = series[0].parsed;
            const i       = bisect(ref, hovDate, 1);
            const d0      = ref[i - 1], d1 = ref[i] || d0;
            const nearest = (hovDate - d0.date > d1.date - hovDate) ? d1 : d0;
            const nx      = x(nearest.date);

            cursorLine.attr('x1', nx).attr('x2', nx).style('display', null);

            let html = `<strong>${formatMonth(nearest.date)}</strong><br/>`;
            series.forEach(s => {
              const pt = s.parsed.find(p => p.date.getTime() === nearest.date.getTime());
              if (pt) {
                const v = pt.value.toFixed(1).endsWith('.0')
                  ? `$${pt.value.toFixed(0)} billion`
                  : `$${pt.value.toFixed(1)} billion`;
                html += `<span style="color:${s.color}">&#9679;</span> ${s.name}: <strong>${v}</strong><br/>`;
              }
            });

            ttEl.innerHTML = html;
            ttEl.style.display = 'block';
            const ttWidth = ttEl.offsetWidth;
            const leftPos = event.clientX + 16 + ttWidth > window.innerWidth
              ? event.clientX - 16 - ttWidth
              : event.clientX + 16;
            ttEl.style.left = leftPos + 'px';
            ttEl.style.top  = (event.clientY - 36) + 'px';
          })
          .on('mouseout', () => {
            cursorLine.style('display', 'none');
            ttEl.style.display = 'none';
          });
      }

      // ── Fetch + parse xlsx ─────────────────────────────────────────────────
      async function fetchAndRender() {
        try {
          const res = await fetch(DATA_SOURCE + '?_=' + Date.now());
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer   = await res.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheet    = workbook.Sheets['F1'];
          const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const title    = rows[0][0] || 'Chart';
          const unit     = 'Billions USD';
          const dataRows = rows.slice(6).filter(r => r[0]);

          const seriesDefs = [
            { name: 'Customs duties (nominal USD)', color: seriesPalette[0] || '#4e79a7', col: 1 },
            { name: 'Customs duties (2025 USD)',    color: seriesPalette[1] || '#72A4D7', col: 2 },
          ];

          const series = seriesDefs.map(s => ({
            name:  s.name,
            color: s.color,
            data:  dataRows
              .map(r => ({ date: excelDateToYYYYMM(r[0]), value: +r[s.col] / 1000 }))
              .filter(d => d.date && !isNaN(d.value))
          }));

          const avgValue = dataRows.length ? +dataRows[0][3] / 1000 : null;
          const avgLabel = '2022\u20132024 avg (2025 USD)';

          drawChart({ title, unit, series, avgValue, avgLabel });
        } catch (err) {
          showError(err.message);
        }
      }

      // ── Boot ───────────────────────────────────────────────────────────────
      fetchAndRender();

      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          const wrapper = el('wrapper');
          if (wrapper && wrapper.innerHTML !== '') fetchAndRender();
        }, 200);
      });

    }).catch(err => showError(err.message));
  }

  // ── Initialize all placeholders on the page ───────────────────────────────
  function run() {
    document.querySelectorAll('[data-tbl-chart]').forEach(initChart);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
