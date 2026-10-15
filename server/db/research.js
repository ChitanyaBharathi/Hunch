// Research rows. Nothing here selects a name, room code, token or contact detail.
// Rows returned to the analytics layer carry respondentId for grouping only; it never leaves the server.

export function insertResponse(db, r) {
  db.prepare(`INSERT INTO responses (respondent_id, product_id, round_position, prev_product_price_cents, actual_price_cents, guess_cents,
      max_pay_cents, too_cheap_cents, ms_to_answer, answered_at, study_id, is_seed, frame)
    VALUES (@respondentId, @productId, @roundPosition, @prevPriceCents, @actualCents, @guessCents, @maxPayCents, @tooCheapCents,
      @msToAnswer, @answeredAt, @studyId, @isSeed, @frame)`)
    .run({ prevPriceCents: null, maxPayCents: null, tooCheapCents: null, msToAnswer: null, studyId: null, frame: 'standard', ...r, isSeed: r.isSeed ? 1 : 0 });
}

// An active study covering this product on this date; the product's sponsor study wins when it qualifies.
export function studyForProduct(db, productId, onDate) {
  return db.prepare(`SELECT s.id FROM studies s JOIN study_products sp ON sp.study_id = s.id
    LEFT JOIN products p ON p.id = sp.product_id
    WHERE sp.product_id = ? AND s.status = 'active' AND s.starts_on <= ? AND s.ends_on >= ?
    ORDER BY (p.sponsor_study_id = s.id) DESC, s.id LIMIT 1`).pluck().get(productId, onDate, onDate) ?? null;
}

export const activeStudyProductIds = (db, onDate) => db.prepare(`SELECT DISTINCT sp.product_id FROM studies s
  JOIN study_products sp ON sp.study_id = s.id WHERE s.status = 'active' AND s.starts_on <= ? AND s.ends_on >= ?`).pluck().all(onDate, onDate);

const ROW = `r.respondent_id AS respondentId, r.product_id AS productId, c.name AS category, r.round_position AS roundPosition,
  r.prev_product_price_cents AS prevPriceCents, r.actual_price_cents AS actualCents, r.guess_cents AS guessCents,
  r.max_pay_cents AS maxPayCents, r.too_cheap_cents AS tooCheapCents, r.ms_to_answer AS msToAnswer, r.answered_at AS answeredAt,
  re.age_band AS ageBand, r.is_seed AS isSeed, r.frame`;
const FROM = 'FROM responses r JOIN products p ON p.id = r.product_id JOIN categories c ON c.id = p.category_id JOIN respondents re ON re.id = r.respondent_id';

// Pooled across every room. Dates are inclusive YYYY-MM-DD bounds on answered_at.
export function responses(db, { productIds, from, to } = {}) {
  const where = [];
  const params = {};
  if (productIds) { where.push('r.product_id IN (SELECT value FROM json_each(@productIds))'); params.productIds = JSON.stringify(productIds); }
  if (from) { where.push('substr(r.answered_at, 1, 10) >= @from'); params.from = from; }
  if (to) { where.push('substr(r.answered_at, 1, 10) <= @to'); params.to = to; }
  return db.prepare(`SELECT ${ROW} ${FROM} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.id`).all(params);
}

// The host's per-room view, built from game tables: revealed guesses made under a consent that is still active.
// Withdrawal removes the link, so withdrawn players drop out immediately.
export function roomResearchRows(db, roomId, consentVersion) {
  return db.prepare(`SELECT l.respondent_id AS respondentId, r.product_id AS productId, c.name AS category, r.round_no AS roundPosition,
      prev.price_snapshot_cents AS prevPriceCents, r.price_snapshot_cents AS actualCents, g.guess_cents AS guessCents,
      g.max_pay_cents AS maxPayCents, g.too_cheap_cents AS tooCheapCents, g.ms_to_answer AS msToAnswer, g.submitted_at AS answeredAt,
      re.age_band AS ageBand, 0 AS isSeed, r.frame
    FROM guesses g JOIN rounds r ON r.id = g.round_id AND r.revealed_at IS NOT NULL
    LEFT JOIN rounds prev ON prev.room_id = r.room_id AND prev.round_no = r.round_no - 1
    JOIN products p ON p.id = r.product_id JOIN categories c ON c.id = p.category_id
    JOIN player_respondent_link l ON l.player_id = g.player_id JOIN respondents re ON re.id = l.respondent_id
    JOIN consents cs ON cs.id = g.consent_id AND cs.respondent_id = l.respondent_id AND cs.withdrawn_at IS NULL AND cs.consent_version = @consentVersion
    WHERE r.room_id = @roomId ORDER BY r.round_no`).all({ roomId, consentVersion });
}

export const responseCount = db => db.prepare('SELECT COUNT(*) FROM responses').pluck().get();
