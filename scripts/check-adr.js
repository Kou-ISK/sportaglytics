#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ADR_DIR = path.join(ROOT, 'docs', 'adr');
const ADR_INDEX = path.join(ADR_DIR, 'README.md');
const FILENAME_REGEX = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const VALID_STATUSES = new Set([
  'Proposed',
  'Accepted',
  'Deprecated',
  'Superseded',
]);

const violations = [];

const relative = (filePath) =>
  path.relative(ROOT, filePath).replaceAll(path.sep, '/');

const readSection = (content, heading) => {
  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex < 0) return null;

  const sectionLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith('## ')) break;
    sectionLines.push(lines[index]);
  }
  return sectionLines.join('\n').trim();
};

const firstMeaningfulLine = (section) =>
  section
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? null;

if (!fs.existsSync(ADR_DIR)) {
  violations.push('docs/adr directory does not exist');
} else if (!fs.existsSync(ADR_INDEX)) {
  violations.push('docs/adr/README.md does not exist');
}

const adrFiles = fs.existsSync(ADR_DIR)
  ? fs
      .readdirSync(ADR_DIR, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith('.md') &&
          entry.name !== 'README.md',
      )
      .map((entry) => entry.name)
      .sort()
  : [];

const ids = new Map();
const fileSet = new Set(adrFiles);

for (const fileName of adrFiles) {
  const filePath = path.join(ADR_DIR, fileName);
  const relPath = relative(filePath);
  const match = fileName.match(FILENAME_REGEX);

  if (!match) {
    violations.push(
      `${relPath}: filename must be NNNN-short-title.md with a four-digit ADR ID prefix`,
    );
    continue;
  }

  const [, id] = match;
  if (id === '0000') {
    violations.push(`${relPath}: ADR ID must start at 0001`);
  }
  if (ids.has(id)) {
    violations.push(
      `${relPath}: duplicate ADR ID ${id}; first seen in docs/adr/${ids.get(id)}`,
    );
  }
  ids.set(id, fileName);

  const content = fs.readFileSync(filePath, 'utf8');
  const firstLine = content.split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine?.startsWith(`# ${id} `)) {
    violations.push(`${relPath}: first heading must start with "# ${id} "`);
  }

  for (const heading of [
    'Status',
    'Date',
    'Context',
    'Decision',
    'Consequences',
  ]) {
    if (readSection(content, heading) === null) {
      violations.push(`${relPath}: missing "## ${heading}" section`);
    }
  }

  const status = firstMeaningfulLine(readSection(content, 'Status'));
  if (status && !VALID_STATUSES.has(status)) {
    violations.push(
      `${relPath}: invalid status "${status}"; expected one of ${Array.from(VALID_STATUSES).join(', ')}`,
    );
  }

  const date = firstMeaningfulLine(readSection(content, 'Date'));
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    violations.push(`${relPath}: date must be YYYY-MM-DD`);
  }
}

const sortedIds = Array.from(ids.keys()).sort();
if (sortedIds.length > 0) {
  const maxId = Number(sortedIds.at(-1));
  for (let id = 1; id <= maxId; id += 1) {
    const expected = String(id).padStart(4, '0');
    if (!ids.has(expected)) {
      violations.push(`docs/adr: missing sequential ADR ID ${expected}`);
    }
  }
}

if (fs.existsSync(ADR_INDEX)) {
  const indexContent = fs.readFileSync(ADR_INDEX, 'utf8');
  for (const fileName of adrFiles) {
    if (!indexContent.includes(`](${fileName})`)) {
      violations.push(
        `docs/adr/README.md: missing record link for ${fileName}`,
      );
    }
  }

  const linkedFiles = Array.from(
    indexContent.matchAll(/\((\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md)\)/g),
    (match) => match[1],
  );
  for (const linkedFile of linkedFiles) {
    if (!fileSet.has(linkedFile)) {
      violations.push(
        `docs/adr/README.md: linked ADR file does not exist: ${linkedFile}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error('ADR check failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('ADR check passed');
