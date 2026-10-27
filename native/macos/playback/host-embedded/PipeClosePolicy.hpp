#pragma once
#include <array>
#include <cstddef>
#include <stdexcept>
namespace diagnostic {
class PipeCloseLedger {
 enum class State{Absent,Owned,Closed,Unknown};std::array<State,3> states_{};
public:
 void own(size_t i){if(i>=3||states_[i]!=State::Absent)throw std::logic_error("pipe ownership");states_[i]=State::Owned;}
 void closed(size_t i){if(i>=3||states_[i]!=State::Owned)throw std::logic_error("unowned close");states_[i]=State::Closed;}
 void unknown(size_t i){if(i>=3||states_[i]!=State::Owned)throw std::logic_error("unowned uncertain close");states_[i]=State::Unknown;}
 bool confirmed()const{for(auto s:states_)if(s==State::Owned||s==State::Unknown)return false;return true;}
};}
