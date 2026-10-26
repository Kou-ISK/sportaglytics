# Native playback preview

The SporTagLytics playback helper and IOSurface receiver sources are distributed
under the repository's MIT license. This does not replace third-party licenses.

NativeProductHost statically links a restricted build of FFmpeg 8.1.2
(libavformat, libavcodec, libavfilter and libavutil), licensed under LGPL 2.1 or
later for this configuration. GPL, version3, nonfree and network features are
disabled. FFmpeg's complete license explanation and LGPL text accompany the
helper. The local MIT build adaptation in scripts/native-playback/filter-thread-qos.mjs
and FilterThreadQoS.h makes the filter pool preserve its caller's requested
macOS QoS and relative priority. Decoder thread policy is unchanged. These
changes are reapplied from the matching source archive; the upstream archive
itself remains hash-verified. Source: https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz.

Receiver.node uses the Node.js 22.12.0 N-API headers (N-API version 8). The full
Node distribution LICENSE is included; its text describes the applicable
licenses for individual bundled components. Node runtime code is not statically
linked into this receiver. Source: https://nodejs.org/dist/v22.12.0/.

Apple frameworks are provided by macOS and are not redistributed in this
resource directory. This notice does not claim comprehensive patent clearance.

The matching native playback source archive contains the pinned upstream
archives, complete helper and receiver source, build recipe and build manifest.
It permits rebuilding the helper, including relinking with a modified FFmpeg
library, independently of the Electron application. Do not distribute these
binaries without their matching source archive and notices. Unsigned build
hashes and final signed package hashes are distinct.
