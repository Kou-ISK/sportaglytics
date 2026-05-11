import React from 'react';

type FreeCanvasLinkLayerProps = {
  width: number;
  height: number;
  links: React.ReactNode;
  draggingLink: React.ReactNode;
};

export const FreeCanvasLinkLayer = ({
  width,
  height,
  links,
  draggingLink,
}: FreeCanvasLinkLayerProps) => {
  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <marker
          id="arrowhead-exclusive"
          markerWidth="12"
          markerHeight="9"
          refX="10"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill="#d32f2f" />
        </marker>
        <marker
          id="arrowhead-activate"
          markerWidth="12"
          markerHeight="9"
          refX="10"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill="#388e3c" />
        </marker>
        <marker
          id="arrowhead-deactivate"
          markerWidth="12"
          markerHeight="9"
          refX="10"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill="#f57c00" />
        </marker>
        <marker
          id="arrowhead-sequence"
          markerWidth="12"
          markerHeight="9"
          refX="10"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill="#1976d2" />
        </marker>
        <marker
          id="arrowhead-selected"
          markerWidth="12"
          markerHeight="9"
          refX="10"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill="#1976d2" />
        </marker>
        <marker
          id="arrowhead-dragging-exclusive"
          markerWidth="12"
          markerHeight="9"
          refX="10"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill="#d32f2f" />
        </marker>
        <marker
          id="arrowhead-dragging-lead"
          markerWidth="12"
          markerHeight="9"
          refX="10"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill="#388e3c" />
        </marker>
        <marker
          id="arrowhead-dragging-deactivate"
          markerWidth="12"
          markerHeight="9"
          refX="10"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 0, 12 4.5, 0 9" fill="#f57c00" />
        </marker>
      </defs>
      <g style={{ pointerEvents: 'auto' }}>{links}</g>
      {draggingLink}
    </svg>
  );
};
