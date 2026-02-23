(function () {

  function resolveTheme() {
    var T  = window.TBL_THEME || {};
    var C  = T.colors || {};
    var Ty = T.typography || {};
    var S  = T.spacing || {};
    var blues = ((C.palettes || {}).blues)       || ['#286dc0', '#63aaff', '#d9eaff'];
    var cat   = ((C.palettes || {}).categorical) || ['#286dc0','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7'];
    return {
      fontFamily:     Ty.fontFamily     || "system-ui, -apple-system, sans-serif",
      titleSize:      Ty.titleSize      || '18px',
      bodySize:       Ty.bodySize       || '13px',
      axisSize:       Ty.axisSize       || '11px',
      annotationSize: Ty.annotationSize || '12px',
      axisText:       C.axisText        || '#666',
      gridline:       C.gridline        || '#f0f0f0',
      titleText:      C.titleText       || '#1a1a2e',
      tooltipBg:      C.tooltip         || 'rgba(20,20,40,0.65)',
      borderRadius:   S.borderRadius    || '8px',
      maxWidth:       S.maxWidth        || '900px',
      colorAuto:      blues[0]               || '#286dc0',
      colorMortgage:  C.annotationBright     || '#f28e2b',
      colorBiz:       cat[5]                 || '#b07aa1',
      calcBg:         blues[2]               || '#d9eaff',
    };
  }

  function buildCSS(uid, theme) {
    var u = '#' + uid;
    return [
      u + ' * { margin: 0; padding: 0; box-sizing: border-box; }',
      u + ' { width: 100%; max-width: ' + theme.maxWidth + '; margin: 0 auto; overflow-x: auto; font-family: ' + theme.fontFamily + '; }',

      // Section labels
      u + ' .section-label { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }',
      u + ' .section-label .line { flex: 1; height: 1px; background: currentColor; opacity: 0.15; }',
      u + ' .section-label .text { font-size: ' + theme.titleSize + '; font-weight: 600; white-space: nowrap; display: block; }',

      // Row layout
      u + ' .row { display: grid; grid-template-columns: 200px 1fr; gap: 12px; margin-bottom: 24px; }',
      u + ' .cards-col { display: flex; flex-direction: column; gap: 8px; }',

      // Cards
      u + ' .card { border: 1px solid rgba(128,128,128,0.2); border-radius: ' + theme.borderRadius + '; padding: 10px 14px; display: flex; align-items: center; gap: 10px; position: relative; overflow: hidden; flex: 1; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s, opacity 0.2s; }',
      u + ' .card:hover, ' + u + ' .card.highlighted { border-color: rgba(128,128,128,0.5); box-shadow: 0 2px 10px rgba(0,0,0,0.1); }',
      u + ' .card.dimmed { opacity: 0.25; }',
      u + " .card::before { content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 3px; }",
      u + ' .card .icon { font-size: 20px; flex-shrink: 0; }',
      u + ' .card-text { display: flex; flex-direction: column; }',
      u + ' .card .loan-type { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.5; font-weight: 600; line-height: 1.2; }',
      u + ' .card .amount { font-size: 20px; font-weight: 800; line-height: 1.1; }',

      // Card colors
      u + ' .card.auto::before     { background: ' + theme.colorAuto + '; }',
      u + ' .card.mortgage::before { background: ' + theme.colorMortgage + '; }',
      u + ' .card.biz::before      { background: ' + theme.colorBiz + '; }',
      u + ' .card.auto     .amount { color: ' + theme.colorAuto + '; }',
      u + ' .card.mortgage .amount { color: ' + theme.colorMortgage + '; }',
      u + ' .card.biz      .amount { color: ' + theme.colorBiz + '; }',

      // Chart section
      u + ' .chart-section { border: 1px solid rgba(128,128,128,0.2); border-radius: ' + theme.borderRadius + '; padding: 18px; min-width: 0; overflow: hidden; }',
      u + ' .chart-section h3 { font-size: ' + theme.bodySize + '; font-weight: 700; margin-bottom: 2px; }',
      u + ' .chart-section p.sub { font-size: ' + theme.axisSize + '; opacity: 0.45; margin-bottom: 14px; }',
      u + ' .chart-wrap { position: relative; height: 180px; width: 100%; }',
      u + ' .chart-wrap svg { width: 100%; height: 100%; display: block; overflow: visible; }',

      // Calculator
      u + ' .calculator { border: 1px solid rgba(128,128,128,0.2); border-radius: ' + theme.borderRadius + '; padding: 24px; margin-top: 8px; background: ' + theme.calcBg + '; color: ' + theme.titleText + '; }',
      u + ' .calculator .section-label { margin-bottom: 20px; }',
      u + ' .calc-body { display: flex; gap: 0; align-items: stretch; }',
      u + ' .calc-inputs { flex: 1; padding-right: 24px; }',
      u + ' .calc-divider { width: 1px; background: rgba(0,0,0,0.15); flex-shrink: 0; }',
      u + ' .calc-output { flex: 1; padding-left: 24px; display: flex; align-items: center; }',
      u + ' .calc-field { margin-bottom: 16px; }',
      u + ' .calc-field > label, ' + u + ' .calc-label { display: block; font-size: ' + theme.annotationSize + '; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; margin-bottom: 8px; }',
      u + ' .calculator input[type="number"] { width: 100%; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.2); border-radius: ' + theme.borderRadius + '; font-size: 16px; background: rgba(255,255,255,0.6); color: ' + theme.titleText + '; outline: none; transition: border-color 0.2s; }',
      u + ' .calculator input[type="number"]:focus { border-color: rgba(0,0,0,0.4); }',
      u + ' .loan-type-btns { display: flex; gap: 8px; flex-wrap: wrap; }',
      u + ' .loan-btn { padding: 7px 14px; border: 1.5px solid rgba(0,0,0,0.2); border-radius: ' + theme.borderRadius + '; background: rgba(255,255,255,0.5); color: ' + theme.titleText + '; font-size: ' + theme.bodySize + '; font-weight: 600; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s; }',
      u + ' .loan-btn:hover { border-color: rgba(0,0,0,0.4); background: rgba(255,255,255,0.8); }',
      u + ' .loan-btn.active[data-value="auto"]     { background: ' + theme.colorAuto + ';     border-color: ' + theme.colorAuto + ';     color: #fff; }',
      u + ' .loan-btn.active[data-value="mortgage"] { background: ' + theme.colorMortgage + '; border-color: ' + theme.colorMortgage + '; color: #fff; }',
      u + ' .loan-btn.active[data-value="business"] { background: ' + theme.colorBiz + ';      border-color: ' + theme.colorBiz + ';      color: #fff; }',
      '#' + uid + '-calcBtn { padding: 10px 24px; background: ' + theme.titleText + '; color: #fff; border: none; border-radius: ' + theme.borderRadius + '; font-size: ' + theme.bodySize + '; font-weight: 700; cursor: pointer; transition: opacity 0.2s; display: block; margin: 4px auto 0; }',
      '#' + uid + '-calcBtn:hover { opacity: 0.85; }',
      u + ' .calc-result { font-size: ' + theme.bodySize + '; line-height: 1.9; width: 100%; }',
      u + ' .result-amount { font-size: clamp(20px, 3vw, 26px); font-weight: 800; color: ' + theme.titleText + '; }',
      u + ' .calc-error { color: #c0392b; font-size: ' + theme.bodySize + '; }',
      u + ' .calc-placeholder { opacity: 0.35; font-size: ' + theme.bodySize + '; font-style: italic; }',

      // Responsive
      '@media (max-width: 600px) {',
      '  ' + u + ' .calc-body { flex-direction: column; }',
      '  ' + u + ' .calc-inputs { padding-right: 0; padding-bottom: 20px; }',
      '  ' + u + ' .calc-divider { width: 100%; height: 1px; }',
      '  ' + u + ' .calc-output { padding-left: 0; padding-top: 20px; }',
      '}'
    ].join('\n');
  }

  function buildHTML(uid) {
    return (
      '<div class="section-label">' +
        '<div class="line"></div>' +
        '<h3 class="text">Since 2015, legislation has raised annual interest costs by:</h3>' +
        '<div class="line"></div>' +
      '</div>' +
      '<div class="row" data-section="annual">' +
        '<div class="cards-col">' +
          '<div class="card auto" data-index="0">' +
            '<div class="icon">&#x1F697;</div>' +
            '<div class="card-text"><div class="loan-type">Auto Loan</div><div class="amount">$180</div></div>' +
          '</div>' +
          '<div class="card mortgage" data-index="1">' +
            '<div class="icon">&#x1F3E0;</div>' +
            '<div class="card-text"><div class="loan-type">Mortgage</div><div class="amount">$3,610</div></div>' +
          '</div>' +
          '<div class="card biz" data-index="2">' +
            '<div class="icon">&#x1F3E2;</div>' +
            '<div class="card-text"><div class="loan-type">Small Business Loan</div><div class="amount">$1,360</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="chart-section">' +
          '<h3>Annual Added Cost</h3>' +
          '<p class="sub">Extra interest paid each year</p>' +
          '<div class="chart-wrap"><svg id="' + uid + '-annual"></svg></div>' +
        '</div>' +
      '</div>' +
      '<div class="section-label">' +
        '<div class="line"></div>' +
        '<h3 class="text">Over the life of a loan, these costs add up:</h3>' +
        '<div class="line"></div>' +
      '</div>' +
      '<div class="row" data-section="lifetime">' +
        '<div class="cards-col">' +
          '<div class="card auto" data-index="0">' +
            '<div class="icon">&#x1F697;</div>' +
            '<div class="card-text"><div class="loan-type">Auto Loan</div><div class="amount">$990</div></div>' +
          '</div>' +
          '<div class="card mortgage" data-index="1">' +
            '<div class="icon">&#x1F3E0;</div>' +
            '<div class="card-text"><div class="loan-type">Mortgage</div><div class="amount">$108,430</div></div>' +
          '</div>' +
          '<div class="card biz" data-index="2">' +
            '<div class="icon">&#x1F3E2;</div>' +
            '<div class="card-text"><div class="loan-type">Small Business Loan</div><div class="amount">$6,810</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="chart-section">' +
          '<h3>Lifetime Added Cost</h3>' +
          '<p class="sub">Extra interest over life of loan (log scale)</p>' +
          '<div class="chart-wrap"><svg id="' + uid + '-lifetime"></svg></div>' +
        '</div>' +
      '</div>' +
      '<div class="calculator">' +
        '<div class="section-label">' +
          '<div class="line"></div>' +
          '<h3 class="text">How have federal deficits impacted you?</h3>' +
          '<div class="line"></div>' +
        '</div>' +
        '<div class="calc-body">' +
          '<div class="calc-inputs">' +
            '<div class="calc-field">' +
              '<label for="' + uid + '-loanAmount">Enter your loan amount</label>' +
              '<input type="number" id="' + uid + '-loanAmount" placeholder="e.g. 250000" min="0" />' +
            '</div>' +
            '<div class="calc-field">' +
              '<span class="calc-label">Type of loan</span>' +
              '<div class="loan-type-btns">' +
                '<button class="loan-btn" data-value="auto">Auto</button>' +
                '<button class="loan-btn" data-value="mortgage">Mortgage</button>' +
                '<button class="loan-btn" data-value="business">Small Business</button>' +
              '</div>' +
            '</div>' +
            '<button id="' + uid + '-calcBtn">Calculate</button>' +
          '</div>' +
          '<div class="calc-divider"></div>' +
          '<div class="calc-output">' +
            '<div id="' + uid + '-calcResult" class="calc-result"><span class="calc-placeholder">Your results will appear here.</span></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ── D3 bar chart renderer ────────────────────────────────────────────────────
  // opts: { logScale: bool, onBarOver: fn(idx, event), onBarMove: fn(event), onBarOut: fn() }
  function drawBarChart(svgEl, data, opts, theme) {
    var d3 = window.d3;
    d3.select(svgEl).selectAll('*').remove();

    var margin = { top: 10, right: 8, bottom: 36, left: 48 };
    var totalW = svgEl.parentElement.clientWidth  || 300;
    var totalH = svgEl.parentElement.clientHeight || 180;
    var W = totalW - margin.left - margin.right;
    var H = totalH - margin.top  - margin.bottom;
    if (W <= 0 || H <= 0) return;

    d3.select(svgEl).attr('width', totalW).attr('height', totalH);

    var g = d3.select(svgEl).append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Scales
    var xScale = d3.scaleBand()
      .domain(data.map(function(d) { return d.key; }))
      .range([0, W])
      .padding(0.35);

    var maxVal = d3.max(data, function(d) { return d.value; });
    var yMin   = opts.logScale ? 100 : 0;
    var yScale = opts.logScale
      ? d3.scaleLog().domain([yMin, maxVal * 1.6]).range([H, 0])
      : d3.scaleLinear().domain([0, maxVal * 1.2]).range([H, 0]).nice();

    var axSize = parseInt(theme.axisSize, 10);
    var xLabels = { auto: 'Auto', mortgage: 'Mortgage', biz: 'Small Business' };

    // Grid lines (skip yMin on log scale — it coincides with bar baseline)
    var gridTicks = opts.logScale ? [1000, 10000, 100000] : yScale.ticks(5);
    g.selectAll('.grid').data(gridTicks).enter().append('line')
      .attr('x1', 0).attr('x2', W)
      .attr('y1', function(d) { return yScale(d); })
      .attr('y2', function(d) { return yScale(d); })
      .attr('stroke', theme.gridline)
      .attr('stroke-width', 1);

    // Y axis
    var yFmt = opts.logScale
      ? function(d) { return d >= 1000 ? '$' + (d / 1000).toFixed(0) + 'k' : '$' + d; }
      : function(d) { return d === 0 ? '$0' : d >= 1000 ? '$' + Math.round(d / 1000) + 'k' : '$' + d; };

    var yAxisFn = opts.logScale
      ? d3.axisLeft(yScale).tickValues([1000, 10000, 100000]).tickFormat(yFmt)
      : d3.axisLeft(yScale).ticks(5).tickFormat(yFmt);

    g.append('g').call(yAxisFn).call(function(ax) {
      ax.select('.domain').remove();
      ax.selectAll('.tick line').remove();
      ax.selectAll('text').attr('fill', theme.axisText).style('font-size', axSize + 'px');
    });

    // Log scale: add explicit $0 label at the bar baseline (log(0) is undefined so
    // it can't be a real tick, but visually the bars grow from zero)
    if (opts.logScale) {
      g.append('text')
        .attr('x', -3).attr('y', H).attr('dy', '0.32em')
        .attr('text-anchor', 'end')
        .attr('fill', theme.axisText)
        .style('font-size', axSize + 'px')
        .text('$0');
    }

    // X axis
    g.append('g').attr('transform', 'translate(0,' + H + ')')
      .call(d3.axisBottom(xScale).tickFormat(function(d) { return xLabels[d] || d; }))
      .call(function(ax) {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').remove();
        ax.selectAll('text').attr('fill', theme.axisText).style('font-size', axSize + 'px');
      });

    // Bars — start from H in both scale types (domain-min maps to range-max = H)
    var barColors = { auto: theme.colorAuto, mortgage: theme.colorMortgage, biz: theme.colorBiz };
    g.selectAll('.bar').data(data).enter().append('rect')
      .attr('class', 'bar')
      .attr('x',      function(d) { return xScale(d.key); })
      .attr('y',      function(d) { return yScale(d.value); })
      .attr('width',  xScale.bandwidth())
      .attr('height', function(d) { return H - yScale(d.value); })
      .attr('fill',   function(d) { return barColors[d.key]; })
      .attr('rx', 3)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) { opts.onBarOver(d.index, event); })
      .on('mousemove', function(event)    { opts.onBarMove(event); })
      .on('mouseleave', function()        { opts.onBarOut(); });
  }

  // ── Interactivity ─────────────────────────────────────────────────────────────
  function initInteractivity(uid, theme) {
    var datasets = {
      annual:   [
        { key: 'auto',     value: 180,    index: 0 },
        { key: 'mortgage', value: 3610,   index: 1 },
        { key: 'biz',      value: 1360,   index: 2 }
      ],
      lifetime: [
        { key: 'auto',     value: 990,    index: 0 },
        { key: 'mortgage', value: 108430, index: 1 },
        { key: 'biz',      value: 6810,   index: 2 }
      ]
    };

    // Tooltip
    var tip = document.createElement('div');
    tip.style.cssText = 'position:fixed;pointer-events:none;display:none;background:' + theme.tooltipBg + ';color:#fff;padding:5px 10px;border-radius:4px;font-size:' + theme.bodySize + ';white-space:nowrap;z-index:9999;';
    document.body.appendChild(tip);

    function showTip(event, text) { tip.textContent = text; tip.style.display = 'block'; moveTip(event); }
    function moveTip(event)       { tip.style.left = (event.clientX + 12) + 'px'; tip.style.top = (event.clientY - 36) + 'px'; }
    function hideTip()            { tip.style.display = 'none'; }

    // Bar highlight via SVG opacity
    function highlightBar(svgEl, activeIdx) {
      window.d3.select(svgEl).selectAll('.bar')
        .attr('opacity', function(d) { return d.index === activeIdx ? 1 : 0.2; });
    }
    function resetBars(svgEl) {
      window.d3.select(svgEl).selectAll('.bar').attr('opacity', 1);
    }

    // Card highlight via CSS classes
    function highlightCard(section, activeIdx) {
      document.querySelectorAll('#' + uid + ' .row[data-section="' + section + '"] .card').forEach(function(c) {
        var i = parseInt(c.dataset.index);
        c.classList.toggle('highlighted', i === activeIdx);
        c.classList.toggle('dimmed',      i !== activeIdx);
      });
    }
    function resetCards(section) {
      document.querySelectorAll('#' + uid + ' .row[data-section="' + section + '"] .card').forEach(function(c) {
        c.classList.remove('highlighted', 'dimmed');
      });
    }

    var annualSvg   = document.getElementById(uid + '-annual');
    var lifetimeSvg = document.getElementById(uid + '-lifetime');

    // Build opts object for a given chart, capturing svgEl + section in closure
    function makeOpts(svgEl, section, logScale) {
      return {
        logScale: logScale,
        onBarOver: function(idx, event) {
          highlightBar(svgEl, idx);
          highlightCard(section, idx);
          showTip(event, '$' + datasets[section][idx].value.toLocaleString());
        },
        onBarMove: moveTip,
        onBarOut: function() {
          resetBars(svgEl);
          resetCards(section);
          hideTip();
        }
      };
    }

    function renderAll() {
      drawBarChart(annualSvg,   datasets.annual,   makeOpts(annualSvg,   'annual',   false), theme);
      drawBarChart(lifetimeSvg, datasets.lifetime, makeOpts(lifetimeSvg, 'lifetime', true),  theme);
    }

    renderAll();

    // Card → bar highlight
    document.querySelectorAll('#' + uid + ' .card').forEach(function(card) {
      var idx     = parseInt(card.dataset.index);
      var section = card.closest('.row').dataset.section;
      var svgEl   = section === 'annual' ? annualSvg : lifetimeSvg;
      card.addEventListener('mouseenter', function() { highlightBar(svgEl, idx); highlightCard(section, idx); });
      card.addEventListener('mouseleave', function() { resetBars(svgEl);         resetCards(section); });
    });

    // Resize — debounced full re-render
    var resizeTimer = null;
    new ResizeObserver(function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderAll, 150);
    }).observe(document.getElementById(uid));

    // Calculator — loan type buttons
    document.querySelectorAll('#' + uid + ' .loan-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#' + uid + ' .loan-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    var annualRates   = { auto: 180,  mortgage: 3610,   business: 1360 };
    var lifetimeRates = { auto: 990,  mortgage: 108430, business: 6810 };
    var baseAmounts   = { auto: 25000, mortgage: 400000, business: 100000 };

    document.getElementById(uid + '-calcBtn').addEventListener('click', function() {
      var amount = parseFloat(document.getElementById(uid + '-loanAmount').value);
      var typeEl = document.querySelector('#' + uid + ' .loan-btn.active');
      var result = document.getElementById(uid + '-calcResult');

      if (!amount || amount <= 0) { result.innerHTML = '<span class="calc-error">Please enter a valid loan amount.</span>'; return; }
      if (!typeEl)                 { result.innerHTML = '<span class="calc-error">Please select a loan type.</span>';        return; }

      var type      = typeEl.dataset.value;
      var typeLabel = type === 'auto' ? 'auto loan' : type === 'mortgage' ? 'mortgage' : 'small business loan';
      var ratio     = amount / baseAmounts[type];
      var annual    = Math.round(annualRates[type]   * ratio);
      var lifetime  = Math.round(lifetimeRates[type] * ratio);

      result.innerHTML =
        '<div>Federal legislation since 2015 has raised borrowing costs on a <strong>$' + amount.toLocaleString() + ' ' + typeLabel + '</strong> by:</div>' +
        '<div style="margin-top:12px;"><span class="result-amount">$' + annual.toLocaleString()   + '</span> annually</div>' +
        '<div><span class="result-amount">$'                          + lifetime.toLocaleString()  + '</span> over the life of your loan</div>';
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  function initChart(placeholder) {
    if (!window.TBL_CORE) { console.error('TBL_INFOGRAPHIC: chart-core.js must be loaded before infographic.js'); return; }
    var uid   = 'tbl-inf-' + Math.random().toString(36).slice(2, 8);
    var theme = resolveTheme();
    placeholder.id = uid;
    var style = document.createElement('style');
    style.textContent = buildCSS(uid, theme);
    document.head.appendChild(style);
    placeholder.innerHTML = buildHTML(uid);
    window.TBL_CORE.ensureDeps().then(function() { initInteractivity(uid, theme); });
  }

  function run() {
    document.querySelectorAll('[data-tbl-infographic]').forEach(initChart);
  }

  window.TBL_INFOGRAPHIC = { run: run, initChart: initChart };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else { run(); }
}());
