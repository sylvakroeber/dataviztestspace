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

  if (window.TBL_THEME) {
    loadInfographic();
  } else {
    var t = document.createElement('script');
    t.src = SITE + 'd3charts/theme-v1.js';
    t.onload = loadInfographic;
    document.head.appendChild(t);
  }
}());
