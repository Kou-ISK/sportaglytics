import { useCallback, useRef, useState } from 'react';

export type LabelSelectionsMap = Record<string, Record<string, string>>;

export const useLabelSelections = (initialState: LabelSelectionsMap = {}) => {
  const [labelSelections, setLabelSelections] =
    useState<LabelSelectionsMap>(initialState);
  const labelSelectionsRef = useRef<LabelSelectionsMap>(initialState);

  const updateLabelSelections = useCallback(
    (
      updater:
        | LabelSelectionsMap
        | ((prev: LabelSelectionsMap) => LabelSelectionsMap),
    ) => {
      const next =
        typeof updater === 'function'
          ? updater(labelSelectionsRef.current)
          : updater;
      labelSelectionsRef.current = next;
      setLabelSelections(next);
    },
    [],
  );

  return {
    labelSelections,
    labelSelectionsRef,
    updateLabelSelections,
  };
};
