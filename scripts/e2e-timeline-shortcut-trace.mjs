/** Bounded synthetic-fixture diagnostics; no media, package paths or input text. */
export const startTimelineShortcutTrace = (page) =>
  page.evaluateHandle(() => {
    const events = [];
    const describe = (target) =>
      target instanceof Element
        ? {
            tag: target.tagName,
            role: target.getAttribute('role'),
            testId: target.getAttribute('data-testid'),
            insideTimeline: Boolean(
              target.closest('[role="region"][aria-label="タイムライン"]'),
            ),
          }
        : null;
    const record = (type, detail = {}) => {
      events.push({
        time: Math.round(performance.now()),
        type,
        ...detail,
        active: describe(document.activeElement),
        documentFocused: document.hasFocus(),
        menuCount: document.querySelectorAll('[role="menu"]').length,
        selectedIds: [
          ...document.querySelectorAll(
            '[data-timeline-item-id][aria-pressed="true"]',
          ),
        ]
          .slice(0, 16)
          .map((element) => element.getAttribute('data-timeline-item-id')),
      });
      if (events.length > 100) events.shift();
    };
    const focus = (event) =>
      record(event.type, { target: describe(event.target) });
    const key = (event) => {
      if (!['a', 'z', 'Escape', 'Backspace', 'Delete'].includes(event.key))
        return;
      record(
        `keydown-${event.eventPhase === Event.CAPTURING_PHASE ? 'capture' : 'bubble'}`,
        {
          key: event.key,
          meta: event.metaKey,
          control: event.ctrlKey,
          prevented: event.defaultPrevented,
          target: describe(event.target),
        },
      );
      if (event.eventPhase === Event.CAPTURING_PHASE)
        queueMicrotask(() =>
          record('after-keydown', { prevented: event.defaultPrevented }),
        );
    };
    document.addEventListener('focusin', focus, true);
    document.addEventListener('focusout', focus, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('keydown', key);
    const observer = new MutationObserver(() => record('selection-dom'));
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-pressed'],
    });
    record('start');
    return {
      events,
      mark: record,
      stop: () => {
        observer.disconnect();
        document.removeEventListener('focusin', focus, true);
        document.removeEventListener('focusout', focus, true);
        document.removeEventListener('keydown', key, true);
        document.removeEventListener('keydown', key);
      },
    };
  });
