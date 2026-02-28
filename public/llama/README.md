llama.cpp binaries and models go here.

Place platform-specific binaries in one of these paths (not bundled by default):
- public/llama/darwin/llama-completion (preferred) or llama-cli (or llama)
- public/llama/win32/llama-completion.exe (preferred) or llama-cli.exe (or llama.exe / main.exe)
- public/llama/linux/llama-completion (preferred) or llama-cli (or llama)

Place model files under:
- public/llama/models/<model>.gguf

They will be packaged into the app resources under:
<resources>/llama/

Tip:
- Set the model name to `auto` to let the app choose the largest available `.gguf` file.
