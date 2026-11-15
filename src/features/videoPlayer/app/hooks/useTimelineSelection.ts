import { useCallback, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';

interface SelectionState {
  documentId: string;
  ids: string[];
  requestId: string | null;
}
interface TimelineSelection {
  selectedTimelineIdList: string[];
  selectionRequestId: string | null;
  setSelectedTimelineIdList: Dispatch<SetStateAction<string[]>>;
  applySelectionRequest: (
    documentId: string,
    requestId: string,
    ids: string[],
  ) => void;
  getSelectedTimelineId: (
    event: ChangeEvent<HTMLInputElement>,
    id: string,
  ) => void;
}

/** Selection and the operation receipt share one committed state. */
export const useTimelineSelection = (
  getDocumentId: () => string,
): TimelineSelection => {
  const documentId = getDocumentId();
  const [selection, setSelection] = useState<SelectionState>(() => ({
    documentId,
    ids: [],
    requestId: null,
  }));
  const setSelectedTimelineIdList = useCallback<
    Dispatch<SetStateAction<string[]>>
  >(
    (value) => {
      if (getDocumentId() !== documentId) return;
      setSelection((current) => {
        if (getDocumentId() !== documentId) return current;
        const previous =
          current.documentId === documentId
            ? current
            : { documentId, ids: [], requestId: null };
        return {
          ...previous,
          ids: typeof value === 'function' ? value(previous.ids) : value,
        };
      });
    },
    [documentId, getDocumentId],
  );
  const applySelectionRequest = useCallback(
    (owner: string, requestId: string, ids: string[]): void => {
      if (getDocumentId() !== owner) return;
      setSelection((current) =>
        getDocumentId() === owner
          ? { documentId: owner, ids, requestId }
          : current,
      );
    },
    [getDocumentId],
  );
  const getSelectedTimelineId = useCallback(
    (event: ChangeEvent<HTMLInputElement>, id: string): void => {
      const checked = event.target.checked;
      setSelectedTimelineIdList((previous) =>
        checked
          ? previous.includes(id)
            ? previous
            : [...previous, id]
          : previous.filter((item) => item !== id),
      );
    },
    [setSelectedTimelineIdList],
  );
  return {
    selectedTimelineIdList:
      selection.documentId === documentId ? selection.ids : [],
    selectionRequestId:
      selection.documentId === documentId ? selection.requestId : null,
    setSelectedTimelineIdList,
    applySelectionRequest,
    getSelectedTimelineId,
  };
};
