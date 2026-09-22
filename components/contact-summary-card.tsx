"use client";

import { Building2, Mail, Pencil, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ContactSummaryCardProps = {
  name: string;
  designation?: string | null;
  secondaryLine?: string | null;
  mobile?: string | null;
  email?: string | null;
  primary?: boolean;
  active?: boolean;
  onEdit?: () => void;
};

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CP";

export function ContactSummaryCard({ name, designation, secondaryLine, mobile, email, primary, active = true, onEdit }: ContactSummaryCardProps) {
  return (
    <article className="group rounded-lg border bg-background px-4 py-3.5 transition-colors hover:border-foreground/20">
      <div className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground ring-1 ring-border">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground" title={name}>{name}</h3>
            {primary && <Badge className="h-5 px-1.5 text-[10px]">Primary</Badge>}
            {!active && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Inactive</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{designation || "Designation not added"}</p>
          {secondaryLine && (
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate" title={secondaryLine}>{secondaryLine}</span>
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {mobile ? <a href={`tel:${mobile}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:underline"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{mobile}</a> : null}
            {email ? <a href={`mailto:${email}`} className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-foreground hover:underline"><Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{email}</span></a> : null}
            {!mobile && !email && <span className="text-xs text-muted-foreground">No contact details added</span>}
          </div>
        </div>
        {onEdit && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={onEdit} aria-label={`Edit ${name}`} title="Edit contact"><Pencil className="h-3.5 w-3.5" /></Button>}
      </div>
    </article>
  );
}
