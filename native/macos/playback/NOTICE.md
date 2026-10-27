# Apple playback integration

The SporTagLytics AVPlayer helper and IOSurface receiver sources are distributed
under the repository's MIT license. This does not replace third-party licenses.

NativeProductHost uses AVPlayer for media reading, decoding, audio rendering and
the playback clock. AVPlayerItemVideoOutput supplies the image appropriate to
that clock to the existing Electron overlay surface. This helper does not link
FFmpeg or implement a separate audio/video supply pipeline. Export and media
inspection tools have their own notices and are separate from playback.

Receiver.node uses the Node.js 22.12.0 N-API headers (N-API version 8). The full
Node distribution LICENSE is included; its text describes applicable licenses
for individual components. Node runtime code is not statically linked into this
receiver. Source: https://nodejs.org/dist/v22.12.0/.

Apple frameworks are provided by macOS and are not redistributed. This notice
does not claim comprehensive patent clearance or knowledge of QuickTime Player
or Sportscode's private implementation.

The matching playback source archive contains the pinned Node headers/license,
complete helper and receiver source, build recipe and manifest. Do not distribute
these binaries without their matching source archive and notices. Unsigned build
hashes and final signed package hashes are distinct.
