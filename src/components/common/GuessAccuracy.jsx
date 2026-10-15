export function GuessAccuracy({ stats }) {
  return <div className="guess-accuracy">
    <strong>{stats.roundsPlayed ? `${stats.averageAccuracy}%` : '—'}</strong>
    <span>Average guess accuracy</span>
    <details className="accuracy-explanation">
      <summary>How it works</summary>
      <p>Each guess starts at 100%. We subtract the distance from the actual price as a percentage of that price, down to 0%. Above and below count equally.</p>
      <p>A S$90 or S$110 guess for a S$100 item scores 90% accuracy. This average includes your guesses from revealed rounds in this room; missed rounds are excluded.</p>
      {!stats.roundsPlayed && <p>Your average appears after your first guessed round is revealed.</p>}
    </details>
  </div>;
}
