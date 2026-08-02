import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { on: vi.fn() },
  BrowserWindow: vi.fn(),
}));

vi.mock('./windowSecurity', () => ({
  applyWindowSecurity: vi.fn(),
}));

import { buildHelpHtml } from './helpWindow';

describe('buildHelpHtml', () => {
  it('renders a searchable, keyboard-accessible help reference', () => {
    const html = buildHelpHtml();

    expect(html).toContain('id="help-search"');
    expect(html).toContain('aria-label="ヘルプを検索"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('max-width: 720px');
    expect(html).toContain('showSection(navButtons[0]?.dataset.target)');
    expect(html).not.toContain('使い方ガイドへようこそ');
  });
});
