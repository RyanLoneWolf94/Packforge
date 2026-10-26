import { useMemo, useState } from 'react';
import {
  Archive,
  DownloadSimple,
  Eye,
  EyeSlash,
  FileText,
  MagnifyingGlass,
  Plus,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusPill,
} from '@/src/components/ui';
import { cn, downloadFile, formatDate } from '@/src/lib/utils';
import {
  MAX_UPLOAD_BYTES,
  formatBytes,
  removeStoredFile,
  uploadProjectFile,
} from '@/src/lib/storage';
import SortControl from '@/src/components/SortControl';
import { byDate, byText, useSort, type SortOption } from '@/src/lib/useSort';
import { useStudio } from '@/src/store/StudioStore';
import type { FileAsset, FileKind } from '@/src/types';

const KINDS: FileKind[] = ['pdf', 'image', 'doc', 'zip', 'video', 'other'];

const KIND_TONE: Record<FileKind, string> = {
  pdf: 'bg-red-dim text-red',
  image: 'bg-purple-dim text-purple',
  doc: 'bg-gold-dim text-gold-deep',
  zip: 'bg-surface-2 text-ink-soft',
  video: 'bg-orange-dim text-orange',
  other: 'bg-surface-2 text-ink-soft',
};

const fileSorts = (
  clientFor: (item: { clientId?: string }) => { name: string } | undefined,
): SortOption<FileAsset>[] => [
  { id: 'uploadedAt', label: 'Date added', compare: byDate((f) => f.uploadedAt), natural: 'desc' },
  { id: 'name', label: 'Name', compare: byText((f) => f.name) },
  { id: 'kind', label: 'Type', compare: byText((f) => f.kind) },
  { id: 'folder', label: 'Folder', compare: byText((f) => f.folder) },
  { id: 'client', label: 'Client', compare: byText((f) => clientFor(f)?.name) },
];

