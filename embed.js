(function () {
  var BASE = 'https://sylvakroeber.github.io/dataviztestspace/';

  var div = document.createElement('div');
  div.setAttribute('data-tbl-chart', '');
  div.setAttribute('data-src', 'https://raw.githubusercontent.com/sylvakroeber/dataviztestspace/main/tariff_impacts_results_20260216.xlsx');
  div.setAttribute('data-logo', BASE + 'TBL_ID_Graph_BrightBlue_KO.svg');

  var me = document.currentScript;
  me.parentNode.insertBefore(div, me);

  // Load theme first (sets window.TBL_THEME), then chart.js reads it
  var theme = document.createElement('script');
  theme.src = BASE + 'theme-v1.js';
  theme.onload = function () {
    var s = document.createElement('script');
    s.src = BASE + 'chart.js';
    document.head.appendChild(s);
  };
  document.head.appendChild(theme);
}());
