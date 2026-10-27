#pragma once
#include <atomic>
#include <cstdint>
#include <string>
#include <vector>
namespace finiteaac {
struct Side {int type;size_t size;uint32_t head=0,tail=0;uint8_t headReason=0,tailReason=0;};
struct Packet {int64_t pts,dts,duration;int flags;std::vector<uint8_t> bytes;std::vector<Side> side;};
struct Track {int id,initialPadding,trailingPadding,seekPreroll,frameSize;int64_t startTime,duration;std::vector<uint8_t>extra;std::vector<Packet>packets;};
struct Result {std::vector<Track> tracks;uint64_t ioBytes=0,packetBytes=0;double seconds=0;int closeAttempts=0,closeStatus=0,sourceIOError=0;};
Result read(const std::string&source,int64_t start,int64_t end,std::atomic<bool>&cancel,int64_t sourceEnd,double deadline);
}
