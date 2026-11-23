import type { PlaylistSlide } from '../../../types/playlist/core';
import { isPlaylistSlide, isSlidePng, SLIDE_HEIGHT, SLIDE_WIDTH } from '../../../shared/playlist/playlistSlide';

const canvasFor = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const importSlideImage = async (file: File): Promise<string> => {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('8 MB 以下の PNG または JPEG を選んでください。');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 960 / bitmap.width, 640 / bitmap.height);
    const canvas = canvasFor(Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('画像を読み込めません。');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    if (!isSlidePng(png)) throw new Error('画像が大きすぎます。');
    return png;
  } finally {
    bitmap.close();
  }
};

const drawText = (ctx: CanvasRenderingContext2D, text: string, top: number,
  width: number, height: number, font: number, bold = false): void => {
  if (!text) return;
  for (let size = font; size >= 12; size -= 2) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px sans-serif';
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
      lines.push(line);
    }
    const spacing = Math.ceil(size * 1.35);
    if (lines.length * spacing > height) continue;
    lines.forEach((line, index) => ctx.fillText(line, 48, top + index * spacing));
    return;
  }
  throw new Error('改行を減らして本文またはタイトルを短くしてください。');
};

/** The same 16:9 artwork is used for the meeting display and MP4. */
export const renderSlideFrame = async (slide: PlaylistSlide): Promise<string> => {
  if (!isPlaylistSlide(slide)) throw new Error('スライドを読み込めません。');
  const canvas = canvasFor(SLIDE_WIDTH, SLIDE_HEIGHT);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('スライドを描画できません。');
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  drawText(ctx, slide.title, 48, 1184, 150, 56, true);
  drawText(ctx, slide.body, 216, slide.image ? 560 : 1184, 448, 38);
  if (slide.image) {
    const image = new Image();
    image.src = slide.image;
    await image.decode();
    const scale = Math.min(560 / image.width, 448 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, 672 + (560 - width) / 2, 216 + (448 - height) / 2, width, height);
  }
  const frame = canvas.toDataURL('image/png');
  if (!isSlidePng(frame, true)) throw new Error('スライド画像を保存できません。');
  return frame;
};
