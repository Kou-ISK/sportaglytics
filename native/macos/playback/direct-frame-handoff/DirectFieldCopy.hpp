#pragma once
#include "DirectFrameReader.hpp"
#include <CoreVideo/CoreVideo.h>
namespace directframe {
// Caller owns the pixel buffer; all source bytes are consumed before return.
void copyToNV12(const AVFrame& frame,CVPixelBufferRef pixel);
}
