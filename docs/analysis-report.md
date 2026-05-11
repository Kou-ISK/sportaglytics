# Analysis Report Export

SporTagLytics can export analysis output as clipboard text, PNG snapshots, and PDF reports from the analysis window. This document describes the user-facing behavior and implementation boundary.

## User-Facing Outputs

| Output                  | Scope                                                   | Notes                                      |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------ |
| Structured summary copy | Current analysis view summary                           | Copies text to clipboard                   |
| PNG export              | Current visible analysis view, including scroll content | Long content may be split into parts       |
| PDF analysis report     | Dashboard, momentum, matrix, metadata summaries         | Uses print-focused report route and layout |

The analysis export actions are available from the analysis window toolbar.

## PDF Report Contents

The PDF report is built from `src/report/buildAnalysisReportData.ts`.

- Metadata: generated date, team names, active filters, timeline count.
- Dashboard: active dashboard cards and widgets, paginated for print.
- Momentum: possession / momentum sections in print mode.
- Matrix: team/action grouped matrix sections and visible count summaries.

The report is intentionally generated from structured data, not from a screenshot of the current tab. This keeps PDF output stable even when the screen layout changes.

## Runtime Boundary

- Renderer builds report context and asks `analysisReportPdfGateway` to save.
- Electron main process creates a hidden print `BrowserWindow`.
- The print window loads `#/analysis-report?requestId=<id>`.
- Main sends typed report payload to the print window.
- The report renderer signals `analysis-report:render-ready`.
- Main calls `webContents.printToPDF` and writes the selected PDF file.

The hidden print window uses the same Electron security baseline as other windows:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`
- `applyWindowSecurity`

## PNG Export Boundary

PNG export captures the current analysis window region through a typed Electron API. Scrollable content is captured in slices and stitched. Very tall exports are split to avoid oversized image buffers.

PNG export is screen-oriented; PDF export is report-oriented. Prefer PDF when the output needs stable pagination and complete dashboard / matrix / momentum sections.

## Development Notes

When changing report data, update these areas together:

- `src/report/types.ts`
- `src/report/buildAnalysisReportData.ts`
- `src/report/printLayoutUtils.ts`
- `src/features/analysisReport/`
- `electron/src/ipc/reportHandlers.ts` if the print IPC contract changes
- `docs/user-guide.md` and this document if user-visible output changes

Add or update tests under `src/report/` or `src/features/analysisReport/` for report data shape, pagination, and render-ready behavior.
