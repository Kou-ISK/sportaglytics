import type { EffectiveLink } from '../effectiveLinks';

interface LinkedLabelOperation {
  labelNames: string[];
  stopNames: string[];
  startIds: string[];
}

/** Match only explicit canvas IDs. Name-based legacy links are not routes. */
export const planLinkedLabelOperation = (
  links: EffectiveLink[],
  buttonId: string,
  getActiveKey: (id: string) => string | undefined,
): LinkedLabelOperation => {
  const labelNames = new Set<string>();
  const stopNames = new Set<string>();
  const stopIds = new Set<string>();
  const startIds = new Set<string>();
  for (const link of links) {
    const outgoing = link.fromId === buttonId;
    const targetId = outgoing
      ? link.toId
      : link.type === 'exclusive' && link.toId === buttonId
        ? link.fromId
        : undefined;
    if (!targetId || targetId === buttonId) continue;
    if (link.type === 'activate') {
      startIds.add(targetId);
      continue;
    }
    const activeKey = getActiveKey(targetId);
    if (activeKey === undefined) continue;
    labelNames.add(activeKey);
    if (link.type === 'deactivate') {
      stopNames.add(activeKey);
      stopIds.add(targetId);
    }
  }
  // Do not reopen a code as a side effect of stopping that same code.
  return {
    labelNames: [...labelNames],
    stopNames: [...stopNames],
    startIds: [...startIds].filter((id) => !stopIds.has(id)),
  };
};
