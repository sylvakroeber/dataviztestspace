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
      c + ' .tbl-line-path { fill: none; stroke-width: ' + sw + '; transition: opacity 0.3s; }',
      c + ' .tbl-bar       { transition: opacity 0.2s; cursor: pointer; }',
      c + ' .tbl-bar:hover { filter: brightness(0.88); }',
      c + ' .tbl-cursor    { pointer-events: none; }',
      c + ' .tbl-dot       { transition: r 0.15s; cursor: pointer; }',
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

    return { path: path, parsed: parsed, isCatLine: isCatLine };
  }

  // ── Main draw factory ─────────────────────────────────────────────────────
  function chartDrawFactory(ctx) {
    injectChartCSS(ctx.uid, ctx);

    var parseMonth  = d3.timeParse('%Y-%m');
    var formatMonth = d3.timeFormat('%b %Y');

    return function drawChart(data) {
      ctx.clearError();

      // 1. Metadata
      ctx.el('title').textContent = data.title || 'Chart';
      ctx.el('unit').textContent  = data.unit  || '';
      if (data.footnote != null) ctx.el('footnote').textContent = data.footnote;
      if (data.credit   != null) ctx.el('credit').textContent   = data.credit;

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
          renderedLines.push({ s: s, path: result.path, parsed: result.parsed, isCatLine: result.isCatLine });
        }
      });

      // 11. Annotations (for time-series charts)
      if (isTimeSeries) {
        (data.verticalAnnotations || []).forEach(function (ann) {
          var color = ann.color === 'bright' ? ctx.annotationBright : ctx.annotationDim;
          g.append('line')
            .attr('x1', xScale(new Date(ann.date))).attr('x2', xScale(new Date(ann.date)))
            .attr('y1', 0).attr('y2', height)
            .attr('stroke', color).attr('stroke-width', 1).attr('stroke-dasharray', '4,4');
        });

        if (data.avgValue != null) {
          var ay        = yLeft(data.avgValue);
          var labelDate = data.avgLabelDate || null;
          g.append('line')
            .attr('x1', 0).attr('x2', width).attr('y1', ay).attr('y2', ay)
            .attr('stroke', ctx.annotationBright).attr('stroke-width', 1.5).attr('stroke-dasharray', '5,4');
          if (labelDate) {
            g.append('text')
              .attr('x', xScale(new Date(labelDate))).attr('y', ay - 10)
              .attr('text-anchor', 'start').attr('font-size', ctx.annotSize).attr('fill', ctx.annotationBright)
              .text(data.avgLabel || 'Avg');
          }
        }
      }

      // 12. Legend
      var showLegend = data.legend !== false && series.length > 1;
      var legendEl   = ctx.el('legend');
      legendEl.style.display = showLegend ? '' : 'none';
      if (showLegend) {
        var legendSeries = series.map(function (s) {
          return { name: s.name, color: s._color };
        });
        TBL_CORE.buildLegend(legendEl, legendSeries, ctx, function (name, visible) {
          var opacity = visible ? 1 : ctx.legendHiddenOpacity;
          // Toggle line
          d3.select('#' + ctx.uid + '-line-' + safeName(name))
            .style('opacity', opacity);
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
        // Per-bar tooltip for categorical charts
        d3.selectAll('#' + ctx.uid + '-container .tbl-bar')
          .on('mousemove', function (event) {
            var el       = d3.select(this);
            var sName    = el.attr('data-series');
            var s        = series.find(function (s) { return s.name === sName; });
            // Determine category from bar index via ID attribute
            var idParts  = (el.attr('id') || '').split('-');
            var catIdx   = parseInt(idParts[idParts.length - 1], 10);
            var catLabel = categories[catIdx] || '';
            var val      = s ? (s.data[catIdx] || 0) : 0;
            var valStr;
            if (data.tooltipFormatter) {
              valStr = data.tooltipFormatter(sName, val, catLabel);
            } else {
              valStr = val.toLocaleString();
            }
            var color = s ? s._color : '#fff';
            ctx.ttEl.innerHTML = '<strong>' + catLabel + '</strong><br/>' +
              '<span style="color:' + color + '">&#9679;</span> ' + sName + ': <strong>' + valStr + '</strong>';
            TBL_CORE.positionTooltip(ctx.ttEl, event, ctx);
          })
          .on('mouseout', function () {
            ctx.ttEl.style.display = 'none';
          });
      }
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.TBL_CHART = {
    run: function (src, fn, pal) {
      if (!window.TBL_CORE) { console.error('[TBL] chart-core.js must load before chart.js'); return; }
      TBL_CORE.run(chartDrawFactory, fn, src, pal);
    },
    initChart: function (el, src, fn, pal) {
      if (!window.TBL_CORE) { console.error('[TBL] chart-core.js must load before chart.js'); return; }
      TBL_CORE.initChart(el, chartDrawFactory, fn, src, pal);
    },
  };

})();
