/**
 * Chart 1 — Customs Duty Revenue
 * --------------------------------
 * Data logic only. Infrastructure: chart-core.js + linechart.js.
 *
 * seriesDefs, sheet config, data transforms, and annotation values
 * all live here. Visual styling is inherited from theme-v1.js.
 */
if (!window.TBL_LINE) { console.error('[TBL] linechart.js must load before chart.js'); }

TBL_LINE.run(
  'tariff_impacts_results_20260216.xlsx',         // data source — first, required

  function ({ drawChart, showError, excelDateToYYYYMM, palette, DATA_SOURCE }) {
    return async function fetchAndRender() {
      try {
        const res = await fetch(DATA_SOURCE + '?_=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buffer   = await res.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const rows     = XLSX.utils.sheet_to_json(workbook.Sheets['F1'], { header: 1 });

        const dataRows = rows.slice(6).filter(r => r[0]);

        const series = [
          { name: 'Customs duties (nominal USD)', color: palette[0], col: 1 },
          { name: 'Customs duties (2025 USD)',    color: palette[1], col: 2 },
        ].map(s => ({
          name:  s.name,
          color: s.color,
          data:  dataRows
            .map(r => ({ date: excelDateToYYYYMM(r[0]), value: +r[s.col] / 1000 }))
            .filter(d => d.date && !isNaN(d.value)),
        }));

        drawChart({
          title:               rows[0][0] || 'Chart',
          unit:                'Billions USD',
          series,
          avgValue:            dataRows.length ? +dataRows[0][3] / 1000 : null,
          avgLabel:            '2022\u20132024 avg (2025 USD)',
          avgLabelDate:        '2023-02-01',
          verticalAnnotations: [{ date: '2025-01-01', color: 'dim' }],
          tooltipFormatter:    (name, v) => '$' + (v % 1 < 0.05 ? v.toFixed(0) : v.toFixed(1)) + ' billion',
        });
      } catch (err) {
        showError(err.message);
      }
    };
  },

  'blues'                                         // palette — last, optional
);
