#pragma once
#include <exception>
namespace diagnostic {
// true means handled, including failed/closing. A partially changed generation
// must never fall through to the cold-seek path after an allocation failure.
template<class Attempt,class Fail> bool guardBufferedSeek(Attempt&&attempt,Fail&&fail){
 try{return attempt();}catch(const std::exception&e){fail(e.what());return true;}catch(...){fail("unknown buffered seek failure");return true;}
}
}
