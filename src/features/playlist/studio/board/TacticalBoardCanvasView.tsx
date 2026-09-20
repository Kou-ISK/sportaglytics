import { useId } from 'react';
import type { ReactElement, RefObject, PointerEvent } from 'react';
import { useTheme } from '@mui/material';
import type { TacticalBoardEditor } from './useTacticalBoardEditor';
import type { TacticalPoint } from '../../../../types/playlist/tacticalBoard';
import { PitchMarkingsView } from './PitchMarkingsView';

export const TacticalBoardCanvasView = ({
  editor,
  svgRef,
}: {
  editor: TacticalBoardEditor;
  svgRef?: RefObject<SVGSVGElement | null>;
}): ReactElement => {
  const theme = useTheme();
  const arrowId = useId().replace(/:/g, '');
  const { board } = editor;
  const colors = {
    team1: theme.palette.team1.main,
    team2: theme.palette.team2.main,
    neutral: theme.palette.background.paper,
    ball: theme.custom.tokens.data.pitchLine,
  };
  const point = (event: PointerEvent<SVGElement>): TacticalPoint => {
    const svg =
      event.currentTarget instanceof SVGSVGElement
        ? event.currentTarget
        : event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  return (
    <svg
      ref={svgRef}
      aria-label="戦術盤のピッチ"
      role="group"
      tabIndex={0}
      viewBox={`-5 -5 ${board.widthMeters + 10} ${board.lengthMeters + 10}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 280,
        maxHeight: '62vh',
        touchAction: 'none',
        fontFamily: theme.typography.fontFamily,
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const p = point(event);
        if (
          p.x >= 0 &&
          p.y >= 0 &&
          p.x <= board.widthMeters &&
          p.y <= board.lengthMeters
        )
          editor.onPlace(p);
      }}
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10Z" fill={theme.custom.tokens.data.pitchLine} />
        </marker>
      </defs>
      <PitchMarkingsView
        width={board.widthMeters}
        length={board.lengthMeters}
      />
      {board.arrows.map((arrow, index) => (
        <g
          key={arrow.id}
          role="button"
          tabIndex={0}
          aria-label={`戦術矢印${index + 1}`}
          aria-pressed={editor.selectedId === arrow.id}
          onPointerDown={(e) => {
            e.stopPropagation();
            editor.onSelect(arrow.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              editor.onSelect(arrow.id);
            }
          }}
        >
          <path
            d={`M${arrow.from.x} ${arrow.from.y}L${arrow.to.x} ${arrow.to.y}`}
            fill="none"
            stroke={theme.custom.tokens.data.pitchLine}
            strokeWidth={4}
            opacity={0.001}
          />
          <path
            d={`M${arrow.from.x} ${arrow.from.y}L${arrow.to.x} ${arrow.to.y}`}
            fill="none"
            stroke={
              editor.selectedId === arrow.id
                ? theme.palette.primary.main
                : theme.custom.tokens.data.pitchLine
            }
            strokeWidth={0.8}
            markerEnd={`url(#${arrowId})`}
          />
        </g>
      ))}
      {board.markers.map((marker) => (
        <g
          key={marker.id}
          role="button"
          tabIndex={0}
          aria-label={`${marker.kind === 'ball' ? 'ボール' : marker.kind === 'team1' ? 'チームA' : marker.kind === 'team2' ? 'チームB' : '未分類'} ${marker.label}`}
          aria-pressed={editor.selectedId === marker.id}
          transform={`translate(${marker.x} ${marker.y})`}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.currentTarget.focus();
            if (editor.tool === 'arrow') {
              editor.onPlace(marker);
              return;
            }
            editor.onSelect(marker.id);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              editor.onMove(marker.id, point(e), false);
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              editor.onMove(marker.id, point(e), true);
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
          onPointerCancel={editor.onCancelMove}
          onLostPointerCapture={editor.onCancelMove}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (editor.tool === 'arrow') editor.onPlace(marker);
              else editor.onSelect(marker.id);
            }
            if (
              ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              const step = e.shiftKey ? 1 : 0.25;
              editor.onMove(
                marker.id,
                {
                  x:
                    marker.x +
                    (e.key === 'ArrowLeft'
                      ? -step
                      : e.key === 'ArrowRight'
                        ? step
                        : 0),
                  y:
                    marker.y +
                    (e.key === 'ArrowUp'
                      ? -step
                      : e.key === 'ArrowDown'
                        ? step
                        : 0),
                },
                true,
              );
            }
          }}
        >
          <circle
            r={marker.kind === 'ball' ? 1.5 : 2.4}
            fill={colors[marker.kind]}
            stroke={
              editor.selectedId === marker.id
                ? theme.palette.primary.main
                : theme.custom.tokens.data.pitchLine
            }
            strokeWidth={editor.selectedId === marker.id ? 0.9 : 0.4}
          />
          <text
            textAnchor="middle"
            y={0.85}
            fontSize={marker.label.length > 3 ? 1.2 : 2.3}
            fontWeight={700}
            fill={
              marker.kind === 'ball'
                ? theme.custom.tokens.media.surface
                : marker.kind === 'neutral'
                  ? theme.palette.text.primary
                  : theme.palette.team1.contrastText
            }
            pointerEvents="none"
          >
            {marker.label}
          </text>
        </g>
      ))}
      {editor.arrowStart && (
        <circle
          cx={editor.arrowStart.x}
          cy={editor.arrowStart.y}
          r={1}
          fill={theme.palette.primary.main}
        />
      )}
    </svg>
  );
};
