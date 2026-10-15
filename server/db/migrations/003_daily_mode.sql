-- 'party': host-paced room. 'daily': one player, the same 5 products for everyone that day, auto-reveal.
ALTER TABLE rooms ADD COLUMN mode TEXT NOT NULL DEFAULT 'party' CHECK (mode IN ('party', 'daily'));
ALTER TABLE rooms ADD COLUMN daily_date TEXT;
