import { useCallback, useState } from 'react';

export const useTimelineSelection = () => {
  const [selectedTimelineIdList, setSelectedTimelineIdList] = useState<
    string[]
  >([]);

  const getSelectedTimelineId = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, id: string) => {
      setSelectedTimelineIdList((prev) => {
        if (event.target.checked) {
          return prev.includes(id) ? prev : [...prev, id];
        }
        return prev.filter((item) => item !== id);
      });
    },
    [],
  );

  return {
    selectedTimelineIdList,
    setSelectedTimelineIdList,
    getSelectedTimelineId,
  };
};
