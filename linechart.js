/**
 * TBL Line Chart Engine
 * ----------------------
 * Sets window.TBL_LINE = { run, initChart }
 *
 * Depends on TBL_CORE (chart-core.js must load first).
 * Contains all D3 line chart rendering. No data fetching or parsing here.
 *
 * Usage:
 *   TBL_LINE.run(dataSource, makeChartFn, palette?)
 *   TBL_LINE.initChart(element, dataSource, makeChartFn, palette?)
 */
(function () {
  'use strict';

  // ── Draw factory — called once per chart instance after deps are loaded ──────
  // Receives ctx from TBL_CORE; returns the instance-bound drawChart(data) fn.
  function lineChartDrawFactory(ctx) {

    // d3 is guaranteed available here (called from inside ensureDeps().then())
    const curveMap = {
      monotoneX:  d3.curveMonotoneX,
      monotoneY:  d3.curveMonotoneY,
      linear:     d3.curveLinear,
      cardinal:   d3.curveCardinal,
      catmullRom: d3.curveCatmullRom,
      step:       d3.curveStep,
      stepAfter:  d3.curveStepAfter,
      stepBefore: d3.curveStepBefore,
    };

    const parseMonth  = d3.timeParse('%Y-%m');
    const formatMonth = d3.timeFormat('%b %Y');

    return function drawChart(data) {
      ctx.clearError();
      ctx.el('title').textContent = data.title || 'Chart';
      ctx.el('unit').textContent  = data.unit  || '';

      if (data.footnote != null) ctx.el('footnote').textContent = data.footnote;
      if (data.credit   != null) ctx.el('credit').textContent   = data.credit;

      const wrapper = ctx.el('wrapper');
      wrapper.innerHTML = '';

      const totalWidth  = wrapper.clientWidth || 800;
      const totalHeight = Math.round(totalWidth * ctx.aspectRatio);
      const width  = totalWidth  - ctx.margin.left - ctx.margin.right;
      const height = totalHeight - ctx.margin.top  - ctx.margin.bottom;

      // ── Title: stay at full size until text would wrap, then scale down ──────
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

      const svg = d3.select(`#${ctx.uid}-wrapper`)
        .append('svg')
        .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      const g = svg.append('g')
        .attr('transform', `translate(${ctx.margin.left},${ctx.margin.top})`);

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
        .domain([0, d3.max(allValues) * ctx.yDomainPadding])
        .nice()
        .range([height, 0]);

      // Gridlines
      g.append('g').attr('class', 'gridline')
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(''))
        .select('.domain').remove();

      // Vertical annotations — loop over data.verticalAnnotations
      (data.verticalAnnotations || []).forEach(ann => {
        const color = ann.color === 'bright' ? ctx.annotationBright : ctx.annotationDim;
        g.append('line')
          .attr('x1', x(new Date(ann.date))).attr('x2', x(new Date(ann.date)))
          .attr('y1', 0).attr('y2', height)
          .attr('stroke', color).attr('stroke-width', 1).attr('stroke-dasharray', '4,4');
      });

      // Axes — pick tick interval so labels don't overlap
      const [xMin, xMax] = x.domain();
      const monthSpan   = d3.timeMonth.count(xMin, xMax);
      const maxTicks    = Math.max(2, Math.floor(width / ctx.axisTickMinSpacing));
      const rawEvery    = monthSpan / maxTicks;
      const tickEvery   = ctx.axisTickIntervals.find(n => rawEvery <= n) || ctx.axisTickIntervals[ctx.axisTickIntervals.length - 1];

      g.append('g').attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth.every(tickEvery)).tickFormat(formatMonth))
        .selectAll('text').attr('dy', '1.2em').style('text-anchor', 'middle');

      g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(ctx.yTickCount));

      // Y-axis label
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -ctx.margin.left + 12).attr('x', -height / 2)
        .attr('text-anchor', 'middle').attr('font-size', ctx.axisSize).attr('fill', ctx.secondary)
        .text(data.unit || '');

      const curveFn = curveMap[ctx.lineCurve] || d3.curveMonotoneX;
      const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(curveFn);

      // Lines
      series.forEach(s => {
        g.append('path')
          .datum(s.parsed)
          .attr('class', 'line-path')
          .attr('id', `${ctx.uid}-line-${s.name.replace(/[^a-zA-Z0-9]+/g, '-')}`)
          .attr('stroke', s.color || ctx.palette[0])
          .attr('d', line);
      });

      // Horizontal avg annotation
      if (data.avgValue != null) {
        const ay        = y(data.avgValue);
        const labelDate = data.avgLabelDate || '2023-02-01';
        g.append('line')
          .attr('x1', 0).attr('x2', width).attr('y1', ay).attr('y2', ay)
          .attr('stroke', ctx.annotationBright).attr('stroke-width', 1.5).attr('stroke-dasharray', '5,4');
        g.append('text')
          .attr('x', x(new Date(labelDate))).attr('y', ay - 10)
          .attr('text-anchor', 'start').attr('font-size', ctx.annotSize).attr('fill', ctx.annotationBright)
          .text(data.avgLabel || 'Avg');
      }

      // Cursor line (sits above series, below overlay)
      const cursorLine = g.append('line')
        .attr('y1', 0).attr('y2', height)
        .attr('stroke', ctx.cursorColor).attr('stroke-width', 1)
        .attr('pointer-events', 'none').style('display', 'none');

      // Legend
      const legendEl = ctx.el('legend');
      legendEl.innerHTML = '';
      series.forEach(s => {
        const item   = document.createElement('div');
        item.className = 'tbl-legend-item';
        const swatch = document.createElement('div');
        swatch.className = 'tbl-legend-swatch';
        swatch.style.background = s.color || ctx.palette[0];
        const label  = document.createElement('span');
        label.textContent = s.name;
        item.appendChild(swatch);
        item.appendChild(label);

        let visible = true;
        item.addEventListener('click', () => {
          visible = !visible;
          d3.select(`#${ctx.uid}-line-${s.name.replace(/[^a-zA-Z0-9]+/g, '-')}`)
            .style('opacity', visible ? 1 : ctx.legendHiddenOpacity);
          item.style.opacity = visible ? 1 : ctx.legendHiddenItemOpacity;
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
              let valStr;
              if (data.tooltipFormatter) {
                valStr = data.tooltipFormatter(s.name, pt.value);
              } else {
                valStr = pt.value.toFixed(1).endsWith('.0')
                  ? `$${pt.value.toFixed(0)} billion`
                  : `$${pt.value.toFixed(1)} billion`;
              }
              html += `<span style="color:${s.color}">&#9679;</span> ${s.name}: <strong>${valStr}</strong><br/>`;
            }
          });

          ctx.ttEl.innerHTML = html;
          ctx.ttEl.style.display = 'block';
          const ttWidth = ctx.ttEl.offsetWidth;
          const leftPos = event.clientX + ctx.tooltipOffsetX + ttWidth > window.innerWidth
            ? event.clientX - ctx.tooltipOffsetX - ttWidth
            : event.clientX + ctx.tooltipOffsetX;
          ctx.ttEl.style.left = leftPos + 'px';
          ctx.ttEl.style.top  = (event.clientY - ctx.tooltipOffsetY) + 'px';
        })
        .on('mouseout', () => {
          cursorLine.style('display', 'none');
          ctx.ttEl.style.display = 'none';
        });
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  // TBL_LINE.run(dataSource, makeChartFn, palette?)
  //   dataSource  — required string: URL or relative path to the .xlsx
  //   makeChartFn — required factory: (tools) => fetchAndRender
  //   palette     — optional string name, e.g. 'blues'
  window.TBL_LINE = {
    run: function (src, fn, pal) {
      if (!window.TBL_CORE) { console.error('[TBL] chart-core.js must load before linechart.js'); return; }
      TBL_CORE.run(lineChartDrawFactory, fn, src, pal);
    },
    initChart: function (el, src, fn, pal) {
      if (!window.TBL_CORE) { console.error('[TBL] chart-core.js must load before linechart.js'); return; }
      TBL_CORE.initChart(el, lineChartDrawFactory, fn, src, pal);
    },
  };

})();
