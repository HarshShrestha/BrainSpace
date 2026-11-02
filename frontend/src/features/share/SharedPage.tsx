import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { SharedBrain } from '../../types';
import { ContentList } from '../content/ContentList';
export function SharedPage({ token }: { token: string }) {
  const [data, setData] = useState<SharedBrain | null>(null), [error, setError] = useState('');
  useEffect(() => { api.shared(token).then(setData).catch(e => setError(e.message)); }, [token]);
  return <main className="shared-page"><a className="brand" href="/"><span className="brand-mark">✳</span> brainspace<span className="brand-dot">.</span></a><header className="shared-header"><span className="eyebrow">A SHARED SPACE</span><h1>{data ? `${data.username}’s brain` : 'A little space for ideas.'}</h1><p className="muted">A collection of things worth remembering.</p></header>{error ? <p role="alert" className="error">{error}</p> : data ? <ContentList items={data.content} /> : <p role="status">Loading shared space…</p>}</main>;
}
