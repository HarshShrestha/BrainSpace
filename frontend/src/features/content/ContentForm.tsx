import { Modal } from '../../components/Modal';
import { useState, type FormEvent } from 'react';
import type { ContentInput, ContentType } from '../../types';
export function ContentForm({ onSave, onClose }: { onSave: (item: ContentInput) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState(''), [link, setLink] = useState(''), [type, setType] = useState<ContentType>('article'), [tags, setTags] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const url = new URL(link); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an http or https link.'); await onSave({ title: title.trim(), link, type, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  }
  return <Modal titleId="add-title" onClose={onClose}><div className="dialog-head"><div><span className="eyebrow">CAPTURE AN IDEA</span><h2 id="add-title">Add to your space</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><form onSubmit={submit}><label>Title<input autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="What would you like to remember?" /></label><label>Link<input required type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" /></label><label>Content type<select value={type} onChange={e => setType(e.target.value as ContentType)}><option value="article">Article or document</option><option value="video">Video</option><option value="audio">Audio</option><option value="image">Image</option></select></label><label>Tags <span className="label-note">optional, separated by commas</span><input value={tags} onChange={e => setTags(e.target.value)} placeholder="design, ideas, reading" /></label>{error && <p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save to space'}</button></div></form></Modal>;
}
