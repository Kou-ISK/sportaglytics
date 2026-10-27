#ifndef SPORTAGLYTICS_WORKER_THREAD_QOS_H
#define SPORTAGLYTICS_WORKER_THREAD_QOS_H
#include <errno.h>
#include <pthread.h>
#if defined(__APPLE__)
#include <pthread/qos.h>
#endif

/* MIT, SporTagLytics. Only the owned filter and frame decoder pools use this factory.
 * Preserve the caller's requested class and relative priority; never use a
 * process-wide override or change worker count or codec computation. */
static inline int playback_create_worker_thread(
    pthread_t *thread, void *(*start)(void *), void *argument)
{
#if defined(__APPLE__)
    qos_class_t qos = QOS_CLASS_UNSPECIFIED;
    int priority = 0;
    int result = pthread_get_qos_class_np(pthread_self(), &qos, &priority);
    if (result) return result;
    if (qos == QOS_CLASS_UNSPECIFIED)
        return pthread_create(thread, NULL, start, argument);
    if (priority > 0 || priority < QOS_MIN_RELATIVE_PRIORITY) return EINVAL;
    pthread_attr_t attributes;
    result = pthread_attr_init(&attributes);
    if (result) return result;
    result = pthread_attr_set_qos_class_np(&attributes, qos, priority);
    if (!result) result = pthread_create(thread, &attributes, start, argument);
    /* A created worker is owned even if attribute destruction reports an
     * error. Reporting create failure here could free its live context. */
    (void)pthread_attr_destroy(&attributes);
    return result;
#else
    return pthread_create(thread, NULL, start, argument);
#endif
}
#endif
