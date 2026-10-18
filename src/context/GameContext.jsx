import { createContext, useContext, useState, useEffect, useRef } from 'react';

const GameContext = createContext();
const SESSION_KEY = 'hunch_session_v1';
// Carry sessions over from before the rename so players in an ongoing game stay signed in.
try {
  for (const [from, to] of [['priceisright_session_v1', SESSION_KEY], ['priceisright_sessions_v1', 'hunch_sessions_v1']]) {
    const old = localStorage.getItem(from);
    if (old !== null && localStorage.getItem(to) === null) localStorage.setItem(to, old);
    localStorage.removeItem(from);
  }
} catch { /* Storage unavailable; nothing to migrate. */ }
// One research identity per browser, so the same person's answers link across games. The checkbox confirms 18+.
const KEY_STORE = 'hunch_respondent_key';
const readKey = () => { try { return localStorage.getItem(KEY_STORE); } catch { return null; } };
const keepKey = data => { if (data?.respondentKey) try { localStorage.setItem(KEY_STORE, data.respondentKey); } catch { /* new identity next game */ } };
const withResearch = body => (body.researchConsent ? { ...body, ageConfirmed: true, respondentKey: readKey() ?? undefined } : body);

const forget = code => {
  try { const remembered = JSON.parse(localStorage.getItem('hunch_sessions_v1')) || {}; delete remembered[code]; localStorage.setItem('hunch_sessions_v1', JSON.stringify(remembered)); } catch { /* No saved session to remove. */ }
};

export function GameProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
      const code = new URLSearchParams(window.location.search).get('room')?.toUpperCase();
      if (!code || saved?.code === code) return saved || null;
      const remembered = JSON.parse(localStorage.getItem('hunch_sessions_v1')) || {};
      return Object.hasOwn(remembered, code) ? remembered[code] : null;
    } catch { return null; }
  });
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (!session) return;
    try {
      const remembered = JSON.parse(localStorage.getItem('hunch_sessions_v1')) || {};
      remembered[session.code] = session;
      localStorage.setItem('hunch_sessions_v1', JSON.stringify(remembered));
    } catch { /* Gameplay remains available when storage is unavailable. */ }
    let cancelled = false;
    let timer;
    const refresh = async () => {
      const startedAt = generation.current;
      try {
        const response = await fetch(`/api/rooms/${session.code}`, { headers: { Authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(6000) });
        const data = await response.json();
        if (cancelled || startedAt !== generation.current) return;
        // 410: the host ended the game, so everyone goes home.
        if (response.status === 401 || response.status === 404 || response.status === 410) { forget(session.code); setSession(null); setRoom(null); setError(data.error); return; }
        if (!response.ok) throw new Error(data.error);
        setRoom(data); setConnected(true);
      } catch { if (!cancelled) setConnected(false); }
      finally { if (!cancelled) timer = setTimeout(refresh, 1000); }
    };
    refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [session]);

  const request = async (path, body, authenticated = false) => {
    const response = await fetch(path, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Something went wrong. Try again.');
    return data;
  };
  const enterRoom = async (name, code, researchConsent = false, mode = 'party') => {
    setBusy(true); setError('');
    try {
      const data = await request(code ? `/api/rooms/${code.toUpperCase()}/join` : '/api/rooms', withResearch({ name, researchConsent, mode }));
      keepKey(data);
      generation.current += 1;
      setRoom(data.room); setSession(data.session); setConnected(true);
      return true;
    } catch (e) { setError(e.name === 'TimeoutError' || e instanceof TypeError ? 'Cannot reach the game server. Check your connection and try again.' : e.message); return false; }
    finally { setBusy(false); }
  };
  const act = async (action, body = {}) => {
    if (busy || !room) return false;
    setBusy(true); setError(''); generation.current += 1;
    try {
      const data = await request(`/api/rooms/${session.code}/${action}`, withResearch({ ...body, roundIndex: room.roundIndex }), true);
      keepKey(data);
      generation.current += 1;
      setRoom(data); setConnected(true); return true;
    } catch (e) { setError(e.name === 'TimeoutError' || e instanceof TypeError ? 'Cannot reach the game server. Check your connection and try again.' : e.message); return false; }
    finally { setBusy(false); }
  };
  const leaveRoom = () => {
    forget(session.code);
    generation.current += 1; setSession(null); setRoom(null); setError(''); setConnected(false);
  };
  // The host leaving a party game ends it for everyone; their apps notice on the next refresh.
  const endRoom = async () => (await act('end')) && (leaveRoom(), true);
  return <GameContext.Provider value={{ room, session, busy, error, connected, enterRoom, act, leaveRoom, endRoom, clearError: () => setError('') }}>{children}</GameContext.Provider>;
}
export function useGame() { return useContext(GameContext); }
