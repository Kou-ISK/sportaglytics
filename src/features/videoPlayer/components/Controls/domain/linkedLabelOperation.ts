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
  getName: (id: string) => string | undefined,
  isRecording: (name: string) => boolean,
): LinkedLabelOperation => {
  const labelNames = new Set<string>();
  const stopNames = new Set<string>();
  const startIds = new Set<string>();
  for (const link of links) {
    const outgoing = link.fromId === buttonId;
    const targetId = outgoing
      ? link.toId
      : link.type === 'exclusive' && link.toId === buttonId
        ? link.fromId
        : undefined;
    if (!targetId || targetId === buttonId) continue;
    const name = getName(targetId);
    if (!name) continue;
    if (link.type === 'activate') {
      startIds.add(targetId);
      continue;
    }
    if (!isRecording(name)) continue;
    labelNames.add(name);
    if (link.type === 'deactivate') stopNames.add(name);
  }
  // Do not reopen a code as a side effect of stopping that same code.
  return {
    labelNames: [...labelNames],
    stopNames: [...stopNames],
    startIds: [...startIds].filter((id) => {
      const name = getName(id);
      return name !== undefined && !stopNames.has(name);
    }),
  };
};
