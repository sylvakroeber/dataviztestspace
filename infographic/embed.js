(function () {
  var SITE = 'https://sylvakroeber.github.io/dataviztestspace/';

  var div = document.createElement('div');
  div.setAttribute('data-tbl-infographic', '');
  var me = document.currentScript;
  me.parentNode.insertBefore(div, me);

  function loadInfographic() {
    var s = document.createElement('script');
    s.src = SITE + 'infographic/infographic.js';
    document.head.appendChild(s);
  }

  function loadCore() {
    if (window.TBL_CORE) { loadInfographic(); return; }
    var c = document.createElement('script');
    c.src = SITE + 'd3charts/chart-core.js';
    c.onload = loadInfographic;
    document.head.appendChild(c);
  }

  if (window.TBL_THEME) {
    loadCore();
  } else {
    var t = document.createElement('script');
    t.src = SITE + 'd3charts/theme-v1.js';
    t.onload = loadCore;
    document.head.appendChild(t);
  }
}());
