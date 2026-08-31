/** Move browser-event work out of React's current commit; keep only the latest request. */
export function createDeferredAction() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    cancel,
    schedule(action: () => void) {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        action();
      }, 0);
    },
  };
}
