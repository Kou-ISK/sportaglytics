#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const ELECTRON_ROOT = path.join(ROOT, 'electron/src');

const TSX_LIMIT = 300;
const TS_LIMIT = 450;

const SHARED_DIRS = new Set([
  'components',
  'hooks',
  'utils',
  'types',
  'contexts',
  'report',
  'shared',
]);

const files = [];

const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
};

walk(SRC_ROOT);
walk(ELECTRON_ROOT);

const normalize = (value) => value.replaceAll('\\', '/');

const toSrcSegments = (absPath) => {
  const rel = normalize(path.relative(ROOT, absPath));
  if (!rel.startsWith('src/')) return null;
  return rel.split('/');
};

const resolveImport = (file, spec) => {
  if (spec.startsWith('.')) return path.resolve(path.dirname(file), spec);
  if (spec.startsWith('src/')) return path.resolve(ROOT, spec);
  return null;
};

const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"\n]+)['"]/g;

const fileInfoMap = new Map();
for (const file of files) {
  const rel = normalize(path.relative(ROOT, file));
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.length === 0 ? 0 : content.split('\n').length;
  const ext = rel.endsWith('.tsx') ? 'tsx' : 'ts';
  const budget = ext === 'tsx' ? TSX_LIMIT : TS_LIMIT;
  fileInfoMap.set(file, {
    rel,
    lines,
    ext,
    budget,
    overBudget: lines > budget,
    hardIssues: [],
  });
}

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const info = fileInfoMap.get(file);
  const fromSeg = toSrcSegments(file);
  const fromLayer = fromSeg?.[1];
  const fromFeature = fromSeg?.[1] === 'features' ? fromSeg[2] : null;
  const fromIsSrc = Boolean(fromSeg);

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const spec = match[1];

    if (fromIsSrc && SHARED_DIRS.has(fromLayer) && spec.includes('features/')) {
      info.hardIssues.push(`shared->features: ${spec}`);
    }

    if (fromFeature && spec.includes('pages/')) {
      info.hardIssues.push(`features->pages: ${spec}`);
    }

    if (fromIsSrc && fromLayer !== 'features' && spec.includes('features/')) {
      const resolved = resolveImport(file, spec);
      const rel = normalize(path.relative(ROOT, resolved || spec));
      const idx = rel.indexOf('src/features/');
      const target = idx >= 0 ? rel.slice(idx) : spec;
      const parts = target.split('/');
      const isAllowed =
        parts.length === 3 ||
        (parts.length === 4 &&
          (parts[3] === 'index' || parts[3] === 'index.ts' || parts[3] === 'index.tsx'));
      if (!isAllowed) {
        info.hardIssues.push(`feature deep import: ${spec}`);
      }
    }

    if (fromLayer === 'pages' && spec.includes('/pages/')) {
      info.hardIssues.push(`pages->pages deep import: ${spec}`);
    }

    if (fromIsSrc && (spec === 'electron' || spec.includes('ipcRenderer'))) {
      info.hardIssues.push(`renderer direct electron import: ${spec}`);
    }
  }
}

const rows = Array.from(fileInfoMap.values());
const hardViolated = rows.filter((row) => row.hardIssues.length > 0);
const hardCompliant = rows.filter((row) => row.hardIssues.length === 0);
const softCompliant = rows.filter(
  (row) => row.hardIssues.length === 0 && !row.overBudget,
);
const overBudgetRows = rows.filter((row) => row.overBudget);

const pct = (value, total) => {
  if (total === 0) return '0.0';
  return ((value / total) * 100).toFixed(1);
};

console.log('Architecture Health Report');
console.log(`- Total files: ${rows.length}`);
console.log(`- Hard compliant (MUST): ${hardCompliant.length}/${rows.length} (${pct(hardCompliant.length, rows.length)}%)`);
console.log(`- Soft compliant (MUST+budget): ${softCompliant.length}/${rows.length} (${pct(softCompliant.length, rows.length)}%)`);
console.log(`- Hard violations: ${hardViolated.length}`);
console.log(`- Over budget (Warn): ${overBudgetRows.length} (TSX>${TSX_LIMIT}, TS>${TS_LIMIT})`);

if (hardViolated.length > 0) {
  console.log('\nHard violation files:');
  hardViolated
    .sort((a, b) => a.rel.localeCompare(b.rel))
    .forEach((row) => {
      console.log(`- ${row.rel}`);
      row.hardIssues.forEach((issue) => console.log(`  - ${issue}`));
    });
}

if (overBudgetRows.length > 0) {
  console.log('\nTop over-budget files (by overflow):');
  overBudgetRows
    .map((row) => ({ ...row, overBy: row.lines - row.budget }))
    .sort((a, b) => b.overBy - a.overBy || b.lines - a.lines)
    .slice(0, 20)
    .forEach((row) => {
      console.log(`- ${String(row.lines).padStart(4)} lines (+${String(row.overBy).padStart(4)}): ${row.rel}`);
    });
}

process.exit(0);
