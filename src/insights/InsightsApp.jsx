import { useCallback, useEffect, useState } from 'react';
import { ReportView } from './ReportView';
import { date } from './format';
import './insights.css';

const SESSION_KEY = 'hunch_insights_session';
const exchanged = new Set(); // one-time links must be exchanged once, even when StrictMode runs effects twice
const readSession = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } };
const writeSession = value => { try { if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); } catch { /* memory only */ } };

async function api(path, { session, body } = {}) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Try again.'), { status: response.status });
  return data;
}

export async function downloadFile(path, token, filename) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Export failed. Try again.');
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Prototype: choose a company and go straight in. One-time email links still work if one is opened.
function SignIn({ onSignedIn }) {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = new URLSearchParams(window.location.search).get('token');
  useEffect(() => {
    if (!token || exchanged.has(token)) return;
    exchanged.add(token);
    window.history.replaceState({}, '', '/insights'); // keep the one-time link out of history
    api('/api/insights/session', { body: { token } })
      .then(data => onSignedIn({ token: data.session, ...data.user }))
      .catch(e => setError(e.message));
  }, [token, onSignedIn]);
  useEffect(() => { api('/api/insights/prototype').then(setCompanies).catch(e => setError(e.message)); }, []);
  const open = async companyId => {
    setBusy(true); setError('');
    try { const data = await api('/api/insights/prototype', { body: { companyId } }); onSignedIn({ token: data.session, ...data.user }); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return <main className="hi-signin">
    <p className="hi-eyebrow">HUNCH INSIGHTS</p>
    <h1>What shoppers <em>think</em> your products cost.</h1>
    <p className="hi-lede">Price-perception research from people playing Hunch. Choose a client to see their studies.</p>
    {error && <p className="hi-error" role="alert">{error}</p>}
    {!companies && !error && <p className="hi-muted" role="status">Loading clients…</p>}
    {companies && !companies.length && <div className="hi-empty"><h2>No clients yet.</h2><p>Load the demo client with <code>npm run seed</code>, then refresh.</p></div>}
    {companies?.length > 0 && <div className="hi-studies">{companies.map(c => <button key={c.id} className="hi-study" disabled={busy} onClick={() => open(c.id)}>
      <span className="hi-eyebrow">CLIENT</span><strong>{c.name}</strong><span className="hi-muted">Open their studies →</span></button>)}</div>}
    <p className="hi-small hi-muted">Prototype mode: no sign-in. Turn this off before real clients use it (HUNCH_PROTOTYPE=off).</p>
  </main>;
}

function Studies({ session, onOpen, onExpired }) {
  const [studies, setStudies] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/api/insights/studies', { session }).then(setStudies).catch(e => (e.status === 401 ? onExpired() : setError(e.message))); }, [session, onExpired]);
  if (error) return <p className="hi-error" role="alert">{error}</p>;
  if (!studies) return <p role="status" className="hi-muted">Loading studies…</p>;
  if (!studies.length) return <div className="hi-empty"><h2>No studies yet.</h2><p>Your Hunch contact will set one up with you.</p></div>;
  return <section className="hi-studies"><h1>Your studies</h1>
    {studies.map(s => <button key={s.id} className="hi-study" onClick={() => onOpen(s)}>
      <span className="hi-eyebrow">{s.status === 'active' ? 'COLLECTING' : 'CLOSED'} · {date(s.startsOn)} – {date(s.endsOn)}</span>
      <strong>{s.title}</strong>
      <span className="hi-progress" aria-label={`${s.responses} of ${s.minResponses} target responses`}><span style={{ width: `${Math.min(100, (s.responses / s.minResponses) * 100)}%` }} /></span>
      <span className="hi-muted">{s.responses} responses from {s.respondents} people · target {s.minResponses} · {s.products} products</span>
    </button>)}
  </section>;
}

function StudyReport({ session, study, onBack, onExpired }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { setError(''); api(`/api/insights/studies/${study.id}/report`, { session }).then(setReport).catch(e => (e.status === 401 ? onExpired() : setError(e.message))); }, [session, study.id, onExpired]);
  useEffect(load, [load]);
  if (error) return <p className="hi-error" role="alert">{error}</p>;
  if (!report) return <p role="status" className="hi-muted">Building the report…</p>;
  return <ReportView report={report} title={report.study.title} subtitle={`${report.study.responses} of ${report.study.minResponses} target responses collected.`}
    actions={<>
      <button className="hi-button hi-button-quiet" onClick={onBack}>← All studies</button>
      <button className="hi-button hi-button-quiet" onClick={load}>Refresh</button>
      <button className="hi-button hi-button-quiet" onClick={() => downloadFile(`/api/insights/studies/${study.id}/report.csv`, session.token, `hunch-insights-study-${study.id}.csv`).catch(e => setError(e.message))}>Export CSV (aggregates)</button>
      <button className="hi-button" onClick={() => window.print()}>Print / save PDF</button>
    </>} />;
}

export function InsightsApp() {
  const [session, setSession] = useState(readSession);
  const [study, setStudy] = useState(null);
  useEffect(() => {
    document.documentElement.classList.add('hi-mode');
    document.title = 'Hunch Insights';
    return () => document.documentElement.classList.remove('hi-mode');
  }, []);
  const signIn = useCallback(value => { writeSession(value); setSession(value); }, []);
  const signOut = useCallback(() => { writeSession(null); setSession(null); setStudy(null); }, []);
  return <div className="hunch-insights">
    <header className="hi-top">
      <a href="/" className="hi-brand" title="Back to Hunch home"><span aria-hidden="true">H</span>Hunch <em>Insights</em></a>
      {session && <div className="hi-top-user"><span className="hi-muted">{session.company}</span><button className="hi-link" onClick={signOut}>Sign out</button></div>}
    </header>
    {!session ? <SignIn onSignedIn={signIn} />
      : <main className="hi-main">{study ? <StudyReport session={session} study={study} onBack={() => setStudy(null)} onExpired={signOut} /> : <Studies session={session} onOpen={setStudy} onExpired={signOut} />}</main>}
  </div>;
}
