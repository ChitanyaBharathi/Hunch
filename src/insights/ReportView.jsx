import { sgd, pct, gapWords, date } from './format';
import { PerceptionMap } from './charts/PerceptionMap';
import { GuessStrip } from './charts/GuessStrip';
import { SensitivityChart } from './charts/SensitivityChart';
import { GapBars } from './charts/GapBars';

const AGE_LABEL = { '18-24': '18–24', '25-34': '25–34', '35-44': '35–44', '45-54': '45–54', '55-64': '55–64', '65+': '65+' };
const withheld = (n, minimum) => `Not enough responses yet: ${n} of ${minimum} needed. Withheld until then.`;

function Headline({ p }) {
  if (p.suppressed) return <article className="hi-headline hi-headline-empty"><p className="hi-eyebrow">{p.category}</p><h3>{p.name}</h3><p>{withheld(p.n, p.minimum)}</p></article>;
  return <article className="hi-headline">
    <p className="hi-eyebrow">{p.category}{p.quadrant ? ` · ${p.quadrant}` : ''}</p>
    <p className="hi-sentence">{p.headline}</p>
    <dl className="hi-stats">
      <div><dt>Perception gap</dt><dd>{pct(p.perceptionGap.pct)}</dd><small>thought {gapWords(p.perceptionGap.pct)} than it is</small></div>
      <div><dt>Value gap</dt><dd>{p.valueGap.suppressed ? '—' : pct(p.valueGap.pct)}</dd><small>{p.valueGap.suppressed ? withheld(p.valueGap.n, p.valueGap.minimum) : p.valueGap.pct >= 0 ? 'room above the price' : 'sticker shock'}</small></div>
      <div><dt>Responses</dt><dd>{p.n}</dd><small>90% interval for the median {sgd(p.perceived.ci90Cents[0])}–{sgd(p.perceived.ci90Cents[1])}</small></div>
    </dl>
  </article>;
}

function BrandLine({ p }) {
  const b = p.brand;
  if (!b) return null;
  if (b.suppressed) return <p className="hi-note hi-muted"><strong>Brand experiment.</strong> {withheld(b.n, b.minimum)} ({b.branded} with the brand shown, {b.unbranded} without).</p>;
  return <p className="hi-note"><strong>Brand experiment.</strong> Shown with its brand, people guessed {pct(b.premiumPct, { signed: false })} {b.premiumPct >= 0 ? 'higher' : 'lower'} than for the same item described without it (90% interval {pct(b.ci90[0])} to {pct(b.ci90[1])}; n = {b.branded.n} vs {b.unbranded.n}).{!b.clear && ' The interval includes zero, so the brand’s effect is not yet clear.'}</p>;
}

