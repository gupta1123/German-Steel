"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes. If you leave this page, your changes will be lost. Leave without saving?";

interface UnsavedChangesContextValue {
  hasUnsavedChanges: boolean;
  setBlocker: (id: string, message: string | null) => void;
  requestNavigation: (action: () => void | Promise<void>) => void;
  requestConfirmation: (action: () => void | Promise<void>, message?: string) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

interface BrowserNavigation extends EventTarget {
  addEventListener(type: "navigate", listener: (event: BrowserNavigateEvent) => void): void;
  removeEventListener(type: "navigate", listener: (event: BrowserNavigateEvent) => void): void;
  traverseTo?(key: string): void;
}

interface BrowserNavigateEvent extends Event {
  canIntercept?: boolean;
  destination?: { url: string; key?: string };
  downloadRequest?: string | null;
  hashChange?: boolean;
}

const getBrowserNavigation = (): BrowserNavigation | null => {
  if (typeof window === "undefined") return null;
  return (window as Window & { navigation?: BrowserNavigation }).navigation ?? null;
};

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const blockersRef = useRef(new Map<string, string>());
  const allowNextNavigationRef = useRef(false);
  const allowResetTimerRef = useRef<number | null>(null);
  const previousPathnameRef = useRef(pathname);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const pendingActionAllowsNavigationRef = useRef(false);

  const syncBlockedState = useCallback(() => {
    setHasUnsavedChanges(blockersRef.current.size > 0);
  }, []);

  const setBlocker = useCallback((id: string, message: string | null) => {
    if (message) {
      blockersRef.current.set(id, message);
    } else {
      blockersRef.current.delete(id);
    }
    syncBlockedState();
  }, [syncBlockedState]);

  const allowNextNavigation = useCallback(() => {
    allowNextNavigationRef.current = true;
    if (allowResetTimerRef.current !== null) {
      window.clearTimeout(allowResetTimerRef.current);
    }
    allowResetTimerRef.current = window.setTimeout(() => {
      allowNextNavigationRef.current = false;
      allowResetTimerRef.current = null;
    }, 30_000);
  }, []);

  const requestConfirmation = useCallback((
    action: () => void | Promise<void>,
    message: string = UNSAVED_CHANGES_MESSAGE,
  ) => {
    pendingActionRef.current = action;
    pendingActionAllowsNavigationRef.current = false;
    setConfirmationMessage(message);
  }, []);

  const requestNavigation = useCallback((action: () => void | Promise<void>) => {
    if (blockersRef.current.size === 0) {
      void action();
      return;
    }

    pendingActionRef.current = action;
    pendingActionAllowsNavigationRef.current = true;
    setConfirmationMessage(
      blockersRef.current.values().next().value ?? UNSAVED_CHANGES_MESSAGE
    );
  }, []);

  const closeConfirmation = useCallback(() => {
    pendingActionRef.current = null;
    pendingActionAllowsNavigationRef.current = false;
    setConfirmationMessage(null);
  }, []);

