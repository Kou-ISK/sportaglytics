// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useRecentPackageRegistration } from './useRecentPackageRegistration';
import { readPackageTeamNames } from '../gateway/packageGateway';

vi.mock('../gateway/packageGateway', () => ({
  readPackageTeamNames: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it.each([
  '/matches/日本語 🏉/Synthetic-review.stpkg',
  'C:\\matches\\日本語 🏉\\Synthetic-review.stpkg',
])(
  'registers the package name and preserves its reopen path: %s',
  async (path) => {
    vi.mocked(readPackageTeamNames).mockResolvedValue({
      team1Name: 'Red',
      team2Name: 'Blue',
    });
    const addRecentPackage = vi.fn();
    const { result } = renderHook(() =>
      useRecentPackageRegistration({ addRecentPackage }),
    );
    await act(() =>
      result.current({
        packagePath: path,
        metaDataConfigFilePath: `${path}/.metadata/config.json`,
        timelinePath: `${path}/timeline.json`,
        videoList: ['synthetic.mp4'],
        syncData: undefined,
      }),
    );
    expect(addRecentPackage).toHaveBeenCalledWith({
      path,
      name: 'Synthetic-review.stpkg',
      team1Name: 'Red',
      team2Name: 'Blue',
      videoCount: 1,
    });
  },
);
