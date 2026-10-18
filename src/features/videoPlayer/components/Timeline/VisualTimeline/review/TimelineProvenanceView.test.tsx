/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { TimelineProvenanceView } from './TimelineProvenanceView';
import { detectionProvenance } from '../../../../../../shared/timeline/fixtures/detectionProvenance';

afterEach(cleanup);
it('does not label an old or manual entry as human-reviewed', () => {
  render(<TimelineProvenanceView />);
  expect(screen.getByText('出所・人確認の記録なし')).toBeTruthy();
});
it('discloses original scores and mixed unknown sources without asserting review', () => {
  render(
    <TimelineProvenanceView
      provenance={{ ...detectionProvenance, hasUnknownSource: true }}
    />,
  );
  fireEvent.click(screen.getByText('自動検出由来 · 人確認の記録なし'));
  expect(screen.getByText(/元候補スコア 0.9/).textContent).toContain(
    'synthetic-model / 1-experimental',
  );
  expect(
    screen.getByText('由来の記録がない場面も結合されています。'),
  ).toBeTruthy();
  expect(screen.getByText(/編集後の区間の正確さ/)).toBeTruthy();
});
