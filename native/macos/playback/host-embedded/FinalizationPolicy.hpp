#pragma once
#include <stdexcept>
namespace diagnostic {
class Finalization {
 enum Phase{Idle,Candidate,Receipt,Done};Phase phase_=Idle;double since_=0;bool failed_=false;
public:
 void begin(double now){if(phase_!=Idle)throw std::logic_error("duplicate finalization");phase_=Candidate;since_=now;}
 void cancel(){failed_=true;}
 void tick(double now){if((phase_==Candidate||phase_==Receipt)&&now-since_>2)failed_=true;}
 void candidateCompleted(bool saved,double now){if(phase_!=Candidate)throw std::logic_error("unowned candidate completion");tick(now);if(!saved)failed_=true;phase_=Receipt;since_=now;}
 void receiptCompleted(bool written,double now){if(phase_!=Receipt)throw std::logic_error("unowned receipt completion");tick(now);if(!written)failed_=true;phase_=Done;}
 bool ownsIO()const{return phase_==Candidate||phase_==Receipt;}
 bool failed()const{return failed_;}
 bool admitted()const{return phase_==Done&&!failed_;}
};
}
