#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'electron/src'];

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) return fallback;
  const raw = Number(args[index + 1]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const outputPathArgIndex = args.indexOf('--output');
const outputPath =
  outputPathArgIndex >= 0 && outputPathArgIndex + 1 < args.length
    ? args[outputPathArgIndex + 1]
    : null;

const TSX_LIMIT = getArg('--tsx', 300);
const TS_LIMIT = getArg('--ts', 450);

const listFiles = (dir, acc) => {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }
    const nextAbs = path.join(abs, entry.name);
    if (entry.isDirectory()) {
      listFiles(path.relative(ROOT, nextAbs), acc);
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      acc.push(nextAbs);
    }
  }
};

const countLines = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.length === 0) return 0;
  return content.split('\n').length;
};

const files = [];
for (const dir of SCAN_DIRS) {
  listFiles(dir, files);
}

const rows = files
  .map((absPath) => {
    const relPath = path.relative(ROOT, absPath).replaceAll('\\', '/');
    const isTsx = relPath.endsWith('.tsx');
    const limit = isTsx ? TSX_LIMIT : TS_LIMIT;
    const lines = countLines(absPath);
    return {
      path: relPath,
      lines,
      limit,
      overBy: lines - limit,
      ext: isTsx ? 'tsx' : 'ts',
    };
  })
  .filter((row) => row.overBy > 0)
  .sort((a, b) => b.overBy - a.overBy || b.lines - a.lines || a.path.localeCompare(b.path));

const now = new Date().toISOString();
const summary = [
  `Large file report (${now})`,
  `Thresholds: TSX>${TSX_LIMIT}, TS>${TS_LIMIT}`,
  `Over-threshold files: ${rows.length}`,
];

for (const line of summary) {
  console.log(line);
}

if (rows.length === 0) {
  console.log('No over-threshold files found.');
} else {
  console.log('');
  for (const row of rows) {
    console.log(`${String(row.lines).padStart(5)} lines | +${String(row.overBy).padStart(4)} | ${row.path}`);
  }
}

if (outputPath) {
  const absOutput = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(ROOT, outputPath);
  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  const md = [
    '# Large File Report',
    '',
    `- Generated at: ${now}`,
    `- Thresholds: TSX>${TSX_LIMIT}, TS>${TS_LIMIT}`,
    `- Over-threshold files: ${rows.length}`,
    '',
    '| Lines | Over | File |',
    '| ---: | ---: | --- |',
    ...rows.map((row) => `| ${row.lines} | +${row.overBy} | \`${row.path}\` |`),
    '',
  ].join('\n');

  fs.writeFileSync(absOutput, md, 'utf8');
  console.log(`\nSaved markdown report: ${path.relative(ROOT, absOutput)}`);
}

process.exit(0);
