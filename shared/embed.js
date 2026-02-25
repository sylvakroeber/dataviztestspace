/**
 * TBL Universal Chart Embed Loader
 * ---------------------------------
 * Drop this <script> tag wherever a chart should appear on a host page.
 * The data-chart attribute identifies which chart to load.
 *
 * Usage:
 *   <script data-chart="tariff-tracker-f1"
 *           src="https://sylvakroeber.github.io/dataviztestspace/shared/embed.js">
 *   </script>
 *
 * The loader:
 *   1. Creates the placeholder <div> immediately before the <script> tag
 *   2. Loads theme → core → chart engine → chart-runner in order
 *   3. chart-runner auto-initialises by scanning for [data-chart-base] divs
 *
 * The only value to change per deployment is SITE.
 */
(function () {
  'use strict';

  var SITE = 'https://sylvakroeber.github.io/dataviztestspace/';

  var me      = document.currentScript;
  var chartId = me.getAttribute('data-chart');

  if (!chartId) {
    console.error('[TBL] embed.js: the data-chart attribute is required, e.g. data-chart="tariff-tracker-f1"');
    return;
  }

  // Insert the placeholder div immediately before this <script> tag
  var div = document.createElement('div');
  div.setAttribute('data-tbl-chart',  '');
  div.setAttribute('data-chart-base', SITE + chartId + '/');
  div.setAttribute('data-logo',       SITE + 'shared/tbl-logo-blue.svg');
  div.setAttribute('data-no-xlsx',    '');   // runner uses CSV; skip SheetJS
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

  // Load order: theme → core → chart engine → runner (runner auto-initialises)
  loadScript('shared/theme-v1.js', function () {
    loadScript('shared/chart-core.js', function () {
      loadScript('shared/chart-renderer.js', function () {
        loadScript('shared/chart-runner.js');
      });
    });
  });

}());
