#include "SourceTimeline.hpp"
#include <cassert>
#include <climits>

template<class F> bool rejects(F f) {
  try { f(); return false; } catch (const std::exception&) { return true; }
}
int main() {
  using namespace nativeplayback;
  const FieldTimeline video(0, 600000 * FieldStep);
  for (const auto target : {int64_t(0), FieldStep, 300000 * FieldStep, video.end - FieldStep}) {
    assert(video.contains(target));
    assert(video.containing(target + FieldStep - 1) == target);
    assert(video.prerollInputPTS(target) >= 0);
  }
  assert(video.prerollInputPTS(0) == 0);
  assert(video.prerollInputPTS(FieldStep) == 0);
  assert(video.prerollInputPTS(10 * FieldStep) == 4 * FieldStep);
  assert(!video.contains(-1) && !video.contains(video.end));
  assert(rejects([&]{video.containing(video.end);}));
  assert(rejects([]{FieldTimeline t(1,1001);}));
  assert(rejects([]{FieldTimeline t(0,INT64_MAX);}));
  const AudioTimeline audio(0, 600001);
  for (int64_t i=0, previous=0; i<=5; ++i) {
    const auto w=audio.window(i);
    assert(w.start==previous && audio.validWindow(w.start,w.end));
    assert(audio.index(w.start)==i && audio.index(w.end-1)==i);
    previous=w.end;
  }
  assert(audio.window(5).end==audio.end);
  assert(rejects([&]{audio.window(6);}));
  assert(rejects([&]{audio.window(INT64_MAX);}));
  assert(rejects([&]{audio.index(audio.end);}));
  assert(rejects([]{AudioTimeline t(-1,10);}));
  assert(audio.coversField(0,24*FieldStep));
  assert(!audio.coversField(audio.end*5/2,24*FieldStep));
  assert(!audio.validWindow(0,AudioWindowSamples+1));
}
