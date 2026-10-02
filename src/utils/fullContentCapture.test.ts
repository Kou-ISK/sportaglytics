/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import {
  computeA4PageCount,
  computeHorizontalScrollOffsets,
  computeScrollOffsets,
  withExportLayoutOverrides,
  captureScrollableContent,
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

describe('computeHorizontalScrollOffsets', () => {
  it('returns only zero when horizontal mode is off', () => {
    expect(computeHorizontalScrollOffsets(3000, 1000, 'off')).toEqual([0]);
  });

  it('returns only zero in auto mode when width fits viewport', () => {
    expect(computeHorizontalScrollOffsets(1000, 1000, 'auto')).toEqual([0]);
  });

  it('returns multiple offsets in auto mode when overflow exists', () => {
    expect(computeHorizontalScrollOffsets(2600, 1000, 'auto')).toEqual([
      0, 1000, 1600,
    ]);
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

  it('restores nested scroll and styles after a failed capture', async () => {
    ensureRaf();
    const container = document.createElement('div');
    const table = document.createElement('div');
    table.className = 'MuiTableContainer-root';
    table.style.cssText = 'height: 40px; overflow: auto';
    table.scrollTop = 30;
    table.scrollLeft = 12;
    container.append(table);
    const original = table.style.cssText;
    await expect(
      withExportLayoutOverrides(container, async () => {
        table.scrollTop = 0;
        table.scrollLeft = 0;
        throw new Error('native capture failed');
      }),
    ).rejects.toThrow('native capture failed');
    expect(table.style.cssText).toBe(original);
    expect([table.scrollLeft, table.scrollTop]).toEqual([12, 30]);
  });

  it('unclips wide table ancestors and restores the original root scroll', async () => {
    ensureRaf();
    const container = document.createElement('div');
    container.style.cssText = 'height: 40px; overflow: auto';
    container.scrollTop = 70;
    container.scrollLeft = 30;
    const surface = document.createElement('div');
    const section = document.createElement('div');
    const table = document.createElement('div');
    table.className = 'MuiTableContainer-root';
    for (const element of [surface, section, table]) {
      element.style.cssText = 'overflow: hidden; max-width: 100%';
    }
    container.append(surface);
    surface.append(section);
    section.append(table);
    const originals = [container, surface, section, table].map(
      (element) => element.style.cssText,
    );
    await withExportLayoutOverrides(container, async () => {
      expect(container.style.overflow).toBe('auto');
      for (const element of [surface, section, table]) {
        expect(element.style.overflowX).toBe('visible');
        expect(element.style.maxWidth).toBe('none');
      }
      expect(table.style.width).toBe('max-content');
      container.scrollTop = 0;
      container.scrollLeft = 0;
    });
    expect(
      [container, surface, section, table].map(
        (element) => element.style.cssText,
      ),
    ).toEqual(originals);
    expect([container.scrollLeft, container.scrollTop]).toEqual([30, 70]);
  });
});

describe('captureScrollableContent', () => {
  const makeViewport = (): HTMLDivElement => {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => new DOMRect(0, 0, 4, 3);
    Object.defineProperties(element, {
      scrollHeight: { value: 8 },
      clientHeight: { value: 3 },
      scrollWidth: { value: 7 },
      clientWidth: { value: 4 },
    });
    element.scrollTop = 2;
    element.scrollLeft = 1;
    return element;
  };

  it('captures the final overlapping viewport and restores the original scroll', async () => {
    ensureRaf();
    const element = makeViewport();
    const capture = vi.fn(async () => 'synthetic');
    const slices = await captureScrollableContent(element, capture);
    expect(
      slices.map(({ offsetLeft, offsetTop }) => [offsetLeft, offsetTop]),
    ).toEqual([
      [0, 0],
      [3, 0],
      [0, 3],
      [3, 3],
      [0, 5],
      [3, 5],
    ]);
    expect([element.scrollLeft, element.scrollTop]).toEqual([1, 2]);
  });

  it('restores scroll after a native capture failure', async () => {
    ensureRaf();
    const element = makeViewport();
    await expect(
      captureScrollableContent(element, async () => {
        throw new Error('capture failed');
      }),
    ).rejects.toThrow('capture failed');
    expect([element.scrollLeft, element.scrollTop]).toEqual([1, 2]);
  });

  it('rejects an off-screen target before using a clipped image as the pixel scale', async () => {
    const element = makeViewport();
    element.getBoundingClientRect = () =>
      new DOMRect(0, 0, 4, window.innerHeight + 10);
    const capture = vi.fn(async () => 'synthetic');
    await expect(captureScrollableContent(element, capture)).rejects.toThrow(
      'outside the window',
    );
    expect(capture).not.toHaveBeenCalled();
  });
});
