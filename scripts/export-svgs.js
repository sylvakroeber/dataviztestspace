/**
 * export-svgs.js — Puppeteer-based SVG export for all chart directories.
 *
 * Usage (from repo root, with a local HTTP server running on port 8080):
 *   node scripts/export-svgs.js
 *
 * For each directory at the repo root that contains chart.html the script:
 *   1. Opens chartN/chart.html in a headless Chrome tab.
 *   2. Waits for window.TBL_EXPORT.isReady() to return true.
 *   3. Calls window.TBL_EXPORT.getSVGString() to get the composite SVG.
 *   4. Writes the result to chartN/chart.svg.
 *
 * The GitHub Action in .github/workflows/export-svgs.yml calls this script
 * automatically whenever chart data or config files are pushed to main.
 */

'use strict';

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const BASE_URL   = process.env.EXPORT_BASE_URL || 'http://localhost:8080';
const POLL_MS    = 200;   // polling interval for isReady()
const TIMEOUT_MS = 30000; // max wait per chart

// Resolve paths relative to the repo root (one level up from scripts/).
const ROOT_DIR = path.resolve(__dirname, '..');

// Find all direct child directories that contain a chart.html file.
function findChartDirs() {
  return fs.readdirSync(ROOT_DIR, { withFileTypes: true })
    .filter(function (e) {
      return e.isDirectory() &&
        fs.existsSync(path.join(ROOT_DIR, e.name, 'chart.html'));
    })
    .map(function (e) { return e.name; });
}

// Open chartDir/chart.html, wait for TBL_EXPORT.isReady(), write chart.svg.
async function exportChart(browser, chartDir) {
  const url  = BASE_URL + '/' + chartDir + '/chart.html';
  const out  = path.join(ROOT_DIR, chartDir, 'chart.svg');
  const page = await browser.newPage();

  page.on('console', function (msg) {
    if (msg.type() === 'error') console.error('[page]', chartDir, msg.text());
  });

  try {
    console.log('Opening:', url);
    await page.setViewport({ width: 960, height: 700 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: TIMEOUT_MS });

    // Poll until window.TBL_EXPORT.isReady() returns true.
    const start = Date.now();
    let ready = false;
    while (!ready) {
      ready = await page.evaluate(function () {
        return !!(window.TBL_EXPORT && window.TBL_EXPORT.isReady());
      });
      if (!ready) {
        if (Date.now() - start > TIMEOUT_MS) {
          throw new Error('Timed out waiting for TBL_EXPORT.isReady()');
        }
        await new Promise(function (r) { setTimeout(r, POLL_MS); });
      }
    }

    const svgStr = await page.evaluate(function () {
      return window.TBL_EXPORT.getSVGString();
    });

    if (!svgStr) throw new Error('getSVGString() returned empty result');

    fs.writeFileSync(out, svgStr, 'utf8');
    console.log('Written:', path.relative(ROOT_DIR, out));

    // Screenshot the chart element to produce a pixel-perfect PNG.
    const chartEl = await page.$('[data-tbl-chart]');
    if (chartEl) {
      const pngPath = path.join(ROOT_DIR, chartDir, 'chart.png');
      await chartEl.screenshot({ path: pngPath, type: 'png' });
      console.log('Written:', path.relative(ROOT_DIR, pngPath));
    }
  } catch (err) {
    console.error('FAILED:', chartDir, '-', err.message);
  } finally {
    await page.close();
  }
}

(async function main() {
  const dirs = findChartDirs();
  if (!dirs.length) {
    console.log('No chart directories found (no chart.html in any subdirectory).');
    process.exit(0);
  }
  console.log('Found chart dirs:', dirs.join(', '));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const dir of dirs) {
    await exportChart(browser, dir);
  }

  await browser.close();
  console.log('Export complete.');
}());
