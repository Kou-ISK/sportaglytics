import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MAX_PACKAGE_JSON_BYTES } from '../../../../shared/packageJsonLimits';
import {
  writeTimelineExportFile,
  writeTimelineFile,
} from './timelineImportExportGateway';

const original = '{"version":2,"rows":[],"instances":[]}';
let disk: string;
const writeTextFile = vi.fn(async (_file: string, content: string) => {
  disk = content;
  return true;
});
beforeEach(() => {
  disk = original;
  writeTextFile.mockClear();
  vi.stubGlobal('window', { electronAPI: { writeTextFile } });
});
afterEach(() => vi.unstubAllGlobals());

const jsonAtSize = (bytes: number, unit: string): string => {
  const paddingBytes =
    bytes - Buffer.byteLength(JSON.stringify({ memo: '' }), 'utf8');
  const unitBytes = Buffer.byteLength(unit, 'utf8');
  return JSON.stringify({
    memo:
      unit.repeat(Math.floor(paddingBytes / unitBytes)) +
      'a'.repeat(paddingBytes % unitBytes),
  });
};

it.each(
  [
    { label: 'ASCII', unit: 'a' },
    { label: 'Japanese and emoji', unit: 'あ🙂' },
  ].flatMap((sample) => [-1, 0, 1].map((offset) => ({ ...sample, offset }))),
)(
  'checks the encoded JSON bytes at the boundary: $label offset $offset',
  async ({ unit, offset }) => {
    const bytes = MAX_PACKAGE_JSON_BYTES + offset;
    const content = jsonAtSize(bytes, unit);
    expect(Buffer.byteLength(content, 'utf8')).toBe(bytes);
    const accepted = await writeTimelineFile(
      '/synthetic/timeline.json',
      content,
    );
    expect(accepted).toBe(bytes <= MAX_PACKAGE_JSON_BYTES);
    if (accepted) {
      expect(writeTextFile).toHaveBeenCalledOnce();
      expect(disk === content).toBe(true);
    } else {
      expect(writeTextFile).not.toHaveBeenCalled();
      expect(disk).toBe(original);
    }
  },
);

it('does not apply the package size cap to exchange exports', async () => {
  const content = jsonAtSize(MAX_PACKAGE_JSON_BYTES + 1, 'あ🙂');
  expect(await writeTimelineExportFile('/synthetic/export.json', content)).toBe(
    true,
  );
  expect(writeTextFile).toHaveBeenCalledOnce();
  expect(disk === content).toBe(true);
});
