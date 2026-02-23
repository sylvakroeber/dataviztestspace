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
  // dataSource and palette are passed explicitly; data-logo remains a div attribute.
  function initChart(placeholder, drawChartFactory, makeChartFn, dataSource, palette) {
    const uid         = 'tbl-' + Math.random().toString(36).slice(2, 8);
    const DATA_SOURCE = dataSource || 'tariff_impacts_results_20260216.xlsx';
    const LOGO_SRC    = placeholder.dataset.logo || 'TBL_ID_Graph_BrightBlue_KO.svg';

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

    // Resolve palette: explicit arg → named palette → blues → hardcoded defaults
    const resolvedPalette = palettes[palette] || palettes.blues || ['#286dc0', '#63aaff'];

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
        palette: resolvedPalette,
        titleSize, titleWeight, bodySize, axisSize, annotSize, smallSize,
        titleSizePx, titleMinSizePx,
        contPadding, maxWidth, contRadius, logoHeight, logoOpacity,
        aspectRatio, margin, strokeWidth, axisTickMinSpacing, axisTickIntervals,
        yDomainPadding, yTickCount, lineCurve,
        tooltipOffsetX, tooltipOffsetY,
        legendHiddenOpacity, legendHiddenItemOpacity,
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

  window.TBL_CORE = { initChart, run, excelDateToYYYYMM, ensureDeps };

})();
