/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import {
  computeA4PageCount,
  computeScrollOffsets,
  withExportLayoutOverrides,
} from './fullContentCapture';

const ensureRaf = () => {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      return setTimeout(() => callback(Date.now()), 0) as unknown as number;
    };
  }
};

describe('computeScrollOffsets', () => {
  it('returns a single offset for non-scrollable content', () => {
    expect(computeScrollOffsets(600, 800)).toEqual([0]);
  });

  it('includes the final offset for tail content', () => {
    expect(computeScrollOffsets(2500, 1000)).toEqual([0, 1000, 1500]);
  });
});

describe('computeA4PageCount', () => {
  it('calculates page count from scaled height', () => {
    // scaledHeight = 5000 * (1000 / 1000) = 5000 -> ceil(5000/1400)=4
    expect(computeA4PageCount(1000, 5000, 1000, 1400)).toBe(4);
  });

  it('returns 0 for invalid dimensions', () => {
    expect(computeA4PageCount(0, 100, 100, 100)).toBe(0);
  });
});

describe('withExportLayoutOverrides', () => {
  it('applies and restores temporary styles', async () => {
    ensureRaf();

    const container = document.createElement('div');
    const sticky = document.createElement('div');
    const tableContainer = document.createElement('div');

    sticky.style.position = 'sticky';
    sticky.style.top = '0px';

    tableContainer.className = 'MuiTableContainer-root';
    tableContainer.style.maxHeight = '70vh';
    tableContainer.style.overflow = 'auto';

    container.appendChild(sticky);
    container.appendChild(tableContainer);
    document.body.appendChild(container);

    const stickyBefore = sticky.style.cssText;
    const tableBefore = tableContainer.style.cssText;

    await withExportLayoutOverrides(container, async () => {
      expect(sticky.style.position).toBe('static');
      expect(tableContainer.style.overflow).toBe('visible');
      expect(tableContainer.style.maxHeight).toBe('none');
      return Promise.resolve();
    });

    expect(sticky.style.cssText).toBe(stickyBefore);
    expect(tableContainer.style.cssText).toBe(tableBefore);

    container.remove();
  });
});