function ProductEvidence({ p, personas }) {
  const crowd = p.crowd;
  const conf = p.confidence;
  const personaRows = p.personas.filter(v => !v.product.suppressed).map(v => ({ label: v.name, sub: `${v.product.n} responses · ${v.size} people in persona`, n: v.product.n,
    perception: v.product.perceptionGapPct, value: v.product.valueGap.suppressed ? null : v.product.valueGap.pct }));
  const ageRows = p.ageBands.map(a => ({ label: AGE_LABEL[a.segment] ?? a.segment, sub: `${a.n} responses`, n: a.n, perception: a.perceptionGapPct, value: a.valueGap.suppressed ? null : a.valueGap.pct }));
  return <section className="hi-product" id={`product-${p.id}`}>
    <header><p className="hi-eyebrow">{p.category}{p.brand ? ` · ${p.brand}` : ''}</p><h3>{p.name}</h3><p className="hi-muted">Real price {sgd(p.currentCents)} · {p.n} responses</p></header>

    <h4>How people guessed</h4>
    <GuessStrip product={p} />
    <p className="hi-note"><strong>Wisdom of the crowd.</strong> The crowd's median guess was {pct(crowd.crowdErrorPct, { signed: false })} off; the average player was {pct(crowd.averageIndividualErrorPct, { signed: false })} off. The crowd beat {pct(crowd.beatenShare, { signed: false })} of individual guesses.</p>
    {conf.suppressed ? <p className="hi-note hi-muted">Fast vs slow answers: {withheld(conf.n, conf.minimum)}</p>
      : <p className="hi-note"><strong>Confidence.</strong> Fast answers (under {conf.medianSeconds}s, n = {conf.fast.n}) were typically {pct(conf.fast.typicalErrorPct, { signed: false })} off; slower ones (n = {conf.slow.n}) {pct(conf.slow.typicalErrorPct, { signed: false })}. {conf.wellKnown ? 'Quick and accurate: this price is well known.' : 'People are not sure of this price; they take time and still miss.'}</p>}

    <BrandLine p={p} />

    <h4>Price sensitivity</h4>
    {p.sensitivity.suppressed ? <p className="hi-muted">{withheld(p.sensitivity.n, p.sensitivity.minimum)}</p> : <SensitivityChart sensitivity={p.sensitivity} />}

    <h4>Who thinks what</h4>
    {personas.suppressed ? <p className="hi-muted">Personas need at least {personas.minimum} respondents with two games of answers ({personas.n} so far).</p>
      : personaRows.length ? <GapBars rows={personaRows} caption={`How each persona sees ${p.name}`} /> : <p className="hi-muted">No persona has 10 or more responses on this product yet.</p>}
    {ageRows.length ? <><h5>By age band</h5><GapBars rows={ageRows} caption={`${p.name} by age band`} /></> : <p className="hi-muted hi-small">Age-band splits appear once a band has 10 responses.</p>}
  </section>;
}

