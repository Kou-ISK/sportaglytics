# llama.cpp local assets

This directory is for local llama.cpp binaries and GGUF models used by SporTagLytics AI analysis.

Full setup and troubleshooting: [docs/ai-analysis.md](../../docs/ai-analysis.md)

Official macOS runtimes are prepared with `pnpm run llama:prepare:mac`; Windows uses `pnpm run llama:build:windows`. Verified binaries live in `.cache/llama/<platform>-<arch>` and are copied into package resources. Do not commit generated native binaries here.

For a custom development runtime, place platform-specific binaries in one of these paths:

- public/llama/darwin/llama-completion (preferred) or llama-cli (or llama)
- public/llama/win32/llama-completion.exe (preferred) or llama-cli.exe (or llama.exe / main.exe)
- public/llama/linux/llama-completion (preferred) or llama-cli (or llama)

Place model files under:

- public/llama/models/<model>.gguf

Model files are local runtime assets. They are ignored by git and excluded from official Electron packages by default.

If a packaged app needs a model, configure an absolute model path or place the model in a documented local resource location outside this repository. Bundling model weights in release artifacts requires an explicit ADR because package size, licensing, and update strategy change.

Tip:

- Set the model name to `auto` to let the app choose the largest available `.gguf` file.
