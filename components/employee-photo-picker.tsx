"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { validateEmployeePhoto } from '@/lib/employee-photo-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function EmployeePhotoPicker({ file, onChange, disabled, onValidatingChange, onErrorChange }: {
  file: File | null; onChange: (file: File | null) => void; disabled?: boolean;
  onValidatingChange?: (value: boolean) => void; onErrorChange?: (value: string | null) => void;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => { sequence.current++; }, []);
  const clear = () => { sequence.current++; setError(null); onErrorChange?.(null); onChange(null); setValidating(false); onValidatingChange?.(false); };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
        {/* A local, revocable URL is used for an authenticated/private image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="Selected profile picture" className="h-full w-full object-cover" /> : <Camera className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor={id}>Choose profile picture</Label>
        <Input id={id} type="file" accept="image/jpeg,image/png" disabled={disabled || validating} onChange={async event => {
          const selected = event.target.files?.[0]; event.target.value = '';
          if (!selected) return;
          const current = ++sequence.current; onChange(null); setError(null); onErrorChange?.(null); setValidating(true); onValidatingChange?.(true);
          try { await validateEmployeePhoto(selected); if (current === sequence.current) onChange(selected); }
          catch (cause) { if (current === sequence.current) { const message = cause instanceof Error ? cause.message : 'Choose a valid image.'; setError(message); onErrorChange?.(message); } }
          finally { if (current === sequence.current) { setValidating(false); onValidatingChange?.(false); } }
        }} />
        <p className="text-xs text-muted-foreground">JPEG or PNG, up to 5 MiB. Optional.</p>
        {file && <p className="break-words text-xs">{file.name}</p>}
      </div>
    </div>
    {validating && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Checking image…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {(file || error) && <Button type="button" variant="outline" size="sm" disabled={disabled || validating} onClick={clear}>Clear selection</Button>}
  </div>;
}
