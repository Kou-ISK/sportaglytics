# Supplemental upstream license texts

macOS llama.cpp's standalone dependency notices and their source/binary bindings
are recorded in [llama-b7849/README.md](llama-b7849/README.md).

`victory-vendor@37.3.6` declares `MIT AND ISC` but its npm tarball omits the wrapper's MIT license file. Preserve that file verbatim from the matching Victory tag:

- Source: https://raw.githubusercontent.com/FormidableLabs/victory/v37.3.6/LICENSE.txt
- File: `victory-vendor-37.3.6-LICENSE.txt`
- SHA-256: `34dee5fd5e5cc756efb5ad4d64652bce719bdf5e900ca5d7538253e737930bc4`

The inventory plugin uses this supplement only for this exact package/version. D3 and other vendored license texts are read from the installed packages. Recheck the upstream license when updating the package; do not copy this exception to another version without review.
