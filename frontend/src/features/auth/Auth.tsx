import { useState, type FormEvent } from 'react';
import { useSetRecoilState } from 'recoil';
import { userState } from '../../store/state';
import { api } from '../../services/api';
export function Auth() {
  const [signup, setSignup] = useState(false), [username, setUsername] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const setUser = useSetRecoilState(userState);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { setUser(await (signup ? api.signup(username, password) : api.login(username, password))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout"><section className="auth-intro"><div className="brand"><span className="brand-mark">✳</span> brainspace<span className="brand-dot">.</span></div><div><div className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</div><h1>Make room<br/>for <em>ideas.</em></h1><p>Collect the things worth keeping. Find them when you need them. Let your thoughts connect.</p></div><div className="intro-footer"><span>YOUR KNOWLEDGE, ALL IN ONE PLACE</span><span>01 / ∞</span></div></section><section className="auth-panel"><div className="auth-form"><span className="eyebrow">YOUR SECOND BRAIN STARTS HERE</span><h2>{signup ? 'Create your space' : 'Welcome back'}</h2><p className="muted">{signup ? 'A quieter home for everything you want to remember.' : 'Your collection is right where you left it.'}</p><form onSubmit={submit}><label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={30} placeholder="your_username" /></label><label>Password<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account →' : 'Sign in →'}</button></form><p className="auth-switch">{signup ? 'Already have an account?' : 'New to BrainSpace?'} <button className="text-button" onClick={() => { setSignup(!signup); setError(''); }}>{signup ? 'Sign in' : 'Create an account'}</button></p></div></section></main>;
}
