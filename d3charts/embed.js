(function () {
  var BASE = 'https://sylvakroeber.github.io/dataviztestspace/';

  var div = document.createElement('div');
  div.setAttribute('data-tbl-chart', '');
  div.setAttribute('data-logo', BASE + 'TBL_ID_Graph_BrightBlue_KO.svg');
  // data-src and data-palette removed — declared in chart.js TBL_LINE.run(...)

  var me = document.currentScript;
  me.parentNode.insertBefore(div, me);

  // Load order: theme → core → line chart engine → chart-specific logic
  var theme = document.createElement('script');
  theme.src = BASE + 'theme-v1.js';
  theme.onload = function () {
    var core = document.createElement('script');
    core.src = BASE + 'chart-core.js';
    core.onload = function () {
      var line = document.createElement('script');
      line.src = BASE + 'linechart.js';
      line.onload = function () {
        var s = document.createElement('script');
        s.src = BASE + 'chart.js';
        document.head.appendChild(s);
      };
      document.head.appendChild(line);
    };
    document.head.appendChild(core);
  };
  document.head.appendChild(theme);
}());
