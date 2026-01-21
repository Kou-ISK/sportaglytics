import type { DrawingObject } from '../../../types/Playlist';

export const generateAnnotationId = (): string =>
  Math.random().toString(36).substring(2, 11);

export const drawArrowHead = (
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  headLength: number = 15,
) => {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
};

export const renderObject = (
  ctx: CanvasRenderingContext2D,
  obj: DrawingObject,
) => {
  ctx.strokeStyle = obj.color;
  ctx.fillStyle = obj.color;
  ctx.lineWidth = obj.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (obj.type) {
    case 'pen':
      if (obj.path && obj.path.length > 1) {
        ctx.beginPath();
        ctx.moveTo(obj.path[0].x, obj.path[0].y);
        for (let i = 1; i < obj.path.length; i++) {
          ctx.lineTo(obj.path[i].x, obj.path[i].y);
        }
        ctx.stroke();
      }
      break;

    case 'line':
      if (obj.endX !== undefined && obj.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(obj.startX, obj.startY);
        ctx.lineTo(obj.endX, obj.endY);
        ctx.stroke();
      }
      break;

    case 'arrow':
      if (obj.endX !== undefined && obj.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(obj.startX, obj.startY);
        ctx.lineTo(obj.endX, obj.endY);
        ctx.stroke();
        drawArrowHead(ctx, obj.startX, obj.startY, obj.endX, obj.endY);
      }
      break;

    case 'rectangle':
      if (obj.endX !== undefined && obj.endY !== undefined) {
        const width = obj.endX - obj.startX;
        const height = obj.endY - obj.startY;
        if (obj.fill) {
          ctx.globalAlpha = 0.3;
          ctx.fillRect(obj.startX, obj.startY, width, height);
          ctx.globalAlpha = 1;
        }
        ctx.strokeRect(obj.startX, obj.startY, width, height);
      }
      break;

    case 'circle':
      if (obj.endX !== undefined && obj.endY !== undefined) {
        const radiusX = Math.abs(obj.endX - obj.startX) / 2;
        const radiusY = Math.abs(obj.endY - obj.startY) / 2;
        const centerX = (obj.startX + obj.endX) / 2;
        const centerY = (obj.startY + obj.endY) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        if (obj.fill) {
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.stroke();
      }
      break;

    case 'text':
      if (obj.text) {
        ctx.font = `${obj.fontSize || 24}px sans-serif`;
        ctx.fillText(obj.text, obj.startX, obj.startY);
      }
      break;
  }
};

export const scaleObjectForDisplay = (
  obj: DrawingObject,
  target: { width: number; height: number; offsetX: number; offsetY: number },
) => {
  const scaleX = target.width / (obj.baseWidth ?? target.width);
  const scaleY = target.height / (obj.baseHeight ?? target.height);
  const transformPoint = (p: { x: number; y: number }) => ({
    x: p.x * scaleX + target.offsetX,
    y: p.y * scaleY + target.offsetY,
  });
  switch (obj.type) {
    case 'pen':
      return {
        ...obj,
        path: obj.path?.map(transformPoint),
      };
    case 'line':
    case 'arrow':
    case 'rectangle':
    case 'circle':
      return {
        ...obj,
        startX: obj.startX * scaleX + target.offsetX,
        startY: obj.startY * scaleY + target.offsetY,
        endX:
          obj.endX !== undefined
            ? obj.endX * scaleX + target.offsetX
            : obj.endX,
        endY:
          obj.endY !== undefined
            ? obj.endY * scaleY + target.offsetY
            : obj.endY,
        strokeWidth: obj.strokeWidth * ((scaleX + scaleY) / 2),
      };
    case 'text':
      return {
        ...obj,
        startX: obj.startX * scaleX + target.offsetX,
        startY: obj.startY * scaleY + target.offsetY,
        fontSize: obj.fontSize ? obj.fontSize * ((scaleX + scaleY) / 2) : 24,
      };
  }
};

export const getObjectBounds = (obj: DrawingObject) => {
  switch (obj.type) {
    case 'pen': {
      if (!obj.path || obj.path.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      }
      const xs = obj.path.map((p) => p.x);
      const ys = obj.path.map((p) => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
    case 'line':
    case 'arrow':
    case 'rectangle':
    case 'circle': {
      const minX = Math.min(obj.startX, obj.endX ?? obj.startX);
      const minY = Math.min(obj.startY, obj.endY ?? obj.startY);
      const maxX = Math.max(obj.startX, obj.endX ?? obj.startX);
      const maxY = Math.max(obj.startY, obj.endY ?? obj.startY);
      return { minX, minY, maxX, maxY };
    }
    case 'text':
      return {
        minX: obj.startX,
        minY: obj.startY - (obj.fontSize || 24),
        maxX: obj.startX + (obj.text?.length || 1) * ((obj.fontSize || 24) / 2),
        maxY: obj.startY,
      };
  }
};

export const pointInBounds = (
  x: number,
  y: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  tolerance = 0,
) =>
  x >= bounds.minX - tolerance &&
  x <= bounds.maxX + tolerance &&
  y >= bounds.minY - tolerance &&
  y <= bounds.maxY + tolerance;

export const findObjectAtPoint = (
  objects: DrawingObject[],
  x: number,
  y: number,
  tolerance: number,
) => {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const obj = objects[i];
    const bounds = getObjectBounds(obj);
    if (pointInBounds(x, y, bounds, tolerance)) return obj;
  }
  return null;
};

export const shiftObject = (
  obj: DrawingObject,
  dx: number,
  dy: number,
): DrawingObject => {
  switch (obj.type) {
    case 'pen':
      return {
        ...obj,
        path: obj.path?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      };
    case 'text':
      return {
        ...obj,
        startX: obj.startX + dx,
        startY: obj.startY + dy,
      };
    default:
      return {
        ...obj,
        startX: obj.startX + dx,
        startY: obj.startY + dy,
        endX: obj.endX !== undefined ? obj.endX + dx : obj.endX,
        endY: obj.endY !== undefined ? obj.endY + dy : obj.endY,
      };
  }
};
