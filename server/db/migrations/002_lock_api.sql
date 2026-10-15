-- Supabase serves every table in the public schema through its REST API. Hunch never uses that API: the server
-- connects to Postgres directly as the owner, which row-level security does not restrict. Enabling RLS with no
-- policies therefore closes the API to anyone holding the project's public key, without affecting the app.
ALTER TABLE companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE studies                ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_access_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE respondents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE players                ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_respondent_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations      ENABLE ROW LEVEL SECURITY;
