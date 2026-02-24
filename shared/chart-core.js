/**
 * TBL Chart Core — universal infrastructure
 * ------------------------------------------
 * Sets window.TBL_CORE = { initChart, run, excelDateToYYYYMM }
 *
 * No chart-type-specific code lives here. Chart rendering engines
 * (linechart.js, barchart.js, …) call TBL_CORE.run() or
 * TBL_CORE.initChart() and pass their own drawChartFactory.
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

  function ensureDeps(opts) {
    var o = opts || {};
    var needed = [];
    if (!window.d3)                       needed.push(loadScript(CDN_D3));
    if (o.xlsx !== false && !window.XLSX) needed.push(loadScript(CDN_XLSX));
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
  // dataSource and palette are passed explicitly; data-logo remains a div attribute.
  function initChart(placeholder, drawChartFactory, makeChartFn, dataSource, palette) {
    const uid         = 'tbl-' + Math.random().toString(36).slice(2, 8);
    const DATA_SOURCE = dataSource || 'tariff_impacts_results_20260216.xlsx';
    const LOGO_SRC    = placeholder.dataset.logo || 'shared/TBL_ID_Graph_BrightBlue_KO.svg';

    // ── Theme values (window.TBL_THEME if loaded, else hardcoded fallbacks) ──
    const T   = window.TBL_THEME || {};
    const TC  = T.colors     || {};
    const TY  = T.typography || {};
    const TS  = T.spacing    || {};
    const TCH = T.chart      || {};
    const TD  = T.defaults   || {};

    const bg               = TC.background       || '#fff';
    const titleColor       = TC.titleText        || '#1a1a2e';
    const secondary        = TC.secondaryText    || '#888';
    const axisColor        = TC.axisText         || '#666';
    const axisStroke       = TC.axisStroke       || '#e0e0e0';
    const gridColor        = TC.gridline         || '#f0f0f0';
    const tooltipBg        = TC.tooltip          || 'rgba(20,20,40,0.65)';
    const annotationBright = TC.annotationBright || '#f28e2b';
    const annotationDim    = TC.annotationDim    || '#bbb';
    const cursorColor      = TC.cursor           || '#999';
    const palettes         = TC.palettes         || {};

    // Resolve palette: explicit arg → named palette → categorical → hardcoded defaults
    const resolvedPalette = palettes[palette] || palettes.categorical || ['#286dc0', '#bc8c00'];

    const titleSize    = TY.titleSize      || '18px';
    const titleWeight  = TY.titleWeight    || 600;
    const bodySize     = TY.bodySize       || '13px';
    const axisSize     = TY.axisSize       || '11px';
    const annotSize    = TY.annotationSize || '12px';
    const smallSize    = TY.smallSize      || '11px';
    const titleMinSize = TY.titleMinSize   || '12px';
    const fontFamily   = TY.fontFamily    || "'Mallory', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

    const titleSizePx    = parseFloat(titleSize);
    const titleMinSizePx = parseFloat(titleMinSize);

    const contPadding = TS.containerPadding || '24px 24px 15px';
    const maxWidth    = TS.maxWidth         || '900px';
    const contRadius  = TS.borderRadius     || '8px';
    const logoHeight  = TS.logoHeight       || '32px';
    const logoOpacity = TS.logoOpacity != null ? TS.logoOpacity : 0.85;

    const aspectRatio        = TCH.aspectRatio         || 0.45;
    const margin             = TCH.margin              || { top: 20, right: 30, bottom: 50, left: 60 };
    const strokeWidth        = TCH.lineStrokeWidth     || '2.5px';
    const axisTickMinSpacing = TCH.axisTickMinSpacing  || 65;
    const axisTickIntervals  = TCH.axisTickIntervals   || [6, 12, 24];
    const yDomainPadding     = TCH.yDomainPadding      || 1.1;
    const yTickCount         = TCH.yTickCount          || 6;
    const lineCurve          = TCH.lineCurve           || 'monotoneX';
    const tooltipOffsetX     = TCH.tooltipOffsetX      || 16;
    const tooltipOffsetY     = TCH.tooltipOffsetY      || 36;
    const legendHiddenOpacity     = TCH.legendHiddenOpacity     || 0.15;
    const legendHiddenItemOpacity = TCH.legendHiddenItemOpacity || 0.4;

    const barPadding      = TCH.barPadding      != null ? TCH.barPadding      : 0.25;
    const groupPadding    = TCH.groupPadding    != null ? TCH.groupPadding    : 0.10;
    const barAspectRatio  = TCH.barAspectRatio  != null ? TCH.barAspectRatio  : 0.50;
    const barCornerRadius = TCH.barCornerRadius != null ? TCH.barCornerRadius : 3;

    const defaultCredit   = TD.creditText   != null ? TD.creditText   : '';
    const defaultFootnote = TD.footnoteText || '';

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
        <div id="${uid}-footnote"></div>
        <div id="${uid}-credit"></div>
        <img id="${uid}-logo" src="${LOGO_SRC}" alt="The Budget Lab">
      </div>`;

    // Tooltip must live on <body> because it uses position:fixed relative to viewport
    const ttEl = document.createElement('div');
    ttEl.id = `${uid}-tooltip`;
    document.body.appendChild(ttEl);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const el = suffix => document.getElementById(`${uid}-${suffix}`);

    // Set default credit/footnote text via textContent (safe from injection)
    el('credit').textContent   = defaultCredit;
    el('footnote').textContent = defaultFootnote;

    function showError(msg) {
      const banner = el('error');
      banner.style.display = 'block';
      banner.textContent = 'Error: ' + msg;
    }
    function clearError() { el('error').style.display = 'none'; }

    // ── Inject CSS scoped to this instance ────────────────────────────────────
    const c = `#${uid}-container`;

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      ${c} {
        background: ${bg};
        font-family: ${fontFamily};
        border-radius: ${contRadius};
        padding: ${contPadding};
        max-width: ${maxWidth};
        margin: 0 auto;
        position: relative;
        --tbl-title-size: ${titleSize};
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
      #${uid}-title { font-size: var(--tbl-title-size); font-weight: ${titleWeight}; color: ${titleColor}; }
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
        font-family: ${fontFamily};
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

    // ── Load D3 + SheetJS, then wire up the chart ─────────────────────────────
    ensureDeps().then(() => {

      const ctx = {
        uid, el, ttEl,
        bg, titleColor, secondary, axisColor, axisStroke, gridColor,
        tooltipBg, annotationBright, annotationDim, cursorColor,
        fontFamily,
        palette: resolvedPalette,
        titleSize, titleWeight, bodySize, axisSize, annotSize, smallSize,
        titleSizePx, titleMinSizePx,
        contPadding, maxWidth, contRadius, logoHeight, logoOpacity,
        aspectRatio, margin, strokeWidth, axisTickMinSpacing, axisTickIntervals,
        yDomainPadding, yTickCount, lineCurve,
        tooltipOffsetX, tooltipOffsetY,
        legendHiddenOpacity, legendHiddenItemOpacity,
        barPadding, groupPadding, barAspectRatio, barCornerRadius,
        showError, clearError,
        DATA_SOURCE, placeholder,
      };

      const drawChart = drawChartFactory(ctx);

      const tools = {
        drawChart,
        palette: resolvedPalette,
        showError, clearError,
        excelDateToYYYYMM,
        el, uid,
        DATA_SOURCE, placeholder,
      };

      const fetchAndRender = makeChartFn(tools);

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
  function run(drawChartFactory, makeChartFn, dataSource, palette) {
    function doRun() {
      document.querySelectorAll('[data-tbl-chart]').forEach(placeholder => {
        initChart(placeholder, drawChartFactory, makeChartFn, dataSource, palette);
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doRun);
    } else {
      doRun();
    }
  }

  // ── Shared D3 helper: fitTitle ────────────────────────────────────────────
  // Reads ctx.titleSizePx / ctx.titleMinSizePx; adjusts --tbl-title-size CSS var.
  function fitTitle(ctx, totalWidth) {
    const container = ctx.el('container');
    const titleEl   = ctx.el('title');
    titleEl.style.fontSize   = ctx.titleSizePx + 'px';
    titleEl.style.whiteSpace = 'nowrap';
    const titleNeeded = titleEl.scrollWidth;
    titleEl.style.whiteSpace = '';
    titleEl.style.fontSize   = '';
    const titleFontSize = titleNeeded <= totalWidth
      ? ctx.titleSizePx + 'px'
      : Math.max(ctx.titleMinSizePx, Math.round(ctx.titleSizePx * totalWidth / titleNeeded)) + 'px';
    container.style.setProperty('--tbl-title-size', titleFontSize);
  }

  // ── Shared D3 helper: drawGridlines ──────────────────────────────────────
  // opts: { axis: 'y'|'x', tickCount?, tickValues? }
  function drawGridlines(g, scale, size, opts) {
    const o    = opts || {};
    const axis = o.axis === 'x' ? d3.axisBottom(scale) : d3.axisLeft(scale);
    if (o.tickValues) axis.tickValues(o.tickValues);
    else if (o.tickCount) axis.ticks(o.tickCount);
    axis.tickSize(o.axis === 'x' ? size : -size).tickFormat('');
    g.append('g').attr('class', 'gridline').call(axis).select('.domain').remove();
  }

  // ── Shared D3 helper: buildLinearYAxis ───────────────────────────────────
  // opts: { tickCount?, tickFormat?, label?, marginLeft? }
  function buildLinearYAxis(g, yScale, ctx, opts) {
    const o    = opts || {};
    const axis = d3.axisLeft(yScale).ticks(o.tickCount != null ? o.tickCount : ctx.yTickCount);
    if (o.tickFormat) axis.tickFormat(o.tickFormat);
    const axisG = g.append('g').attr('class', 'axis').call(axis);
    axisG.select('.domain').remove();
    if (o.label) {
      const ml = o.marginLeft != null ? o.marginLeft : ctx.margin.left;
      const h  = Math.abs(yScale.range()[0] - yScale.range()[1]);
      axisG.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -ml + 12).attr('x', -h / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', ctx.axisSize).attr('fill', ctx.secondary)
        .text(o.label);
    }
    return axisG;
  }

  // ── Shared D3 helper: buildTimeXAxis ─────────────────────────────────────
  // opts: { tickFormat? }
  function buildTimeXAxis(g, xScale, ctx, height, opts) {
    const o = opts || {};
    const [xMin, xMax] = xScale.domain();
    const monthSpan    = d3.timeMonth.count(xMin, xMax);
    const width        = Math.abs(xScale.range()[1] - xScale.range()[0]);
    const maxTicks     = Math.max(2, Math.floor(width / ctx.axisTickMinSpacing));
    const rawEvery     = monthSpan / maxTicks;
    const tickEvery    = ctx.axisTickIntervals.find(n => rawEvery <= n)
                         || ctx.axisTickIntervals[ctx.axisTickIntervals.length - 1];
    const fmt          = o.tickFormat || d3.timeFormat('%b %Y');
    g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(d3.timeMonth.every(tickEvery)).tickFormat(fmt))
      .selectAll('text').attr('dy', '1.2em').style('text-anchor', 'middle');
  }

  // ── Shared D3 helper: buildBandXAxis ─────────────────────────────────────
  // opts: { tickFormat?, rotate?: boolean }
  function buildBandXAxis(g, xScale, height, ctx, opts) {
    const o    = opts || {};
    const axis = d3.axisBottom(xScale);
    if (o.tickFormat) axis.tickFormat(o.tickFormat);
    const axisG = g.append('g').attr('class', 'axis')
      .attr('transform', `translate(0,${height})`)
      .call(axis);
    axisG.select('.domain').remove();
    axisG.selectAll('.tick line').remove();
    if (o.rotate) {
      axisG.selectAll('text')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.6em').attr('dy', '0.15em')
        .attr('transform', 'rotate(-35)');
    } else {
      axisG.selectAll('text').attr('dy', '1.2em').style('text-anchor', 'middle');
    }
    return axisG;
  }

  // ── Shared D3 helper: buildBandScales ────────────────────────────────────
  // opts: { grouped?: boolean, horizontal?: boolean }
  // Returns { xOuter, xInner? }
  function buildBandScales(categories, seriesNames, size, ctx, opts) {
    const o = opts || {};
    const xOuter = d3.scaleBand()
      .domain(categories)
      .range([0, size])
      .padding(ctx.barPadding);
    if (!o.grouped || seriesNames.length <= 1) return { xOuter };
    const xInner = d3.scaleBand()
      .domain(seriesNames)
      .range([0, xOuter.bandwidth()])
      .padding(ctx.groupPadding);
    return { xOuter, xInner };
  }

  // ── Shared D3 helper: positionTooltip ────────────────────────────────────
  function positionTooltip(ttEl, event, ctx) {
    ttEl.style.display = 'block';
    const ttWidth = ttEl.offsetWidth;
    const leftPos = event.clientX + ctx.tooltipOffsetX + ttWidth > window.innerWidth
      ? event.clientX - ctx.tooltipOffsetX - ttWidth
      : event.clientX + ctx.tooltipOffsetX;
    ttEl.style.left = leftPos + 'px';
    ttEl.style.top  = (event.clientY - ctx.tooltipOffsetY) + 'px';
  }

  // ── Shared D3 helper: buildLegend ─────────────────────────────────────────
  // series: [{ name, color }], onToggle(name, isVisible)
  function buildLegend(legendEl, series, ctx, onToggle) {
    legendEl.innerHTML = '';
    series.forEach(s => {
      const item   = document.createElement('div');
      item.className = 'tbl-legend-item';
      const swatch = document.createElement('div');
      swatch.className = 'tbl-legend-swatch';
      swatch.style.background = s.color;
      const label  = document.createElement('span');
      label.textContent = s.name;
      item.appendChild(swatch);
      item.appendChild(label);
      let visible = true;
      item.addEventListener('click', () => {
        visible = !visible;
        item.style.opacity = visible ? 1 : ctx.legendHiddenItemOpacity;
        if (onToggle) onToggle(s.name, visible);
      });
      legendEl.appendChild(item);
    });
  }

  window.TBL_CORE = {
    initChart, run, excelDateToYYYYMM, ensureDeps,
    fitTitle, drawGridlines, buildLinearYAxis, buildTimeXAxis,
    buildBandXAxis, buildBandScales, positionTooltip, buildLegend,
  };

})();
