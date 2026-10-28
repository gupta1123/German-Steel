"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminRemovalAccess } from "@/components/admin-removal-action";

type Confirmation = { title: string; description: string; label?: string };
const Context = createContext<((options: Confirmation) => Promise<boolean>) | null>(null);

export function RemovalConfirmationProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<Confirmation | null>(null);
  const resolve = useRef<((confirmed: boolean) => void) | null>(null);
  const finish = useCallback((confirmed: boolean) => {
    const pending = resolve.current;
    resolve.current = null;
    setOptions(null);
    pending?.(confirmed);
  }, []);
  const confirm = useCallback((next: Confirmation) => new Promise<boolean>((done) => {
    resolve.current?.(false);
    resolve.current = done;
    setOptions(next);
  }), []);
  useEffect(() => () => { resolve.current?.(false); }, []);
  return <Context.Provider value={confirm}>
    {children}
    <Dialog open={options !== null} onOpenChange={(open) => { if (!open) finish(false); }}>
      <DialogContent><DialogHeader><DialogTitle>{options?.title}</DialogTitle><DialogDescription>{options?.description}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => finish(false)}>Keep record</Button><Button variant="destructive" onClick={() => finish(true)}>{options?.label ?? "Confirm removal"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Context.Provider>;
}

export function useRemovalConfirmation() {
  const confirm = useContext(Context);
  const allowed = useAdminRemovalAccess();
  if (!confirm) throw new Error("RemovalConfirmationProvider is required");
  return (options: Confirmation) => allowed ? confirm(options) : Promise.resolve(false);
}
