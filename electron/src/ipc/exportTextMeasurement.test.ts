import { readFile, access } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { createClipTextMeasurer } from './exportTextMeasurement';
import { runMediaProcess } from './mediaProcessRunner';
vi.mock('./mediaProcessRunner', () => ({ runMediaProcess: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const run = vi.mocked(runMediaProcess);
const textFiles = (filter: string): string[] =>
  [...filter.matchAll(/:textfile=(.*?):expansion=none/g)].map((match) =>
    match[1].replace(/\\(.)/g, '$1').replace(/\\(.)/g, '$1'),
  );

it('batches requests, caches by text/weight/size and removes private text files', async () => {
  const paths: string[] = [];
  run.mockImplementation(async (_exe, args, options) => {
    const filter = args[args.indexOf('-vf') + 1];
    expect(filter).not.toContain('private');
    expect(options.timeoutMs).toBe(10000);
    const files = textFiles(filter);
    paths.push(...files);
    expect(await readFile(files[0], 'utf8')).toBe("private : 100% ' [note]");
    return {
      stdout: '',
      stderr: files
        .map(
          (_, index) =>
            `-${index + 1}.000000\n${100 + index}.000000\n-${index + 1}.000000\n${100 + index}.000000`,
        )
        .join('\n'),
    };
  });
  const measure = createClipTextMeasurer(
    () => '/ffmpeg',
    (bold) => (bold ? '/bold.ttf' : '/regular.ttf'),
  );
  const text = "private : 100% ' [note]";
  expect(
    await Promise.all([
      measure(text, false, 30),
      measure(text, true, 30),
      measure(text, false, 20),
      measure(text, false, 30),
    ]),
  ).toEqual([100, 101, 102, 100]);
  expect(run).toHaveBeenCalledTimes(1);
  for (const file of paths) await expect(access(file)).rejects.toThrow();
});

it.each([
  '',
  '-1.000000\n20.000000\n-1.000000\n21.000000',
  '-2.000000\n20.000000',
])(
  'rejects incomplete, inconsistent or unknown measurements',
  async (stderr) => {
    run.mockResolvedValue({ stdout: '', stderr });
    await expect(
      createClipTextMeasurer(
        () => '/ffmpeg',
        () => '/font',
      )('Text', false, 30),
    ).rejects.toThrow('文字幅');
  },
);

it('removes temporary files and hides raw diagnostics after a process failure', async () => {
  let file = '';
  run.mockImplementation(async (_exe, args) => {
    file = textFiles(args[args.indexOf('-vf') + 1])[0] ?? '';
    throw new Error('private path and diagnostics');
  });
  await expect(
    createClipTextMeasurer(
      () => '/ffmpeg',
      () => '/font',
    )('Text', false, 30),
  ).rejects.toThrow('文字幅');
  await expect(access(file)).rejects.toThrow();
});
