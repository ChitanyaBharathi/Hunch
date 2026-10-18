-- A host can end a game early for everyone: the room becomes 'closed' and its players are sent home.
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check CHECK (status IN ('playing', 'finished', 'closed'));
