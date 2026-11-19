import { expect, it, vi } from 'vitest';
import { TimelineScrub } from './timelineScrub';
it('does not assign the tag clock to a request superseded before drawing its image', async () => {
  let supersede: () => void = () => {};
  const queued = new Promise<undefined>((resolve) => {
    supersede = () => resolve(undefined);
  });
  const present = vi
    .fn()
    .mockReturnValueOnce(queued)
    .mockResolvedValueOnce(8.5);
  const confirm = vi.fn(),
    finish = vi.fn();
  const scrub = new TimelineScrub('timeline', present, confirm, finish);
  scrub.request(8, false);
  scrub.request(8.51, true);
  supersede();
  await vi.waitFor(() => expect(finish).toHaveBeenCalledWith(false));
  expect(confirm.mock.calls).toEqual([[8.51]]);
  expect(present.mock.calls.map((call) => call[2])).toEqual([false, true]);
});
