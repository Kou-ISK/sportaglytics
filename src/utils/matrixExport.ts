type HeaderCell = { parent: string | null; child: string };
type MatrixCountCell = { count: number };

interface MatrixExportTable {
  rowHeaders: HeaderCell[];
  columnHeaders: HeaderCell[];
  matrix: MatrixCountCell[][];
}

interface BuildMatrixExportAoaParams {
  table: MatrixExportTable;
}

type AoaCell = string | number;
type MatrixExportAoa = AoaCell[][];

const headerLabel = (header: HeaderCell) =>
  header.parent
    ? `${header.parent} > ${header.child || '未設定'}`
    : header.child || '未設定';

const toUniqueLabels = (headers: HeaderCell[]) => {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const base = headerLabel(header);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) return base;
    return `${base} (${count + 1})`;
  });
};

export const buildMatrixExportAoa = ({
  table,
}: BuildMatrixExportAoaParams): MatrixExportAoa => {
  const { rowHeaders, columnHeaders, matrix } = table;
  const columnLabels = toUniqueLabels(columnHeaders);
  const columnTotals = new Array(columnHeaders.length).fill(0);

  const aoa: MatrixExportAoa = [
    ['RowParent', 'Row', ...columnLabels, 'RowTotal'],
  ];

  let grandTotal = 0;

  rowHeaders.forEach((rowHeader, rowIndex) => {
    const counts = columnHeaders.map((_, colIndex) => {
      const value = matrix[rowIndex]?.[colIndex]?.count ?? 0;
      columnTotals[colIndex] += value;
      return value;
    });
    const rowTotal = counts.reduce((sum, value) => sum + value, 0);
    grandTotal += rowTotal;

    aoa.push([
      rowHeader.parent || '',
      rowHeader.child || '未設定',
      ...counts,
      rowTotal,
    ]);
  });

  aoa.push(['ColumnTotal', '', ...columnTotals, grandTotal]);

  return aoa;
};

const toCsvCell = (value: AoaCell) => {
  const normalized = String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
};

export const buildMatrixCsv = (aoa: MatrixExportAoa): string =>
  aoa.map((row) => row.map(toCsvCell).join(',')).join('\n');

const XML_DECLARATION =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toColumnName = (zeroBasedIndex: number): string => {
  let index = zeroBasedIndex + 1;
  let columnName = '';

  while (index > 0) {
    const remainder = (index - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    index = Math.floor((index - 1) / 26);
  }

  return columnName;
};

const buildWorksheetXml = (aoa: MatrixExportAoa): string => {
  const rows = aoa
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${toColumnName(columnIndex)}${rowNumber}`;

          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${reference}"><v>${value}</v></c>`;
          }

          return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(
            String(value ?? ''),
          )}</t></is></c>`;
        })
        .join('');

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  return `${XML_DECLARATION}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
};

const buildWorkbookXml = (sheetName: string): string =>
  `${XML_DECLARATION}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(
    sheetName,
  )}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const textEncoder = new TextEncoder();

const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const uint16 = (value: number): Uint8Array =>
  new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);

const uint32 = (value: number): Uint8Array =>
  new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
};

interface ZipEntryInput {
  path: string;
  content: string;
}

const buildZip = (entries: ZipEntryInput[]): Uint8Array => {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.path);
    const contentBytes = textEncoder.encode(entry.content);
    const checksum = crc32(contentBytes);
    const compressedSize = contentBytes.length;
    const uncompressedSize = contentBytes.length;
    const entryOffset = offset;

    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(compressedSize),
      uint32(uncompressedSize),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    ]);

    localChunks.push(localHeader, contentBytes);
    offset += localHeader.length + contentBytes.length;

    centralChunks.push(
      concatBytes([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(checksum),
        uint32(compressedSize),
        uint32(uncompressedSize),
        uint16(nameBytes.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(entryOffset),
        nameBytes,
      ]),
    );
  }

  const centralDirectory = concatBytes(centralChunks);
  const centralDirectoryOffset = offset;
  const endOfCentralDirectory = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.length),
    uint32(centralDirectoryOffset),
    uint16(0),
  ]);

  return concatBytes([...localChunks, centralDirectory, endOfCentralDirectory]);
};

const toBase64 = (bytes: Uint8Array): string => {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triplet = (first << 16) | (second << 8) | third;

    result += alphabet[(triplet >>> 18) & 0x3f];
    result += alphabet[(triplet >>> 12) & 0x3f];
    result += index + 1 < bytes.length ? alphabet[(triplet >>> 6) & 0x3f] : '=';
    result += index + 2 < bytes.length ? alphabet[triplet & 0x3f] : '=';
  }

  return result;
};

export const buildMatrixXlsxBase64 = (
  aoa: MatrixExportAoa,
  sheetName = 'Matrix',
): string => {
  const archive = buildZip([
    {
      path: '[Content_Types].xml',
      content: `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      path: '_rels/.rels',
      content: `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      content: buildWorkbookXml(sheetName),
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content: `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    {
      path: 'xl/worksheets/sheet1.xml',
      content: buildWorksheetXml(aoa),
    },
  ]);

  return toBase64(archive);
};
