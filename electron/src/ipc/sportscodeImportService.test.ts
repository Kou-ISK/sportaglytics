import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SportscodeImportRequest } from '../../../src/shared/timeline/sportscodeImport';
import { createPackage } from './packageCreationService';
import {
  importSportscodePackage,
  isSportscodeImportRequest,
  readSportscodeXmlSource,
} from './sportscodeImportService';

vi.mock('./packageCreationService', () => ({ createPackage: vi.fn() }));
const roots: string[] = [];
beforeEach(() => {
  vi.mocked(createPackage).mockImplementation(async (directory, name) => {
    const folder = path.join(directory, name);
    await fs.mkdir(path.join(folder, '.metadata'), { recursive: true });
    await fs.mkdir(path.join(folder, 'videos'));
    await fs.writeFile(
      path.join(folder, 'videos/source.mp4'),
      'synthetic-media',
    );
    const clip = {
      id: 'clip',
      sourceKind: 'local' as const,
      relativePath: 'videos/source.mp4',
      absolutePath: path.join(folder, 'videos/source.mp4'),
      gapBeforeSeconds: 0,
      timelineStartSeconds: 0,
      durationSeconds: 60,
    };
    const angle = {
      id: 'angle',
      name: 'Imported video',
      sourceKind: 'local' as const,
      relativePath: 'videos/source.mp4',
      absolutePath: clip.absolutePath,
      clips: [clip],
    };
    await fs.writeFile(
      path.join(folder, '.metadata/config.json'),
      JSON.stringify({ packageFormatVersion: 1, angles: [angle] }),
    );
    await fs.writeFile(
      path.join(folder, 'timeline.json'),
      '{"version":2,"rows":[],"instances":[]}',
    );
    return {
      timelinePath: path.join(folder, 'timeline.json'),
      tightViewPath: clip.absolutePath,
      wideViewPath: null,
      angles: [angle],
      metaDataConfigFilePath: path.join(folder, '.metadata/config.json'),
    };
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});
const fixture = async (): Promise<SportscodeImportRequest> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sportscode-safe-'));
  roots.push(root);
  const xmlPath = path.join(root, '架空 #%.xml');
  await fs.writeFile(
    xmlPath,
    '<file><ALL_INSTANCES><instance><ID>1</ID><start>1.25</start><end>2.5</end><code>攻撃</code></instance></ALL_INSTANCES></file>',
  );
  const videoPath = path.join(root, '映像 #%.mp4');
  await fs.writeFile(videoPath, 'original-video');
  return {
    xmlPath,
    xmlSha256: (await readSportscodeXmlSource(xmlPath)).sha256,
    videoPath,
    directory: root,
    packageName: '日本語 🙂 #%',
    offsetSeconds: 0,
    sessionStart: null,
    warnings: [],
    document: {
      version: 2,
      rows: [{ id: 'r', name: '攻撃', color: '#123456' }],
      instances: [
        {
          id: 'sportscode-1',
          actionName: '攻撃',
          startTime: 1.25,
          endTime: 2.5,
          memo: '長いノート',
          labels: [
            { group: '位置', name: '中央' },
            { group: '方向', name: '中央' },
          ],
        },
      ],
    },
  };
};
it('publishes only the complete validated copy and leaves readonly originals unchanged', async () => {
  const request = await fixture();
  const xml = await fs.readFile(request.xmlPath);
  const video = await fs.readFile(request.videoPath);
  await fs.chmod(request.xmlPath, 0o444);
  await fs.chmod(request.videoPath, 0o444);
  const result = await importSportscodePackage(request);
  const destination = path.join(
    await fs.realpath(request.directory),
    `${request.packageName}.stpkg`,
  );
  expect(result.timelinePath).toBe(path.join(destination, 'timeline.json'));
  expect(result.angles[0].clips[0].absolutePath).toBe(
    path.join(destination, 'videos/source.mp4'),
  );
  expect(JSON.parse(await fs.readFile(result.timelinePath, 'utf8'))).toEqual(
    request.document,
  );
  expect(await fs.readFile(request.xmlPath)).toEqual(xml);
  expect(await fs.readFile(request.videoPath)).toEqual(video);
  expect((await fs.stat(request.xmlPath)).mode & 0o777).toBe(0o444);
  expect(
    (await fs.readdir(request.directory)).some((name) =>
      name.startsWith('.sportaglytics-import-'),
    ),
  ).toBe(false);
});
it.each(['EACCES', 'ENOSPC', 'EIO'])(
  'cleans a failed stage without touching originals: %s',
  async (code) => {
    const request = await fixture();
    const original = await fs.readFile(request.videoPath);
    // This failure is persistent; a single Windows denial may recover.
    vi.spyOn(fs, 'rename').mockRejectedValue(
      Object.assign(new Error(code), { code }),
    );
    await expect(importSportscodePackage(request)).rejects.toThrow(code);
    expect(await fs.readFile(request.videoPath)).toEqual(original);
    expect((await fs.readdir(request.directory)).sort()).toEqual(
      ['架空 #%.xml', '映像 #%.mp4'].sort(),
    );
  },
);
it('rejects a duplicate destination without overwriting its data', async () => {
  const request = await fixture();
  const target = path.join(request.directory, `${request.packageName}.stpkg`);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'sentinel'), 'keep');
  await expect(importSportscodePackage(request)).rejects.toThrow('同名');
  expect(await fs.readFile(path.join(target, 'sentinel'), 'utf8')).toBe('keep');
  expect(createPackage).not.toHaveBeenCalled();
});
it('rejects times beyond the chosen video rather than clamping or completing a partial project', async () => {
  const request = await fixture();
  request.document.instances[0].endTime = 61;
  await expect(importSportscodePackage(request)).rejects.toThrow('映像の長さ');
  expect((await fs.readdir(request.directory)).sort()).toEqual(
    ['架空 #%.xml', '映像 #%.mp4'].sort(),
  );
});
it('detects a changed source before copying', async () => {
  const request = await fixture();
  await fs.appendFile(request.xmlPath, '\n<!-- change -->');
  await expect(importSportscodePackage(request)).rejects.toThrow('選択後');
  expect(createPackage).not.toHaveBeenCalled();
});
it('rejects missing media and unsafe payloads before creating output', async () => {
  const request = await fixture();
  await fs.unlink(request.videoPath);
  await expect(importSportscodePackage(request)).rejects.toThrow();
  expect(createPackage).not.toHaveBeenCalled();
  expect(
    isSportscodeImportRequest({ ...request, offsetSeconds: Number.NaN }),
  ).toBe(false);
  expect(
    isSportscodeImportRequest({
      ...request,
      document: { version: 99, rows: [], instances: [] },
    }),
  ).toBe(false);
  expect(
    isSportscodeImportRequest({
      ...request,
      document: { ...request.document, rows: [] },
    }),
  ).toBe(false);
});
it('rejects native packages and external entities as XML sources', async () => {
  const request = await fixture();
  await expect(
    readSportscodeXmlSource(request.xmlPath.replace(/\.xml$/, '.scpkg')),
  ).rejects.toThrow('.xml');
  await fs.writeFile(
    request.xmlPath,
    '<!DOCTYPE file SYSTEM "https://example.invalid/external"><file/>',
  );
  await expect(readSportscodeXmlSource(request.xmlPath)).rejects.toThrow(
    '外部参照',
  );
});
