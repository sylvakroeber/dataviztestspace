/**
 * TBL Unified Chart Renderer
 * ---------------------------
 * Sets window.TBL_CHART = { run, initChart }
 *
 * Depends on TBL_CORE (chart-core.js must load first).
 * Supports series types: 'line' (time scale) and 'bar' (categorical scale).
 * Arbitrary combinations are supported — bars render before lines so lines sit on top.
 *
 * Usage:
 *   TBL_CHART.run(dataSource, makeChartFn, palette?)
 *   TBL_CHART.initChart(element, dataSource, makeChartFn, palette?)
 */
(function () {
  'use strict';

  // ── Export module state ───────────────────────────────────────────────────
  var _logoCache      = {};   // URL → base64 data URI
  var _exportReady    = false;
  var _lastSVGString  = null;

  // ── Curve map (D3 named curves) ───────────────────────────────────────────
  function getCurveFn(name) {
    var map = {
      monotoneX:  'curveMonotoneX',
      monotoneY:  'curveMonotoneY',
      linear:     'curveLinear',
      cardinal:   'curveCardinal',
      catmullRom: 'curveCatmullRom',
      step:       'curveStep',
      stepAfter:  'curveStepAfter',
      stepBefore: 'curveStepBefore',
    };
    var key = map[name] || 'curveMonotoneX';
    return d3[key] || d3.curveMonotoneX;
  }

  // ── Marker symbol map & size presets ─────────────────────────────────────
  // Keys resolve to d3[key] at render time (d3 may not be loaded yet at module eval).
  // Standard order: circle, triangle, square, diamond, star, cross, wye
  var MARKER_SYMBOL_NAMES = {
    circle:   'symbolCircle',
    triangle: 'symbolTriangle',
    square:   'symbolSquare',
    diamond:  'symbolDiamond',
    star:     'symbolStar',
    cross:    'symbolCross',
    wye:      'symbolWye',
  };
  var MARKER_SIZE_SMALL = 40;   // sq px — d3.symbol size units (≈ 3.6px radius for circle)
  var MARKER_SIZE_LARGE = 100;  // sq px (≈ 5.6px radius for circle)

  // ── Safe CSS ID segment from a series name ────────────────────────────────
  function safeName(name) {
    return String(name).replace(/[^a-zA-Z0-9]+/g, '-');
  }

  // ── Inject scoped CSS for chart elements ──────────────────────────────────
  function injectChartCSS(uid, ctx) {
    var c  = '#' + uid + '-container';
    var sw = ctx.strokeWidth || window.TBL_THEME && window.TBL_THEME.chart && window.TBL_THEME.chart.lineStrokeWidth || '2.5px';
    var styleEl = document.createElement('style');
    styleEl.setAttribute('data-tbl-chart-css', uid);
    styleEl.textContent = [
      c + ' .tbl-line-path   { fill: none; stroke-width: ' + sw + '; transition: opacity 0.3s; }',
      c + ' .tbl-bar         { transition: opacity 0.2s; }',
      c + ' .tbl-cursor      { pointer-events: none; }',
      c + ' .tbl-bar-cursor  { pointer-events: none; }',
      c + ' .tbl-dot         { transition: r 0.15s; cursor: pointer; }',
      c + ' .tbl-marker-group { transition: opacity 0.3s; }',
      c + ' .tbl-marker      { pointer-events: none; }',
      c + ' .tbl-annot-label  { pointer-events: none; }',
      c + ' .tbl-annot-leader { pointer-events: none; }',
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  // ── Pre-compute d3.stack() offsets for stacked bar groups ─────────────────
  function computeStackOffsets(series, categories) {
    // Group series by stack key (s.stack === true → '__default__')
    var stackGroups = {};
    series.filter(function (s) { return s.type === 'bar' && s.stack; }).forEach(function (s) {
      var key = s.stack === true ? '__default__' : s.stack;
      if (!stackGroups[key]) stackGroups[key] = [];
      stackGroups[key].push(s);
    });

    // Result map: seriesName → array of [y0, y1] per category index
    var offsets = {};

    Object.keys(stackGroups).forEach(function (key) {
      var group = stackGroups[key];
      // Build data array: one object per category, keys = series names
      var stackData = categories.map(function (cat, i) {
        var obj = { __cat__: cat };
        group.forEach(function (s) { obj[s.name] = s.data[i] || 0; });
        return obj;
      });
      var keys = group.map(function (s) { return s.name; });
      var stacked = d3.stack().keys(keys)(stackData);
      stacked.forEach(function (layer) {
        offsets[layer.key] = layer.map(function (d) { return [d[0], d[1]]; });
      });
    });

    return offsets;
  }

  // ── Render a single bar series ────────────────────────────────────────────
  // scales must carry: catScale (band), valScale (linear), xInner? (inner band for grouped)
  function _renderBarSeries(g, s, scales, yScale, ctx, data, stackOffsets, seriesIndex) {
    var uid       = ctx.uid;
    var cats      = data.categories;
    var horiz     = !!data.horizontal;
    var catScale  = scales.catScale;   // band scale — range [0,height] for horiz, [0,width] for vert
    var valScale  = scales.valScale;   // linear scale — range [0,width] for horiz, [height,0] for vert
    var xInner    = scales.xInner;
    var r         = ctx.barCornerRadius;
    var isGrouped = !!xInner;
    var isStacked = !!s.stack;
    var color     = s._color || s.color || ctx.palette[seriesIndex] || ctx.palette[0];

    var barG = g.append('g').attr('class', 'tbl-bar-series');

    cats.forEach(function (cat, i) {
      // Band position and thickness (in category-axis pixel space)
      var band0 = catScale(cat);
      var bandW;
      if (isGrouped) {
        band0 += xInner(s.name);
        bandW  = xInner.bandwidth();
      } else {
        bandW  = catScale.bandwidth();
      }

      // Value extent in value-axis pixel space
      var pxLo, pxHi;  // pxLo ≤ pxHi always
      if (isStacked && stackOffsets[s.name]) {
        var pair = stackOffsets[s.name][i];
        var pa = valScale(pair[0]);
        var pb = valScale(pair[1]);
        pxLo = Math.min(pa, pb);
        pxHi = Math.max(pa, pb);
      } else {
        var va = valScale(0);
        var vb = valScale(s.data[i] || 0);
        pxLo = Math.min(va, vb);
        pxHi = Math.max(va, vb);
      }
      var barLen = Math.max(0, pxHi - pxLo);

      var el;
      if (!horiz) {
        // Vertical: x=band0, y=pxLo(top), w=bandW, h=barLen; rounded top corners
        var needsRound = r > 0 && barLen > r;
        if (needsRound) {
          var rx = Math.min(r, bandW / 2);
          var dp = 'M' + band0 + ',' + (pxLo + rx) +
              ' Q' + band0 + ',' + pxLo + ' ' + (band0 + rx) + ',' + pxLo +
              ' L' + (band0 + bandW - rx) + ',' + pxLo +
              ' Q' + (band0 + bandW) + ',' + pxLo + ' ' + (band0 + bandW) + ',' + (pxLo + rx) +
              ' L' + (band0 + bandW) + ',' + (pxLo + barLen) +
              ' L' + band0 + ',' + (pxLo + barLen) + ' Z';
          el = barG.append('path').attr('d', dp);
        } else {
          el = barG.append('rect')
            .attr('x', band0).attr('y', pxLo)
            .attr('width', bandW).attr('height', barLen);
        }
      } else {
        // Horizontal: y=band0, x=pxLo(left), h=bandW, w=barLen; rounded right corners
        var needsRoundH = r > 0 && barLen > r;
        if (needsRoundH) {
          var rxh  = Math.min(r, bandW / 2);
          var hx1  = pxLo + barLen;
          var dph  = 'M' + pxLo + ',' + band0 +
              ' L' + (hx1 - rxh) + ',' + band0 +
              ' Q' + hx1 + ',' + band0 + ' ' + hx1 + ',' + (band0 + rxh) +
              ' L' + hx1 + ',' + (band0 + bandW - rxh) +
              ' Q' + hx1 + ',' + (band0 + bandW) + ' ' + (hx1 - rxh) + ',' + (band0 + bandW) +
              ' L' + pxLo + ',' + (band0 + bandW) + ' Z';
          el = barG.append('path').attr('d', dph);
        } else {
          el = barG.append('rect')
            .attr('x', pxLo).attr('y', band0)
            .attr('width', barLen).attr('height', bandW);
        }
      }

      el.attr('class', 'tbl-bar')
        .attr('data-series', s.name)
        .attr('id', uid + '-bar-' + safeName(s.name) + '-' + i)
        .attr('fill', color);
    });

    return barG;
  }

  // ── Render a single line series ───────────────────────────────────────────
  // Handles two data formats:
  //   Time mode:        s.data = [{ date: 'YYYY-MM', value: number }]
  //   Categorical mode: s.data = number[]  (x position = band center per index)
  function _renderLineSeries(g, s, xScale, yScale, ctx, seriesIndex, parseMonth, categories) {
    var uid      = ctx.uid;
    var curveFn  = getCurveFn(ctx.lineCurve);
    var isCatLine = Array.isArray(s.data) && (s.data.length === 0 || typeof s.data[0] === 'number');
    var parsed;

    if (isCatLine) {
      // Categorical line: plot at band center for each index
      var bw = xScale.bandwidth ? xScale.bandwidth() / 2 : 0;
      parsed = s.data.map(function (v, i) {
        var cat = categories[i];
        return { x: (xScale(cat) || 0) + bw, value: +v };
      });
    } else {
      parsed = s.data.map(function (d) {
        return { date: parseMonth(d.date), value: +d.value };
      });
    }

    var line = isCatLine
      ? d3.line()
          .x(function (d) { return d.x; })
          .y(function (d) { return yScale(d.value); })
          .defined(function (d) { return d.value != null && !isNaN(d.value); })
          .curve(getCurveFn('linear'))
      : d3.line()
          .x(function (d) { return xScale(d.date); })
          .y(function (d) { return yScale(d.value); })
          .defined(function (d) { return d.value != null && !isNaN(d.value); })
          .curve(curveFn);

    var path = g.append('path')
      .datum(parsed)
      .attr('class', 'tbl-line-path')
      .attr('id', uid + '-line-' + safeName(s.name))
      .attr('stroke', s.color || ctx.palette[seriesIndex] || ctx.palette[0])
      .attr('d', line);

    // ── Markers ──────────────────────────────────────────────────────────────
    // s.marker: undefined/false = none | true = circle | string name = that shape
    // s.markerSize: 'small' (default) | 'large' | number (custom sq-px area)
    var markerGroupId = null;
    var markerSpec    = s.marker;
    if (markerSpec) {
      var markerName  = (markerSpec === true) ? 'circle' : String(markerSpec).toLowerCase();
      var symbolKey   = MARKER_SYMBOL_NAMES[markerName] || 'symbolCircle';
      var symbolType  = d3[symbolKey] || d3.symbolCircle;
      var rawSize     = s.markerSize;
      var sizePx      = rawSize === 'large'        ? MARKER_SIZE_LARGE
                      : typeof rawSize === 'number' ? rawSize
                      :                              MARKER_SIZE_SMALL;
      var symbolGen   = d3.symbol().type(symbolType).size(sizePx);
      var markerColor = s._color || s.color || ctx.palette[seriesIndex] || ctx.palette[0];
      var validPts    = parsed.filter(function (d) { return d.value != null && !isNaN(d.value); });
      markerGroupId   = uid + '-markers-' + safeName(s.name);
      g.append('g')
        .attr('class', 'tbl-marker-group')
        .attr('id', markerGroupId)
        .selectAll('path')
        .data(validPts)
        .enter()
        .append('path')
        .attr('class', 'tbl-marker')
        .attr('transform', function (d) {
          var px = isCatLine ? d.x : xScale(d.date);
          var py = yScale(d.value);
          return 'translate(' + px + ',' + py + ')';
        })
        .attr('d', symbolGen)
        .attr('fill', markerColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    }

    return { path: path, parsed: parsed, isCatLine: isCatLine, markerGroupId: markerGroupId };
  }

  // ── Annotation placement helpers ──────────────────────────────────────────

  // Estimate label width/height in px given the annotation text and ctx.
  function _estimateLabelBBox(text, ctx) {
    var fontSize = parseFloat(ctx.annotSize) || 12;
    return { w: text.length * fontSize * 0.58, h: fontSize * 1.3 };
  }

  // Build an obstacle list (axis-aligned bboxes in chart-area px space) from
  // rendered line paths, markers, and bar elements.
  function _collectObstacles(uid, renderedLines, xScale, yLeft) {
    var obstacles = [];

    // Line segments — sampled at 4 px steps along each segment
    renderedLines.forEach(function (rl) {
      var pts = rl.parsed;
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i], p1 = pts[i + 1];
        if (p0.value == null || isNaN(p0.value) || p1.value == null || isNaN(p1.value)) continue;
        var x0 = rl.isCatLine ? p0.x : (xScale ? xScale(p0.date) : 0);
        var y0 = yLeft(p0.value);
        var x1 = rl.isCatLine ? p1.x : (xScale ? xScale(p1.date) : 0);
        var y1 = yLeft(p1.value);
        var dx = x1 - x0, dy = y1 - y0;
        var steps = Math.max(1, Math.floor(Math.sqrt(dx * dx + dy * dy) / 4));
        for (var t = 0; t <= steps; t++) {
          var frac = t / steps;
          var xPx = x0 + dx * frac, yPx = y0 + dy * frac;
          obstacles.push({ x: xPx - 3, y: yPx - 3, w: 6, h: 6 });
        }
      }
    });

    // Markers — computed from renderedLines data (no DOM query needed)
    renderedLines.forEach(function (rl) {
      if (!rl.markerGroupId) return;
      var rawSize = rl.s.markerSize;
      var sizePx  = rawSize === 'large'        ? MARKER_SIZE_LARGE
                  : typeof rawSize === 'number' ? rawSize
                  :                              MARKER_SIZE_SMALL;
      var r = Math.sqrt(sizePx / Math.PI) + 2;
      rl.parsed.forEach(function (d) {
        if (d.value == null || isNaN(d.value)) return;
        var cx = rl.isCatLine ? d.x : (xScale ? xScale(d.date) : 0);
        var cy = yLeft(d.value);
        obstacles.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 });
      });
    });

    // Bars — from DOM via getBBox() (works for both <rect> and <path> elements)
    var barEls = document.querySelectorAll('#' + uid + '-container .tbl-bar');
    barEls.forEach(function (el) {
      try {
        var bb = el.getBBox();
        if (bb.width > 0 && bb.height > 0) {
          obstacles.push({ x: bb.x, y: bb.y, w: bb.width, h: bb.height });
        }
      } catch (e) { /* getBBox may fail in headless environments */ }
    });

    return obstacles;
  }

  // 1D placement: one axis fixed (fixedPx = center on that axis), label floats
  // on the other axis.  freeDim = total chart dimension on the free axis.
  // side: 'above'|'below' (y free) or 'left'|'right' (x free).
  // Returns { freePx } — center of the placed label on the free axis.
  //
  // Algorithm: enumerate every gap wide enough to hold the label, then pick the
  // gap whose clamped preferred position is closest to the ideal.  This scans
  // the ENTIRE axis — unlike a directional scan from one end it will always find
  // a clear region even when it is on the opposite side from the preferred edge.
  function _placeLabel1D(fixedPx, preferredFreePx, labelW, labelH, obstacles, freeDim, side) {
    var PAD = 5;
    var isYFree     = (side === 'above' || side === 'below');
    var fixedHalf   = isYFree ? labelW / 2 : labelH / 2;
    var freeLabelSz = isYFree ? labelH      : labelW;

    // Collect obstacle intervals on the free axis that overlap the fixed band.
    var intervals = [];
    obstacles.forEach(function (obs) {
      var oFixLo, oFixHi, oFreeLo, oFreeHi;
      if (isYFree) {
        oFixLo = obs.x; oFixHi = obs.x + obs.w;
        oFreeLo = obs.y; oFreeHi = obs.y + obs.h;
      } else {
        oFixLo = obs.y; oFixHi = obs.y + obs.h;
        oFreeLo = obs.x; oFreeHi = obs.x + obs.w;
      }
      if (oFixHi > fixedPx - fixedHalf && oFixLo < fixedPx + fixedHalf) {
        intervals.push([oFreeLo, oFreeHi]);
      }
    });

    // Add hard chart-edge constraints.
    intervals.push([-Infinity, PAD]);
    intervals.push([freeDim - PAD, Infinity]);

    // Merge overlapping intervals into a sorted blocked list.
    intervals.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    intervals.forEach(function (iv) {
      if (merged.length && iv[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
      } else {
        merged.push([iv[0], iv[1]]);
      }
    });

    // Preferred label-top: where we ideally want the label's leading edge.
    // 'above'/'left' → label sits before the anchor; 'below'/'right' → after.
    var preferredTop = (side === 'above' || side === 'left')
      ? preferredFreePx - freeLabelSz - PAD
      : preferredFreePx + PAD;

    // Walk every gap between consecutive blocked intervals and find the one
    // whose clamped preferred position is closest to preferredTop.
    var bestTop = null, bestDist = Infinity;
    for (var i = 0; i < merged.length - 1; i++) {
      var gapStart = merged[i][1];        // first free px after block i
      var gapEnd   = merged[i + 1][0];    // first blocked px of block i+1
      if (gapEnd - gapStart < freeLabelSz) continue; // gap too narrow
      var lo      = gapStart;
      var hi      = gapEnd - freeLabelSz;
      var clamped = Math.max(lo, Math.min(hi, preferredTop));
      var dist    = Math.abs(clamped - preferredTop);
      if (dist < bestDist) { bestDist = dist; bestTop = clamped; }
    }

    // Fallback: no gap is wide enough — use least-overlapping clamped position.
    if (bestTop === null) {
      bestTop = Math.max(PAD, Math.min(freeDim - freeLabelSz - PAD, preferredTop));
    }

    return { freePx: bestTop + freeLabelSz / 2 };
  }

  // 2D placement: anchor at (ax, ay); label floats freely with a leader line.
  // Tests 24 candidates (8 compass directions × 3 radii), biased toward side.
  // Returns { cx, cy } — center of placed label.
  function _placeLabel2D(ax, ay, labelW, labelH, obstacles, width, height, side) {
    var PAD    = 5;
    var radii  = [20, 36, 56];
    var dirs   = [
      [0, -1], [0.707, -0.707], [1, 0], [0.707, 0.707],
      [0,  1], [-0.707, 0.707], [-1, 0], [-0.707, -0.707],
    ];
    var sideStart = { above: 0, right: 2, below: 4, left: 6 }[side] || 0;
    var sortedDirs = dirs.slice(sideStart).concat(dirs.slice(0, sideStart));

    function intersectArea(ax, ay, aw, ah, bx, by, bw, bh) {
      var ox = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
      var oy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
      return ox * oy;
    }

    var bestCx = null, bestCy = null, bestScore = Infinity, bestDist = Infinity;
    sortedDirs.forEach(function (dir) {
      radii.forEach(function (r) {
        var cx = ax + dir[0] * r;
        var cy = ay + dir[1] * r;
        var lx = cx - labelW / 2, ly = cy - labelH / 2;
        if (lx < PAD || ly < PAD || lx + labelW > width - PAD || ly + labelH > height - PAD) return;
        var score = 0;
        obstacles.forEach(function (obs) {
          score += intersectArea(lx, ly, labelW, labelH, obs.x, obs.y, obs.w, obs.h);
        });
        var dist = Math.sqrt((cx - ax) * (cx - ax) + (cy - ay) * (cy - ay));
        if (score < bestScore || (score === bestScore && dist < bestDist)) {
          bestScore = score; bestDist = dist; bestCx = cx; bestCy = cy;
        }
      });
    });

    // Fallback: clamp near anchor.
    if (bestCx === null) {
      bestCx = Math.max(labelW / 2 + PAD, Math.min(width  - labelW / 2 - PAD, ax + 20));
      bestCy = Math.max(labelH / 2 + PAD, Math.min(height - labelH / 2 - PAD, ay - 20));
    }
    return { cx: bestCx, cy: bestCy };
  }

  // Resolve annotation color string → CSS color.
  function _resolveAnnotColor(color, ctx) {
    if (!color || color === 'bright') return ctx.annotationBright;
    if (color === 'dim')              return ctx.annotationDim;
    return color; // literal hex / CSS color
  }

  // Build unified annotation list from all sources, sorted left-to-right by x.
  function _normalizeAnnotations(data, xScale, yLeft, parseMonth, categories, isTimeSeries) {
    var anns = [];

    // avgLabel → Mode C (x+y anchored, leader line)
    if (data.avgValue != null && data.avgLabel && data.avgLabelDate) {
      anns.push({
        text:  data.avgLabel,
        x:     String(data.avgLabelDate).substring(0, 7),
        y:     data.avgValue,
        side:  'above',
        color: 'bright',
      });
    }

    // verticalAnnotations with label → Mode A (x-anchored)
    (data.verticalAnnotations || []).forEach(function (ann) {
      if (ann.label) {
        anns.push({
          text:  ann.label,
          x:     String(ann.date).substring(0, 7),
          y:     null,
          side:  ann.side  || 'above',
          color: ann.color || 'dim',
        });
      }
    });

    // data.annotations[] — direct entries
    (data.annotations || []).forEach(function (ann) {
      anns.push({
        text:  String(ann.text || ''),
        x:     ann.x != null ? String(ann.x) : null,
        y:     ann.y != null ? +ann.y         : null,
        side:  ann.side  || 'above',
        color: ann.color || 'bright',
      });
    });

    // Sort left-to-right by x pixel position so earlier labels block later ones.
    anns.sort(function (a, b) {
      return _annotXPx(a, xScale, parseMonth, isTimeSeries) -
             _annotXPx(b, xScale, parseMonth, isTimeSeries);
    });
    return anns;
  }

  function _annotXPx(ann, xScale, parseMonth, isTimeSeries) {
    if (ann.x == null || !xScale) return 0;
    if (isTimeSeries) {
      var d = parseMonth(String(ann.x).substring(0, 7));
      return d ? xScale(d) : 0;
    }
    return xScale(String(ann.x)) || 0;
  }

  // Compute leader line endpoints from anchor to nearest point on label bbox edge.
  function _leaderLineEndpoints(anchorX, anchorY, cx, cy, labelW, labelH) {
    var lx1 = cx - labelW / 2, ly1 = cy - labelH / 2;
    var lx2 = cx + labelW / 2, ly2 = cy + labelH / 2;
    return {
      x1: anchorX, y1: anchorY,
      x2: Math.max(lx1, Math.min(lx2, anchorX)),
      y2: Math.max(ly1, Math.min(ly2, anchorY)),
    };
  }

  // ── Export helpers ────────────────────────────────────────────────────────

  // Escape string for safe insertion into SVG attribute or text content.
  function _escXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Convert chart title to a filename-safe slug.
  function _slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart';
  }

  // Fetch a URL as a base64 data URI.  Results are cached by URL.
  function _fetchLogoDataUri(src) {
    if (_logoCache[src]) return Promise.resolve(_logoCache[src]);
    return fetch(src)
      .then(function (res) { return res.ok ? res.blob() : null; })
      .then(function (blob) {
        if (!blob) return null;
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () { _logoCache[src] = reader.result; resolve(reader.result); };
          reader.onerror = function () { resolve(null); };
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () { return null; });
  }

  // Build an SVG legend row string, horizontally centred within exportW.
  function _buildLegendSVG(legendEl, ctx, exportW, rowH) {
    var items = Array.prototype.slice.call(legendEl.querySelectorAll('.tbl-legend-item'));
    if (!items.length) return '';
    var bodyPx   = parseFloat(ctx.bodySize) || 13;
    var swatchSz = 14, gap = 6, itemGap = 20;
    var ff       = _escXml(ctx.fontFamily || "'Mallory', system-ui, sans-serif");

    var itemData = items.map(function (item) {
      var svgEl   = item.querySelector('svg');
      var pathEl  = svgEl ? svgEl.querySelector('path') : null;
      var fill    = pathEl ? (pathEl.getAttribute('fill') || '#888') : '#888';
      var pathD   = pathEl ? (pathEl.getAttribute('d')    || '')     : '';
      var span    = item.querySelector('span');
      var text    = span ? span.textContent : '';
      return { text: text, fill: fill, pathD: pathD, w: swatchSz + gap + text.length * bodyPx * 0.58 };
    });

    var totalW = itemData.reduce(function (s, d) { return s + d.w; }, 0)
               + (itemData.length - 1) * itemGap;
    var cx   = Math.max(0, (exportW - totalW) / 2);
    var midY = rowH / 2;
    var parts = [];

    itemData.forEach(function (d) {
      if (d.pathD) {
        parts.push('<path d="' + d.pathD + '" fill="' + _escXml(d.fill) + '" transform="translate(' + (cx + swatchSz / 2) + ',' + midY + ')"/>');
      } else {
        parts.push('<rect x="' + cx + '" y="' + (midY - swatchSz / 2) + '" width="' + swatchSz + '" height="' + swatchSz + '" fill="' + _escXml(d.fill) + '" rx="3"/>');
      }
      parts.push('<text x="' + (cx + swatchSz + gap) + '" y="' + (midY + bodyPx * 0.35) + '" font-family="' + ff + '" font-size="' + bodyPx + '" fill="' + _escXml(ctx.titleColor) + '">' + _escXml(d.text) + '</text>');
      cx += d.w + itemGap;
    });
    return parts.join('\n');
  }

  // Assemble all visible chart elements into a single composite SVG string.
  // logoDataUri: base64 data URI of the logo, or null to omit the logo.
  function _buildCompositeSVG(ctx, data, logoDataUri) {
    var wrapper  = ctx.el('wrapper');
    var EXPORT_W = Math.max(600, wrapper.clientWidth || 800);
    var PAD_H    = 24;
    var y        = PAD_H;
    var ff       = _escXml(ctx.fontFamily || "'Mallory', system-ui, sans-serif");
    var titlePx  = parseFloat(ctx.titleSize) || 18;
    var bodyPx   = parseFloat(ctx.bodySize)  || 13;
    var smallPx  = parseFloat(ctx.smallSize) || 11;
    var legendH  = 20;
    var parts    = [];

    // Figure label
    var figEl = ctx.el('figure');
    if (figEl && figEl.textContent && figEl.style.display !== 'none') {
      parts.push('<text x="' + PAD_H + '" y="' + (y + titlePx) +
        '" font-family="' + ff + '" font-size="' + titlePx +
        '" font-weight="300" fill="' + _escXml(ctx.titleColor) + '">' +
        _escXml(figEl.textContent) + '</text>');
      y += titlePx + 2;
    }

    // Title
    var titleEl  = ctx.el('title');
    var titleTxt = titleEl ? titleEl.textContent : (data.title || 'Chart');
    parts.push('<text x="' + PAD_H + '" y="' + (y + titlePx) +
      '" font-family="' + ff + '" font-size="' + titlePx +
      '" font-weight="' + (ctx.titleWeight || 600) + '" fill="' + _escXml(ctx.titleColor) + '">' +
      _escXml(titleTxt) + '</text>');
    y += titlePx + 4;

    // Unit label
    var unitEl  = ctx.el('unit');
    var unitTxt = unitEl ? unitEl.textContent.trim() : '';
    if (unitTxt) {
      parts.push('<text x="' + PAD_H + '" y="' + (y + bodyPx) +
        '" font-family="' + ff + '" font-size="' + bodyPx +
        '" fill="' + _escXml(ctx.secondary) + '">' + _escXml(unitTxt) + '</text>');
      y += bodyPx + 10;
    }

    // Legend row
    var legendEl = ctx.el('legend');
    if (legendEl && legendEl.style.display !== 'none' &&
        legendEl.querySelectorAll('.tbl-legend-item').length) {
      var legSvg = _buildLegendSVG(legendEl, ctx, EXPORT_W, legendH);
      if (legSvg) {
        parts.push('<g transform="translate(0,' + y + ')">' + legSvg + '</g>');
        y += legendH + 14;
      }
    }

    // Chart SVG — nested, stripped of interactive elements
    var chartSvgEl = wrapper.querySelector('svg');
    var chartH = 0;
    if (chartSvgEl) {
      var vb      = chartSvgEl.getAttribute('viewBox') || '0 0 800 360';
      var vbParts = vb.trim().split(/\s+/);
      var vbW     = parseFloat(vbParts[2]) || 800;
      var vbH     = parseFloat(vbParts[3]) || 360;
      chartH      = Math.round(EXPORT_W * vbH / vbW);

      var clone = chartSvgEl.cloneNode(true);
      // Strip interactive-only elements
      ['.tbl-cursor', '.tbl-bar-cursor'].forEach(function (sel) {
        var els = clone.querySelectorAll(sel);
        for (var i = 0; i < els.length; i++) { els[i].parentNode.removeChild(els[i]); }
      });
      var overRects = clone.querySelectorAll('rect[fill="none"]');
      for (var oi = 0; oi < overRects.length; oi++) {
        if (overRects[oi].getAttribute('pointer-events') === 'all') {
          overRects[oi].parentNode.removeChild(overRects[oi]);
        }
      }
      // Serialise inner content (works in Chrome/Puppeteer; SVGElement.innerHTML is well-supported)
      var fullStr    = new XMLSerializer().serializeToString(clone);
      var firstClose = fullStr.indexOf('>');
      var lastOpen   = fullStr.lastIndexOf('<');
      var innerSvg   = (firstClose >= 0 && lastOpen > firstClose)
        ? fullStr.substring(firstClose + 1, lastOpen)
        : '';

      parts.push('<svg x="0" y="' + y + '" width="' + EXPORT_W + '" height="' + chartH +
        '" viewBox="' + _escXml(vb) + '" preserveAspectRatio="xMidYMid meet">' +
        innerSvg + '</svg>');
      y += chartH + 10;
    }

    // Footnote
    var footEl  = ctx.el('footnote');
    var footTxt = footEl ? footEl.textContent.trim() : '';
    if (footTxt) {
      parts.push('<text x="' + PAD_H + '" y="' + (y + smallPx) +
        '" font-family="' + ff + '" font-size="' + smallPx +
        '" fill="' + _escXml(ctx.secondary) + '">' + _escXml(footTxt) + '</text>');
      y += smallPx + 4;
    }

    // Credit
    var creditEl  = ctx.el('credit');
    var creditTxt = creditEl ? creditEl.textContent.trim() : '';
    if (creditTxt) {
      parts.push('<text x="' + PAD_H + '" y="' + (y + smallPx) +
        '" font-family="' + ff + '" font-size="' + smallPx +
        '" fill="' + _escXml(ctx.secondary) + '">' + _escXml(creditTxt) + '</text>');
      y += smallPx + 4;
    }

    y += PAD_H;
    var EXPORT_H = y;

    // Logo — bottom-right corner
    if (logoDataUri) {
      var logoW = 120, logoH = 32;
      var logoX = EXPORT_W - logoW - 20;
      var logoY = EXPORT_H - logoH - 16;
      parts.push('<image href="' + logoDataUri + '" xlink:href="' + logoDataUri +
        '" x="' + logoX + '" y="' + logoY +
        '" width="' + logoW + '" height="' + logoH + '" opacity="0.85"/>');
    }

    // CSS for the composite SVG — must replicate the scoped rules from chart-core.js
    // that normally rely on the #uid-container selector (which no longer applies here).
    var sw = ctx.strokeWidth || '2.5px';
    var styleBlock =
      '.tbl-line-path { fill: none; stroke-width: ' + sw + '; } ' +
      '.axis text { font-family: ' + (ctx.fontFamily || "'Mallory', system-ui, sans-serif") + '; font-size: ' + (ctx.axisSize || '11px') + '; fill: ' + (ctx.axisColor || '#666') + '; } ' +
      '.axis path, .axis line { stroke: ' + (ctx.axisStroke || '#e0e0e0') + '; stroke-width: 1px; fill: none; } ' +
      '.gridline line { stroke: ' + (ctx.gridColor || '#f0f0f0') + '; stroke-width: 1px; stroke-dasharray: 3,3; } ' +
      '.tbl-annot-label { font-family: ' + (ctx.fontFamily || "'Mallory', system-ui, sans-serif") + '; pointer-events: none; } ' +
      '.tbl-annot-leader { pointer-events: none; }';

    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
      ' width="' + EXPORT_W + '" height="' + EXPORT_H + '">' +
      '<defs><style>' + styleBlock + '</style></defs>' +
      '<rect width="' + EXPORT_W + '" height="' + EXPORT_H + '" fill="' + _escXml(ctx.bg) + '"/>' +
      parts.join('\n') +
      '</svg>';
  }

  // Trigger a PNG download of the composite chart.
  function _exportPNGCanvas(ctx, data, fname) {
    var logoSrc = ctx.placeholder.dataset.logo || 'shared/tbl-logo-blue.svg';
    _fetchLogoDataUri(logoSrc).then(function (logoDataUri) {
      var svgStr  = _buildCompositeSVG(ctx, data, logoDataUri);
      var svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      var svgUrl  = URL.createObjectURL(svgBlob);

      var img = new Image();
      img.onload = function () {
        // Draw at physical-pixel dimensions so the SVG vector is rasterised
        // at full resolution rather than being upscaled from its intrinsic size.
        var scale  = Math.max(window.devicePixelRatio || 1, 2); // at least 2×
        var svgW   = img.naturalWidth  || 800;
        var svgH   = img.naturalHeight || 400;
        var canvas = document.createElement('canvas');
        canvas.width  = svgW * scale;
        canvas.height = svgH * scale;
        var c2d = canvas.getContext('2d');
        c2d.fillStyle = ctx.bg || '#fff';
        c2d.fillRect(0, 0, canvas.width, canvas.height);
        c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob(function (pngBlob) {
          var pngUrl = URL.createObjectURL(pngBlob);
          var a = document.createElement('a');
          a.href = pngUrl; a.download = fname;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(pngUrl); }, 5000);
        }, 'image/png');
      };
      img.onerror = function () {
        URL.revokeObjectURL(svgUrl);
        console.error('[TBL] PNG export: failed to render SVG');
      };
      img.src = svgUrl;
    });
  }

  function _exportPNG(ctx, data) {
    if (!data) return;
    var fname = (data.exportFilename
      ? String(data.exportFilename).replace(/\.png$/i, '')
      : _slugify(data.title || 'chart')) + '.png';

    // Primary: serve pre-generated PNG from the chart directory.
    var chartBase = ctx.placeholder.dataset.chartBase;
    if (chartBase) {
      var pngUrl = chartBase.replace(/\/?$/, '/') + 'chart.png';
      fetch(pngUrl)
        .then(function (res) {
          if (!res.ok) throw new Error('not found');
          return res.blob();
        })
        .then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = fname;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        })
        .catch(function () {
          // Fallback: canvas export (local dev or CI hasn't run yet).
          _exportPNGCanvas(ctx, data, fname);
        });
    } else {
      // No chartBase (custom chart.js path) — canvas only.
      _exportPNGCanvas(ctx, data, fname);
    }
  }

  // ── Main draw factory ─────────────────────────────────────────────────────
  function chartDrawFactory(ctx) {
    injectChartCSS(ctx.uid, ctx);

    var parseMonth  = d3.timeParse('%Y-%m');
    var formatMonth = d3.timeFormat('%b %Y');

    var _lastData    = null;  // most recent data passed to drawChart
    var _exportWired = false; // export button click handler wired once per instance

    return function drawChart(data) {
      _lastData = data;
      ctx.clearError();

      // 1. Metadata
      var figEl = ctx.el('figure');
      if (data.figure) { figEl.textContent = data.figure; figEl.style.display = 'block'; }
      else             { figEl.textContent = ''; figEl.style.display = 'none'; }
      ctx.el('title').textContent = data.title || 'Chart';
      ctx.el('unit').textContent  = data.unit  || '';
      if (data.footnote != null) ctx.el('footnote').textContent = data.footnote;
      if (data.credit   != null) ctx.el('credit').textContent   = data.credit;

      // Export button — show/hide; wire once per instance
      var exportBtn = ctx.el('export');
      if (exportBtn) {
        exportBtn.style.display = data.exportButton !== false ? 'block' : 'none';
        if (!_exportWired) {
          _exportWired = true;
          exportBtn.addEventListener('click', function () { _exportPNG(ctx, _lastData); });
        }
      }

      var series     = data.series || [];
      var categories = data.categories || [];

      // 2. Infer X axis type
      var hasLine = series.some(function (s) { return s.type === 'line'; });
      var hasBar  = series.some(function (s) { return s.type === 'bar'; });
      // Categorical if any bar series has number[] data and categories[] is provided
      var hasCatBars = categories.length > 0 && series.some(function (s) {
        return s.type === 'bar' && s.data && s.data.length > 0 && typeof s.data[0] === 'number';
      });
      // Time series: has line series with {date,value} data, and no categorical bars
      var isTimeSeries = !hasCatBars && (
        series.some(function (s) {
          return s.type === 'line' && s.data && s.data.length > 0 && typeof s.data[0] === 'object';
        }) ||
        series.some(function (s) {
          return s.type === 'bar' && s.data && s.data.length > 0 && typeof s.data[0] === 'object' && s.data[0].date;
        })
      );
      var isCategorical = !isTimeSeries;

      // Assign palette colors to series that don't specify one
      var paletteIdx = 0;
      series = series.map(function (s) {
        var color = s.color || ctx.palette[paletteIdx] || ctx.palette[0];
        paletteIdx++;
        return Object.assign({}, s, { _color: color });
      });

      // 3. Dimensions
      var useBarAspect = hasBar || (!hasLine && hasBar);
      var aspectRatio  = data.aspectRatio != null ? data.aspectRatio
        : (hasBar ? ctx.barAspectRatio : ctx.aspectRatio);
      var wrapper      = ctx.el('wrapper');
      wrapper.innerHTML = '';
      var totalWidth   = wrapper.clientWidth || 800;
      var totalHeight  = Math.round(totalWidth * aspectRatio);

      // Margin: widen right if dual-axis; widen left if horizontal (category labels on left)
      var hasDualAxis  = data.yAxis && data.yAxis.right;
      var isHorizGuess = !!data.horizontal && !isTimeSeries;  // pre-isCategorical guard
      var baseMargin   = data.margin || ctx.margin;
      var margin       = {
        top:    baseMargin.top,
        right:  hasDualAxis ? Math.max(baseMargin.right, 60) : baseMargin.right,
        bottom: baseMargin.bottom,
        left:   isHorizGuess ? Math.max(baseMargin.left, 90) : baseMargin.left,
      };
      var width  = totalWidth  - margin.left - margin.right;
      var height = totalHeight - margin.top  - margin.bottom;

      TBL_CORE.fitTitle(ctx, totalWidth);

      // 4. SVG setup
      var svg = d3.select('#' + ctx.uid + '-wrapper')
        .append('svg')
        .attr('viewBox', '0 0 ' + totalWidth + ' ' + totalHeight)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      var g = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      // horizontal flag: only applies to categorical bar charts
      var horiz = !!data.horizontal && isCategorical;

      // 5. Build X scale (or band scale for categorical)
      var xScale, scales;
      if (isTimeSeries) {
        var allLineDates = series
          .filter(function (s) { return s.type === 'line'; })
          .flatMap(function (s) { return s.data.map(function (d) { return parseMonth(d.date); }); });
        xScale = d3.scaleTime().domain(d3.extent(allLineDates)).range([0, width]);
        scales = { xScale: xScale };
      } else {
        // Categorical — band scale spans height for horiz, width for vert
        var grouped  = hasBar && series.filter(function (s) { return s.type === 'bar'; }).some(function (s) { return !s.stack; }) && series.filter(function (s) { return s.type === 'bar'; }).length > 1;
        var barNames = series.filter(function (s) { return s.type === 'bar'; }).map(function (s) { return s.name; });
        var bandSize = horiz ? height : width;
        scales = TBL_CORE.buildBandScales(categories, barNames, bandSize, ctx, { grouped: grouped });
        scales.catScale = scales.xOuter;   // explicit alias used by _renderBarSeries
        if (!horiz) xScale = scales.xOuter;
      }

      // 6. Build Y scale(s)
      // Separate left vs right axis series
      var leftSeries  = series.filter(function (s) { return !s.yAxis || s.yAxis === 'left'; });
      var rightSeries = series.filter(function (s) { return s.yAxis === 'right'; });

      function getSeriesValues(ss) {
        var vals = [];
        ss.forEach(function (s) {
          if (s.type === 'line') {
            s.data.forEach(function (d) {
              // Handle both {date, value} objects and plain numbers
              if (typeof d === 'number') { vals.push(d); }
              else if (d && d.value != null) { vals.push(+d.value); }
            });
          } else if (s.type === 'bar') {
            if (Array.isArray(s.data) && typeof s.data[0] === 'number') {
              s.data.forEach(function (v) { vals.push(v || 0); });
            }
          }
        });
        return vals;
      }

      // For stacked bars, compute max as sum of stacked values per category
      function getStackedMax(barSeries, cats) {
        var totals = cats.map(function (cat, i) {
          var total = 0;
          barSeries.filter(function (s) { return s.stack; }).forEach(function (s) {
            total += (s.data[i] || 0);
          });
          return total;
        });
        return d3.max(totals) || 0;
      }

      var leftBarSeries  = leftSeries.filter(function (s) { return s.type === 'bar'; });
      var leftVals       = getSeriesValues(leftSeries);
      var stackedMax     = isCategorical && leftBarSeries.some(function (s) { return s.stack; })
        ? getStackedMax(leftBarSeries, categories)
        : 0;
      var leftMax        = Math.max(d3.max(leftVals) || 0, stackedMax);
      var leftYAxis      = (data.yAxis && data.yAxis.left) || {};
      var leftMin        = leftYAxis.min != null ? leftYAxis.min : 0;

      // Horizontal bars: value axis runs left→right ([0,width]); vertical: bottom→top ([height,0])
      var yLeft = d3.scaleLinear()
        .domain([leftMin, leftMax * ctx.yDomainPadding])
        .nice()
        .range(horiz ? [0, width] : [height, 0]);

      if (scales) scales.valScale = yLeft;  // used by _renderBarSeries

      var yRight = null;
      if (hasDualAxis && rightSeries.length) {
        var rightVals = getSeriesValues(rightSeries);
        var rightMax  = d3.max(rightVals) || 0;
        yRight = d3.scaleLinear()
          .domain([0, rightMax * ctx.yDomainPadding])
          .nice()
          .range([height, 0]);
      }

      // 7. Gridlines
      if (horiz) {
        // Vertical gridlines spaced by the value (x) scale
        TBL_CORE.drawGridlines(g, yLeft, height, { axis: 'x', tickCount: ctx.yTickCount });
      } else {
        TBL_CORE.drawGridlines(g, yLeft, width, { axis: 'y', tickCount: ctx.yTickCount });
      }

      // 8. Axes
      var leftYOpts = {
        tickCount:  ctx.yTickCount,
        tickFormat: leftYAxis.tickFormat,
        label:      leftYAxis.label || data.unit || '',
        marginLeft: margin.left,
      };

      if (isTimeSeries) {
        TBL_CORE.buildLinearYAxis(g, yLeft, ctx, leftYOpts);
        TBL_CORE.buildTimeXAxis(g, xScale, ctx, height, {});
      } else if (horiz) {
        // Left axis = categories (band); bottom axis = values (linear)
        var catAxisG = g.append('g').attr('class', 'axis').call(d3.axisLeft(scales.catScale));
        catAxisG.select('.domain').remove();
        catAxisG.selectAll('.tick line').remove();
        var valAxisG = g.append('g').attr('class', 'axis')
          .attr('transform', 'translate(0,' + height + ')')
          .call(d3.axisBottom(yLeft).ticks(ctx.yTickCount));
        valAxisG.select('.domain').remove();
      } else {
        TBL_CORE.buildLinearYAxis(g, yLeft, ctx, leftYOpts);
        var longLabels = categories.some(function (c) { return c.length > 6; });
        TBL_CORE.buildBandXAxis(g, xScale, height, ctx, { rotate: longLabels });
      }

      if (yRight) {
        var rightYOpts = {
          tickCount:  ctx.yTickCount,
          tickFormat: data.yAxis.right.tickFormat,
          label:      data.yAxis.right.label || '',
        };
        // Draw right axis on right side
        var rightAxisG = g.append('g').attr('class', 'axis')
          .attr('transform', 'translate(' + width + ',0)');
        var rightAxis = d3.axisRight(yRight).ticks(ctx.yTickCount);
        if (rightYOpts.tickFormat) rightAxis.tickFormat(rightYOpts.tickFormat);
        rightAxisG.call(rightAxis);
        rightAxisG.select('.domain').remove();
        if (rightYOpts.label) {
          rightAxisG.append('text')
            .attr('transform', 'rotate(90)')
            .attr('y', -margin.right + 12).attr('x', height / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', ctx.axisSize).attr('fill', ctx.secondary)
            .text(rightYOpts.label);
        }
      }

      // 9. Stacking pre-computation (for categorical bar charts)
      var stackOffsets = {};
      if (isCategorical) {
        stackOffsets = computeStackOffsets(series, categories);
      }

      // 10. Render series — bars first, then lines
      var sortedSeries = series.slice().sort(function (a, b) {
        var order = { bar: 0, line: 1 };
        return (order[a.type] || 0) - (order[b.type] || 0);
      });

      var allBarSeries  = series.filter(function (s) { return s.type === 'bar'; });
      var renderedLines = [];  // { s, path, parsed }

      sortedSeries.forEach(function (s, sortedIdx) {
        // Find original palette index
        var origIdx = series.indexOf(s);
        var yScale  = (s.yAxis === 'right' && yRight) ? yRight : yLeft;

        if (s.type === 'bar') {
          _renderBarSeries(g, s, scales, yScale, ctx, data, stackOffsets, origIdx, allBarSeries);
        } else if (s.type === 'line') {
          var result = _renderLineSeries(g, s, xScale, yScale, ctx, origIdx, parseMonth, categories);
          renderedLines.push({ s: s, path: result.path, parsed: result.parsed, isCatLine: result.isCatLine, markerGroupId: result.markerGroupId });
        }
      });

      // 11. Annotations
      // 11a. Vertical annotation lines (time-series only; categorical deferred)
      if (isTimeSeries && xScale) {
        (data.verticalAnnotations || []).forEach(function (ann) {
          var aColor = ann.color === 'bright' ? ctx.annotationBright : ctx.annotationDim;
          var tDate  = parseMonth(String(ann.date).substring(0, 7));
          if (!tDate) return;
          var xPx = xScale(tDate);
          g.append('line')
            .attr('x1', xPx).attr('x2', xPx)
            .attr('y1', 0).attr('y2', height)
            .attr('stroke', aColor).attr('stroke-width', 1).attr('stroke-dasharray', '4,4');
        });
      }

      // 11b. Horizontal reference line (avg / target) — works on all chart types
      if (data.avgValue != null) {
        var avgLineY = yLeft(data.avgValue);
        g.append('line')
          .attr('x1', 0).attr('x2', width).attr('y1', avgLineY).attr('y2', avgLineY)
          .attr('stroke', ctx.annotationBright).attr('stroke-width', 1.5).attr('stroke-dasharray', '5,4');
      }

      // 11c. Annotation labels via collision-aware placement engine
      var annObstacles = _collectObstacles(ctx.uid, renderedLines, xScale, yLeft);
      var normalizedAnns = _normalizeAnnotations(data, xScale, yLeft, parseMonth, categories, isTimeSeries);

      normalizedAnns.forEach(function (ann) {
        if (!ann.text) return;
        var bbox  = _estimateLabelBBox(ann.text, ctx);
        var aCol  = _resolveAnnotColor(ann.color, ctx);
        var hasX  = (ann.x != null);
        var hasY  = (ann.y != null);
        var anchorXPx = null, anchorYPx = null;

        if (hasX && xScale) {
          if (isTimeSeries) {
            var tDate3 = parseMonth(String(ann.x).substring(0, 7));
            if (tDate3) anchorXPx = xScale(tDate3);
          } else {
            var raw = xScale(String(ann.x));
            if (raw != null) anchorXPx = raw;
          }
        }
        if (hasY) anchorYPx = yLeft(ann.y);

        if (anchorXPx == null && anchorYPx == null) return;

        var finalCx, finalCy;

        if (hasX && hasY && anchorXPx != null && anchorYPx != null) {
          // Mode C — 2D placement, leader line
          var p2 = _placeLabel2D(anchorXPx, anchorYPx, bbox.w, bbox.h, annObstacles, width, height, ann.side);
          finalCx = p2.cx; finalCy = p2.cy;
          var lp   = _leaderLineEndpoints(anchorXPx, anchorYPx, finalCx, finalCy, bbox.w, bbox.h);
          var lDx  = lp.x2 - lp.x1, lDy = lp.y2 - lp.y1;
          if (Math.sqrt(lDx * lDx + lDy * lDy) > 4) {
            g.append('line')
              .attr('class', 'tbl-annot-leader')
              .attr('x1', lp.x1).attr('y1', lp.y1).attr('x2', lp.x2).attr('y2', lp.y2)
              .attr('stroke', aCol).attr('stroke-width', 1);
          }
        } else if (hasX && anchorXPx != null) {
          // Mode A — x fixed, y free
          var prefY = (ann.side === 'below') ? height : 0;
          var p1a   = _placeLabel1D(anchorXPx, prefY, bbox.w, bbox.h, annObstacles, height, ann.side);
          finalCx = anchorXPx; finalCy = p1a.freePx;
        } else {
          // Mode B — y fixed, x free.
          // Offset label center ABOVE the reference line so its bottom edge clears
          // the line itself; this lifts the obstacle-band out of the series paths
          // that typically live near the reference value, opening much wider gaps.
          var modeBCy = anchorYPx - bbox.h / 2 - 5;
          var prefX   = (ann.side === 'left') ? 0 : width;
          var p1b     = _placeLabel1D(modeBCy, prefX, bbox.w, bbox.h, annObstacles, width, ann.side);
          finalCx = p1b.freePx; finalCy = modeBCy;
        }

        var annotFs = parseFloat(ctx.annotSize) || 12;
        g.append('text')
          .attr('class', 'tbl-annot-label')
          .attr('x', finalCx)
          .attr('y', finalCy - bbox.h / 2 + annotFs * 0.8)
          .attr('text-anchor', 'middle')
          .attr('font-size', ctx.annotSize)
          .attr('fill', aCol)
          .text(ann.text);

        // Register placed label as an obstacle for subsequent labels.
        annObstacles.push({
          x: finalCx - bbox.w / 2 - 5, y: finalCy - bbox.h / 2 - 5,
          w: bbox.w + 10,               h: bbox.h + 10,
        });
      });

      // 12. Legend
      var showLegend = data.legend !== false && series.length > 1;
      var legendEl   = ctx.el('legend');
      legendEl.style.display = showLegend ? '' : 'none';
      if (showLegend) {
        var legendSeries = series.map(function (s) {
          var markerShape;
          if (s.type === 'line') {
            // Use the explicit marker shape, or 'circle' as the line default
            markerShape = (!s.marker || s.marker === true) ? 'circle' : String(s.marker).toLowerCase();
          } else {
            // Bars use a square swatch
            markerShape = 'square';
          }
          return { name: s.name, color: s._color, markerShape: markerShape };
        });
        TBL_CORE.buildLegend(legendEl, legendSeries, ctx, function (name, visible) {
          var opacity = visible ? 1 : ctx.legendHiddenOpacity;
          // Toggle line path
          d3.select('#' + ctx.uid + '-line-' + safeName(name))
            .style('opacity', opacity);
          // Toggle line markers (if any)
          var lineEntry = renderedLines.find(function (r) { return r.s.name === name; });
          if (lineEntry && lineEntry.markerGroupId) {
            d3.select('#' + lineEntry.markerGroupId).style('opacity', opacity);
          }
          // Toggle bars
          d3.selectAll('#' + ctx.uid + '-container .tbl-bar[data-series="' + name + '"]')
            .style('opacity', visible ? 1 : ctx.legendHiddenOpacity);
        });
      }

      // 13. Tooltip
      if (isTimeSeries && renderedLines.length > 0) {
        // Bisector approach for time-series
        var cursorLine = g.append('line')
          .attr('class', 'tbl-cursor')
          .attr('y1', 0).attr('y2', height)
          .attr('stroke', ctx.cursorColor).attr('stroke-width', 1)
          .style('display', 'none');

        var bisect = d3.bisector(function (d) { return d.date; }).left;

        g.append('rect')
          .attr('width', width).attr('height', height)
          .attr('fill', 'none').attr('pointer-events', 'all')
          .on('mousemove', function (event) {
            var mx      = d3.pointer(event)[0];
            var hovDate = xScale.invert(mx);
            var ref     = renderedLines[0].parsed;
            var i       = bisect(ref, hovDate, 1);
            var d0      = ref[i - 1], d1 = ref[i] || d0;
            var nearest = (hovDate - d0.date > d1.date - hovDate) ? d1 : d0;
            var nx      = xScale(nearest.date);

            cursorLine.attr('x1', nx).attr('x2', nx).style('display', null);

            var html = '<strong>' + formatMonth(nearest.date) + '</strong><br/>';
            series.forEach(function (s) {
              if (s.type !== 'line') return;
              var lineData = renderedLines.find(function (r) { return r.s === s; });
              if (!lineData) return;
              var pt = lineData.parsed.find(function (p) { return p.date && p.date.getTime() === nearest.date.getTime(); });
              if (!pt) return;
              var valStr;
              if (data.tooltipFormatter) {
                valStr = data.tooltipFormatter(s.name, pt.value, formatMonth(nearest.date));
              } else {
                valStr = pt.value.toLocaleString();
              }
              html += '<span style="color:' + s._color + '">&#9679;</span> ' + s.name + ': <strong>' + valStr + '</strong><br/>';
            });

            ctx.ttEl.innerHTML = html;
            TBL_CORE.positionTooltip(ctx.ttEl, event, ctx);
          })
          .on('mouseout', function () {
            cursorLine.style('display', 'none');
            ctx.ttEl.style.display = 'none';
          });

      } else if (isCategorical) {
        // Category-level hover: highlight band + multi-series tooltip
        var catScale = scales.catScale;
        var halfGap  = (catScale.step() - catScale.bandwidth()) / 2;

        // Highlight band — inserted before all other chart elements so it renders behind bars
        var highlightBand = g.insert('rect', ':first-child')
          .attr('class', 'tbl-bar-cursor')
          .attr('fill', 'rgba(0,0,0,0.06)')
          .style('display', 'none');

        // Invert band scale: map pixel position → {cat, idx}
        function catFromMouse(val) {
          var domain = catScale.domain();
          if (!domain.length) return { cat: null, idx: -1 };
          var start = catScale(domain[0]);
          var step  = catScale.step();
          var idx   = Math.floor((val - start) / step);
          idx = Math.max(0, Math.min(idx, domain.length - 1));
          return { cat: domain[idx], idx: idx };
        }

        // Invisible overlay rect captures all mouse events across the full chart area
        g.append('rect')
          .attr('width', width).attr('height', height)
          .attr('fill', 'none').attr('pointer-events', 'all')
          .on('mousemove', function (event) {
            var pos    = d3.pointer(event);
            var result = catFromMouse(horiz ? pos[1] : pos[0]);
            var cat    = result.cat;
            var idx    = result.idx;
            if (cat == null) return;

            // Position the highlight band to span the full category slot (bar + padding)
            var bandStart = catScale(cat) - halfGap;
            if (!horiz) {
              highlightBand
                .attr('x', bandStart).attr('y', 0)
                .attr('width', catScale.step()).attr('height', height);
            } else {
              highlightBand
                .attr('x', 0).attr('y', bandStart)
                .attr('width', width).attr('height', catScale.step());
            }
            highlightBand.style('display', null);

            // Tooltip: category header + one row per bar/line series
            var html = '<strong>' + cat + '</strong><br/>';
            series.forEach(function (s) {
              var val;
              if (s.type === 'bar') {
                val = s.data[idx] || 0;
              } else if (s.type === 'line' && Array.isArray(s.data) && typeof s.data[0] === 'number') {
                val = s.data[idx];
                if (val == null) return;
              } else {
                return;
              }
              var valStr = data.tooltipFormatter
                ? data.tooltipFormatter(s.name, val, cat)
                : val.toLocaleString();
              html += '<span style="color:' + s._color + '">&#9679;</span> ' + s.name + ': <strong>' + valStr + '</strong><br/>';
            });

            ctx.ttEl.innerHTML = html;
            TBL_CORE.positionTooltip(ctx.ttEl, event, ctx);
          })
          .on('mouseout', function () {
            highlightBand.style('display', 'none');
            ctx.ttEl.style.display = 'none';
          });
      }

      // Update TBL_EXPORT state (used by Puppeteer headless export).
      // The logo fetch is async; _exportReady flips true when both are done.
      _exportReady = false;
      var _logoSrc = ctx.placeholder.dataset.logo || 'shared/tbl-logo-blue.svg';
      _fetchLogoDataUri(_logoSrc).then(function (uri) {
        _lastSVGString = _buildCompositeSVG(ctx, _lastData, uri);
        _exportReady   = true;
      });
    };
  }

  // ── Headless export API (Puppeteer / export-svgs.js) ─────────────────────
  window.TBL_EXPORT = {
    isReady:      function () { return _exportReady; },
    getSVGString: function () { return _lastSVGString; },
  };

  // ── Public API ────────────────────────────────────────────────────────────
  window.TBL_CHART = {
    run: function (src, fn, pal) {
      if (!window.TBL_CORE) { console.error('[TBL] chart-core.js must load before chart-renderer.js'); return; }
      TBL_CORE.run(chartDrawFactory, fn, src, pal);
    },
    initChart: function (el, src, fn, pal) {
      if (!window.TBL_CORE) { console.error('[TBL] chart-core.js must load before chart-renderer.js'); return; }
      TBL_CORE.initChart(el, chartDrawFactory, fn, src, pal);
    },
  };

})();
