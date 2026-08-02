import { describe, expect, it } from 'vitest';
import { getAppTheme } from './theme';

describe('getAppTheme', () => {
  it('uses readable disabled text and dividers in light mode', () => {
    const theme = getAppTheme('light');

    expect(theme.palette.text.disabled).toBe('rgba(0,0,0,0.38)');
    expect(theme.palette.divider).toBe('rgba(0,0,0,0.12)');
  });
});
