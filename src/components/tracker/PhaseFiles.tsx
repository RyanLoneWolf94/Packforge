import { useRef, useState } from 'react';
import { ArrowSquareOut, DownloadSimple, Paperclip, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button, Input } from '@/src/components/ui';
import { MAX_UPLOAD_BYTES, formatBytes, removeStoredFile, uploadProjectFile } from '@/src/lib/storage';
import { cn, downloadFile } from '@/src/lib/utils';
import { useStudio } from '@/src/store/StudioStore';
import type { Project, TrackerPhase } from '@/src/types';

/**
 * Files attached to one phase.
 *
 * A phase used to offer only `link`, a URL pointing at a folder somewhere
 * else, so a deliverable had nowhere to put its actual output. Files dropped
 * here are ordinary rows in `files` carrying a `phaseId`, which is what makes
 * them appear in the client's Files tab with no further wiring — the portal
 * already lists every shared file for the client.
 *
 * The external link is kept alongside: a working folder and a handed-over
 * file are different things.
 */
export default function PhaseFiles({
  project,
  phase,
  mode,
}: {
  project: Project;
  phase: TrackerPhase;
  mode: 'admin' | 'client';
}) {
  const { files, add, remove, setPhaseLink } = useStudio();
  const isAdmin = mode === 'admin';

  const [draft, setDraft] = useState(phase.link);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const attached = files.filter(
    (f) => f.phaseId === phase.id && (isAdmin || f.sharedWithClient),
  );

  const upload = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setBusy(true);
    let ok = 0;

    for (const file of Array.from(picked)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} is over ${formatBytes(MAX_UPLOAD_BYTES)}`);
        continue;
      }
      try {
        const result = await uploadProjectFile(file);
        add('files', {
          name: file.name,
          kind: result.kind,
          size: result.size,
          uploadedAt: new Date().toISOString().slice(0, 10),
          folder: 'Deliverables',
          clientId: project.clientId,
          projectId: project.id,
          phaseId: phase.id,
          // Phase output is the client's by default; untick on the Files page
          // to keep something internal.
          sharedWithClient: true,
          url: result.url,
          storagePath: result.storagePath,
        });
        ok += 1;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not upload ${file.name}`);
      }
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    if (ok > 0) toast.success(`${ok} file${ok === 1 ? '' : 's'} added to ${phase.name}`);
  };

  const hasAnything = attached.length > 0 || phase.link || isAdmin;
  if (!hasAnything) return null;

  return (
    <div className="border-t border-line pt-4 space-y-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">Files</span>

        {isAdmin ? (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={(e) => void upload(e.target.files)}
              className="hidden"
              id={`phase-upload-${phase.id}`}
            />
            <Button
              size="sm"
              icon={Paperclip}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Uploading…' : 'Attach files'}
            </Button>

            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="…or paste a Drive / Docs link"
              className="flex-1 min-w-[200px]"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={draft === phase.link}
              onClick={() => {
                setPhaseLink(project.id, phase.id, draft.trim());
                toast.success('Phase link saved');
              }}
            >
              Save link
            </Button>
          </>
        ) : phase.link ? (
          <a
            href={phase.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface border border-purple text-purple text-[13px] font-bold hover:bg-purple hover:text-white transition-colors"
          >
            <ArrowSquareOut size={14} /> View phase folder
          </a>
        ) : attached.length === 0 ? (
          <span className="text-[13px] text-ink-faint italic">Nothing shared yet</span>
        ) : null}
      </div>

      {attached.length > 0 ? (
        <ul className="space-y-1.5">
          {attached.map((file) => (
            <li
              key={file.id}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-lg',
                'bg-surface-2 border border-line',
              )}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-bold text-ink truncate">
                  {file.name}
                </span>
                <span className="block text-[11.5px] text-ink-faint">
                  {file.size}
                  {isAdmin && !file.sharedWithClient ? ' · internal' : ''}
                </span>
              </span>

              <button
                onClick={() => downloadFile(file)}
                aria-label={`Download ${file.name}`}
                className="p-1.5 text-ink-faint hover:text-purple rounded transition-colors"
              >
                <DownloadSimple size={16} />
              </button>

              {isAdmin ? (
                <button
                  onClick={() => {
                    void removeStoredFile(file.storagePath);
                    remove('files', file.id);
                    toast.success('File removed');
                  }}
                  aria-label={`Remove ${file.name}`}
                  className="p-1.5 text-ink-faint hover:text-red rounded transition-colors"
                >
                  <Trash size={15} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
