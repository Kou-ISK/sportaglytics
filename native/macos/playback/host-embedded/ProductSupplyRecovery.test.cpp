#include "ProductSupplyRecovery.hpp"
#include "ProductClockPolicy.hpp"
#include <cassert>
#include <limits>
using namespace diagnostic;
int main() {
 const nativeplayback::FieldTimeline timeline(0, 12012000);
 ProductSupplyRecovery r;
 // A fractional clock beyond the exhausted field remains exact after stop.
 assert(r.begin(2, 3, 10, 811900, 120000));
 assert(r.observe(2, 3, 10.004, true, 812114, 120000, 1, timeline) == SupplyObservation::Stopping);
 assert(!r.stopped());
 assert(r.observe(2, 3, 10.005, true, 812120, 120000, 0, timeline) == SupplyObservation::Refilling);
 assert(r.stopped()->value == 812120 && r.stopped()->scale == 120000);
 assert(r.stopped()->field == 811811);
 const Reserve full{true, 840840, true};
 // A next-field arrival alone, a stale image ACK, missing PCM or unreliable
 // audio cannot resume. Both supplies must cover 24 full fields beyond clock.
 assert(!r.ready({true, 812812, false}, 0, 960000, true, true));
 assert(!r.ready(full, 0, 960000, true, false));
 assert(!r.ready(full, 0, 812120, true, true));
 assert(!r.ready(full, 812121, 960000, true, true));
 assert(!r.ready(full, 0, 960000, false, true));
 assert(!r.ready({true, 836143, true}, 0, 960000, true, true));
 assert(r.ready(full, 0, 960000, true, true));
 assert(r.observe(2, 3, 10.2, true, 406060, 60000, 0, timeline) == SupplyObservation::Refilling);
 assert(r.observe(2, 3, 10.3, true, 812119, 120000, 0, timeline) == SupplyObservation::Invalid);
 assert(r.observe(2, 3, 10.3, true, 812121, 120000, 0, timeline) == SupplyObservation::Invalid);
 assert(r.observe(2, 4, 10.3, true, 812120, 120000, 0, timeline) == SupplyObservation::Invalid);
 assert(r.observe(4, 3, 10.3, true, 812120, 120000, 0, timeline) == SupplyObservation::Invalid);
 // Repeated state/volume/pause intents cannot renew the original deadline.
 assert(!r.begin(2, 3, 14.9, 812120, 120000));
 assert(r.observe(2, 3, 14.999, true, 812120, 120000, 0, timeline) == SupplyObservation::Refilling);
 assert(r.observe(2, 3, 15, true, 812120, 120000, 0, timeline) == SupplyObservation::Expired);
 // Seek/close cancellation is synchronous and does not await refill or ACK.
 r.cancel(); assert(!r.active() && !r.stopped());
 assert(!r.ready(full, 0, 960000, true, true));
 assert(r.begin(3, 4, 20, 2002000, 120000));
 assert(r.observe(3, 4, 20.1, true, 2002000, 120000, 0, timeline) == SupplyObservation::Refilling);
 r.cancel(); r.resetBudget();
 // Stop never acknowledged / invalid clock / end outside qualified source.
 assert(r.begin(4, 5, 30, 1001, 120000));
 assert(r.observe(4, 5, 35, true, 5005, 120000, 1, timeline) == SupplyObservation::Expired);
 assert(r.observe(4, 5, 31, false, 5005, 120000, 0, timeline) == SupplyObservation::Invalid);
 assert(r.observe(4, 5, 31, true, 5005, 0, 0, timeline) == SupplyObservation::Invalid);
 assert(r.observe(4, 5, 31, true, 12012000, 120000, 0, timeline) == SupplyObservation::Invalid);
 assert(r.observe(4, 5, 31, true, 5005, 120000, std::numeric_limits<double>::quiet_NaN(), timeline) == SupplyObservation::Invalid);
 r.cancel(); r.resetBudget();
 assert(r.begin(1, 1, 40, 1001, 120000));
 r.finish(42);
 assert(r.begin(1, 1, 45, 2002, 120000));
 r.resetBudget(); // even a user command cannot extend an active episode
 assert(r.observe(1, 1, 48, true, 2002, 120000, 0, timeline) == SupplyObservation::Expired);
 r.finish(48);
 assert(!r.begin(1, 1, 50, 3003, 120000));
 r.resetBudget();
 assert(r.begin(1, 2, 51, 4004, 120000)); r.finish(51.1);
 assert(r.begin(1, 2, 52, 5005, 120000)); r.finish(52.1);
 assert(!r.begin(1, 2, 53, 6006, 120000)); // two short episodes also bounded
 r.resetBudget();
 assert(r.begin(5, 6, 60, 1001, 120000));
 assert(r.observe(5, 6, 64.9, true, 1002, 120000, 0, timeline) == SupplyObservation::Refilling);
 assert(r.ready({true, 30030, true}, 0, 30030, true, true));
 // A refill at 4.9s must not buy a fresh five seconds for actual rate=1 ACK.
 ProductStartAck lateStart;
 assert(lateStart.begin({true, 1002.0 / 120000, 0}, r.began()));
 r.finish(64.9);
 assert(lateStart.observe(64.99, {true, 1002.0 / 120000, 0}) == StartObservation::Waiting);
 assert(lateStart.observe(65, {true, 1003.0 / 120000, 1}) == StartObservation::Expired);
}
