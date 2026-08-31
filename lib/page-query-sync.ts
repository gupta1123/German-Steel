let syncDepth = 0;

export const isPageQuerySyncInProgress = () => syncDepth > 0;

/** Update list filters without navigating away from the mounted form. */
export function syncPageQuery(
  href: string,
  browser: Pick<Window, 'location' | 'history'> = window,
) {
  const current = new URL(browser.location.href);
  const next = new URL(href, current);
  if (next.origin !== current.origin || next.pathname !== current.pathname || next.hash !== current.hash) {
    throw new Error('Query synchronization must stay on the current page.');
  }
  if (next.href === current.href) return;

  // The native navigate event fires synchronously inside replaceState. Only this
  // explicit, query-only update bypasses the guard; Back and real navigation do not.
  syncDepth += 1;
  try {
    browser.history.replaceState(null, '', next.href);
  } finally {
    syncDepth -= 1;
  }
}
