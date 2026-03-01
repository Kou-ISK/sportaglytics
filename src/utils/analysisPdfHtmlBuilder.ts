export type AnalysisPdfTab = 'dashboard' | 'momentum' | 'matrix';

export interface AnalysisPdfImagePage {
  tab: AnalysisPdfTab;
  pageIndex: number;
  totalPages: number;
  dataUrl: string;
}

interface BuildAnalysisPdfHtmlOptions {
  summaryText: string;
  generatedAtIso: string;
  pages: AnalysisPdfImagePage[];
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildAnalysisPdfHtml = ({
  summaryText,
  generatedAtIso,
  pages,
}: BuildAnalysisPdfHtmlOptions): string => {
  const summaryHtml = escapeHtml(summaryText).replace(/\n/g, '<br />');
  const escapedGeneratedAt = escapeHtml(generatedAtIso);
  const tabLabelMap: Record<AnalysisPdfTab, string> = {
    dashboard: 'Dashboard',
    momentum: 'Momentum',
    matrix: 'Matrix',
  };

  const pageHtml = pages
    .map(
      (page) => `
      <section class="page image-page">
        <div class="header">
          <h1>${escapeHtml(tabLabelMap[page.tab])} ${page.pageIndex}/${page.totalPages}</h1>
          <p class="meta">Generated: ${escapedGeneratedAt}</p>
        </div>
        <div class="image-wrap">
          <img src="${page.dataUrl}" alt="${escapeHtml(tabLabelMap[page.tab])}" />
        </div>
      </section>
    `,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>SporTagLytics Analysis Report</title>
    <style>
      @page {
        size: A4;
        margin: 12mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        page-break-after: always;
      }

      .page:last-child {
        page-break-after: auto;
      }

      .header {
        margin-bottom: 10px;
      }

      .header h1 {
        margin: 0 0 4px;
        font-size: 20px;
      }

      .meta {
        margin: 0;
        font-size: 12px;
        color: #6b7280;
      }

      .summary {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 14px;
        font-size: 12px;
        line-height: 1.55;
        white-space: normal;
      }

      .image-page {
        display: flex;
        flex-direction: column;
        min-height: calc(297mm - 24mm);
      }

      .image-wrap {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        background: #ffffff;
      }

      .image-wrap img {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        display: block;
      }
    </style>
  </head>
  <body>
    <section class="page">
      <div class="header">
        <h1>Analysis Summary</h1>
        <p class="meta">Generated: ${escapedGeneratedAt}</p>
      </div>
      <div class="summary">${summaryHtml}</div>
    </section>
    ${pageHtml}
  </body>
</html>`;
};
