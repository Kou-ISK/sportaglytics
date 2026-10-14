# macOS llama.cpp b7849 dependency notices

These texts supplement the upstream archive's top-level llama.cpp MIT license.
They are also embedded verbatim in both pinned upstream `llama-completion`
executables and exposed by upstream `--license`. This closes the standalone-file
and packaging-check gap; it is not evidence that the existing binary contained
no dependency notices or that all native dependencies have been audited.

| File | Pinned upstream source | SHA-256 |
| --- | --- | --- |
| `LICENSE-jsonhpp` | [llama.cpp b7849 / nlohmann JSON 3.12.0](https://github.com/ggml-org/llama.cpp/blob/2b4cbd2834e427024bc7f935a1f232aecac6679b/licenses/LICENSE-jsonhpp) | `c0d068392ea65358b798b8c165103560f06e9e3b38c4ab4e2d8810a7b931af86` |
| `LICENSE-cpp-httplib` | [llama.cpp b7849 vendored cpp-httplib](https://github.com/ggml-org/llama.cpp/blob/2b4cbd2834e427024bc7f935a1f232aecac6679b/vendor/cpp-httplib/LICENSE) | `4b45cbe16d7b71b89ae6127e26e0d90a029198ca5e958ad8e3d0b8bbed364d8b` |
| `LICENSE-BoringSSL` | [BoringSSL 0.20251002.0](https://github.com/google/boringssl/blob/52bb3988e3475e37664b0dd5395af49a55d343a2/LICENSE) | `827c8d8fc207c2392794eef9e00fe246f9f61fdcc132556c275be3dd8c3cd97f` |

The llama source archive SHA-256 is
`6a18527b93c78af01f8efd41f3e5703b5c3bddf22f68abfae1fd743f0fd26e29`.
Its [release build](https://github.com/ggml-org/llama.cpp/blob/2b4cbd2834e427024bc7f935a1f232aecac6679b/.github/workflows/release.yml#L48)
enables BoringSSL for both macOS architectures. The
[vendored build definition](https://github.com/ggml-org/llama.cpp/blob/2b4cbd2834e427024bc7f935a1f232aecac6679b/vendor/cpp-httplib/CMakeLists.txt#L37)
pins that BoringSSL release. The full license retains Apache-2.0 and the included
third-party conditions; it must not be reduced to a single MIT label.

`scripts/mac-llama-notices.mjs` accepts only this llama version, checks every
text's SHA-256 and its full-byte presence in the runtime without executing it,
then copies it to `llama/darwin/licenses/`. Cache verification and `afterPack`
repeat the checks. A version update requires a new source/binary review.

Windows uses the separate source build with HTTP/OpenSSL disabled and already
copies `licenses/LICENSE-jsonhpp`; do not infer that it uses the macOS TLS stack.
