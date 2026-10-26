#include <assert.h>
#include <pthread.h>
#include <pthread/qos.h>
#include "../native-playback/FilterThreadQoS.h"

typedef struct { qos_class_t qos; int priority; } Observation;
static void *observe(void *data) {
    Observation *value = data;
    assert(pthread_get_qos_class_np(pthread_self(), &value->qos, &value->priority) == 0);
    return NULL;
}
int main(void) {
    /* No process/OS override: exercise requested QoS on this owned test thread. */
    assert(pthread_set_qos_class_self_np(QOS_CLASS_USER_INITIATED, -3) == 0);
    Observation parent = {0}, inherited = {0}, ordinary = {0};
    observe(&parent);
    assert(parent.qos == QOS_CLASS_USER_INITIATED && parent.priority == -3);
    pthread_t worker;
    assert(pthread_create(&worker, NULL, observe, &ordinary) == 0);
    assert(pthread_join(worker, NULL) == 0);
    assert(ordinary.qos != parent.qos || ordinary.priority != parent.priority);
    assert(playback_create_filter_thread(&worker, observe, &inherited) == 0);
    assert(pthread_join(worker, NULL) == 0);
    assert(inherited.qos == parent.qos && inherited.priority == parent.priority);
    return 0;
}
