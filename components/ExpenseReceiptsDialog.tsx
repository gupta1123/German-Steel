'use client';

import { AdminRemovalAction } from '@/components/admin-removal-action';
import { adminRemovalPaths } from '@/lib/admin-removals-api';
import { useEffect, useState } from 'react';
import { ExternalLink, FileText, ImageOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

interface ReceiptFile {
  id: number;
  name: string;
  mimeType: string;
  url: string | null;
}

interface ExpenseReceiptsDialogProps {
  expenseId: number | null;
  title?: string;
  onClose: () => void;
}

const isImage = (mimeType: string) => mimeType.toLowerCase().startsWith('image/');

/**
 * Shows the receipt images attached to one expense.
 * Files are listed with GET /api/hr/files?parentType=EXPENSE and fetched with the user's token
 * (GET /api/hr/files/{id}/download), because the download needs an Authorization header.
 */
export default function ExpenseReceiptsDialog({ expenseId, title, onClose }: ExpenseReceiptsDialogProps) {
  const { token } = useAuth();
  const [removalVersion, setRemovalVersion] = useState(0);
  const [files, setFiles] = useState<ReceiptFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    if (expenseId == null || !token) return;
    const controller = new AbortController();
    const objectUrls: string[] = [];
    setLoading(true);
    setError(null);
    setFiles([]);
    setActiveId(null);

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        const listResponse = await fetch(`${API_BASE}/api/hr/files?parentType=EXPENSE&parentId=${expenseId}&page=0&size=50`, { headers, signal: controller.signal });
        if (!listResponse.ok) throw new Error(`Could not load receipts (${listResponse.status}).`);
        const body = await listResponse.json();
        const items: Record<string, unknown>[] = Array.isArray(body) ? body : Array.isArray(body?.content) ? body.content : [];
        const loaded = await Promise.all(items.filter(item => item.active !== false).map(async (item): Promise<ReceiptFile | null> => {
          const id = Number(item.id);
          if (!Number.isFinite(id)) return null;
          const name = typeof item.originalFileName === 'string' && item.originalFileName ? item.originalFileName : `Receipt ${id}`;
          const mimeType = typeof item.storedMimeType === 'string' ? item.storedMimeType : '';
          try {
            const fileResponse = await fetch(`${API_BASE}/api/hr/files/${id}/download`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
            if (!fileResponse.ok) throw new Error('download failed');
            const url = URL.createObjectURL(await fileResponse.blob());
            objectUrls.push(url);
            return { id, name, mimeType, url };
          } catch {
            return { id, name, mimeType, url: null };
          }
        }));
        if (controller.signal.aborted) return;
        const result = loaded.filter((file): file is ReceiptFile => file !== null);
        setFiles(result);
        setActiveId(result.find((file) => file.url && isImage(file.mimeType))?.id ?? null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load receipts.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [expenseId, token, removalVersion]);

  const active = files.find((file) => file.id === activeId) ?? null;

  return (
    <Dialog open={expenseId != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receipts</DialogTitle>
          <DialogDescription>{title ?? 'Images attached to this expense'}{files.length ? ` · ${files.length} file${files.length === 1 ? '' : 's'}` : ''}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3" aria-live="polite">
            <Skeleton className="h-72 w-full rounded-lg" />
            <div className="flex gap-2"><Skeleton className="h-16 w-16 rounded-md" /><Skeleton className="h-16 w-16 rounded-md" /><Skeleton className="h-16 w-16 rounded-md" /></div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading receipts…</p>
          </div>
        ) : error ? (
          <p role="alert" className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</p>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <ImageOff className="h-8 w-8" aria-hidden />
            <p className="text-sm font-medium text-foreground">No receipts attached</p>
            <p className="text-xs">The employee did not add any images to this expense.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
              {active?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.url} alt={active.name} className="max-h-[60vh] w-auto max-w-full object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">Select a receipt below.</p>
              )}
            </div>
            {active?.url && (
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="truncate">{active.name}</span>
                <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 text-xs">
                  <a href={active.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open full size</a>
                </Button>
              </div>
            )}
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Receipt thumbnails">
              {files.map((file, index) => (
                <li key={file.id}>
                  <button
                    type="button"
                    onClick={() => file.url && isImage(file.mimeType) ? setActiveId(file.id) : file.url ? window.open(file.url, '_blank', 'noreferrer') : undefined}
                    className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted/30 transition ${file.id === activeId ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
                    aria-label={`Show receipt ${index + 1}: ${file.name}`}
                    aria-pressed={file.id === activeId}
                    disabled={!file.url}
                    title={file.url ? file.name : `${file.name} (could not be loaded)`}
                  >
                    {file.url && isImage(file.mimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.url} alt="" className="h-full w-full object-cover" />
                    ) : file.url ? (
                      <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
                    ) : (
                      <ImageOff className="h-5 w-5 text-muted-foreground" aria-hidden />
                    )}
                  </button>
                  <AdminRemovalAction endpoint={adminRemovalPaths.file(file.id)} label="Remove receipt" name={file.name} description="Remove this receipt attachment. The expense claim itself will be kept." onRemoved={() => setRemovalVersion(value => value + 1)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
