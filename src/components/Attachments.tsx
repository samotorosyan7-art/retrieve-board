'use client';

import { useEffect, useState } from 'react';
import { attachmentUrl } from '@/lib/db';
import { fmtBytes } from '@/lib/helpers';
import type { Attachment } from '@/lib/types';
import { DownloadIcon, FileArchiveIcon, FileIcon, FileSpreadsheetIcon, FileTextIcon, ImageIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { useStore } from './store';

export const isImage = (a: Attachment) => a.mime.startsWith('image/') && a.mime !== 'image/heic';

function iconFor(a: Attachment) {
  if (a.mime.startsWith('image/')) return ImageIcon;
  if (/sheet|excel|csv/.test(a.mime)) return FileSpreadsheetIcon;
  if (a.mime === 'application/zip') return FileArchiveIcon;
  if (/pdf|word|text|rtf|opendocument\.text|presentation|powerpoint/.test(a.mime)) return FileTextIcon;
  return FileIcon;
}

/** Open a file in a new tab (preview), or save it under its original name. Links expire after 5 minutes. */
export function useOpenAttachment() {
  const { toast } = useStore();
  return async (a: Attachment, download = false) => {
    // Opened before the await so the browser doesn't treat it as an unrequested popup.
    const tab = download ? null : window.open('', '_blank');
    try {
      const url = await attachmentUrl(a.path, download ? a.name : undefined);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (e) {
      tab?.close();
      console.warn('Attachment link error', e);
      toast(TriangleAlertIcon, 'Cannot open file', 'You may not have access to it, or it was deleted.');
    }
  };
}

/** A short-lived link for showing an image inline (chat thumbnails). */
export function useAttachmentUrl(a: Attachment | undefined, enabled = true) {
  const [url, setUrl] = useState<string | null>(null);
  const path = a?.path;
  useEffect(() => {
    if (!path || !enabled) return;
    let live = true;
    attachmentUrl(path).then(u => { if (live) setUrl(u); }).catch(() => {});
    return () => { live = false; };
  }, [path, enabled]);
  return url;
}

/** One file: icon, name (opens it), size/meta, download and optional delete. */
export function FileRow({ a, meta, onDelete }: { a: Attachment; meta?: string; onDelete?: () => void }) {
  const open = useOpenAttachment();
  const Icon = iconFor(a);
  return (
    <div className="file-row">
      <span className="file-icon"><Icon size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button className="file-name file-link" title={`Open ${a.name}`} onClick={() => open(a)}>{a.name}</button>
        <div className="file-size">{fmtBytes(a.size)}{meta && ` · ${meta}`}</div>
      </div>
      <button className="btn-ghost" title="Download" style={{ padding: '3px 6px' }} onClick={() => open(a, true)}><DownloadIcon size={12} /></button>
      {onDelete && <button className="btn-ghost" title="Delete file" style={{ padding: '3px 6px' }} onClick={onDelete}><Trash2Icon size={12} /></button>}
    </div>
  );
}