export default function Files() {
  const { files, clients, projects, clientFor, projectFor, add, update, remove } = useStudio();

  const [query, setQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [isOpen, setIsOpen] = useState(false);
  // Files chosen from disk, uploaded on submit alongside the record.
  const [picked, setPicked] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    kind: 'pdf' as FileKind,
    size: '',
    folder: 'Deliverables',
    clientId: '',
    projectId: '',
    url: '',
    sharedWithClient: true,
  });

  const folders = useMemo(() => [...new Set(files.map((f) => f.folder))], [files]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files
      .filter((f) => (folderFilter === 'all' ? true : f.folder === folderFilter))
      .filter((f) => {
        if (!q) return true;
        return (
          f.name.toLowerCase().includes(q) ||
          (clientFor(f)?.name ?? '').toLowerCase().includes(q)
        );
      })
;
  }, [files, query, folderFilter, clientFor]);

  const sort = useSort(filtered, fileSorts(clientFor), 'files');
  const rows = sort.items;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().slice(0, 10);
    const common = {
      folder: form.folder.trim() || 'Uncategorised',
      clientId: form.clientId || undefined,
      projectId: form.projectId || undefined,
      sharedWithClient: form.sharedWithClient,
      uploadedAt: today,
    };

    // Upload path: one record per chosen file, named after the file itself.
    if (picked.length > 0) {
      setBusy(true);
      let ok = 0;
      for (const file of picked) {
        try {
          const uploaded = await uploadProjectFile(file);
          add('files', {
            ...common,
            name: file.name,
            kind: uploaded.kind,
            size: uploaded.size,
            url: uploaded.url,
            storagePath: uploaded.storagePath,
          });
          ok++;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Could not upload ${file.name}`);
        }
      }
      setBusy(false);
      if (ok > 0) toast.success(`Uploaded ${ok} file${ok === 1 ? '' : 's'}`);
      setPicked([]);
      setIsOpen(false);
      return;
    }

    // Link path: the file lives somewhere else and we're recording where.
    if (!form.name.trim()) {
      toast.error('Choose a file to upload, or give the link a name');
      return;
    }
    add('files', {
      ...common,
      name: form.name.trim(),
      kind: form.kind,
      size: form.size.trim() || '—',
      url: form.url.trim() || undefined,
    });
    toast.success('File added');
    setIsOpen(false);
    setForm({ ...form, name: '', size: '', url: '' });
  };

  const shared = files.filter((f) => f.sharedWithClient).length;

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Files"
        subtitle="Deliverables and working files, and who can see each one."
        actions={
          <Button icon={Plus} onClick={() => setIsOpen(true)}>
            Add File
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={Archive} tone="purple" value={files.length} label="Total Files" />
        <StatCard icon={Eye} tone="positive" value={shared} label="Shared With Clients" />
        <StatCard
          icon={EyeSlash}
          tone="neutral"
          value={files.length - shared}
          label="Internal Only"
        />
      </div>

      <Card className="p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search file or client…"
            className="pl-10"
          />
        </div>
        <SortControl sort={sort} />
        <Select
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Archive}
            title="No files match"
            description="Register a deliverable so the client can find it in their portal."
            action={
              <Button icon={Plus} onClick={() => setIsOpen(true)}>
                Add File
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {rows.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-4 p-4 group">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    KIND_TONE[file.kind],
                  )}
                >
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink truncate">{file.name}</p>
                  <p className="text-xs text-ink-soft truncate">
                    {file.folder} · {file.size} · {formatDate(file.uploadedAt)}
                    {clientFor(file) ? ` · ${clientFor(file)!.name}` : ' · Internal'}
                    {projectFor(file) ? ` · ${projectFor(file)!.name}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusPill tone={file.sharedWithClient ? 'positive' : 'neutral'}>
                  {file.sharedWithClient ? 'Shared' : 'Internal'}
                </StatusPill>
                <button
                  onClick={() => {
                    update('files', file.id, { sharedWithClient: !file.sharedWithClient });
                    toast.success(
                      file.sharedWithClient
                        ? `${file.name} hidden from the client`
                        : `${file.name} shared with the client`,
                    );
                  }}
                  title={file.sharedWithClient ? 'Hide from client' : 'Share with client'}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    file.sharedWithClient
                      ? 'text-positive hover:bg-positive-dim'
                      : 'text-ink-faint hover:bg-surface-2',
                  )}
                >
                  {file.sharedWithClient ? <Eye size={16} /> : <EyeSlash size={16} />}
                </button>
                {file.url ? (
                  <button
                    onClick={() => downloadFile(file)}
                    className="p-2 text-ink-faint hover:text-purple hover:bg-purple-dim rounded-lg transition-colors"
                    aria-label={`Open ${file.name}`}
                    title="Open file"
                  >
                    <DownloadSimple size={16} />
                  </button>
                ) : (
                  <span
                    className="p-2 text-ink-faint/40 cursor-default"
                    title="No link attached to this file"
                  >
                    <DownloadSimple size={16} />
                  </span>
                )}
                <button
                  onClick={() => {
                    void removeStoredFile(file.storagePath);
                    remove('files', file.id);
                    toast.success('File removed');
                  }}
                  className="p-2 text-ink-faint hover:text-red hover:bg-red-dim rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Delete ${file.name}`}
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add File"
        subtitle="Upload from this computer, or record a file kept elsewhere"
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="file-form" disabled={busy}>
              {busy
                ? "Uploading…"
                : picked.length > 0
                  ? `Upload ${picked.length} file${picked.length === 1 ? "" : "s"}`
                  : "Add File"}
            </Button>
          </>
        }
      >
        <form id="file-form" onSubmit={submit} className="space-y-4">
          {/* Upload from this computer. Name, type and size come from the
              file itself, so those fields are only needed for a link. */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setPicked([...picked, ...Array.from(e.dataTransfer.files)]);
            }}
            className="border-2 border-dashed border-line rounded-xl bg-surface-2 px-5 py-7 text-center"
          >
            <UploadSimple size={26} className="text-orange mx-auto mb-2" />
            <p className="text-[13.5px] font-bold text-ink">Drop files here</p>
            <p className="text-[12px] text-ink-soft mt-0.5">
              PDFs, images, documents, zip and rar — up to {formatBytes(MAX_UPLOAD_BYTES)} each
            </p>
            <label className="inline-block mt-3">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  setPicked([...picked, ...Array.from(e.target.files ?? [])]);
                  e.target.value = '';
                }}
              />
              <span className="px-4 py-2 rounded-lg bg-surface border border-line text-[13px] font-bold text-ink cursor-pointer hover:border-orange transition-colors inline-block">
                Choose files
              </span>
            </label>
          </div>

          {picked.length > 0 ? (
            <ul className="space-y-1.5">
              {picked.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-3 bg-surface-2 rounded-lg px-3 py-2"
                >
                  <span className="min-w-0 flex items-center gap-2">
                    <FileText size={14} className="text-ink-faint shrink-0" />
                    <span className="text-[13px] text-ink truncate">{f.name}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[11.5px] text-ink-soft">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setPicked(picked.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="text-ink-faint hover:text-red p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {picked.length === 0 ? (
            <>
              <Field label="Or record a file kept elsewhere" hint="Name it and paste the link">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Brand_Manual_v2.pdf"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type">
                  <Select
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as FileKind })}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Size">
                  <Input
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    placeholder="2.4 MB"
                  />
                </Field>
              </div>
            </>
          ) : null}

          <Field label="Folder">
            <Input
              value={form.folder}
              onChange={(e) => setForm({ ...form, folder: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client" hint="Leave blank for internal files">
              <Select
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value, projectId: '' })}
              >
                <option value="">Internal</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Project">
              <Select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              >
                <option value="">None</option>
                {projects
                  .filter((p) => !form.clientId || p.clientId === form.clientId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field label="DownloadSimple URL" hint="Optional — a Drive or storage link">
            <Input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sharedWithClient}
              onChange={(e) => setForm({ ...form, sharedWithClient: e.target.checked })}
              className="w-4 h-4 rounded border-line text-orange focus:ring-orange"
            />
            <span className="text-sm text-ink">Visible in the client portal</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
