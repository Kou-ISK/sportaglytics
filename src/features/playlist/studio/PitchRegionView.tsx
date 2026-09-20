import type { ReactElement } from 'react';
import { Button, Stack, TextField, Typography, useTheme } from '@mui/material';
import type { PitchCalibration } from '../../../types/playlist/core';
import { calibrationRegion } from '../../../shared/tactics/pitchProjection';
import { PitchMarkingsView } from './board/PitchMarkingsView';

export const PitchRegionView = ({
  value,
  onChange,
}: {
  value: PitchCalibration;
  onChange: (region: NonNullable<PitchCalibration['region']>) => void;
}): ReactElement => {
  const theme = useTheme();
  const region = calibrationRegion(value);
  const width = value.widthMeters > 0 ? value.widthMeters : 70;
  const length = value.lengthMeters > 0 ? value.lengthMeters : 100;
  const points = [
    [region.x, region.y],
    [region.x + region.width, region.y],
    [region.x + region.width, region.y + region.length],
    [region.x, region.y + region.length],
  ];
  return (
    <Stack spacing={1}>
      <Typography variant="caption">映像の4点が囲むピッチ上の範囲</Typography>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        {[
          ['全面', 0, length],
          ['手前ハーフ', length / 2, length / 2],
          ['奥ハーフ', 0, length / 2],
          [
            '22m〜中央',
            Math.min(22, length / 4),
            length / 2 - Math.min(22, length / 4),
          ],
        ].map(([name, y, height]) => (
          <Button
            size="small"
            key={name}
            onClick={() =>
              onChange({ x: 0, y: Number(y), width, length: Number(height) })
            }
          >
            {name}
          </Button>
        ))}
      </Stack>
      <svg
        aria-label="較正範囲の俯瞰図"
        viewBox={`-5 -5 ${width + 10} ${length + 10}`}
        style={{ width: '100%', height: 168 }}
      >
        <PitchMarkingsView width={width} length={length} />
        <rect
          {...{
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.length,
          }}
          fill={theme.custom.tokens.interactive.selected}
          stroke={theme.palette.primary.main}
          strokeWidth={1}
        />
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={3} fill={theme.palette.primary.main} />
            <text
              x={x}
              y={y + 1.2}
              fontSize={3.5}
              textAnchor="middle"
              fill={theme.palette.primary.contrastText}
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <Stack direction="row" spacing={1}>
        <TextField
          label="左から（m）"
          type="number"
          value={region.x}
          onChange={(e) => onChange({ ...region, x: Number(e.target.value) })}
        />
        <TextField
          label="奥から（m）"
          type="number"
          value={region.y}
          onChange={(e) => onChange({ ...region, y: Number(e.target.value) })}
        />
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField
          label="範囲の幅（m）"
          type="number"
          value={region.width}
          onChange={(e) =>
            onChange({ ...region, width: Number(e.target.value) })
          }
        />
        <TextField
          label="範囲の長さ（m）"
          type="number"
          value={region.length}
          onChange={(e) =>
            onChange({ ...region, length: Number(e.target.value) })
          }
        />
      </Stack>
    </Stack>
  );
};
