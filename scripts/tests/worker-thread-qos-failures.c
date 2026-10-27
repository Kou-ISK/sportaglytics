#include <assert.h>
#include <errno.h>
#include <pthread.h>
#include <pthread/qos.h>

static int get_error, init_error, set_error, create_error, destroy_error;
static int initialized, configured, created, destroyed, plain;
static qos_class_t requested;
static int relative;
static int fake_get(pthread_t thread, qos_class_t *qos, int *priority) {
    (void)thread; *qos = requested; *priority = relative; return get_error;
}
static int fake_init(pthread_attr_t *attributes) {
    (void)attributes; initialized++; return init_error;
}
static int fake_set(pthread_attr_t *attributes, qos_class_t qos, int priority) {
    (void)attributes; configured++;
    assert(qos == requested && priority == relative); return set_error;
}
static int fake_create(pthread_t *thread, const pthread_attr_t *attributes,
                       void *(*start)(void *), void *argument) {
    (void)thread; (void)start; (void)argument;
    created++; plain += attributes == NULL; return create_error;
}
static int fake_destroy(pthread_attr_t *attributes) {
    (void)attributes; destroyed++; return destroy_error;
}
#define pthread_get_qos_class_np fake_get
#define pthread_attr_init fake_init
#define pthread_attr_set_qos_class_np fake_set
#define pthread_create fake_create
#define pthread_attr_destroy fake_destroy
#include "../native-playback/WorkerThreadQoS.h"

static void reset(void) {
    get_error = init_error = set_error = create_error = destroy_error = 0;
    initialized = configured = created = destroyed = plain = 0;
    requested = QOS_CLASS_USER_INITIATED; relative = -3;
}
static int create(void) {
    pthread_t thread; return playback_create_worker_thread(&thread, NULL, NULL);
}
int main(void) {
    reset(); get_error = ESRCH;
    assert(create() == ESRCH && initialized == 0 && created == 0);
    reset(); relative = 1;
    assert(create() == EINVAL && initialized == 0 && created == 0);
    reset(); relative = QOS_MIN_RELATIVE_PRIORITY - 1;
    assert(create() == EINVAL && initialized == 0 && created == 0);
    reset(); init_error = ENOMEM;
    assert(create() == ENOMEM && configured == 0 && created == 0 && destroyed == 0);
    reset(); set_error = EINVAL;
    assert(create() == EINVAL && created == 0 && destroyed == 1);
    reset(); create_error = EAGAIN;
    assert(create() == EAGAIN && created == 1 && destroyed == 1);
    reset(); destroy_error = EINVAL;
    assert(create() == 0 && created == 1 && destroyed == 1 && plain == 0);
    reset(); requested = QOS_CLASS_UNSPECIFIED;
    assert(create() == 0 && created == 1 && plain == 1 && initialized == 0 && destroyed == 0);
    return 0;
}
