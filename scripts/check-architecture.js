#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const FEATURES_ROOT = path.join(SRC_ROOT, 'features');

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

const featureNames = fs.existsSync(FEATURES_ROOT)
  ? new Set(
      fs
        .readdirSync(FEATURES_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    )
  : new Set();

const walk = (dir) => {
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
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
};

if (fs.existsSync(path.join(ROOT, 'src'))) walk(path.join(ROOT, 'src'));
if (fs.existsSync(path.join(ROOT, 'electron/src'))) walk(path.join(ROOT, 'electron/src'));
if (fs.existsSync(path.join(ROOT, 'scripts'))) walk(path.join(ROOT, 'scripts'));

const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"\n]+)['"]/g;

const normalize = (p) => p.replaceAll('\\', '/');

const toSrcSegments = (absPath) => {
  const rel = normalize(path.relative(ROOT, absPath));
  if (!rel.startsWith('src/')) return null;
  return rel.split('/');
};

const resolveImport = (file, spec) => {
  if (spec.startsWith('.')) {
    return path.resolve(path.dirname(file), spec);
  }
  if (spec.startsWith('src/')) {
    return path.resolve(ROOT, spec);
  }
  return null;
};

const violations = [];
const screenDirectWindowRegex =
  /\b(?:globalThis\.)?window\.electronAPI\b|\b(?:globalThis\.)?window\.location\b|\b(?:globalThis\.)?window\.close\s*\(/;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const fromSeg = toSrcSegments(file);
  const fromIsSrc = Boolean(fromSeg);
  const fromLayer = fromSeg?.[1];
  const fromFeature = fromSeg?.[1] === 'features' ? fromSeg[2] : null;
  const relPath = normalize(path.relative(ROOT, file));

  if (fromLayer === 'pages' && (fromSeg?.length ?? 0) > 3) {
    violations.push(`${relPath}: nested page implementation must live in features`);
  }

  if (relPath.includes('/view/hooks/')) {
    violations.push(`${relPath}: view/hooks is forbidden; move hook to controllers or feature hooks`);
  }

  if (relPath.includes('/ui/hooks/')) {
    violations.push(`${relPath}: ui/hooks is forbidden; move hook to controllers or gateways`);
  }

  if (
    fromLayer === 'hooks' &&
    fromSeg?.[2] &&
    featureNames.has(fromSeg[2])
  ) {
    violations.push(`${relPath}: feature-specific hooks must live under src/features/${fromSeg[2]}`);
  }

  if (
    fromLayer === 'contexts' &&
    fromSeg?.[2] &&
    featureNames.has(fromSeg[2])
  ) {
    violations.push(`${relPath}: feature-specific context must live under src/features/${fromSeg[2]}`);
  }

  if (relPath.endsWith('Screen.tsx') && screenDirectWindowRegex.test(content)) {
    violations.push(`${relPath}: Screen must not access window.electronAPI, window.location, or window.close directly`);
  }

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const spec = match[1];

    // shared -> features 禁止
    if (fromIsSrc && SHARED_DIRS.has(fromLayer) && spec.includes('features/')) {
      violations.push(`${relPath}: shared layer must not import features -> ${spec}`);
    }

    // features -> pages 禁止
    if (fromFeature && spec.includes('pages/')) {
      violations.push(`${relPath}: feature must not import pages -> ${spec}`);
    }

    // feature外から deep import 禁止
    if (fromIsSrc && fromLayer !== 'features' && spec.includes('features/')) {
      const resolved = resolveImport(file, spec);
      const rel = normalize(path.relative(ROOT, resolved || spec));
      const idx = rel.indexOf('src/features/');
      const target = idx >= 0 ? rel.slice(idx) : spec;
      const parts = target.split('/');
      // src/features/<feature> or src/features/<feature>/index only allowed
      const isAllowed =
        parts.length === 3 ||
        (parts.length === 4 && (parts[3] === 'index' || parts[3] === 'index.ts' || parts[3] === 'index.tsx'));
      if (!isAllowed) {
        violations.push(`${relPath}: feature external import must use public index -> ${spec}`);
      }
    }

    // pages -> shared を強制はしないが pages -> pages deep を抑止
    if (fromLayer === 'pages' && spec.includes('/pages/')) {
      violations.push(`${relPath}: pages should not import another page internals -> ${spec}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture check failed:');
  for (const v of violations) {
    console.error(`- ${v}`);
  }
  process.exit(1);
}

console.log('Architecture check passed');
