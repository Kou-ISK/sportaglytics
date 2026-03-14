import React from 'react';

export const AnalysisReportPrintStyles = () => {
  return (
    <style>
      {`
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          html, body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .analysis-report-sheet {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .analysis-report-page-break {
            break-before: page;
            page-break-before: always;
          }

          .analysis-report-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        `}
    </style>
  );
};
