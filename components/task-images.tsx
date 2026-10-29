'use client';

import { AdminRemovalAction } from '@/components/admin-removal-action';
import { adminRemovalPaths } from '@/lib/admin-removals-api';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, ImageOff, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadTaskImage, listTaskImages, type TaskImage } from '@/lib/task-images';

interface LoadedImage extends TaskImage { url: string | null; failed: boolean }

/** Authenticated task images with confirmed admin file removal. */
export default function TaskImages({ taskId }: { taskId: number }) {
  const { token } = useAuth();
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const objectUrls: string[] = [];
    setLoading(true);
    setError(null);
    setImages([]);
    setSelectedId(null);

    (async () => {
      try {
        const files = await listTaskImages(taskId, token, controller.signal);
        const loaded: LoadedImage[] = [];
        // Bound concurrent downloads when a task has many images.
        for (let index = 0; index < files.length; index += 4) {
          const batch = await Promise.all(files.slice(index, index + 4).map(async (file): Promise<LoadedImage> => {
            try {
              const blob = await downloadTaskImage(file, token, controller.signal);
              if (controller.signal.aborted) return { ...file, url: null, failed: true };
              const url = URL.createObjectURL(blob);
              objectUrls.push(url);
              return { ...file, url, failed: false };
            } catch {
              return { ...file, url: null, failed: true };
            }
          }));
          if (controller.signal.aborted) return;
          loaded.push(...batch);
        }
        if (!controller.signal.aborted) setImages(loaded);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Could not load task images.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [taskId, token, attempt]);

  const selected = images.find((image) => image.id === selectedId) ?? null;
  const available = images.filter((image) => image.url && !image.failed);
  const selectedIndex = available.findIndex((image) => image.id === selectedId);
  const failed = images.some((image) => image.failed);
  const markFailed = (id: number) => setImages((current) => current.map((image) => image.id === id ? { ...image, failed: true } : image));
  const retry = () => setAttempt((current) => current + 1);

  return (
    <section aria-label="Task images" className="min-w-0 space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-medium">Images{!loading && !error && token ? ` (${images.length})` : ''}</h3>
      </div>
      {!token ? (
        <p role="alert" className="text-xs text-destructive">Sign in to view task images.</p>
      ) : loading ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Loading images…</p>
      ) : error ? (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={retry}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Try again</Button>
        </div>
      ) : images.length === 0 ? (
        <p className="text-xs text-muted-foreground">No images attached to this task.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Select an image to view it larger.</p>
          <ul aria-label="Task image thumbnails" className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
            {images.map((image, index) => (
              <li key={image.id} className="min-w-0 space-y-1">
                <button
                  type="button"
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                  aria-label={`View image ${index + 1}: ${image.name}`}
                  disabled={!image.url || image.failed}
                  onClick={() => setSelectedId(image.id)}
                >
                  {image.url && !image.failed ? (
                    // Authenticated downloads use local blob URLs, not the Next image optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.url} alt={image.name} className="h-full w-full object-cover" onError={() => markFailed(image.id)} />
                  ) : <ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden />}
                </button>
                <div className="flex items-center justify-between gap-1"><p className="truncate text-xs text-muted-foreground" title={image.name}>{image.name}</p><AdminRemovalAction endpoint={adminRemovalPaths.file(image.id)} label="Remove image" name={image.name} description="Remove this image from the task. Its stored file and history will be kept." onRemoved={() => { setSelectedId(null); retry(); }} /></div>
                {image.failed && <p className="text-xs text-destructive">Could not load image.</p>}
              </li>
            ))}
          </ul>
          {failed && <div className="flex flex-wrap items-center gap-2"><p role="status" className="text-xs text-muted-foreground">Some images could not be loaded.</p><Button type="button" variant="outline" size="sm" onClick={retry}>Try again</Button></div>}
        </>
      )}

      <Dialog open={selectedId !== null} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-4xl">
          <DialogHeader className="min-w-0 pr-6">
            <DialogTitle>Image preview</DialogTitle>
            <DialogDescription className="break-words">{selected?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
            {selected?.url && !selected.failed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt={selected.name} className="max-h-[65dvh] max-w-full object-contain" onError={() => markFailed(selected.id)} />
            ) : <p role="alert" className="p-6 text-sm text-destructive">This image could not be displayed.</p>}
          </div>
          {available.length > 1 && <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" aria-label="Previous image" disabled={selectedIndex <= 0} onClick={() => setSelectedId(available[selectedIndex - 1].id)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
            <p aria-live="polite" className="text-xs text-muted-foreground">{selectedIndex + 1} of {available.length}</p>
            <Button type="button" variant="outline" size="sm" aria-label="Next image" disabled={selectedIndex < 0 || selectedIndex >= available.length - 1} onClick={() => setSelectedId(available[selectedIndex + 1].id)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
