'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, Eye, FileText, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { getErrorMessage } from '@/lib/api-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const documentTypes = ['CREDENTIALS_PROFILE', 'EMPANELMENT_APPROVAL_LETTER_SCAN', 'SOURCE_APPROVAL_LETTER_SCAN', 'TECHNICAL_VISIT_REPORT', 'NC_CLOSURE_EVIDENCE'] as const;
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

type DocumentRow = {
  id: number; documentType: string; parentType: string; parentId: number | null; parentName: string | null;
  institutionId: number | null; projectId: number | null; ncRegisterId: number | null;
  fileName: string; mimeType: string | null; fileSizeBytes: number | null; fileAttached: boolean; active: boolean;
  uploadedAt: string | null; uploadedByEmployeeName: string | null; versionNumber: number | null;
};

export default function DocumentsPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [query, setQuery] = useState('');
  const [parentType, setParentType] = useState('ALL');
  const [documentType, setDocumentType] = useState('ALL');
  const [attachment, setAttachment] = useState('ATTACHED');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
      if (parentType !== 'ALL') params.set('parentType', parentType);
      if (documentType !== 'ALL') params.set('documentType', documentType);
      if (attachment !== 'ALL') params.set('fileAttached', String(attachment === 'ATTACHED'));
      const response = await fetch(`${API_BASE}/api/common/documents?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(await response.text());
      const body = await response.json();
      setDocuments(Array.isArray(body.content) ? body.content : []);
      setTotalElements(Number(body.totalElements || 0));
      setTotalPages(Math.max(1, Number(body.totalPages || 1)));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load documents.'));
      setDocuments([]); setTotalElements(0); setTotalPages(1);
    } finally { setLoading(false); }
  }, [token, page, parentType, documentType, attachment]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [parentType, documentType, attachment]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const visibleDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((document) => `${document.fileName} ${document.documentType} ${document.parentName || ''} ${document.uploadedByEmployeeName || ''}`.toLowerCase().includes(needle));
  }, [documents, query]);

  const getFile = async (document: DocumentRow) => {
    if (!token || !document.fileAttached) throw new Error('No file is attached to this document.');
    const listResponse = await fetch(`${API_BASE}/api/hr/files?parentType=DOCUMENT_DEPOSITORY&parentId=${document.id}&page=0&size=5`, { headers: { Authorization: `Bearer ${token}` } });
    if (!listResponse.ok) throw new Error('Unable to locate the uploaded file.');
    const listing = await listResponse.json();
    const fileId = listing.content?.[0]?.id;
    if (!fileId) throw new Error('The document metadata exists, but its file is unavailable.');
    const response = await fetch(`${API_BASE}/api/hr/files/${fileId}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Unable to download the file.');
    return response.blob();
  };

  const view = async (document: DocumentRow) => {
    setSelected(document); setFileLoading(document.fileAttached); setPreviewUrl(null);
    if (!document.fileAttached) return;
    try { setPreviewUrl(URL.createObjectURL(await getFile(document))); }
    catch (error) { toast.error(getErrorMessage(error, 'Unable to open the file.')); }
    finally { setFileLoading(false); }
  };

  const download = async (document: DocumentRow) => {
    setFileLoading(true);
    try {
      const url = URL.createObjectURL(await getFile(document));
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = document.fileName || `document-${document.id}`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(getErrorMessage(error, 'Unable to download the file.')); }
    finally { setFileLoading(false); }
  };

  const parentHref = (document: DocumentRow) => document.parentType === 'PROJECT' && document.projectId ? `/dashboard/projects/${document.projectId}` : document.parentType === 'INSTITUTION' && document.institutionId ? `/dashboard/institutions/${document.institutionId}` : null;

  return (
    <div className="mx-auto w-full max-w-none space-y-4 py-4">
      <div className="flex flex-col gap-3 border-b pb-4 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this page by file, parent, type, or uploader" className="h-9 pl-8 text-xs" /></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:w-[650px]">
          <Select value={parentType} onValueChange={setParentType}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All parent types</SelectItem><SelectItem value="PROJECT">Projects</SelectItem><SelectItem value="INSTITUTION">Institutions</SelectItem><SelectItem value="NC_REGISTER">NC Register</SelectItem></SelectContent></Select>
          <Select value={documentType} onValueChange={setDocumentType}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All document types</SelectItem>{documentTypes.map((type) => <SelectItem key={type} value={type}>{humanize(type)}</SelectItem>)}</SelectContent></Select>
          <Select value={attachment} onValueChange={setAttachment}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ATTACHED">Files attached</SelectItem><SelectItem value="MISSING">Files missing</SelectItem><SelectItem value="ALL">All records</SelectItem></SelectContent></Select>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{totalElements} document{totalElements === 1 ? '' : 's'}</span><span>Global document register</span></div>
      <div className="overflow-x-auto">
        <Table className="min-w-[900px] table-fixed text-xs"><TableHeader><TableRow><TableHead className="w-[25%]">File</TableHead><TableHead className="w-[17%]">Type</TableHead><TableHead className="w-[22%]">Parent</TableHead><TableHead className="w-[9%]">Version</TableHead><TableHead className="w-[15%]">Uploaded</TableHead><TableHead className="w-[12%] text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{loading ? Array.from({ length: Math.min(pageSize, 8) }, (_, index) => <TableRow key={index}>{Array.from({ length: 6 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>) : visibleDocuments.length === 0 ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No documents match the selected filters.</TableCell></TableRow> : visibleDocuments.map((document) => {
            const href = parentHref(document);
            return <TableRow key={document.id}>
              <TableCell><div className="flex min-w-0 items-center gap-2"><div className="rounded-md bg-primary/10 p-1.5"><FileText className="h-4 w-4 text-primary" /></div><div className="min-w-0"><p className="truncate font-medium" title={document.fileName}>{document.fileName}</p><p className="truncate text-[11px] text-muted-foreground">{document.mimeType || 'Type unavailable'}{document.fileSizeBytes ? ` · ${Math.ceil(document.fileSizeBytes / 1024)} KB` : ''}</p></div></div></TableCell>
              <TableCell><Badge variant="secondary" className="max-w-full truncate text-[10px]">{humanize(document.documentType)}</Badge></TableCell>
              <TableCell><div className="truncate font-medium" title={document.parentName || undefined}>{href ? <Link href={href} className="hover:underline">{document.parentName || `${humanize(document.parentType)} #${document.parentId}`}</Link> : document.parentName || `${humanize(document.parentType)} #${document.parentId}`}</div><p className="text-[11px] text-muted-foreground">{humanize(document.parentType)} · #{document.parentId}</p></TableCell>
              <TableCell>v{document.versionNumber || 1}<div className="mt-1"><Badge variant={document.fileAttached ? 'default' : 'outline'} className="text-[10px]">{document.fileAttached ? 'Attached' : 'Missing'}</Badge></div></TableCell>
              <TableCell><p>{document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</p><p className="truncate text-[11px] text-muted-foreground">{document.uploadedByEmployeeName || 'Unknown uploader'}</p></TableCell>
              <TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" className="h-8 w-8" disabled={!document.fileAttached || fileLoading} onClick={() => void view(document)} title="Preview"><Eye className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="h-8 w-8" disabled={!document.fileAttached || fileLoading} onClick={() => void download(document)} title="Download"><Download className="h-4 w-4" /></Button></div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground">10 rows per page</span>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-8" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}><ChevronLeft className="h-4 w-4" />Previous</Button><span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span><Button variant="outline" size="sm" className="h-8" onClick={() => setPage((current) => current + 1)} disabled={page + 1 >= totalPages || loading}>Next<ChevronRight className="h-4 w-4" /></Button></div>
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setPreviewUrl(null); } }}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle className="truncate pr-8">{selected?.fileName}</DialogTitle></DialogHeader>{selected && !selected.fileAttached ? <p className="py-8 text-center text-sm text-muted-foreground">The document record exists, but no file is attached.</p> : fileLoading ? <div className="flex h-[55vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : previewUrl ? <iframe src={previewUrl} className="h-[65vh] w-full rounded-lg border" title={selected?.fileName} /> : <p className="py-8 text-center text-sm text-muted-foreground">Preview unavailable.</p>}</DialogContent></Dialog>
    </div>
  );
}
