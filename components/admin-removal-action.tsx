"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { hasAdminSetupPrivileges } from "@/lib/auth";
import { removeRecord } from "@/lib/removal-api";
import { hasAdminRemovalRole, removalReference } from "@/lib/admin-removals-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  endpoint: string;
  label?: string;
  name: string;
  description: string;
  method?: "DELETE" | "POST";
  reasonField?: string;
  disabled?: boolean;
  compact?: boolean;
  onRemoved: () => void | Promise<unknown>;
};

export function useAdminRemovalAccess() {
  const { userRole, currentUser, isLoading } = useAuth();
  return !isLoading && hasAdminSetupPrivileges(userRole, currentUser);
}

/** Only exposes removal contracts implemented by the backend. Permissions are
 * also enforced by the API; this check controls the web presentation. */
export function AdminRemovalAction({ endpoint, label = "Archive", name, description, method = "DELETE", reasonField, disabled, compact = true, onRemoved }: Props) {
  const { token, userRole, currentUser, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const isAdminEndpoint = endpoint.startsWith('/api/admin/');
  const requiredReasonField = isAdminEndpoint ? 'reason' : reasonField;
  const allowed = !isLoading && (isAdminEndpoint ? hasAdminRemovalRole(userRole, currentUser) : hasAdminSetupPrivileges(userRole, currentUser));
  if (!allowed) return null;

  const submit = async () => {
    if (!token || !allowed || disabled || inFlight.current || (requiredReasonField && !reason.trim())) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await removeRecord(token, endpoint, { method, reasonField: requiredReasonField, reason });
      const reference = removalReference(endpoint);
      if (reference) window.dispatchEvent(new CustomEvent('admin-record-removed', { detail: { ...reference, name } }));
      setOpen(false);
      setReason("");
      toast.success(`${label} completed.`);
      try { await onRemoved(); } catch { toast.error("The action succeeded, but the list could not refresh. Please reload the page."); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return <>
    <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-destructive hover:text-destructive" disabled={disabled || busy} aria-label={`${label} ${name}`} title={`${label} ${name}`} onClick={(event) => { event.stopPropagation(); setError(null); setReason(""); setOpen(true); }}>
      <Trash2 className="h-3.5 w-3.5" />{!compact && label}
    </Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogHeader><DialogTitle>{label} this record?</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <p className="break-words rounded-md border bg-muted/40 p-3 text-sm font-medium">{name}</p>
        {requiredReasonField && <div className="space-y-2"><Label>Reason (required)<Textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} maxLength={500} placeholder="Explain why this record should be removed" /></Label><p className="text-xs text-muted-foreground">{reason.length}/500 characters</p></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep record</Button><Button variant="destructive" disabled={busy || !token || Boolean(requiredReasonField && !reason.trim())} onClick={() => void submit()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{label}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
