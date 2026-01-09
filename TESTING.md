# テストガイド

> **関連ドキュメント**  
> [DEVELOPMENT.md](DEVELOPMENT.md) | [CONTRIBUTING.md](CONTRIBUTING.md) | [ARCHITECTURE.md](ARCHITECTURE.md)

このドキュメントは、SporTagLyticsのテスト戦略とテスト実装のガイドラインを示します。

---

## 目次

1. [現状](#現状)
2. [テスト戦略](#テスト戦略)
3. [テストツール](#テストツール)
4. [テスト実装ガイド](#テスト実装ガイド)
5. [CIでのテスト自動化](#ciでのテスト自動化)
6. [今後の計画](#今後の計画)

---

## 現状

**⚠️ 現在、テストコードはほとんど整備されていません。**

- ユニットテストカバレッジ: ほぼ0%
- 統合テスト: 未実装
- E2Eテスト: 未実装

開発は主に手動テストに依存しており、リグレッションのリスクがあります。

### 既存のテストファイル

- `src/App.test.tsx`: Create React App のデフォルトテスト（未更新）
- `src/setupTests.ts`: テスト環境設定（Jest設定）

---

## テスト戦略

### テストピラミッド

```
        /\
       /  \       E2E Tests (少数)
      /____\      - 主要ユーザーフロー
     /      \     - クリティカルパス
    /________\
   /          \   Integration Tests (適度)
  /____________\  - コンポーネント統合
 /              \ - IPC通信
/______________  \ Unit Tests (多数)
                  - ユーティリティ関数
                  - カスタムフック
                  - ビジネスロジック
```

### 優先順位

1. **高**: ユーティリティ関数、カスタムフック（ビジネスロジック）
2. **中**: コンポーネント統合テスト
3. **低**: E2Eテスト（主要フローのみ）

---

## テストツール

### 推奨ツールスタック

| カテゴリ           | ツール                | 用途                                   |
| ------------------ | --------------------- | -------------------------------------- |
| **ユニットテスト** | Jest                  | テストランナー、アサーション           |
| **Reactテスト**    | React Testing Library | コンポーネントテスト                   |
| **E2Eテスト**      | Playwright            | Electronアプリのエンドツーエンドテスト |
| **カバレッジ**     | Jest Coverage         | コードカバレッジ測定                   |
| **モック**         | jest-mock             | IPC、ファイルI/Oのモック               |

### インストール

```bash
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm add -D @playwright/test
```

---

## テスト実装ガイド

### 1. ユニットテスト

#### ユーティリティ関数のテスト

**例**: `src/utils/scTimelineConverter.ts`

```typescript
// scTimelineConverter.test.ts
import { convertSCTimelineToTimeline } from './scTimelineConverter';

describe('scTimelineConverter', () => {
  describe('convertSCTimelineToTimeline', () => {
    it('should convert SCTimeline rows format to TimelineData', () => {
      const scData = {
        rows: [
          {
            code: 'TeamA Lineout',
            start: 10,
            end: 15,
            labels: [{ name: 'Win', group: 'Result' }],
          },
        ],
      };

      const result = convertSCTimelineToTimeline(scData);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        actionName: 'TeamA Lineout',
        startTime: 10,
        endTime: 15,
        labels: [{ name: 'Win', group: 'Result' }],
      });
    });

    it('should handle instances format', () => {
      const scData = {
        instances: [
          {
            ID: 1,
            code: 'TeamB Scrum',
            start: 20,
            end: 25,
          },
        ],
      };

      const result = convertSCTimelineToTimeline(scData);

      expect(result).toHaveLength(1);
      expect(result[0].actionName).toBe('TeamB Scrum');
    });
  });
});
```

#### カスタムフックのテスト

**例**: `src/hooks/videoPlayer/useTimelineSelection.ts`

```typescript
// useTimelineSelection.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTimelineSelection } from './useTimelineSelection';

describe('useTimelineSelection', () => {
  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => useTimelineSelection());

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isSelected('test-id')).toBe(false);
  });

  it('should select an item', () => {
    const { result } = renderHook(() => useTimelineSelection());

    act(() => {
      result.current.toggleSelection('item-1');
    });

    expect(result.current.selectedIds).toEqual(['item-1']);
    expect(result.current.isSelected('item-1')).toBe(true);
  });

  it('should deselect an item', () => {
    const { result } = renderHook(() => useTimelineSelection());

    act(() => {
      result.current.toggleSelection('item-1');
      result.current.toggleSelection('item-1');
    });

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isSelected('item-1')).toBe(false);
  });

  it('should clear all selections', () => {
    const { result } = renderHook(() => useTimelineSelection());

    act(() => {
      result.current.toggleSelection('item-1');
      result.current.toggleSelection('item-2');
      result.current.clearSelection();
    });

    expect(result.current.selectedIds).toEqual([]);
  });
});
```

### 2. コンポーネントテスト

**例**: `src/components/QuickHelpFab.tsx`

```typescript
// QuickHelpFab.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickHelpFab from './QuickHelpFab';

describe('QuickHelpFab', () => {
  it('should render help button', () => {
    render(<QuickHelpFab />);

    const button = screen.getByRole('button', { name: /help/i });
    expect(button).toBeInTheDocument();
  });

  it('should open shortcut guide on click', async () => {
    const user = userEvent.setup();
    render(<QuickHelpFab />);

    const button = screen.getByRole('button', { name: /help/i });
    await user.click(button);

    expect(screen.getByText(/ショートカット/i)).toBeInTheDocument();
  });
});
```

### 3. IPC通信のモック

**例**: Electron API のモック

```typescript
// __mocks__/electron.ts
export const mockElectronAPI = {
  selectDirectory: jest.fn(),
  saveTimelineData: jest.fn(),
  loadTimelineData: jest.fn(),
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
};

// テストファイル内
beforeEach(() => {
  (window as any).electronAPI = mockElectronAPI;
});

afterEach(() => {
  jest.clearAllMocks();
});

it('should save timeline data via IPC', async () => {
  mockElectronAPI.saveTimelineData.mockResolvedValue({ success: true });

  // テストコード
  await saveTimeline();

  expect(mockElectronAPI.saveTimelineData).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Array),
  );
});
```

### 4. E2Eテスト (Playwright)

**例**: パッケージ作成フロー

```typescript
// e2e/package-creation.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('should create a new package', async () => {
  const app = await electron.launch({ args: ['./build/electron/src/main.js'] });
  const window = await app.firstWindow();

  // ウェルカム画面で「新規パッケージを作成」をクリック
  await window.click('text=新規パッケージを作成');

  // ステップ1: 基本情報入力
  await window.fill('input[name="packageName"]', 'Test Package');
  await window.fill('input[name="team1"]', 'Team A');
  await window.fill('input[name="team2"]', 'Team B');
  await window.click('button:has-text("次へ")');

  // ステップ2: 保存先選択
  // （ファイルダイアログのモックが必要）

  // ステップ3: 映像選択
  // （ファイルダイアログのモックが必要）

  // ステップ4: 確認
  await window.click('button:has-text("作成")');

  // パッケージが作成されたことを確認
  await expect(window.locator('text=Test Package')).toBeVisible();

  await app.close();
});
```

---

## CIでのテスト自動化

### GitHub Actions ワークフロー

`.github/workflows/test.yml`:

```yaml
name: Test

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Run type check
        run: |
          pnpm exec tsc --noEmit
          pnpm exec tsc -p electron --noEmit

      - name: Run unit tests
        run: pnpm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: macos-latest # Electronアプリのため

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright
        run: pnpm exec playwright install

      - name: Build app
        run: pnpm run build

      - name: Run E2E tests
        run: pnpm exec playwright test

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

### package.json スクリプト追加

```json
{
  "scripts": {
    "test": "react-scripts test",
    "test:coverage": "react-scripts test --coverage --watchAll=false",
    "test:e2e": "playwright test",
    "test:all": "pnpm test:coverage && pnpm test:e2e"
  }
}
```

---

## 今後の計画

### 短期（1-2ヶ月）

- [ ] ユーティリティ関数のユニットテスト整備（優先度: 高）
  - `scTimelineConverter.ts`
  - `timelineExport.ts`
  - `AudioSyncAnalyzer.ts`
  - `matrixBuilder.ts`

- [ ] カスタムフックのテスト整備（優先度: 高）
  - `useTimelineSelection.ts`
  - `useTimelineEditing.ts`
  - `useTimelineHistory.ts`
  - `useTimelineValidation.ts`

- [ ] CI/CDでのテスト自動化（優先度: 高）

### 中期（3-6ヶ月）

- [ ] コンポーネント統合テスト（優先度: 中）
  - `VisualTimeline`
  - `StatsModal`
  - `VideoController`

- [ ] IPC通信のテスト（優先度: 中）

- [ ] E2Eテスト（主要フローのみ）（優先度: 中）
  - パッケージ作成フロー
  - タイムライン編集フロー
  - 統計分析フロー

### 長期（6ヶ月以上）

- [ ] カバレッジ目標: 70%以上
- [ ] ビジュアルリグレッションテスト（Storybookと連携）
- [ ] パフォーマンステスト

---

## ベストプラクティス

### テスト命名規則

```typescript
describe('ComponentName / FunctionName', () => {
  describe('methodName', () => {
    it('should [期待される動作]', () => {
      // テストコード
    });
  });
});
```

### AAA パターン

```typescript
it('should add item to timeline', () => {
  // Arrange（準備）
  const timeline = [];
  const newItem = { id: '1', actionName: 'Test' };

  // Act（実行）
  const result = addTimelineItem(timeline, newItem);

  // Assert（検証）
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual(newItem);
});
```

### テストデータ

テストデータはファクトリー関数で生成:

```typescript
// test-utils/factories.ts
export const createTimelineData = (overrides = {}) => ({
  id: ulid(),
  actionName: 'Test Action',
  startTime: 0,
  endTime: 10,
  qualifier: '',
  labels: [],
  ...overrides,
});
```

---

## 参考資料

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright for Electron](https://playwright.dev/docs/api/class-electron)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)

---

テスト戦略に関する質問や提案は、[GitHub Discussions](https://github.com/Kou-ISK/sportaglytics/discussions)で受け付けています。
