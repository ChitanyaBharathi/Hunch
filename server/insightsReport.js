import { buildReport } from './analytics/report.js';
import { categories as listCategories, productsById } from './db/catalog.js';
import { roomResearchRows, responses } from './db/research.js';
import { CONSENT_VERSION } from './consent.js';

export { reportCsv } from './analytics/report.js';

const METHODOLOGY_ROOM = 'Only revealed rounds from players with active research consent are included. Anything below the threshold is withheld. Guesses measure price perception; "most I\'d pay" is hypothetical, not a purchase.';

// Host's per-room view. Built from the game tables (research rows carry no room code by design).
export async function roomReport(db, room) {
  const rows = await roomResearchRows(db, room.id, CONSENT_VERSION);
  // Only revealed rounds: listing the rest would tell the host which items are coming up.
  const products = (await productsById(db, room.rounds.filter(r => r.revealedAt).map(r => r.productId)))
    .map(p => ({ ...p, priceCents: room.rounds.find(r => r.productId === p.id).priceCents }));
  return { scope: 'room', methodology: METHODOLOGY_ROOM, consentVersion: CONSENT_VERSION,
    ...buildReport({ products, rows, categories: (await listCategories(db)).map(c => c.name) }) };
}

// What every company report says about how the data was collected. Honest about who answered and what a guess is.
export const METHODOLOGY = {
  recruitment: 'Respondents are people playing Hunch, a price-guessing game played in groups or as a solo daily challenge, who opted in to research and confirmed they are 18 or older. They are not a random sample of shoppers.',
  task: 'Group games show ten products and the daily challenge five, in a shuffled order. Players guess the retail price before it is revealed, and can optionally say the most they would pay and the price below which it would seem too cheap to trust. Branded items are shown to a random half of games without their brand, described plainly; product figures use only the branded half, and the difference between the halves is reported as the brand premium.',
  inclusion: 'Only guesses made under active research consent are included, recorded when the price is revealed. Guesses more than 10 times too high or too low, or locked in under 1.5 seconds, are treated as not a real attempt and left out. Respondents who withdraw are deleted and drop out on the next refresh.',
  thresholds: 'Product figures need at least 5 responses; any split (age band, persona, fast vs slow) needs 10; personas need 10 people, each with at least two games of answers; anchoring needs 30 responses from 10 people. Anything below is withheld, not shown with a warning.',
  biases: [
    'Players skew young and are mostly in Singapore.',
    'It is a social setting: friends play together, and some guess for fun rather than with care.',
    'Players are guessing, not buying. "Most I\'d pay" is a stated, hypothetical answer, not a purchase.',
    'Earlier rounds in the same game reveal prices, which can shift later guesses. We measure this as the anchoring effect.',
    'Product images are illustrative unless the study supplied them.',
  ],
  statistics: 'Perception error is ln(guess ÷ price), so guessing double and guessing half count as equally far off; it is shown as a percentage, exp(median) − 1. Medians carry a 90% bootstrap interval. Anchoring compares guesses on the same product, with standard errors clustered by respondent.',
};

// A company study: pooled across every room and date inside the study window.
export async function studyReport(db, study) {
  const [products, rows, personaRows, anchorRows, categories] = await Promise.all([
    productsById(db, study.productIds),
    responses(db, { productIds: study.productIds, from: study.startsOn, to: study.endsOn }),
    responses(db),                                              // personas are fitted on everyone, then applied here
    responses(db, { from: study.startsOn, to: study.endsOn }),  // anchoring uses every product in the window
    listCategories(db),
  ]);
  return { scope: 'study', methodology: METHODOLOGY,
    study: { id: study.id, title: study.title, startsOn: study.startsOn, endsOn: study.endsOn, status: study.status, responses: rows.length, minResponses: study.minResponses },
    ...buildReport({ products, rows, personaRows, anchorRows, categories: categories.map(c => c.name) }) };
}
