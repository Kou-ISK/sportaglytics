---
applyTo: '**/*.ts,**/*.tsx'
---

# TypeScript 向け指示

## 型定義と再利用

- 既存の型（例: `TimelineData`, `VideoSyncData`, `RechartsData`, `MatrixConfig`, `Settings`）を優先して再利用し、重複定義を避ける。
- 共有型は `src/types/` にまとめる。機能固有の型は各 feature の `types/` ディレクトリに配置。
- 複雑な型は型エイリアスまたはインターフェースとして名前付きで定義し、可読性を高める。

## 型安全性の徹底

- プロップス・戻り値・引数には必ず明示的に型を付け、暗黙の `any` を生じさせない。
- `strict` モードを有効にし、TypeScript の型チェックを最大限活用。
- 型ガードを使用して、`unknown` や `any` を安全に絞り込む:
  ```ts
  function isTimelineData(value: unknown): value is TimelineData {
    return typeof value === 'object' && value !== null && 'id' in value;
  }
  ```

## ジェネリクスの活用

- ユーティリティ関数はジェネリクスで汎用化し、極力 `unknown` や `as` 断定キャストを使わない。
- 例:
  ```ts
  function filterByProperty<T, K extends keyof T>(
    items: T[],
    key: K,
    value: T[K],
  ): T[] {
    return items.filter((item) => item[key] === value);
  }
  ```

## 列挙型とリテラル型

- 列挙値は文字列リテラル型のユニオンか `enum` を用意し、マジックナンバー／マジックワードを避ける。
- 例:
  ```ts
  type StatsView = 'overview' | 'timeline' | 'matrix' | 'breakdown';
  ```
- `enum` は値が明確な場合のみ使用し、それ以外はユニオン型を優先。

## 非同期処理

- 非同期処理は `async/await` をデフォルトとし、例外は `try/catch` あるいは明示的なエラー伝搬で処理する。
- エラーハンドリング例:
  ```ts
  try {
    const result = await window.electronAPI.loadTimeline(id);
    return result;
  } catch (error) {
    console.debug('Timeline load failed:', error);
    throw new Error('タイムラインの読み込みに失敗しました');
  }
  ```

## インターフェース vs 型エイリアス

- コンポーネント Props や外部ライブラリとの契約にはインターフェースを使用。
- ユニオン型や複雑な型変換には型エイリアスを使用。
- 拡張が必要な場合はインターフェースを優先（`extends` が可能）。

## ユーティリティ型の活用

- TypeScript 組み込みのユーティリティ型を活用して型安全性を高める:
  - `Partial<T>`: すべてのプロパティをオプショナルに
  - `Pick<T, K>`: 特定のプロパティのみ抽出
  - `Omit<T, K>`: 特定のプロパティを除外
  - `Record<K, T>`: キーと値の型を指定したオブジェクト

## 型インポート

- 型のみをインポートする場合は `import type` を使用し、バンドルサイズを削減:
  ```ts
  import type { TimelineData } from '@/types/TimelineData';
  ```

## JSDoc コメント

- 複雑な関数やパブリック API には JSDoc コメントを付与:
  ```ts
  /**
   * タイムラインデータを時間範囲でフィルタリングする
   * @param timeline - フィルタリング対象のタイムラインデータ
   * @param startTime - 開始時刻（秒）
   * @param endTime - 終了時刻（秒）
   * @returns フィルタリングされたタイムラインデータ
   */
  function filterTimelineByRange(
    timeline: TimelineData,
    startTime: number,
    endTime: number,
  ): TimelineData {
    // ...
  }
  ```

## 外部ライブラリの型定義

- Video.js など外部ライブラリを扱う際は、最小限の型ラッパーを定義して安全に呼び出す。
- 型定義がない場合は `@types` パッケージをインストールするか、必要に応じて `*.d.ts` ファイルで型を補完。
