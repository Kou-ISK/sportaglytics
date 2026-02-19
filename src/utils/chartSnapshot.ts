const createSvgDataUrl = (svg: SVGElement) => {
  const clone = svg.cloneNode(true) as SVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clone.getAttribute('xmlns:xlink')) {
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  clone.setAttribute('width', `${width}`);
  clone.setAttribute('height', `${height}`);

  const source = new XMLSerializer().serializeToString(clone);
  return {
    width,
    height,
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`,
  };
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
};

export const captureSvgAsPngDataUrl = async (
  container: HTMLElement,
): Promise<string | null> => {
  const svg = container.querySelector('svg');
  if (!svg) return null;

  const { width, height, dataUrl } = createSvgDataUrl(svg);
  const image = await loadImage(dataUrl);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png');
};
