-- Brand experiment arm. 'standard': shown as catalogued. 'unbranded': brand removed (server/brandFrames.js).
-- Assigned at random per round, so the two arms are comparable.
ALTER TABLE rounds ADD COLUMN frame TEXT NOT NULL DEFAULT 'standard' CHECK (frame IN ('standard', 'unbranded'));
ALTER TABLE responses ADD COLUMN frame TEXT NOT NULL DEFAULT 'standard' CHECK (frame IN ('standard', 'unbranded'));
