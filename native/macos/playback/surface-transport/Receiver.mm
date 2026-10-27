#include <node_api.h>
#include <IOSurface/IOSurface.h>
#include <servers/bootstrap.h>
#include <map>
#include <string>
#include <cmath>
#include "SurfaceWire.hpp"
namespace {
struct Held { IOSurfaceRef surface; mach_port_t reply; bool drawn=false; };
mach_port_t receiver=MACH_PORT_NULL,demandPort=MACH_PORT_NULL;pid_t peer=0;std::map<uint64_t,Held> held;
uint64_t lastID=0;
napi_value fail(napi_env e,const char* message){napi_throw_error(e,nullptr,message);return nullptr;}
napi_value nullValue(napi_env e){napi_value v;napi_get_null(e,&v);return v;}
void number(napi_env e,napi_value o,const char* key,double v){napi_value n;napi_create_double(e,v,&n);napi_set_named_property(e,o,key,n);}
bool getID(napi_env e,napi_callback_info info,uint64_t& id){size_t count=1;napi_value a;double value=0;napi_get_cb_info(e,info,&count,&a,nullptr,nullptr);if(count!=1||napi_get_value_double(e,a,&value)!=napi_ok||!std::isfinite(value)||value<1||value>9007199254740991.0||value!=uint64_t(value))return false;id=uint64_t(value);return true;}
napi_value open(napi_env e,napi_callback_info info){
 if(receiver)return fail(e,"receiver already open");size_t count=1,n=0;napi_value a;napi_get_cb_info(e,info,&count,&a,nullptr,nullptr);
 char name[128];if(count!=1||napi_get_value_string_utf8(e,a,name,sizeof(name),&n)!=napi_ok||n<36||n>=sizeof(name)-1||strncmp(name,"local.sportaglytics.surface.",27))return fail(e,"invalid diagnostic service");
 kern_return_t r=mach_port_allocate(mach_task_self(),MACH_PORT_RIGHT_RECEIVE,&receiver);
 if(r==KERN_SUCCESS)r=mach_port_insert_right(mach_task_self(),receiver,receiver,MACH_MSG_TYPE_MAKE_SEND);
 if(r==KERN_SUCCESS)r=bootstrap_register(bootstrap_port,name,receiver);
 if(r!=KERN_SUCCESS){if(receiver)mach_port_mod_refs(mach_task_self(),receiver,MACH_PORT_RIGHT_RECEIVE,-1);receiver=0;return fail(e,"Mach receiver registration failed");}
 return nullValue(e);
}
napi_value setPeer(napi_env e,napi_callback_info info){uint64_t p;if(!getID(e,info,p)||p>INT32_MAX||peer)return fail(e,"invalid peer");peer=pid_t(p);return nullValue(e);}
napi_value poll(napi_env e,napi_callback_info){
 if(!receiver||!peer)return nullValue(e);surfacewire::Receive<surfacewire::FrameMessage> b{};
 auto r=mach_msg(&b.message.header,surfacewire::receiveOptions(),0,sizeof(b),receiver,0,MACH_PORT_NULL);
 if(r==MACH_RCV_TIMED_OUT)return nullValue(e);if(r!=KERN_SUCCESS)return fail(e,"Mach receive failed");auto& m=b.message;
 if(!surfacewire::fromPeer(&m.header,sizeof(m),peer)||m.header.msgh_id!=surfacewire::Frame||!(m.header.msgh_bits&MACH_MSGH_BITS_COMPLEX)||m.body.msgh_descriptor_count!=2||m.surface.type!=MACH_MSG_PORT_DESCRIPTOR||m.reply.type!=MACH_MSG_PORT_DESCRIPTOR||m.surface.disposition!=MACH_MSG_TYPE_PORT_SEND||m.reply.disposition!=MACH_MSG_TYPE_PORT_SEND||!m.id||m.id<=lastID||m.id>9007199254740991ULL||!m.generation||m.generation>9007199254740991ULL||!m.seek||m.seek>9007199254740991ULL||m.pts>9007199254740991ULL||held.size()>=surfacewire::Limit){mach_msg_destroy(&m.header);return fail(e,"unauthorized or invalid surface packet");}
 IOSurfaceRef surface=IOSurfaceLookupFromMachPort(m.surface.name);mach_port_deallocate(mach_task_self(),m.surface.name);m.surface.name=0;
 if(!surface||IOSurfaceGetWidth(surface)!=1920||IOSurfaceGetHeight(surface)!=1080||IOSurfaceGetPixelFormat(surface)!='420v'||IOSurfaceGetPlaneCount(surface)!=2){if(surface)CFRelease(surface);mach_msg_destroy(&m.header);return fail(e,"unexpected surface layout");}
 if(!demandPort){if(mach_port_mod_refs(mach_task_self(),m.reply.name,MACH_PORT_RIGHT_SEND,1)!=KERN_SUCCESS){CFRelease(surface);mach_msg_destroy(&m.header);return fail(e,"retain demand channel failed");}demandPort=m.reply.name;}
 held.emplace(m.id,Held{surface,m.reply.name});lastID=m.id;m.reply.name=0;
 napi_value out,buffer;napi_create_object(e,&out);napi_create_buffer_copy(e,sizeof(surface),&surface,nullptr,&buffer);napi_set_named_property(e,out,"handle",buffer);
 number(e,out,"id",m.id);number(e,out,"generation",m.generation);number(e,out,"seekId",m.seek);number(e,out,"pts",m.pts);number(e,out,"surfaceID",IOSurfaceGetID(surface));return out;
}
napi_value drawn(napi_env e,napi_callback_info info){uint64_t id;if(!getID(e,info,id)||!held.count(id))return fail(e,"unknown draw");auto& h=held.at(id);if(h.drawn)return fail(e,"duplicate draw");if(surfacewire::reply(h.reply,id,surfacewire::Drawn)!=KERN_SUCCESS)return fail(e,"draw reply failed");h.drawn=true;return nullValue(e);}
napi_value release(napi_env e,napi_callback_info info){uint64_t id;if(!getID(e,info,id)||!held.count(id))return fail(e,"unknown release");auto h=held.at(id);auto r=surfacewire::reply(h.reply,id,surfacewire::Released);if(r!=KERN_SUCCESS)return fail(e,"release reply uncertain; ownership retained");CFRelease(h.surface);mach_port_deallocate(mach_task_self(),h.reply);held.erase(id);if(r!=KERN_SUCCESS)return fail(e,"release reply failed");return nullValue(e);}
napi_value request(napi_env e,napi_callback_info){if(!demandPort)return nullValue(e);if(surfacewire::reply(demandPort,0,surfacewire::Request)!=KERN_SUCCESS)return fail(e,"demand request failed");return nullValue(e);}
napi_value close(napi_env e,napi_callback_info){if(!held.empty())return fail(e,"surface references still owned");if(receiver)mach_port_mod_refs(mach_task_self(),receiver,MACH_PORT_RIGHT_RECEIVE,-1);receiver=0;peer=0;lastID=0;if(demandPort)mach_port_deallocate(mach_task_self(),demandPort);demandPort=0;return nullValue(e);}
napi_value count(napi_env e,napi_callback_info){napi_value n;napi_create_uint32(e,held.size(),&n);return n;}
napi_value init(napi_env e,napi_value exports){napi_property_descriptor methods[]={{"open",0,open,0,0,0,napi_default,0},{"setPeer",0,setPeer,0,0,0,napi_default,0},{"poll",0,poll,0,0,0,napi_default,0},{"request",0,request,0,0,0,napi_default,0},{"drawn",0,drawn,0,0,0,napi_default,0},{"release",0,release,0,0,0,napi_default,0},{"close",0,close,0,0,0,napi_default,0},{"count",0,count,0,0,0,napi_default,0}};napi_define_properties(e,exports,sizeof(methods)/sizeof(methods[0]),methods);return exports;}
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
