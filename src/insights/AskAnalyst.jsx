import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Sparkles, X } from 'lucide-react';

const SUGGESTIONS = [
  'Which product is most underpriced in shoppers’ minds, and why?',
  'Is the brand name actually adding value anywhere?',
  'Which shopper persona should our next campaign target?',
];

const METRIC_WORDS = { perception_gap: 'perception gap', value_gap: 'value gap', brand_premium: 'brand premium', crowd_error: 'crowd accuracy', responses: 'number of responses' };
function stepLabel({ tool, args }) {
  if (tool === 'get_study_overview') return 'Read the study overview';
  if (tool === 'get_product_insights') return `Pulled the numbers for ${args.product}`;
  if (tool === 'compare_products') return `Ranked products by ${METRIC_WORDS[args.metric] ?? args.metric}`;
  if (tool === 'get_personas') return 'Checked the shopper personas';
  if (tool === 'get_anchoring_effect') return 'Checked the anchoring experiment';
  if (tool === 'get_methodology') return 'Checked how the data was collected';
  return tool;
}

// The answer comes back as short paragraphs and "- " bullets with **bold**. Rendered as elements, never as HTML.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
}
function Answer({ text }) {
  const blocks = [];
  for (const line of text.split('\n').map(l => l.trim())) {
    const bullet = line.match(/^[-*•]\s+(.*)/);
    if (bullet) { const last = blocks.at(-1); if (last?.type === 'ul') last.items.push(bullet[1]); else blocks.push({ type: 'ul', items: [bullet[1]] }); }
    else if (line) blocks.push({ type: 'p', text: line });
  }
  return <div className="hi-ask-answer">{blocks.map((b, i) => (b.type === 'ul' ? <ul key={i}>{b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}</ul> : <p key={i}>{inline(b.text)}</p>))}</div>;
}

export function AskAnalyst({ session, study, onExpired }) {
  const [status, setStatus] = useState(null);
  const [turns, setTurns] = useState([]);
  const [question, setQuestion] = useState('');
  const busy = turns.some(t => t.pending);
  const endRef = useRef(null);

  useEffect(() => {
    fetch('/api/insights/agent', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => r.json()).then(setStatus).catch(() => setStatus({ enabled: false }));
  }, [session.token]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns]);

  const update = (index, change) => setTurns(all => all.map((t, i) => (i === index ? { ...t, ...change(t) } : t)));

  const ask = async text => {
    const q = text.trim();
    if (!q || busy) return;
    const history = turns.filter(t => t.answer).flatMap(t => [{ role: 'user', text: t.question }, { role: 'model', text: t.answer }]);
    const index = turns.length;
    setTurns(all => [...all, { question: q, steps: [], answer: '', error: '', pending: true }]);
    setQuestion('');
    try {
      const response = await fetch(`/api/insights/studies/${study.id}/ask`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ question: q, history }) });
      if (response.status === 401) { onExpired(); return; }
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'The analyst could not answer. Try again.'); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === 'step') update(index, t => ({ steps: [...t.steps, event] }));
          if (event.type === 'answer') update(index, () => ({ answer: event.text }));
          if (event.type === 'error') update(index, () => ({ error: event.error }));
        }
      }
    } catch (e) {
      update(index, () => ({ error: e.message }));
    } finally {
      update(index, t => ({ pending: false, error: t.error || (t.answer ? '' : 'The analyst stopped without an answer. Try again.') }));
    }
  };

  return <section className="hi-ask" aria-label="Ask the AI analyst">
    <header className="hi-ask-head">
      <span className="hi-ask-badge" aria-hidden="true"><Sparkles size={20} /></span>
      <div><p className="hi-eyebrow">AI ANALYST</p><h2>Ask Hunch about this study</h2></div>
    </header>
    <p className="hi-note">An AI agent (Google Gemini) picks which analyses to run, runs them on this study’s data, and writes up what it finds. It only quotes numbers it looked up, and it can’t see anything the report withholds.</p>

    {status && !status.enabled && <p className="hi-banner" role="note"><strong>Not set up yet.</strong> Add <code>GEMINI_API_KEY=your-key</code> to <code>.env</code> and restart the server.</p>}

    {turns.map((t, i) => <article key={i} className="hi-ask-turn">
      <p className="hi-ask-question">{t.question}</p>
      {(t.steps.length > 0 || t.pending) && <ol className="hi-ask-steps" aria-label="What the analyst did">
        {t.steps.map((s, j) => <li key={j} className={s.ok ? '' : 'failed'}>{s.ok ? <Check size={14} /> : <X size={14} />}{stepLabel(s)}</li>)}
        {t.pending && !t.answer && <li className="thinking"><span className="hi-ask-dots" aria-hidden="true"><i /><i /><i /></span>{t.steps.length ? 'Working it out' : 'Planning which analyses to run'}</li>}
      </ol>}
      {t.answer && <Answer text={t.answer} />}
      {t.error && <p className="hi-error" role="alert">{t.error}</p>}
    </article>)}
    <div ref={endRef} />

    {turns.length === 0 && status?.enabled && <div className="hi-ask-suggestions">{SUGGESTIONS.map(s => <button key={s} type="button" onClick={() => ask(s)} disabled={busy}>{s}</button>)}</div>}

    <form className="hi-ask-form" onSubmit={e => { e.preventDefault(); ask(question); }}>
      <label className="hi-sr" htmlFor="hi-ask-input">Your question</label>
      <input id="hi-ask-input" value={question} maxLength={500} onChange={e => setQuestion(e.target.value)} disabled={!status?.enabled || busy}
        placeholder={turns.length ? 'Ask a follow-up…' : 'e.g. Why do people underestimate our headphones?'} />
      <button className="hi-button" disabled={!status?.enabled || busy || !question.trim()}><span>{busy ? 'Thinking' : 'Ask'}</span><ArrowRight size={18} /></button>
    </form>
  </section>;
}
