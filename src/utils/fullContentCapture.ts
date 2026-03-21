/**
 * @deprecated PDFエクスポートでは非使用（データ駆動PDFへ移行済み）。
 * PNGスナップショット用途の後方互換として残置。
 */
interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FullCaptureSlice {
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
  dataUrl: string;
}

type CaptureRegionFn = (rect: CaptureRect) => Promise<string | null>;

type HorizontalCaptureMode = 'off' | 'auto' | 'force';

interface CaptureScrollableContentOptions {
  horizontal?: HorizontalCaptureMode;
}

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const toDataUrl = (base64: string) =>
  base64.startsWith('data:image/') ? base64 : `data:image/png;base64,${base64}`;

export const computeScrollOffsets = (
  scrollHeight: number,
  viewportHeight: number,
): number[] => {
  const total = Math.max(0, Math.floor(scrollHeight));
  const viewport = Math.max(1, Math.floor(viewportHeight));
  const maxOffset = Math.max(0, total - viewport);

  if (maxOffset === 0) {
    return [0];
  }

  const offsets: number[] = [];
  for (let offset = 0; offset < maxOffset; offset += viewport) {
    offsets.push(offset);
  }

  const last = offsets[offsets.length - 1];
  if (last !== maxOffset) {
    offsets.push(maxOffset);
  }

  return offsets;
};

export const computeHorizontalScrollOffsets = (
  scrollWidth: number,
  viewportWidth: number,
  mode: HorizontalCaptureMode = 'force',
): number[] => {
  if (mode === 'off') {
    return [0];
  }

  if (mode === 'auto' && scrollWidth <= viewportWidth + 1) {
    return [0];
  }

  return computeScrollOffsets(scrollWidth, viewportWidth);
};

export const computeA4PageCount = (
  imageWidthPx: number,
  imageHeightPx: number,
  pageWidthPx: number,
  pageHeightPx: number,
): number => {
  if (
    imageWidthPx <= 0 ||
    imageHeightPx <= 0 ||
    pageWidthPx <= 0 ||
    pageHeightPx <= 0
  ) {
    return 0;
  }
  const scaledHeight = (imageHeightPx * pageWidthPx) / imageWidthPx;
  return Math.max(1, Math.ceil(scaledHeight / pageHeightPx));
};

export const withExportLayoutOverrides = async <T>(
  container: HTMLElement,
  fn: () => Promise<T>,
): Promise<T> => {
  const previousStyleMap = new Map<HTMLElement, string>();
  const register = (element: HTMLElement) => {
    if (!previousStyleMap.has(element)) {
      previousStyleMap.set(element, element.style.cssText);
    }
  };

  const nodes = [
    container,
    ...Array.from(container.querySelectorAll<HTMLElement>('*')),
  ];

  for (const element of nodes) {
    const computed = window.getComputedStyle(element);

    if (computed.position === 'sticky') {
      register(element);
      element.style.position = 'static';
      element.style.top = 'auto';
      element.style.left = 'auto';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.zIndex = 'auto';
    }

    const isTableContainer = element.classList.contains(
      'MuiTableContainer-root',
    );
    const isNestedScrollable =
      element !== container &&
      element.scrollHeight > element.clientHeight + 1 &&
      (computed.overflowY === 'auto' || computed.overflowY === 'scroll');

    if (isTableContainer || isNestedScrollable) {
      register(element);
      element.style.maxHeight = 'none';
      element.style.height = 'auto';
      element.style.overflow = 'visible';
      element.style.overflowY = 'visible';
      element.style.overflowX = 'visible';
      if (isTableContainer) {
        element.style.width = 'max-content';
        element.style.minWidth = '100%';
      }
    }
  }

  try {
    await waitForPaint();
    return await fn();
  } finally {
    for (const [element, cssText] of Array.from(
      previousStyleMap.entries(),
    ).reverse()) {
      element.style.cssText = cssText;
    }
    await waitForPaint();
  }
};

export const captureScrollableContent = async (
  container: HTMLElement,
  captureRegionFn: CaptureRegionFn,
  options: CaptureScrollableContentOptions = {},
): Promise<FullCaptureSlice[]> => {
  const { horizontal = 'force' } = options;
  const rect = container.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));

  if (width <= 0 || height <= 0) {
    return [];
  }

  const originalScrollTop = container.scrollTop;
  const originalScrollLeft = container.scrollLeft;
  const verticalOffsets = computeScrollOffsets(
    container.scrollHeight,
    container.clientHeight,
  );
  const horizontalOffsets = computeHorizontalScrollOffsets(
    container.scrollWidth,
    container.clientWidth,
    horizontal,
  );
  const slices: FullCaptureSlice[] = [];

  try {
    for (const offsetTop of verticalOffsets) {
      container.scrollTop = offsetTop;
      for (const offsetLeft of horizontalOffsets) {
        container.scrollLeft = offsetLeft;
        await waitForPaint();

        const captured = await captureRegionFn({
          x: Math.floor(rect.left),
          y: Math.floor(rect.top),
          width,
          height,
        });
        if (!captured) {
          throw new Error(
            `Failed to capture region at offset (${offsetLeft}, ${offsetTop})`,
          );
        }
        slices.push({
          offsetLeft,
          offsetTop,
          width,
          height,
          dataUrl: toDataUrl(captured),
        });
      }
    }
  } finally {
    container.scrollLeft = originalScrollLeft;
    container.scrollTop = originalScrollTop;
    await waitForPaint();
  }

  return slices;
};

export const stitchCapturedSlicesIntoParts = async (
  slices: FullCaptureSlice[],
  maxCanvasHeight = 15000,
): Promise<string[]> => {
  if (slices.length === 0) return [];

  const loaded = await Promise.all(
    slices.map(async (slice) => ({
      ...slice,
      image: await loadImage(slice.dataUrl),
    })),
  );

  const width = Math.max(
    1,
    ...loaded.map((slice) =>
      Math.max(
        slice.offsetLeft + slice.width,
        slice.offsetLeft + slice.image.width,
      ),
    ),
  );
  const totalHeight = loaded.reduce(
    (max, slice) => Math.max(max, slice.offsetTop + slice.image.height),
    0,
  );

  if (totalHeight <= 0) return [];

  const partHeight = Math.max(1, Math.floor(maxCanvasHeight));
  const parts: string[] = [];

  for (let startY = 0; startY < totalHeight; startY += partHeight) {
    const currentHeight = Math.min(partHeight, totalHeight - startY);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.max(1, currentHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const slice of loaded) {
      const drawY = slice.offsetTop - startY;
      if (drawY <= -slice.image.height || drawY >= currentHeight) continue;
      ctx.drawImage(slice.image, slice.offsetLeft, drawY);
    }

    parts.push(canvas.toDataURL('image/png'));
  }

  return parts;
};
