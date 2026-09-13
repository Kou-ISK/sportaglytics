import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Read the PE import table directly: a developer PC may already contain VC++
// runtimes, so launching successfully alone does not prove portable packaging.
const importedLibraries = async (file) => {
  const data = await readFile(file);
  const pe = data.readUInt32LE(0x3c);
  assert.equal(data.toString('ascii', pe, pe + 4), 'PE\u0000\u0000');
  const sectionCount = data.readUInt16LE(pe + 6);
  const optionalSize = data.readUInt16LE(pe + 20);
  const optional = pe + 24;
  const directories =
    optional + (data.readUInt16LE(optional) === 0x20b ? 112 : 96);
  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const start = optional + optionalSize + index * 40;
    return {
      rva: data.readUInt32LE(start + 12),
      size: Math.max(
        data.readUInt32LE(start + 8),
        data.readUInt32LE(start + 16),
      ),
      offset: data.readUInt32LE(start + 20),
    };
  });
  const offsetOf = (rva) => {
    const section = sections.find(
      (entry) => rva >= entry.rva && rva < entry.rva + entry.size,
    );
    assert.ok(section, `Invalid PE RVA in ${file}`);
    return section.offset + rva - section.rva;
  };
  const imports = [];
  const importRva = data.readUInt32LE(directories + 8);
  if (!importRva) return imports;
  for (
    let entry = offsetOf(importRva);
    data.readUInt32LE(entry + 12);
    entry += 20
  ) {
    const name = offsetOf(data.readUInt32LE(entry + 12));
    imports.push(
      data.toString('ascii', name, data.indexOf(0, name)).toLowerCase(),
    );
  }
  return imports;
};

const systemLibraries = new Set([
  'kernel32.dll',
  'user32.dll',
  'gdi32.dll',
  'advapi32.dll',
  'bcrypt.dll',
  'ole32.dll',
  'oleaut32.dll',
  'shell32.dll',
  'shlwapi.dll',
  'ws2_32.dll',
  'secur32.dll',
  'crypt32.dll',
  'winmm.dll',
  'ntdll.dll',
  'msvcrt.dll',
  'ucrtbase.dll',
  'psapi.dll',
  'version.dll',
  'avrt.dll',
  // Windows Video for Windows capture API (vfw.h).
  'avicap32.dll',
]);
for (const name of process.argv.slice(2)) {
  const file = resolve(name);
  const imports = await importedLibraries(file);
  const external = imports.filter(
    (library) =>
      !systemLibraries.has(library) && !library.startsWith('api-ms-win-'),
  );
  assert.deepEqual(external, [], `${file} requires non-system DLLs`);
  console.log(`Self-contained native runtime: ${file} (${imports.join(', ')})`);
}
