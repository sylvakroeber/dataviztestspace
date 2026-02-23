(function () {
  var CHARTJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  var _chartjsPromise = null;

  function ensureChartJs() {
    if (_chartjsPromise) return _chartjsPromise;
    if (window.Chart) {
      _chartjsPromise = Promise.resolve();
      return _chartjsPromise;
    }
    _chartjsPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CHARTJS_SRC;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return _chartjsPromise;
  }

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
      borderRadius:   S.borderRadius    || '8px',
      maxWidth:       S.maxWidth        || '900px',
      colorAuto:      blues[0]               || '#286dc0',
      colorMortgage:  C.annotationBright     || '#f28e2b',
      colorBiz:       cat[5]                 || '#b07aa1',
      calcBg:         blues[2]               || '#d9eaff',
    };
  }

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function parsePx(str) {
    return parseInt(str, 10);
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
      u + ' .chart-wrap canvas { width: 100% !important; }',

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
      u + ' .calc-checkboxes { display: flex; gap: 16px; flex-wrap: wrap; }',
      u + ' .calc-check { display: flex; align-items: center; gap: 7px; font-size: ' + theme.bodySize + '; cursor: pointer; }',
      u + ' .calc-check input { cursor: pointer; width: 16px; height: 16px; accent-color: ' + theme.titleText + '; }',
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
          '<div class="chart-wrap"><canvas id="' + uid + '-annual"></canvas></div>' +
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
          '<div class="chart-wrap"><canvas id="' + uid + '-lifetime"></canvas></div>' +
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
              '<div class="calc-checkboxes">' +
                '<label class="calc-check"><input type="radio" name="' + uid + '-loanType" value="auto" /> Auto</label>' +
                '<label class="calc-check"><input type="radio" name="' + uid + '-loanType" value="mortgage" /> Mortgage</label>' +
                '<label class="calc-check"><input type="radio" name="' + uid + '-loanType" value="business" /> Small Business</label>' +
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

  function initInteractivity(uid, theme) {
    var colors = {
      auto:     { bg: hexToRgba(theme.colorAuto, 0.85),      dim: hexToRgba(theme.colorAuto, 0.2),      border: hexToRgba(theme.colorAuto, 1),      dimBorder: hexToRgba(theme.colorAuto, 0.3)      },
      mortgage: { bg: hexToRgba(theme.colorMortgage, 0.85),  dim: hexToRgba(theme.colorMortgage, 0.2),  border: hexToRgba(theme.colorMortgage, 1),  dimBorder: hexToRgba(theme.colorMortgage, 0.3)  },
      biz:      { bg: hexToRgba(theme.colorBiz, 0.85),       dim: hexToRgba(theme.colorBiz, 0.2),       border: hexToRgba(theme.colorBiz, 1),       dimBorder: hexToRgba(theme.colorBiz, 0.3)       }
    };
    var order = ['auto', 'mortgage', 'biz'];
    var bgColors     = order.map(function(k) { return colors[k].bg; });
    var dimBg        = order.map(function(k) { return colors[k].dim; });
    var borderColors = order.map(function(k) { return colors[k].border; });
    var dimBorder    = order.map(function(k) { return colors[k].dimBorder; });

    function linearFmt(v) { if (v >= 1000) { return '$' + (v / 1000).toFixed(1) + 'k'; } return '$' + v; }

    function logFmt(v) {
      var allowed = [100, 1000, 10000, 100000];
      for (var i = 0; i < allowed.length; i++) { if (allowed[i] === v) { return v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'k' : '$' + v; } }
      return null;
    }

    function makeOptions(yFmt, logScale) {
      var xSize = parsePx(theme.axisSize);
      var ySize = Math.max(9, parsePx(theme.axisSize) - 1);
      return {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return ' $' + c.raw.toLocaleString(); } } } },
        scales: {
          x: { ticks: { color: theme.axisText, font: { size: xSize } }, grid: { color: theme.gridline } },
          y: { type: logScale ? 'logarithmic' : 'linear', ticks: { color: theme.axisText, font: { size: ySize }, callback: yFmt }, grid: { color: theme.gridline } }
        }
      };
    }

    var annualChart = new Chart(document.getElementById(uid + '-annual').getContext('2d'), {
      type: 'bar',
      data: { labels: ['Auto Loan', 'Mortgage', 'Small Business'], datasets: [{ data: [180, 3610, 1360], backgroundColor: bgColors.slice(), borderColor: borderColors.slice(), borderWidth: 1.5, borderRadius: 5, borderSkipped: false }] },
      options: makeOptions(linearFmt, false)
    });

    var lifetimeChart = new Chart(document.getElementById(uid + '-lifetime').getContext('2d'), {
      type: 'bar',
      data: { labels: ['Auto Loan', 'Mortgage', 'Small Business'], datasets: [{ data: [990, 108430, 6810], backgroundColor: bgColors.slice(), borderColor: borderColors.slice(), borderWidth: 1.5, borderRadius: 5, borderSkipped: false }] },
      options: makeOptions(logFmt, true)
    });

    function highlightBar(chart, idx) {
      var ds = chart.data.datasets[0];
      ds.backgroundColor = bgColors.map(function(c, i) { return i === idx ? c : dimBg[i]; });
      ds.borderColor = borderColors.map(function(c, i) { return i === idx ? c : dimBorder[i]; });
      chart.update('none');
    }

    function resetBars(chart) {
      var ds = chart.data.datasets[0];
      ds.backgroundColor = bgColors.slice();
      ds.borderColor = borderColors.slice();
      chart.update('none');
    }

    function highlightCard(section, idx) {
      document.querySelectorAll('#' + uid + ' .row[data-section="' + section + '"] .card').forEach(function(c) {
        var i = parseInt(c.dataset.index);
        c.classList.toggle('highlighted', i === idx);
        c.classList.toggle('dimmed', i !== idx);
      });
    }

    function resetCards(section) {
      document.querySelectorAll('#' + uid + ' .row[data-section="' + section + '"] .card').forEach(function(c) {
        c.classList.remove('highlighted', 'dimmed');
      });
    }

    document.querySelectorAll('#' + uid + ' .card').forEach(function(card) {
      var idx = parseInt(card.dataset.index);
      var section = card.closest('.row').dataset.section;
      var chart = section === 'annual' ? annualChart : lifetimeChart;
      card.addEventListener('mouseenter', function() { highlightBar(chart, idx); highlightCard(section, idx); });
      card.addEventListener('mouseleave', function() { resetBars(chart); resetCards(section); });
    });

    [annualChart, lifetimeChart].forEach(function(chart) {
      var section = chart.canvas.id === uid + '-annual' ? 'annual' : 'lifetime';
      chart.canvas.addEventListener('mousemove', function(e) {
        var pts = chart.getElementsAtEventForMode(e, 'index', { intersect: true }, false);
        if (pts.length) { highlightBar(chart, pts[0].index); highlightCard(section, pts[0].index); }
        else { resetBars(chart); resetCards(section); }
      });
      chart.canvas.addEventListener('mouseleave', function() { resetBars(chart); resetCards(section); });
    });

    var annualRates   = { auto: 180,  mortgage: 3610,   business: 1360 };
    var lifetimeRates = { auto: 990,  mortgage: 108430, business: 6810 };
    var baseAmounts   = { auto: 25000, mortgage: 400000, business: 100000 };

    document.getElementById(uid + '-calcBtn').addEventListener('click', function() {
      var amount = parseFloat(document.getElementById(uid + '-loanAmount').value);
      var typeEl = document.querySelector('#' + uid + ' input[name="' + uid + '-loanType"]:checked');
      var result = document.getElementById(uid + '-calcResult');

      if (!amount || amount <= 0) { result.innerHTML = '<span class="calc-error">Please enter a valid loan amount.</span>'; return; }
      if (!typeEl) { result.innerHTML = '<span class="calc-error">Please select a loan type.</span>'; return; }

      var type = typeEl.value;
      var typeLabel = type === 'auto' ? 'auto loan' : type === 'mortgage' ? 'mortgage' : 'small business loan';
      var ratio = amount / baseAmounts[type];
      var annual = Math.round(annualRates[type] * ratio);
      var lifetime = Math.round(lifetimeRates[type] * ratio);

      var intro = 'Federal legislation since 2015 has raised borrowing costs on a <strong>$' + amount.toLocaleString() + ' ' + typeLabel + '</strong> by:';
      var line2 = '<div style="margin-top:12px;"><span class="result-amount">$' + annual.toLocaleString() + '</span> annually</div>';
      var line3 = '<div><span class="result-amount">$' + lifetime.toLocaleString() + '</span> over the life of your loan</div>';
      result.innerHTML = '<div>' + intro + '</div>' + line2 + line3;
    });
  }

  function initChart(placeholder) {
    var uid   = 'tbl-inf-' + Math.random().toString(36).slice(2, 8);
    var theme = resolveTheme();
    placeholder.id = uid;
    var style = document.createElement('style');
    style.textContent = buildCSS(uid, theme);
    document.head.appendChild(style);
    placeholder.innerHTML = buildHTML(uid);
    ensureChartJs().then(function() { initInteractivity(uid, theme); });
  }

  function run() {
    document.querySelectorAll('[data-tbl-infographic]').forEach(initChart);
  }

  window.TBL_INFOGRAPHIC = { run: run, initChart: initChart };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else { run(); }
}());
