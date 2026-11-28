import { describe, expect, it } from 'vitest';
import type { EffectiveLink } from '../effectiveLinks';
import { planLinkedLabelOperation } from './linkedLabelOperation';

const resolveName = (id: string): string | undefined =>
  new Map([
    ['a', 'Red Lineout'],
    ['b', 'Blue Lineout'],
    ['attack', 'Red Attack'],
  ]).get(id);

describe('linked label workflows', () => {
  it('targets explicit IDs and separates existing events from newly started ones', () => {
    const links: EffectiveLink[] = [
      {
        from: 'Result',
        to: 'Red Lineout',
        fromId: 'won',
        toId: 'a',
        type: 'deactivate',
      },
      {
        from: 'Result',
        to: 'Red Attack',
        fromId: 'won',
        toId: 'attack',
        type: 'activate',
      },
      { from: 'Result', to: 'Blue Lineout', type: 'deactivate' },
      {
        from: 'Blue Lineout',
        to: 'Result',
        fromId: 'b',
        toId: 'won',
        type: 'deactivate',
      },
    ];
    expect(
      planLinkedLabelOperation(links, 'won', resolveName, () => true),
    ).toEqual({
      labelNames: ['Red Lineout'],
      stopNames: ['Red Lineout'],
      startIds: ['attack'],
    });
  });

  it('allows exclusive target links in either direction without stopping the target', () => {
    const links: EffectiveLink[] = [
      {
        from: 'Red Lineout',
        to: 'Result',
        fromId: 'a',
        toId: 'won',
        type: 'exclusive',
      },
      {
        from: 'Result',
        to: 'Blue Lineout',
        fromId: 'won',
        toId: 'b',
        type: 'exclusive',
      },
    ];
    expect(
      planLinkedLabelOperation(
        links,
        'won',
        resolveName,
        (name) => name === 'Red Lineout',
      ),
    ).toEqual({
      labelNames: ['Red Lineout'],
      stopNames: [],
      startIds: [],
    });
  });
});
