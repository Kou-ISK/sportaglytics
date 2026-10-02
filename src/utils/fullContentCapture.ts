/**
 * スクロール領域を分割キャプチャして、PNG エクスポート用の
 * 連結可能なスナップショット群へ変換する utility。
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
  const previousScrollMap = new Map<
    HTMLElement,
    { top: number; left: number }
  >();
  const register = (element: HTMLElement) => {
    if (!previousStyleMap.has(element)) {
      previousStyleMap.set(element, element.style.cssText);
      previousScrollMap.set(element, {
        top: element.scrollTop,
        left: element.scrollLeft,
      });
    }
  };
  // Layout expansion can also move the root via scroll anchoring or clamping.
  register(container);

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

    if (element !== container && (isTableContainer || isNestedScrollable)) {
      register(element);
      element.style.maxHeight = 'none';
      element.style.height = 'auto';
      element.style.overflow = 'visible';
      element.style.overflowY = 'visible';
      element.style.overflowX = 'visible';
      if (isTableContainer) {
        element.style.width = 'max-content';
        element.style.minWidth = '100%';
        element.style.maxWidth = 'none';
        // Let wide tables contribute their full overflow to the root viewport.
        // Their work-surface ancestors normally clip content on screen.
        let parent = element.parentElement;
        while (parent && parent !== container) {
          register(parent);
          parent.style.overflow = 'visible';
          parent.style.overflowX = 'visible';
          parent.style.overflowY = 'visible';
          parent.style.maxWidth = 'none';
          parent = parent.parentElement;
        }
      }
    }
  }

  try {
    await document.fonts?.ready;
    await waitForPaint();
    return await fn();
  } finally {
    for (const [element, cssText] of Array.from(
      previousStyleMap.entries(),
    ).reverse()) {
      element.style.cssText = cssText;
    }
    for (const [element, scroll] of previousScrollMap) {
      element.scrollTop = scroll.top;
      element.scrollLeft = scroll.left;
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
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  if (width <= 0 || height <= 0) {
    return [];
  }
  if (
    rect.left < 0 ||
    rect.top < 0 ||
    rect.left + width > window.innerWidth + 1 ||
    rect.top + height > window.innerHeight + 1
  ) {
    throw new Error('Capture viewport is outside the window');
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
        const currentRect = container.getBoundingClientRect();
        if (
          Math.abs(currentRect.left - rect.left) > 1 ||
          Math.abs(currentRect.top - rect.top) > 1 ||
          Math.abs(currentRect.width - rect.width) > 1 ||
          Math.abs(currentRect.height - rect.height) > 1
        ) {
          throw new Error('Capture viewport changed during export');
        }

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
          offsetLeft: container.scrollLeft,
          offsetTop: container.scrollTop,
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

  // Scroll positions are CSS pixels; Electron PNGs may contain Retina pixels.
  // Derive the actual capture scale from the decoded image, not the display DPR.
  const scaleX = loaded[0].image.width / loaded[0].width;
  const scaleY = loaded[0].image.height / loaded[0].height;
  if (
    !Number.isFinite(scaleX) ||
    !Number.isFinite(scaleY) ||
    scaleX <= 0 ||
    scaleY <= 0
  ) {
    throw new Error('Invalid captured image dimensions');
  }
  const positioned = loaded.map((slice) => {
    if (
      Math.abs(slice.image.width - slice.width * scaleX) > 1 ||
      Math.abs(slice.image.height - slice.height * scaleY) > 1
    ) {
      throw new Error('Capture scale changed during export');
    }
    return {
      ...slice,
      pixelLeft: Math.round(slice.offsetLeft * scaleX),
      pixelTop: Math.round(slice.offsetTop * scaleY),
    };
  });

  const width = Math.max(
    1,
    ...positioned.map((slice) => slice.pixelLeft + slice.image.width),
  );
  const totalHeight = positioned.reduce(
    (max, slice) => Math.max(max, slice.pixelTop + slice.image.height),
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
    if (!ctx) throw new Error('Canvas context unavailable for PNG export');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const slice of positioned) {
      const drawY = slice.pixelTop - startY;
      if (drawY <= -slice.image.height || drawY >= currentHeight) continue;
      ctx.drawImage(slice.image, slice.pixelLeft, drawY);
    }

    parts.push(canvas.toDataURL('image/png'));
  }

  return parts;
};
