(function () {

  // ── Constants & math ──────────────────────────────────────────────────────────
  var SCENARIOS = {
    since2015: { central: 97, low: 73, high: 146 },
    since2022: { central: 18, low: 14, high: 27  }
  };

  var LOANS = {
    mortgage: { term: 360, observedRate: 6.23, passthrough: 1.00, defaultPrincipal: 329840 },
    auto:     { term: 67,  observedRate: 7.51, passthrough: 0.50, defaultPrincipal: 42332  },
    business: { term: 60,  observedRate: 7.00, passthrough: 0.25, defaultPrincipal: 663000 }
  };

  function monthlyPayment(principal, annualRatePct, termMonths) {
    if (annualRatePct <= 0) return principal / termMonths;
    var r = annualRatePct / 100 / 12;
    var n = termMonths;
    var factor = Math.pow(1 + r, n);
    return principal * r * factor / (factor - 1);
  }

  function computeLoanImpact(principal, observedRatePct, passthrough, scenarioDeltaBp, termMonths) {
    var loanEffectPp = (scenarioDeltaBp * passthrough) / 100;
    var counterfactualRatePct = observedRatePct - loanEffectPp;
    var obsMonthly = monthlyPayment(principal, observedRatePct, termMonths);
    var cfMonthly  = monthlyPayment(principal, counterfactualRatePct, termMonths);
    var diff = obsMonthly - cfMonthly;
    return {
      annualImpact:      Math.round(diff * 12),
      lifetimeImpact:    Math.round(diff * termMonths),
      lifetimeImpactPct: parseFloat(((diff * termMonths) / principal * 100).toFixed(1))
    };
  }

  var defaultImpacts = {
    mortgage: computeLoanImpact(LOANS.mortgage.defaultPrincipal, LOANS.mortgage.observedRate, LOANS.mortgage.passthrough, SCENARIOS.since2015.central, LOANS.mortgage.term),
    auto:     computeLoanImpact(LOANS.auto.defaultPrincipal,     LOANS.auto.observedRate,     LOANS.auto.passthrough,     SCENARIOS.since2015.central, LOANS.auto.term),
    business: computeLoanImpact(LOANS.business.defaultPrincipal, LOANS.business.observedRate, LOANS.business.passthrough, SCENARIOS.since2015.central, LOANS.business.term)
  };

  function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
  function fmtPct(p) { return p % 1 === 0 ? p + '%' : p.toFixed(1) + '%'; }
  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function resolveTheme() {
    var T  = window.TBL_THEME || {};
    var C  = T.colors || {};
    var Ty = T.typography || {};
    var S  = T.spacing || {};
    var blues = ((C.palettes || {}).blue)        || ['#101f5b', '#1b3499', '#286dc0', '#63aaff', '#d9eaff'];
    var cat   = ((C.palettes || {}).categorical) || ['#286dc0','#5e9e00','#7040c8','#c86020','#00A846','#c04880','#1890a0'];
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
      colorAuto:      blues[2]               || '#286dc0',
      colorMortgage:  C.annotationBright     || '#f28e2b',
      colorBiz:       cat[5]                 || '#b07aa1',
      calcBg:         blues[4]               || '#d9eaff',
      calcBtnBg:      blues[0]               || '#101f5b',
    };
  }

  function buildCSS(uid, theme) {
    var u = '#' + uid;
    return [
      u + ' * { margin: 0; padding: 0; box-sizing: border-box; }',
      u + ' { width: 100%; max-width: ' + theme.maxWidth + '; margin: 0 auto; overflow-x: auto; font-family: ' + theme.fontFamily + '; }',

      // Section labels
      u + ' .section-label { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }',
      u + ' .section-label .line { flex: 1; min-width: 20px; height: 1px; background: currentColor; opacity: 0.15; }',
      u + ' .section-label .text { font-size: ' + theme.titleSize + '; font-weight: 600; display: block; text-align: center; }',

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
      u + ' .card .amount { font-size: 26px; font-weight: 800; line-height: 1.1; }',
      u + ' .card .amount-sub { font-size: 9px; opacity: 0.45; font-weight: 500; line-height: 1.2; margin-top: 2px; }',

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
      u + ' .amount-input-wrap { position: relative; }',
      u + ' .amount-prefix { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 16px; color: ' + theme.titleText + '; pointer-events: none; user-select: none; }',
      u + ' .calculator input[type="text"] { width: 100%; padding: 10px 12px 10px 24px; border: 1px solid rgba(0,0,0,0.2); border-radius: ' + theme.borderRadius + '; font-size: 16px; background: rgba(255,255,255,0.6); color: ' + theme.titleText + '; outline: none; transition: border-color 0.2s; }',
      u + ' .calculator input[type="text"]:focus { border-color: rgba(0,0,0,0.4); }',
      u + ' .loan-type-btns { display: flex; gap: 8px; flex-wrap: wrap; }',
      u + ' .loan-btn { flex: 1; padding: 7px 14px; text-align: center; border: 1.5px solid rgba(0,0,0,0.2); border-radius: ' + theme.borderRadius + '; background: rgba(255,255,255,0.5); color: ' + theme.titleText + '; font-size: ' + theme.bodySize + '; font-weight: 600; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s; }',
      u + ' .loan-btn:hover { border-color: rgba(0,0,0,0.4); background: rgba(255,255,255,0.8); }',
      u + ' .loan-btn.active[data-value="auto"]     { background: ' + hexToRgba(theme.colorAuto,     0.4) + '; border-color: ' + theme.colorAuto +     '; color: ' + theme.titleText + '; }',
      u + ' .loan-btn.active[data-value="mortgage"] { background: ' + hexToRgba(theme.colorMortgage, 0.4) + '; border-color: ' + theme.colorMortgage + '; color: ' + theme.titleText + '; }',
      u + ' .loan-btn.active[data-value="business"] { background: ' + hexToRgba(theme.colorBiz,      0.4) + '; border-color: ' + theme.colorBiz +      '; color: ' + theme.titleText + '; }',
      '#' + uid + '-calcBtn { padding: 10px 24px; width: calc(66.667% + 5.333px); background: ' + theme.calcBtnBg + '; color: #fff; border: none; border-radius: ' + theme.borderRadius + '; font-size: ' + theme.bodySize + '; font-weight: 700; cursor: pointer; transition: opacity 0.2s; display: block; margin: 4px auto 0; text-align: center; }',
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
            '<div class="card-text"><div class="loan-type">Auto Loan</div><div class="amount">' + fmt(defaultImpacts.auto.annualImpact) + '</div></div>' +
          '</div>' +
          '<div class="card mortgage" data-index="1">' +
            '<div class="icon">&#x1F3E0;</div>' +
            '<div class="card-text"><div class="loan-type">Mortgage</div><div class="amount">' + fmt(defaultImpacts.mortgage.annualImpact) + '</div></div>' +
          '</div>' +
          '<div class="card biz" data-index="2">' +
            '<div class="icon">&#x1F3E2;</div>' +
            '<div class="card-text"><div class="loan-type">Small Business Loan</div><div class="amount">' + fmt(defaultImpacts.business.annualImpact) + '</div></div>' +
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
            '<div class="card-text"><div class="loan-type">Auto Loan</div><div class="amount">' + fmtPct(defaultImpacts.auto.lifetimeImpactPct) + '</div><div class="amount-sub">of the loan principal</div></div>' +
          '</div>' +
          '<div class="card mortgage" data-index="1">' +
            '<div class="icon">&#x1F3E0;</div>' +
            '<div class="card-text"><div class="loan-type">Mortgage</div><div class="amount">' + fmtPct(defaultImpacts.mortgage.lifetimeImpactPct) + '</div><div class="amount-sub">of the loan principal</div></div>' +
          '</div>' +
          '<div class="card biz" data-index="2">' +
            '<div class="icon">&#x1F3E2;</div>' +
            '<div class="card-text"><div class="loan-type">Small Business Loan</div><div class="amount">' + fmtPct(defaultImpacts.business.lifetimeImpactPct) + '</div><div class="amount-sub">of the loan principal</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="chart-section">' +
          '<h3>Lifetime Added Cost</h3>' +
          '<p class="sub">As a percentage of loan principal</p>' +
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
              '<div class="amount-input-wrap">' +
                '<span class="amount-prefix">$</span>' +
                '<input type="text" inputmode="numeric" id="' + uid + '-loanAmount" placeholder="250,000, e.g." />' +
              '</div>' +
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

    var axSize = parseInt(theme.axisSize, 10);
    var xLabels = { auto: 'Auto', mortgage: 'Mortgage', biz: 'Small Business' };

    // Pre-estimate whether x labels will overlap so we can set margin.bottom upfront
    var totalW = svgEl.parentElement.clientWidth  || 300;
    var totalH = svgEl.parentElement.clientHeight || 180;
    var approxW = totalW - 56; // rough left+right margin
    var maxLabelPx = Math.max.apply(null, data.map(function(d) {
      return ((xLabels[d.key] || d.key).length) * axSize * 0.62;
    }));
    var approxStep = approxW / (data.length + 0.35 * (data.length - 1));
    var needAngle  = approxStep < maxLabelPx;

    var margin = { top: 10, right: 8, bottom: needAngle ? 58 : 36, left: 48 };
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

    // Grid lines (skip yMin on log scale — it coincides with bar baseline)
    var gridTicks = opts.logScale ? [1000, 10000, 100000] : yScale.ticks(5);
    g.selectAll('.grid').data(gridTicks).enter().append('line')
      .attr('x1', 0).attr('x2', W)
      .attr('y1', function(d) { return yScale(d); })
      .attr('y2', function(d) { return yScale(d); })
      .attr('stroke', theme.gridline)
      .attr('stroke-width', 1);

    // Log scale: draw explicit baseline at H (linear scale gets this free from its $0 grid tick)
    if (opts.logScale) {
      g.append('line')
        .attr('x1', 0).attr('x2', W)
        .attr('y1', H).attr('y2', H)
        .attr('stroke', theme.gridline)
        .attr('stroke-width', 1);
    }

    // Y axis
    var yFmt = opts.format === 'pct'
      ? function(d) { return d === 0 ? '0%' : (d % 1 === 0 ? d + '%' : d.toFixed(1) + '%'); }
      : opts.logScale
        ? function(d) { return d >= 1000 ? '$' + (d / 1000).toFixed(0) + 'k' : '$' + d; }
        : function(d) { return '$' + Math.round(d).toLocaleString(); };

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
    var xAxisG = g.append('g').attr('transform', 'translate(0,' + H + ')')
      .call(d3.axisBottom(xScale).tickFormat(function(d) { return xLabels[d] || d; }))
      .call(function(ax) {
        ax.select('.domain').remove();
        ax.selectAll('.tick line').remove();
        ax.selectAll('text').attr('fill', theme.axisText).style('font-size', axSize + 'px');
      });
    if (needAngle) {
      xAxisG.selectAll('text')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.15em')
        .attr('transform', 'rotate(-35)');
    }

    // Capture tick text nodes so callers can highlight them directly
    if (opts.tickTextOut) {
      opts.tickTextOut.length = 0;
      xAxisG.selectAll('text').each(function() { opts.tickTextOut.push(this); });
    }

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
      annual: [
        { key: 'auto',     value: defaultImpacts.auto.annualImpact,      index: 0 },
        { key: 'mortgage', value: defaultImpacts.mortgage.annualImpact,   index: 1 },
        { key: 'biz',      value: defaultImpacts.business.annualImpact,   index: 2 }
      ],
      lifetime: [
        { key: 'auto',     value: defaultImpacts.auto.lifetimeImpactPct,     index: 0 },
        { key: 'mortgage', value: defaultImpacts.mortgage.lifetimeImpactPct,  index: 1 },
        { key: 'biz',      value: defaultImpacts.business.lifetimeImpactPct,  index: 2 }
      ]
    };

    // Tooltip — two-part: bubble box + CSS-triangle arrow, centered on cursor X
    var tipBg = theme.tooltipBg;
    var tip    = document.createElement('div');
    var tipBox = document.createElement('div');
    var tipArr = document.createElement('div');

    tip.style.cssText    = 'position:fixed;pointer-events:none;display:none;z-index:9999;transform:translateX(-50%);align-items:center;';
    tipBox.style.cssText = 'background:' + tipBg + ';color:#fff;padding:8px 12px;border-radius:4px;font-family:' + theme.fontFamily + ';white-space:nowrap;line-height:1.5;';
    tipArr.style.cssText = 'width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ' + tipBg + ';align-self:center;';
    tip.appendChild(tipBox);
    tip.appendChild(tipArr);
    document.body.appendChild(tip);

    var chartLabels = { annual: 'Annual Added Cost', lifetime: 'Lifetime Added Cost' };
    var barLabels   = { auto: 'Auto Loan', mortgage: 'Mortgage', biz: 'Small Business Loan' };

    function showTip(event, chartLabel, barLabel, value) {
      var axSz = parseInt(theme.axisSize, 10);
      tipBox.innerHTML =
        '<span style="display:block;font-size:' + axSz + 'px;opacity:0.7;margin-bottom:2px;">' + chartLabel + '</span>' +
        '<span style="display:flex;align-items:baseline;gap:10px;">' +
          '<span style="font-size:' + theme.bodySize + ';font-weight:700;">' + barLabel + '</span>' +
          '<span style="font-size:' + theme.bodySize + ';font-weight:700;">' + value + '</span>' +
        '</span>';
      tip.style.display = 'flex';
      positionTip(event);
    }

    function positionTip(event) {
      var gap  = 4;
      var rect = tip.getBoundingClientRect();
      tip.style.left = event.clientX + 'px';
      if (event.clientY - rect.height - gap > 0) {
        // Above cursor: box on top, arrow pointing down at bottom
        tip.style.top           = (event.clientY - rect.height - gap) + 'px';
        tip.style.flexDirection = 'column';
        tipArr.style.cssText    = 'width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ' + tipBg + ';align-self:center;';
      } else {
        // Below cursor: arrow pointing up at top, box below
        tip.style.top           = (event.clientY + gap) + 'px';
        tip.style.flexDirection = 'column-reverse';
        tipArr.style.cssText    = 'width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:8px solid ' + tipBg + ';align-self:center;';
      }
    }

    function hideTip() { tip.style.display = 'none'; }

    // Bar highlight via SVG opacity + x-axis label bold/color
    var barColors = { auto: theme.colorAuto, mortgage: theme.colorMortgage, biz: theme.colorBiz };

    var axisKeyOrder = ['auto', 'mortgage', 'biz'];

    // Tick text nodes captured at draw time (see drawBarChart → opts.tickTextOut)
    var annualTickTexts   = [];
    var lifetimeTickTexts = [];

    function highlightBar(svgEl, activeIdx) {
      window.d3.select(svgEl).selectAll('.bar')
        .attr('opacity', function(d) { return d.index === activeIdx ? 1 : 0.2; });
      var tickTexts = svgEl === annualSvg ? annualTickTexts : lifetimeTickTexts;
      tickTexts.forEach(function(el, i) {
        el.setAttribute('fill', i === activeIdx ? barColors[axisKeyOrder[i]] : theme.axisText);
        if (i === activeIdx) { el.setAttribute('font-weight', '700'); }
        else                 { el.removeAttribute('font-weight'); }
      });
    }
    function resetBars(svgEl) {
      window.d3.select(svgEl).selectAll('.bar').attr('opacity', 1);
      var tickTexts = svgEl === annualSvg ? annualTickTexts : lifetimeTickTexts;
      tickTexts.forEach(function(el) {
        el.setAttribute('fill', theme.axisText);
        el.removeAttribute('font-weight');
      });
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
    function makeOpts(svgEl, section, logScale, format) {
      var tickOut = section === 'annual' ? annualTickTexts : lifetimeTickTexts;
      return {
        logScale: logScale,
        format: format,
        tickTextOut: tickOut,
        onBarOver: function(idx, event) {
          highlightBar(svgEl, idx);
          highlightCard(section, idx);
          var d = datasets[section][idx];
          var valStr = format === 'pct'
            ? (d.value % 1 === 0 ? d.value + '%' : d.value.toFixed(1) + '%')
            : '$' + Math.round(d.value).toLocaleString();
          showTip(event, chartLabels[section], barLabels[d.key], valStr);
        },
        onBarMove: positionTip,
        onBarOut: function() {
          resetBars(svgEl);
          resetCards(section);
          hideTip();
        }
      };
    }

    function renderAll() {
      drawBarChart(annualSvg,   datasets.annual,   makeOpts(annualSvg,   'annual',   false, 'dollar'), theme);
      drawBarChart(lifetimeSvg, datasets.lifetime, makeOpts(lifetimeSvg, 'lifetime', false, 'pct'),    theme);
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

    // Calculator — live comma formatting on loan amount input
    var loanInput = document.getElementById(uid + '-loanAmount');
    loanInput.addEventListener('input', function() {
      var digits = this.value.replace(/[^0-9]/g, '');
      if (!digits) { this.value = ''; return; }
      var num = Math.min(parseInt(digits, 10), 999999999);
      this.value = num.toLocaleString();
    });

    // Calculator — loan type buttons
    document.querySelectorAll('#' + uid + ' .loan-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#' + uid + ' .loan-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    document.getElementById(uid + '-calcBtn').addEventListener('click', function() {
      var amount = parseFloat(document.getElementById(uid + '-loanAmount').value.replace(/,/g, ''));
      var typeEl = document.querySelector('#' + uid + ' .loan-btn.active');
      var result = document.getElementById(uid + '-calcResult');

      if (!amount || amount <= 0) { result.innerHTML = '<span class="calc-error">Please enter a valid loan amount.</span>'; return; }
      if (!typeEl)                 { result.innerHTML = '<span class="calc-error">Please select a loan type.</span>';        return; }

      var type      = typeEl.dataset.value;
      var typeLabel = type === 'auto' ? 'auto loan' : type === 'mortgage' ? 'mortgage' : 'small business loan';
      var loan      = LOANS[type];
      var impact    = computeLoanImpact(amount, loan.observedRate, loan.passthrough, SCENARIOS.since2015.central, loan.term);

      result.innerHTML =
        '<div>Federal legislation since 2015 has raised borrowing costs on a <strong>$' + amount.toLocaleString() + ' ' + typeLabel + '</strong> by:</div>' +
        '<div style="margin-top:12px;"><span class="result-amount">$' + impact.annualImpact.toLocaleString()   + '</span> annually</div>' +
        '<div><span class="result-amount">$'                          + impact.lifetimeImpact.toLocaleString()  + '</span> over the life of your loan</div>';
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  function loadD3(cb) {
    if (window.d3) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://d3js.org/d3.v7.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function initChart(placeholder) {
    var uid   = 'tbl-inf-' + Math.random().toString(36).slice(2, 8);
    var theme = resolveTheme();
    placeholder.id = uid;
    var style = document.createElement('style');
    style.textContent = buildCSS(uid, theme);
    document.head.appendChild(style);
    placeholder.innerHTML = buildHTML(uid);
    loadD3(function() { initInteractivity(uid, theme); });
  }

  function run() {
    document.querySelectorAll('[data-tbl-infographic]').forEach(initChart);
  }

  window.TBL_INFOGRAPHIC = { run: run, initChart: initChart };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else { run(); }
}());
