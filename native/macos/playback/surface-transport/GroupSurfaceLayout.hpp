#pragma once
#import <CoreVideo/CoreVideo.h>
#import <IOSurface/IOSurface.h>

namespace groupsurfacewire {
inline bool supportedImageLayout(IOSurfaceRef surface) {
  if (!surface || IOSurfaceGetPixelFormat(surface) != '420v' || IOSurfaceGetPlaneCount(surface) != 2)
    return false;
  const auto width = IOSurfaceGetWidth(surface), height = IOSurfaceGetHeight(surface);
  if (width == 1920 && height == 1080) return true;
  return width == 1280 && height == 720 &&
         IOSurfaceGetWidthOfPlane(surface, 0) == width && IOSurfaceGetHeightOfPlane(surface, 0) == height &&
         IOSurfaceGetWidthOfPlane(surface, 1) == width / 2 && IOSurfaceGetHeightOfPlane(surface, 1) == height / 2;
}

// Main labels the additional layout as limited-range xvYCC709. Verify the
// decoded buffer itself; a matching container header alone is insufficient.
inline bool matches720Color(CVPixelBufferRef image) {
  auto matches = [image](CFStringRef key, CFStringRef expected) {
    CFTypeRef actual = CVBufferCopyAttachment(image, key, nullptr);
    const bool same = actual && expected && CFEqual(actual, expected);
    if (actual) CFRelease(actual);
    return same;
  };
  return matches(kCVImageBufferColorPrimariesKey, kCVImageBufferColorPrimaries_ITU_R_709_2) &&
         matches(kCVImageBufferYCbCrMatrixKey, kCVImageBufferYCbCrMatrix_ITU_R_709_2) &&
         matches(kCVImageBufferTransferFunctionKey, CVTransferFunctionGetStringForIntegerCodePoint(11));
}
}
