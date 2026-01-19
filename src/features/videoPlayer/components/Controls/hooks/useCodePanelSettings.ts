import { useEffect, useState } from 'react';
import type { ActionLink } from '../effectiveLinks';
import type { AppSettings } from '../../../../types/Settings';

type CodingPanelSettings = AppSettings['codingPanel'];

export const useCodePanelSettings = (codingPanel?: CodingPanelSettings) => {
  const [activeMode, setActiveMode] = useState<'code' | 'label'>(
    codingPanel?.defaultMode ?? 'code',
  );
  const [actionLinks, setActionLinks] = useState<ActionLink[]>(
    codingPanel?.actionLinks?.map((link) => ({
      from: link.from || link.to || '',
      to: link.to || '',
      type: link.type || 'exclusive',
    })) ?? [],
  );

  useEffect(() => {
    if (codingPanel?.actionLinks) {
      setActionLinks(
        codingPanel.actionLinks.map((link) => ({
          from: link.from || link.to || '',
          to: link.to || '',
          type: link.type || 'exclusive',
        })),
      );
    }
    if (codingPanel?.defaultMode) {
      setActiveMode(codingPanel.defaultMode as 'code' | 'label');
    }
  }, [codingPanel]);

  return {
    activeMode,
    setActiveMode,
    actionLinks,
  };
};
