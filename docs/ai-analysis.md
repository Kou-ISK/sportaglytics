# AI Analysis and Local LLM Setup

SporTagLytics の AI 分析は、タイムライン、ラベル、メモ、統計情報を根拠として回答と推奨クリップを生成します。標準実行境界はローカル llama.cpp です。

関連 docs:

- [ユーザーガイド: AI分析](user-guide.md#ai分析v050以降)
- [Privacy and Data Handling](privacy-and-data-handling.md)
- [ADR 0005 Local LLM Analysis Boundary](adr/0005-local-llm-analysis-boundary.md)

## Runtime Boundary

- Renderer は `window.electronAPI.llama` 経由で model discovery、generation、cancel、progress を呼びます。
- llama.cpp process execution、temporary prompt/schema files、timeout、cleanup は Electron main process 側で扱います。
- GGUF model files are local assets and are not committed to git or bundled into official packages by default.
- Cloud LLM / external API provider is not part of the current contract.

## Binary Resolution

The app searches for the llama.cpp binary in this order.

1. Environment variable path:
   - `SPORTAGLYTICS_LLAMA_PATH`
   - `LLAMA_CPP_PATH`
2. Packaged app resources:
   - `<resources>/llama/<platform>/`
   - `<resources>/llama/`
3. Development paths:
   - `public/llama/<platform>/`
   - `public/llama/`

`<platform>` is `darwin`, `win32`, or `linux`.

Binary name candidates:

| Platform      | Candidates                                                       |
| ------------- | ---------------------------------------------------------------- |
| macOS / Linux | `llama-completion`, `llama-cli`, `llama`, `main`                 |
| Windows       | `llama-completion.exe`, `llama-cli.exe`, `llama.exe`, `main.exe` |

Example:

```bash
export SPORTAGLYTICS_LLAMA_PATH="/usr/local/bin/llama-cli"
pnpm run electron:dev
```

## Model Resolution

Model files must use the `.gguf` extension.

The app searches these model folders:

| Runtime     | Search folders                                                      |
| ----------- | ------------------------------------------------------------------- |
| Packaged    | `<resources>/llama/models/`, `<resources>/llama/<platform>/models/` |
| Development | `public/llama/models/`, `public/llama/<platform>/models/`           |

If the model setting is empty or `auto`, SporTagLytics chooses the largest discovered `.gguf` file. If a model setting is an absolute path and the file exists, that path is used directly.

## Recommended Local Layout

```text
public/llama/
├── darwin/
│   └── llama-completion
├── linux/
│   └── llama-completion
├── win32/
│   └── llama-completion.exe
└── models/
    └── your-model.gguf
```

`public/llama/models/*.gguf` is intentionally excluded from git. Keep large models local or provide setup instructions outside the repository.

Official Electron packages also exclude local `*.gguf` files. For packaged app usage, configure an absolute model path or place model files in a documented local resource location outside the repository. Bundling model weights in release artifacts requires a new ADR because licensing, size, and update strategy change.

## User Flow

1. Open the analysis window with `Cmd+Shift+A`.
2. Select the `AI分析` tab.
3. Confirm the model summary in the AI settings accordion.
4. Choose a template question or enter a custom question.
5. Run analysis and review summary, hypothesis, evidence, and suggested clips.
6. Use playlist creation when suggested clips should become a playlist window.

## Troubleshooting

| Symptom                             | Check                                                                 |
| ----------------------------------- | --------------------------------------------------------------------- |
| `llama.cppバイナリが見つかりません` | Binary exists, executable bit is set, env var path is correct         |
| `モデルファイルが見つかりません`    | `.gguf` exists under model search folders or absolute model path      |
| Slow generation                     | Use a smaller model, reduce max tokens, check CPU/GPU availability    |
| Timeout                             | Retry with a smaller prompt/model or increase configured timeout      |
| Empty or invalid output             | Check model quality and llama.cpp compatibility with JSON schema args |
| Cancel does not stop immediately    | Child process cancellation is best effort; wait for process cleanup   |

When adding a new provider or sending data outside the local process, update ADR 0005 and [privacy-and-data-handling.md](privacy-and-data-handling.md) in the same PR.
