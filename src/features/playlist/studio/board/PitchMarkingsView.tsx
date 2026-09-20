import type { ReactElement } from 'react';
import { useTheme } from '@mui/material';

/** Rugby union playing area. In-goal areas are intentionally outside this coordinate plane. */
export const PitchMarkingsView = ({
  width,
  length,
}: {
  width: number;
  length: number;
}): ReactElement => {
  const { custom } = useTheme();
  const rugby = width >= 60 && length >= 90;
  const lines = rugby
    ? [
        5,
        22,
        length / 2 - 10,
        length / 2,
        length / 2 + 10,
        length - 22,
        length - 5,
      ]
    : [length / 2];
  return (
    <g pointerEvents="none">
      <rect
        width={width}
        height={length}
        fill={custom.tokens.data.pitchSurface}
        stroke={custom.tokens.data.pitchLine}
        strokeWidth={0.3}
      />
      <g
        fill="none"
        stroke={custom.tokens.data.pitchLine}
        strokeWidth={0.25}
        opacity={0.75}
      >
        {lines.map((y) => (
          <path
            key={y}
            d={`M0 ${y}H${width}`}
            strokeDasharray={
              rugby &&
              [5, length / 2 - 10, length / 2 + 10, length - 5].includes(y)
                ? '2 2'
                : undefined
            }
          />
        ))}
        {rugby &&
          [5, 15, width - 15, width - 5].map((x) => (
            <path key={x} d={`M${x} 0V${length}`} strokeDasharray="2 2" />
          ))}
      </g>
      {rugby &&
        [22, length / 2, length - 22].map((y) => (
          <text
            key={y}
            x={width / 2}
            y={y - 1}
            textAnchor="middle"
            fontSize={2}
            fill={custom.tokens.data.pitchLine}
            opacity={0.65}
          >
            {y === length / 2 ? 'HALF WAY' : '22'}
          </text>
        ))}
    </g>
  );
};
