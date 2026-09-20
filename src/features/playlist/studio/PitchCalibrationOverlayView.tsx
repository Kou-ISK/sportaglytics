import type { ReactElement, PointerEvent } from 'react';
import { useTheme } from '@mui/material';
import type { PitchCalibrationControls } from './usePitchCalibration';
import type { StudioContentRect } from './useStudioGesture';
import {
  calibrationRegion,
  pitchToImage,
} from '../../../shared/tactics/pitchProjection';
export const PitchCalibrationOverlayView = ({
  pitch,
  width,
  height,
  contentRect,
}: {
  pitch: PitchCalibrationControls;
  width: number;
  height: number;
  contentRect: StudioContentRect;
}): ReactElement | null => {
  const theme = useTheme();
  if (!pitch.editing && !pitch.calibrated) return null;
  const region = calibrationRegion(pitch.draft);
  const grid = [0.25, 0.5, 0.75]
    .flatMap((fraction) => [
      [
        { x: region.x + region.width * fraction, y: region.y },
        { x: region.x + region.width * fraction, y: region.y + region.length },
      ],
      [
        { x: region.x, y: region.y + region.length * fraction },
        { x: region.x + region.width, y: region.y + region.length * fraction },
      ],
    ])
    .map((line) => line.map((point) => pitchToImage(pitch.draft, point)));
  const move = (event: PointerEvent<SVGCircleElement>, index: number): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (
      !rect?.width ||
      !rect.height ||
      !contentRect.width ||
      !contentRect.height
    )
      return;
    pitch.onCornerChange(
      index,
      (((event.clientX - rect.left) * width) / rect.width -
        contentRect.offsetX) /
        contentRect.width,
      (((event.clientY - rect.top) * height) / rect.height -
        contentRect.offsetY) /
        contentRect.height,
    );
  };
  const points = pitch.draft.corners.map((point) => ({
    x: point.x * contentRect.width + contentRect.offsetX,
    y: point.y * contentRect.height + contentRect.offsetY,
  }));
  return (
    <svg
      aria-label="平面較正の4点"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <polygon
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill={theme.custom.tokens.interactive.selected}
        stroke={theme.palette.primary.main}
        strokeWidth={2}
      />
      {grid.map(([a, b], i) =>
        a && b ? (
          <line
            key={i}
            x1={a.x * contentRect.width + contentRect.offsetX}
            y1={a.y * contentRect.height + contentRect.offsetY}
            x2={b.x * contentRect.width + contentRect.offsetX}
            y2={b.y * contentRect.height + contentRect.offsetY}
            stroke={theme.palette.primary.main}
            strokeWidth={1}
            opacity={0.6}
            strokeDasharray="5 4"
          />
        ) : null,
      )}
      {points.map((point, index) => (
        <g key={index}>
          <circle
            aria-label={`較正点${index + 1}`}
            role={pitch.editing ? 'slider' : undefined}
            tabIndex={pitch.editing ? 0 : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pitch.draft.corners[index].x * 100)}
            aria-valuetext={`横${Math.round(pitch.draft.corners[index].x * 100)}%、縦${Math.round(pitch.draft.corners[index].y * 100)}%`}
            cx={point.x}
            cy={point.y}
            r={12}
            fill={theme.palette.background.paper}
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            style={{
              pointerEvents: pitch.editing ? 'auto' : 'none',
              touchAction: 'none',
              cursor: 'move',
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              event.stopPropagation();
            }}
            onPointerMove={(event) => move(event, index)}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 0.01 : 0.001;
              const point = pitch.draft.corners[index];
              if (event.key.startsWith('Arrow')) {
                event.preventDefault();
                event.stopPropagation();
                pitch.onCornerChange(
                  index,
                  point.x +
                    (event.key === 'ArrowRight'
                      ? delta
                      : event.key === 'ArrowLeft'
                        ? -delta
                        : 0),
                  point.y +
                    (event.key === 'ArrowDown'
                      ? delta
                      : event.key === 'ArrowUp'
                        ? -delta
                        : 0),
                );
              }
            }}
          />
          <text
            x={point.x}
            y={point.y + 4}
            textAnchor="middle"
            fill={theme.palette.text.primary}
            fontSize={12}
            style={{ pointerEvents: 'none' }}
          >
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
};