  const confirmPendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    const allowsNavigation = pendingActionAllowsNavigationRef.current;
    pendingActionRef.current = null;
    pendingActionAllowsNavigationRef.current = false;
    setConfirmationMessage(null);
    if (!action) return;
    if (allowsNavigation) allowNextNavigation();
    void action();
  }, [allowNextNavigation]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const navigation = getBrowserNavigation();
    if (!navigation) return;

    const handleNavigate = (event: BrowserNavigateEvent) => {
      if (
        blockersRef.current.size === 0 ||
        event.downloadRequest ||
        event.canIntercept === false
      ) {
        return;
      }

      if (event.hashChange) {
        allowNextNavigationRef.current = false;
        if (allowResetTimerRef.current !== null) {
          window.clearTimeout(allowResetTimerRef.current);
          allowResetTimerRef.current = null;
        }
        return;
      }

      const destinationUrl = event.destination?.url;
      if (destinationUrl && destinationUrl === window.location.href) return;

      if (allowNextNavigationRef.current) {
        allowNextNavigationRef.current = false;
        if (allowResetTimerRef.current !== null) {
          window.clearTimeout(allowResetTimerRef.current);
          allowResetTimerRef.current = null;
        }
        return;
      }

      if (!event.cancelable) return;

      event.preventDefault();
      requestNavigation(() => {
        const destinationKey = event.destination?.key;
        if (destinationKey && navigation.traverseTo) {
          navigation.traverseTo(destinationKey);
          return;
        }
        if (destinationUrl) window.location.assign(destinationUrl);
      });
    };

    navigation.addEventListener("navigate", handleNavigate);
    return () => navigation.removeEventListener("navigate", handleNavigate);
  }, [requestNavigation]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    blockersRef.current.clear();
    closeConfirmation();
    allowNextNavigationRef.current = false;
    if (allowResetTimerRef.current !== null) {
      window.clearTimeout(allowResetTimerRef.current);
      allowResetTimerRef.current = null;
    }
    syncBlockedState();
  }, [closeConfirmation, pathname, syncBlockedState]);

  const value = useMemo<UnsavedChangesContextValue>(() => ({
    hasUnsavedChanges,
    setBlocker,
    requestNavigation,
    requestConfirmation,
  }), [hasUnsavedChanges, requestConfirmation, requestNavigation, setBlocker]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <Dialog
        open={confirmationMessage !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirmation();
        }}
      >
        <DialogContent showCloseButton={false} className="z-[70] sm:max-w-md">
          <DialogHeader className="gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {confirmationMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 sm:justify-end">
            <Button variant="outline" onClick={closeConfirmation}>
              Keep Editing
            </Button>
            <Button onClick={confirmPendingAction}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
}

const useUnsavedChangesContext = () => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("Unsaved changes helpers must be used inside UnsavedChangesProvider.");
  }
  return context;
};

export function useUnsavedChanges(
  isDirty: boolean,
  message: string = UNSAVED_CHANGES_MESSAGE,
) {
  const id = useId();
  const { setBlocker, requestConfirmation } = useUnsavedChangesContext();
  const discardInProgressRef = useRef(false);

  useEffect(() => {
    setBlocker(id, isDirty ? message : null);
    return () => setBlocker(id, null);
  }, [id, isDirty, message, setBlocker]);

  const markSaved = useCallback(() => {
    setBlocker(id, null);
  }, [id, setBlocker]);

  const requestDiscard = useCallback((
    action: () => void | Promise<void>,
    shouldConfirm = isDirty,
  ) => {
    if (discardInProgressRef.current || !shouldConfirm) {
      void action();
      return;
    }
    requestConfirmation(() => {
      discardInProgressRef.current = true;
      setBlocker(id, null);
      try {
        const result = action();
        void Promise.resolve(result).finally(() => {
          window.setTimeout(() => {
            discardInProgressRef.current = false;
          }, 0);
        });
      } catch (error) {
        discardInProgressRef.current = false;
        throw error;
      }
    }, message);
  }, [id, isDirty, message, requestConfirmation, setBlocker]);

  return { markSaved, requestDiscard };
}

export function useNavigationGuard() {
  const { requestNavigation, requestConfirmation, hasUnsavedChanges } = useUnsavedChangesContext();
  return { requestNavigation, requestConfirmation, hasUnsavedChanges };
}

export function useGuardedRouter() {
  const router = useRouter();
  const { requestNavigation } = useNavigationGuard();

  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => {
      requestNavigation(() => router.push(...args));
    },
    replace: (...args: Parameters<typeof router.replace>) => {
      requestNavigation(() => router.replace(...args));
    },
    back: () => {
      requestNavigation(() => router.back());
    },
    forward: () => {
      requestNavigation(() => router.forward());
    },
  }), [requestNavigation, router]);
}