export function ReportView({ report, title, subtitle, actions, assistant, scope = 'study' }) {
  const published = report.products.filter(p => !p.suppressed);
  const branded = published.filter(p => p.brand && !p.brand.suppressed).sort((a, b) => b.brand.premiumPct - a.brand.premiumPct);
  const { anchoring, personas, sample, methodology } = report;
  return <div className="hi-report">
    <header className="hi-report-head">
      <p className="hi-eyebrow">{scope === 'study' ? 'HUNCH INSIGHTS · STUDY REPORT' : 'HUNCH INSIGHTS · THIS ROOM'}</p>
      <h1>{title}</h1>
      {subtitle && <p className="hi-lede">{subtitle}</p>}
      <p className="hi-muted">{sample.responses} responses from {sample.respondents} people · {date(sample.firstAnsweredAt)} – {date(sample.lastAnsweredAt)} · generated {date(report.generatedAt)}</p>
      {sample.includesSyntheticData && <p className="hi-banner" role="note"><strong>Includes synthetic demo data.</strong> Seeded respondents with planted patterns, for demonstration only. Remove with <code>npm run seed:remove</code>.</p>}
      {actions && <div className="hi-actions">{actions}</div>}
    </header>

    {assistant}

    <section className="hi-section"><h2><span>1</span>Headlines</h2>
      <div className="hi-headlines">{report.products.map(p => <Headline key={p.id} p={p} />)}</div>
    </section>

    {report.map.length > 0 && <section className="hi-section"><h2><span>2</span>Price perception map</h2>
      <p className="hi-lede">Where each product sits: left means shoppers think it's cheaper than it is; up means they'd pay more than the real price.</p>
      <PerceptionMap points={report.map} />
      <dl className="hi-quadrants">{Object.entries(report.quadrants).map(([name, text]) => <div key={name}><dt>{name}</dt><dd>{text}</dd></div>)}</dl>
    </section>}

    {published.length > 0 && <section className="hi-section"><h2><span>3–5</span>The evidence, product by product</h2>
      {published.length > 1 && <nav className="hi-jump" aria-label="Products">{published.map(p => <a key={p.id} href={`#product-${p.id}`}>{p.name}</a>)}</nav>}
      {!personas.suppressed && <div className="hi-personas">
        <p className="hi-lede">Price personas: people who think alike. {personas.eligibleRespondents} respondents with enough answers fall into {personas.list.length} groups (k = {personas.k}, silhouette {personas.silhouette}).</p>
        <div className="hi-persona-grid">{personas.list.map(p => <article key={p.name}><h5>{p.name}</h5><p>{p.description}</p><small>{p.size} people</small></article>)}</div>
      </div>}
      {published.map(p => <ProductEvidence key={p.id} p={p} personas={personas} />)}
    </section>}

    {branded.length > 0 && <section className="hi-section"><h2><span>6</span>What the brand is worth</h2>
      <p className="hi-lede">Each branded item was shown to a random half of games without its brand, described plainly. The gap between the two halves is what the name alone adds to the price people expect.</p>
      <GapBars rows={branded.map(p => ({ label: p.name, sub: `n = ${p.brand.branded.n} with brand, ${p.brand.unbranded.n} without · 90% interval ${pct(p.brand.ci90[0])} to ${pct(p.brand.ci90[1])}`, n: p.brand.branded.n + p.brand.unbranded.n, perception: p.brand.premiumPct, value: null }))}
        caption="Brand premium on perceived price" columns={['Brand premium']} />
      <p className="hi-note">For brand owners this is the price headroom the name earns; for retailers it shows which house-brand alternatives shoppers will under-value.</p>
    </section>}

    <section className="hi-section"><h2><span>{branded.length > 0 ? 7 : 6}</span>Anchoring: what came before moves the guess</h2>
      {anchoring.suppressed ? <p className="hi-muted">The anchoring estimate needs at least {anchoring.minimum} responses with a previous item from 10 people ({anchoring.n} so far).</p> : <div className="hi-anchor">
        <div className="hi-hero"><strong>{pct(anchoring.perDoublingPct)}</strong><span>change in guesses when the previous item cost twice as much</span><small>95% interval {pct(anchoring.perDoublingCi[0])} to {pct(anchoring.perDoublingCi[1])} · n = {anchoring.n} from {anchoring.respondents} people</small></div>
        <div><p className="hi-sentence hi-sentence-small">{anchoring.sentence}</p>
          <p className="hi-note">Products appear in a shuffled order, so what a player saw just before is random: a natural experiment. We compare guesses on the same product and ask whether they rise when the previous item was pricier. For retailers this bears on shelf placement, "you may also like" rows and bundle pages.</p></div>
      </div>}
    </section>

    <section className="hi-section hi-method"><h2><span>{branded.length > 0 ? 8 : 7}</span>Methodology and sample</h2>
      {typeof methodology === 'string' ? <p>{methodology}</p> : <>
        <dl>
          <div><dt>Dates</dt><dd>{report.study ? `${date(report.study.startsOn)} – ${date(report.study.endsOn)} (study window)` : `${date(sample.firstAnsweredAt)} – ${date(sample.lastAnsweredAt)}`}</dd></div>
          <div><dt>Sample</dt><dd>{sample.responses} responses from {sample.respondents} people{report.study ? `; study target ${report.study.minResponses} responses` : ''}.{sample.excludedLowQuality > 0 && ` ${sample.excludedLowQuality} further answers were left out as not a real attempt.`}</dd></div>
          <div><dt>Recruitment</dt><dd>{methodology.recruitment}</dd></div>
          <div><dt>Task</dt><dd>{methodology.task}</dd></div>
          <div><dt>What counts</dt><dd>{methodology.inclusion}</dd></div>
          <div><dt>Thresholds</dt><dd>{methodology.thresholds}</dd></div>
          <div><dt>Statistics</dt><dd>{methodology.statistics}</dd></div>
        </dl>
        <h4>Known biases</h4>
        <ul>{methodology.biases.map(b => <li key={b}>{b}</li>)}</ul>
      </>}
    </section>
  </div>;
}
