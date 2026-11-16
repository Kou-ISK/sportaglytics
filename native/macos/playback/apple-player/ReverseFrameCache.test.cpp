#include "ReverseFrameCache.hpp"
#include <cassert>
#include <limits>
#include <thread>

using namespace appleplayback;
struct Image {
  int id;
};
std::atomic<int> alive{0};
OwnedImage<Image> image(int id) {
  ++alive;
  return OwnedImage<Image>(new Image{id}, [](Image *value) {
    --alive;
    delete value;
  });
}

int main() {
  bool rejected = false;
  try {
    FrameBudget zero(0);
  } catch (const std::invalid_argument &) {
    rejected = true;
  }
  assert(rejected);
  FrameBudget budget(100);
  ReverseFrameCache<Image> left, right;
  assert(left.beginRequest(1, 10) && right.beginRequest(1, 20));
  {
    std::vector<RetainedFrame<Image>> frames;
    frames.push_back(*budget.retain(image(1), 1, 10, 0, .1, 20));
    frames.push_back(*budget.retain(image(2), 1, 10, .1, .2, 20));
    assert(left.publish(std::move(frames)) && budget.usedBytes() == 40);
  }
  {
    std::vector<RetainedFrame<Image>> frames;
    frames.push_back(*budget.retain(image(3), 1, 20, 0, .1, 30));
    assert(right.publish(std::move(frames)) && budget.usedBytes() == 70);
  }
  assert(left.select(.099, 1)->image()->id == 1);
  assert(left.select(.1, 1)->image()->id == 2);
  assert(!left.select(.2, 1) && !left.select(-1, 1));
  assert(!left.select(std::numeric_limits<double>::quiet_NaN(), 1));
  // In-flight rendering counts against the same budget as both cache banks.
  auto drawn = left.select(.1, 1);
  left.clear();
  assert(budget.usedBytes() == 50 && alive == 2);
  assert(!budget.retain(image(4), 1, 10, .2, .3, 51));
  assert(budget.usedBytes() == 50 && alive == 2);
  drawn.reset();
  assert(budget.usedBytes() == 30 && alive == 1);
  // Cancellation/source changes invalidate lookup and late publishing.
  assert(left.beginRequest(2, 11));
  assert(!left.beginRequest(2, 12) && !left.beginRequest(1, 12));
  assert(!left.beginRequest(3, 0));
  {
    std::vector<RetainedFrame<Image>> stale;
    stale.push_back(*budget.retain(image(5), 1, 10, 0, .1, 20));
    assert(!left.publish(std::move(stale)));
    assert(budget.usedBytes() == 30 && alive == 1);
  }
  {
    std::vector<RetainedFrame<Image>> valid;
    valid.push_back(*budget.retain(image(6), 2, 11, 1, 1.1, 20));
    valid.push_back(*budget.retain(image(7), 2, 11, 1.2, 1.3, 20));
    assert(left.publish(std::move(valid)));
    assert(!left.select(1.15, 2) && !left.select(1.2, 1));
    assert(left.select(1.2, 2)->image()->id == 7);
  }
  // Invalid replacement cannot displace a valid current bank.
  for (bool duplicate : {false, true}) {
    std::vector<RetainedFrame<Image>> invalid;
    invalid.push_back(*budget.retain(image(8), 2, 11, 2, 2.1, 5));
    invalid.push_back(
        *budget.retain(image(9), 2, 11, duplicate ? 2 : 1.9, 2.2, 5));
    assert(!left.publish(std::move(invalid)));
    assert(left.select(1.2, 2)->image()->id == 7);
  }
  // An earlier frame cannot claim an interval containing the next frame:
  // overlapping ownership would make gaps/clip edges ambiguous.
  {
    std::vector<RetainedFrame<Image>> overlap;
    overlap.push_back(*budget.retain(image(20), 2, 11, 2, 2.2, 5));
    overlap.push_back(*budget.retain(image(21), 2, 11, 2.1, 2.3, 5));
    assert(!left.publish(std::move(overlap)));
    assert(left.select(1.2, 2)->image()->id == 7);
  }
  for (double value : {-1., std::numeric_limits<double>::infinity(),
                       std::numeric_limits<double>::quiet_NaN()}) {
    assert(!budget.retain(image(10), 2, 11, value, 3, 1));
    assert(!budget.retain(image(10), 2, 11, 1, value, 1));
  }
  assert(!budget.retain(image(11), 0, 11, 0, 1, 1));
  assert(!budget.retain(image(11), 2, 0, 0, 1, 1));
  assert(!budget.retain(image(11), 2, 11, 1, 1, 1));
  assert(!budget.retain(image(11), 2, 11, 0, 1, 0));
  left.clear();
  right.clear();
  assert(budget.usedBytes() == 0 && alive == 0);
  // Re-press/seek intent does not invalidate completed immutable source data.
  // Only the new request may publish. Its consumer carries its own presentation
  // operation; the cached frame keeps the original producer provenance.
  {
    FrameBudget warm(40);
    ReverseFrameCache<Image> cache;
    assert(cache.beginRequest(1, 7));
    std::vector<RetainedFrame<Image>> initial;
    initial.push_back(*warm.retain(image(30), 1, 7, 0, 1, 10));
    assert(cache.publish(std::move(initial)));
    auto inFlight = cache.select(.5, 1);
    assert(cache.cancelRequest(1));
    assert(!cache.cancelRequest(1) && !cache.select(.5, 1));
    std::vector<RetainedFrame<Image>> cancelled;
    cancelled.push_back(*warm.retain(image(33), 1, 7, 2, 3, 10));
    assert(!cache.publish(std::move(cancelled)));
    assert(cache.beginRequest(2, 7));
    assert(!cache.cancelRequest(1));
    assert(!cache.select(.5, 1));
    assert(cache.select(.5, 2)->image() == inFlight->image());
    assert(cache.select(.5, 2)->producedBy(1, 7));
    std::vector<RetainedFrame<Image>> late;
    late.push_back(*warm.retain(image(31), 1, 7, 2, 3, 10));
    assert(!cache.publish(std::move(late)));
    assert(cache.select(.5, 2)->image()->id == 30);
    assert(!cache.select(2.5, 2));
    std::vector<RetainedFrame<Image>> replacement;
    replacement.push_back(*warm.retain(image(32), 2, 7, 2, 3, 10));
    assert(cache.publish(std::move(replacement)));
    assert(!cache.select(.5, 2));
    assert(cache.select(2.5, 2)->image()->id == 32);
    assert(warm.usedBytes() == 20);
    inFlight.reset();
    assert(warm.usedBytes() == 10);
    assert(cache.beginRequest(3, 8));
    assert(!cache.select(2.5, 3) && warm.usedBytes() == 0);
  }
  assert(alive == 0);
  // Outstanding images keep the accounting state alive after cache/budget
  // teardown.
  std::optional<RetainedFrame<Image>> retained;
  {
    FrameBudget temporary(10);
    retained = temporary.retain(image(12), 1, 1, 0, 1, 10);
    assert(temporary.usedBytes() == 10);
  }
  assert(alive == 1 && retained->image()->id == 12);
  retained.reset();
  assert(alive == 0);
  // A moved-from lease can arrive at a transport/cache boundary. It must not
  // dereference absent storage or replace a valid bank.
  {
    FrameBudget movedBudget(10);
    ReverseFrameCache<Image> movedCache;
    assert(movedCache.beginRequest(1, 1));
    auto original = movedBudget.retain(image(40), 1, 1, 0, 1, 10);
    auto valid = std::move(*original);
    assert(!original->image() && !original->producedBy(1, 1));
    assert(movedCache.publish({valid}));
    assert(!movedCache.publish({*original}));
    assert(movedCache.select(.5, 1)->image()->id == 40);
    assert(movedBudget.usedBytes() == 10);
  }
  assert(alive == 0);
  // A real consumer may finish on a different thread while new frames arrive.
  FrameBudget concurrent(16);
  std::vector<std::thread> threads;
  for (int worker = 0; worker < 4; ++worker)
    threads.emplace_back([&] {
      for (int attempt = 0; attempt < 500; ++attempt) {
        auto frame = concurrent.retain(image(13), 1, 1, 0, 1, 8);
        assert(concurrent.usedBytes() <= concurrent.limitBytes());
      }
    });
  for (auto &worker : threads)
    worker.join();
  assert(concurrent.usedBytes() == 0 && alive == 0);
}
