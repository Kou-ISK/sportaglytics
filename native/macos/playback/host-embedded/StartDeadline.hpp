#pragma once
#include <cmath>
#include <stdexcept>
namespace diagnostic {inline bool startAckInTime(double now,double sent,double began){return std::isfinite(now)&&std::isfinite(sent)&&std::isfinite(began)&&sent>=began&&now>=sent&&now-sent<=5&&now-began<=90;}
class StartAckDeadline {bool pending_=false;double sent_=0,began_=0;
public:
 void begin(double sent,double began){if(pending_)throw std::logic_error("overlapping start ACK");pending_=true;sent_=sent;began_=began;}
 bool pending()const{return pending_;}
 bool expired(double now)const{return pending_&&!startAckInTime(now,sent_,began_);}
 bool accept(double now){if(!pending_||expired(now))return false;pending_=false;return true;}
};}

