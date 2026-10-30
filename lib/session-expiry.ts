// Browsers coerce larger setTimeout delays to 1 ms, which can immediately
// log out a newly signed-in user with a long-lived token.
export const MAX_SESSION_TIMER_DELAY = 2_147_483_647;

export function scheduleSessionExpiry(expiresAtMs: number, onExpire: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const check = () => {
    if (cancelled) return;
    const remaining = expiresAtMs - Date.now();
    if (remaining <= 0) {
      onExpire();
      return;
    }
    timer = setTimeout(check, Math.min(remaining, MAX_SESSION_TIMER_DELAY));
  };
  check();
  return () => {
    cancelled = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}
