import { money } from '../leaderboard/LeaderboardView';

const signed = value => `${value > 0 ? '+' : ''}${value}%`;

export function ResearchReport({ report, emptyMessage }) {
  const available = report.products.filter(p => p.status === 'available');
  const categories = (report.categories || []).filter(c => c.status === 'available');
  return <>
    <p className="research-method">{report.methodology}</p>
    <p className="caption">At least {report.minimumSample} opted-in responses per product or metric are required to display results. This sample threshold reduces exposure; it is not a guarantee of anonymity or statistical reliability.</p>
    {!available.length && !categories.length && <div className="empty-state"><h2>Real evidence starts with players.</h2><p>{emptyMessage}</p></div>}
    {categories.length > 0 && <article className="insight-product"><p className="eyebrow">CATEGORY PRICE PERCEPTION</p><h2>Where shoppers over- and under-estimate</h2>
      {categories.map(c => <div className="insight-metrics" key={c.category}><div><span>{c.category} · {c.sampleCount} responses · {c.productsCovered} products</span><strong>{signed(c.medianBiasPercent)}</strong></div><div><span>Middle 50% of gaps</span><strong>{signed(c.biasP25Percent)} to {signed(c.biasP75Percent)}</strong></div><div><span>Stated max pay vs benchmark</span><strong>{c.medianMaximumPayVsBenchmarkPercent === null ? '—' : signed(c.medianMaximumPayVsBenchmarkPercent)}</strong></div></div>)}
    </article>}
    {available.map(product => <article className="insight-product" key={product.productId}><p className="eyebrow">{product.category} · {product.sampleCount} RESPONSES · {product.evidence}</p><h2>{product.title}</h2><div className="insight-metrics"><div><span>Median perceived price</span><strong>{money(product.medianPerceivedPrice)}</strong></div><div><span>{product.benchmarkStatus === 'demo' ? 'Demo benchmark' : 'Verified retail benchmark'}</span><strong>{money(product.retailBenchmark)}</strong></div><div><span>Median perception gap</span><strong>{signed(product.medianBiasPercent)}</strong></div></div><p>Middle 50% of guesses: <strong>{money(product.perceivedPriceP25)}–{money(product.perceivedPriceP75)}</strong>. {product.belowBenchmarkPercent}% guessed below the benchmark.</p><p>Stated maximum-pay median: <strong>{product.medianStatedMaximumPay === null ? 'Not enough optional responses' : money(product.medianStatedMaximumPay)}</strong>{product.budgetSampleCount !== null && ` (${product.budgetSampleCount} responses)`}.</p><div className="research-method"><strong>Experiment to consider</strong><p>{product.testSuggestion} Validate with a randomized offer test and actual conversion data before setting a selling price.</p></div></article>)}
  </>;
}

export async function downloadCsv(path, headers, filename) {
  const response = await fetch(path, { headers });
  if (!response.ok) throw new Error('Export failed. Try again.');
  const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
