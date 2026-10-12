import { supabase } from './supabase';
import type { FileKind } from '../types';

/**
 * Uploads for the files library.
 *
 * The bucket is private: only allow-listed admins can read it directly. At
 * upload time we mint a long-lived signed URL and store it on the file record,
 * which is what the client portal opens — so clients never need storage
 * access, and nothing in the bucket is world-readable.
 */

const BUCKET = 'project-files';

/** A year. Long enough to be practical, short enough to expire eventually. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Extension -> the app's coarse file kind, used for the list's colour coding. */
export function kindFromName(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'heic'].includes(ext)) return 'image';
  if (['doc', 'docx', 'txt', 'rtf', 'md', 'pages', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'].includes(ext))
    return 'doc';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  return 'other';
}

/** "2.4 MB" — matches how sizes were already written by hand. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/** Keep the original name readable in storage while guaranteeing uniqueness. */
function safePath(fileName: string): string {
  const clean = fileName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9.\-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120);
  return `${crypto.randomUUID()}/${clean || 'file'}`;
}

export interface UploadResult {
  storagePath: string;
  url: string;
  size: string;
  kind: FileKind;
}

/** Upload one file and return everything the `files` record needs. */
export async function uploadProjectFile(file: File): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is larger than ${formatBytes(MAX_UPLOAD_BYTES)}`);
  }

  const storagePath = safePath(file.name);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (signError || !data?.signedUrl) {
    throw new Error(signError?.message ?? 'Could not create a link for the uploaded file');
  }

  return {
    storagePath,
    url: data.signedUrl,
    size: formatBytes(file.size),
    kind: kindFromName(file.name),
  };
}

/** Remove the stored object. Safe to call for records that were links only. */
export async function removeStoredFile(storagePath?: string): Promise<void> {
  if (!storagePath) return;
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) console.error('Could not remove stored file:', error.message);
}
