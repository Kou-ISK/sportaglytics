#include <node_api.h>
#include <utility>
#include <initializer_list>
#include <cstring>
#import <AppKit/AppKit.h>
namespace {
id monitor=nil; napi_ref callback=nullptr; napi_env env=nullptr; bool hookInstalled=false,faulted=false; uint64_t serial=0,gesture=0,active=0,faultGesture=0,faultSerial=0; int32_t faultWindow=0; __weak NSWindow* downWindow=nil;
napi_value empty(napi_env e){napi_value v;napi_get_undefined(e,&v);return v;}
void cleanup(void* owner) { if(owner && owner!=env)return; if(monitor){[NSEvent removeMonitor:monitor];monitor=nil;} if(env&&callback){napi_delete_reference(env,callback);callback=nullptr;} env=nullptr;hookInstalled=false;active=0;downWindow=nil; }
bool mainThread(napi_env e){if([NSThread isMainThread])return true;napi_throw_error(e,nullptr,"LOCAL_MONITOR_WRONG_THREAD");return false;}
void send(const char* phase,uint64_t id,NSEvent* event){
 if(!callback||!env)return; napi_env currentEnv=env; napi_ref currentCallback=callback;
 const int32_t windowNumber=(int32_t)(event.window ?: downWindow).windowNumber;
 const auto latch=[&](){faulted=true;faultGesture=id;faultSerial=serial;faultWindow=windowNumber;active=0;downWindow=nil;};
 napi_handle_scope scope;if(napi_open_handle_scope(currentEnv,&scope)!=napi_ok){latch();return;}
 const bool delivered=[&](){
  napi_value cb,global,arg,v,ignored;
  if(napi_get_reference_value(currentEnv,currentCallback,&cb)!=napi_ok ||
     napi_get_global(currentEnv,&global)!=napi_ok || napi_create_object(currentEnv,&arg)!=napi_ok ||
     napi_create_string_utf8(currentEnv,phase,NAPI_AUTO_LENGTH,&v)!=napi_ok ||
     napi_set_named_property(currentEnv,arg,"phase",v)!=napi_ok ||
     napi_create_double(currentEnv,(double)id,&v)!=napi_ok ||
     napi_set_named_property(currentEnv,arg,"gesture",v)!=napi_ok ||
     napi_create_double(currentEnv,(double)++serial,&v)!=napi_ok ||
     napi_set_named_property(currentEnv,arg,"serial",v)!=napi_ok ||
     napi_create_int32(currentEnv,windowNumber,&v)!=napi_ok ||
     napi_set_named_property(currentEnv,arg,"windowNumber",v)!=napi_ok)return false;
  const auto flags=event.modifierFlags;
  for(auto pair : {std::pair<const char*,NSEventModifierFlags>{"meta",NSEventModifierFlagCommand},{"shift",NSEventModifierFlagShift},{"alt",NSEventModifierFlagOption},{"control",NSEventModifierFlagControl}})
   if(napi_get_boolean(currentEnv,(flags & pair.second)!=0,&v)!=napi_ok ||
      napi_set_named_property(currentEnv,arg,pair.first,v)!=napi_ok)return false;
  // Main must synchronously acknowledge delivery. A Promise, undefined, false,
  // or an exception is a fault; asynchronous rejection cannot be observed here.
  bool acknowledged=false;
  return napi_call_function(currentEnv,global,cb,1,&arg,&ignored)==napi_ok &&
    napi_get_value_bool(currentEnv,ignored,&acknowledged)==napi_ok && acknowledged;
 }();
 if(!delivered){bool pending=false;napi_value ignored;if(napi_is_exception_pending(currentEnv,&pending)==napi_ok && pending)napi_get_and_clear_last_exception(currentEnv,&ignored);latch();}
 if(napi_close_handle_scope(currentEnv,scope)!=napi_ok)latch();
}
napi_value start(napi_env e,napi_callback_info info){if(!mainThread(e))return nullptr;size_t n=1;napi_value argv[1];napi_get_cb_info(e,info,&n,argv,nullptr,nullptr);napi_valuetype t;if(faulted||n!=1||napi_typeof(e,argv[0],&t)!=napi_ok||t!=napi_function||monitor||env){napi_throw_error(e,nullptr,"LOCAL_MONITOR_INVALID");return nullptr;}env=e;if(napi_create_reference(e,argv[0],1,&callback)!=napi_ok){env=nullptr;napi_throw_error(e,nullptr,"LOCAL_MONITOR_INVALID");return nullptr;}
 monitor=[NSEvent addLocalMonitorForEventsMatchingMask:(NSEventMaskKeyDown|NSEventMaskKeyUp|NSEventMaskFlagsChanged) handler:^NSEvent*(NSEvent* event){
  if(faulted||![NSApp isActive])return event;
  if(event.type==NSEventTypeFlagsChanged){NSWindow* window=event.window ?: NSApp.keyWindow;if(active && downWindow==window && !(event.modifierFlags & NSEventModifierFlagCommand)){uint64_t id=active;send("cancel",id,event);active=0;downWindow=nil;}return event;}
  if(!event.window||event.window!=NSApp.keyWindow)return event;
  if(event.keyCode!=123)return event;
  if(event.type==NSEventTypeKeyDown){if(event.isARepeat || !(event.modifierFlags & NSEventModifierFlagCommand))return event;active=++gesture;downWindow=event.window;send("down",active,event);}
  else if(event.type==NSEventTypeKeyUp && active && downWindow==event.window){uint64_t id=active;active=0;downWindow=nil;send("up",id,event);}return event;
 }];
 if(!monitor){cleanup(nullptr);napi_throw_error(e,nullptr,"LOCAL_MONITOR_UNAVAILABLE");return nullptr;}if(napi_add_env_cleanup_hook(e,cleanup,e)!=napi_ok){cleanup(nullptr);napi_throw_error(e,nullptr,"LOCAL_MONITOR_CLEANUP_UNAVAILABLE");return nullptr;}hookInstalled=true;return empty(e);}
napi_value matchesWindow(napi_env e,napi_callback_info info){if(!mainThread(e))return nullptr;if(env!=e){napi_throw_error(e,nullptr,"LOCAL_MONITOR_WRONG_OWNER");return nullptr;}size_t n=2;napi_value a[2],v;void* bytes=nullptr;size_t len=0;int32_t number=0;napi_get_cb_info(e,info,&n,a,nullptr,nullptr);bool ok=false;if(n==2 && napi_get_buffer_info(e,a[0],&bytes,&len)==napi_ok && len==sizeof(void*) && napi_get_value_int32(e,a[1],&number)==napi_ok){void* ptr=nullptr;memcpy(&ptr,bytes,sizeof(ptr));NSView* view=(__bridge NSView*)ptr;ok=view && view.window && view.window.windowNumber==number;}napi_get_boolean(e,ok,&v);return v;}
napi_value health(napi_env e,napi_callback_info){if(!mainThread(e))return nullptr;if(env!=e){napi_throw_error(e,nullptr,"LOCAL_MONITOR_WRONG_OWNER");return nullptr;}napi_value result,value;if(napi_create_object(e,&result)!=napi_ok || napi_get_boolean(e,faulted,&value)!=napi_ok || napi_set_named_property(e,result,"faulted",value)!=napi_ok || napi_create_double(e,(double)faultSerial,&value)!=napi_ok || napi_set_named_property(e,result,"faultSerial",value)!=napi_ok || napi_create_double(e,(double)faultGesture,&value)!=napi_ok || napi_set_named_property(e,result,"faultGesture",value)!=napi_ok || napi_create_int32(e,faultWindow,&value)!=napi_ok || napi_set_named_property(e,result,"faultWindow",value)!=napi_ok)return nullptr;return result;}
napi_value reset(napi_env e,napi_callback_info){if(!mainThread(e))return nullptr;if(env!=e){napi_throw_error(e,nullptr,"LOCAL_MONITOR_WRONG_OWNER");return nullptr;}if(faulted){napi_throw_error(e,nullptr,"LOCAL_MONITOR_FAULTED");return nullptr;}active=0;downWindow=nil;napi_value watermark;if(napi_create_double(e,(double)serial,&watermark)!=napi_ok)return nullptr;return watermark;} napi_value stop(napi_env e,napi_callback_info){if(!mainThread(e))return nullptr;if(env!=e){napi_throw_error(e,nullptr,"LOCAL_MONITOR_WRONG_OWNER");return nullptr;}if(hookInstalled && napi_remove_env_cleanup_hook(e,cleanup,e)!=napi_ok){napi_throw_error(e,nullptr,"LOCAL_MONITOR_CLEANUP_UNAVAILABLE");return nullptr;}hookInstalled=false;cleanup(nullptr);return empty(e);}
#ifdef COMMAND_LEFT_TEST
napi_value injectSynthetic(napi_env e,napi_callback_info){if(!mainThread(e)||env!=e)return nullptr;
 NSEvent* event=[NSEvent keyEventWithType:NSEventTypeKeyDown location:NSZeroPoint
   modifierFlags:NSEventModifierFlagCommand timestamp:0 windowNumber:1 context:nil
   characters:@"" charactersIgnoringModifiers:@"" isARepeat:NO keyCode:123];
 if(!event){napi_throw_error(e,nullptr,"LOCAL_TEST_EVENT_UNAVAILABLE");return nullptr;}
 send("down",++gesture,event);return empty(e);}
#endif
napi_value init(napi_env e,napi_value exports){napi_property_descriptor p[]={{"start",0,start,0,0,0,napi_default,0},{"reset",0,reset,0,0,0,napi_default,0},{"health",0,health,0,0,0,napi_default,0},{"matchesWindow",0,matchesWindow,0,0,0,napi_default,0},{"stop",0,stop,0,0,0,napi_default,0}
#ifdef COMMAND_LEFT_TEST
 ,{"injectSynthetic",0,injectSynthetic,0,0,0,napi_default,0}
#endif
 };napi_define_properties(e,exports,sizeof(p)/sizeof(p[0]),p);return exports;}
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
