/**
 * TBL Chart Embed Loader
 * ----------------------
 * Drop this <script> tag wherever the chart should appear on a host page.
 * It creates the placeholder div, then loads the script stack in order:
 *   theme → core → line chart engine → chart
 *
 * The only value to change per deployment is SITE.
 */
(function () {
  'use strict';

  var SITE = 'https://sylvakroeber.github.io/dataviztestspace/';

  // Insert the placeholder div immediately before this <script> tag
  var me = document.currentScript;
  var div = document.createElement('div');
  div.setAttribute('data-tbl-chart', '');
  div.setAttribute('data-logo', SITE + 'tariff-tracker-f1/TBL_ID_Graph_BrightBlue_KO.svg');
  me.parentNode.insertBefore(div, me);

  function showLoadError(filename) {
    div.style.cssText = [
      'padding:16px',
      'background:#fff3f3',
      'border:1px solid #f5c6cb',
      'border-radius:6px',
      'color:#721c24',
      'font-family:system-ui,sans-serif',
      'font-size:13px',
    ].join(';');
    div.textContent = 'Chart failed to load: could not fetch ' + filename;
  }

  function loadScript(relPath, onload) {
    var s = document.createElement('script');
    s.src = SITE + relPath;
    s.onerror = function () { showLoadError(relPath.split('/').pop()); };
    if (onload) s.onload = onload;
    document.head.appendChild(s);
  }

  // Load order: theme → core → line chart engine → chart-specific logic
  loadScript('shared/theme-v1.js', function () {
    loadScript('shared/chart-core.js', function () {
      loadScript('tariff-tracker-f1/linechart.js', function () {
        loadScript('tariff-tracker-f1/chart.js');
      });
    });
  });

}());
