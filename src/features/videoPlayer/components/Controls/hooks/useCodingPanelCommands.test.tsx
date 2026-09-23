// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { CodingPanelWindowCommand } from '../../../../../types/ipc/codingPanelWindow';
const { subscribe, off } = vi.hoisted(() => ({
  subscribe: vi.fn(),
  off: vi.fn(),
}));
vi.mock('../gateways/codingPanelWindowGateway', () => ({
  subscribeCodingPanelWindowCommand: subscribe,
}));
import { useCodingPanelCommands } from './useCodingPanelCommands';
it('does not lose the command listener across clock updates and delivers the latest handler', () => {
  let receive: (command: CodingPanelWindowCommand) => void = () => {};
  subscribe.mockImplementation((handler) => {
    receive = handler;
    return off;
  });
  const first = vi.fn(),
    latest = vi.fn();
  const hook = renderHook(({ handler }) => useCodingPanelCommands(handler), {
    initialProps: { handler: first },
  });
  for (let i = 0; i < 120; i++) hook.rerender({ handler: latest });
  act(() => receive({ type: 'custom-button-click', buttonId: 'event' }));
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(latest).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
  hook.unmount();
  expect(off).toHaveBeenCalledTimes(1);
});
