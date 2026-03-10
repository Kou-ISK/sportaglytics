import React from 'react';
import type { CodeWindowButton, CodeWindowLayout } from '../../../../types/Settings';
import { getButtonCenter, getButtonEdge } from './utils';

type LinkType = 'exclusive' | 'lead' | 'deactivate';

interface RenderCanvasLinksParams {
  layout: CodeWindowLayout;
  showLinks: boolean;
  selectedLinkId: string | null;
  selectedPrimaryId: string | null;
  onSelectLink: (linkId: string) => void;
}

const getLinkColor = (type: string, isSelected: boolean) => {
  if (isSelected) return '#1976d2';
  switch (type) {
    case 'exclusive':
      return '#d32f2f';
    case 'deactivate':
      return '#f57c00';
    case 'activate':
      return '#388e3c';
    case 'sequence':
      return '#1976d2';
    default:
      return '#888';
  }
};

const getMarkerEnd = (type: string, isSelected: boolean) => {
  if (type === 'exclusive') return undefined;
  if (isSelected) return 'url(#arrowhead-selected)';
  switch (type) {
    case 'deactivate':
      return 'url(#arrowhead-deactivate)';
    case 'activate':
      return 'url(#arrowhead-activate)';
    case 'sequence':
      return 'url(#arrowhead-sequence)';
    default:
      return undefined;
  }
};

export const renderCanvasLinks = ({
  layout,
  showLinks,
  selectedLinkId,
  selectedPrimaryId,
  onSelectLink,
}: RenderCanvasLinksParams): React.ReactNode => {
  if (!showLinks || !layout.buttonLinks) return null;

  return layout.buttonLinks.map((link) => {
    const fromButton = layout.buttons.find((b) => b.id === link.fromButtonId);
    const toButton = layout.buttons.find((b) => b.id === link.toButtonId);
    if (!fromButton || !toButton) return null;

    const fromCenter = getButtonCenter(fromButton);
    const toCenter = getButtonCenter(toButton);
    const from = getButtonEdge(fromButton, toCenter, 2);
    const to = getButtonEdge(toButton, fromCenter, 2);

    const isLinkSelected = selectedLinkId === link.id;
    const isRelatedToSelectedButton =
      selectedPrimaryId === fromButton.id || selectedPrimaryId === toButton.id;
    const isHighlighted = isLinkSelected || isRelatedToSelectedButton;
    const linkColor = getLinkColor(link.type, isHighlighted);
    const markerEnd = getMarkerEnd(link.type, isHighlighted);
    const strokeDash = link.type === 'exclusive' ? 'none' : '5,5';

    return (
      <g key={link.id}>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="transparent"
          strokeWidth={12}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectLink(link.id);
          }}
        />
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={linkColor}
          strokeWidth={isHighlighted ? 3 : 2}
          strokeDasharray={strokeDash}
          markerEnd={markerEnd}
          style={{ cursor: 'pointer', pointerEvents: 'none' }}
        />
        {isLinkSelected && (
          <>
            <circle cx={from.x} cy={from.y} r={6} fill="#1976d2" />
            <circle cx={to.x} cy={to.y} r={6} fill="#1976d2" />
          </>
        )}
      </g>
    );
  });
};

interface RenderCanvasDraggingLinkParams {
  linkStartButton: CodeWindowButton | null;
  linkEndPos: { x: number; y: number } | null;
  linkType: LinkType;
}

export const renderCanvasDraggingLink = ({
  linkStartButton,
  linkEndPos,
  linkType,
}: RenderCanvasDraggingLinkParams): React.ReactNode => {
  if (!linkStartButton || !linkEndPos) return null;

  const from = getButtonCenter(linkStartButton);
  const linkColor =
    linkType === 'lead'
      ? '#388e3c'
      : linkType === 'deactivate'
        ? '#f57c00'
        : '#d32f2f';
  const strokeDash = linkType === 'exclusive' ? 'none' : '5,5';
  const markerEnd =
    linkType === 'lead'
      ? 'url(#arrowhead-dragging-lead)'
      : linkType === 'deactivate'
        ? 'url(#arrowhead-dragging-deactivate)'
        : 'url(#arrowhead-dragging-exclusive)';

  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={linkEndPos.x}
      y2={linkEndPos.y}
      stroke={linkColor}
      strokeWidth={2}
      strokeDasharray={strokeDash}
      markerEnd={markerEnd}
      pointerEvents="none"
    />
  );
};
