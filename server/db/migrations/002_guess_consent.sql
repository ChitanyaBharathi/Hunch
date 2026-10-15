-- The consent that was active when a guess was made. At reveal, a guess becomes research only if that same consent
-- is still active: exact even when consent and guess land in the same millisecond, and a withdraw-then-rejoin
-- between guess and reveal does not count.
ALTER TABLE guesses ADD COLUMN consent_id INTEGER REFERENCES consents(id);
