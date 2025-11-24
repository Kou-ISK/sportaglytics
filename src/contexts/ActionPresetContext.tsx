import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { ActionList } from '../ActionList';
import type { ActionPreset } from '../types/Settings';

// デフォルトプリセットの定義（ActionList.tsから生成）
// 全ActionList項目を1つのプリセットにまとめる
const DEFAULT_PRESET: ActionPreset = {
  id: 'default',
  name: 'デフォルトプリセット（ラグビー）',
  actions: ActionList.map((item) => ({
    action: item.action,
    results: item.results,
    types: item.types,
  })),
  order: 0,
  isDefault: true, // デフォルトプリセットフラグ
};

interface ActionPresetContextValue {
  /** 現在アクティブなプリセット */
  activePreset: ActionPreset | undefined;
  /** すべてのアクション（activePresetのactionsを展開したもの） */
  activeActions: Array<{
    action: string;
    results: string[];
    types: string[];
    hotkey?: string;
  }>;
  /** 現在アクティブなプリセットID */
  activePresetId: string;
  /** 利用可能なプリセットリスト（デフォルト + カスタム） */
  availablePresets: ActionPreset[];
  /** プリセットを切り替える */
  setActivePresetId: (id: string) => void;
  /** プリセットをリロード */
  reloadPresets: () => Promise<void>;
}

const ActionPresetContext = createContext<ActionPresetContextValue | undefined>(
  undefined,
);

export const useActionPreset = () => {
  const context = useContext(ActionPresetContext);
  if (!context) {
    throw new Error('useActionPreset must be used within ActionPresetProvider');
  }
  return context;
};

interface ActionPresetProviderProps {
  children: React.ReactNode;
}

export const ActionPresetProvider: React.FC<ActionPresetProviderProps> = ({
  children,
}) => {
  const [activePresetId, setActivePresetId] = useState<string>('default');
  const [customPresets, setCustomPresets] = useState<ActionPreset[]>([]);

  // 設定からプリセット情報を読み込む
  const loadPresets = useCallback(async () => {
    try {
      const api = globalThis.window.electronAPI;
      if (!api) return;

      const settings = await api.loadSettings();
      if (settings && typeof settings === 'object') {
        const s = settings as {
          activePresetId?: string;
          actionPresets?: ActionPreset[];
        };
        if (s.activePresetId) {
          setActivePresetId(s.activePresetId);
        }
        if (s.actionPresets) {
          setCustomPresets(s.actionPresets);
        }
      }
    } catch (err) {
      console.error('Failed to load action presets:', err);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // 利用可能なプリセットリストを構築
  const availablePresets = useMemo(() => {
    // カスタムプリセット内にデフォルトプリセットの編集済みバージョンがあるかチェック
    const hasCustomizedDefault = customPresets.some((p) => p.id === 'default');

    // 編集済みデフォルトがあればハードコードされたDEFAULT_PRESETは使わない
    const presets: ActionPreset[] = hasCustomizedDefault
      ? []
      : [DEFAULT_PRESET];

    // カスタムプリセットを追加
    if (customPresets.length > 0) {
      presets.push(...customPresets);
    }

    return presets;
  }, [customPresets]);

  // 現在アクティブなプリセットを取得
  const activePreset = useMemo(() => {
    return (
      availablePresets.find((p) => p.id === activePresetId) || DEFAULT_PRESET
    );
  }, [activePresetId, availablePresets]);

  // アクティブなプリセットのアクション一覧を展開
  const activeActions = useMemo(() => {
    return activePreset.actions || [];
  }, [activePreset]);

  const value = useMemo(
    () => ({
      activePreset,
      activeActions,
      activePresetId,
      availablePresets,
      setActivePresetId,
      reloadPresets: loadPresets,
    }),
    [
      activePreset,
      activeActions,
      activePresetId,
      availablePresets,
      loadPresets,
    ],
  );

  return (
    <ActionPresetContext.Provider value={value}>
      {children}
    </ActionPresetContext.Provider>
  );
};
