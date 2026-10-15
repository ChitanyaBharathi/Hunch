import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { ResearchReport, downloadCsv } from './ResearchReport';

export function PricingInsights() {
  const { session, room } = useGame();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch(`/api/rooms/${session.code}/insights`, { headers: { Authorization: `Bearer ${session.token}` }, signal: controller.signal })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; })
      .then(setReport).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [session.code, session.token, refresh, room.history.length, room.researchConsent]);
  const download = () => downloadCsv(`/api/rooms/${session.code}/insights.csv`, { Authorization: `Bearer ${session.token}` }, 'pricing-insights.csv').catch(e => setError(e.message));
  const available = report?.products.filter(p => p.status === 'available') || [];
  return <section className="competition-view"><p className="eyebrow">HOST RESEARCH PREVIEW · THIS ROOM</p><h1>Price <em>perception.</em></h1><p className="caption">Find where perceived value differs from the retail benchmark, then use that gap to design a pricing experiment.</p><div className="insights-actions"><button className="btn-secondary" onClick={() => setRefresh(v => v + 1)}>Refresh insights</button><button className="btn-secondary" disabled={!available.length} onClick={download}>Export aggregate CSV</button></div>
    {error && <p className="action-error" role="alert">{error}</p>}
    {!report && !error && <p role="status">Loading research...</p>}
    {report && <><ResearchReport report={report} emptyMessage="Invite at least five people who choose to contribute to research, collect their guesses, then reveal the round. No simulated pricing curves or recommendations appear here." />
    <p className="caption">This preview covers one game room. Companies buying research see the pooled report across all rooms through the company portal.</p></>}
  </section>;
}
