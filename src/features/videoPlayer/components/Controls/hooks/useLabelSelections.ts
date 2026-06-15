import { useCallback, useEffect, useRef, useState } from 'react';

export type LabelSelectionsMap = Record<string, Record<string, string>>;

export const useLabelSelections = (initialState: LabelSelectionsMap = {}) => {
  const [labelSelections, setLabelSelections] =
    useState<LabelSelectionsMap>(initialState);
  const labelSelectionsRef = useRef<LabelSelectionsMap>(initialState);

  useEffect(() => {
    labelSelectionsRef.current = labelSelections;
  }, [labelSelections]);

  const updateLabelSelections = useCallback(
    (
      updater:
        | LabelSelectionsMap
        | ((prev: LabelSelectionsMap) => LabelSelectionsMap),
    ) => {
      setLabelSelections((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (p: LabelSelectionsMap) => LabelSelectionsMap)(prev)
            : updater;
        labelSelectionsRef.current = next;
        return next;
      });
    },
    [],
  );

  return {
    labelSelections,
    labelSelectionsRef,
    updateLabelSelections,
  };
};
