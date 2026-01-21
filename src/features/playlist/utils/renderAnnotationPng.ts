import type { AnnotationTarget, DrawingObject } from '../../../types/Playlist';

interface Size {
  width: number;
  height: number;
}

export const renderAnnotationPng = (
  objects: DrawingObject[] | undefined,
  target: AnnotationTarget,
  fallbackSize: Size,
  targetSize?: Size,
): string | null => {
  const filtered = objects?.filter((o) => (o.target || 'primary') === target) || [];
  if (filtered.length === 0) return null;
  const baseWidth =
    filtered.find((o) => o.baseWidth)?.baseWidth ||
    fallbackSize.width ||
    1920;
  const baseHeight =
    filtered.find((o) => o.baseHeight)?.baseHeight ||
    fallbackSize.height ||
    1080;
  const targetW = targetSize?.width || baseWidth;
  const targetH = targetSize?.height || baseHeight;
  const scaleX = targetW / baseWidth;
  const scaleY = targetH / baseHeight;
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const draw = (obj: DrawingObject) => {
    ctx.strokeStyle = obj.color;
    ctx.fillStyle = obj.color;
    ctx.lineWidth = obj.strokeWidth * ((scaleX + scaleY) / 2);
    switch (obj.type) {
      case 'pen':
        if (obj.path && obj.path.length > 1) {
          ctx.beginPath();
          ctx.moveTo(obj.path[0].x * scaleX, obj.path[0].y * scaleY);
          for (let i = 1; i < obj.path.length; i += 1) {
            ctx.lineTo(obj.path[i].x * scaleX, obj.path[i].y * scaleY);
          }
          ctx.stroke();
        }
        break;
      case 'line':
        if (obj.endX !== undefined && obj.endY !== undefined) {
          ctx.beginPath();
          ctx.moveTo(obj.startX * scaleX, obj.startY * scaleY);
          ctx.lineTo(obj.endX * scaleX, obj.endY * scaleY);
          ctx.stroke();
        }
        break;
      case 'arrow':
        if (obj.endX !== undefined && obj.endY !== undefined) {
          ctx.beginPath();
          ctx.moveTo(obj.startX * scaleX, obj.startY * scaleY);
          ctx.lineTo(obj.endX * scaleX, obj.endY * scaleY);
          ctx.stroke();
        }
        break;
      case 'rectangle':
        if (obj.endX !== undefined && obj.endY !== undefined) {
          ctx.strokeRect(
            obj.startX * scaleX,
            obj.startY * scaleY,
            (obj.endX - obj.startX) * scaleX,
            (obj.endY - obj.startY) * scaleY,
          );
        }
        break;
      case 'circle':
        if (obj.endX !== undefined && obj.endY !== undefined) {
          const radiusX = (Math.abs(obj.endX - obj.startX) / 2) * scaleX;
          const radiusY = (Math.abs(obj.endY - obj.startY) / 2) * scaleY;
          const centerX = ((obj.startX + obj.endX) / 2) * scaleX;
          const centerY = ((obj.startY + obj.endY) / 2) * scaleY;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case 'text':
        if (obj.text) {
          ctx.font = `${(obj.fontSize || 24) * ((scaleX + scaleY) / 2)}px sans-serif`;
          ctx.fillText(obj.text, obj.startX * scaleX, obj.startY * scaleY);
        }
        break;
      default:
        break;
    }
  };

  filtered.forEach(draw);
  return canvas.toDataURL('image/png');
};
