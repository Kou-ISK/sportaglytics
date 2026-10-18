/**
 * Quote a spreadsheet-facing CSV cell. Text that could be read as a formula
 * gets an apostrophe; numbers keep their numeric spelling. This changes only
 * the export, not the stored value. Spreadsheet re-save behavior varies.
 */
export const toSpreadsheetCsvCell = (value: string | number): string => {
  const text = String(value);
  // Include leading whitespace, control characters and Japanese full-width
  // formula markers. Quoting alone does not prevent formula interpretation.
  const needsTextPrefix =
    typeof value === 'string' &&
    /^[\s\uFEFF]*[=+\-@＝＋－＠\t\r\n]/u.test(value);
  const escaped = (needsTextPrefix ? `'${text}` : text).replace(/"/g, '""');
  return `"${escaped}"`;
};
