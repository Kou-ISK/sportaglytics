import { useCallback } from 'react';
import type React from 'react';
import type {
  DashboardSeriesDefinition,
  DashboardSeriesFilter,
} from '../../../../../../types/Settings';
import { generateWidgetId } from './dashboardWidgetDialogState.utils';

interface UseDashboardWidgetSeriesActionsParams {
  setSeries: React.Dispatch<React.SetStateAction<DashboardSeriesDefinition[]>>;
  setWidgetFilters: React.Dispatch<React.SetStateAction<DashboardSeriesFilter>>;
}

export const useDashboardWidgetSeriesActions = ({
  setSeries,
  setWidgetFilters,
}: UseDashboardWidgetSeriesActionsParams) => {
  const addSeriesPair = useCallback(() => {
    setSeries((prev) => {
      const firstIndex = prev.length + 1;
      return [
        ...prev,
        {
          id: generateWidgetId(),
          name: `シリーズ${firstIndex}`,
          filters: {},
        },
        {
          id: generateWidgetId(),
          name: `シリーズ${firstIndex + 1}`,
          filters: {},
        },
      ];
    });
  }, [setSeries]);

  const addSeries = useCallback(() => {
    setSeries((prev) => [
      ...prev,
      {
        id: generateWidgetId(),
        name: `シリーズ${prev.length + 1}`,
        filters: {},
      },
    ]);
  }, [setSeries]);

  const removeSeries = useCallback(
    (id: string) => {
      setSeries((prev) => prev.filter((item) => item.id !== id));
    },
    [setSeries],
  );

  const handleSeriesChange = useCallback(
    (id: string, patch: Partial<DashboardSeriesDefinition>) => {
      setSeries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [setSeries],
  );

  const handleSeriesFilterChange = useCallback(
    (id: string, patch: Partial<DashboardSeriesFilter>) => {
      setSeries((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, filters: { ...item.filters, ...patch } } : item,
        ),
      );
    },
    [setSeries],
  );

  const updateWidgetFilters = useCallback(
    (patch: Partial<DashboardSeriesFilter>) => {
      setWidgetFilters((prev) => ({ ...prev, ...patch }));
    },
    [setWidgetFilters],
  );

  return {
    addSeriesPair,
    addSeries,
    removeSeries,
    handleSeriesChange,
    handleSeriesFilterChange,
    updateWidgetFilters,
  };
};
