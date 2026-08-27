import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderArchive,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
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
import { useStudio } from '@/src/store/StudioStore';
import type { FileKind } from '@/src/types';

const KINDS: FileKind[] = ['pdf', 'image', 'doc', 'zip', 'video', 'other'];

const KIND_TONE: Record<FileKind, string> = {
  pdf: 'bg-red-dim text-red',
  image: 'bg-purple-dim text-purple',
  doc: 'bg-gold-dim text-gold-deep',
  zip: 'bg-surface-2 text-ink-soft',
  video: 'bg-orange-dim text-orange',
  other: 'bg-surface-2 text-ink-soft',
};

export default function Files() {
  const { files, clients, projects, clientFor, projectFor, add, update, remove } = useStudio();

  const [query, setQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [isOpen, setIsOpen] = useState(false);
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

  const rows = useMemo(() => {
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
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }, [files, query, folderFilter, clientFor]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('File name is required');
      return;
    }
    add('files', {
      name: form.name.trim(),
      kind: form.kind,
      size: form.size.trim() || '—',
      folder: form.folder.trim() || 'Uncategorised',
      clientId: form.clientId || undefined,
      projectId: form.projectId || undefined,
      url: form.url.trim() || undefined,
      sharedWithClient: form.sharedWithClient,
      uploadedAt: new Date().toISOString().slice(0, 10),
    });
    toast.success('File registered');
    setIsOpen(false);
    setForm({ ...form, name: '', size: '', url: '' });
  };

  const shared = files.filter((f) => f.sharedWithClient).length;

  return (
    <div className="max-w-[1400px] space-y-6">
      <PageHeader
        title="Files"
        subtitle="Toggle the eye to control what each client sees in their portal."
        actions={
          <Button icon={Plus} onClick={() => setIsOpen(true)}>
            Add File
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={FolderArchive} tone="purple" value={files.length} label="Total Files" />
        <StatCard icon={Eye} tone="positive" value={shared} label="Shared With Clients" />
        <StatCard
          icon={EyeOff}
          tone="neutral"
          value={files.length - shared}
          label="Internal Only"
        />
      </div>

      <Card className="p-4 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search
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
            icon={FolderArchive}
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
                  {file.sharedWithClient ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => downloadFile(file)}
                  className="p-2 text-ink-faint hover:text-purple hover:bg-purple-dim rounded-lg transition-colors"
                  aria-label={`Download ${file.name}`}
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => {
                    remove('files', file.id);
                    toast.success('File removed');
                  }}
                  className="p-2 text-ink-faint hover:text-red hover:bg-red-dim rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Delete ${file.name}`}
                >
                  <Trash2 size={16} />
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
        subtitle="Registers a file record. Storage lands with the backend."
        width="max-w-lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="file-form">
              Add File
            </Button>
          </>
        }
      >
        <form id="file-form" onSubmit={submit} className="space-y-4">
          <Field label="File Name">
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Brand_Manual_v2.pdf"
            />
          </Field>
          <div className="grid grid-cols-3 gap-4">
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
            <Field label="Folder">
              <Input
                value={form.folder}
                onChange={(e) => setForm({ ...form, folder: e.target.value })}
              />
            </Field>
          </div>
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
          <Field label="Download URL" hint="Optional — a Drive or storage link">
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
