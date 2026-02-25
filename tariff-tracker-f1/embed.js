/**
 * Tariff Tracker F1 — embed loader
 * ----------------------------------
 * Legacy per-chart embed file. Delegates to the universal shared/embed.js
 * loader pattern. Kept for backward compatibility with any existing embeds.
 *
 * Preferred usage on host pages (no need for this file):
 *   <script data-chart="tariff-tracker-f1"
 *           src="https://sylvakroeber.github.io/dataviztestspace/shared/embed.js">
 *   </script>
 */
(function () {
  'use strict';

  var SITE    = 'https://sylvakroeber.github.io/dataviztestspace/';
  var CHART   = 'tariff-tracker-f1';

  var me  = document.currentScript;
  var div = document.createElement('div');
  div.setAttribute('data-tbl-chart',  '');
  div.setAttribute('data-chart-base', SITE + CHART + '/');
  div.setAttribute('data-logo',       SITE + 'shared/tbl-logo-blue.svg');
  div.setAttribute('data-no-xlsx',    '');
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

  loadScript('shared/theme-v1.js', function () {
    loadScript('shared/chart-core.js', function () {
      loadScript('shared/chart-renderer.js', function () {
        loadScript('shared/chart-runner.js');
      });
    });
  });

}());
