import { useEffect, useMemo, useState } from 'react';
import type { MatrixAxisConfig } from '../../../../../../../types/MatrixConfig';

const pickInitialAxis = (availableGroups: string[], preferred: string) => {
  if (availableGroups.length === 0) return '';
  if (availableGroups.includes(preferred)) return preferred;
  if (availableGroups.length > 1) return availableGroups[1];
  return availableGroups[0];
};

export const useMatrixAxes = (availableGroups: string[]) => {
  const initialRowValue = useMemo(
    () =>
      availableGroups.length === 0
        ? ''
        : availableGroups.includes('actionType')
          ? 'actionType'
          : availableGroups[0],
    [availableGroups],
  );

  const initialColValue = useMemo(
    () => pickInitialAxis(availableGroups, 'actionResult'),
    [availableGroups],
  );

  const [customRowAxis, setCustomRowAxis] = useState<MatrixAxisConfig>({
    type: 'group',
    value: initialRowValue,
  });
  const [customColumnAxis, setCustomColumnAxis] = useState<MatrixAxisConfig>({
    type: 'group',
    value: initialColValue,
  });

  useEffect(() => {
    if (availableGroups.length > 0) {
      setCustomRowAxis((prev) => ({
        ...prev,
        value: initialRowValue,
      }));
      setCustomColumnAxis((prev) => ({
        ...prev,
        value: initialColValue,
      }));
    }
  }, [initialRowValue, initialColValue, availableGroups.length]);

  return {
    customRowAxis,
    customColumnAxis,
    setCustomRowAxis,
    setCustomColumnAxis,
  };
};
